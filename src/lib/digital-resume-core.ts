// Noyau PUR de la reprise automatique des commandes de codes bloquées.
//
// Pourquoi : une commande peut rester des heures dans `pending` (webhook IPN
// perdu) ou dans `paid` (fournisseur en « processing » dont la réponse s'est
// perdue). Jusqu'ici seul le client, en rouvrant sa page de suivi, relançait
// la livraison — un client qui ferme son onglet laissait donc une commande
// payée sans code.
//
// Ce module décide, sans base ni réseau, si une commande doit être reprise,
// ignorée (trop récente, statut non concerné) ou abandonnée (trop de
// tentatives, trop ancienne → passage en livraison manuelle). Il est testé
// seul (`scripts/digital-resume.test.mjs`) ; l'exécution vit dans
// `digital-resume.ts`.

/** Délai minimal après la dernière activité avant de reprendre une commande. */
export const RESUME_MIN_AGE_MS = 15 * 60 * 1000;

/** Au-delà, la commande est confiée à un humain plutôt que retentée. */
export const RESUME_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Nombre de tentatives fournisseur au-delà duquel on arrête d'insister. */
export const RESUME_MAX_ATTEMPTS = 6;

/** Statuts internes concernés par une reprise automatique. */
export const RESUME_STATUSES = ["pending", "paid"] as const;

export type ResumeDecision =
  | { action: "deliver" }
  | { action: "skip"; reason: string }
  | { action: "give_up"; reason: string };

export interface ResumeInput {
  /** Statut de la commande digitale (`digital_orders.status`). */
  status: string | null | undefined;
  /** Statut de la ligne de paiement (`orders.status`) — doit être `paid`. */
  paymentStatus: string | null | undefined;
  /** Tentatives fournisseur déjà effectuées. */
  attempts: number | null | undefined;
  createdAt: Date | string | number | null | undefined;
  updatedAt: Date | string | number | null | undefined;
  now?: number;
  minAgeMs?: number;
  maxAgeMs?: number;
  maxAttempts?: number;
}

function toMs(value: Date | string | number | null | undefined): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Décide du sort d'une commande lors d'un balayage.
 *
 * L'ordre des contrôles est volontaire : on ne reprend JAMAIS une commande
 * dont le paiement n'est pas confirmé (garde-fou absolu), on n'insiste pas
 * au-delà du plafond de tentatives, puis on respecte un délai de grâce pour
 * laisser l'IPN et le suivi client faire leur travail.
 */
export function decideDigitalResume(input: ResumeInput): ResumeDecision {
  if (input.paymentStatus !== "paid") {
    return { action: "skip", reason: "paiement non confirmé" };
  }

  const status = (input.status ?? "").trim();
  if (!(RESUME_STATUSES as readonly string[]).includes(status)) {
    return { action: "skip", reason: `statut « ${status || "inconnu"} » non repris` };
  }

  const now = input.now ?? Date.now();
  const maxAttempts = input.maxAttempts ?? RESUME_MAX_ATTEMPTS;
  const maxAgeMs = input.maxAgeMs ?? RESUME_MAX_AGE_MS;
  const minAgeMs = input.minAgeMs ?? RESUME_MIN_AGE_MS;

  const attempts = Number(input.attempts ?? 0);
  const createdMs = toMs(input.createdAt);
  const updatedMs = toMs(input.updatedAt);

  if (Number.isFinite(attempts) && attempts >= maxAttempts) {
    return {
      action: "give_up",
      reason: `${attempts} tentative${attempts > 1 ? "s" : ""} fournisseur sans succès — livraison manuelle requise.`,
    };
  }

  if (createdMs > 0 && now - createdMs > maxAgeMs) {
    const days = Math.floor((now - createdMs) / (24 * 60 * 60 * 1000));
    return {
      action: "give_up",
      reason: `Commande vieille de ${days} jours : reprise automatique abandonnée — vérifier chez le fournisseur puis livrer ou rembourser.`,
    };
  }

  // Date de dernière activité illisible : on ne peut pas garantir le délai
  // de grâce, donc on ne touche à rien (l'admin garde la main).
  if (!(updatedMs > 0)) {
    return { action: "skip", reason: "date de dernière activité illisible" };
  }

  // Activité trop récente : l'IPN ou la page de suivi du client est
  // probablement encore en train de traiter la commande.
  const elapsed = now - updatedMs;
  if (elapsed < minAgeMs) {
    const minutes = Math.max(0, Math.round(elapsed / 60_000));
    return { action: "skip", reason: `activité il y a ${minutes} min — délai de grâce` };
  }

  return { action: "deliver" };
}
