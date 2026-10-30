// Recharge automatique du solde FazerCards — orchestration (réseau + base).
//
// Principe, en une phrase : quand l'écart entre le solde fournisseur et le
// float cible dépasse un seuil, on crée une facture de dépôt chez FazerCards
// puis on l'envoie depuis le solde custody NOWPayments, en un seul virement.
//
// ⚠️ Chemin d'argent sortant. Trois verrous, volontairement redondants :
//   1. `FAZERCARDS_AUTOTOPUP_ENABLED` — absent ou ≠ « true » : aucun virement ;
//   2. le cron ne fait qu'un SIMULACRE sauf `?execute=1` ;
//   3. un état `pending` persistant interdit tout second virement tant que le
//      précédent n'est pas soldé (crédité, échoué ou expiré).
//
// Aucun montant de solde n'est exposé hors administration.

import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { settings } from "@/db/schema";
import {
  BALANCE_TOPUP_SAFETY,
  supplierCostForSalePrice,
} from "@/lib/fazercards-balance-core";
import {
  adminRecipient,
  getFazercardsBalanceStatus,
  type FazercardsBalanceStatus,
} from "@/lib/fazercards-balance";
import {
  fazercardsConfigured,
  fazercardsErrorMessage,
  fazercardsMaxOrderUsd,
  fazercardsPaymentCreate,
  fazercardsPaymentGet,
  fazercardsPaymentMethods,
  type FazercardsPayment,
} from "@/lib/fazercards";
import {
  AUTOTOPUP_DEFAULT_MAX_FEE_RATIO,
  AUTOTOPUP_DEFAULT_MAX_USD,
  AUTOTOPUP_DEFAULT_THRESHOLD_USD,
  AUTOTOPUP_MIN_DEPOSIT_USD,
  approveTopUpWithFee,
  emptyAutotopupState,
  isFazercardsPaymentCredited,
  isPayoutFailed,
  isPayoutFinished,
  isPayoutPending,
  pendingIsFresh,
  planTopUp,
  pushHistory,
  type AutotopupConfig,
  type AutotopupHistoryEntry,
  type AutotopupState,
  type PendingTopUp,
  type TopUpPlan,
} from "@/lib/fazercards-autotopup-core";
import {
  createPayout,
  getCustodyBalance,
  getPayoutFee,
  getPayoutStatus,
  nowPaymentsPayoutConfigured,
  nowPaymentsPayoutCurrency,
  nowPaymentsPayoutErrorMessage,
  nowPaymentsPayoutTotpSecret,
  verifyPayout,
} from "@/lib/nowpayments-payout";
import { isValidTotpSecret, generateTotp } from "@/lib/totp";
import { sendEmail } from "@/lib/mailer";
import { escapeHtml } from "@/lib/emails";
import { getSiteData } from "@/lib/store";

/** Clé `settings` de l'état de la recharge automatique. */
export const FAZERCARDS_AUTOTOPUP_KEY = "fazercards:autotopup";

/** Deux exécutions ne doivent pas se chevaucher (cron + admin). */
export const AUTOTOPUP_MIN_INTERVAL_MS = 60 * 1000;

/* ------------------------------ Configuration ------------------------------ */

function envNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function fazercardsAutotopupConfig(): AutotopupConfig {
  return {
    enabled: (process.env.FAZERCARDS_AUTOTOPUP_ENABLED ?? "").trim().toLowerCase() === "true",
    thresholdUsd: envNumber("FAZERCARDS_AUTOTOPUP_THRESHOLD_USD", AUTOTOPUP_DEFAULT_THRESHOLD_USD),
    maxUsd: envNumber("FAZERCARDS_AUTOTOPUP_MAX_USD", AUTOTOPUP_DEFAULT_MAX_USD),
    maxFeeRatio: envNumber("FAZERCARDS_AUTOTOPUP_MAX_FEE_RATIO", AUTOTOPUP_DEFAULT_MAX_FEE_RATIO),
    method: (process.env.FAZERCARDS_AUTOTOPUP_METHOD ?? "").trim().toLowerCase() || "trc20",
  };
}

