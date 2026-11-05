// Petit moteur de conversation pour l'assistant du site (sans IA externe,
// sans clé API). Chaque nœud = une question proposée + sa réponse + les
// questions de suivi pertinentes. Les réponses sont construites à partir
// des vraies données du site (formules tarifaires en USD) pour rester
// exactes si un prix change depuis l'administration.

import type { PricingPlan } from "@/lib/config";
import { resolvePlanPriceBreakdown } from "@/lib/classification";
import { formatMainPrice } from "@/lib/installments";
import { CRYPTO_GUIDE_PATH } from "@/lib/blog";

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
  /** Coordonnées (source : réglages du site). */
  phone: string;
  email: string;
  address: string;
  /** Services à la carte publiés (titre + prix de départ). */
  services: ReadonlyArray<{ titleAr: string; titleEn: string; priceFromUsd: number }>;
}

/** Question de départ proposées à l'ouverture. */
export const START_NODES = [
  "prices",
  "delivery",
  "payment",
  "subscriptions",
  "codes",
  "order",
  "services",
  "refund",
  "human",
] as const;

/** Nœuds de secours. */
export const FALLBACK_NODE = "unknown";

function price(amount: number, ctx: ChatContext) {
  return formatMainPrice(
    amount,
    ctx.locale === "ar" ? ctx.currency : ctx.currencyEn,
  );
}

function planLine(plan: PricingPlan, ctx: ChatContext): string {
  const ar = ctx.locale === "ar";
  const breakdown = resolvePlanPriceBreakdown(plan);
  const model = breakdown.modelPriceUsd ?? 0;
  const customization = breakdown.customizationUsd;
  return breakdown.totalPriceUsd == null
    ? `• ${ar ? plan.name : plan.nameEn} — ${ar ? "النموذج" : "model"} ${price(model, ctx)} + ${ar ? "تخصيص بعرض سعر" : "customization quoted"}`
    : `• ${ar ? plan.name : plan.nameEn} — ${ar ? "النموذج" : "model"} ${price(model, ctx)} + ${ar ? "التخصيص" : "customization"}${breakdown.customizationPercent == null ? "" : ` (${breakdown.customizationPercent}${ar ? "٪" : "%"})`} ${price(customization ?? 0, ctx)} = ${price(breakdown.totalPriceUsd, ctx)}`;
}

