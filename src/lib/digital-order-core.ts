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

/* ------------------------ Prix de vente & marge --------------------------- */

/** Frais de paiement déduits par défaut (NOWPayments ≈ 1 %). */
export const DEFAULT_PAYMENT_FEE_PERCENT = 1;

/** Marge nette maximale acceptée (au-delà, le diviseur devient instable). */
export const MAX_MARGIN_PERCENT = 50;

/**
 * Pas d'arrondi des prix de vente calculés : 0,50 → le prix finit toujours
 * par « ,00 » ou « ,50 », ce qui reste lisible sur une facture crypto et
 * limite les sous-paiements.
 */
export const PRICE_ROUND_STEP = 0.5;

/**
 * Pas fin, réservé aux petits montants. Une carte locale vendue 4 USDT
 * arrondie à 4,50 gagne 12,5 % « par accident » — au pas de 0,10 la même
 * carte sort à 4,10. Au-dessus du seuil, le pas de 0,50 reste la règle.
 */
export const PRICE_ROUND_STEP_FINE = 0.1;

/** En dessous de ce prix (en USD/USDT), l'arrondi passe au pas de 0,10. */
export const PRICE_ROUND_SMALL_THRESHOLD = 20;

export interface PriceInputs {
  /** Valeur faciale Reloadly à acheter (ex. 20 pour une carte 20 USD). */
  faceValue: number | null | undefined;
  /** `senderFeePercentage` du produit Reloadly (déjà en %). */
  senderFeePercent?: number | null;
  /** `discountPercentage` du produit Reloadly (déjà en %). */
  discountPercent?: number | null;
  /** Marge NETTE visée, en % du prix payé par le client. */
  marginPercent: number;
  /** Frais du processeur de paiement, en % du prix payé. */
  paymentFeePercent?: number;
}

export interface PriceBreakdown {
  /** `false` quand le calcul est impossible (valeur faciale absente). */
  ok: boolean;
  /** Ce que le code coûte réellement, frais Reloadly inclus. */
  cost: number;
  /** Prix de vente à afficher (arrondi au centime). */
  price: number;
  /** Marge réellement obtenue après frais de paiement (%). */
  netMarginPercent: number;
  /** Ce que rapporte la vente, en USD. */
  netProfitUsd: number;
  error?: string;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Arrondit un prix vers le haut au pas donné (`0.5` par défaut).
 *
 * Exemples : 22,27 → 22,50 · 22,00 → 22,00 · 21,51 → 22,00.
 * La marge affichée étant recalculée après arrondi, elle dépasse très
 * légèrement la cible : c'est le prix de la lisibilité (jamais une perte).
 */
export function roundPriceUp(value: number, step: number = PRICE_ROUND_STEP): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(step) || step <= 0) return roundCents(value);
  // Le −1e-9 absorbe les erreurs de virgule flottante (22,50 doit rester 22,50).
  return roundCents(Math.ceil(value / step - 1e-9) * step);
}

/**
 * Pas d'arrondi adapté au montant : 0,50 au-dessus du seuil, 0,10 en dessous.
 * Toujours utilisé avec `roundPriceUp` : on monte, jamais on ne descend.
 */
export function priceRoundStep(value: number): number {
  return Number.isFinite(value) && value > 0 && value < PRICE_ROUND_SMALL_THRESHOLD
    ? PRICE_ROUND_STEP_FINE
    : PRICE_ROUND_STEP;
}

/** Arrondi au pas adapté au montant (0,10 sous 20, 0,50 au-dessus). */
export function roundPriceUpAdaptive(value: number): number {
  return roundPriceUp(value, priceRoundStep(value));
}

/**
 * Calcule le prix de vente à partir de la valeur faciale, des frais du
 * fournisseur et de la marge NETTE visée.
 *
 *   coût réel  = face × (1 + fraisReloadly) × (1 − remiseReloadly)
 *   prix vente = ⌈coût ÷ (1 − marge/100 − fraisPaiement/100)⌉ au pas de 0,50
 *
 * Le diviseur (et non un simple « + marge % ») est indispensable : la marge
 * est un pourcentage du prix PAYÉ, pas du coût. C'est ce qui distingue
 * « 4 % sur la face » (20,80 $ pour 20) de « 4 % net » (21,05 $).
 */
