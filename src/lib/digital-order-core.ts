// Noyau PUR de la boutique digitale : statuts, devis serveur, formats.
//
// Ce module ne touche NI à la base, NI au réseau, NI aux secrets : il peut
// être importé par un composant client (libellés de statut) et testé sans
// infrastructure. La livraison (Reloadly, DB, e-mails) vit dans
// `digital-orders.ts`, le chiffrement dans `digital-codes.ts`.

import {
  effectiveFulfillment,
  denominationUnitPrice,
  type DigitalProduct,
} from "@/lib/digital-types";
import type { GiftCardCode } from "@/lib/reloadly";

/* --------------------------------- Statuts --------------------------------- */

export const DIGITAL_ORDER_STATUSES = [
  "pending",
  "paid",
  "manual",
  "delivered",
  "failed",
] as const;

export type DigitalOrderStatus = (typeof DIGITAL_ORDER_STATUSES)[number];

export const DIGITAL_ORDER_STATUS_LABELS: Record<DigitalOrderStatus, string> = {
  pending: "En attente de paiement",
  paid: "Payé — livraison en cours",
  manual: "À livrer manuellement",
  delivered: "Livré",
  failed: "Échec fournisseur",
};

export const DIGITAL_ORDER_STATUS_TONES: Record<DigitalOrderStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  paid: "bg-sky-50 text-sky-800 border-sky-200",
  manual: "bg-orange-50 text-orange-800 border-orange-200",
  delivered: "bg-emerald-50 text-emerald-800 border-emerald-200",
  failed: "bg-red-50 text-red-800 border-red-200",
};

/** Quantité maximale par commande (garde-fou anti-abus). */
export const MAX_DIGITAL_QUANTITY = 10;

/** Retourne le statut normalisé d'une ligne (valeur inconnue → pending). */
export function normalizeDigitalStatus(value: string | null | undefined): DigitalOrderStatus {
  return (DIGITAL_ORDER_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as DigitalOrderStatus)
    : "pending";
}

/* --------------------------------- Devis --------------------------------- */

export interface DigitalQuote {
  denominationId: string;
  label: string;
  faceValue: string;
  region: string;
  quantity: number;
  unitPriceUsd: number;
  totalUsd: number;
  /** Valeur faciale à transmettre à Reloadly (null = non déductible). */
  reloadlyUnitPrice: number | null;
}

export type DigitalQuoteResult =
  | { ok: true; quote: DigitalQuote }
  | { ok: false; error: string; message: string };

/**
 * Calcule le prix d'une commande À PARTIR DU CATALOGUE SERVEUR : le
 * navigateur ne transmet qu'un identifiant de dénomination et une
 * quantité, jamais un prix.
 */
export function quoteDigitalOrder(
  product: DigitalProduct | null,
  denominationId: string,
  quantityInput: unknown,
): DigitalQuoteResult {
  if (!product) {
    return { ok: false, error: "product_not_found", message: "Produit introuvable." };
  }
  if (product.status !== "available") {
    return {
      ok: false,
      error: "product_not_sellable",
      message: "Ce produit n'est pas encore en vente.",
    };
  }
  const denomination = product.denominations.find(
    (item) => item.id === String(denominationId),
  );
  if (!denomination) {
    return {
      ok: false,
      error: "denomination_not_found",
      message: "Montant introuvable pour ce produit.",
    };
  }
  if (!denomination.available) {
    return {
      ok: false,
      error: "denomination_not_sellable",
      message: "Ce montant n'est plus disponible.",
    };
  }

  // Quantité entière stricte : 2,5 n'est pas « arrondi » en 2, il est refusé.
  const quantity = Number(quantityInput ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_DIGITAL_QUANTITY) {
    return {
      ok: false,
      error: "invalid_quantity",
      message: `Quantité invalide (1 à ${MAX_DIGITAL_QUANTITY}).`,
    };
  }

  const unitPriceUsd = Math.round(denomination.priceUsd * 100) / 100;
  if (!Number.isFinite(unitPriceUsd) || unitPriceUsd <= 0) {
    return {
      ok: false,
      error: "invalid_price",
      message: "Prix du produit non configuré.",
    };
  }

  return {
    ok: true,
    quote: {
      denominationId: denomination.id,
      label: denomination.label,
      faceValue: denomination.faceValue,
      region: denomination.region,
      quantity,
      unitPriceUsd,
      totalUsd: Math.round(unitPriceUsd * quantity * 100) / 100,
      reloadlyUnitPrice: denominationUnitPrice(denomination),
    },
  };
}

/** Masque une adresse e-mail (affichage public). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "—";
  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`;
}

/**
 * Saisie MANUELLE des codes (achat fait dans le tableau Reloadly).
 *
 * Format accepté, une carte par ligne :
 *   `NUMÉRO | PIN | URL d'activation` (le PIN et l'URL sont facultatifs).
 * Les séparateurs `|`, tabulation ou point-virgule sont acceptés.
 */
export function parseManualCodes(input: string): GiftCardCode[] {
  const codes: GiftCardCode[] = [];
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\s*[|;\t]\s*/).map((part) => part.trim());
    const cardNumber = parts[0] ?? "";
    if (!cardNumber) continue;
    const pin = parts.find((part, index) => index > 0 && part && !/^https?:\/\//i.test(part));
    const url = parts.find((part, index) => index > 0 && /^https?:\/\//i.test(part));
    codes.push({
      cardNumber,
      pinCode: pin ?? null,
      redemptionUrl: url ?? null,
    });
  }
  return codes;
}

