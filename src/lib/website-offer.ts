import type { PricingPlanData } from "@/lib/site-types";

/** Commercial source of truth. Historical orders keep their stored amounts. */
export const WEBSITE_BASE_PLAN_ID = "static-site";
export const WEBSITE_BASE_PRICE_USD = 35;
export const WEBSITE_LANGUAGE_PRICE_USD = 10;
export const WEBSITE_CONTENT_FROM_USD = 10;

export const websiteBasePlan: PricingPlanData = {
  id: WEBSITE_BASE_PLAN_ID,
  name: "موقعك المخصص",
  nameEn: "Your personalized website",
  priceUsd: WEBSITE_BASE_PRICE_USD,
  customizationPercent: 0,
  period: "/ دفعة واحدة",
  periodEn: "/ one-time",
  description: "كل التصاميم بنفس السعر — أضف الوظائف حسب حاجتك، لا حسب التصميم.",
  descriptionEn: "Every design at the same price — add functions for your needs, not for the design.",
  featured: true,
  badge: "عرض موحد",
  badgeEn: "One base offer",
  cta: "اشترِ الموقع الأساسي",
  ctaEn: "Buy the base website",
  features: [
    "الكود المصدري للنموذج المختار",
    "لغة واحدة وتصميم متجاوب مع جميع الأجهزة",
    "تخصيص المحتوى عند التسليم الأول مجاناً: شعارك ونصوصك وصورك وبياناتك التي تقدمها، ضمن صفحات وأقسام النموذج",
    "نشر على عنوان vercel.app مجاناً، وفق أهلية وحدود خطة Vercel المستخدمة",
    "روابط واتساب والهاتف والبريد والشبكات الاجتماعية",
    "بدون قاعدة بيانات أو لوحة إدارة؛ الطلبات والحجوزات عبر واتساب تعالج يدوياً",
  ],
  featuresEn: [
    "Source code of your chosen model",
    "One language and a responsive layout for all devices",
    "Free initial content personalization: your supplied logo, text, images and contact details within the model’s existing pages and sections",
    "Free deployment to a vercel.app address, subject to the eligibility and limits of the Vercel plan used",
    "WhatsApp, phone, email and social links",
    "No database or admin panel; WhatsApp orders and booking requests are handled manually",
  ],
};

export const websiteOptions = [
  { id: "language", nameAr: "لغة إضافية", nameEn: "Additional language", priceUsd: WEBSITE_LANGUAGE_PRICE_USD, from: false,
    detailAr: "لكل لغة، مع محدد اللغة. الترجمة يقدمها العميل؛ النطاق يؤكد قبل الدفع.",
    detailEn: "Per language, including a language selector. Translation supplied by you; scope confirmed before payment." },
  { id: "content", nameAr: "إدارة المحتوى", nameEn: "Content management", priceUsd: WEBSITE_CONTENT_FROM_USD, from: true,
    detailAr: "تعديل النصوص والصور والمحتوى المتفق عليه، مع قاعدة البيانات ولوحة الإدارة اللازمة. النطاق يحدد في عرض السعر.",
    detailEn: "Edit agreed text, images and content, including the required database and admin panel. Exact scope defined in your quote." },
  { id: "booking", nameAr: "إدارة الحجوزات", nameEn: "Booking management", priceUsd: null, from: false,
    detailAr: "قاعدة بيانات ولوحة إدارة للمواعيد والتوفر والتأكيد والإلغاء. لا تعني مجرد زر واتساب.",
    detailEn: "Database and admin tools for availability, appointments, confirmations and cancellations — not just a WhatsApp button." },
  { id: "store", nameAr: "متجر إلكتروني", nameEn: "Online store", priceUsd: null, from: false,
    detailAr: "قاعدة بيانات ولوحة إدارة للمنتجات والأسعار والطلبات؛ المخزون حسب الاتفاق. الدفع الإلكتروني خيار منفصل.",
    detailEn: "Database and admin tools for products, prices and orders; stock management as agreed. Online payment is separate." },
  { id: "payment", nameAr: "الدفع الإلكتروني", nameEn: "Online payment", priceUsd: null, from: false,
    detailAr: "ربط مزود دفع متوافق بعد تحديد مسار الطلب. رسوم المزود منفصلة.",
    detailEn: "Connect a compatible payment provider to an agreed ordering flow. Provider fees are separate." },
] as const;

