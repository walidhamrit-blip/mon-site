#!/usr/bin/env node
/**
 * Recharge automatique du solde fournisseur (FazerCards ← NOWPayments).
 *
 * Contexte : le solde FazerCards est un préfinancement, débité du COÛT
 * fournisseur à chaque vente livrée. Sans refinancement il cesse de couvrir
 * le plafond de vente, et une commande encaissée devient impossible à honorer.
 *
 * Ce que ces tests protègent — dans l'ordre d'importance :
 *  1. aucun virement ne part sans interrupteur, sans seuil atteint, ou quand un
 *     virement est déjà en attente (pas de double envoi) ;
 *  2. le montant envoyé couvre toujours la facture fournisseur, frais inclus ;
 *  3. un frais réseau disproportionné reporte l'envoi au lieu de manger la marge ;
 *  4. le cron planifié ne peut pas dépenser (simulation par défaut) ;
 *  5. le TOTP suit la RFC 6238 (sinon la 2FA des virements échouerait).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AUTOTOPUP_HISTORY_LIMIT,
  AUTOTOPUP_PENDING_TTL_MS,
  approveTopUpWithFee,
  emptyAutotopupState,
  isFazercardsPaymentCredited,
  isPayoutFailed,
  isPayoutFinished,
  isPayoutPending,
  pendingIsFresh,
  planTopUp,
  pushHistory,
  roundUpToStep,
} from "../src/lib/fazercards-autotopup-core.ts";
import { generateTotp, isValidTotpSecret } from "../src/lib/totp.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");

const config = {
  enabled: true,
  thresholdUsd: 50,
  maxUsd: 300,
  maxFeeRatio: 0.03,
  method: "trc20",
};

const planFor = (overrides = {}) =>
  planTopUp({
    config,
    balanceUsd: 100,
    targetUsd: 400,
    minDepositUsd: 10,
    pending: false,
    emergency: false,
    ...overrides,
  });

/* ------------------------- Décision : quand recharger ------------------------- */

test("interrupteur coupé : aucun virement, même avec un solde à zéro", () => {
  const plan = planFor({ config: { ...config, enabled: false }, balanceUsd: 0 });
  assert.equal(plan.action, "wait");
  assert.match(plan.reason, /désactivée/);
});

test("virement déjà en attente : jamais de second envoi", () => {
  const plan = planFor({ pending: true });
  assert.equal(plan.action, "wait");
  assert.match(plan.reason, /déjà en attente/);
});

test("solde illisible : on ne devine pas un montant", () => {
  const plan = planFor({ balanceUsd: null });
  assert.equal(plan.action, "wait");
  assert.match(plan.reason, /illisible/);
});

test("solde au-dessus du float cible : rien à faire", () => {
  const plan = planFor({ balanceUsd: 420 });
  assert.equal(plan.action, "wait");
  assert.match(plan.reason, /rien à faire/);
});

test("écart sous le seuil : on attend (pas de micro-virement)", () => {
  // 400 - 370 = 30 $ < 50 $ de seuil, et le niveau reste « ok ».
  const plan = planFor({ balanceUsd: 370 });
  assert.equal(plan.action, "wait");
  assert.match(plan.reason, /sous le seuil/);
});

test("niveau dégradé (urgence) : le seuil ne bloque plus", () => {
  const plan = planFor({ balanceUsd: 370, emergency: true });
  assert.equal(plan.action, "topup");
  assert.equal(plan.invoiceUsd, 30);
  assert.match(plan.reason, /urgence/);
});

test("l'écart est arrondi au palier supérieur de 10 $", () => {
  const plan = planFor({ balanceUsd: 348 }); // écart 52 → 60
  assert.equal(plan.action, "topup");
  assert.equal(plan.invoiceUsd, 60);
});

test("le plafond par virement borne le montant", () => {
  const plan = planFor({ balanceUsd: 0, targetUsd: 400, config: { ...config, maxUsd: 120 } });
  assert.equal(plan.action, "topup");
  assert.equal(plan.invoiceUsd, 120);
});

test("un écart inférieur au minimum de dépôt fournisseur est refusé", () => {
  // Écart 25 → arrondi 30, mais la méthode exige 40 $.
  const plan = planFor({ balanceUsd: 375, minDepositUsd: 40, emergency: true });
  assert.equal(plan.action, "wait");
  assert.match(plan.reason, /minimum de dépôt/);
});

test("roundUpToStep n'arrondit jamais vers le bas ni à zéro pour un besoin réel", () => {
  assert.equal(roundUpToStep(0.4), 10);
  assert.equal(roundUpToStep(10), 10);
  assert.equal(roundUpToStep(10.01), 20);
  assert.equal(roundUpToStep(0), 0);
});

/* --------------------- Financement : frais et solde custody --------------------- */

const approved = (overrides = {}) =>
  approveTopUpWithFee({
    plan: { action: "topup", invoiceUsd: 60, sendUsd: 60, feeUsd: null, reason: "test" },
    config,
    feeUsd: 1,
    custodyAvailableUsd: 500,
    emergency: false,
    ...overrides,
  });