export function computeSalePrice(input: PriceInputs): PriceBreakdown {
  const face = Number(input.faceValue);
  const margin = Number(input.marginPercent);
  const paymentFee = Number(input.paymentFeePercent ?? DEFAULT_PAYMENT_FEE_PERCENT);
  const senderFee = Number(input.senderFeePercent ?? 0);
  const discount = Number(input.discountPercent ?? 0);

  const empty: PriceBreakdown = {
    ok: false,
    cost: 0,
    price: 0,
    netMarginPercent: 0,
    netProfitUsd: 0,
    error: "Valeur faciale Reloadly absente.",
  };
  if (!Number.isFinite(face) || face <= 0) return empty;

  const cost = roundCents(face * (1 + senderFee / 100) * (1 - discount / 100));
  if (!Number.isFinite(cost) || cost <= 0) {
    return { ...empty, error: "Frais fournisseur incohérents." };
  }

  return computeSalePriceFromCost(cost, margin, safePaymentFeeValue(paymentFee));
}

/**
 * Prix de vente à partir d'un coût DÉJÀ connu en USD.
 *
 * Indispensable aux cartes dont la valeur faciale n'est pas en dollars
 * (500 TRY, 250 EGP…) : leur coût réel vient de Reloadly
 * (`fixedSenderDenominations`, en USD) et n'a rien à voir avec le nombre
 * inscrit sur la carte. Le calcul est identique au reste du catalogue —
 * seule l'origine du coût change.
 */
export function computeSalePriceFromCost(
  costInput: number,
  marginInput: number,
  paymentFeePercent: number = DEFAULT_PAYMENT_FEE_PERCENT,
): PriceBreakdown {
  const cost = roundCents(Number(costInput));
  const margin = Number(marginInput);
  const empty: PriceBreakdown = {
    ok: false,
    cost: Number.isFinite(cost) && cost > 0 ? cost : 0,
    price: 0,
    netMarginPercent: 0,
    netProfitUsd: 0,
    error: "Coût réel inconnu.",
  };
  if (!Number.isFinite(cost) || cost <= 0) return empty;

  if (!Number.isFinite(margin) || margin < 0 || margin >= MAX_MARGIN_PERCENT) {
    return { ...empty, cost, error: `Marge nette attendue entre 0 et ${MAX_MARGIN_PERCENT} %.` };
  }
  const safePaymentFee = safePaymentFeeValue(paymentFeePercent);
  const divisor = 1 - (margin + safePaymentFee) / 100;
  if (divisor <= 0.01) {
    return { ...empty, cost, error: "Marge + frais de paiement trop élevés (≥ 99 %)." };
  }

  // Toujours vers le HAUT : un arrondi ne peut jamais repasser sous le coût.
  const price = roundPriceUpAdaptive(cost / divisor);
  const netProfitUsd = roundCents(price * (1 - safePaymentFee / 100) - cost);
  const netMarginPercent =
    price > 0 ? Math.round(((price * (1 - safePaymentFee / 100) - cost) / price) * 1000) / 10 : 0;

  return { ok: true, cost, price, netMarginPercent, netProfitUsd };
}

