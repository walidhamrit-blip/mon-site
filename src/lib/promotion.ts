// Promotion publique du moment : -50 % sur l'achat d'un site avec un
// code coupon. Source unique, partagée par :
//   - le bandeau animé (src/components/promo-banner.tsx) ;
//   - le dialogue de paiement (saisie du code + prix remisé) ;
//   - l'API de paiement (le prix est TOUJOURS recalculé côté serveur :
//     le navigateur ne peut pas imposer une remise).
// Pour arrêter la promotion : passer `enabled` à false — le bandeau
// disparaît et les coupons ne sont plus acceptés.

export const CURRENT_PROMO = {
  /** Affiche le bandeau et accepte le coupon au paiement. */
  enabled: true,
  /** Libellé exact du coupon à saisir (insensible à la casse). */
  code: "NUKHBA50",
  /** Remise appliquée au prix du site. */
  percent: 50,
  /** Date de fin (ISO) — null = pas de limite annoncée. */
  endsAt: null as string | null,
} as const;

export type PromoConfig = {
  enabled: boolean;
  code: string;
  percent: number;
  endsAt: string | null;
};

/** Le coupon promotionnel est-il actif en ce moment ? */
export function promoActive(
  promo: PromoConfig = CURRENT_PROMO,
  now: Date = new Date(),
): boolean {
  if (!promo.enabled || promo.percent <= 0 || !promo.code) return false;
  if (promo.endsAt) {
    const end = new Date(promo.endsAt).getTime();
    if (Number.isFinite(end) && now.getTime() > end) return false;
  }
  return true;
}

/** Normalise une saisie (« nukhba 50 » → « NUKHBA50 »). */
export function normalizeCoupon(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Le code saisi correspond-il au coupon en cours ?
 * Retourne `false` si la promotion est terminée/désactivée.
 */
export function isPromoCode(
  value: string | null | undefined,
  promo: PromoConfig = CURRENT_PROMO,
): boolean {
  if (!promoActive(promo)) return false;
  return normalizeCoupon(value) === normalizeCoupon(promo.code);
}

/** Montant remisé, arrondi au centime (ex. 880 → 440). */
export function discountedAmount(
  amount: number,
  percent: number = CURRENT_PROMO.percent,
): number {
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const rate = Math.min(90, Math.max(0, percent)) / 100;
  return Math.round(safe * (1 - rate) * 100) / 100;
}

/** Libellé arabe / anglais du coupon, pour les bannières et récapitulatifs. */
export function promoLabel(locale: "ar" | "en" | string, percent: number): string {
  return locale === "ar" ? `خصم ${percent}%` : `${percent}% OFF`;
}

/** Texte du bandeau, bilingue, sans dépendance React. */
export function promoBannerText(locale: "ar" | "en" | string, promo: PromoConfig): string {
  if (locale === "ar") {
    return `تخفيضات ${promo.percent}% على كل المواقع — استخدم كوبون الشراء ${promo.code} عند الدفع`;
  }
  return `${promo.percent}% off every website — use purchase coupon ${promo.code} at checkout`;
}