test("le montant envoyé couvre la facture : facture + frais réseau", () => {
  const decision = approved();
  assert.equal(decision.action, "topup");
  assert.equal(decision.invoiceUsd, 60);
  assert.equal(decision.sendUsd, 61);
  assert.match(decision.reason, /frais réseau/);
});

test("frais réseau inconnus : envoi reporté (jamais d'approximation sur de l'argent)", () => {
  const decision = approved({ feeUsd: null });
  assert.equal(decision.action, "wait");
  assert.match(decision.reason, /frais réseau inconnus/);
});

test("frais disproportionnés : on attend au lieu de perdre la marge", () => {
  // 3 $ sur 60 $ = 5 % > limite de 3 %.
  const decision = approved({ feeUsd: 3 });
  assert.equal(decision.action, "wait");
  assert.match(decision.reason, /au-delà de la limite/);
});

test("en urgence, la tolérance de frais double (2 × 3 % = 6 %)", () => {
  const decision = approved({ feeUsd: 3, emergency: true });
  assert.equal(decision.action, "topup");
  assert.equal(decision.sendUsd, 63);
});

test("solde custody insuffisant : aucun virement à découvert", () => {
  const decision = approved({ custodyAvailableUsd: 20 });
  assert.equal(decision.action, "wait");
  assert.match(decision.reason, /custody/);
});

test("solde custody illisible : on reporte", () => {
  const decision = approved({ custodyAvailableUsd: null });
  assert.equal(decision.action, "wait");
  assert.match(decision.reason, /custody/);
});

test("un plan non retenu traverse sans être transformé en virement", () => {
  const decision = approveTopUpWithFee({
    plan: { action: "wait", invoiceUsd: 0, sendUsd: 0, feeUsd: null, reason: "seuil" },
    config,
    feeUsd: 1,
    custodyAvailableUsd: 500,
    emergency: false,
  });
  assert.equal(decision.action, "wait");
  assert.equal(decision.sendUsd, 0);
});

/* ------------------------------ États et registre ------------------------------ */

test("une facture en attente expire (durée de vie ou expiration fournisseur)", () => {
  const now = Date.parse("2026-10-30T12:00:00Z");
  const pending = {
    paymentId: "tx1",
    address: "T…",
    invoiceUsd: 60,
    sendUsd: 61,
    currency: "usdttrc20",
    payoutId: null,
    createdAt: now - 60 * 60 * 1000,
    expiresAt: null,
  };
  assert.equal(pendingIsFresh(pending, now), true);
  assert.equal(pendingIsFresh(pending, now + AUTOTOPUP_PENDING_TTL_MS + 1), false);
  // Expiration fournisseur plus courte que la nôtre : c'est la plus stricte qui gagne.
  assert.equal(
    pendingIsFresh({ ...pending, expiresAt: new Date(now - 1000).toISOString() }, now),
    false,
  );
  assert.equal(pendingIsFresh(null, now), false);
});

test("les statuts de virement sont classés sans ambiguïté", () => {
  for (const status of ["waiting", "creating", "processing", "sending"]) {
    assert.equal(isPayoutPending(status), true, status);
    assert.equal(isPayoutFailed(status), false, status);
  }
  for (const status of ["failed", "rejected", "cancelled"]) {
    assert.equal(isPayoutFailed(status), true, status);
  }
  assert.equal(isPayoutFinished("finished"), true);
  // Un statut inconnu n'est ni « fini » ni « en échec » : on attend.
  assert.equal(isPayoutFinished("weird"), false);
  assert.equal(isPayoutPending("weird"), false);
});

test("une facture fournisseur n'est créditée que sur un signal explicite", () => {
  assert.equal(isFazercardsPaymentCredited({ status: "completed" }), true);
  assert.equal(isFazercardsPaymentCredited({ status: "pending" }), false);
  assert.equal(isFazercardsPaymentCredited({ status: "cancelled" }), false);
  assert.equal(isFazercardsPaymentCredited({ status: null, completedAt: "2026-10-30T10:00:00Z" }), true);
});

test("l'historique garde les entrées les plus récentes, en nombre borné", () => {
  let history = [];
  for (let index = 0; index < AUTOTOPUP_HISTORY_LIMIT + 5; index += 1) {
    history = pushHistory(history, {
      at: index,
      invoiceUsd: 10,
      sendUsd: 11,
      paymentId: `tx${index}`,
      payoutId: null,
      status: "crédité",
      detail: null,
    });
  }
  assert.equal(history.length, AUTOTOPUP_HISTORY_LIMIT);
  assert.equal(history[0].paymentId, `tx${AUTOTOPUP_HISTORY_LIMIT + 4}`);
});

test("l'état vide est stable (aucune facture fantôme)", () => {
  const state = emptyAutotopupState();
  assert.equal(state.pending, null);
  assert.equal(state.history.length, 0);
  assert.equal(state.lastRunAt, null);
});

/* --------------------------------- TOTP (RFC 6238) --------------------------------- */

test("le TOTP respecte les vecteurs de la RFC 6238 (SHA-1)", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // "12345678901234567890"
  const vectors = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];
  for (const [seconds, expected] of vectors) {
    assert.equal(generateTotp(secret, { at: seconds * 1000, digits: 8 }), expected, `T=${seconds}`);
  }
});

