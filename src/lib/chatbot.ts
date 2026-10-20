// Petit moteur de conversation pour l'assistant du site (sans IA externe,
// sans clé API). Chaque nœud = une question proposée + sa réponse + les
// questions de suivi pertinentes. Les réponses sont construites à partir
// des vraies données du site (formules tarifaires, coupon en cours) pour
// rester exactes si un prix change depuis l'administration.

import type { PricingPlan } from "@/lib/config";
import { formatLyd, lydLabel, resolvePlanPriceBreakdown } from "@/lib/classification";
import { formatMainPrice } from "@/lib/installments";
import { CURRENT_PROMO, discountedAmount, promoActive } from "@/lib/promotion";

export interface ChatNode {
  id: string;
  /** Libellé de la puce cliquable (la « question » proposée). */
  label: string;
  /** Réponse affichée dans la conversation. */
  answer: string;
  /** Nœuds proposés après cette réponse. */
  followUps: string[];
  /** Mots-clés pour reconnaître une question tapée au clavier. */
  keywords: string[];
  /** Bouton d'action optionnel (WhatsApp, page…). */
  action?: { label: string; href: string; external?: boolean };
}

export interface ChatContext {
  locale: string;
  plans: readonly PricingPlan[];
  currency: string;
  currencyEn: string;
  whatsappHref: string;
  reservationUsd: number;
  /** Horaires affichés dans la langue courante (source : réglages du site). */
  hours: string;
}

/** Question de départ proposées à l'ouverture. */
export const START_NODES = [
  "prices",
  "delivery",
  "custom",
  "promo",
] as const;

/** Nœuds de secours. */
export const FALLBACK_NODE = "unknown";

function price(amount: number, ctx: ChatContext) {
  return formatMainPrice(
    amount,
    ctx.locale === "ar" ? ctx.currency : ctx.currencyEn,
  );
}

function lyd(amount: number, ctx: ChatContext) {
  return `${formatLyd(amount)} ${lydLabel(ctx.locale)}`;
}

function planLine(plan: PricingPlan, ctx: ChatContext): string {
  const ar = ctx.locale === "ar";
  const breakdown = resolvePlanPriceBreakdown(plan);
  const model = breakdown.modelPriceUsd ?? 0;
  const customization = breakdown.customizationUsd;
  const line = breakdown.totalPriceUsd == null
    ? `• ${ar ? plan.name : plan.nameEn} — ${ar ? "النموذج" : "model"} ${price(model, ctx)} (≈ ${lyd(breakdown.modelPriceLyd, ctx)}) + ${ar ? "تخصيص بعرض سعر" : "customization quoted"}`
    : `• ${ar ? plan.name : plan.nameEn} — ${ar ? "النموذج" : "model"} ${price(model, ctx)} + ${ar ? "التخصيص" : "customization"}${breakdown.customizationPercent == null ? "" : ` (${breakdown.customizationPercent}${ar ? "٪" : "%"})`} ${price(customization ?? 0, ctx)} = ${price(breakdown.totalPriceUsd, ctx)} (≈ ${lyd(breakdown.totalPriceLyd ?? 0, ctx)})`;
  const promo = breakdown.totalPriceUsd != null && promoActive(CURRENT_PROMO)
    ? ` → ${price(discountedAmount(breakdown.totalPriceUsd, CURRENT_PROMO.percent), ctx)} ${ar ? "بعد الكوبون" : "with coupon"}`
    : "";
  return line + promo;
}

