/**
 * Kit de livraison d'un projet web — module PUR (aucune import, aucune I/O).
 *
 * Il porte les règles partagées entre l'admin (création du dossier), la page
 * publique `/livraison/<ref>` (consultation) et les e-mails : mêmes limites,
 * mêmes libellés, même calcul de garantie. Testable sans base de données —
 * voir `scripts/delivery-handover.test.mjs`.
 *
 * Démarche complète : docs/livraison-site-apres-paiement-2026-11-04.md
 */

export const DELIVERY_STATUSES = ["delivered", "accepted"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, { fr: string; ar: string; en: string }> = {
  delivered: {
    fr: "Remis — en attente de validation",
    ar: "تم التسليم — بانتظار الاعتماد",
    en: "Delivered — awaiting acceptance",
  },
  accepted: {
    fr: "Recette validée",
    ar: "تم اعتماد الاستلام",
    en: "Accepted",
  },
};

/** Un lien remis au client (site, admin, dépôt, dossier, vidéo de formation…). */
export interface DeliveryLink {
  label: string;
  url: string;
}

/** Un élément livré, repris du devis (grille de recette). */
export interface DeliveryItem {
  label: string;
}

export const DELIVERY_MAX_LINKS = 12;
export const DELIVERY_MAX_ITEMS = 30;
export const DELIVERY_MAX_LABEL = 120;
export const DELIVERY_MAX_URL = 600;
export const DELIVERY_WARRANTY_DAYS = 30;
export const DELIVERY_WARRANTY_MAX_DAYS = 365;

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Ne garde que des liens `http(s)` : une URL `javascript:` ou `data:` cliquée
 * depuis une page de livraison serait un vecteur d'attaque direct.
 */
export function sanitizeDeliveryLinks(raw: unknown): DeliveryLink[] {
  if (!Array.isArray(raw)) return [];
  const out: DeliveryLink[] = [];
  for (const entry of raw.slice(0, DELIVERY_MAX_LINKS)) {
    if (typeof entry === "string") {
      const url = entry.trim().slice(0, DELIVERY_MAX_URL);
      if (!isSafeHttpUrl(url)) continue;
      out.push({ label: "", url });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const record = entry as { label?: unknown; url?: unknown };
    const url = cleanText(record.url, DELIVERY_MAX_URL);
    if (!isSafeHttpUrl(url)) continue;
    out.push({ label: cleanText(record.label, DELIVERY_MAX_LABEL), url });
  }
  return out;
}

/** Vrai uniquement pour une URL absolue en http/https. */
export function isSafeHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Liste des éléments livrés : texte libre, borné en nombre et en longueur. */
export function sanitizeDeliveryChecklist(raw: unknown): DeliveryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, DELIVERY_MAX_ITEMS)
    .map((entry) => {
      if (typeof entry === "string") return cleanText(entry, DELIVERY_MAX_LABEL);
      if (entry && typeof entry === "object") {
        return cleanText((entry as { label?: unknown }).label, DELIVERY_MAX_LABEL);
      }
      return "";
    })
    .filter((label): label is string => label.length > 0)
    .map((label) => ({ label }));
}

/** Garantie en jours : toujours un entier borné, jamais 0 ni négatif. */
export function sanitizeWarrantyDays(raw: unknown): number {
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(value)) return DELIVERY_WARRANTY_DAYS;
  return Math.min(Math.max(Math.trunc(value), 1), DELIVERY_WARRANTY_MAX_DAYS);
}

/**
 * Lien de validation envoyé au client. Le jeton n'existe que dans cette URL :
 * la base ne conserve que son empreinte SHA-256 (cf. `src/lib/order-tracking.ts`).
 */
export function deliveryAcceptUrl(origin: string, ref: string, token: string): string {
  const base = origin.replace(/\/+$/, "");
  const params = new URLSearchParams({ t: token });
  return `${base}/livraison/${encodeURIComponent(ref)}?${params.toString()}`;
}

/** Fin de la garantie : date de remise + N jours (jamais avant la remise). */
export function deliveryWarrantyEndsAt(deliveredAt: Date, warrantyDays: number): Date {
  const days = sanitizeWarrantyDays(warrantyDays);
  return new Date(deliveredAt.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Montant affiché : vide plutôt que « 0 $ » quand aucun montant n'est saisi. */
export function deliveryAmountLabel(amountUsd: string | null | undefined): string {
  const value = (amountUsd ?? "").trim();
  if (!value) return "";
  return /^\d+(\.\d+)?$/.test(value) ? `$${value}` : value;
}
