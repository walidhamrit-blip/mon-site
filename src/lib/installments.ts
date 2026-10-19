// Répartition d'un montant en tranches égales (paiement crypto).
// Utilisé côté client (aperçu du checkout) et côté serveur
// (création des commandes NOWPayments) : une seule source de vérité
// pour que le montant affiché soit exactement celui facturé.

/** Nombre de tranches proposées dans l'interface. */
export const INSTALLMENT_COUNTS = [1, 2, 3] as const;
export type InstallmentCount = (typeof INSTALLMENT_COUNTS)[number];

export function isInstallmentCount(value: unknown): value is InstallmentCount {
  return (
    typeof value === "number" &&
    (INSTALLMENT_COUNTS as readonly number[]).includes(value)
  );
}

/**
 * Découpe `total` en `count` tranches, au centime près.
 * Les tranches sont identiques ; la dernière absorbe le reste
 * (ex. 880 en 3 → 293.33 / 293.33 / 293.34). La somme est
 * toujours rigoureusement égale au total.
 */
export function splitAmount(total: number, count: number): number[] {
  const n = Math.min(12, Math.max(1, Math.floor(count) || 1));
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const totalCents = Math.round(safeTotal * 100);
  const base = Math.floor(totalCents / n);
  const amounts = Array.from({ length: n }, () => base);
  amounts[n - 1] = totalCents - base * (n - 1);
  return amounts.map((cents) => cents / 100);
}

/** Référence d'une tranche : base pour la 1re, `${base}-T2`, `${base}-T3`… */
export function trancheRef(baseRef: string, index: number): string {
  return index <= 1 ? baseRef : `${baseRef}-T${index}`;
}

/** Référence de base d'un groupe de tranches (retire le suffixe -T2…). */
export function baseRefOf(ref: string): string {
  return ref.replace(/-T\d+$/i, "");
}

/** Indice de tranche déduit de la référence (1 si absente). */
export function trancheIndexFromRef(ref: string): number {
  const match = /-T(\d+)$/i.exec(ref);
  if (!match) return 1;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 1 ? value : 1;
}

/**
 * Références candidates pour un `order_id` venant de NOWPayments (IPN).
 * La facture d'une tranche relancée porte un suffixe « -R… »
 * (ex. NKH-XXXX-T2-R9K) — retirer le dernier segment redonne la
 * référence de la commande concernée. La chaîne exacte est toujours
 * testée en premier.
 */
export function orderRefCandidates(orderId: string): string[] {
  const normalized = orderId.trim().toUpperCase();
  const candidates = [normalized];
  const parts = normalized.split("-");
  if (parts.length >= 3) {
    candidates.push(parts.slice(0, -1).join("-"));
  }
  return Array.from(new Set(candidates));
}

/** Formate un montant USD : 300 → « 300 », 293.3 → « 293.30 ». */
export function formatUsd(amount: number): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** Libellé court d'une tranche, ex. « Tranche 2/3 ». */
export function trancheLabel(index: number, count: number): string {
  return `Tranche ${index}/${count}`;
}
