#!/usr/bin/env node
/**
 * Cœur du paiement — logique PURE, sans base ni réseau.
 *
 * Ces fonctions décident si une commande passe à « payé » et si un code
 * cadeau est livré. Elles n'étaient couvertes par AUCUN test : une régression
 * sur la tolérance de montant ou sur l'ordre des statuts se traduisait
 * directement en argent encaissé ou en carte non livrée.
 *
 * Exécution : npm run test:core
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";


const {
  verifyIpnSignature, validatePaidAmount, nextOrderStatus, orderStatusFromIpn, isPaidStatus, sanitizeSecret,
} = await import("../src/lib/nowpayments.ts");

const IPN_SECRET = "ipn-secret-de-test-0123456789abcdef";
process.env.NOWPAYMENTS_IPN_SECRET = IPN_SECRET;

const hmac = (body, secret = IPN_SECRET) =>
  createHmac("sha512", secret).update(body, "utf8").digest("hex");
const sortKeysDeep = (v) =>
  Array.isArray(v) ? v.map(sortKeysDeep)
    : v && typeof v === "object"
      ? Object.keys(v).sort().reduce((a, k) => ((a[k] = sortKeysDeep(v[k])), a), {})
      : v;

const canonical = (obj) => JSON.stringify(sortKeysDeep(obj));

/* ---------------- sanitizeSecret ---------------- */
test("les secrets collés depuis un tableau de bord sont nettoyés", () => {
  assert.equal(sanitizeSecret('  "abc123"  '), "abc123");
  assert.equal(sanitizeSecret("'abc123'"), "abc123");
  assert.equal(sanitizeSecret("abc123\n"), "abc123");
  assert.equal(sanitizeSecret(""), "");
  assert.equal(sanitizeSecret(undefined), "");
});

/* ---------------- verifyIpnSignature ---------------- */
test("IPN : signature conforme à la forme canonique acceptée", () => {
  const payload = { payment_status: "finished", price_amount: 50, order_id: "NKH-1" };
  assert.equal(verifyIpnSignature(canonical(payload), hmac(canonical(payload))), true);
});

test("IPN : signature du corps brut acceptée (ordre des clés d'origine)", () => {
  const raw = '{"b":2,"a":1}';
  assert.equal(verifyIpnSignature(raw, hmac(raw)), true);
});

test("IPN : corps modifié ou signature d'un autre corps refusé", () => {
  const payload = { payment_status: "finished", price_amount: 50 };
  const body = canonical(payload);
  assert.equal(verifyIpnSignature(body, hmac(body.replace("50", "5000"))), false);
  assert.equal(verifyIpnSignature(body, hmac(body, "un-autre-secret")), false);
  assert.equal(verifyIpnSignature(body, "0".repeat(128)), false);
});

test("IPN : casse et espaces de la signature tolérés, signature absente refusée", () => {
  const body = canonical({ a: 1 });
  assert.equal(verifyIpnSignature(body, `  ${hmac(body).toUpperCase()}\n`), true);
  assert.equal(verifyIpnSignature(body, null), false);
  assert.equal(verifyIpnSignature(body, ""), false);
});

test("IPN : corps non-JSON signé brut accepté", () => {
  assert.equal(verifyIpnSignature("pas-du-json", hmac("pas-du-json")), true);
});

test("IPN : corps vide refusé même avec une signature valide", () => {
  // Avant la garde ajoutée dans verifyIpnSignature, ce cas renvoyait TRUE :
  // le HMAC d'une chaîne vide est une signature parfaitement valide. Sans
  // conséquence tant que la route rejette le JSON vide avant de lire la
  // signature — mais l'ordre des contrôles ne doit pas être la seule défense.
  assert.equal(verifyIpnSignature("", hmac("")), false);
  assert.equal(verifyIpnSignature("   ", hmac("   ")), false);
});

test("IPN : sans secret configuré, aucune notification n'est validée", () => {
  const saved = process.env.NOWPAYMENTS_IPN_SECRET;
  const savedKey = process.env.NOWPAYMENTS_API_KEY;
  delete process.env.NOWPAYMENTS_IPN_SECRET;
  delete process.env.NOWPAYMENTS_API_KEY;
  const body = canonical({ a: 1 });
  assert.equal(verifyIpnSignature(body, hmac(body)), false);
  process.env.NOWPAYMENTS_IPN_SECRET = saved;
  if (savedKey !== undefined) process.env.NOWPAYMENTS_API_KEY = savedKey;
});