/** Frais de paiement sûrs (valeur absente ou aberrante → défaut). */
function safePaymentFeeValue(value: number | null | undefined): number {
  const parsed = Number(value ?? DEFAULT_PAYMENT_FEE_PERCENT);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/* ------------------- Contrôle de perte (hors réseau) ---------------------- */

/** Verdict du contrôle de rentabilité d'un montant. */
export type RentabilityVerdict = "loss" | "suspect" | "ok";

export interface RentabilityEntry {
  ficheId: string;
  ficheTitle: string;
  label: string;
  price: number;
  /** Valeur faciale (ce que le client reçoit). */
  face: number;
  /** Coût retenu ; `null` si la valeur faciale est illisible. */
  cost: number | null;
  verdict: RentabilityVerdict;
  /** Message prêt à afficher. */
  message: string;
}

/**
 * Contrôle de rentabilité SANS réseau.
 *
 * Le coût est calculé avec les frais **et la remise** mémorisés sur la fiche :
 *
 *   coût = face × (1 + frais%) × (1 − remise%)
 *
 * Une remise Reloadly rend donc une vente rentable même sous la valeur faciale
 * (ex. face 60 $, remise 4,4 % → coût 57,36 $, vente 59,50 $ = bénéfice).
 *
 * Quand les frais/remise sont inconnus, on ne crie PAS à la perte : le montant
 * est seulement signalé **à vérifier** (`suspect`), car une remise inconnue
 * peut changer la conclusion. Seuls les montants disponibles sont contrôlés.
 */
export function faceValueLosses<
  T extends {
    label: string;
    priceUsd: number;
    available: boolean;
    reloadlyUnitPrice?: number | null;
    faceValue?: string;
    faceCurrency?: string | null;
    supplierCostUsd?: number | null;
  },
>(
  fiches: Array<{
    id: string;
    titleEn: string;
    supplierFeePercent?: number | null;
    supplierDiscountPercent?: number | null;
    denominations: T[];
  }>,
): RentabilityEntry[] {
  const cents = (value: number) => Math.round(value * 100 + 1e-9) / 100;
  const entries: RentabilityEntry[] = [];

  for (const fiche of fiches) {
    const fee = fiche.supplierFeePercent;
    const discount = fiche.supplierDiscountPercent;
    const feesKnown = fee != null && Number.isFinite(Number(fee));
    const discountKnown = discount != null && Number.isFinite(Number(discount));

    for (const denomination of fiche.denominations) {
      if (!denomination.available) continue;
      const face = denominationUnitPrice(denomination as never);
      if (face == null || face <= 0) continue;
      const price = denomination.priceUsd;
      if (!(price > 0)) continue;

      // Face non-USD (500 TRY, 250 EGP…) : le nombre inscrit sur la carte
      // n'est PAS de l'argent américain. Le seul coût fiable est celui que
      // Reloadly a réellement débité, mémorisé sur le montant.
      const currency = String(denomination.faceCurrency ?? "USD").trim().toUpperCase();
      if (currency && currency !== "USD") {
        const supplierCost = Number(denomination.supplierCostUsd);
        const costKnown = Number.isFinite(supplierCost) && supplierCost > 0;
        if (!costKnown) {
          entries.push({
            ficheId: fiche.id,
            ficheTitle: fiche.titleEn || fiche.id,
            label: denomination.label,
            price,
            face,
            cost: null,
            verdict: "suspect",
            message: `${price.toFixed(2)} $ pour une carte de ${face} ${currency} — à vérifier : le coût réel en USD n'est pas encore connu (relancez une révision du produit).`,
          });
          continue;
        }
        const cost = cents(supplierCost);
        if (cents(price) >= cost) continue;
        entries.push({
          ficheId: fiche.id,
          ficheTitle: fiche.titleEn || fiche.id,
          label: denomination.label,
          price,
          face,
          cost,
          verdict: "loss",
          message: `${price.toFixed(2)} $ pour un coût réel de ${cost.toFixed(2)} $ (${face} ${currency} chez Reloadly) — perte de ${(cost - price).toFixed(2)} $ par vente.`,
        });
        continue;
      }

      // Coût vérifiable seulement si l'on connaît frais ET remise.
      const verified = feesKnown && discountKnown;
      const cost = verified
        ? cents(face * (1 + Number(fee) / 100) * (1 - Number(discount) / 100))
        : null;

      if (cost != null) {
        if (cents(price) >= cents(cost)) continue; // rentable, rien à signaler
        entries.push({
          ficheId: fiche.id,
          ficheTitle: fiche.titleEn || fiche.id,
          label: denomination.label,
          price,
          face,
          cost,
          verdict: "loss",
          message: `${price.toFixed(2)} $ pour un coût réel de ${cost.toFixed(2)} $ (frais ${
            feesKnown ? Number(fee) : 0
          } %, remise ${discountKnown ? Number(discount) : 0} %) — perte de ${(
            cost - price
          ).toFixed(2)} $ par vente.`,
        });
        continue;
      }

      // Remise inconnue : simple vérification, jamais une accusation de perte.
      if (cents(price) < cents(face)) {
        entries.push({
          ficheId: fiche.id,
          ficheTitle: fiche.titleEn || fiche.id,
          label: denomination.label,
          price,
          face,
          cost: null,
          verdict: "suspect",
          message: `${price.toFixed(2)} $ pour une valeur faciale de ${face} $ — à vérifier : une remise Reloadly peut rendre cette vente rentable.`,
        });
      }
    }
  }

  return entries;
}

/* ------------------- Prix accepté par le fournisseur ---------------------- */

/**
 * Ce que Reloadly impose sur la valeur faciale d'un produit.
 *
 * `FIXED` n'accepte QUE les montants listés ; `RANGE` accepte toute valeur
 * entre `min` et `max`. Envoyer autre chose renvoie `WRONG_PRODUCT_PRICE`
 * (« Invalid price ») — une erreur opaque qui coûtait une commande payée.
 */
export interface SupplierPriceProduct {
  denominationType: string;
  fixedDenominations: number[];
  minDenomination: number | null;
  maxDenomination: number | null;
  currencyCode?: string;
  productId?: number;
}

export interface SupplierPriceCheck {
  /** `true` si la valeur est acceptable (ou indécidable). */
  ok: boolean;
  /** Message prêt à afficher (admin, motif de commande). */
  message: string;
}

function samePrice(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

/** Formate une liste de montants : « 10, 20, 50 ». */
export function formatPrices(values: number[]): string {
  return values
    .filter((value) => Number.isFinite(value))
    .map((value) => (Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)))
    .join(", ");
}

/**
 * Vérifie qu'une valeur faciale est acceptée par le produit Reloadly.
 *
 * Prudence volontaire : si le produit ne dit rien d'exploitable (type
 * inconnu, liste vide, fourchette absente), on renvoie `ok: true` — mieux
 * vaut tenter l'achat que bloquer une vente sur une donnée manquante.
 */
export function checkSupplierUnitPrice(
  product: SupplierPriceProduct,
  unitPrice: number,
): SupplierPriceCheck {
  const currency = product.currencyCode ? ` ${product.currencyCode}` : "";
  const suffix = product.productId ? ` (produit #${product.productId})` : "";

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return { ok: false, message: "Aucune valeur faciale Reloadly pour ce montant." };
  }

  const type = (product.denominationType ?? "").toUpperCase();

  if (type === "FIXED") {
    const allowed = product.fixedDenominations ?? [];
    if (allowed.length === 0) return { ok: true, message: "Montants non communiqués par Reloadly." };
    if (allowed.some((value) => samePrice(value, unitPrice))) {
      return { ok: true, message: `Valeur acceptée par Reloadly (${formatPrices(allowed)}${currency}).` };
    }
    return {
      ok: false,
      message: `${unitPrice}${currency} n'est pas une valeur acceptée par Reloadly${suffix} — valeurs possibles : ${formatPrices(allowed)}${currency}.`,
    };
  }

  if (type === "RANGE") {
    const { minDenomination: min, maxDenomination: max } = product;
    if (min == null && max == null) return { ok: true, message: "Fourchette non communiquée par Reloadly." };
    const below = min != null && unitPrice < min - 0.005;
    const above = max != null && unitPrice > max + 0.005;
    if (!below && !above) {
      return {
        ok: true,
        message: `Valeur acceptée par Reloadly (fourchette ${min ?? "?"}–${max ?? "?"}${currency}).`,
      };
    }
    return {
      ok: false,
      message: `${unitPrice}${currency} est hors de la fourchette acceptée par Reloadly${suffix} (${min ?? "?"}–${max ?? "?"}${currency}).`,
    };
  }

  return { ok: true, message: "Type de montant inconnu : vérification impossible." };
}

