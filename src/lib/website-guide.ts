import {
  WEBSITE_BASE_PRICE_USD,
  WEBSITE_CONTENT_FROM_USD,
  WEBSITE_LANGUAGE_PRICE_USD,
  websiteOptions,
} from "./website-offer";

export const MAX_GUIDE_LANGUAGES = 10;
export const MAX_GUIDE_NOTE = 800;
export type WebsiteGuideSelection = {
  updates: "code" | "admin" | "unsure";
  extraLanguages: number;
  booking: boolean;
  store: boolean;
  payment: boolean;
  contentHelp: boolean;
  customDomain: boolean;
  customRequest: boolean;
  note: string;
};

export const DEFAULT_WEBSITE_GUIDE: WebsiteGuideSelection = {
  updates: "code", extraLanguages: 0, booking: false, store: false, payment: false,
  contentHelp: false, customDomain: false, customRequest: false, note: "",
};

export type GuideLine = {
  id: string;
  ar: string;
  en: string;
  kind: "fixed" | "from" | "quote" | "bundled";
  amountUsd: number | null;
};

/** Pure indicative estimate. This is NEVER an order total or a checkout input. */
export function estimateWebsiteGuide(input: Partial<WebsiteGuideSelection>) {
  const extraLanguages = typeof input.extraLanguages === "number" && Number.isFinite(input.extraLanguages)
    ? Math.min(MAX_GUIDE_LANGUAGES, Math.max(0, Math.floor(input.extraLanguages))) : 0;
  const selection: WebsiteGuideSelection = {
    updates: input.updates === "admin" || input.updates === "unsure" ? input.updates : "code",
    extraLanguages,
    booking: input.booking === true, store: input.store === true, payment: input.payment === true,
    contentHelp: input.contentHelp === true, customDomain: input.customDomain === true,
    customRequest: input.customRequest === true,
    note: typeof input.note === "string" ? input.note.trim().slice(0, MAX_GUIDE_NOTE).replace(/[\uD800-\uDBFF]$/, "") : "",
  };
  const lines: GuideLine[] = [
    { id: "base", ar: "الموقع الثابت — لغة واحدة", en: "Static website — one language", kind: "fixed", amountUsd: WEBSITE_BASE_PRICE_USD },
    { id: "personalization", ar: "تخصيص محتواك عند التسليم الأول", en: "Initial personalization with your supplied content", kind: "fixed", amountUsd: 0 },
  ];
  if (extraLanguages > 0) lines.push({ id: "languages", ar: `${extraLanguages} لغة إضافية × $${WEBSITE_LANGUAGE_PRICE_USD}`, en: `${extraLanguages} extra language(s) × $${WEBSITE_LANGUAGE_PRICE_USD}`, kind: "fixed", amountUsd: extraLanguages * WEBSITE_LANGUAGE_PRICE_USD });

  const hasConnectedModule = selection.booking || selection.store || selection.payment;
  // Connected modules are quoted with their required foundation. Do not add the
  // separate "content from $10" foundation again when these are selected.
  if (selection.updates === "admin") lines.push({
    id: "content", ar: "إدارة المحتوى وقاعدة البيانات", en: "Content management & database",
    kind: hasConnectedModule ? "bundled" : "from",
    amountUsd: hasConnectedModule ? null : WEBSITE_CONTENT_FROM_USD,
  });
  for (const id of ["booking", "store", "payment"] as const) {
    if (!selection[id]) continue;
    const option = websiteOptions.find(item => item.id === id)!;
    lines.push({ id, ar: option.nameAr, en: option.nameEn, kind: "quote", amountUsd: null });
  }
  if (selection.contentHelp) lines.push({ id: "content-help", ar: "كتابة أو ترجمة أو إعداد المحتوى", en: "Copywriting, translation or content preparation", kind: "quote", amountUsd: null });
  if (selection.customDomain) lines.push({ id: "domain", ar: "الدومين الخاص وربطه — تكلفة خارجية منفصلة", en: "Custom domain & setup — separate external costs", kind: "quote", amountUsd: null });
  if (selection.customRequest || selection.note) lines.push({ id: "custom", ar: "طلب مخصص أو تغيير الهيكل أو صفحات جديدة", en: "Custom request, structural changes or new pages", kind: "quote", amountUsd: null });
  if (selection.updates === "unsure") lines.push({ id: "advice", ar: "تحديد نوع الإدارة المناسب مع الفريق", en: "Confirm the right management scope with our team", kind: "quote", amountUsd: null });
  const hasUnpricedOptions = lines.some(line => line.kind === "quote");
  const hasStartingPrice = lines.some(line => line.kind === "from");
  return {
    selection, lines, hasConnectedModule, hasUnpricedOptions, hasStartingPrice,
    requiresQuote: hasUnpricedOptions || hasStartingPrice,
    knownSubtotalUsd: lines.reduce((sum, line) => sum + (line.amountUsd ?? 0), 0),
  };
}

export function buildWebsiteGuideMessage(input: Partial<WebsiteGuideSelection>, locale: string): string {
  const result = estimateWebsiteGuide(input);
  const ar = locale === "ar";
  const lines = result.lines.map(line => {
    const amount = line.kind === "quote" ? (ar ? "بعرض سعر — غير محتسب" : "On quote — not counted")
      : line.kind === "bundled" ? (ar ? "ضمن عرض الوحدات، دون تكرار البنية الأساسية" : "Scoped in the module quote; foundation not charged twice")
      : `${line.kind === "from" ? (ar ? "من " : "From ") : ""}$${line.amountUsd} USD`;
    return `• ${ar ? line.ar : line.en}: ${amount}`;
  });
  const label = result.hasUnpricedOptions ? (ar ? "الجزء المعروف فقط، وليس إجمالي المشروع" : "Known portion only, not the project total")
    : result.hasStartingPrice ? (ar ? "تقدير يبدأ من" : "Indicative starting estimate") : (ar ? "تقدير إرشادي" : "Indicative estimate");
  return [
    ar ? "مرحباً، استخدمت دليل اختيار الموقع وأريد تأكيد النطاق والسعر." : "Hello, I used the website choice guide and would like to confirm the scope and price.",
    ...lines,
    `${label}: ${result.hasStartingPrice ? (ar ? "من " : "From ") : ""}$${result.knownSubtotalUsd} USD${result.hasUnpricedOptions ? (ar ? " + الخيارات غير المسعرة" : " + unpriced options") : ""}`,
    ar ? "طلبات واتساب تعالج يدوياً؛ إدارة الحجوزات والطلبات الفعلية تحتاج وحداتها. النشر على vercel.app وفق أهلية وحدود Vercel. التكاليف الخارجية والمتكررة منفصلة. هذا ليس عرض سعر نهائياً ولا طلب دفع." : "WhatsApp requests are handled manually; actual booking and order management require their modules. vercel.app deployment is subject to Vercel eligibility and limits. External and recurring costs are separate. This is not a final quote or a payment request.",
    ...(result.selection.note ? [ar ? `ملاحظاتي: ${result.selection.note}` : `My notes: ${result.selection.note}`] : []),
    ar ? "يرجى تأكيد السعر النهائي والمدة وأي رسوم متكررة قبل الدفع." : "Please confirm the final price, timing and any recurring fees before payment.",
  ].join("\n\n");
}
