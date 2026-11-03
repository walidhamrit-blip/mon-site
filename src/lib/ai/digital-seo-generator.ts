import {
  DIGITAL_KIND_LABELS,
  lowestPriceUsd,
  regionLabel,
  regionalOnlyRegions,
  type DigitalProduct,
  type DigitalProductFaqItem,
  type DigitalProductSeo,
} from "@/lib/digital-types";
import { productDisplayName } from "@/lib/digital-seo";
import type { UpcomingCatalogItem } from "@/lib/site-types";

export const DIGITAL_SEO_LIMITS = {
  seoTitle: 60,
  seoDescription: 155,
  imageAlt: 125,
} as const;

const BRAND_AR_MAP: ReadonlyArray<[RegExp, string]> = [
  [/\bplaystation\b|\bpsn\b/i, "بلايستيشن PlayStation"],
  [/\bsteam\b/i, "ستيم Steam"],
  [/\bxbox\b/i, "إكس بوكس Xbox"],
  [/\bpubg\b/i, "ببجي موبايل PUBG Mobile"],
  [/\bfree\s*fire\b/i, "فري فاير Free Fire"],
  [/\broblox\b/i, "روبلوكس Roblox"],
  [/\bgoogle\s*play\b/i, "جوجل بلاي Google Play"],
  [/\bapple\b|\bitunes\b/i, "آبل آيتونز Apple"],
  [/\bamazon\b/i, "أمازون Amazon"],
  [/\bspotify\b/i, "سبوتيفاي Spotify"],
  [/\bnetflix\b/i, "نتفليكس Netflix"],
  [/\bvalorant\b/i, "فالورانت Valorant"],
  [/\bfortnite\b/i, "فورتنايت Fortnite"],
  [/\bminecraft\b/i, "ماينكرافت Minecraft"],
  [/\bgenshin\b/i, "قنشن إمباكت Genshin Impact"],
  [/\bmobile\s*legends\b|\bmlbb\b/i, "موبايل ليجندز Mobile Legends"],
  [/\brazer\b/i, "ريزر قولد Razer Gold"],
  [/\bdiscord\b/i, "ديسكورد Discord"],
  [/\bnintendo\b/i, "نينتندو Nintendo"],
  [/\btiktok\b/i, "تيك توك TikTok"],
  [/\btelegram\b/i, "تيليجرام Telegram"],
];

