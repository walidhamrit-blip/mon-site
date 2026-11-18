/**
 * Noyau PUR de la décision de livraison automatique G2G (phase 2).
 *
 * Aucun réseau, aucun `process.env`, aucune dépendance Next : directement
 * testable. Ce module répond à une seule question — « doit-on acheter chez
 * le fournisseur pour honorer cette commande ? » — et, le cas échéant,
 * pourquoi NON.
 *
 * ⚠️ Chaque refus est `fail-closed` : dans le doute, on ne dépense pas.
 * Un achat automatique engagé par erreur est irréversible (l'argent est
 * parti) alors qu'une commande non honorée se traite à la main.
 *
 * Aucun code produit, aucun secret : ce module ne manipule que des montants
 * et des verdicts.
 */

// Extension explicite : `node --test` exécute ces fichiers directement
// (annotation de type retirée à la volée) et ne résout pas les imports
// sans extension ni l'alias `@/`.
import {
  G2G_MAX_DELIVERY_QTY,
  evaluateG2gMargin,
  type G2gMarginVerdict,
} from "./g2g-core.ts";

/**
 * Verdict de la décision. `proceed` est le SEUL qui autorise un achat.
 */
export type G2gFulfilmentDecision =
  /** Acheter puis livrer. */
  | "proceed"
  /** La correspondance existe mais n'est pas activée. */
  | "mapping_disabled"
  /**
   * L'offre G2G n'a pas pu être relue au moment de l'événement (clés API
   * absentes, erreur réseau, offre supprimée). Sans prix courant, aucune
   * marge n'est démontrable — et il ne faut surtout pas laisser croire à
   * un simple « coupe-circuit », qui pousserait à chercher ailleurs.
   */
  | "offer_unreadable"
  /** L'automatisation est coupée globalement (coupe-circuit). */
  | "kill_switch_off"
  /** Commission G2G non déclarée : la rentabilité est incalculable. */
  | "fee_not_configured"
  /** Prix de vente illisible : on ne peut rien garantir. */
  | "missing_price"
  /** G2G attend un rechargement par ID joueur, pas un code. */
  | "topup_forbidden"
  /** G2G n'indique pas le format de code attendu. */
  | "code_label_missing"
  | "currency_mismatch"
  | "quantity_invalid"
  /** Coût fournisseur inconnu (SKU jamais vérifié) : on n'achète pas à l'aveugle. */
  | "cost_unknown"
  | "cap_exceeded"
  | "margin_too_low"
  | "invalid";

export interface G2gFulfilmentInput {
  mappingEnabled: boolean;
  /** Coupe-circuit global (`G2G_AUTO_DELIVERY`). */
  autoDeliveryEnabled: boolean;
  /** Commission G2G + frais de retrait, en %. `null` si non configuré. */
  feePercent: number | null;
  /** Prix de vente unitaire affiché sur l'offre G2G. */
  offerUnitPrice: number | null | undefined;
  offerCurrency: string;
  /** `delivery_type` renvoyé par G2G, ex. `["api"]`, `["top_up"]`. */
  offerDeliveryType?: readonly string[] | null;
  /** `code_label` : ce que l'acheteur doit recevoir. */
  offerCodeLabel?: string | null;
  supplierCostUsd: number;
  /** Devise déclarée dans la correspondance (USD exigé). */
  saleCurrency: string;
  minMarginPercent: number;
  maxCostUsd: number;
  requestedQty: number;
}

export interface G2gFulfilmentPlan {
  decision: G2gFulfilmentDecision;
  /** Vrai UNIQUEMENT pour `proceed` : c'est le déclencheur d'achat. */
  shouldPurchase: boolean;
  unitPrice: number;
  supplierCostUsd: number;
  requestedQty: number;
  netRevenueUsd: number;
  totalCostUsd: number;
  netMarginPercent: number;
  /** Commission appliquée, pour relire un verdict sans fouiller les logs. */
  feePercent: number;
  /** Phrase courte, exploitable dans un log ou une alerte Telegram. */
  summary: string;
}

const EMPTY_PLAN: Omit<G2gFulfilmentPlan, "decision" | "summary"> = {
  shouldPurchase: false,
  unitPrice: 0,
  supplierCostUsd: 0,
  requestedQty: 0,
  netRevenueUsd: 0,
  totalCostUsd: 0,
  netMarginPercent: 0,
  feePercent: 0,
};