/**
 * Float cible : ce que le solde doit valoir pour couvrir le plafond de vente,
 * marge de sécurité incluse. C'est le même calcul que l'alerte de solde, donc
 * la « recharge conseillée » de l'administration et la recharge automatique
 * visent exactement le même montant.
 */
export function fazercardsTargetBalanceUsd(maxOrderUsd = fazercardsMaxOrderUsd()): number {
  const costCeiling = supplierCostForSalePrice(maxOrderUsd);
  return Math.ceil((costCeiling * BALANCE_TOPUP_SAFETY) / 10) * 10;
}

/* ------------------------------ État persistant ------------------------------ */

function normalizeState(raw: unknown): AutotopupState {
  const base = emptyAutotopupState();
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<AutotopupState>;

  const pending = value.pending;
  const normalizedPending: PendingTopUp | null =
    pending && typeof pending === "object" && typeof pending.paymentId === "string"
      ? {
          paymentId: pending.paymentId,
          address: String(pending.address ?? ""),
          invoiceUsd: Number(pending.invoiceUsd) || 0,
          sendUsd: Number(pending.sendUsd) || 0,
          currency: String(pending.currency ?? nowPaymentsPayoutCurrency()),
          payoutId: typeof pending.payoutId === "string" ? pending.payoutId : null,
          createdAt: Number(pending.createdAt) || 0,
          expiresAt: typeof pending.expiresAt === "string" ? pending.expiresAt : null,
        }
      : null;

  const history = Array.isArray(value.history)
    ? value.history.filter(
        (entry): entry is AutotopupHistoryEntry =>
          !!entry && typeof entry === "object" && typeof entry.paymentId === "string",
      )
    : [];

  return {
    pending: normalizedPending,
    history,
    lastRunAt: Number.isFinite(Number(value.lastRunAt)) ? Number(value.lastRunAt) : null,
    lastReason: typeof value.lastReason === "string" ? value.lastReason : null,
  };
}

/**
 * Registre inaccessible (base suspendue, quota épuisé, réseau).
 *
 * Distinction volontaire : l'ADMINISTRATION dégrade en silence (elle doit
 * rester lisible pendant une panne), mais un PASSAGE DE RECHARGE refuse de
 * travailler sans registre — un registre muet n'est pas un registre vide, et
 * « je ne sais pas s'il y a un virement en cours » ne doit jamais conduire à
 * un second envoi.
 */
export class AutotopupRegistryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AutotopupRegistryError";
    this.cause = cause;
  }
}

export async function readAutotopupState(
  options: { strict?: boolean } = {},
): Promise<AutotopupState> {
  try {
    await ensureSchema();
    const rows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, FAZERCARDS_AUTOTOPUP_KEY))
      .limit(1);
    return normalizeState(rows[0]?.value);
  } catch (error) {
    if (options.strict) {
      throw new AutotopupRegistryError(
        `registre de recharge illisible (base de données) : ${
          error instanceof Error ? error.message : String(error)
        }`,
        error,
      );
    }
    return emptyAutotopupState();
  }
}

async function writeAutotopupState(state: AutotopupState): Promise<void> {
  await ensureSchema();
  await db
    .insert(settings)
    .values({ key: FAZERCARDS_AUTOTOPUP_KEY, value: state, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: state, updatedAt: new Date() },
    });
}

/* ------------------------------ Statut (admin) ------------------------------ */

export interface FazercardsAutotopupStatus {
  config: AutotopupConfig;
  /** Prérequis techniques, affichés tels quels dans l'administration. */
  prerequisites: {
    fazercards: boolean;
    payoutCredentials: boolean;
    totp: boolean;
    enabled: boolean;
  };
  currency: string;
  targetUsd: number;
  maxOrderUsd: number;
  state: AutotopupState;
  /** Une exécution réelle est-elle possible en l'état ? */
  canExecute: boolean;
}

/**
 * Tout ce que l'administration doit savoir, SANS appel réseau : configuration,
 * prérequis, état du registre. Le solde est déjà affiché par le panneau dédié.
 */
