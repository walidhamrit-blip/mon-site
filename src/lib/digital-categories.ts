import type { DigitalKind, DigitalProduct } from "./digital-types";
import { sortByDemand } from "./digital-priority";

/** Separate namespace: never competes with /codes/[slug] product URLs. */
export const digitalCategories = [
  {
    kind: "gift_card", en: "Gift cards", ar: "بطاقات هدايا",
    descriptionEn: "Browse digital gift cards by platform and region. Compare available amounts and check account compatibility before receiving your code by email.",
    descriptionAr: "تصفح بطاقات الهدايا الرقمية حسب المنصة والمنطقة. قارن القيم المتاحة وتحقق من توافق حسابك قبل استلام الكود بالبريد الإلكتروني.",
  },
  {
    kind: "game_topup", en: "Game top-ups", ar: "شحن الألعاب",
    descriptionEn: "Explore game top-ups and in-game currency. Check the game, region and player ID requirements before ordering a direct recharge to your account.",
    descriptionAr: "تصفح شحن الألعاب والعملات داخل اللعبة. تحقق من اللعبة والمنطقة ومتطلبات معرّف اللاعب قبل طلب الشحن المباشر إلى حسابك.",
  },
  {
    kind: "software_key", en: "Game & software keys", ar: "مفاتيح ألعاب وبرامج",
    descriptionEn: "Browse game and software activation keys. Check the platform, licence details and region on each product before ordering your digital key by email.",
    descriptionAr: "تصفح مفاتيح تفعيل الألعاب والبرامج. تحقق من المنصة وتفاصيل الترخيص والمنطقة في صفحة المنتج قبل طلب مفتاحك الرقمي بالبريد الإلكتروني.",
  },
  {
    kind: "subscription_code", en: "Subscription codes", ar: "أكواد الاشتراكات",
    descriptionEn: "Explore digital subscription codes. Compare services, durations and supported regions, then check activation requirements before ordering a code by email.",
    descriptionAr: "تصفح أكواد الاشتراكات الرقمية. قارن الخدمات والمدد والمناطق المدعومة وتحقق من متطلبات التفعيل قبل طلب الكود بالبريد الإلكتروني.",
  },
] as const satisfies ReadonlyArray<{ kind: DigitalKind; en: string; ar: string; descriptionEn: string; descriptionAr: string }>;

export const CATEGORY_PAGE_SIZE = 24;

export function getDigitalCategory(kind: string) {
  return digitalCategories.find((category) => category.kind === kind);
}

export function categoryHref(kind: DigitalKind, page = 1) {
  const path = `/codes/category/${kind}`;
  return page === 1 ? path : `${path}?page=${page}`;
}

/** Reject ambiguous/repeated and non-integer parameters rather than indexing aliases. */
export function parseCategoryPage(value: string | string[] | undefined): number | null {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : null;
}

export function categoryProducts(products: DigitalProduct[], kind: DigitalKind, page = 1) {
  const matching = sortByDemand(products.filter((product) => product.kind === kind));
  return {
    total: matching.length,
    pageCount: Math.max(1, Math.ceil(matching.length / CATEGORY_PAGE_SIZE)),
    products: matching.slice((page - 1) * CATEGORY_PAGE_SIZE, page * CATEGORY_PAGE_SIZE),
  };
}

/** First pages remain useful category guides even when a family is temporarily empty. */
export function categorySitemapPaths(products: DigitalProduct[], degraded: boolean) {
  return digitalCategories.flatMap(({ kind }) => {
    const pageCount = degraded ? 1 : categoryProducts(products, kind).pageCount;
    return Array.from({ length: pageCount }, (_, index) => categoryHref(kind, index + 1));
  });
}