export function buildChatNodes(ctx: ChatContext): Record<string, ChatNode> {
  const ar = ctx.locale === "ar";
  const plans = ctx.plans;

  const nodes: ChatNode[] = [
    {
      id: "prices",
      label: ar ? "كم سعر الموقع؟" : "How much is a website?",
      answer:
        (ar
          ? "أسعارنا 3 فئات واضحة، كلها بالدولار (1 دولار = 1 USDT عند الدفع):\n"
          : "We have 3 clear categories, all in USD (1 USD = 1 USDT at checkout):\n") +
        plans.map((p) => planLine(p, ctx)).join("\n"),
      followUps: ["plans-diff", "payment", "reservation", "human"],
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
      followUps: ["prices", "reservation", "payment", "human"],
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
      id: "payment",
      label: ar ? "كيف يتم الدفع؟" : "How do I pay?",
      answer: ar
        ? "كل أسعارنا بالدولار الأمريكي، وتدفع نفس المبلغ بـ USDT (1 دولار = 1 USDT) أو بأكثر من 300 عملة عبر NOWPayments:\n• دفعة واحدة، أو\n• 2–3 أقساط.\n\nالعربون 1$ فقط لحجز مكانك، ويُخصم من السعر النهائي. لا نخزّن بيانات محفظتك.\n\nأول مرة؟ افتح دليل الدفع المصوّر خطوة بخطوة من الزر بالأسفل."
        : "All our prices are in US dollars, and you pay the same amount in USDT (1 USD = 1 USDT) or 300+ coins via NOWPayments:\n• one payment, or\n• 2–3 installments.\n\nThe priority deposit is only $1 and it is deducted from the final price. We never store your wallet data.\n\nFirst time? Open the step-by-step photo guide from the button below.",
      followUps: ["crypto-guide", "reservation", "prices", "human"],
      keywords: ["دفع", "pay", "paiement", "crypto", "عملات", "أقساط", "usdt", "tether"],
      action: {
        label: ar ? "دليل الدفع بالصور" : "Photo payment guide",
        href: CRYPTO_GUIDE_PATH,
      },
    },
    {
      id: "crypto-guide",
      label: ar ? "كيف أدفع بـ USDT خطوة بخطوة؟" : "How do I pay with USDT, step by step?",
      answer: ar
        ? "باختصار:\n1. اختر موقعاً أو باقة واضغط «ادفع بالكريبتو».\n2. في صفحة الفاتورة اختر USDT وانسخ العنوان والمبلغ الدقيق (أو امسح QR).\n3. من محفظتك أرسل نفس المبلغ على نفس الشبكة المكتوبة في الفاتورة (TRC20 غالباً الأرخص).\n4. انتظر تأكيد الشبكة (عادة أقل من 10 دقائق) — يصلك إيصال بالبريد ونبدأ العمل.\n\nالدليل الكامل بالصور والأخطاء التي يجب تجنبها في الزر بالأسفل."
        : "In short:\n1. Pick a site or plan and press “Pay with crypto”.\n2. On the invoice page choose USDT and copy the exact address and amount (or scan the QR).\n3. From your wallet send that exact amount on the same network shown on the invoice (TRC20 is usually cheapest).\n4. Wait for network confirmation (usually under 10 minutes) — you get an email receipt and we start.\n\nThe full photo guide, including mistakes to avoid, is in the button below.",
      followUps: ["payment", "prices", "reservation", "human"],
      keywords: ["usdt", "tether", "محفظة", "wallet", "trc20", "شبكة", "network", "guide", "دليل", "خطوة"],
      action: {
        label: ar ? "افتح دليل USDT المصوّر" : "Open the USDT photo guide",
        href: CRYPTO_GUIDE_PATH,
      },
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
      id: "subscriptions",
      label: ar ? "ما هي الاشتراكات؟" : "What are the subscriptions?",
      answer: ar
        ? "اشتراكات اختيارية بعد السنة الأولى لتجديد الاستضافة والصيانة (بالدولار، تُدفع بالكريبتو):\n• الواجهة: 10 $/شهر أو 69 $/سنة\n• الواجهة بلس: 12 $/شهر أو 89 $/سنة\n• المتجر / الحجز: 25 $/شهر أو 199 $/سنة\n\nيصلك رابط التجديد بالبريد مع تذكير قبل 3 أيام، وفترة سماح 5 أيام كحد أقصى. يمكنك المتابعة أو الإلغاء في أي وقت من صفحة المتابعة (الرابط في بريدك)؛ لا تُسترد الفترة الحالية."
        : "Optional subscriptions after the first year to renew hosting and maintenance (USD, paid in crypto):\n• Vitrine: $10/month or $69/year\n• Vitrine+: $12/month or $89/year\n• Boutique: $25/month or $199/year\n\nA renewal link is emailed with a reminder 3 days before, and the grace period is at most 5 days. Track or cancel anytime from the tracking page (link in your email); the current period is not refunded.",
      followUps: ["payment", "refund", "prices", "human"],
      keywords: ["اشتراك", "اشتراكات", "تجديد", "صيانة", "استضافة", "subscription", "abonnement", "renew", "renouvellement", "hosting", "maintenance", "hébergement", "annuler", "cancel", "إلغاء"],
      action: { label: ar ? "صفحة الاشتراكات" : "Subscriptions page", href: "/abonnements" },
    },
    {
      id: "codes",
      label: ar ? "كيف أشتري بطاقة هدايا أو كود؟" : "How do I buy a gift card or code?",
      answer: ar
        ? "متجر الأكواد الرقمية يضم بطاقات هدايا (Steam, PlayStation, Xbox, Google Play…)، شحن ألعاب عبر معرّف اللاعب، مفاتيح برامج وأكواد اشتراكات.\n\nاختر المنتج والقيمة والمنطقة ثم ادفع بالدولار/USDT عبر NOWPayments، أو اختر «بطاقة هاتف» وأدخل بطاقة Libyana أو Al Madar. في الحالة الثانية يظهر لك أولاً السعر التقديري بالدينار: إجمالي USDT × سعر السوق الموازي × 120%، مع مصدر السعر ووقته وخانة الموافقة. نتحقق من البطاقة يدوياً أولاً ثم نسلّم طلبك يدوياً؛ إرسال الرمز لا يعني قبوله. الحد الأقصى للطلب 50 $، وبطاقات الهدايا حتى 100 $. تحقّق من منطقة حسابك قبل الشراء — الأكواد لا تُسترد بعد التسليم (استبدال خلال 48 ساعة إذا كان الكود غير صالح مع لقطة شاشة)."
        : "The digital codes store offers gift cards (Steam, PlayStation, Xbox, Google Play…), game top-ups via Player ID, software keys and subscription codes.\n\nPick the product, amount and region, then pay in USD/USDT via NOWPayments, or choose Phone card and submit a Libyana or Al Madar recharge card. Phone cards first show an indicative LYD quote: total USDT × parallel-market rate × 120%, with its source, timestamp and a confirmation box. Cards are verified manually first and orders are then delivered manually; submitting a code does not mean it is accepted. Max $50 per order, gift cards up to $100. Check your account region before buying — codes are non-refundable once delivered (replacement within 48h if invalid, with a screenshot).",
      followUps: ["order", "payment", "refund", "human"],
      keywords: ["كود", "اكواد", "أكواد", "بطاقة", "بطاقات", "هدايا", "شحن", "مفتاح", "لعبة", "العاب", "ألعاب", "code", "codes", "gift", "card", "carte", "cadeau", "top-up", "topup", "recharge", "key", "clé", "steam", "playstation", "xbox", "google play", "pubg", "free fire", "roblox", "jeu", "game"],
      action: { label: ar ? "افتح متجر الأكواد" : "Open the codes store", href: "/codes" },
    },
    {
      id: "order",
      label: ar ? "أين طلبي / كودي؟" : "Where is my order / code?",
      answer: ar
        ? "بعد تأكيد الدفع واكتمال التسليم، تظهر بطاقات الهدايا والمفاتيح وأكواد الاشتراكات في صفحة «طلبي» وتُرسل إلى بريدك. الدفع بالكريبتو يُسلَّم عادة خلال دقائق؛ بطاقة الهاتف تتطلب تحققاً وتسليماً يدوياً. شحن الألعاب يُضاف مباشرة إلى حساب اللعبة عبر معرّف اللاعب — لا يُرسل كود.\n\nتتبّع طلبك بالمرجع والرمز الموجودين في صفحة الطلب أو بريد التسليم، أو من نفس الجهاز الذي طلبت منه."
        : "After payment confirmation and delivery, gift cards, keys and subscription codes appear on the “My order” page and are emailed to you. Crypto orders are usually delivered within minutes; phone cards require manual verification and delivery. Game top-ups are credited directly to the game account via Player ID — no code is sent.\n\nTrack your order with the reference and token from the order or delivery page, or from the same device you ordered on.",
      followUps: ["codes", "refund", "human"],
      keywords: ["طلبي", "طلب", "تتبع", "وصل", "لم يصل", "استلام", "order", "commande", "track", "tracking", "suivi", "received", "reçu", "livraison", "delivery code", "player id", "معرف اللاعب"],
      action: { label: ar ? "تتبع طلبي" : "Track my order", href: "/codes/commande" },
    },
    {
      id: "services",
      label: ar ? "ما خدماتكم المفتوحة؟" : "What open services do you offer?",
      answer: ar
        ? "مهام صغيرة بأسعار ثابتة بالدولار:\n" + ctx.services.map((s) => `• ${s.titleAr} — من ${price(s.priceFromUsd, ctx)}`).join("\n") + "\n\nكل خدمة لها صفحة تشرح التسليمات ومدة التنفيذ والأسئلة الشائعة."
        : "Small fixed-price tasks in USD:\n" + ctx.services.map((s) => `• ${s.titleEn} — from ${price(s.priceFromUsd, ctx)}`).join("\n") + "\n\nEach service has a page describing deliverables, delivery time and FAQs.",
      followUps: ["prices", "payment", "human"],
      keywords: ["خدمة", "خدمات", "إعادة تصميم", "شعار", "هوية", "صفحة هبوط", "عرض تقديمي", "service", "services", "restyle", "refonte", "redesign", "logo", "landing", "slides", "présentation", "design", "fix", "correction", "section"],
      action: { label: ar ? "صفحة الخدمات" : "Services page", href: "/services" },
    },
    {
      id: "refund",
      label: ar ? "ما سياسة الاسترداد؟" : "What is the refund policy?",
      answer: ar
        ? "• العربون يُخصم من السعر ولا يُسترد بعد بدء العمل إلا بخطأ واضح من نخبة.\n• ضمان الاسترداد الكامل إذا لم يُسلَّم الموقع وفق المواصفات المتفق عليها كتابياً.\n• الاشتراكات: الإلغاء في أي وقت، يبقى الوصول حتى نهاية الفترة المدفوعة، ولا تُسترد الفترة الحالية.\n• الأكواد الرقمية لا تُسترد بعد التسليم (استبدال خلال 48 ساعة إذا كان الكود غير صالح).\n\nلطلب الاسترداد راسلنا بالبريد أو واتساب مع مرجع الطلب والمبلغ ومرجع المعاملة والسبب. لا ترسل أبداً كلمات مرور أو مفاتيح خاصة."
        : "• The deposit is deducted from the price and not refunded once work has started, unless Nukhba is clearly at fault.\n• Full-refund guarantee if the website is not delivered to the agreed written specifications.\n• Subscriptions: cancel anytime, access stays until the end of the paid period, the current period is not refunded.\n• Digital codes are non-refundable once delivered (replacement within 48h if invalid).\n\nTo request a refund, email or WhatsApp us with the order reference, amount, transaction reference and reason. Never send passwords or private keys.",
      followUps: ["terms", "human", "prices"],
      keywords: ["استرداد", "استرجاع", "ارجاع", "إرجاع", "ضمان", "refund", "remboursement", "rembourser", "garantie", "guarantee", "money back"],
      action: { label: ar ? "سياسة الاسترداد" : "Refund policy", href: "/remboursement" },
    },
    {
      id: "terms",
      label: ar ? "الشروط والأحكام" : "Terms & conditions",
      answer: ar
        ? "الأسعار بالدولار وتُدفع بالكريبتو عبر NOWPayments. يُؤكَّد الطلب عند استلام العربون. تنتقل ملكية الموقع إليك بعد سداد كامل المبلغ. يُعتبر الموقع مقبولاً إذا لم تُرسل ملاحظات خلال 7 أيام من مشاركة النسخة التجريبية. بياناتك تُستخدم للخدمة فقط ولا تُباع. القانون الليبي ومحاكم طرابلس هي المرجع."
        : "Prices are in USD and paid in crypto via NOWPayments. An order is confirmed once the deposit is received. Website ownership passes to you after full payment. The website is deemed accepted if no feedback is sent within 7 days of the test version. Your data is used only for the service and never sold. Libyan law applies, courts of Tripoli.",
      followUps: ["refund", "payment", "human"],
      keywords: ["شروط", "أحكام", "قانون", "ملكية", "terms", "conditions", "cgv", "legal", "ownership", "propriété", "loi"],
      action: { label: ar ? "الشروط والأحكام" : "Terms & conditions", href: "/conditions" },
    },
    {
      id: "contact",
      label: ar ? "كيف أتواصل معكم؟" : "How can I contact you?",
      answer: ar
        ? `واتساب/هاتف: ${ctx.phone}\nالبريد: ${ctx.email}\nالعنوان: ${ctx.address} — ونخدم العالم كله عن بُعد.\nساعات العمل: ${ctx.hours}.`
        : `WhatsApp/phone: ${ctx.phone}\nEmail: ${ctx.email}\nAddress: ${ctx.address} — we serve clients worldwide remotely.\nHours: ${ctx.hours}.`,
      followUps: ["human", "prices", "reservation"],
      keywords: ["تواصل", "اتصل", "هاتف", "رقم", "بريد", "ايميل", "عنوان", "ساعات", "دوام", "contact", "phone", "téléphone", "email", "adresse", "address", "horaires", "hours", "où", "where", "أين"],
      action: { label: ar ? "صفحة اتصل بنا" : "Contact page", href: "/contact" },
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
      followUps: ["prices", "delivery", "custom", "payment", "human"],
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