export function websiteOfferSummary(locale: string): string {
  return locale === "ar"
    ? `عرض موحد ${WEBSITE_BASE_PRICE_USD} $: كود موقع ثابت، لغة واحدة، تخصيص المحتوى المقدم عند التسليم الأول مجاناً، ونشر على vercel.app وفق أهلية وحدود Vercel. بدون قاعدة بيانات أو لوحة إدارة. لغة إضافية ${WEBSITE_LANGUAGE_PRICE_USD} $ بترجمة يقدمها العميل؛ إدارة المحتوى من ${WEBSITE_CONTENT_FROM_USD} $ مع قاعدة بيانات ولوحة إدارة. الحجوزات والمتجر والدفع الإلكتروني بعرض سعر. لوحة مشتركة دون احتساب البنية الأساسية مرتين. الدومين المخصص والتكاليف الخارجية المتكررة غير مشمولة وتوضح قبل الموافقة. المدة تؤكد حسب النطاق وتوفر المحتوى.`
    : `One offer at $${WEBSITE_BASE_PRICE_USD}: static website source code, one language, free initial personalization with client-supplied content, and deployment to a vercel.app address subject to Vercel eligibility and limits. No database or admin panel. Additional language $${WEBSITE_LANGUAGE_PRICE_USD} with client-supplied translation; content management from $${WEBSITE_CONTENT_FROM_USD} including a database and admin panel. Booking, store and online payment are quoted. One shared admin foundation, never charged twice. Custom domains and external recurring fees are excluded and disclosed before approval. Timeline confirmed according to scope and content availability.`;
}

/** Shared qualifications used at purchase points, in guides and by the assistant. */
export function websiteTimelineNote(locale: string): string {
  return locale === "ar"
    ? "موعد التسليم يؤكد قبل الطلب حسب النطاق وتوفر المحتوى والوظائف المختارة."
    : "Delivery is confirmed before ordering according to scope, content availability and selected functions.";
}

export function websiteDemoNote(locale: string): string {
  return locale === "ar"
    ? "المعاينة تعرض إمكانات النموذج، وليست قائمة بما يشمله السعر الأساسي. العرض الأساسي بلغة واحدة وبدون قاعدة بيانات أو إدارة؛ الحجز والمتجر والدفع واللغات الإضافية تتطلب خيارات منفصلة."
    : "The demo shows the model’s possibilities, not everything included in the base price. The base offer has one language, no database and no admin; booking, store, payments and extra languages require separate options.";
}

export function websiteDepositNote(locale: string): string {
  return locale === "ar"
    ? "هل دفعت عربوناً؟ تواصل معنا مع مرجع الحجز لنؤكد ونفوتر الرصيد المتبقي بعد خصمه. لا تدفع السعر الكامل مرة أخرى؛ الدفع المباشر لا يخصم العربون تلقائياً."
    : "Already paid a deposit? Contact us with your reservation reference so we can confirm and invoice the remaining balance after crediting it. Do not pay the full price again: direct checkout does not automatically deduct a deposit.";
}

export function paymentAvailabilityNote(locale: string): string {
  return locale === "ar"
    ? "استخدم وسائل الدفع المتاحة فعلياً في صفحة الدفع: العملات الرقمية عبر NOWPayments أو التحويل اليدوي إذا كان مفعلاً. التحويل اليدوي يحتاج قبولاً بعد التحقق، وليس فورياً. سعر الفوترة بالدولار؛ التحويلات المعروضة بعملات أخرى تقديرية، ويظهر المبلغ النهائي وأي رسوم قبل الموافقة."
    : "Use the methods actually available at checkout: crypto through NOWPayments, or manual transfer when enabled. Manual transfers require verification and acceptance, not instant approval. Billing is in USD; display conversions are indicative, and the final amount and any fees are shown before approval.";
}
