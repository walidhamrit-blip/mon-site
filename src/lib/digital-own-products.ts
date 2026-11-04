import type { DigitalDenomination, DigitalProduct } from "./digital-types.ts";
import { retailPriceForCost } from "./fazercards-pricing.ts";

/**
 * Fiches vendues par Nukhba elle-même, hors catalogue générique du fournisseur.
 *
 * Pourquoi ce fichier existe : la boutique publique est alimentée par le
 * catalogue FazerCards (`fzr-…`). Certaines lignes n'y sont PAS des « offres »
 * classiques — c'est le cas de la **recharge de compte Steam** (Steam by
 * login), facturée sur `/api/v2/steam-topup/order` avec un identifiant Steam,
 * et non sur `/orders` avec un `offer_id`. Ces fiches n'ont donc aucun
 * équivalent dans le catalogue synchronisé : sans ce fichier, elles
 * n'existeraient nulle part.
 *
 * Règle : une fiche de ce module est **fusionnée** dans le catalogue servi
 * (public ET admin), avec ses coûts, pour que l'alignement marché s'applique
 * comme aux autres. Les surcharges de l'admin restent prioritaires : elles
 * sont appliquées APRÈS cette fusion.
 */

/**
 * Remise du fournisseur sur la ligne Steam top-up, en % de la valeur faciale.
 *
 * Barème FazerCards constaté le 4 novembre 2026 : Bronze 2,5 %, Silver 3 %,
 * Gold 3,55 %. On retient **Bronze** (le plus prudent) : si le compte passe
 * Silver/Gold, le coût baisse et la marge augmente sans toucher au prix.
 */
export const STEAM_TOPUP_DISCOUNT_PERCENT = 2.5;

/** Plafond de la ligne chez le fournisseur (US $1 000 par opération). */
export const STEAM_TOPUP_MAX_USD = 1000;

/** Champ obligatoire : la recharge se fait sur le compte, par identifiant. */
const STEAM_LOGIN_FIELD = {
  key: "steamLogin",
  label: "Identifiant Steam (login)",
  type: "text",
} as const;

/**
 * Montant net débité du solde fournisseur pour une recharge de `faceUsd`.
 * Arrondi au centime SUPÉRIEUR : sous-estimer un coût fabrique une marge
 * imaginaire, l'erreur la plus coûteuse du catalogue.
 */
export function steamTopupCostUsd(faceUsd: number): number {
  const cost = faceUsd * (1 - STEAM_TOPUP_DISCOUNT_PERCENT / 100);
  return Math.round(cost * 100) / 100;
}

function steamTopupDenomination(faceUsd: number): DigitalDenomination {
  const cost = steamTopupCostUsd(faceUsd);
  return {
    id: `steam-topup-${faceUsd}`,
    label: `${faceUsd} USDT`,
    faceValue: `${faceUsd} USD`,
    region: "CIS",
    // Prix de départ du barème maison ; l'alignement marché le ramène au
    // niveau du marché juste après (voir `competitor-pricing.ts`).
    priceUsd: retailPriceForCost(cost).priceUsd,
    supplierCostUsd: cost,
    available: true,
    fields: [{ ...STEAM_LOGIN_FIELD }],
  };
}

/**
 * Recharge de compte Steam (« Steam by login »).
 *
 * Remplace avantageusement la carte Steam classique : le fournisseur facture
 * SOUS la valeur faciale (remise 2,5 %) au lieu de la facturer au-dessus
 * (carte 50 $ achetée 49,25 $, frais compris). Le client reçoit exactement
 * la valeur affichée dans son portefeuille Steam.
 *
 * Limite honnête : la recharge par identifiant n'est ouverte que sur les
 * storefronts éligibles (Russie, Ukraine, Kazakhstan, Biélorussie…), pas sur
 * un compte US/UE — d'où la région « CIS » et le statut provisoire.
 */
export const STEAM_ACCOUNT_TOPUP: DigitalProduct = {
  id: "steam-account-topup",
  slug: "steam-account-topup",
  kind: "game_topup",
  // `coming_soon` : la fiche, ses prix et son coût sont publiés, mais la
  // caisse ne l'accepte pas encore — la commande exige un identifiant Steam
  // que le tunnel de paiement ne collecte pas (voir docs/alignement-marche).
  status: "coming_soon",
  platform: "Steam",
  color: "#1B2838",
  titleAr: "شحن محفظة Steam بالحساب",
  titleEn: "Steam Wallet Top-Up (by login)",
  descriptionAr:
    "شحن محفظة Steam مباشرة على حسابك: تُدخل معرّف Steam وتُضاف القيمة إلى المحفظة دون الحاجة إلى كود. أرخص من بطاقات Steam لأن المورد يمنحنا خصماً على القيمة الاسمية.",
  descriptionEn:
    "Steam wallet credit sent straight to your account: you give your Steam login and the value lands in your wallet — no code to redeem. Cheaper than Steam gift cards because the supplier prices this line below face value.",
  image: "/digital-products/steam-wallet.jpg",
  regions: ["CIS"],
  featuresAr: [
    "بدون كود: الرصيد يُضاف إلى المحفظة مباشرة",
    "القيمة كاملة كما تُعرض في Steam",
    "أرخص من بطاقة Steam بفضل خصم المورد",
    "تفعيل خلال دقائق بعد الدفع",
  ],
  featuresEn: [
    "No code: the credit lands in your Steam wallet",
    "Full face value shows up in your Steam client",
    "Cheaper than a Steam gift card thanks to the supplier discount",
    "Applied within minutes of payment",
  ],
  deliveryNoteAr:
    "بعد تأكيد الدفع نضيف الرصيد إلى حساب Steam الذي أدخلته. تأكد من صحة المعرّف: الشحن غير قابل للإلغاء.",
  deliveryNoteEn:
    "Once payment is confirmed we credit the Steam account you entered. Double-check the login: a delivered top-up cannot be reverted.",
  denominations: [5, 10, 20, 50, 100].map(steamTopupDenomination),
  sortOrder: 12,
  // Demande explicite du 4 novembre : la recharge Steam doit ouvrir la
  // rubrique « شحن ألعاب » (et la vitrine), pas flotter derrière PUBG.
  pinned: true,
  fulfillment: "manual",
  supplier: "fazercards",
  // Remise fournisseur mémorisée : elle explique pourquoi un prix inférieur
  // à la valeur faciale reste rentable sur cette ligne.
  supplierDiscountPercent: STEAM_TOPUP_DISCOUNT_PERCENT,
  supplierFeePercent: null,
  marginPercent: null,
};

/** Toutes les fiches propres à Nukhba (une entrée pour l'instant). */
export const OWN_DIGITAL_PRODUCTS: readonly DigitalProduct[] = [STEAM_ACCOUNT_TOPUP];

/**
 * Fusionne les fiches maison dans un catalogue fournisseur ou en base.
 *
 * Une fiche existante portant le même identifiant n'est jamais écrasée : si
 * l'admin a créé/édité une fiche équivalente, c'est la sienne qui gagne.
 */
export function withOwnProducts(products: readonly DigitalProduct[]): DigitalProduct[] {
  const known = new Set(products.map((product) => product.id));
  const own = OWN_DIGITAL_PRODUCTS.filter((product) => !known.has(product.id));
  if (own.length === 0) return [...products];
  return [...products, ...own].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id),
  );
}
