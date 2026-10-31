import type { Faq } from "./site-types";

/** Shared labels: the same four destinations on desktop and mobile. */
export const primaryNavigation = [
  { href: "/", ar: "الرئيسية", en: "Home" },
  { href: "/codes", ar: "المتجر الرقمي", en: "Digital store" },
  { href: "/creation-sites", ar: "إنشاء المواقع", en: "Website creation" },
  { href: "/contact", ar: "تواصل معنا", en: "Contact" },
] as const;

// Facets, not SEO landing pages: /codes remains the canonical catalogue.
// The supplier classifies game keys and software together as software_key.
export const storeCategories = [
  { kind: "all", ar: "الكل", en: "All products" },
  { kind: "gift_card", ar: "بطاقات هدايا", en: "Gift cards" },
  { kind: "software_key", ar: "مفاتيح ألعاب وبرامج", en: "Game & software keys" },
  { kind: "game_topup", ar: "شحن الألعاب", en: "Game top-ups" },
  { kind: "subscription_code", ar: "اشتراكات", en: "Subscriptions" },
] as const;

export const homeFaqs: Faq[] = [
  { qAr: "ماذا تقدم نخبة؟", qEn: "What does Nukhba offer?", aAr: "مساران واضحان: إنشاء مواقع ومتاجر إلكترونية حسب الطلب، ومتجر رقمي لبطاقات الهدايا ومفاتيح الألعاب والبرامج وشحن الألعاب حسب التوفر.", aEn: "Two separate services: custom websites and online stores, and a digital shop for available gift cards, game and software keys, and game top-ups." },
  { qAr: "كيف أبدأ مشروع موقع؟", qEn: "How do I start a website project?", aAr: "انتقل إلى إنشاء المواقع، راجع العروض والأمثلة ثم أرسل احتياجاتك لطلب عرض سعر. تفاصيل النطاق والتكلفة تُراجع قبل بدء المشروع.", aEn: "Visit Website creation, review the offers and examples, then send your requirements for a quote. Scope and costs are reviewed before the project starts." },
  { qAr: "كيف أختار بطاقة أو مفتاح لعبة؟", qEn: "How do I choose a gift card or game key?", aAr: "افتح المتجر الرقمي واختر الفئة، ثم تحقق من المنصة والمنطقة والقيمة وتعليمات التفعيل في صفحة المنتج قبل الطلب. عند الصيانة، تواصل معنا للتحقق من التوفر.", aEn: "Open the Digital store and choose a category. Check the platform, region, value and activation instructions on the product page before ordering. During maintenance, contact us to check availability." },
];