test("le code à 6 chiffres est le suffixe du code à 8 chiffres", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(generateTotp(secret, { at: 59_000 }), "287082");
});

test("les secrets TOTP manifestement invalides sont écartés", () => {
  assert.equal(isValidTotpSecret(""), false);
  assert.equal(isValidTotpSecret("trop-court"), false);
  assert.equal(isValidTotpSecret("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"), true);
  assert.equal(isValidTotpSecret("gezd gnbv gy3t qojq gezd gnbv gy3t qojq"), true);
});

/* --------------------------------- Câblage --------------------------------- */

test("le cron de recharge est protégé et SIMULE par défaut", () => {
  const route = read("src/app/api/cron/fazercards-topup/route.ts");
  assert.match(route, /cron_not_configured/);
  assert.match(route, /status: 401/);
  // Simulation par défaut : seuls `execute=1` + l'interrupteur autorisent l'envoi.
  assert.match(route, /searchParams\.get\("execute"\) === "1"/);
  assert.match(route, /runFazercardsAutotopup\(\{ execute \}\)/);
});

test("l'interrupteur serveur est indispensable à toute exécution réelle", () => {
  const runtime = read("src/lib/fazercards-autotopup.ts");
  assert.match(runtime, /FAZERCARDS_AUTOTOPUP_ENABLED/);
  assert.match(runtime, /=== "true"/);
  // Deux verrous distincts : la config et la vérification juste avant l'envoi.
  assert.match(runtime, /exécution refusée : FAZERCARDS_AUTOTOPUP_ENABLED/);
  // L'état est écrit AVANT le virement (pas de double facture en cas de crash).
  const beforePayout = runtime.indexOf("await writeAutotopupState({ ...state, pending, lastRunAt: now");
  const createCall = runtime.indexOf("await createPayout(");
  assert.ok(beforePayout > 0 && createCall > beforePayout, "état pending écrit après le virement");
});

test("le module de virement n'est importé que par la recharge automatique", () => {
  // Un seul point d'entrée vers `nowpayments-payout` : l'orchestrateur. Les
  // routes passent par lui, jamais directement par un virement.
  assert.match(read("src/lib/fazercards-autotopup.ts"), /from "@\/lib\/nowpayments-payout"/);
  for (const route of [
    "src/app/api/cron/fazercards-topup/route.ts",
    "src/app/api/admin/digital/fazercards-topup/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /@\/lib\/fazercards-autotopup/);
    assert.doesNotMatch(source, /nowpayments-payout/);
  }
  // La route publique de santé ne doit jamais toucher aux virements.
  assert.doesNotMatch(read("src/app/api/health/route.ts"), /payout|autotopup/i);
});

test("sans registre lisible, aucun virement n'est même préparé", () => {
  const runtime = read("src/lib/fazercards-autotopup.ts");
  // Lecture STRICTE au début du passage : la base suspendue (quota Neon) ne
  // doit jamais être confondue avec « aucun virement en cours ».
  assert.match(runtime, /readAutotopupState\(\{ strict: true \}\)/);
  assert.match(runtime, /registre de recharge indisponible/);
  assert.match(runtime, /class AutotopupRegistryError/);
  // L'administration, elle, continue de dégrader sans erreur.
  const statusFn = runtime.slice(runtime.indexOf("export async function getFazercardsAutotopupStatus"));
  assert.match(statusFn, /await readAutotopupState\(\)/);
});

test("le registre doit être inscriptible AVANT toute facture fournisseur", () => {
  const runtime = read("src/lib/fazercards-autotopup.ts");
  const probe = runtime.indexOf("registre vérifié avant envoi");
  const invoice = runtime.indexOf("await fazercardsPaymentCreate(");
  assert.ok(probe > 0, "sonde d'écriture absente");
  assert.ok(invoice > probe, "facture créée avant la vérification du registre");
  // Et une écriture « pending » ratée annule l'envoi.
  assert.match(runtime, /registre de recharge non inscriptible/);
  assert.match(runtime, /aucun virement effectué \(facture/);
});

test("le cron est déclaré une fois par jour dans vercel.json", () => {
  const vercel = JSON.parse(read("vercel.json"));
  const entry = vercel.crons.find((cron) => cron.path === "/api/cron/fazercards-topup");
  assert.ok(entry, "cron de recharge absent de vercel.json");
  assert.match(entry.schedule, /^\d+ \d+ \* \* \*$/);
});

test("l'administration expose la recharge sans fuite vers le public", () => {
  const page = read("src/app/admin/(panel)/digital/page.tsx");
  assert.match(page, /getFazercardsAutotopupStatus\(\)/);
  assert.match(page, /<FazercardsTopupPanel initial=\{autotopup\} \/>/);

  const api = read("src/app/api/admin/digital/fazercards-topup/route.ts");
  assert.match(api, /isAdminAuthenticated\(\)/);
  // Aucune donnée de solde renvoyée par cette route : elle est déjà en admin.
  assert.doesNotMatch(api, /balanceUsd/);
});
