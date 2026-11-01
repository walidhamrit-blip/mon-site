/**
 * Garde-fou de SOLDE fournisseur — logique pure, testable sans réseau ni base.
 *
 * ⚠️ Le problème résolu. Le solde FazerCards est un **préfinancement** : la
 * caisse encaisse le client, PUIS achète le code chez le fournisseur. Si le
 * solde ne couvre pas cet achat, le client a payé pour rien et la commande
 * part en livraison manuelle. Le plafond de vente (`FAZERCARDS_MAX_ORDER_USD`)
 * doit donc rester **couvert** par le solde : c'est cette cohérence que ce
 * module vérifie, et que rien ne contrôlait auparavant.
 *
 * Deux notions à ne jamais confondre :
 *  - le **prix de vente** (ce que paie le client) ;
 *  - le **coût fournisseur** (ce qui est débité du solde) — inférieur, car il
 *    exclut notre marge.
 *
 * Aucun montant de solde n'est jamais exposé publiquement : cette logique sert
 * l'administration, l'alerte interne et la porte de la caisse (refus d'une
 * vente que le solde ne peut pas financer, AVANT création de la facture).
 */

// Import RELATIF volontaire (et non l'alias « @/lib ») : ce module est importé
// directement par `scripts/fazercards-balance.test.mjs` via Node 22, qui ne
// résout pas l'alias TypeScript. Il reste sans réseau et sans base.
import { retailPriceForCost } from "./fazercards-pricing.ts";

/** Niveau de couverture du plafond de vente par le solde. */
export const BALANCE_LEVELS = ["ok", "low", "critical", "unknown"] as const;
export type BalanceLevel = (typeof BALANCE_LEVELS)[number];

/** En dessous de ce ratio de couverture, le plafond n'est plus « presque » tenu. */
export const BALANCE_LOW_RATIO = 0.3;

/** Solde plancher : en dessous, un seul petit article peut échouer. */
export const BALANCE_MIN_USD = 5;

/** Marge de sécurité appliquée au montant de recharge recommandé. */
export const BALANCE_TOPUP_SAFETY = 1.15;

/** Palier d'arrondi du montant de recharge recommandé (dollars). */
export const BALANCE_TOPUP_ROUNDING_USD = 10;

/**
 * Coût fournisseur maximal dont le prix de vente reste ≤ `priceUsd`.
 *
 * Le barème de marge étant dégressif (voir `fazercards-pricing.ts`), il n'y a
 * pas de division simple à faire : on inverse la fonction par dichotomie.
 * C'est le seul calcul honnête — une approximation « prix × 0,9 » surestime le
 * coût des petits articles (marge 20 %) et sous-estime celui des gros.
 */
export function supplierCostForSalePrice(priceUsd: number): number {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return 0;
  let low = 0;
  let high = priceUsd;
  // 40 itérations : précision très inférieure au centime, coût négligeable.
  for (let step = 0; step < 40; step += 1) {
    const middle = (low + high) / 2;
    if (retailPriceForCost(middle).priceUsd <= priceUsd) low = middle;
    else high = middle;
  }
  return Math.floor(low * 100) / 100;
}

export interface BalanceAssessment {
  level: BalanceLevel;
  /** Solde lu chez le fournisseur (null = inconnu : clé absente ou API muette). */
  balanceUsd: number | null;
  /** Plafond d'achat configuré, en PRIX DE VENTE. */
  maxOrderUsd: number;
  /** Ce que le plafond coûte réellement au solde (coût fournisseur). */
  costCeilingUsd: number;
  /** Plus grosse vente encore payable avec le solde actuel. */
  coveredSaleUsd: number | null;
  /** `coveredSaleUsd / maxOrderUsd` — 1 = tout le plafond est couvert. */
  coverageRatio: number | null;
  /** Recharge conseillée (multiple de 10 $, marge de sécurité incluse). */
  recommendedTopUpUsd: number;
  /** Phrase prête à afficher (français — interface d'administration). */
  summary: string;
}

/**
 * Évalue la couverture du plafond de vente par le solde.
 *
 * @param balanceUsd  solde tel que renvoyé par le fournisseur (null si illisible)
 * @param maxOrderUsd plafond d'achat automatique, en prix de vente
 */
export function assessFazercardsBalance(input: {
  balanceUsd: number | null;
  maxOrderUsd: number;
}): BalanceAssessment {
  const maxOrderUsd =
    Number.isFinite(input.maxOrderUsd) && input.maxOrderUsd > 0
      ? input.maxOrderUsd
      : 0;
  const costCeilingUsd = supplierCostForSalePrice(maxOrderUsd);
  const balanceUsd =
    input.balanceUsd != null && Number.isFinite(input.balanceUsd) && input.balanceUsd >= 0
      ? input.balanceUsd
      : null;

  if (balanceUsd == null) {
    return {
      level: "unknown",
      balanceUsd: null,
      maxOrderUsd,
      costCeilingUsd,
      coveredSaleUsd: null,
      coverageRatio: null,
      recommendedTopUpUsd: roundTopUp(costCeilingUsd * BALANCE_TOPUP_SAFETY),
      summary:
        "Solde fournisseur illisible (clé API absente ou passerelle muette) : impossible de garantir l'achat après encaissement.",
    };
  }

  // Plus grosse vente payable : on repasse le solde dans le barème de vente.
  const coveredSaleUsd = retailPriceForCost(balanceUsd).priceUsd;
  const coverageRatio = maxOrderUsd > 0 ? coveredSaleUsd / maxOrderUsd : 0;

  let level: BalanceLevel = "ok";
  if (balanceUsd < BALANCE_MIN_USD || coverageRatio < BALANCE_LOW_RATIO) {
    level = "critical";
  } else if (coverageRatio < 1) {
    level = "low";
  }

  const target = costCeilingUsd * BALANCE_TOPUP_SAFETY;
  const recommendedTopUpUsd = balanceUsd < target ? roundTopUp(target - balanceUsd) : 0;

  return {
    level,
    balanceUsd,
    maxOrderUsd,
    costCeilingUsd,
    coveredSaleUsd,
    coverageRatio,
    recommendedTopUpUsd,
    summary: summaryFor({ level, balanceUsd, maxOrderUsd, costCeilingUsd, coveredSaleUsd }),
  };
}

