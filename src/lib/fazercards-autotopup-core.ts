/**
 * Recharge automatique du solde FazerCards — logique PURE (aucune I/O).
 *
 * Le problème résolu : le solde FazerCards est un **préfinancement**. Chaque
 * vente livrée en débite le coût fournisseur ; sans refinancement, il finit
 * par ne plus couvrir le plafond de vente et une commande encaissée devient
 * impossible à honorer.
 *
 * La réponse retenue n'est PAS « un virement par vente » (le minimum de dépôt
 * FazerCards est de 10 $ et le frais réseau est fixe : un virement de 4 $ coûte
 * ~25 % de sa valeur). C'est une recharge **par lot** : on attend que l'écart
 * avec le float cible dépasse un seuil, puis on envoie un seul virement.
 *
 * Ce module ne fait que décider. Il est testé sans réseau ni base
 * (`scripts/fazercards-autotopup.test.mjs`).
 */

/** Écart minimal avec le float cible avant de déclencher un virement. */
export const AUTOTOPUP_DEFAULT_THRESHOLD_USD = 50;

/** Plafond d'un virement (le float cible reste la vraie limite). */
export const AUTOTOPUP_DEFAULT_MAX_USD = 300;

/**
 * Frais réseau maximal tolérés, en proportion du montant envoyé. Au-delà, on
 * attend : mieux vaut un solde un peu bas qu'un virement qui mange la marge.
 */
export const AUTOTOPUP_DEFAULT_MAX_FEE_RATIO = 0.03;

/** Minimum de dépôt FazerCards (USDT TRC20 : 10 $). Garde-fou de dernier recours. */
export const AUTOTOPUP_MIN_DEPOSIT_USD = 10;

/** Arrondi supérieur du montant (dollars) : moins de virements, montants ronds. */
export const AUTOTOPUP_ROUNDING_USD = 10;

/** Durée de validité d'une facture de dépôt FazerCards en attente (ms). */
export const AUTOTOPUP_PENDING_TTL_MS = 2 * 60 * 60 * 1000;

/** Nombre d'entrées d'historique conservées dans `settings`. */
export const AUTOTOPUP_HISTORY_LIMIT = 20;

export interface AutotopupConfig {
  /** Interrupteur principal. Désactivé par défaut : aucun virement possible. */
  enabled: boolean;
  thresholdUsd: number;
  maxUsd: number;
  maxFeeRatio: number;
  /** Méthode de dépôt FazerCards (`trc20`, `bep20`, `ton`, `aptos`, `binancepay`). */
  method: string;
}

export type TopUpAction = "topup" | "wait";

export interface TopUpPlan {
  action: TopUpAction;
  /** Montant à créditer chez FazerCards (montant de la facture de dépôt). */
  invoiceUsd: number;
  /** Montant à envoyer (facture + frais réseau), 0 tant qu'il est inconnu. */
  sendUsd: number;
  /** Frais réseau retenus pour l'envoi (null = pas encore connus). */
  feeUsd: number | null;
  /** Motif lisible (français — interface d'administration et e-mails). */
  reason: string;
}

function wait(reason: string): TopUpPlan {
  return { action: "wait", invoiceUsd: 0, sendUsd: 0, feeUsd: null, reason };
}

function money(value: number): string {
  return `${value.toFixed(2)} $`;
}