/* ---------------- validatePaidAmount ---------------- */
const expected = { amountUsd: "50", currency: "usd" };
const paid = (patch = {}) => ({ price_amount: 50, price_currency: "usd", ...patch });

test("montant : facture exacte acceptée (nombre ou chaîne)", () => {
  assert.deepEqual(validatePaidAmount(expected, paid()), { ok: true, reason: null });
  assert.equal(validatePaidAmount(expected, paid({ price_amount: "50.00" })).ok, true);
  assert.equal(validatePaidAmount(expected, paid({ price_currency: "USD" })).ok, true);
});

test("montant : tolérance d'arrondi de 0,1 % (plancher 0,01 $)", () => {
  assert.equal(validatePaidAmount(expected, paid({ price_amount: 50.04 })).ok, true);
  assert.equal(validatePaidAmount(expected, paid({ price_amount: 49.96 })).ok, true);
  assert.deepEqual(
    validatePaidAmount(expected, paid({ price_amount: 50.1 })),
    { ok: false, reason: "price_amount_mismatch" },
  );
});

test("montant : champs manquants ou devise différente refusés", () => {
  assert.equal(validatePaidAmount(expected, { price_currency: "usd" }).reason, "missing_price_amount");
  assert.equal(validatePaidAmount(expected, { price_amount: 50 }).reason, "missing_price_currency");
  assert.equal(validatePaidAmount(expected, paid({ price_currency: "eur" })).reason, "price_currency_mismatch");
  assert.equal(validatePaidAmount(expected, paid({ price_amount: "abc" })).reason, "missing_price_amount");
});

test("montant : facture incohérente refusée avant tout contrôle", () => {
  for (const amountUsd of ["0", "-5", "abc", ""]) {
    assert.equal(
      validatePaidAmount({ amountUsd, currency: "usd" }, paid()).reason,
      "expected_amount_invalid",
      `amountUsd=${amountUsd}`,
    );
  }
});

test("montant : sous-paiement crypto (< 99 % du montant demandé) refusé", () => {
  assert.equal(
    validatePaidAmount(expected, paid({ pay_amount: 50, actually_paid: 49.4 })).reason,
    "actually_paid_insufficient",
  );
  assert.equal(validatePaidAmount(expected, paid({ pay_amount: 50, actually_paid: 49.6 })).ok, true);
  assert.equal(validatePaidAmount(expected, paid({ pay_amount: 50 })).ok, true);
});

/* ---------------- statuts ---------------- */
test("statuts : seuls finished/completed valident un paiement", () => {
  for (const s of ["finished", "completed", "FINISHED", " completed "]) assert.equal(isPaidStatus(s), true, s);
  for (const s of ["confirmed", "sending", "confirming", "waiting", "partially_paid", ""]) assert.equal(isPaidStatus(s), false, s);
});

test("statuts : traduction IPN → statut interne", () => {
  assert.equal(orderStatusFromIpn("finished"), "paid");
  assert.equal(orderStatusFromIpn("confirmed"), "pending");
  assert.equal(orderStatusFromIpn("waiting"), "pending");
  assert.equal(orderStatusFromIpn("expired"), "expired");
  assert.equal(orderStatusFromIpn("failed"), "failed");
  assert.equal(orderStatusFromIpn("refunded"), "failed");
  assert.equal(orderStatusFromIpn("n-importe-quoi"), "pending");
});

test("statuts : une commande payée ne régresse jamais", () => {
  assert.equal(nextOrderStatus("paid", "failed"), "paid");
  assert.equal(nextOrderStatus("paid", "expired"), "paid");
  assert.equal(nextOrderStatus("paid", "waiting"), "paid");
  assert.equal(nextOrderStatus("paid", "refunded"), "failed");
});

test("statuts : transitions normales et notifications désordonnées", () => {
  assert.equal(nextOrderStatus("pending", "finished"), "paid");
  assert.equal(nextOrderStatus("pending", "confirming"), "pending");
  assert.equal(nextOrderStatus("pending", "failed"), "failed");
  assert.equal(nextOrderStatus("failed", "finished"), "paid");
  assert.equal(nextOrderStatus("failed", "waiting"), "failed");
  assert.equal(nextOrderStatus("expired", "waiting"), "expired");
  assert.equal(nextOrderStatus("inconnu", "inconnu"), "pending");
});