function refuse(
  decision: G2gFulfilmentDecision,
  summary: string,
  input?: Pick<G2gFulfilmentInput, "offerUnitPrice" | "supplierCostUsd" | "requestedQty">,
): G2gFulfilmentPlan {
  return {
    ...EMPTY_PLAN,
    decision,
    summary,
    unitPrice: Number(input?.offerUnitPrice ?? 0) || 0,
    supplierCostUsd: Number(input?.supplierCostUsd ?? 0) || 0,
    requestedQty: Number(input?.requestedQty ?? 0) || 0,
  };
}

/** Traduit le verdict du garde-fou de marge en décision de livraison. */
function marginReasonToDecision(reason: G2gMarginVerdict["reason"]): G2gFulfilmentDecision {
  switch (reason) {
    case "currency":
      return "currency_mismatch";
    case "quantity":
      return "quantity_invalid";
    case "cap":
      return "cap_exceeded";
    case "margin":
      return "margin_too_low";
    case "invalid":
    default:
      return "invalid";
  }
}

/**
 * Décide si une commande G2G doit déclencher un achat fournisseur.
 *
 * L'ordre des contrôles compte : les refus « structurels » (correspondance
 * désactivée, coupe-circuit, commission inconnue) précèdent les contrôles
 * économiques, pour que le journal dise toujours la VRAIE raison.
 */
export function planG2gFulfilment(input: G2gFulfilmentInput): G2gFulfilmentPlan {
  const qty = Number(input.requestedQty);
  const cost = Number(input.supplierCostUsd);
  const price = Number(input.offerUnitPrice);

  if (!input.mappingEnabled) {
    return refuse(
      "mapping_disabled",
      "Correspondance désactivée : traitement manuel.",
      input,
    );
  }

  // Coupe-circuit : un seul interrupteur pour tout arrêter, sans redéployer.
  if (!input.autoDeliveryEnabled) {
    return refuse(
      "kill_switch_off",
      "Automatisation désactivée (G2G_AUTO_DELIVERY) : traitement manuel.",
      input,
    );
  }

  // Sans commission déclarée, la marge nette est une fiction. On exige donc
  // une valeur explicite plutôt qu'un défaut optimiste.
  const fee = Number(input.feePercent);
  if (input.feePercent === null || !Number.isFinite(fee) || fee < 0 || fee >= 100) {
    return refuse(
      "fee_not_configured",
      "Commission G2G (G2G_FEE_PERCENT) absente ou invalide : rentabilité incalculable.",
      input,
    );
  }

  if (!Number.isFinite(price) || price <= 0) {
    return refuse("missing_price", "Prix de vente G2G illisible.", input);
  }

  // Un top-up par ID joueur livré avec un code est l'erreur la plus
  // coûteuse du métier : l'acheteur reçoit quelque chose d'inutilisable.
  const types = (input.offerDeliveryType ?? []).map((value) =>
    String(value ?? "").trim().toLowerCase(),
  );
  if (types.some((value) => value.includes("top_up") || value.includes("topup"))) {
    return refuse(
      "topup_forbidden",
      "L'offre attend un rechargement par ID joueur : jamais de code.",
      input,
    );
  }

  // Sans `code_label`, on ignore le format attendu : on ne livre pas.
  const codeLabel = (input.offerCodeLabel ?? "").trim();
  if (!codeLabel) {
    return refuse(
      "code_label_missing",
      "G2G n'indique pas le format de code attendu (code_label).",
      input,
    );
  }

  // `evaluateG2gMargin` regroupe ces deux cas sous « invalid ». On les
  // distingue ici : un journal qui dit « quantité invalide » ou « coût
  // inconnu » se corrige immédiatement, alors qu'un « invalid » oblige à
  // rouvrir le code.
  if (!Number.isInteger(qty) || qty < 1 || qty > G2G_MAX_DELIVERY_QTY) {
    return refuse(
      "quantity_invalid",
      `Quantité demandée invalide : ${qty} (1 à ${G2G_MAX_DELIVERY_QTY}).`,
      input,
    );
  }

  // Sans coût fournisseur, aucune marge n'est calculable. C'est le cas d'un
  // SKU jamais vérifié : on refuse plutôt que d'acheter à l'aveugle.
  if (!Number.isFinite(cost) || cost <= 0) {
    return refuse(
      "cost_unknown",
      "Coût fournisseur inconnu : vérifier le SKU avant d'automatiser.",
      input,
    );
  }

  const verdict = evaluateG2gMargin({
    unitPrice: price,
    saleCurrency: input.offerCurrency,
    costUsd: cost,
    feePercent: fee,
    minMarginPercent: input.minMarginPercent,
    maxCostUsd: input.maxCostUsd,
    requestedQty: qty,
  });

  if (!verdict.ok) {
    const decision = marginReasonToDecision(verdict.reason);
    return {
      ...refuse(decision, `Garde-fou de marge : ${decision}.`, input),
      netRevenueUsd: verdict.netRevenueUsd,
      totalCostUsd: verdict.totalCostUsd,
      netMarginPercent: verdict.netMarginPercent,
      feePercent: fee,
    };
  }

  return {
    decision: "proceed",
    shouldPurchase: true,
    unitPrice: price,
    supplierCostUsd: cost,
    requestedQty: qty,
    netRevenueUsd: verdict.netRevenueUsd,
    totalCostUsd: verdict.totalCostUsd,
    netMarginPercent: Math.round(verdict.netMarginPercent * 100) / 100,
    feePercent: fee,
    summary: `Marge nette ${verdict.netMarginPercent.toFixed(1)} % sur ${qty} unité(s) : achat autorisé.`,
  };
}