function positive(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Arrondit au palier supérieur (jamais 0 pour un besoin réel). */
export function roundUpToStep(amountUsd: number, step = AUTOTOPUP_ROUNDING_USD): number {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return 0;
  const safeStep = step > 0 ? step : 1;
  return Math.ceil(amountUsd / safeStep) * safeStep;
}

export interface TopUpPlanInput {
  config: AutotopupConfig;
  /** Solde fournisseur lu (null = illisible). */
  balanceUsd: number | null;
  /** Float cible : coût fournisseur du plafond de vente + marge de sécurité. */
  targetUsd: number;
  /** Minimum de dépôt de la méthode choisie, lu chez FazerCards. */
  minDepositUsd: number;
  /** Un virement/facture est déjà en cours : on ne double jamais. */
  pending: boolean;
  /** Le plafond de vente n'est plus couvert : on abaisse les seuils. */
  emergency: boolean;
}

/**
 * Première étape : combien faut-il créditer chez FazerCards ?
 *
 * Le montant est l'écart au float cible, arrondi au palier supérieur et borné
 * par le plafond de virement. Le frais réseau n'est pas encore connu : il est
 * vérifié dans {@link approveTopUpWithFee}.
 */
export function planTopUp(input: TopUpPlanInput): TopUpPlan {
  if (!input.config.enabled) {
    return wait("recharge automatique désactivée (FAZERCARDS_AUTOTOPUP_ENABLED)");
  }
  if (input.pending) {
    return wait("un virement est déjà en attente : aucun second envoi");
  }

  const balanceUsd = positive(input.balanceUsd);
  if (balanceUsd == null) {
    return wait("solde fournisseur illisible : impossible de calculer un écart fiable");
  }

  const targetUsd = positive(input.targetUsd) ?? 0;
  const deficit = targetUsd - balanceUsd;
  if (deficit <= 0) {
    return wait(`solde ${money(balanceUsd)} ≥ float cible ${money(targetUsd)} : rien à faire`);
  }

  const minDepositUsd = Math.max(positive(input.minDepositUsd) ?? AUTOTOPUP_MIN_DEPOSIT_USD, 0);
  const thresholdUsd = Math.max(positive(input.config.thresholdUsd) ?? AUTOTOPUP_DEFAULT_THRESHOLD_USD, 0);

  if (!input.emergency && deficit < thresholdUsd) {
    return wait(
      `écart ${money(deficit)} sous le seuil de recharge ${money(thresholdUsd)} : report au prochain passage`,
    );
  }

  const capped = Math.min(
    roundUpToStep(deficit),
    positive(input.config.maxUsd) ?? AUTOTOPUP_DEFAULT_MAX_USD,
  );
  const invoiceUsd = Math.floor(capped * 100) / 100;

  if (invoiceUsd < minDepositUsd) {
    return wait(
      `écart ${money(deficit)} inférieur au minimum de dépôt fournisseur ${money(minDepositUsd)}`,
    );
  }

  return {
    action: "topup",
    invoiceUsd,
    sendUsd: invoiceUsd,
    feeUsd: null,
    reason: input.emergency
      ? `plafond de vente non couvert : recharge d'urgence de ${money(invoiceUsd)}`
      : `écart de ${money(deficit)} : recharge de ${money(invoiceUsd)}`,
  };
}

export interface ApproveTopUpInput {
  plan: TopUpPlan;
  config: AutotopupConfig;
  /** Frais réseau estimés par NOWPayments pour le montant envoyé (null = inconnu). */
  feeUsd: number | null;
  /** Solde custody disponible chez NOWPayments (null = illisible). */
  custodyAvailableUsd: number | null;
  emergency: boolean;
}

/**
 * Deuxième étape : le virement est-il finançable ET raisonnable ?
 *
 * Le frais réseau n'est pas proportionnel : sur un petit montant il mange la
 * marge. On l'ajoute au montant envoyé pour que FazerCards reçoive exactement
 * le montant de la facture.
 */
export function approveTopUpWithFee(input: ApproveTopUpInput): TopUpPlan {
  const { plan } = input;
  if (plan.action !== "topup") return plan;

  const feeUsd = positive(input.feeUsd);
  if (feeUsd == null) {
    return { ...wait("frais réseau inconnus (devis NOWPayments indisponible) : envoi reporté"), invoiceUsd: plan.invoiceUsd };
  }

  const ratioLimit =
    (positive(input.config.maxFeeRatio) ?? AUTOTOPUP_DEFAULT_MAX_FEE_RATIO) *
    (input.emergency ? 2 : 1);
  const ratio = plan.invoiceUsd > 0 ? feeUsd / plan.invoiceUsd : 1;
  if (ratio > ratioLimit) {
    return {
      ...wait(
        `frais réseau ${money(feeUsd)} = ${(ratio * 100).toFixed(1)} % du montant, au-delà de la limite ${(ratioLimit * 100).toFixed(1)} %`,
      ),
      invoiceUsd: plan.invoiceUsd,
    };
  }

  const sendUsd = Math.round((plan.invoiceUsd + feeUsd) * 100) / 100;
  const custodyAvailableUsd = positive(input.custodyAvailableUsd);
  if (custodyAvailableUsd == null) {
    return { ...wait("solde custody NOWPayments illisible : envoi reporté"), invoiceUsd: plan.invoiceUsd };
  }
  if (custodyAvailableUsd < sendUsd) {
    return {
      ...wait(
        `solde custody ${money(custodyAvailableUsd)} insuffisant pour envoyer ${money(sendUsd)} (marge : ${money(input.config.maxUsd)})`,
      ),
      invoiceUsd: plan.invoiceUsd,
    };
  }

  return {
    action: "topup",
    invoiceUsd: plan.invoiceUsd,
    sendUsd,
    feeUsd,
    reason: `${plan.reason} — envoi de ${money(sendUsd)} (dont ${money(feeUsd)} de frais réseau)`,
  };
}

/* ------------------------------ États ------------------------------ */

export interface PendingTopUp {
  /** Identifiant de la facture de dépôt FazerCards (`tx…`). */
  paymentId: string;
  address: string;
  /** Montant de la facture (ce que FazerCards doit créditer). */
  invoiceUsd: number;
  /** Montant envoyé (facture + frais réseau). */
  sendUsd: number;
  currency: string;
  /** Identifiant du virement NOWPayments (null tant qu'il n'est pas créé). */
  payoutId: string | null;
  createdAt: number;
  /** Expiration de la facture FazerCards (ISO), si le fournisseur la donne. */
  expiresAt: string | null;
}

export interface AutotopupHistoryEntry {
  at: number;
  invoiceUsd: number;
  sendUsd: number;
  paymentId: string;
  payoutId: string | null;
  status: "crédité" | "échec" | "expiré";
  detail: string | null;
}

export interface AutotopupState {
  pending: PendingTopUp | null;
  history: AutotopupHistoryEntry[];
  lastRunAt: number | null;
  lastReason: string | null;
}

export function emptyAutotopupState(): AutotopupState {
  return { pending: null, history: [], lastRunAt: null, lastReason: null };
}

/** Une facture en attente est-elle encore valable ? */
export function pendingIsFresh(
  pending: PendingTopUp | null,
  now: number,
  ttlMs = AUTOTOPUP_PENDING_TTL_MS,
): boolean {
  if (!pending) return false;
  const expiresAt = pending.expiresAt ? Date.parse(pending.expiresAt) : NaN;
  const limit = Number.isFinite(expiresAt) ? Math.min(expiresAt, pending.createdAt + ttlMs) : pending.createdAt + ttlMs;
  return now < limit;
}

/** Statut de virement NOWPayments encore en cours (rien à décider). */
export function isPayoutPending(status: string | null | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "waiting" || value === "creating" || value === "processing" || value === "sending";
}

/** Statut de virement définitivement perdu. */
export function isPayoutFailed(status: string | null | undefined): boolean {
  const value = (status ?? "").toLowerCase();
  return value === "failed" || value === "rejected" || value === "cancelled" || value === "canceled";
}

/** Statut de virement arrivé à destination. */
export function isPayoutFinished(status: string | null | undefined): boolean {
  return (status ?? "").toLowerCase() === "finished";
}

/**
 * La facture FazerCards est-elle créditée ?
 *
 * On ne se fie ni au seul `status` (libellés variables) ni au seul
 * `completedAt` : les deux sont acceptés, et tout autre état reste « en
 * attente » — une recharge non confirmée ne doit jamais solder le registre.
 */
export function isFazercardsPaymentCredited(payment: {
  status?: string | null;
  completedAt?: string | null;
}): boolean {
  if (payment.completedAt) return true;
  return /^(completed?|credited|success|succeeded|paid|finished)$/i.test(
    (payment.status ?? "").trim(),
  );
}

/** Ajoute une entrée d'historique en gardant les plus récentes. */
export function pushHistory(
  history: AutotopupHistoryEntry[],
  entry: AutotopupHistoryEntry,
): AutotopupHistoryEntry[] {
  return [entry, ...history].slice(0, AUTOTOPUP_HISTORY_LIMIT);
}