/* --------------------- Porte de la caisse (avant paiement) --------------------- */

/**
 * Décision de la caisse AVANT création de la facture : le solde peut-il
 * financer l'achat fournisseur de CETTE commande ?
 *
 * Règles (dans l'ordre) :
 *  1. coût inconnu (dénomination sans coût fournisseur renseigné) → `allow` :
 *     on ne bloque pas une vente sur une donnée absente ;
 *  2. solde illisible (clé absente ou passerelle muette) → `allow` : une API
 *     muette ne doit pas fermer toute la boutique — la bascule en livraison
 *     manuelle (avec notification) reste le filet ;
 *  3. solde ≥ coût de la commande (coût unitaire × quantité, arrondi au
 *     centime) → `allow` ;
 *  4. sinon → `block` : la vente serait encaissée puis impossible à honorer.
 *
 * Comparaison en centimes entiers : les montants sont saisis avec deux
 * décimales et l'arithmétique binaire ne doit jamais refuser (ou laisser
 * passer) une commande à un centime près.
 */
export type BalanceGateDecision =
  | { decision: "allow"; reason: "covered" | "cost_unknown" | "balance_unknown" }
  | { decision: "block"; balanceUsd: number; orderCostUsd: number };

export function balanceGate(input: {
  /** Solde lu chez le fournisseur (null = illisible). */
  balanceUsd: number | null;
  /** Coût fournisseur de la commande (coût unitaire × quantité). */
  orderCostUsd: number | null;
}): BalanceGateDecision {
  const cost =
    typeof input.orderCostUsd === "number" &&
    Number.isFinite(input.orderCostUsd) &&
    input.orderCostUsd > 0
      ? Math.round(input.orderCostUsd * 100) / 100
      : null;
  if (cost == null) return { decision: "allow", reason: "cost_unknown" };

  const balance =
    typeof input.balanceUsd === "number" &&
    Number.isFinite(input.balanceUsd) &&
    input.balanceUsd >= 0
      ? Math.round(input.balanceUsd * 100) / 100
      : null;
  if (balance == null) return { decision: "allow", reason: "balance_unknown" };

  if (Math.round(balance * 100) >= Math.round(cost * 100)) {
    return { decision: "allow", reason: "covered" };
  }
  return { decision: "block", balanceUsd: balance, orderCostUsd: cost };
}

/** Arrondit une recharge au palier supérieur (jamais 0 pour un besoin réel). */
function roundTopUp(amountUsd: number): number {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return 0;
  return Math.ceil(amountUsd / BALANCE_TOPUP_ROUNDING_USD) * BALANCE_TOPUP_ROUNDING_USD;
}

function money(value: number): string {
  return `${value.toFixed(2)} $`;
}

function summaryFor(input: {
  level: BalanceLevel;
  balanceUsd: number;
  maxOrderUsd: number;
  costCeilingUsd: number;
  coveredSaleUsd: number;
}): string {
  const ceiling = `plafond de vente ${money(input.maxOrderUsd)} (coût fournisseur ${money(
    input.costCeilingUsd,
  )})`;
  if (input.level === "ok") {
    return `Solde ${money(input.balanceUsd)} : couvre tout le ${ceiling}.`;
  }
  if (input.level === "low") {
    return `Solde ${money(
      input.balanceUsd,
    )} : couvre les ventes jusqu'à ${money(input.coveredSaleUsd)}. Au-delà, la vente est refusée AVANT paiement (aucun débit).`;
  }
  return `Solde ${money(input.balanceUsd)} : INSUFFISANT pour le ${ceiling} — seule une vente jusqu'à ${money(
    input.coveredSaleUsd,
  )} est payable. Une vente plus grosse serait encaissée puis impossible à honorer.`;
}

/** Historique d'alerte persisté (table `settings`). */
export interface BalanceAlertState {
  level: BalanceLevel;
  sentAt: number;
  balanceUsd: number | null;
}

/**
 * Faut-il envoyer l'alerte maintenant ?
 *
 * Règles (dans l'ordre) :
 *  1. solde **ok** → jamais d'alerte ; si l'état précédent était dégradé, on
 *     renvoie `recovery` UNE fois (fin d'incident, information utile) ;
 *  2. niveau **changé** (y compris première détection) → alerte immédiate ;
 *  3. même niveau depuis `resendHours` → rappel (une fois par jour) ;
 *  4. sinon silence — un cron quotidien sur un solde durablement bas ne doit
 *     pas produire un e-mail par heure.
 */
export function shouldSendBalanceAlert(input: {
  level: BalanceLevel;
  previous: BalanceAlertState | null;
  now: number;
  resendHours?: number;
}): "alert" | "recovery" | "silent" {
  const previous = input.previous;
  if (input.level === "ok") {
    return previous && previous.level !== "ok" ? "recovery" : "silent";
  }
  if (!previous) return "alert";
  if (previous.level !== input.level) return "alert";
  const resendMs = Math.max(1, input.resendHours ?? 24) * 60 * 60 * 1000;
  if (!Number.isFinite(previous.sentAt) || input.now - previous.sentAt >= resendMs) {
    return "alert";
  }
  return "silent";
}