/**
 * Préfixe des clés d'idempotence envoyées au fournisseur.
 *
 * Le préfixe `g2g-` distingue nos achats automatisés des commandes de la
 * boutique, ce qui permet de les retrouver chez le fournisseur.
 */
const G2G_IDEMPOTENCY_PREFIX = "g2g-";

/**
 * Clé d'idempotence dérivée du `delivery_id` G2G.
 *
 * Déterministe par construction : le même `delivery_id` produit toujours la
 * même clé. C'est ce qui rend un événement rejoué inoffensif — le
 * fournisseur reconnaît la clé et ne prélève qu'une fois.
 *
 * Renvoie `null` si l'identifiant est inexploitable : sans clé fiable, on
 * ne doit pas acheter.
 */
export function g2gIdempotencyKey(deliveryId: string | undefined | null): string | null {
  const cleaned = (deliveryId ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!cleaned) return null;
  // 64 caractères : assez pour l'identifiant G2G, et borné pour l'en-tête.
  return (G2G_IDEMPOTENCY_PREFIX + cleaned).slice(0, 64);
}

/**
 * LA question qui engage de l'argent : doit-on acheter maintenant ?
 *
 * Toute dépense doit passer par cette fonction. Elle est le seul endroit
 * où l'on croise le verdict du moteur avec l'état réel du coupe-circuit —
 * donc le seul endroit où une erreur coûterait de l'argent.
 *
 * Le plan est calculé « comme si » l'automation était activée (pour rester
 * lisible pendant la répétition) : on lui réapplique donc le coupe-circuit
 * ici. Un plan `proceed` avec le coupe-circuit baissé ne déclenche rien.
 */
export function shouldPurchaseNow(
  plan: G2gFulfilmentPlan | null,
  autoDeliveryEnabled: boolean,
): boolean {
  if (!plan) return false;
  return applyKillSwitch(plan.decision, autoDeliveryEnabled) === "proceed";
}

/**
 * Commission G2G déclarée côté serveur (`G2G_FEE_PERCENT`).
 *
 * Renvoie `null` — donc un refus — si la valeur est absente ou inexploitable.
 * Aucun défaut « optimiste » : une commission sous-évaluée ferait acheter à
 * perte de façon automatique et silencieuse.
 */
export function g2gFeePercent(raw: string | undefined | null): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value >= 100) return null;
  return value;
}

/**
 * Applique le coupe-circuit à une décision calculée « comme si » l'automation
 * était activée.
 *
 * Example : répétition générale → `proceed` devient `kill_switch_off`, mais
 * un `margin_too_low` reste `margin_too_low` (c'est la vraie raison, et elle
 * le restera après activation).
 *
 * ⚠️ Quand l'achat sera câblé, c'est `shouldPurchase` de l'appel fait avec
 * le VRAI `autoDeliveryEnabled` qui doit le déclencher — jamais un plan
 * calculé en « comme si ».
 */
export function applyKillSwitch(
  hypothetical: G2gFulfilmentDecision,
  autoDeliveryEnabled: boolean,
): G2gFulfilmentDecision {
  if (autoDeliveryEnabled) return hypothetical;
  return hypothetical === "proceed" ? "kill_switch_off" : hypothetical;
}

/** Coupe-circuit : `G2G_AUTO_DELIVERY` doit valoir explicitement « 1 ». */
export function g2gAutoDeliveryEnabled(raw: string | undefined | null): boolean {
  return (raw ?? "").trim() === "1";
}