function clampWords(raw: string, max: number): string {
  const clean = (raw ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace >= Math.floor(max * 0.6) ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[\s—–\-|,،.:;]+$/, "")}…`;
}

function fitBrandTitle(base: string, locale: "ar" | "en"): string {
  const suffix = locale === "ar" ? " | نخبة" : " | Nukhba";
  const clean = base.replace(/\s*\|\s*(?:nukhba|نخبة).*$/i, "").trim();
  if (clean.length + suffix.length <= DIGITAL_SEO_LIMITS.seoTitle) {
    return `${clean}${suffix}`;
  }
  if (clean.length <= DIGITAL_SEO_LIMITS.seoTitle) {
    return clean;
  }
  return clampWords(clean, DIGITAL_SEO_LIMITS.seoTitle);
}

function arabicBrandLabel(enName: string, arFallback: string): string {
  const source = `${enName} ${arFallback}`;
  for (const [pattern, label] of BRAND_AR_MAP) {
    if (pattern.test(source)) return label;
  }
  // Si le nom arabe nettoyé contient déjà de l'arabe distinct, on le garde.
  if (/[\u0600-\u06FF]/.test(arFallback)) return arFallback;
  return enName || arFallback;
}

export interface DigitalSeoOptimizationOptions {
  /**
   * Réécrit aussi les textes éditoriaux visibles (`titleAr`, `titleEn`,
   * `descriptionAr`, `descriptionEn`, `featuresAr`, `featuresEn`,
   * `deliveryNoteAr`, `deliveryNoteEn`). Activé par défaut.
   */
  rewriteEditorial?: boolean;
}

export interface DigitalSeoOptimizationResult {
  source: "openai" | "template";
  model?: string;
  product: DigitalProduct;
}

/**
 * Moteur déterministe SEO + GEO pour une fiche de la boutique `/codes`.
 *
 * Respecte strictement les règles d'audit SEO/GEO :
 *  - A01 : région explicite dans H1 et <title> pour les fiches régionales ;
 *  - A02 : `game_topup` = crédit direct sur Player ID (aucun code par e-mail),
 *          `gift_card` / `software_key` / `subscription_code` = code livré par e-mail ;
 *  - A10 / A11 : uniquement des faits vérifiables tirés de la fiche (montants,
 *          prix de départ en USD, parité 1 USD = 1 USDT, régions réelles).
 */
export function templateDigitalSeoGeo(
  product: DigitalProduct,
  options: DigitalSeoOptimizationOptions = {},
): DigitalProduct {
  const rewriteEditorial = options.rewriteEditorial !== false;
  const cleanEn = productDisplayName(product, "en") || product.platform || product.titleEn;
  const cleanArRaw = productDisplayName(product, "ar") || product.titleAr || cleanEn;
  const brandAr = arabicBrandLabel(cleanEn, cleanArRaw);
  const platform = product.platform?.trim() || cleanEn;

  const closedRegions = regionalOnlyRegions(product.regions);
  const isRegional = closedRegions.length > 0;
  const regionAr = isRegional
    ? closedRegions.map((r) => regionLabel(r, "ar")).join("، ")
    : "عالمي";
  const regionEn = isRegional
    ? closedRegions.map((r) => regionLabel(r, "en")).join(", ")
    : "Global";
  const regionCodeLabel = isRegional ? closedRegions.join("/") : "GLOBAL";

  const availableDenoms = (product.denominations ?? []).filter(
    (d) => d.available && Number.isFinite(d.priceUsd) && d.priceUsd > 0,
  );
  const fromUsd = lowestPriceUsd(product);
  const denomSample = availableDenoms
    .slice(0, 5)
    .map((d) => d.label)
    .join(" · ");

  const kindLabelAr = DIGITAL_KIND_LABELS[product.kind].ar;
  const kindLabelEn = DIGITAL_KIND_LABELS[product.kind].en;

  // Titres éditoriaux propres et naturels
  const editorialTitleEn = (() => {
    const suffix = isRegional ? ` (${regionEn})` : "";
    switch (product.kind) {
      case "game_topup":
        return `${cleanEn} Top-Up${suffix}`;
      case "gift_card":
        return /\bgift\s*card\b/i.test(cleanEn)
          ? `${cleanEn}${suffix}`
          : `${cleanEn} Gift Card${suffix}`;
      case "software_key":
        return /\bkey\b/i.test(cleanEn) ? `${cleanEn}${suffix}` : `${cleanEn} Activation Key${suffix}`;
      case "subscription_code":
        return `${cleanEn} Subscription Code${suffix}`;
    }
  })();

  const editorialTitleAr = (() => {
    const suffix = isRegional ? ` (${regionAr})` : "";
    switch (product.kind) {
      case "game_topup":
        return /^شحن\b/.test(brandAr) ? `${brandAr}${suffix}` : `شحن ${brandAr}${suffix}`;
      case "gift_card":
        return /^بطاقة\b/.test(brandAr)
          ? `${brandAr}${suffix}`
          : `بطاقة هدايا ${brandAr}${suffix}`;
      case "software_key":
        return /^مفتاح\b|^كود\b/.test(brandAr)
          ? `${brandAr}${suffix}`
          : `مفتاح تفعيل ${brandAr}${suffix}`;
      case "subscription_code":
        return /^اشتراك\b|^كود\b/.test(brandAr)
          ? `${brandAr}${suffix}`
          : `كود اشتراك ${brandAr}${suffix}`;
    }
  })();

  // Descriptions éditoriales riches (A02 respecté)
  const pricePhraseAr =
    fromUsd != null ? `بأسعار تبدأ من ${fromUsd.toFixed(2)} دولار أمريكي` : "بأسعار معلنة بالدولار الأمريكي";
  const pricePhraseEn =
    fromUsd != null ? `starting at $${fromUsd.toFixed(2)} USD` : "priced transparently in USD";

  const editorialDescAr =
    product.kind === "game_topup"
      ? `${editorialTitleAr} ${pricePhraseAr} (1 دولار = 1 USDT)${denomSample ? ` — باقات متوفرة: ${denomSample}` : ""}. يُشحن الرصيد مباشرة إلى حسابك في ${platform} عبر معرّف اللاعب (Player ID) فور تأكيد الدفع الرقمي دون الحاجة لكلمة المرور أو انتظار كود بريد.`
      : `${editorialTitleAr} أصلية ${pricePhraseAr} (1 دولار = 1 USDT)${denomSample ? ` — فئات متوفرة: ${denomSample}` : ""}. ${isRegional ? `مخصّصة لحسابات منطقة ${regionAr}.` : "صالحة للتفعيل العالمي حسب شروط المنصة."} يُسلَّم الكود إلكترونياً إلى بريدك وصفحة متابعة الطلب فور تأكيد الدفع.`;

  const editorialDescEn =
    product.kind === "game_topup"
      ? `Order ${editorialTitleEn} ${pricePhraseEn} (1 USD = 1 USDT)${denomSample ? ` — available bundles: ${denomSample}` : ""}. Credit is applied directly to your ${platform} account via Player ID right after crypto payment confirmation — no password needed and no email code required.`
      : `Buy genuine ${editorialTitleEn} ${pricePhraseEn} (1 USD = 1 USDT)${denomSample ? ` — denominations: ${denomSample}` : ""}. ${isRegional ? `Valid on ${regionEn} region accounts.` : "Worldwide activation per platform terms."} Your digital code is delivered by email and on the order tracking page right after payment confirmation.`;

  const editorialFeaturesAr =
    product.kind === "game_topup"
      ? [
          `شحن مباشر على معرّف اللاعب (Player ID) في ${platform}`,
          "دفع فوري بعملة USDT (1 دولار = 1 USDT) وعملات رقمية أخرى",
          isRegional ? `مخصّص لمنطقة الحساب: ${regionAr}` : "متوافق مع الحسابات العالمية",
          "لا نطلب كلمة مرور حسابك نهائياً",
        ]
      : [
          "تسليم إلكتروني للكود عبر البريد وصفحة الطلب بعد تأكيد الدفع",
          "دفع بعملة USDT (1 دولار = 1 USDT) بدون بطاقة بنكية دولية",
          isRegional ? `يعمل على حسابات منطقة ${regionAr} فقط` : "كود أصلي من الموزّع الرسمي",
          "استبدال مضمون خلال 48 ساعة في حال وجود خلل بالكود",
        ];

  const editorialFeaturesEn =
    product.kind === "game_topup"
      ? [
          `Direct credit to your ${platform} Player ID`,
          "Pay in USDT (1 USD = 1 USDT) and major cryptocurrencies",
          isRegional ? `For ${regionEn} region accounts` : "Compatible with global accounts",
          "Account password is never requested",
        ]
      : [
          "Electronic code delivery by email & order page after payment",
          "Pay with USDT (1 USD = 1 USDT) — no international bank card needed",
          isRegional ? `Region-locked to ${regionEn} accounts` : "Genuine code from official distributor",
          "48-hour replacement guarantee if a code arrives invalid",
        ];

  const editorialDeliveryAr =
    product.kind === "game_topup"
      ? `يُشحن الرصيد تلقائياً ومباشرة إلى معرّف اللاعب في ${platform} بعد تأكيد الدفع — عادةً خلال دقائق (لا يُرسل كود بالبريد).`
      : "يُرسل الكود الرقمي إلى بريدك الإلكتروني ويظهر في صفحة متابعة الطلب مباشرة بعد تأكيد الدفع — عادةً خلال دقائق.";

  const editorialDeliveryEn =
    product.kind === "game_topup"
      ? `Credited automatically to your ${platform} Player ID after payment confirmation — typically within minutes (no email code).`
      : "Your digital code is emailed and shown on the order tracking page right after payment confirmation — typically within minutes.";

  // H1 & Meta Title (≤ 60 car.)
  const h1Ar = editorialTitleAr;
  const h1En = editorialTitleEn;

  const rawSeoTitleAr =
    fromUsd != null
      ? `${editorialTitleAr} — من $${fromUsd.toFixed(2)}`
      : `${editorialTitleAr} — تسليم فوري`;
  const rawSeoTitleEn =
    fromUsd != null
      ? `${editorialTitleEn} — From $${fromUsd.toFixed(2)}`
      : `${editorialTitleEn} — Instant USDT`;

  const seoTitleAr = fitBrandTitle(rawSeoTitleAr, "ar");
  const seoTitleEn = fitBrandTitle(rawSeoTitleEn, "en");

  // Meta Description (≤ 155 car.)
  const seoDescriptionAr = clampWords(
    product.kind === "game_topup"
      ? `${editorialTitleAr}${fromUsd != null ? ` من ${fromUsd.toFixed(2)}$` : ""}. النطاق: ${regionAr}. شحن مباشر على معرّف اللاعب بعد الدفع بـ USDT (1$=1 USDT).`
      : `${editorialTitleAr}${fromUsd != null ? ` من ${fromUsd.toFixed(2)}$` : ""}. النطاق: ${regionAr}. تسليم الكود بالبريد فور تأكيد الدفع بـ USDT (1$=1 USDT).`,
    DIGITAL_SEO_LIMITS.seoDescription,
  );

  const seoDescriptionEn = clampWords(
    product.kind === "game_topup"
      ? `${editorialTitleEn}${fromUsd != null ? ` from $${fromUsd.toFixed(2)}` : ""}. Region: ${regionEn}. Direct Player ID credit after USDT payment (1 USD = 1 USDT).`
      : `${editorialTitleEn}${fromUsd != null ? ` from $${fromUsd.toFixed(2)}` : ""}. Region: ${regionEn}. Email code delivery after USDT payment (1 USD = 1 USDT).`,
    DIGITAL_SEO_LIMITS.seoDescription,
  );

  // Alt image (≤ 125 car.)
  const imageAltAr = clampWords(
    `${editorialTitleAr} — متجر نخبة للأكواد والبطاقات الرقمية`,
    DIGITAL_SEO_LIMITS.imageAlt,
  );
  const imageAltEn = clampWords(
    `${editorialTitleEn} — Nukhba digital codes & gift cards store`,
    DIGITAL_SEO_LIMITS.imageAlt,
  );

  // Résumé GEO Answer-First (optimisé pour citations IA : ChatGPT, Perplexity, AI Overviews)
  const geoSummaryAr =
    product.kind === "game_topup"
      ? `ملخص سريع: ${editorialTitleAr} هي خدمة ${kindLabelAr} لمنصة ${platform} (${isRegional ? `منطقة ${regionAr}` : "نطاق عالمي"})${fromUsd != null ? ` تبدأ من ${fromUsd.toFixed(2)} دولار أمريكي` : ""}${denomSample ? ` وتشمل الباقات (${denomSample})` : ""}. يتم الدفع بالعملات الرقمية بمساواة 1 دولار = 1 USDT عبر NOWPayments، ويُضاف الرصيد مباشرة إلى معرّف اللاعب (Player ID) بعد تأكيد الدفع دون إرسال كود بريدي.`
      : `ملخص سريع: ${editorialTitleAr} (${kindLabelAr} لمنصة ${platform} — ${isRegional ? `منطقة ${regionAr}` : "تفعيل عالمي"})${fromUsd != null ? ` متوفرة ابتداءً من ${fromUsd.toFixed(2)} دولار أمريكي` : ""}${denomSample ? ` بالفئات (${denomSample})` : ""}. يُسدد الطلب بالعملات الرقمية (1 دولار = 1 USDT) عبر NOWPayments، ويُرسل الكود الأصلي إلكترونياً إلى البريد الإلكتروني وصفحة تتبع الطلب فور تأكيد الشبكة.`;

  const geoSummaryEn =
    product.kind === "game_topup"
      ? `Quick facts: ${editorialTitleEn} is an on-demand ${kindLabelEn.toLowerCase()} for ${platform} (${isRegional ? `${regionEn} accounts` : "global accounts"})${fromUsd != null ? ` starting at $${fromUsd.toFixed(2)} USD` : ""}${denomSample ? ` with bundles (${denomSample})` : ""}. Checkout settles in crypto at 1 USD = 1 USDT via NOWPayments, and the balance is credited directly to the buyer's ${platform} Player ID after payment confirmation (no email code).`
      : `Quick facts: ${editorialTitleEn} is an official ${kindLabelEn.toLowerCase()} for ${platform} (${isRegional ? `region-locked to ${regionEn}` : "worldwide region"})${fromUsd != null ? ` starting at $${fromUsd.toFixed(2)} USD` : ""}${denomSample ? ` in denominations (${denomSample})` : ""}. Orders settle in crypto at 1 USD = 1 USDT via NOWPayments, with electronic code delivery by email and order tracking right after payment confirmation.`;

  const keywordsAr = Array.from(
    new Set(
      [
        editorialTitleAr,
        `شراء ${editorialTitleAr}`,
        `${brandAr} ليبيا`,
        `${brandAr} USDT`,
        `${kindLabelAr} ${platform}`,
        isRegional ? `${platform} ${regionAr}` : `${platform} عالمي`,
        `متجر أكواد ${platform}`,
        "بطاقات هدايا رقمية",
      ].filter(Boolean),
    ),
  );

  const keywordsEn = Array.from(
    new Set(
      [
        editorialTitleEn,
        `buy ${editorialTitleEn}`,
        `${cleanEn} USDT`,
        `${cleanEn} crypto`,
        `${platform} ${kindLabelEn.toLowerCase()}`,
        `${platform} ${regionCodeLabel}`,
        `${cleanEn} instant delivery`,
        "digital gift cards store",
      ].filter(Boolean),
    ),
  );

  const redeemStepsAr =
    product.kind === "game_topup"
      ? [
          `اختر الباقة المناسبة لحسابك في ${platform}${isRegional ? ` (تأكد أن الحساب مسجّل في ${regionAr})` : ""}.`,
          `أدخل معرّف اللاعب (Player ID) الخاص بك في ${platform} بدقة في نافذة الطلب.`,
          "أكمل الدفع بالدولار الرقمي USDT (1 دولار = 1 USDT) عبر فاتورة NOWPayments الآمنة.",
          `يُضاف الرصيد تلقائياً إلى حسابك داخل ${platform} خلال دقائق من تأكيد الدفع.`,
        ]
      : [
          `اختر الفئة المطلوبة من ${editorialTitleAr}${isRegional ? ` وتحقّق أن منطقة حسابك هي ${regionAr}` : ""}.`,
          "أدخل بريدك الإلكتروني الصحيح وأكمل الدفع بعملة USDT (1 دولار = 1 USDT).",
          "استلم الكود الرقمي فور تأكيد الدفع عبر البريد الإلكتروني أو من صفحة تتبّع الطلب.",
          `افتح حسابك في ${platform} وانتقل إلى قسم استرداد الأكواد (Redeem) وأدخل الكود لتفعيل الرصيد.`,
        ];

  const redeemStepsEn =
    product.kind === "game_topup"
      ? [
          `Select your ${platform} bundle${isRegional ? ` (verify your account region is ${regionEn})` : ""}.`,
          `Enter your exact ${platform} Player ID in the checkout dialog.`,
          "Complete crypto payment in USDT (1 USD = 1 USDT) via the hosted NOWPayments invoice.",
          `Your ${platform} account is credited automatically within minutes of payment confirmation.`,
        ]
      : [
          `Choose your ${editorialTitleEn} amount${isRegional ? ` and confirm your account region is ${regionEn}` : ""}.`,
          "Enter a valid email address and pay in USDT (1 USD = 1 USDT) via NOWPayments.",
          "Receive your activation code by email and on the order tracking page right after confirmation.",
          `Sign in to ${platform}, open the Redeem section, and paste the code to apply your balance.`,
        ];

  const faqs: DigitalProductFaqItem[] = [
    {
      qAr: `كيف أستلم ${editorialTitleAr} بعد إتمام الدفع؟`,
      aAr: editorialDeliveryAr,
      qEn: `How do I receive ${editorialTitleEn} after payment?`,
      aEn: editorialDeliveryEn,
    },
    ...(product.kind === "game_topup"
      ? [
          {
            qAr: `ما البيانات المطلوبة لشحن ${platform}؟`,
            aAr: `نحتاج فقط إلى معرّف اللاعب (Player ID) والسيرفر/المنطقة إن وجدت. لا نطلب كلمة المرور إطلاقاً، وتأكد من صحة المعرّف لأن الشحن المباشر غير قابل للإلغاء.`,
            qEn: `What information is required to top up ${platform}?`,
            aEn: `Only your ${platform} Player ID (and server/zone if prompted). We never ask for your password — double-check the ID as direct top-ups are irreversible.`,
          },
        ]
      : []),
    {
      qAr: `هل تعمل ${editorialTitleAr} على أي حساب؟`,
      aAr: isRegional
        ? `هذه الفئة إقليمية ومخصّصة للحسابات المسجّلة في منطقة ${regionAr} فقط. تحقّق من منطقة حسابك في ${platform} قبل الشراء.`
        : `نعم، هذه الفئة عالمية وتعمل على الحسابات المتوافقة مع شروط ${platform} القياسية.`,
      qEn: `Does ${editorialTitleEn} work on any account region?`,
      aEn: isRegional
        ? `No — this item is region-locked to ${regionEn} accounts on ${platform}. Please verify your account region before purchasing.`
        : `Yes — this item is tagged for global use according to standard ${platform} account rules.`,
    },
    {
      qAr: "ما الفئات المتاحة وطريقة الدفع؟",
      aAr: `${denomSample ? `الفئات المتوفرة تشمل: ${denomSample}` : "تظهر جميع الفئات المتاحة أعلى الصفحة"}${fromUsd != null ? ` وتبدأ من ${fromUsd.toFixed(2)} دولار` : ""}. يتم الدفع بالعملات الرقمية (1 دولار = 1 USDT) بدون رسوم خفية.`,
      qEn: "Which denominations and payment methods are supported?",
      aEn: `${denomSample ? `Available options include: ${denomSample}` : "All active options are listed above"}${fromUsd != null ? `, starting at $${fromUsd.toFixed(2)} USD` : ""}. Checkout accepts USDT (1 USD = 1 USDT) and major cryptocurrencies with no hidden fees.`,
    },
    {
      qAr: "ماذا أفعل إذا واجهت مشكلة في الكود أو الشحن؟",
      aAr: "الأكواد الرقمية والشحن المباشر نهائية بعد التنفيذ، لكن في حال وصول كود غير صالح أو تعذّر التنفيذ التلقائي، تواصل معنا عبر واتساب خلال 48 ساعة برقم الطلب ليتم التحقق والاستبدال.",
      qEn: "What if there is an issue with my code or top-up?",
      aEn: "Delivered codes and completed top-ups are non-refundable, but if a code arrives invalid or automatic fulfillment fails, contact us on WhatsApp within 48 hours with your order reference for verification and replacement.",
    },
  ];

  const seo: DigitalProductSeo = {
    seoTitleAr,
    seoTitleEn,
    seoDescriptionAr,
    seoDescriptionEn,
    h1Ar,
    h1En,
    imageAltAr,
    imageAltEn,
    keywordsAr,
    keywordsEn,
    geoSummaryAr,
    geoSummaryEn,
    redeemStepsAr,
    redeemStepsEn,
    faqs,
  };

  return {
    ...product,
    ...(rewriteEditorial
      ? {
          titleAr: editorialTitleAr,
          titleEn: editorialTitleEn,
          descriptionAr: editorialDescAr,
          descriptionEn: editorialDescEn,
          featuresAr: editorialFeaturesAr,
          featuresEn: editorialFeaturesEn,
          deliveryNoteAr: editorialDeliveryAr,
          deliveryNoteEn: editorialDeliveryEn,
        }
      : {}),
    seo,
  };
}