export function buildChatNodes(ctx: ChatContext): Record<string, ChatNode> {
  const ar = ctx.locale === "ar";
  const plans = ctx.plans;
  const promo = CURRENT_PROMO;
  const hasPromo = promoActive(promo);
  const firstPlanBreakdown = plans[0] ? resolvePlanPriceBreakdown(plans[0]) : null;
  const promoBaseUsd =
    firstPlanBreakdown?.totalPriceUsd ?? firstPlanBreakdown?.modelPriceUsd ?? 300;

  const nodes: ChatNode[] = [
    {
      id: "prices",
      label: ar ? "كم سعر الموقع؟" : "How much is a website?",
      answer:
        (ar
          ? "أسعارنا 3 فئات واضحة:\n"
          : "We have 3 clear categories:\n") +
        plans.map((p) => planLine(p, ctx)).join("\n") +
        (hasPromo
          ? ar
            ? `\n\nعرض حالي: خصم ${promo.percent}% بكوبون الشراء ${promo.code}.`
            : `\n\nCurrent offer: ${promo.percent}% off with purchase coupon ${promo.code}.`
          : ""),
      followUps: ["plans-diff", "promo", "reservation", "human"],
      keywords: [
        "prix",
        "سعر",
        "أسعار",
        "اسعار",
        "بكم",
        "كم",
        "price",
        "cost",
        "tarif",
        "combien",
      ],
    },
    {
      id: "plans-diff",
      label: ar ? "ما الفرق بين الفئات؟" : "What's the difference?",
      answer: ar
        ? "الفرق الأساسي في حجم المشروع:\n" +
          plans
            .map((p, i) => `${i + 1}. ${p.name}: ${p.description}`)
            .join("\n") +
          "\n\nيظهر سعر النموذج والتخصيص كبندين منفصلين؛ ويُعرض الإجمالي النهائي قبل الدفع."
        : "The main difference is project size:\n" +
          plans
            .map((p, i) => `${i + 1}. ${p.nameEn}: ${p.descriptionEn}`)
            .join("\n") +
          "\n\nThe model and customization are priced separately; the full total is shown before checkout.",
      followUps: ["prices", "delivery", "custom", "reservation"],
      keywords: ["différence", "فرق", "difference", "فئات", "categories"],
    },
    {
      id: "delivery",
      label: ar ? "كم يستغرق التنفيذ؟" : "How long does it take?",
      answer: ar
        ? "مدة التسليم حسب الفئة:\n• الواجهة: 7 أيام\n• الواجهة بلس: 10 أيام\n• المتجر / الحجز: 14–21 يومًا\n\nنبدأ فور تأكيد العربون، ونرسل لك معاينة قابلة للتصفح خلال المشروع."
        : "Delivery depends on the category:\n• Vitrine: 7 days\n• Vitrine+: 10 days\n• Boutique / Booking: 14–21 days\n\nWe start as soon as the deposit is confirmed and share a browsable preview during the project.",
      followUps: ["prices", "reservation", "custom", "human"],
      keywords: [
        "délai",
        "delai",
        "تسليم",
        "مدة",
        "وقت",
        "delivery",
        "time",
        "how long",
        "durée",
      ],
    },
    {
      id: "custom",
      label: ar ? "كم تكلفة تخصيص الموقع؟" : "How much does customization cost?",
      answer: ar
        ? "السعر يتكوّن من جزأين: سعر نموذج الموقع حسب الفئة، ثم تكلفة التخصيص حسب الهوية والمحتوى المطلوب. نعرض الإجمالي النهائي أو نرسل عرضاً مكتوباً للموافقة قبل أي دفعة نهائية. إذا كان سعر التخصيص مضبوطاً للباقة، يمكنك دفع الإجمالي مباشرة من صفحة الأسعار؛ وإلا اطلب عرض السعر عبر واتساب.\n\n" + plans.map((plan) => planLine(plan, ctx)).join("\n")
        : "The price has two parts: the website model price for the chosen category, then a separate customization fee based on your brand and requested content. We show the final total or send a written quote for approval before any final payment. If the fee is configured for a plan, you can pay its total online; otherwise request a quote on WhatsApp.\n\n" + plans.map((plan) => planLine(plan, ctx)).join("\n"),
      followUps: ["prices", "reservation", "promo", "human"],
      keywords: [
        "تخصيص",
        "تكلفة",
        "رسوم",
        "custom",
        "customization",
        "personnalisation",
        "هوية",
      ],
    },
    {
      id: "promo",
      label: ar ? "كيف أستفيد من خصم 50%؟" : "How do I get 50% off?",
      answer: hasPromo
        ? ar
          ? `الخصم ${promo.percent}% فعّال الآن على كل المواقع:\n1. اختر موقعًا أو باقة.\n2. في نافذة الدفع أدخل الكوبون ${promo.code} واضغط «تطبيق».\n3. السعر يُحدَّث فورًا (مثال: ${price(promoBaseUsd, ctx)} ← ${price(discountedAmount(promoBaseUsd, promo.percent), ctx)}.\n\nالكوبون يُطبَّق مرة واحدة لكل طلب.`
          : `The ${promo.percent}% discount is live on every website:\n1. Pick a site or a plan.\n2. In the checkout window, enter coupon ${promo.code} and press “Apply”.\n3. The price updates instantly (e.g. ${price(promoBaseUsd, ctx)} → ${price(discountedAmount(promoBaseUsd, promo.percent), ctx)}).\n\nThe coupon applies once per order.`
        : ar
          ? "لا يوجد خصم فعّال حاليًا — تابعنا قريبًا."
          : "No active discount right now — stay tuned.",
      followUps: ["prices", "payment", "reservation", "human"],
      keywords: ["خصم", "كوبون", "coupon", "promo", "remise", "solde", "50"],
    },
    {
      id: "payment",
      label: ar ? "كيف يتم الدفع؟" : "How do I pay?",
      answer: ar
        ? "الدفع بالعملات الرقمية عبر NOWPayments (أكثر من 300 عملة):\n• دفعة واحدة، أو\n• 2–3 أقساط.\n\nالعربون 1$ فقط لحجز مكانك، ويُخصم من السعر النهائي. لا نخزّن بيانات محفظتك."
        : "Payment is crypto via NOWPayments (300+ coins):\n• one payment, or\n• 2–3 installments.\n\nThe priority deposit is only $1 and it is deducted from the final price. We never store your wallet data.",
      followUps: ["promo", "reservation", "prices", "human"],
      keywords: ["دفع", "pay", "paiement", "crypto", "عملات", "أقساط"],
    },
    {
      id: "reservation",
      label: ar ? "أريد حجز مكان" : "I want to reserve a slot",
      answer: ar
        ? `احجز مكانك في جدول العمل بعربون ${price(ctx.reservationUsd, ctx)} فقط — يُخصم من سعر المشروع ويمنحك أولوية في التنفيذ.\n\nافتح صفحة المواقع، اختر الموقع الذي أعجبك واضغط «احجز».`
        : `Reserve your place in our queue with a ${price(ctx.reservationUsd, ctx)} deposit — deducted from the project price and giving you priority.\n\nOpen the showcase, pick the site you like and press “Reserve”.`,
      followUps: ["prices", "delivery", "payment", "human"],
      keywords: ["حجز", "احجز", "reserve", "réservation", "booking"],
      action: {
        label: ar ? "اختر موقعًا واحجز" : "Pick a site & reserve",
        href: "/demos",
      },
    },
    {
      id: "apps",
      label: ar ? "هل لديكم تطبيقات؟" : "Do you build apps?",
      answer: ar
        ? "نعم — تطبيقات الجوال (iOS/Android) والمنتجات البرمجية قيد التحضير: تطبيق عيادات، متجر، طلبات مطاعم، ونظام نقاط بيع سحابي.\n\nسجّل اهتمامك لتكون أول من يجرّب النسخة التجريبية."
        : "Yes — mobile apps (iOS/Android) and software products are in preparation: clinic app, shop app, food ordering and a cloud POS.\n\nJoin the priority list to test the first release.",
      followUps: ["prices", "human", "reservation"],
      keywords: ["تطبيق", "app", "تطبيقات", "برنامج", "software"],
      action: { label: ar ? "صفحة التطبيقات" : "Our apps", href: "/apps" },
    },
    {
      id: "human",
      label: ar ? "أريد التحدث مع إنسان" : "Talk to a human",
      answer: ar
        ? `بكل سرور — راسلنا على واتساب وسنرد خلال دقائق (${ctx.hours}).\nيمكنك أيضًا إرسال طلب عرض سعر من صفحة «اتصل بنا».`
        : `Of course — message us on WhatsApp and we reply within minutes (${ctx.hours}).\nYou can also request a quote from the contact page.`,
      followUps: ["prices", "reservation", "delivery"],
      keywords: ["إنسان", "human", "واتساب", "whatsapp", "contact", "تواصل"],
      action: {
        label: ar ? "فتح واتساب" : "Open WhatsApp",
        href: ctx.whatsappHref,
        external: true,
      },
    },
    {
      id: FALLBACK_NODE,
      label: ar ? "سؤال آخر" : "Another question",
      answer: ar
        ? "لم أجد إجابة دقيقة لسؤالك. اختر أحد المواضيع التالية، أو راسلنا على واتساب وسنجيبك شخصيًا."
        : "I don't have an exact answer for that. Pick one of the topics below, or message us on WhatsApp and we'll answer personally.",
      followUps: ["prices", "delivery", "custom", "promo", "human"],
      keywords: [],
      action: {
        label: ar ? "فتح واتساب" : "Open WhatsApp",
        href: ctx.whatsappHref,
        external: true,
      },
    },
  ];

  return Object.fromEntries(nodes.map((node) => [node.id, node]));
}

/** Retrouve un nœud à partir d'une question tapée librement. */
export function matchChatNode(
  text: string,
  nodes: Record<string, ChatNode>,
): string {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  let best: { id: string; score: number } = { id: FALLBACK_NODE, score: 0 };
  for (const node of Object.values(nodes)) {
    const score = node.keywords.reduce(
      (sum, keyword) =>
        normalized.includes(keyword.toLowerCase()) ? sum + keyword.length : sum,
      0,
    );
    if (score > best.score) best = { id: node.id, score };
  }
  return best.id;
}