/* --------------------- Réalignement sur la fiche actuelle -------------------- */

/** Référence figée dans la commande, à retrouver dans la fiche actuelle. */
export interface OrderDenominationRef {
  denominationId: string;
  denominationLabel: string;
  region: string;
}

/**
 * Retrouve, dans la fiche ACTUELLE, le montant qui a été commandé.
 *
 * L'admin réécrit les dénominations à chaque enregistrement : l'identifiant
 * de ligne change donc régulièrement. On retombe alors sur le libellé + la
 * région, puis sur le libellé seul — sans jamais deviner un autre montant.
 */
export function pickOrderDenomination<D extends { id: string; label: string; region: string }>(
  denominations: D[],
  ref: OrderDenominationRef,
): D | undefined {
  return (
    denominations.find((item) => item.id === ref.denominationId) ??
    denominations.find(
      (item) => item.label === ref.denominationLabel && item.region === ref.region,
    ) ??
    denominations.find((item) => item.label === ref.denominationLabel)
  );
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

/* --------- Relance automatique au suivi client & cohérence libellé --------- */

/** Délai minimal entre deux relances de livraison déclenchées par le suivi client (10 s). */
export const POLL_DELIVERY_COOLDOWN_MS = 10_000;

/** Laisse la priorité à l'IPN pendant les premières secondes suivant le paiement. */
export const POLL_INITIAL_GRACE_MS = 3_000;

/**
 * Décide si la consultation de `/codes/commande` doit déclencher ou
 * poursuivre la livraison d'une commande déjà payée :
 *  - couvre le cas où le webhook IPN NOWPayments a du retard ou n'a pas pu
 *    aboutir (`digitalOrder.status === "pending"` alors que `paymentStatus === "paid"`) ;
 *  - couvre le cas où Reloadly a répondu `PENDING` / `PROCESSING` lors du
 *    premier appel (`digitalOrder.status === "paid"`, `reloadlyTransactionId`
 *    présent, en attente d'émission des codes).
 */
export function shouldAutoDeliverOnPoll(input: {
  digitalStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
  attempts: number;
  updatedAt: Date | string | number | null | undefined;
  now?: number;
}): boolean {
  if (input.paymentStatus !== "paid") return false;
  const status = normalizeDigitalStatus(input.digitalStatus);
  if (status !== "pending" && status !== "paid") return false;

  const now = input.now ?? Date.now();
  const updatedMs =
    input.updatedAt instanceof Date
      ? input.updatedAt.getTime()
      : input.updatedAt != null
        ? new Date(input.updatedAt).getTime()
        : 0;
  const elapsed = Number.isFinite(updatedMs) && updatedMs > 0 ? now - updatedMs : Infinity;

  if (status === "pending" && (input.attempts ?? 0) === 0) {
    return elapsed >= POLL_INITIAL_GRACE_MS;
  }
  return elapsed >= POLL_DELIVERY_COOLDOWN_MS;
}

/**
 * Détecte un écart entre le montant affiché dans le libellé (`$20`, `30$`)
 * et la valeur faciale (`25 USD`, `50 USD`) ou la valeur Reloadly.
 *
 * Cas réel observé sur la fiche Steam en production : libellé `30$` mais
 * `faceValue: "50 USD"` (ce qui fait commander une carte de 50 $ pour un
 * prix de 31,50 $ si `reloadlyUnitPrice` est déduit de `faceValue`).
 */
export function denominationLabelFaceMismatch(denomination: {
  label: string;
  faceValue: string;
  reloadlyUnitPrice?: number | null;
}): string | null {
  const label = String(denomination.label ?? "").trim();
  const faceValue = String(denomination.faceValue ?? "").trim();
  if (!label || !faceValue) return null;

  // On ne compare que si les deux expriment un montant monétaire (évite de
  // comparer « 3 أشهر » et « 3 months » ou un libellé purement textuel).
  const labelMatch = label.match(/(?:\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*\$)/);
  const faceMatch = faceValue.match(/(\d+(?:[.,]\d+)?)\s*USD/i);
  if (!labelMatch || !faceMatch) return null;

  const labelAmount = Number((labelMatch[1] ?? labelMatch[2] ?? "").replace(",", "."));
  const faceAmount = Number(faceMatch[1].replace(",", "."));
  if (!Number.isFinite(labelAmount) || !Number.isFinite(faceAmount)) return null;

  const unitPrice = denominationUnitPrice(denomination as never);
  if (!samePrice(labelAmount, faceAmount)) {
    return (
      `Libellé « ${label} » ≠ valeur faciale « ${faceValue} »` +
      (unitPrice != null ? ` (Reloadly recevra ${unitPrice} USD)` : "") +
      ` — alignez le libellé, la valeur faciale et la valeur Reloadly.`
    );
  }
  if (unitPrice != null && !samePrice(labelAmount, unitPrice)) {
    return `Libellé « ${label} » ≠ valeur Reloadly (${unitPrice} USD) — vérifiez le montant envoyé au fournisseur.`;
  }
  return null;
}