/**
 * Optimise le SEO & GEO d'une fiche produit de la boutique `/codes`.
 * Utilise OpenAI (`OPENAI_API_KEY`) si disponible pour affiner les textes
 * tout en respectant les garde-fous factuels, sinon utilise le moteur
 * déterministe `templateDigitalSeoGeo`.
 */
export async function optimizeDigitalProductSeoGeo(
  product: DigitalProduct,
  options: DigitalSeoOptimizationOptions = {},
): Promise<DigitalSeoOptimizationResult> {
  const templated = templateDigitalSeoGeo(product, options);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { source: "template", product: templated };
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
  const fromUsd = lowestPriceUsd(product);
  const closedRegions = regionalOnlyRegions(product.regions);
  const deliveryRule =
    product.kind === "game_topup"
      ? "Direct credit to Player ID after payment confirmation (NEVER mention email code delivery)."
      : "Electronic digital code delivered by email and order tracking page after payment confirmation.";

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an e-commerce SEO + GEO (Generative Engine Optimization) specialist for Nukhba (نخبة), a bilingual Arabic/English digital gift cards, game top-ups, and software keys store. " +
              "Return STRICT JSON with keys: titleAr, titleEn, descriptionAr, descriptionEn, seoTitleAr, seoTitleEn, seoDescriptionAr, seoDescriptionEn, h1Ar, h1En, imageAltAr, imageAltEn, geoSummaryAr, geoSummaryEn, keywordsAr (string[]), keywordsEn (string[]). " +
              "Rules: 1) Respect exact delivery rule provided. 2) Include account region in titles/H1 if region-locked. 3) Mention USD pricing and 1 USD = 1 USDT payment where natural. 4) NEVER invent ratings, review counts, or 24/7 support claims. 5) seoTitle <= 60 chars, seoDescription <= 155 chars, imageAlt <= 125 chars.",
          },
          {
            role: "user",
            content: JSON.stringify({
              kind: product.kind,
              platform: product.platform,
              currentTitleAr: templated.titleAr,
              currentTitleEn: templated.titleEn,
              regions: closedRegions.length > 0 ? closedRegions : ["GLOBAL"],
              startingPriceUsd: fromUsd,
              denominations: (product.denominations ?? [])
                .filter((d) => d.available)
                .slice(0, 8)
                .map((d) => ({ label: d.label, region: d.region, priceUsd: d.priceUsd })),
              deliveryRule,
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return { source: "template", product: templated };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return { source: "template", product: templated };
    const parsed = JSON.parse(content) as Record<string, unknown>;

    const pickStr = (val: unknown, fallback: string) =>
      typeof val === "string" && val.trim().length > 0 ? val.trim() : fallback;
    const pickArr = (val: unknown, fallback: string[]) =>
      Array.isArray(val)
        ? val.map((v) => String(v ?? "").trim()).filter(Boolean)
        : fallback;

    const rewriteEditorial = options.rewriteEditorial !== false;
    const nextSeo: DigitalProductSeo = {
      ...templated.seo,
      seoTitleAr: fitBrandTitle(
        pickStr(parsed.seoTitleAr, templated.seo?.seoTitleAr ?? ""),
        "ar",
      ),
      seoTitleEn: fitBrandTitle(
        pickStr(parsed.seoTitleEn, templated.seo?.seoTitleEn ?? ""),
        "en",
      ),
      seoDescriptionAr: clampWords(
        pickStr(parsed.seoDescriptionAr, templated.seo?.seoDescriptionAr ?? ""),
        DIGITAL_SEO_LIMITS.seoDescription,
      ),
      seoDescriptionEn: clampWords(
        pickStr(parsed.seoDescriptionEn, templated.seo?.seoDescriptionEn ?? ""),
        DIGITAL_SEO_LIMITS.seoDescription,
      ),
      h1Ar: pickStr(parsed.h1Ar, templated.seo?.h1Ar ?? templated.titleAr),
      h1En: pickStr(parsed.h1En, templated.seo?.h1En ?? templated.titleEn),
      imageAltAr: clampWords(
        pickStr(parsed.imageAltAr, templated.seo?.imageAltAr ?? ""),
        DIGITAL_SEO_LIMITS.imageAlt,
      ),
      imageAltEn: clampWords(
        pickStr(parsed.imageAltEn, templated.seo?.imageAltEn ?? ""),
        DIGITAL_SEO_LIMITS.imageAlt,
      ),
      geoSummaryAr: pickStr(parsed.geoSummaryAr, templated.seo?.geoSummaryAr ?? ""),
      geoSummaryEn: pickStr(parsed.geoSummaryEn, templated.seo?.geoSummaryEn ?? ""),
      keywordsAr: pickArr(parsed.keywordsAr, templated.seo?.keywordsAr ?? []).slice(0, 15),
      keywordsEn: pickArr(parsed.keywordsEn, templated.seo?.keywordsEn ?? []).slice(0, 15),
    };

    return {
      source: "openai",
      model,
      product: {
        ...templated,
        ...(rewriteEditorial
          ? {
              titleAr: pickStr(parsed.titleAr, templated.titleAr),
              titleEn: pickStr(parsed.titleEn, templated.titleEn),
              descriptionAr: pickStr(parsed.descriptionAr, templated.descriptionAr),
              descriptionEn: pickStr(parsed.descriptionEn, templated.descriptionEn),
            }
          : {
              titleAr: product.titleAr,
              titleEn: product.titleEn,
              descriptionAr: product.descriptionAr,
              descriptionEn: product.descriptionEn,
              featuresAr: product.featuresAr,
              featuresEn: product.featuresEn,
              deliveryNoteAr: product.deliveryNoteAr,
              deliveryNoteEn: product.deliveryNoteEn,
            }),
        seo: nextSeo,
      },
    };
  } catch {
    return { source: "template", product: templated };
  }
}

/**
 * Optimise également les fiches du catalogue vitrine `/apps` & `/products`
 * (`/admin/catalog`) pour le SEO & GEO bilingue.
 */
export function optimizeUpcomingCatalogItemSeoGeo(
  item: UpcomingCatalogItem,
  section: "appsPage" | "productsPage",
): UpcomingCatalogItem {
  const titleEn = item.titleEn.trim() || "Digital Solution";
  const titleAr = item.titleAr.trim() || "حل رقمي";
  const platforms = item.platforms.filter(Boolean).join(", ") || "Web, iOS, Android";
  const priceAr =
    item.priceHintUsd != null && item.priceHintUsd > 0
      ? ` بسعر تقديري يبدأ من ${item.priceHintUsd} دولار (1 دولار = 1 USDT)`
      : "";
  const priceEn =
    item.priceHintUsd != null && item.priceHintUsd > 0
      ? `, starting around $${item.priceHintUsd} USD (1 USD = 1 USDT)`
      : "";

  const kindAr = section === "appsPage" ? "تطبيق سحابي متكامل" : "منتج برمجي جاهز للأعمال";
  const kindEn =
    section === "appsPage" ? "turnkey mobile & web application" : "cloud software product";

  const descriptionAr = `${titleAr} — ${kindAr} من نخبة مصمّم للشركات والمتاجر الحديثة (${platforms})${priceAr}. يدعم العربية الكاملة (RTL) والإنجليزية مع سرعة فائقة وتهيئة لمحركات البحث والذكاء الاصطناعي (SEO + GEO).`;
  const descriptionEn = `${titleEn} — ${kindEn} by Nukhba built for modern businesses (${platforms})${priceEn}. Features full Arabic (RTL) and English support, fast performance, and built-in SEO + GEO readiness.`;

  const featuresAr =
    item.featuresAr.filter(Boolean).length >= 3
      ? item.featuresAr
      : [
          "واجهة عربية (RTL) وإنجليزية متجاوبة بالكامل",
          `يعمل بسلاسة على منصات: ${platforms}`,
          "لوحة إدارة واضحة وتقارير فورية",
          "مهيّأ لمحركات البحث والذكاء الاصطناعي (SEO + GEO)",
        ];

  const featuresEn =
    item.featuresEn.filter(Boolean).length >= 3
      ? item.featuresEn
      : [
          "Full bilingual Arabic (RTL) & English responsive UI",
          `Supported platforms: ${platforms}`,
          "Clean management dashboard & real-time reporting",
          "Structured for Google & AI search engines (SEO + GEO)",
        ];

  return {
    ...item,
    categoryAr: item.categoryAr.trim() || (section === "appsPage" ? "تطبيقات أعمال" : "أنظمة برمجية"),
    categoryEn: item.categoryEn.trim() || (section === "appsPage" ? "Business Apps" : "Software Systems"),
    badgeAr: item.badgeAr.trim() || (item.status === "available" ? "متاح للطلب" : "قيد الإعداد"),
    badgeEn: item.badgeEn.trim() || (item.status === "available" ? "Available" : "In Preparation"),
    descriptionAr,
    descriptionEn,
    featuresAr,
    featuresEn,
  };
}