export async function getFazercardsAutotopupStatus(): Promise<FazercardsAutotopupStatus> {
  const config = fazercardsAutotopupConfig();
  const state = await readAutotopupState();
  const prerequisites = {
    fazercards: fazercardsConfigured(),
    payoutCredentials: nowPaymentsPayoutConfigured(),
    totp: isValidTotpSecret(nowPaymentsPayoutTotpSecret()),
    enabled: config.enabled,
  };
  const maxOrderUsd = fazercardsMaxOrderUsd();
  return {
    config,
    prerequisites,
    currency: nowPaymentsPayoutCurrency(),
    targetUsd: fazercardsTargetBalanceUsd(maxOrderUsd),
    maxOrderUsd,
    state,
    canExecute: prerequisites.fazercards && prerequisites.payoutCredentials && prerequisites.enabled,
  };
}

/* ------------------------------ Notifications ------------------------------ */

async function notifyAdmin(input: {
  subject: string;
  lines: string[];
}): Promise<{ ok: boolean; error: string | null; recipient: string | null }> {
  const { config } = await getSiteData();
  const recipient = adminRecipient(config.email);
  if (!recipient) {
    return { ok: false, error: "aucun destinataire interne configuré", recipient: null };
  }
  const text = [
    ...input.lines,
    "",
    `Administration : ${config.url.replace(/\/+$/, "")}/admin/digital`,
    "",
    `— ${config.name}`,
  ].join("\n");
  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1e">
      <div style="font-size:13px;letter-spacing:.12em;color:#C6A664;font-weight:700">${escapeHtml(
        config.name.toUpperCase(),
      )} — RECHARGE FOURNISSEUR</div>
      <h1 style="font-size:20px;font-weight:900;margin:8px 0 12px">${escapeHtml(input.subject)}</h1>
      <ul style="font-size:13px;line-height:1.7;padding-left:18px">
        ${input.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ul>
      <p style="font-size:12px;color:#999;margin-top:20px">${escapeHtml(
        config.url,
      )}/admin/digital</p>
    </div>`;
  const result = await sendEmail({ to: recipient, subject: input.subject, text, html });
  return { ok: result.ok, error: result.ok ? null : (result.error ?? "échec d'envoi"), recipient };
}

/* ------------------------------ Exécution ------------------------------ */

export interface AutotopupRunReport {
  ok: boolean;
  /** true = virement réellement créé (jamais en simulation). */
  executed: boolean;
  action: "topup" | "wait" | "settled" | "error";
  reason: string;
  invoiceUsd: number;
  sendUsd: number;
  feeUsd: number | null;
  balanceUsd: number | null;
  targetUsd: number;
  custodyUsd: number | null;
  paymentId: string | null;
  payoutId: string | null;
  /** Virement validé par TOTP dans la même exécution. */
  verified: boolean;
  emailed: boolean;
  emailError: string | null;
  error: string | null;
}

function reportBase(input: Partial<AutotopupRunReport>): AutotopupRunReport {
  return {
    ok: true,
    executed: false,
    action: "wait",
    reason: "",
    invoiceUsd: 0,
    sendUsd: 0,
    feeUsd: null,
    balanceUsd: null,
    targetUsd: 0,
    custodyUsd: null,
    paymentId: null,
    payoutId: null,
    verified: false,
    emailed: false,
    emailError: null,
    error: null,
    ...input,
  };
}

function paymentCredited(payment: FazercardsPayment): boolean {
  return isFazercardsPaymentCredited({ status: payment.status, completedAt: payment.completedAt });
}

interface SettledPending {
  state: AutotopupState;
  /** `null` = rien à solder ; `blocked` = virement encore en cours. */
  stage: "none" | "blocked" | "ready" | "settled";
  pending: PendingTopUp | null;
  history: AutotopupHistoryEntry | null;
  reason: string;
}

async function settlePending(state: AutotopupState, now: number): Promise<SettledPending> {
  const pending = state.pending;
  if (!pending) return { state, stage: "none", pending: null, history: null, reason: "aucun virement en attente" };

  if (!pendingIsFresh(pending, now)) {
    const history: AutotopupHistoryEntry = {
      at: now,
      invoiceUsd: pending.invoiceUsd,
      sendUsd: pending.sendUsd,
      paymentId: pending.paymentId,
      payoutId: pending.payoutId,
      status: "expiré",
      detail: "facture de dépôt expirée sans crédit confirmé",
    };
    const next = { ...state, pending: null, history: pushHistory(state.history, history) };
    return { state: next, stage: "settled", pending: null, history, reason: history.detail ?? "" };
  }

  // 1. Le virement existe-t-il déjà ? Son statut décide de tout.
  if (pending.payoutId) {
    let payoutStatus: string;
    try {
      payoutStatus = (await getPayoutStatus(pending.payoutId)).status;
    } catch (error) {
      return {
        state,
        stage: "blocked",
        pending,
        history: null,
        reason: `statut du virement illisible : ${nowPaymentsPayoutErrorMessage(error)}`,
      };
    }

    if (isPayoutFailed(payoutStatus)) {
      const history: AutotopupHistoryEntry = {
        at: now,
        invoiceUsd: pending.invoiceUsd,
        sendUsd: pending.sendUsd,
        paymentId: pending.paymentId,
        payoutId: pending.payoutId,
        status: "échec",
        detail: `virement ${payoutStatus}`,
      };
      const next = { ...state, pending: null, history: pushHistory(state.history, history) };
      return { state: next, stage: "settled", pending: null, history, reason: history.detail ?? "" };
    }

    if (isPayoutFinished(payoutStatus)) {
      // Le virement est parti : on attend la confirmation du fournisseur.
      try {
        const payment = (await fazercardsPaymentGet(pending.paymentId)).payment;
        if (paymentCredited(payment)) {
          const history: AutotopupHistoryEntry = {
            at: now,
            invoiceUsd: pending.invoiceUsd,
            sendUsd: pending.sendUsd,
            paymentId: pending.paymentId,
            payoutId: pending.payoutId,
            status: "crédité",
            detail: `crédité (statut ${payment.status})`,
          };
          const next = { ...state, pending: null, history: pushHistory(state.history, history) };
          return { state: next, stage: "settled", pending: null, history, reason: history.detail ?? "" };
        }
        return {
          state,
          stage: "blocked",
          pending,
          history: null,
          reason: `virement terminé mais facture ${pending.paymentId} encore « ${payment.status} »`,
        };
      } catch (error) {
        return {
          state,
          stage: "blocked",
          pending,
          history: null,
          reason: `facture illisible : ${fazercardsErrorMessage(error)}`,
        };
      }
    }

    if (isPayoutPending(payoutStatus)) {
      return {
        state,
        stage: "blocked",
        pending,
        history: null,
        reason: `virement ${pending.payoutId} en cours (${payoutStatus})`,
      };
    }

    return {
      state,
      stage: "blocked",
      pending,
      history: null,
      reason: `statut de virement inattendu : ${payoutStatus}`,
    };
  }

  // 2. Facture créée mais virement non créé (échec au milieu) : on réessaie.
  return {
    state,
    stage: "ready",
    pending,
    history: null,
    reason: `facture ${pending.paymentId} prête, virement à (re)créer`,
  };
}

async function resolveDepositMethod(config: AutotopupConfig): Promise<{
  code: string;
  minAmountUsd: number;
  maxAmountUsd: number;
} | null> {
  const methods = await fazercardsPaymentMethods();
  const wanted = methods.items.find((item) => item.code.toLowerCase() === config.method);
  const chosen = wanted ?? methods.items[0];
  if (!chosen) return null;
  return {
    code: chosen.code,
    minAmountUsd: Number(chosen.minAmountUsd) || AUTOTOPUP_MIN_DEPOSIT_USD,
    maxAmountUsd: Number(chosen.maxAmountUsd) || 0,
  };
}

/**
 * Un passage de la recharge automatique.
 *
 * @param options.execute false (défaut) = simulation complète, zéro argent
 *                        déplacé, zéro facture créée. true = exécution réelle,
 *                        et seulement si `FAZERCARDS_AUTOTOPUP_ENABLED=true`.
 */
export async function runFazercardsAutotopup(
  options: { execute?: boolean; now?: number } = {},
): Promise<AutotopupRunReport> {
  const now = options.now ?? Date.now();
  const execute = options.execute === true;
  const config = fazercardsAutotopupConfig();
  const maxOrderUsd = fazercardsMaxOrderUsd();
  const targetUsd = fazercardsTargetBalanceUsd(maxOrderUsd);

  // Lecture STRICTE : sans registre, on ne sait pas si un virement est en
  // cours. On s'arrête là — jamais de seconde facture par ignorance.
  let state: AutotopupState;
  try {
    state = await readAutotopupState({ strict: true });
  } catch (error) {
    const reason =
      "registre de recharge indisponible (base de données suspendue ou injoignable) : aucun virement, aucun envoi";
    return reportBase({
      ok: false,
      action: "error",
      targetUsd,
      reason,
      error: error instanceof Error ? error.message : reason,
    });
  }

  // Anti-chevauchement : deux passages simultanés pourraient créer deux factures.
  if (state.lastRunAt && now - state.lastRunAt < AUTOTOPUP_MIN_INTERVAL_MS) {
    return reportBase({
      action: "wait",
      reason: "exécution récente (moins d'une minute) : report",
      targetUsd,
    });
  }

  const balanceStatus: FazercardsBalanceStatus = await getFazercardsBalanceStatus({ fresh: true });
  const balanceUsd = balanceStatus.assessment.balanceUsd;
  const emergency =
    balanceStatus.assessment.level === "low" || balanceStatus.assessment.level === "critical";

  const base = {
    balanceUsd,
    targetUsd,
    reason: "",
  };

  // 1. Solder l'état précédent avant toute nouvelle décision.
  const settled = await settlePending(state, now);
  state = settled.state;
  if (settled.stage === "settled" && settled.history) {
    await writeAutotopupState(state);
    const notified = await notifyAdmin({
      subject:
        settled.history.status === "crédité"
          ? `✅ Recharge fournisseur créditée — ${settled.history.invoiceUsd.toFixed(2)} $`
          : `⚠️ Recharge fournisseur ${settled.history.status} — ${settled.history.invoiceUsd.toFixed(2)} $`,
      lines: [
        `Facture FazerCards : ${settled.history.paymentId}`,
        `Virement NOWPayments : ${settled.history.payoutId ?? "non créé"}`,
        `Montant : ${settled.history.sendUsd.toFixed(2)} $ envoyés, ${settled.history.invoiceUsd.toFixed(2)} $ à créditer`,
        settled.history.detail ?? "",
      ],
    });
    return reportBase({
      ...base,
      action: "settled",
      reason: settled.reason,
      invoiceUsd: settled.history.invoiceUsd,
      sendUsd: settled.history.sendUsd,
      paymentId: settled.history.paymentId,
      payoutId: settled.history.payoutId,
      emailed: notified.ok,
      emailError: notified.error,
    });
  }
  if (settled.stage === "blocked") {
    return reportBase({
      ...base,
      action: "wait",
      reason: settled.reason,
      invoiceUsd: settled.pending?.invoiceUsd ?? 0,
      sendUsd: settled.pending?.sendUsd ?? 0,
      paymentId: settled.pending?.paymentId ?? null,
      payoutId: settled.pending?.payoutId ?? null,
    });
  }

  // 2. Prérequis (aucun appel réseau inutile avant ceux-ci).
  if (!fazercardsConfigured()) {
    return reportBase({ ...base, ok: false, action: "error", error: "FAZERCARDS_API_KEY manquant" });
  }
  if (!nowPaymentsPayoutConfigured()) {
    return reportBase({
      ...base,
      ok: false,
      action: "error",
      error: "NOWPAYMENTS_API_KEY + NOWPAYMENTS_EMAIL/PASSWORD requis pour un virement",
    });
  }

  const method = await resolveDepositMethod(config);
  if (!method) {
    return reportBase({
      ...base,
      ok: false,
      action: "error",
      error: "aucune méthode de dépôt crypto activée chez FazerCards",
    });
  }

  // 3. Décider (logique pure), puis vérifier le financement et les frais.
  const plan: TopUpPlan = settled.pending
    ? {
        action: "topup",
        invoiceUsd: settled.pending.invoiceUsd,
        sendUsd: settled.pending.sendUsd,
        feeUsd: null,
        reason: `reprise de la facture ${settled.pending.paymentId}`,
      }
    : planTopUp({
        config,
        balanceUsd,
        targetUsd,
        minDepositUsd: method.minAmountUsd,
        pending: false,
        emergency,
      });

  if (plan.action !== "topup") {
    await writeAutotopupState({ ...state, lastRunAt: now, lastReason: plan.reason });
    return reportBase({ ...base, action: "wait", reason: plan.reason });
  }

  let custodyUsd: number | null = null;
  let feeUsd: number | null = null;
  try {
    custodyUsd = await getCustodyBalance();
    const quote = await getPayoutFee(plan.invoiceUsd);
    feeUsd = quote.feeUsd;
  } catch (error) {
    const reason = `préparation du virement impossible : ${nowPaymentsPayoutErrorMessage(error)}`;
    await writeAutotopupState({ ...state, lastRunAt: now, lastReason: reason });
    return reportBase({ ...base, action: "wait", reason, error: reason });
  }

  const approved = settled.pending
    ? { ...plan, sendUsd: plan.sendUsd, feeUsd }
    : approveTopUpWithFee({ plan, config, feeUsd, custodyAvailableUsd: custodyUsd, emergency });

  const withData = {
    ...base,
    custodyUsd,
    invoiceUsd: approved.invoiceUsd,
    sendUsd: approved.sendUsd,
    feeUsd: approved.feeUsd,
    paymentId: settled.pending?.paymentId ?? null,
  };

  if (approved.action !== "topup") {
    await writeAutotopupState({ ...state, lastRunAt: now, lastReason: approved.reason });
    return reportBase({ ...withData, action: "wait", reason: approved.reason });
  }

  if (!execute) {
    await writeAutotopupState({ ...state, lastRunAt: now, lastReason: `simulation : ${approved.reason}` });
    return reportBase({
      ...withData,
      action: "topup",
      reason: `simulation (aucun envoi) : ${approved.reason}`,
    });
  }

  if (!config.enabled) {
    const reason = "exécution refusée : FAZERCARDS_AUTOTOPUP_ENABLED n'est pas à true";
    await writeAutotopupState({ ...state, lastRunAt: now, lastReason: reason });
    return reportBase({ ...withData, action: "wait", reason });
  }

  // 4. Vérifier que le registre est ÉCRIVABLE avant de créer une facture :
  //    une facture sans registre serait un engagement sans trace.
  try {
    await writeAutotopupState({ ...state, lastRunAt: now, lastReason: "registre vérifié avant envoi" });
  } catch (error) {
    const reason = `registre de recharge non inscriptible : ${
      error instanceof Error ? error.message : String(error)
    } — aucun virement`;
    return reportBase({ ...withData, ok: false, action: "error", reason, error: reason });
  }

  // 5. Créer la facture de dépôt (ou reprendre celle en attente).
  let pending: PendingTopUp;
  if (settled.pending) {
    pending = settled.pending;
  } else {
    try {
      const created = await fazercardsPaymentCreate({
        method: method.code,
        amount: approved.invoiceUsd,
      });
      pending = {
        paymentId: created.payment.id,
        address: created.payment.address,
        invoiceUsd: approved.invoiceUsd,
        sendUsd: approved.sendUsd,
        currency: nowPaymentsPayoutCurrency(),
        payoutId: null,
        createdAt: now,
        expiresAt: created.payment.expiresAt ?? null,
      };
    } catch (error) {
      const reason = `création de la facture de dépôt impossible : ${fazercardsErrorMessage(error)}`;
      await writeAutotopupState({ ...state, lastRunAt: now, lastReason: reason });
      return reportBase({ ...withData, ok: false, action: "error", reason, error: reason });
    }
  }

  // L'état est écrit AVANT l'envoi : un crash entre les deux ne doit pas
  // pouvoir créer une seconde facture puis un second virement. Si cette
  // écriture échoue, on n'envoie RIEN (la facture expirera d'elle-même).
  try {
    await writeAutotopupState({ ...state, pending, lastRunAt: now, lastReason: approved.reason });
  } catch (error) {
    const reason = `registre de recharge non inscriptible : ${
      error instanceof Error ? error.message : String(error)
    } — aucun virement effectué (facture ${pending.paymentId} laissée expirer)`;
    return reportBase({
      ...withData,
      ok: false,
      action: "error",
      reason,
      error: reason,
      paymentId: pending.paymentId,
    });
  }

  // 6. Envoyer l'argent.
  let payoutId: string | null = null;
  let verified = false;
  try {
    const payout = await createPayout({
      address: pending.address,
      amount: pending.sendUsd,
      currency: pending.currency,
      uniqueId: `fzr-${pending.paymentId}`,
    });
    payoutId = payout.id;

    const totpSecret = nowPaymentsPayoutTotpSecret();
    if (isValidTotpSecret(totpSecret)) {
      await verifyPayout(payout.id, generateTotp(totpSecret));
      verified = true;
    }
  } catch (error) {
    const reason = `virement impossible : ${nowPaymentsPayoutErrorMessage(error)}`;
    await writeAutotopupState({
      ...state,
      pending: { ...pending, payoutId },
      lastRunAt: now,
      lastReason: reason,
    });
    const notified = await notifyAdmin({
      subject: "⚠️ Recharge fournisseur : virement en échec",
      lines: [
        `Facture FazerCards : ${pending.paymentId} (${pending.invoiceUsd.toFixed(2)} $)`,
        `Adresse de dépôt : ${pending.address}`,
        `Erreur : ${reason}`,
      ],
    });
    return reportBase({
      ...withData,
      ok: false,
      action: "error",
      reason,
      error: reason,
      paymentId: pending.paymentId,
      payoutId,
      emailed: notified.ok,
      emailError: notified.error,
    });
  }

  const nextState: AutotopupState = {
    ...state,
    pending: { ...pending, payoutId },
    lastRunAt: now,
    lastReason: `virement ${payoutId ?? "?"} créé pour ${pending.invoiceUsd.toFixed(2)} $`,
  };
  await writeAutotopupState(nextState);

  const notified = await notifyAdmin({
    subject: verified
      ? `💸 Recharge fournisseur envoyée — ${pending.invoiceUsd.toFixed(2)} $ crédités`
      : `🔐 Recharge fournisseur : virement ${payoutId} à valider (2FA)`,
    lines: [
      `Montant à créditer chez FazerCards : ${pending.invoiceUsd.toFixed(2)} $ (envoi de ${pending.sendUsd.toFixed(2)} $, frais réseau inclus)`,
      `Facture FazerCards : ${pending.paymentId}`,
      `Adresse de dépôt : ${pending.address}`,
      `Virement NOWPayments : ${payoutId ?? "?"} (${pending.currency})`,
      verified
        ? "Virement validé automatiquement par TOTP."
        : "Code 2FA requis sous 1 h : validez-le dans le tableau NOWPayments ou renseignez NOWPAYMENTS_PAYOUT_TOTP_SECRET pour automatiser cette étape.",
    ],
  });

  return reportBase({
    ...withData,
    executed: true,
    action: "topup",
    reason: approved.reason,
    paymentId: pending.paymentId,
    payoutId,
    verified,
    emailed: notified.ok,
    emailError: notified.error,
  });
}

/**
 * Valide manuellement le virement en attente (aucune 2FA automatisable).
 * Utilisé par l'administration quand le code arrive par e-mail.
 */
export async function verifyFazercardsAutotopupPayout(
  code: string,
): Promise<{ ok: boolean; status: string | null; error: string | null }> {
  const state = await readAutotopupState();
  const payoutId = state.pending?.payoutId;
  if (!payoutId) return { ok: false, status: null, error: "aucun virement en attente" };

  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6,8}$/.test(cleaned)) {
    return { ok: false, status: null, error: "code 2FA invalide (6 à 8 chiffres)" };
  }

  try {
    const result = await verifyPayout(payoutId, cleaned);
    await writeAutotopupState({
      ...state,
      lastRunAt: Date.now(),
      lastReason: `virement ${payoutId} validé manuellement (${result.status})`,
    });
    return { ok: true, status: result.status, error: null };
  } catch (error) {
    return { ok: false, status: null, error: nowPaymentsPayoutErrorMessage(error) };
  }
}
