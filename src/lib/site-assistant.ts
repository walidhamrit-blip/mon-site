// Moteur de connaissance de l'assistant du site.
//
// Objectif : permettre à l'assistant (bulle « Einstein » en bas de page) de
// répondre à TOUTES les questions sur le contenu du site — création de
// sites, formules, paiement crypto, abonnements, services à la carte,
// boutique de codes digitaux, portfolio, secteurs, comparatifs, blog,
// applications, produits logiciels, conditions, remboursement, badge et
// contact — en arabe, anglais ou français.
//
// Principe : on indexe le site réel (réglages /admin + contenu éditorial +
// catalogue digital « live ») sous forme de fiches bilingues, puis :
//   - côté serveur (`/api/chat`), on compose un prompt système = résumé
//     compact du site + fiches pertinentes pour la question (retrieval),
//     pour un LLM relié à Vercel AI Gateway ;
//   - sans clé API, ou si l'appel échoue, `answerLocally` produit une
//     réponse déterministe à partir des mêmes fiches.
//
// Le module est pur (aucun accès base/réseau) : le catalogue digital et les
// données du site lui sont injectés — il est donc testable avec esbuild.

import { resolvePlanPriceBreakdown } from "@/lib/classification";
import type { siteConfig } from "@/lib/config";
import type { SiteContent, Demo, Faq } from "@/lib/site-types";
import { collectAllDemos } from "@/lib/site-types";
import type { DigitalProduct } from "@/lib/digital-types";
import { digitalCategories } from "@/lib/digital-categories";
import { MAX_DIGITAL_ORDER_USD, MAX_GIFT_CARD_PRICE_USD } from "@/lib/digital-sales-policy";
import { SUBSCRIPTION_PLANS, SUBSCRIPTION_GRACE_DAYS } from "@/lib/subscription-plans";
import { resolveServiceLanding, servicesHubFaqs } from "@/lib/services";
import { sectorSeo } from "@/lib/sectors";
import { comparisons, comparisonText } from "@/lib/comparisons";
import { blogArticles } from "@/lib/blog-articles";
import { CRYPTO_GUIDE_PATH } from "@/lib/blog";
import { whatsappLink } from "@/lib/utils";

type AssistantConfig = typeof siteConfig;

export type AssistantLang = "ar" | "en" | "fr";

export interface KnowledgeDoc {
  id: string;
  /** Section du site (pour les suggestions et le classement). */
  section:
    | "general"
    | "pricing"
    | "payment"
    | "subscriptions"
    | "services"
    | "digital"
    | "product"
    | "demos"
    | "sectors"
    | "compare"
    | "blog"
    | "apps"
    | "products"
    | "legal"
    | "contact"
    | "faq";
  /** Chemin interne (`/pricing`) ou URL externe (WhatsApp). */
  path: string;
  external?: boolean;
  title: { ar: string; en: string };
  body: { ar: string; en: string };
  /** Mots-clés AR/EN/FR reconnus dans une question tapée librement. */
  keywords: string[];
  /** Pondération (1 = normal). Les fiches de synthèse l'emportent sur les détails. */
  weight?: number;
  /** Plateforme / marque (fiches produit) — forte priorité si citée. */
  platform?: string;
}

export interface SiteKnowledge {
  docs: KnowledgeDoc[];
  /** Résumé compact (anglais) injecté dans chaque prompt LLM. */
  core: string;
  /** Catalogue digital indisponible (base configurée mais injoignable). */
  degraded: boolean;
  whatsappHref: string;
  productCount: number;
  phoneCardPaymentsEnabled: boolean;
}

export interface AssistantAction {
  label: string;
  href: string;
  external?: boolean;
}

export interface AssistantReply {
  text: string;
  actions: AssistantAction[];
  /** Questions de suivi proposées (libellés déjà traduits). */
  suggestions: string[];
  mode: "local" | "llm";
}

export interface KnowledgeInput {
  config: AssistantConfig;
  content: SiteContent;
  digitalProducts?: DigitalProduct[];
  degraded?: boolean;
}

/* ───────────────────────── Normalisation & langue ───────────────────────── */

const ARABIC_RE = /[\u0600-\u06FF]/;

const FR_MARKERS = [
  "bonjour", "salut", "combien", "comment", "quel", "quelle", "quels", "est-ce",
  "prix", "tarif", "délai", "delai", "paiement", "payer", "abonnement", "site",
  "boutique", "carte", "cadeau", "rembours", "conditions", "vous", "votre",
  "pouvez", "merci", "je", "une", "des", "les", "avec", "pour", "jeu", "code",
  "livraison", "ça", "où", "ou", "qui", "faire", "créer", "création",
];
const EN_MARKERS = [
  "hello", "hi", "how", "much", "what", "which", "price", "cost", "do", "you",
  "can", "the", "is", "are", "pay", "payment", "website", "store", "gift",
  "card", "refund", "terms", "delivery", "thanks", "with", "for", "game",
  "code", "where", "who", "make", "build",
];

/** Détecte la langue d'une question (repli : langue de l'interface). */
export function detectLanguage(text: string, fallback: AssistantLang = "en"): AssistantLang {
  if (ARABIC_RE.test(text)) return "ar";
  const words = text.toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿœ-]+/).filter(Boolean);
  if (words.length === 0) return fallback;
  let fr = 0;
  let en = 0;
  for (const word of words) {
    if (FR_MARKERS.includes(word)) fr += 1;
    if (EN_MARKERS.includes(word)) en += 1;
  }
  if (/[àâçéèêëîïôûùüÿœ]/.test(text)) fr += 2;
  if (fr === 0 && en === 0) return fallback === "ar" ? "en" : fallback;
  return fr > en ? "fr" : "en";
}

const STOPWORDS = new Set([
  // en
  "the", "a", "an", "is", "are", "do", "does", "you", "your", "i", "my", "me", "we",
  "of", "to", "for", "in", "on", "it", "and", "or", "with", "can", "what", "how",
  "much", "many", "there", "this", "that", "be", "have", "has", "about", "please",
  "want", "need", "like", "get", "any", "some", "from", "by", "at", "as", "if",
  // fr
  "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "est", "sont",
  "je", "tu", "vous", "nous", "il", "elle", "ce", "cet", "cette", "ces", "que",
  "qui", "quoi", "quel", "quelle", "quels", "quelles", "pour", "avec", "sur",
  "dans", "au", "aux", "mon", "ma", "mes", "votre", "vos", "combien", "comment",
  "pouvez", "peux", "peut", "avoir", "faire", "svp", "merci", "bonjour", "y", "a",
  // ar
  "هل", "ما", "ماذا", "كيف", "كم", "من", "في", "على", "عن", "الى", "إلى", "و", "او",
  "أو", "هذا", "هذه", "ذلك", "انا", "أنا", "انت", "أنت", "لدي", "لديكم", "عندكم",
  "اريد", "أريد", "ممكن", "يمكن", "مع", "ان", "أن", "لو", "لي", "لك", "هو", "هي",
]);

/** Normalise un texte pour la recherche (accents, hamza, tashkil, ta marbouta…). */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // NFD décompose أ/إ/آ en ا + hamza combinante (U+0653–U+0655) : on
    // retire la marque pour unifier les formes de l'alef.
    .replace(/[\u064B-\u0655\u0640]/g, "") // tashkil + hamza combinante + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}+#]+/gu, " ")
    .trim();
}

function tokenize(input: string): string[] {
  const out = new Set<string>();
  for (const raw of normalizeText(input).split(/\s+/)) {
    if (!raw || raw.length < 2 || STOPWORDS.has(raw)) continue;
    out.add(raw);
    // Variante « racine » : on conserve aussi la forme brute, car le
    // retrait d'un préfixe d'une lettre peut mutiler un nom propre
    // (بلايستيشن ≠ لايستيشن).
    let stem = raw;
    if (ARABIC_RE.test(stem)) {
      stem = stem.replace(/^(وال|بال|فال|كال|لل|ال)/, "");
      if (stem.length > 3) stem = stem.replace(/^[وبلفك]/, "");
      stem = stem.replace(/(ات|ون|ين|ها|هم|كم|نا)$/, "");
      // Ta marbouta (déjà normalisée en « ه ») : عيادة / عيادات → عياد.
      if (stem.length > 3) stem = stem.replace(/ه$/, "");
    } else if (stem.length > 4) {
      stem = stem.replace(/(es|s|x)$/, "");
    }
    if (stem.length >= 2 && stem !== raw && !STOPWORDS.has(stem)) out.add(stem);
  }
  return [...out];
}

/* ───────────────────────── Synonymes d'intention ────────────────────────── */

/**
 * Jetons équivalents (FR/EN/AR) — ajoutés à la requête pour que « prix »
 * trouve une fiche indexée avec « price » ou « سعر ».
 */
const SYNONYMS: string[][] = [
  ["prix", "price", "cost", "tarif", "سعر", "اسعار", "تكلفه", "بكم", "pricing", "combien"],
  ["delai", "delivery", "time", "duree", "مده", "تسليم", "وقت", "يستغرق", "long", "days", "jours", "ايام"],
  ["paiement", "payment", "pay", "payer", "دفع", "crypto", "usdt", "tether", "nowpayments", "عملات", "كريبتو", "bitcoin"],
  ["acompte", "deposit", "reservation", "reserve", "reserver", "حجز", "عربون", "booking"],
  ["abonnement", "subscription", "renew", "renouvellement", "اشتراك", "تجديد", "hebergement", "hosting", "استضافه", "maintenance", "صيانه"],
  ["service", "services", "خدمه", "خدمات", "redesign", "restyle", "refonte", "landing", "slides", "presentation", "logo", "design", "fix", "correction", "تصليح", "شعار"],
  ["code", "codes", "كود", "اكواد", "gift", "card", "carte", "cadeau", "بطاقه", "هدايا", "topup", "top-up", "recharge", "شحن", "key", "cle", "مفتاح"],
  ["commande", "order", "tracking", "track", "suivi", "طلب", "طلبي", "تتبع", "ref", "reference"],
  ["demo", "demos", "portfolio", "exemple", "examples", "realisations", "معرض", "اعمال", "نماذج", "showcase"],
  ["secteur", "sector", "sectors", "قطاع", "قطاعات", "industry", "domaine"],
  ["comparer", "compare", "comparison", "comparatif", "vs", "versus", "مقارنه", "بديل", "alternative"],
  ["blog", "article", "guide", "مقال", "مقالات", "دليل"],
  ["app", "apps", "application", "applications", "تطبيق", "تطبيقات", "mobile", "ios", "android"],
  ["logiciel", "software", "produit", "products", "برنامج", "برامج", "منتجات", "pos", "crm", "erp"],
  ["remboursement", "refund", "rembourser", "استرداد", "استرجاع", "ارجاع", "garantie", "guarantee", "ضمان"],
  ["conditions", "terms", "cgv", "شروط", "legal", "juridique", "قانون", "propriete", "ownership", "ملكيه"],
  ["badge", "شاره", "footer", "credit", "lien", "backlink"],
  ["contact", "contacter", "تواصل", "اتصل", "whatsapp", "واتساب", "telephone", "phone", "هاتف", "email", "mail", "بريد", "adresse", "address", "عنوان", "horaires", "hours", "ساعات", "دوام", "humain", "human", "انسان", "بشر", "agent"],
  ["domaine", "domain", "دومين", "نطاق", "dns"],
  ["seo", "google", "جوجل", "referencement", "ranking", "ظهور", "ai", "chatgpt", "citation"],
  ["langue", "language", "arabe", "arabic", "anglais", "english", "لغه", "عربي", "انجليزي", "bilingue"],
  ["modifier", "edit", "تعديل", "dashboard", "admin", "لوحه", "cms", "contenu", "content", "محتوي"],
  ["devise", "currency", "عمله", "euro", "eur", "dinar", "lyd", "sar", "aed", "egp", "dollar"],
  ["theme", "themes", "couleur", "colors", "dark", "sombre", "ثيم", "الوان", "داكن"],
  ["installment", "installments", "tranche", "acompte", "اقساط", "قسط", "tranches"],
  // Marques de la boutique digitale (translittérations arabes courantes).
  ["playstation", "بلايستيشن", "بلاي ستيشن", "psn", "ps5", "ps4"],
  ["xbox", "اكسبوكس", "إكس بوكس"],
  ["steam", "ستيم"],
  ["google play", "جوجل بلاي", "قوقل بلاي"],
  ["itunes", "ايتونز", "آيتونز", "apple", "ابل", "آبل"],
  ["netflix", "نتفليكس"],
  ["spotify", "سبوتيفاي"],
  ["pubg", "ببجي", "بابجي"],
  ["free fire", "فري فاير"],
  ["roblox", "روبلوكس"],
  ["flexible", "custom", "amount", "montant", "مبلغ", "مفتوح"],
];

function expandQuery(tokens: string[]): Set<string> {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const group of SYNONYMS) {
      if (group.some((g) => normalizeText(g) === token || token.startsWith(normalizeText(g)) && g.length >= 4)) {
        for (const g of group) expanded.add(normalizeText(g));
      }
    }
  }
  return expanded;
}

/* ───────────────────────── Construction des fiches ──────────────────────── */

const fmtUsd = (value: number | null | undefined): string =>
  value == null ? "—" : `$${Number.isInteger(value) ? value : value.toFixed(2)}`;

function joinFaqs(faqs: readonly Faq[], lang: "ar" | "en"): string {
  return faqs
    .map((faq) => (lang === "ar" ? `س: ${faq.qAr}\nج: ${faq.aAr}` : `Q: ${faq.qEn}\nA: ${faq.aEn}`))
    .join("\n");
}

function kw(...values: Array<string | readonly string[] | undefined>): string[] {
  const out = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const list = typeof value === "string" ? [value] : value;
    for (const item of list) {
      const normalized = normalizeText(item);
      if (normalized) out.add(normalized);
    }
  }
  return [...out];
}

function planDocs(config: AssistantConfig): KnowledgeDoc[] {
  const plans = config.pricing.plans;
  const lines = plans.map((plan) => {
    const b = resolvePlanPriceBreakdown(plan);
    const total =
      b.totalPriceUsd == null
        ? { ar: "التخصيص بعرض سعر", en: "customization quoted separately" }
        : {
            ar: `+ تخصيص ${b.customizationPercent ?? ""}٪ ${fmtUsd(b.customizationUsd)} = الإجمالي ${fmtUsd(b.totalPriceUsd)}`,
            en: `+ ${b.customizationPercent ?? ""}% customization ${fmtUsd(b.customizationUsd)} = total ${fmtUsd(b.totalPriceUsd)}`,
          };
    return {
      ar: `• ${plan.name}: نموذج ${fmtUsd(b.modelPriceUsd)} ${total.ar} ${plan.period} — ${plan.description}`,
      en: `• ${plan.nameEn}: model ${fmtUsd(b.modelPriceUsd)} ${total.en} ${plan.periodEn} — ${plan.descriptionEn}`,
      plan,
    };
  });

  const overview: KnowledgeDoc = {
    id: "pricing-overview",
    section: "pricing",
    path: "/pricing",
    title: { ar: "أسعار تصميم المواقع", en: "Website pricing" },
    body: {
      ar:
        `جميع الأسعار بالدولار الأمريكي (1 دولار = 1 USDT عند الدفع). السعر = سعر النموذج + تكلفة التخصيص، ويُعرض الإجمالي قبل الدفع:\n${lines.map((l) => l.ar).join("\n")}\n\nالسعر يشمل سنة استضافة (Vercel) وربط الدومين؛ الدومين نفسه (~12 $/سنة) تشتريه باسمك. يمكنك عرض الأسعار بعملات أخرى (USDT, USD, EUR, SAR, AED, EGP) للمعلومة فقط — الدفع بالدولار/USDT.`,
      en:
        `All prices are in US dollars (1 USD = 1 USDT at checkout). Price = model price + customization fee; the full total is shown before payment:\n${lines.map((l) => l.en).join("\n")}\n\nIncludes 1 year of hosting (Vercel) and domain connection; the domain itself (~$12/year) is bought in your name. Prices can be displayed in other currencies (USDT, USD, EUR, SAR, AED, EGP) for information only — payment is in USD/USDT.`,
    },
    keywords: kw("price", "prices", "pricing", "cost", "prix", "tarif", "tarifs", "سعر", "اسعار", "بكم", "تكلفة", "plan", "plans", "formule", "باقة", "باقات", "فئة", "فئات", "website", "site", "موقع", "customization", "تخصيص", "personnalisation", "hosting", "استضافة", "vercel", "currency", "devise", "عملة"),
    weight: 1.4,
  };

  const perPlan: KnowledgeDoc[] = lines.map(({ plan, ar, en }) => ({
    id: `plan-${plan.id}`,
    section: "pricing",
    path: "/pricing",
    title: { ar: `باقة ${plan.name}`, en: `${plan.nameEn} plan` },
    body: {
      ar: `${ar}\nالمميزات: ${plan.features.join("، ")}`,
      en: `${en}\nFeatures: ${plan.featuresEn.join(", ")}`,
    },
    keywords: kw(plan.id, plan.name, plan.nameEn, plan.nameEn.replace("+", " plus"), "boutique", "shop", "store", "متجر", "vitrine", "واجهة", "showcase"),
  }));

  return [overview, ...perPlan];
}

function paymentDocs(config: AssistantConfig): KnowledgeDoc[] {
  const deposit = config.reservation?.depositUsd ?? 1;
  const flex = config.flexiblePayment;
  const phoneCardEnabled = config.fazercards?.phoneCardPaymentsEnabled !== false;
  return [
    {
      id: "phone-card-payment",
      section: "payment",
      path: "/codes",
      title: { ar: "الدفع ببطاقة / رصيد الهاتف", en: "Phone card / mobile balance payment" },
      body: {
        ar: phoneCardEnabled
          ? "الدفع ببطاقات تعبئة ليبيانا أو المدار متاح في المتجر الرقمي ويخضع لتحقق يدوي. السعر التقديري بالدينار = إجمالي USDT × سعر السوق الموازي × 1.20. راجع السعر في صفحة الشراء وأكّده قبل إرسال الرمز مرة واحدة. القبول والتسليم ليسا فوريين."
          : "الدفع ببطاقة أو رصيد الهاتف متوقف مؤقتاً لأن التحقق اليدوي غير متاح. لا ترسل رمز تعبئة. الدفع بالعملات الرقمية يبقى متاحاً، والطلبات السابقة تبقى قابلة للمعالجة. لا يوجد موعد عودة معلن؛ راجع صفحة الشراء لاحقاً.",
        en: phoneCardEnabled
          ? "Libyana / Al Madar recharge cards are accepted in the digital store after manual verification. Indicative LYD price = order total USDT × parallel-market rate × 1.20. Check and accept the quote at checkout before submitting the code once. Acceptance and delivery are not instant."
          : "Phone card / mobile balance payments are temporarily paused because manual verification is unavailable. Do not submit a recharge code. Crypto remains available and existing orders can still be processed. No return date is announced; check checkout later.",
      },
      keywords: kw("phone", "card", "balance", "recharge", "libyana", "madar", "carte", "solde", "téléphonique", "بطاقة", "رصيد", "هاتف", "ليبيانا", "المدار", "تعبئة", "paused", "disabled", "متوقف"),
      weight: 1.4,
    },
    {
      id: "payment",
      section: "payment",
      path: CRYPTO_GUIDE_PATH,
      title: { ar: "طريقة الدفع (كريبتو / USDT)", en: "How to pay (crypto / USDT)" },
      body: {
        ar: `كل الأسعار بالدولار الأمريكي وتُدفع بنفس القيمة بـ USDT (1 دولار = 1 USDT) أو بأكثر من 300 عملة رقمية عبر بوابة NOWPayments — دفعة واحدة أو على 2–3 أقساط. لا نخزّن بيانات محفظتك ولا نطلب أبداً كلمات مرور أو عبارات استرداد. خطوات الدفع: اختر الموقع/الباقة ← «ادفع بالكريبتو» ← اختر USDT ← انسخ العنوان والمبلغ الدقيق (نفس الشبكة، TRC20 غالباً الأرخص) ← بعد تأكيد الشبكة يصلك إيصال بالبريد. الدليل المصوّر الكامل في المدونة.`,
        en: `All prices are in US dollars and paid at the same value in USDT (1 USD = 1 USDT) or 300+ coins via the NOWPayments gateway — in one payment or 2–3 installments. We never store wallet data and never ask for passwords or recovery phrases. Steps: pick a site/plan → "Pay with crypto" → choose USDT → copy the exact address and amount (same network, TRC20 is usually cheapest) → after network confirmation you receive an email receipt. The full photo guide is on the blog.`,
      },
      keywords: kw("payment", "pay", "paiement", "payer", "دفع", "ادفع", "أدفع", "كيف أدفع", "عملات رقمية", "العملات الرقمية", "عملة رقمية", "crypto", "usdt", "tether", "nowpayments", "wallet", "محفظة", "trc20", "network", "شبكة", "installments", "أقساط", "تقسيط", "tranches", "bitcoin", "btc", "eth", "binance", "guide", "دليل", "cash", "card", "visa", "paypal", "بطاقة بنكية", "كاش"),
      weight: 1.3,
    },
    {
      id: "reservation",
      section: "payment",
      path: "/demos",
      title: { ar: "حجز مكان بعربون", en: "Reserve a slot with a deposit" },
      body: {
        ar: `احجز مكانك في جدول العمل بعربون ${fmtUsd(deposit)} فقط — يُخصم من سعر المشروع ويمنحك أولوية التنفيذ. من صفحة المواقع اختر النموذج الذي أعجبك واضغط «احجز». العربون لا يُسترد بعد بدء العمل إلا إذا كان الخطأ من نخبة.`,
        en: `Reserve your place in our queue with a ${fmtUsd(deposit)} deposit — deducted from the project price and giving you priority. From the showcase pick the model you like and press "Reserve". The deposit is not refunded once work has started, unless Nukhba is clearly at fault.`,
      },
      keywords: kw("reserve", "reservation", "réserver", "deposit", "acompte", "حجز", "احجز", "عربون", "slot", "priority", "أولوية"),
    },
    {
      id: "flexible-payment",
      section: "payment",
      path: "/pricing",
      title: { ar: "دفع مبلغ مفتوح (1 $ أو أكثر)", en: "Flexible payment ($1 or more)" },
      body: {
        ar: `يمكنك دفع أي مبلغ تختاره من ${fmtUsd(flex.minUsd)} إلى ${fmtUsd(flex.maxUsd)} (مثلاً قسط، تكملة، أو خدمة متفق عليها). ${flex.noteAr}`,
        en: `You can pay any amount you choose from ${fmtUsd(flex.minUsd)} to ${fmtUsd(flex.maxUsd)} (e.g. an installment, a balance or an agreed service). ${flex.noteEn}`,
      },
      keywords: kw("flexible", "custom amount", "montant libre", "مبلغ", "مفتوح", "minimum", "حد أدنى", "any amount"),
    },
  ];
}

function subscriptionDocs(): KnowledgeDoc[] {
  const tiers = ["vitrine", "vitrine-plus", "boutique"] as const;
  const lines = tiers.map((tier) => {
    const monthly = SUBSCRIPTION_PLANS.find((p) => p.tier === tier && p.cycle === "monthly");
    const annual = SUBSCRIPTION_PLANS.find((p) => p.tier === tier && p.cycle === "annual");
    return {
      ar: `• ${monthly?.name}: ${fmtUsd(monthly?.priceUsd)}/شهر أو ${fmtUsd(annual?.priceUsd)}/سنة`,
      en: `• ${monthly?.nameEn}: ${fmtUsd(monthly?.priceUsd)}/month or ${fmtUsd(annual?.priceUsd)}/year`,
    };
  });
  return [
    {
      id: "subscriptions",
      section: "subscriptions",
      path: "/abonnements",
      title: { ar: "الاشتراكات (استضافة وصيانة)", en: "Subscriptions (hosting & maintenance)" },
      body: {
        ar: `اشتراكات اختيارية بعد السنة الأولى لتجديد الاستضافة والصيانة، بالدولار وتُدفع بالكريبتو:\n${lines.map((l) => l.ar).join("\n")}\nالشهري يتجدد كل 30 يوماً والسنوي كل 365 يوماً. يصلك رابط دفع التجديد بالبريد مع تذكير قبل 3 أيام. فترة سماح بعد الاستحقاق بحد أقصى ${SUBSCRIPTION_GRACE_DAYS} أيام، ثم يُعلَّق الاشتراك ويمكن الاشتراك مجدداً في أي وقت.`,
        en: `Optional subscriptions after the first year to renew hosting and maintenance, priced in USD and paid in crypto:\n${lines.map((l) => l.en).join("\n")}\nMonthly renews every 30 days, annual every 365 days. A renewal payment link is emailed with a reminder 3 days before. Grace period after the due date is at most ${SUBSCRIPTION_GRACE_DAYS} days, then the subscription is suspended and you can subscribe again anytime.`,
      },
      keywords: kw("subscription", "subscriptions", "abonnement", "abonnements", "اشتراك", "اشتراكات", "renew", "renewal", "renouvellement", "تجديد", "monthly", "annual", "mensuel", "annuel", "شهري", "سنوي", "hosting", "hébergement", "استضافة", "maintenance", "صيانة", "grace", "سماح", "suspend"),
      weight: 1.3,
    },
    {
      id: "subscription-tracking",
      section: "subscriptions",
      path: "/abonnements/suivi",
      title: { ar: "متابعة أو إلغاء الاشتراك", en: "Track or cancel a subscription" },
      body: {
        ar: `تابع اشتراكك من صفحة المتابعة عبر الرابط الخاص المُرسل إلى بريدك (يحتوي المرجع ref ورمز t). يمكنك الإلغاء في أي وقت من نفس الصفحة؛ يبقى الوصول متاحاً حتى نهاية الفترة المدفوعة، ولا تُسترد الفترة الحالية.`,
        en: `Track your subscription from the tracking page using the private link emailed to you (it contains the reference ref and token t). You can cancel anytime from that page; access stays open until the end of the paid period, and the current period is not refunded.`,
      },
      keywords: kw("cancel", "cancellation", "annuler", "résilier", "إلغاء", "الغاء", "tracking", "suivi", "متابعة", "subscription status", "حالة الاشتراك"),
    },
  ];
}

function serviceDocs(config: AssistantConfig): KnowledgeDoc[] {
  const services = config.standaloneServices;
  const overview: KnowledgeDoc = {
    id: "services-overview",
    section: "services",
    path: "/services",
    title: { ar: "الخدمات المفتوحة (مهام صغيرة بأسعار ثابتة)", en: "Open services (small fixed-price tasks)" },
    body: {
      ar:
        services.map((s) => `• ${s.titleAr} — من ${fmtUsd(s.priceFromUsd)}: ${s.descAr}`).join("\n") +
        `\n\n${joinFaqs(servicesHubFaqs, "ar")}`,
      en:
        services.map((s) => `• ${s.titleEn} — from ${fmtUsd(s.priceFromUsd)}: ${s.descEn}`).join("\n") +
        `\n\n${joinFaqs(servicesHubFaqs, "en")}`,
    },
    keywords: kw("service", "services", "خدمة", "خدمات", "à la carte", "small task", "مهمة"),
    weight: 1.2,
  };
  const details: KnowledgeDoc[] = services.map((service) => {
    const landing = resolveServiceLanding(service);
    return {
      id: `service-${service.id}`,
      section: "services",
      path: `/services/${service.id}`,
      title: { ar: service.titleAr, en: service.titleEn },
      body: {
        ar: `${landing.answerAr}\nالسعر: من ${fmtUsd(service.priceFromUsd)}. التسليم: ${landing.deliveryAr}. مناسب لـ: ${landing.bestForAr}.\nالتسليمات: ${landing.deliverablesAr.join("، ")}.\n${joinFaqs(landing.faqs, "ar")}`,
        en: `${landing.answerEn}\nPrice: from ${fmtUsd(service.priceFromUsd)}. Delivery: ${landing.deliveryEn}. Best for: ${landing.bestForEn}.\nDeliverables: ${landing.deliverablesEn.join(", ")}.\n${joinFaqs(landing.faqs, "en")}`,
      },
      keywords: kw(service.id, service.titleAr, service.titleEn, landing.keywordsAr, landing.keywordsEn),
    };
  });
  return [overview, ...details];
}

function digitalDocs(products: DigitalProduct[], degraded: boolean): KnowledgeDoc[] {
  const available = degraded ? [] : products;
  const counts = Object.fromEntries(
    digitalCategories.map((c) => [c.kind, available.filter((p) => p.kind === c.kind).length]),
  ) as Record<string, number>;

  const statusAr = degraded
    ? "⚠️ متجر الأكواد غير متاح مؤقتاً (تعذّر الاتصال بالكتالوج). لا يمكن تأكيد الأسعار أو التوفر الآن — راسلنا على واتساب أو حاول لاحقاً."
    : `يضم المتجر حالياً ${available.length} منتجاً: ${digitalCategories.map((c) => `${c.ar} (${counts[c.kind]})`).join("، ")}.`;
  const statusEn = degraded
    ? "⚠️ The codes store is temporarily unavailable (catalog unreachable). Prices and availability cannot be confirmed right now — message us on WhatsApp or try again later."
    : `The store currently lists ${available.length} products: ${digitalCategories.map((c) => `${c.en} (${counts[c.kind]})`).join(", ")}.`;

  const docs: KnowledgeDoc[] = [
    {
      id: "digital-overview",
      section: "digital",
      path: "/codes",
      title: { ar: "متجر الأكواد الرقمية", en: "Digital codes store" },
      body: {
        ar: `${statusAr}\nالأنواع: بطاقات هدايا (Steam, PlayStation, Xbox, Google Play…)، شحن ألعاب مباشر عبر معرّف اللاعب (PUBG, Free Fire…)، مفاتيح ألعاب وبرامج، وأكواد اشتراكات. الدفع بالدولار/USDT عبر NOWPayments بدون حساب. الحد الأقصى للطلب الواحد ${fmtUsd(MAX_DIGITAL_ORDER_USD)}، وبطاقات الهدايا حتى ${fmtUsd(MAX_GIFT_CARD_PRICE_USD)}. تحقّق دائماً من منطقة حسابك قبل الشراء — البطاقات مرتبطة بالمنطقة.`,
        en: `${statusEn}\nKinds: gift cards (Steam, PlayStation, Xbox, Google Play…), direct game top-ups via Player ID (PUBG, Free Fire…), game & software keys, and subscription codes. Pay in USD/USDT via NOWPayments, no account needed. Max ${fmtUsd(MAX_DIGITAL_ORDER_USD)} per order, gift cards up to ${fmtUsd(MAX_GIFT_CARD_PRICE_USD)}. Always check your account region before buying — cards are region-locked.`,
      },
      keywords: kw("codes", "code", "كود", "اكواد", "أكواد", "digital", "رقمي", "رقمية", "gift card", "gift cards", "carte cadeau", "بطاقة", "بطاقات", "هدايا", "top-up", "topup", "recharge", "شحن", "key", "keys", "clé", "مفتاح", "مفاتيح", "store", "boutique", "متجر", "steam", "playstation", "psn", "xbox", "google play", "itunes", "apple", "pubg", "free fire", "roblox", "netflix", "spotify", "game", "games", "jeu", "jeux", "لعبة", "العاب", "ألعاب", "region", "منطقة", "région"),
      weight: 1.1,
    },
    {
      id: "digital-delivery",
      section: "digital",
      path: "/codes/commande",
      title: { ar: "تسليم الأكواد وتتبع الطلب", en: "Code delivery & order tracking" },
      body: {
        ar: `بعد تأكيد الدفع بالكريبتو: بطاقات الهدايا ومفاتيح البرامج وأكواد الاشتراكات تظهر في صفحة تتبع الطلب وتُرسل بالبريد الإلكتروني (عادة خلال دقائق، وحتى بضع ساعات في الذروة). شحن الألعاب (game top-up) يُضاف مباشرة إلى حساب اللعبة عبر معرّف اللاعب Player ID — لا يُرسل كود. تتبّع طلبك من صفحة «طلبي» بالمرجع ref والرمز t من بريد التأكيد، أو من نفس الجهاز الذي طلبت منه.`,
        en: `After crypto payment confirms: gift cards, software keys and subscription codes appear on the order tracking page and are emailed (usually within minutes, up to a few hours at peak). Game top-ups are credited directly to the game account via the Player ID — no code is sent. Track your order on the "My order" page with the reference ref and token t from the confirmation email, or from the same device you ordered on.`,
      },
      keywords: kw("delivery", "livraison", "تسليم", "استلام", "order", "commande", "طلب", "طلبي", "track", "tracking", "suivi", "تتبع", "player id", "معرف اللاعب", "email", "بريد", "when", "متى", "quand", "received", "وصل", "didn't receive", "لم يصل", "لم يصلني", "pas reçu", "where is my", "أين طلبي", "où est ma commande"),
      weight: 1.3,
    },
    {
      id: "digital-refund",
      section: "digital",
      path: "/remboursement",
      title: { ar: "استرداد الأكواد الرقمية", en: "Digital codes refund rules" },
      body: {
        ar: `الأكواد الرقمية لا تُسترد بعد التسليم (لأنها تُشترى من الموزّع الرسمي عند الطلب). إذا كان الكود غير صالح أو تالفاً، أبلغنا خلال 48 ساعة مع لقطة شاشة للخطأ ونستبدله بعد التحقق. لا نطلب أبداً كلمات مرور أو عبارات استرداد المحفظة.`,
        en: `Digital codes are non-refundable once delivered (they are bought from the official distributor on demand). If a code is invalid or damaged, report it within 48 hours with a screenshot of the error and we replace it after verification. We never ask for passwords or wallet recovery phrases.`,
      },
      keywords: kw("invalid", "not working", "ne marche pas", "لا يعمل", "غير صالح", "damaged", "used", "مستخدم", "replace", "replacement", "استبدال", "refund code", "استرداد"),
    },
  ];

  if (!degraded) {
    for (const product of products) {
      const denominations = product.denominations.filter((d) => d.available);
      const priceLine = (lang: "ar" | "en") =>
        denominations.length === 0
          ? lang === "ar" ? "غير متوفر حالياً" : "currently unavailable"
          : denominations
              .slice(0, 12)
              .map((d) => `${d.label}${d.region ? ` [${d.region}]` : ""} = ${fmtUsd(d.priceUsd)}`)
              .join(", ") + (denominations.length > 12 ? ", …" : "");
      const kindLabel = digitalCategories.find((c) => c.kind === product.kind);
      const isTopup = product.kind === "game_topup";
      const status = product.status === "coming_soon";
      const trimDot = (text: string) => text.trim().replace(/[.。]+$/, "");
      docs.push({
        id: `product-${product.slug}`,
        section: "product",
        path: `/codes/${product.slug}`,
        title: { ar: product.titleAr, en: product.titleEn },
        body: {
          ar: `${kindLabel?.ar ?? product.kind} — ${product.platform}${product.regions.length ? ` (${product.regions.join("، ")})` : ""}${status ? " — قريباً (غير متاح للطلب بعد)" : ""}.\n${product.descriptionAr}\nالقيم والأسعار: ${priceLine("ar")}.\nالتسليم: ${isTopup ? "شحن مباشر إلى حساب اللعبة عبر معرّف اللاعب" : trimDot(product.deliveryNoteAr) || "كود بالبريد وفي صفحة الطلب بعد تأكيد الدفع"}.`,
          en: `${kindLabel?.en ?? product.kind} — ${product.platform}${product.regions.length ? ` (${product.regions.join(", ")})` : ""}${status ? " — coming soon (not orderable yet)" : ""}.\n${product.descriptionEn}\nAmounts & prices: ${priceLine("en")}.\nDelivery: ${isTopup ? "direct top-up to the game account via Player ID" : trimDot(product.deliveryNoteEn) || "code by email and on the order page after payment confirms"}.`,
        },
        keywords: kw(product.slug.replace(/-/g, " "), product.platform, product.titleAr, product.titleEn, product.regions),
        weight: 1,
        platform: product.platform,
      });
    }
  }
  return docs;
}

function demoDocs(content: SiteContent, config: AssistantConfig): KnowledgeDoc[] {
  const demos: Demo[] = collectAllDemos(content);
  const overview: KnowledgeDoc = {
    id: "demos-overview",
    section: "demos",
    path: "/demos",
    title: { ar: "معرض الأعمال (مواقع حية)", en: "Portfolio (live demo websites)" },
    body: {
      ar: `${demos.length} موقعاً حقيقياً يمكن تصفحه مباشرة (حاسوب/هاتف) واختياره كنموذج للحجز:\n${demos.map((d) => `• ${d.title} (${d.sectorAr})`).join("\n")}`,
      en: `${demos.length} real websites you can browse live (desktop/mobile) and pick as a model to reserve:\n${demos.map((d) => `• ${d.titleEn} (${d.sectorEn})`).join("\n")}`,
    },
    keywords: kw("demo", "demos", "portfolio", "examples", "exemples", "réalisations", "معرض", "أعمال", "اعمال", "نماذج", "مواقع جاهزة", "showcase", "templates", "قوالب"),
    weight: 1.2,
  };
  const details: KnowledgeDoc[] = demos.map((demo) => {
    const plan = config.pricing.plans.find((p) => p.id === demo.planId);
    const b = plan ? resolvePlanPriceBreakdown(plan, demo.priceUsd ?? plan.priceUsd) : null;
    const priceAr = b?.totalPriceUsd != null ? `السعر: نموذج ${fmtUsd(b.modelPriceUsd)} + تخصيص ${fmtUsd(b.customizationUsd)} = ${fmtUsd(b.totalPriceUsd)}.` : "";
    const priceEn = b?.totalPriceUsd != null ? `Price: model ${fmtUsd(b.modelPriceUsd)} + customization ${fmtUsd(b.customizationUsd)} = ${fmtUsd(b.totalPriceUsd)}.` : "";
    return {
      id: `demo-${demo.slug}`,
      section: "demos",
      path: `/demos/${demo.slug}`,
      title: { ar: demo.title, en: demo.titleEn },
      body: {
        ar: `${demo.description}\nالقطاع: ${demo.sectorAr}${plan ? ` — الفئة: ${plan.name}` : ""}. ${priceAr}\nالمميزات: ${demo.features.join("، ")}.`,
        en: `${demo.descriptionEn}\nSector: ${demo.sectorEn}${plan ? ` — Category: ${plan.nameEn}` : ""}. ${priceEn}\nFeatures: ${demo.featuresEn.join(", ")}.`,
      },
      keywords: kw(demo.slug.replace(/-/g, " "), demo.title, demo.titleEn, demo.sectorAr, demo.sectorEn),
      weight: 0.9,
    };
  });
  return [overview, ...details];
}

function sectorDocs(): KnowledgeDoc[] {
  const list = Object.values(sectorSeo);
  const overview: KnowledgeDoc = {
    id: "sectors-overview",
    section: "sectors",
    path: "/sectors",
    title: { ar: "مواقع حسب القطاع", en: "Websites by sector" },
    body: {
      ar: `نصمم مواقع مخصصة لـ ${list.length} قطاعات: ${list.map((s) => s.labelAr).join("، ")}. لكل قطاع صفحة تشرح المميزات المناسبة وأسئلة شائعة.`,
      en: `We build tailored websites for ${list.length} sectors: ${list.map((s) => s.labelEn).join(", ")}. Each sector page explains the relevant features and FAQs.`,
    },
    keywords: kw("sector", "sectors", "secteur", "industry", "قطاع", "قطاعات", "مجال"),
    weight: 1.1,
  };
  const details: KnowledgeDoc[] = list.map((sector) => ({
    id: `sector-${sector.id}`,
    section: "sectors",
    path: `/sectors/${sector.id}`,
    title: { ar: sector.h1Ar, en: sector.h1En },
    body: {
      ar: `${sector.heroSubtitleAr}\n${joinFaqs(sector.faqsAr, "ar")}`,
      en: `${sector.heroSubtitleEn}\n${joinFaqs(sector.faqsAr, "en")}`,
    },
    keywords: kw(sector.id, sector.labelAr, sector.labelEn, sector.keywordsAr, sector.keywordsEn),
  }));
  return [overview, ...details];
}

function comparisonDocs(config: AssistantConfig): KnowledgeDoc[] {
  const list = Object.values(comparisons);
  const overview: KnowledgeDoc = {
    id: "compare-overview",
    section: "compare",
    path: "/compare",
    title: { ar: "مقارنات صادقة", en: "Honest comparisons" },
    body: {
      ar: `مقارنات بين موقع نخبة والبدائل: ${list.map((c) => c.competitorAr).join("، ")} — مع متى يكون البديل أنسب لك.`,
      en: `Comparisons between a Nukhba website and alternatives: ${list.map((c) => c.competitorEn).join(", ")} — including when the alternative is the better pick.`,
    },
    keywords: kw("compare", "comparison", "comparatif", "vs", "versus", "مقارنة", "alternative", "بديل"),
  };
  const details: KnowledgeDoc[] = list.map((c) => ({
    id: `compare-${c.id}`,
    section: "compare",
    path: `/compare/${c.id}`,
    title: {
      ar: comparisonText(c.h1Ar, config.market, "ar"),
      en: comparisonText(c.h1En, config.market, "en"),
    },
    body: {
      ar: `${comparisonText(c.answerAr, config.market, "ar")}\nاختر ${c.competitorAr} إذا: ${c.chooseThemAr.join("؛ ")}.\nاختر نخبة إذا: ${c.chooseUsAr.join("؛ ")}.\n${joinFaqs(c.faqs, "ar")}`,
      en: `${comparisonText(c.answerEn, config.market, "en")}\nChoose ${c.competitorEn} if: ${c.chooseThemEn.join("; ")}.\nChoose Nukhba if: ${c.chooseUsEn.join("; ")}.\n${joinFaqs(c.faqs, "en")}`,
    },
    keywords: kw(c.id.replace(/-/g, " "), c.competitorAr, c.competitorEn, c.keywordsAr, c.keywordsEn),
  }));
  return [overview, ...details];
}

function blogDocs(): KnowledgeDoc[] {
  return [
    {
      id: "blog-overview",
      section: "blog",
      path: "/blog",
      title: { ar: "المدونة — أدلة عملية", en: "Blog — practical guides" },
      body: {
        ar: blogArticles.map((a) => `• ${a.h1Ar} (${a.categoryAr})`).join("\n"),
        en: blogArticles.map((a) => `• ${a.h1En} (${a.categoryEn})`).join("\n"),
      },
      keywords: kw("blog", "article", "articles", "guide", "guides", "مقال", "مقالات", "مدونة", "دليل"),
    },
    ...blogArticles.map<KnowledgeDoc>((a) => ({
      id: `blog-${a.slug}`,
      section: "blog",
      path: `/blog/${a.slug}`,
      title: { ar: a.h1Ar, en: a.h1En },
      body: {
        ar: `${a.answerAr}\nحقائق: ${a.keyFacts.map((f) => `${f.labelAr ?? ""} ${f.valueAr ?? ""}`.trim()).filter(Boolean).join("؛ ")}\n${joinFaqs(a.faqs, "ar")}`,
        en: `${a.answerEn}\nKey facts: ${a.keyFacts.map((f) => `${f.labelEn ?? ""} ${f.valueEn ?? ""}`.trim()).filter(Boolean).join("; ")}\n${joinFaqs(a.faqs, "en")}`,
      },
      keywords: kw(a.slug.replace(/-/g, " "), a.keywordsAr, a.keywordsEn, a.categoryAr, a.categoryEn),
    })),
  ];
}

function showcaseDocs(content: SiteContent): KnowledgeDoc[] {
  const make = (
    section: "apps" | "products",
    path: string,
    page: SiteContent["appsPage"],
    keywords: string[],
  ): KnowledgeDoc[] => [
    {
      id: `${section}-overview`,
      section,
      path,
      title: { ar: page.titleAr, en: page.titleEn },
      body: {
        ar: `${page.statusBadgeAr}. ${page.subtitleAr}\n${page.bannerNoteAr}\n${page.items.map((i) => `• ${i.titleAr} — ${i.badgeAr} (${i.categoryAr})`).join("\n")}`,
        en: `${page.statusBadgeEn}. ${page.subtitleEn}\n${page.bannerNoteEn}\n${page.items.map((i) => `• ${i.titleEn} — ${i.badgeEn} (${i.categoryEn})`).join("\n")}`,
      },
      keywords: kw(keywords),
    },
    ...page.items.map<KnowledgeDoc>((item) => ({
      id: `${section}-${item.slug}`,
      section,
      path,
      title: { ar: item.titleAr, en: item.titleEn },
      body: {
        ar: `${item.badgeAr} — ${item.categoryAr} (${item.platforms.join("، ")}). ${item.descriptionAr}\nالمميزات: ${item.featuresAr.join("، ")}.${item.priceHintUsd ? ` السعر التقريبي: ${fmtUsd(item.priceHintUsd)}.` : " السعر يُعلن عند الإطلاق."}`,
        en: `${item.badgeEn} — ${item.categoryEn} (${item.platforms.join(", ")}). ${item.descriptionEn}\nFeatures: ${item.featuresEn.join(", ")}.${item.priceHintUsd ? ` Indicative price: ${fmtUsd(item.priceHintUsd)}.` : " Pricing announced at launch."}`,
      },
      keywords: kw(item.slug.replace(/-/g, " "), item.titleAr, item.titleEn, item.categoryAr, item.categoryEn),
      weight: 0.9,
    })),
  ];
  return [
    ...make("apps", "/apps", content.appsPage, ["app", "apps", "application", "applications", "تطبيق", "تطبيقات", "mobile", "ios", "android", "clinic app", "shop app"]),
    ...make("products", "/products", content.productsPage, ["software", "logiciel", "logiciels", "برنامج", "برامج", "products", "produits", "منتجات", "pos", "crm", "erp", "medsuite", "kits", "cloud"]),
  ];
}

function generalDocs(config: AssistantConfig, content: SiteContent): KnowledgeDoc[] {
  const market = config.market;
  const steps = content.process;
  const faqs = content.faqs;
  const whatsappHref = whatsappLink(config.whatsapp);
  return [
    {
      id: "about",
      section: "general",
      path: "/creation-sites",
      title: { ar: `من نحن — ${config.nameAr} ${config.name}`, en: `About — ${config.nameAr} ${config.name}` },
      body: {
        ar: `${config.nameAr} (${config.name}) وكالة مواقع فاخرة مقرها ${market.cityAr}، ${market.countryAr}، وتخدم عملاء من كل العالم عن بُعد. ${content.hero.subtitleAr}\nلماذا نخبة؟\n${content.whyUs.map((w) => `• ${w.titleAr}: ${w.descAr}`).join("\n")}\nكل موقع ثنائي اللغة (عربي + إنجليزي)، متجاوب، محسّن لجوجل والمساعدات الذكية، مع ثيمات ألوان ووضع داكن/فاتح.`,
        en: `${config.nameAr} (${config.name}) is a premium web agency based in ${market.cityEn}, ${market.countryEn}, serving clients worldwide remotely. ${content.hero.subtitleEn}\nWhy Nukhba?\n${content.whyUs.map((w) => `• ${w.titleEn}: ${w.descEn}`).join("\n")}\nEvery website is bilingual (Arabic + English), responsive, optimized for Google and AI assistants, with color themes and dark/light mode.`,
      },
      keywords: kw("about", "who", "qui", "من انتم", "من أنتم", "نخبة", "nukhba", "agency", "agence", "وكالة", "why", "pourquoi", "لماذا", "website creation", "création de site", "إنشاء موقع", "تصميم موقع", "create", "créer", "build", "design", "language", "langue", "bilingual", "arabic", "english", "عربي", "انجليزي", "theme", "dark", "داكن", "ثيم", "responsive", "mobile"),
      weight: 1.1,
    },
    {
      id: "process",
      section: "general",
      path: "/creation-sites",
      title: { ar: "خطوات العمل والتسليم", en: "Process & delivery timeline" },
      body: {
        ar: `${steps.map((s) => `${s.num}. ${s.titleAr} (${s.durationAr}): ${s.descAr}`).join("\n")}\nالمدة الإجمالية: الواجهة ~7 أيام، الواجهة بلس ~10 أيام، المتجر/الحجز 14–21 يوماً. نبدأ فور تأكيد العربون ونرسل معاينة قابلة للتصفح خلال المشروع، مع جولتي مراجعة مشمولتين. بعد التسليم: دعم مجاني 30–90 يوماً حسب الباقة، ثم صيانة اختيارية عبر الاشتراكات.`,
        en: `${steps.map((s) => `${s.num}. ${s.titleEn} (${s.durationEn}): ${s.descEn}`).join("\n")}\nTotal: Vitrine ~7 days, Vitrine+ ~10 days, Boutique/Booking 14–21 days. We start as soon as the deposit is confirmed and share a browsable preview during the project, with 2 revision rounds included. After delivery: free support 30–90 days by plan, then optional maintenance via subscriptions.`,
      },
      keywords: kw("process", "steps", "étapes", "خطوات", "مراحل", "how long", "delivery time", "délai", "durée", "مدة", "تسليم", "كم يستغرق", "days", "jours", "أيام", "revision", "révision", "مراجعة", "support", "دعم", "training", "تدريب", "edit", "modifier", "تعديل", "dashboard", "لوحة"),
      weight: 1.2,
    },
    {
      id: "faq",
      section: "faq",
      path: "/creation-sites",
      title: { ar: "أسئلة شائعة", en: "Frequently asked questions" },
      body: { ar: joinFaqs(faqs, "ar"), en: joinFaqs(faqs, "en") },
      keywords: kw("faq", "questions", "أسئلة", "seo", "google", "جوجل", "domain", "domaine", "دومين", "نطاق", "hosting", "استضافة", "edit content", "maintenance", "صيانة", "design", "تصميم", "satisfaction"),
    },
    {
      id: "contact",
      section: "contact",
      path: whatsappHref,
      external: true,
      title: { ar: "التواصل وساعات العمل", en: "Contact & opening hours" },
      body: {
        ar: `واتساب/هاتف: ${config.phone} — البريد: ${config.email} — العنوان: ${config.address} (نخدم العالم كله عن بُعد). ساعات العمل: ${config.hours} (توقيت ${market.timezone}). نرد عادةً خلال ساعتين في أوقات العمل. يمكنك أيضاً إرسال طلب عرض سعر من صفحة «اتصل بنا». إنستغرام/فيسبوك/تيك توك: nukhba.ly.`,
        en: `WhatsApp/phone: ${config.phone} — email: ${config.email} — address: ${config.addressEn} (we serve clients worldwide remotely). Hours: ${config.hoursEn} (${market.timezone} time). We usually reply within 2 hours during working hours. You can also request a quote from the Contact page. Instagram/Facebook/TikTok: nukhba.ly.`,
      },
      keywords: kw("contact", "contacter", "تواصل", "اتصل", "اتصال", "whatsapp", "واتساب", "phone", "téléphone", "هاتف", "رقم", "email", "e-mail", "بريد", "ايميل", "address", "adresse", "عنوان", "location", "where", "où", "أين", "hours", "horaires", "ساعات", "دوام", "مفتوح", "open", "human", "humain", "إنسان", "بشري", "talk", "parler", "quote", "devis", "عرض سعر", "tripoli", "طرابلس", "libya", "libye", "ليبيا", "instagram", "facebook", "tiktok"),
      weight: 1.3,
    },
    {
      id: "terms",
      section: "legal",
      path: "/conditions",
      title: { ar: "الشروط والأحكام", en: "Terms & conditions of sale" },
      body: {
        ar: "الأسعار بالدولار وتُدفع بالكريبتو عبر NOWPayments (1 دولار = 1 USDT). يُؤكَّد الطلب عند استلام العربون أو أول دفعة اشتراك. العربون يُخصم من الإجمالي ولا يُسترد بعد بدء العمل إلا بخطأ واضح من نخبة. الاشتراك الشهري كل 30 يوماً والسنوي كل 365 يوماً، تذكير قبل 3 أيام، سماح 5 أيام كحد أقصى، إلغاء في أي وقت. ملكية الموقع تنتقل للعميل بعد سداد كامل المبلغ (قبل ذلك تحتفظ نخبة بالحقوق)، ويجوز لنخبة عرض المشروع في معرض أعمالها ما لم يُتفق كتابياً على خلاف ذلك. يُعتبر الموقع مقبولاً إذا لم يرسل العميل ملاحظات خلال 7 أيام من مشاركة النسخة التجريبية. المسؤولية محدودة بالمبلغ المدفوع. البيانات الشخصية تُستخدم للخدمة فقط ولا تُباع. القانون الليبي ومحاكم طرابلس هي المرجع.",
        en: "Prices in USD, paid in crypto via NOWPayments (1 USD = 1 USDT). An order is confirmed once the deposit or first subscription payment is received. The deposit is deducted from the total and not refunded once work has started unless Nukhba is clearly at fault. Monthly subscriptions renew every 30 days, annual every 365 days, reminder 3 days before, grace period at most 5 days, cancel anytime. Website ownership passes to the client once all amounts are paid in full (until then Nukhba keeps the rights); Nukhba may show the project in its portfolio unless agreed otherwise in writing. The website is deemed accepted if no feedback is sent within 7 days of the test version. Liability is limited to the amount paid. Personal data is used only to provide the service and never sold. Libyan law applies, courts of Tripoli.",
      },
      keywords: kw("terms", "conditions", "cgv", "شروط", "أحكام", "legal", "légal", "قانوني", "law", "loi", "قانون", "ownership", "owns", "own", "owner", "who owns", "qui est propriétaire", "من يملك", "ملكية الموقع", "propriété", "propriétaire", "ملكية", "مالك", "يملك", "intellectual", "copyright", "حقوق", "data", "données", "بيانات", "privacy", "خصوصية", "liability", "responsabilité", "مسؤولية", "acceptance", "قبول"),
    },
    {
      id: "refund",
      section: "legal",
      path: "/remboursement",
      title: { ar: "سياسة الاسترداد والضمان", en: "Refund policy & guarantee" },
      body: {
        ar: "• العربون يُخصم من السعر ولا يُسترد بعد بدء العمل إلا بخطأ واضح من نخبة.\n• الاشتراكات: الإلغاء في أي وقت من صفحة المتابعة؛ يبقى الوصول حتى نهاية الفترة المدفوعة ولا تُسترد الفترة الحالية.\n• ضمان الاسترداد الكامل: إذا لم يُسلَّم الموقع وفق المواصفات المتفق عليها كتابياً، يُطبَّق ضمان الاسترداد الكامل المعلن.\n• الأكواد الرقمية: لا تُسترد بعد التسليم؛ استبدال خلال 48 ساعة إذا كان الكود غير صالح (مع لقطة شاشة).\n• لطلب الاسترداد: راسلنا بالبريد أو واتساب مع مرجع الطلب والبريد وتاريخ الدفع والمبلغ ومرجع المعاملة والسبب. لا ترسل أبداً كلمات مرور أو مفاتيح خاصة.",
        en: "• The deposit is deducted from the price and not refunded once work has started, unless Nukhba is clearly at fault.\n• Subscriptions: cancel anytime from the tracking page; access stays until the end of the paid period, the current period is not refunded.\n• Full-refund guarantee: if the website is not delivered to the agreed written specifications, the advertised full-refund guarantee applies.\n• Digital codes: non-refundable once delivered; replacement within 48 hours if the code is invalid (with a screenshot).\n• To request a refund: email or WhatsApp us with the order reference, purchase email, payment date, amount, transaction reference and reason. Never send passwords or private keys.",
      },
      keywords: kw("refund", "remboursement", "rembourser", "استرداد", "استرجاع", "ارجاع", "إرجاع", "guarantee", "garantie", "ضمان", "money back", "cancel", "annuler", "إلغاء", "not satisfied", "pas satisfait", "لم يعجبني"),
      weight: 1.1,
    },
    {
      id: "badge",
      section: "legal",
      path: "/badge",
      title: { ar: "شارة «موقع من تصميم نخبة»", en: "“Website by Nukhba” badge" },
      body: {
        ar: "شارة صغيرة اختيارية في تذييل مواقع عملائنا تشير إلى أن الموقع من تصميم نخبة (رابط rel=\"sponsored nofollow\"). العميل حر في إزالتها في أي وقت دون أي تأثير على خدمته، وصفحة /badge تعرض المواقع التي تعرضها حالياً.",
        en: "A small optional badge in the footer of client websites stating the site was built by Nukhba (link with rel=\"sponsored nofollow\"). Clients may remove it at any time with no impact on their service; the /badge page lists the websites currently displaying it.",
      },
      keywords: kw("badge", "شارة", "footer", "تذييل", "credit", "crédit", "built by", "website by", "من تصميم", "backlink"),
      weight: 0.8,
    },
    {
      id: "testimonials",
      section: "general",
      path: "/creation-sites",
      title: { ar: "آراء العملاء", en: "Client testimonials" },
      body: {
        ar: content.testimonials.map((t) => `• ${t.name} (${t.role}): «${t.text}»`).join("\n"),
        en: content.testimonials.map((t) => `• ${t.nameEn} (${t.roleEn}): “${t.textEn}”`).join("\n"),
      },
      keywords: kw("testimonial", "testimonials", "reviews", "avis", "témoignages", "آراء", "تقييمات", "شهادات", "clients", "عملاء", "results", "résultats", "نتائج"),
      weight: 0.8,
    },
  ];
}

/* ───────────────────────── Résumé compact (LLM) ─────────────────────────── */

function buildCore(input: KnowledgeInput, docs: KnowledgeDoc[], productCount: number): string {
  const { config, content, degraded } = input;
  const plans = config.pricing.plans.map((plan) => {
    const b = resolvePlanPriceBreakdown(plan);
    return `${plan.nameEn} (${plan.id}): model ${fmtUsd(b.modelPriceUsd)} + ${b.customizationPercent ?? "?"}% customization ${fmtUsd(b.customizationUsd)} = total ${fmtUsd(b.totalPriceUsd)}${b.totalPriceUsd == null ? " (customization quoted)" : ""}`;
  });
  const subs = (["vitrine", "vitrine-plus", "boutique"] as const).map((tier) => {
    const m = SUBSCRIPTION_PLANS.find((p) => p.tier === tier && p.cycle === "monthly");
    const a = SUBSCRIPTION_PLANS.find((p) => p.tier === tier && p.cycle === "annual");
    return `${m?.nameEn}: ${fmtUsd(m?.priceUsd)}/mo or ${fmtUsd(a?.priceUsd)}/yr`;
  });
  const demos = collectAllDemos(content);
  return [
    `SITE: ${config.nameAr} / ${config.name} — ${config.tagline}. Premium web agency in ${config.market.cityEn}, ${config.market.countryEn}; serves clients worldwide remotely. Site URL: ${config.url}. Languages served: Arabic + English.`,
    `CONTACT: phone/WhatsApp ${config.phone} (${whatsappLink(config.whatsapp)}), email ${config.email}, address ${config.addressEn}. Hours: ${config.hoursEn} (${config.market.timezone}). Never claim 24/7 human support, client counts, ratings or any statistic not listed here.`,
    `WEBSITE PLANS (USD, 1 USD = 1 USDT; /pricing, /creation-sites): ${plans.join(" | ")}. Includes 1st-year Vercel hosting + domain connection (domain ~$12/yr bought by the client). Delivery: Vitrine ~7 days, Vitrine+ ~10, Boutique 14–21. 2 revision rounds. Free support 30–90 days by plan. Reservation deposit ${fmtUsd(config.reservation?.depositUsd ?? 1)} deducted from the price (pick a model on /demos). Flexible payment ${fmtUsd(config.flexiblePayment.minUsd)}–${fmtUsd(config.flexiblePayment.maxUsd)}. Installments: 1, 2 or 3. Payment only in crypto via NOWPayments (USDT or 300+ coins) — no cards/PayPal/cash. Photo guide: ${CRYPTO_GUIDE_PATH}.`,
    `SUBSCRIPTIONS (/abonnements, optional renewal of hosting/maintenance): ${subs.join(" | ")}. Monthly = 30 days, annual = 365 days; renewal link by email, reminder 3 days before; grace period max ${SUBSCRIPTION_GRACE_DAYS} days; cancel anytime on /abonnements/suivi (link with ref + t); current period non-refundable.`,
    `OPEN SERVICES (/services/<id>): ${config.standaloneServices.map((s) => `${s.titleEn} [${s.id}] from ${fmtUsd(s.priceFromUsd)}`).join("; ")}.`,
    `DIGITAL CODES STORE (/codes, /codes/<slug>, /codes/category/<kind>, tracking /codes/commande): ${degraded ? "TEMPORARILY UNAVAILABLE — catalog unreachable; do NOT quote product prices or stock; offer WhatsApp." : `${productCount} products live`}. Kinds: gift_card, game_topup (credited directly to the game via Player ID — no code emailed), software_key, subscription_code (code shown on /codes/commande and emailed after payment confirmation and delivery). Payment: crypto via NOWPayments; Libyana/Al Madar phone recharge card / mobile balance is ${config.fazercards?.phoneCardPaymentsEnabled !== false ? "ENABLED, with mandatory manual verification — never instant acceptance" : "TEMPORARILY PAUSED — do not ask for recharge codes; crypto remains available and existing orders remain processable; no return date announced"}. Max ${fmtUsd(MAX_DIGITAL_ORDER_USD)} per order, gift cards ≤ ${fmtUsd(MAX_GIFT_CARD_PRICE_USD)}. Region-locked; non-refundable once delivered; invalid code → replacement within 48h with screenshot. Codes come from the official distributor on demand. Never ask for passwords/seed phrases.`,
    `PORTFOLIO (/demos/<slug>): ${demos.length} live demos — ${demos.map((d) => `${d.titleEn} (${d.slug}, ${d.sectorEn})`).join("; ")}.`,
    `SECTORS (/sectors/<id>): ${Object.values(sectorSeo).map((s) => `${s.labelEn} [${s.id}]`).join(", ")}. COMPARISONS (/compare/<id>): ${Object.values(comparisons).map((c) => `${c.competitorEn} [${c.id}]`).join(", ")}. BLOG (/blog/<slug>): ${blogArticles.map((a) => `${a.h1En} [${a.slug}]`).join("; ")}.`,
    `UPCOMING APPS (/apps): ${content.appsPage.items.map((i) => `${i.titleEn} (${i.badgeEn})`).join("; ")}. UPCOMING SOFTWARE (/products): ${content.productsPage.items.map((i) => `${i.titleEn} (${i.badgeEn})`).join("; ")}. No prices announced yet.`,
    `LEGAL: /conditions (terms), /remboursement (refund policy: deposit non-refundable once work started unless Nukhba at fault; full-refund guarantee if agreed specs not delivered; site deemed accepted after 7 days without feedback; ownership transfers on full payment; Libyan law, Tripoli courts), /badge (optional removable footer badge), /contact.`,
    `INDEX: ${docs.length} knowledge entries available; detailed entries relevant to the question follow.`,
  ].join("\n");
}

/* ───────────────────────── API publique ─────────────────────────────────── */

/** Construit l'index complet du site. */
export function buildSiteKnowledge(input: KnowledgeInput): SiteKnowledge {
  const degraded = Boolean(input.degraded);
  const products = input.digitalProducts ?? [];
  const docs: KnowledgeDoc[] = [
    ...generalDocs(input.config, input.content),
    ...planDocs(input.config),
    ...paymentDocs(input.config),
    ...subscriptionDocs(),
    ...serviceDocs(input.config),
    ...digitalDocs(products, degraded),
    ...demoDocs(input.content, input.config),
    ...sectorDocs(),
    ...comparisonDocs(input.config),
    ...blogDocs(),
    ...showcaseDocs(input.content),
  ];
  const productCount = degraded ? 0 : products.length;
  return {
    docs,
    core: buildCore(input, docs, productCount),
    degraded,
    whatsappHref: whatsappLink(input.config.whatsapp),
    productCount,
    phoneCardPaymentsEnabled: input.config.fazercards?.phoneCardPaymentsEnabled !== false,
  };
}

export interface SearchHit {
  doc: KnowledgeDoc;
  score: number;
}

/** Recherche lexicale pondérée (titre > mots-clés > corps). */
export function searchKnowledge(knowledge: SiteKnowledge, query: string, limit = 6): SearchHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const expanded = expandQuery(tokens);
  const normalizedQuery = normalizeText(query);

  const hits: SearchHit[] = [];
  for (const doc of knowledge.docs) {
    let score = 0;
    const title = normalizeText(`${doc.title.ar} ${doc.title.en}`);
    const titleTokens = new Set(tokenize(title));
    const bodyTokens = new Set(tokenize(`${doc.body.ar} ${doc.body.en}`));

    for (const keyword of doc.keywords) {
      // Expression complète présente telle quelle dans la question.
      if (keyword.includes(" ") && normalizedQuery.includes(keyword)) score += 6;
    }
    const keywordTokens = new Set(doc.keywords.flatMap((k) => tokenize(k)));

    const platformTokens = doc.section === "product" ? new Set(tokenize(doc.platform ?? "")) : null;
    for (const token of tokens) {
      if (platformTokens?.has(token)) score += 6;
      if (titleTokens.has(token)) score += 5;
      if (keywordTokens.has(token)) score += 4;
      else if (bodyTokens.has(token)) score += 1.5;
    }
    // Synonymes : apport plafonné pour qu'un grand groupe (codes, contact…)
    // n'écrase pas la correspondance directe d'un titre ou d'une plateforme.
    let synonymScore = 0;
    for (const token of expanded) {
      if (tokens.includes(token)) continue;
      if (platformTokens?.has(token)) score += 6; // marque citée en arabe
      if (keywordTokens.has(token)) synonymScore += 2;
      else if (titleTokens.has(token)) synonymScore += 2;
      else if (bodyTokens.has(token)) synonymScore += 0.5;
    }
    score += Math.min(synonymScore, 6);
    if (score > 0) hits.push({ doc, score: score * (doc.weight ?? 1) });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

const GREETING_RE =
  /^(hi|hello|hey|yo|bonjour|salut|bonsoir|coucou|مرحبا|مرحباً|اهلا|أهلا|أهلاً|اهلاً|السلام عليكم|سلام|هلا|صباح الخير|مساء الخير|good (morning|evening|afternoon))[\s!.،,؟?]*$/i;
const THANKS_RE = /^(thanks|thank you|merci|شكرا|شكراً|يعطيك العافية|ok|okay|d'accord|تمام)[\s!.،,]*$/i;

const UI = {
  ar: {
    greeting: "مرحبًا 👋 أنا مساعد نخبة. أجيبك عن كل ما في الموقع: تصميم المواقع وأسعارها، الدفع بالكريبتو، الاشتراكات، الخدمات المفتوحة، متجر الأكواد الرقمية، معرض الأعمال، القطاعات، المقارنات، المدونة، الشروط والاسترداد. ما سؤالك؟",
    thanks: "على الرحب والسعة 🌟 إن احتجت أي شيء آخر فأنا هنا، أو راسلنا على واتساب.",
    unknown: "لم أجد إجابة دقيقة لهذا السؤال في محتوى الموقع. يمكنك إعادة صياغته، أو اختيار أحد المواضيع أدناه، أو التحدث مباشرة مع فريقنا على واتساب.",
    more: "تفاصيل ذات صلة",
    open: "افتح الصفحة",
    whatsapp: "تواصل عبر واتساب",
    degraded: "ملاحظة: متجر الأكواد غير متاح مؤقتاً، لذا لا يمكنني تأكيد الأسعار أو التوفر الآن.",
  },
  en: {
    greeting: "Hi 👋 I'm the Nukhba assistant. I can answer anything on this site: website design & pricing, crypto payment, subscriptions, open services, the digital codes store, portfolio, sectors, comparisons, blog, terms and refunds. What would you like to know?",
    thanks: "You're welcome 🌟 I'm here if you need anything else, or message us on WhatsApp.",
    unknown: "I couldn't find a precise answer to that in the site content. Try rephrasing, pick one of the topics below, or talk directly to our team on WhatsApp.",
    more: "Related details",
    open: "Open the page",
    whatsapp: "Chat on WhatsApp",
    degraded: "Note: the codes store is temporarily unavailable, so I can't confirm prices or stock right now.",
  },
  fr: {
    greeting: "Bonjour 👋 Je suis l'assistant Nukhba. Je réponds à tout ce qui concerne le site : création de sites et tarifs, paiement crypto, abonnements, services à la carte, boutique de codes digitaux, portfolio, secteurs, comparatifs, blog, conditions et remboursements. Que souhaitez-vous savoir ?",
    thanks: "Avec plaisir 🌟 Je reste disponible, ou écrivez-nous sur WhatsApp.",
    unknown: "Je n'ai pas trouvé de réponse précise dans le contenu du site. Reformulez votre question, choisissez un sujet ci-dessous, ou parlez directement à notre équipe sur WhatsApp.",
    more: "Détails liés (contenu du site en anglais)",
    open: "Ouvrir la page",
    whatsapp: "Discuter sur WhatsApp",
    degraded: "Remarque : la boutique de codes est momentanément indisponible, je ne peux donc pas confirmer les prix ou le stock.",
  },
} as const;

/** Sujets de départ (puces) dans la langue demandée. */
export function starterSuggestions(lang: AssistantLang): string[] {
  if (lang === "ar") {
    return ["كم سعر الموقع؟", "كيف أدفع بـ USDT؟", "ما هي الاشتراكات؟", "كيف أشتري بطاقة هدايا؟", "أين طلبي؟", "ما خدماتكم المفتوحة؟", "سياسة الاسترداد", "أريد التحدث مع إنسان"];
  }
  if (lang === "fr") {
    return ["Combien coûte un site ?", "Comment payer en USDT ?", "Quels abonnements ?", "Acheter une carte cadeau", "Où est ma commande ?", "Vos services à la carte", "Politique de remboursement", "Parler à un humain"];
  }
  return ["How much is a website?", "How do I pay with USDT?", "What are the subscriptions?", "Buy a gift card", "Where is my order?", "Your open services", "Refund policy", "Talk to a human"];
}

function docTitle(doc: KnowledgeDoc, lang: AssistantLang): string {
  return lang === "ar" ? doc.title.ar : doc.title.en;
}
function docBody(doc: KnowledgeDoc, lang: AssistantLang): string {
  return lang === "ar" ? doc.body.ar : doc.body.en;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastBreak = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". "), cut.lastIndexOf("۔"));
  return `${cut.slice(0, lastBreak > max * 0.5 ? lastBreak + 1 : max).trimEnd()}…`;
}

/** Suggestions de suivi : fiches de la même section puis fiches de synthèse. */
function followUps(knowledge: SiteKnowledge, hits: SearchHit[], lang: AssistantLang): string[] {
  const used = new Set(hits.slice(0, 1).map((h) => h.doc.id));
  const out: string[] = [];
  for (const hit of hits.slice(1, 4)) {
    if (!used.has(hit.doc.id)) {
      used.add(hit.doc.id);
      out.push(docTitle(hit.doc, lang));
    }
  }
  const starters = starterSuggestions(lang);
  for (const starter of starters) {
    if (out.length >= 4) break;
    if (!out.includes(starter)) out.push(starter);
  }
  return out.slice(0, 4);
}

/**
 * Réponse déterministe sans LLM : fiche la plus pertinente + extrait des
 * suivantes, bouton vers la page concernée et WhatsApp.
 */
export function answerLocally(
  knowledge: SiteKnowledge,
  query: string,
  lang: AssistantLang,
): AssistantReply {
  const ui = UI[lang];
  const trimmed = query.trim();
  const whatsapp: AssistantAction = { label: ui.whatsapp, href: knowledge.whatsappHref, external: true };

  if (!trimmed || GREETING_RE.test(trimmed)) {
    return { text: ui.greeting, actions: [], suggestions: starterSuggestions(lang), mode: "local" };
  }
  if (THANKS_RE.test(trimmed)) {
    return { text: ui.thanks, actions: [whatsapp], suggestions: starterSuggestions(lang).slice(0, 4), mode: "local" };
  }

  const hits = searchKnowledge(knowledge, trimmed, 5);
  if (hits.length === 0 || hits[0].score < 3) {
    return { text: ui.unknown, actions: [whatsapp], suggestions: starterSuggestions(lang), mode: "local" };
  }

  const best = hits[0].doc;
  const parts: string[] = [`${docTitle(best, lang)}\n${clip(docBody(best, lang), 900)}`];
  const related = hits.slice(1, 3).filter((h) => h.score >= hits[0].score * 0.45 && h.doc.section !== "product");
  if (related.length > 0) {
    parts.push(`${ui.more}:\n${related.map((h) => `• ${docTitle(h.doc, lang)} — ${clip(docBody(h.doc, lang).split("\n")[0], 160)}`).join("\n")}`);
  }
  if (knowledge.degraded && (best.section === "digital" || best.section === "product")) {
    parts.push(ui.degraded);
  }

  const actions: AssistantAction[] = [];
  if (best.external) actions.push({ label: ui.whatsapp, href: best.path, external: true });
  else {
    actions.push({ label: `${ui.open} — ${docTitle(best, lang)}`.slice(0, 60), href: best.path });
    if (best.section === "contact" || best.section === "legal" || best.section === "digital") actions.push(whatsapp);
  }

  return { text: parts.join("\n\n"), actions, suggestions: followUps(knowledge, hits, lang), mode: "local" };
}

/* ───────────────────────── Prompt LLM ───────────────────────────────────── */

const LANG_NAME: Record<AssistantLang, string> = { ar: "Arabic", en: "English", fr: "French" };

/**
 * Prompt système ancré : résumé du site + fiches pertinentes pour la
 * question courante (et les deux précédentes pour le contexte).
 */
export function buildSystemPrompt(
  knowledge: SiteKnowledge,
  queries: string[],
  lang: AssistantLang,
  options: { maxDocs?: number; maxDocChars?: number } = {},
): string {
  const { maxDocs = 8, maxDocChars = 1400 } = options;
  const seen = new Set<string>();
  const selected: KnowledgeDoc[] = [];
  const weighted = [...queries].reverse(); // la plus récente d'abord
  for (const [index, query] of weighted.entries()) {
    for (const hit of searchKnowledge(knowledge, query, index === 0 ? maxDocs : 3)) {
      if (seen.has(hit.doc.id)) continue;
      seen.add(hit.doc.id);
      selected.push(hit.doc);
      if (selected.length >= maxDocs) break;
    }
    if (selected.length >= maxDocs) break;
  }

  const docsText = selected
    .map((doc) => `### ${doc.title.en} / ${doc.title.ar} — path: ${doc.path}\nEN: ${clip(doc.body.en, maxDocChars)}\nAR: ${clip(doc.body.ar, maxDocChars)}`)
    .join("\n\n");

  return [
    `You are the official website assistant of ${knowledge.core.split("\n")[0]}`,
    "",
    "RULES:",
    `- Answer in ${LANG_NAME[lang]} (the visitor's language). Be concise, warm and precise; use short paragraphs or bullets. Plain text only (no Markdown headings, no tables).`,
    "- Use ONLY the facts below. Quote exact prices, delays, limits and policies from them. If something is not covered, say you don't have that information on the site and suggest WhatsApp or the Contact page — never invent numbers, statistics, client counts, ratings, '24/7 support' or new offers.",
    "- Website plans and subscriptions are paid in crypto (USDT = USD) via NOWPayments; never suggest bank cards, PayPal or cash for them.",
    knowledge.phoneCardPaymentsEnabled
      ? "- Digital codes also accept Libyana/Al Madar phone recharge cards through checkout. The indicative LYD quote is order total USDT × current parallel-market USD/LYD rate × 1.20, with source/time displayed and explicit customer agreement. Never invent a live rate. The customer submits the code once; staff verify it manually before delivery. Never claim instant acceptance."
      : "- Phone card / mobile balance payments are TEMPORARILY PAUSED. Tell visitors not to submit recharge codes; crypto remains available and existing orders can still be processed. Do not invent a return date or bypass the pause.",
    "- Game top-ups are credited via Player ID (no emailed code); other digital items are emailed and shown on /codes/commande.",
    "- If the codes store is marked unavailable, do not quote product prices or stock.",
    "- Never ask for passwords, private keys or wallet seed phrases; remind visitors not to share them.",
    "- When a page on this site answers the question, mention its path (e.g. /pricing, /codes/commande) so the visitor can open it.",
    "- Stay on topic: this website, its services, store and policies. Politely decline unrelated requests.",
    "",
    "SITE SUMMARY:",
    knowledge.core,
    "",
    selected.length > 0 ? `RELEVANT ENTRIES:\n\n${docsText}` : "RELEVANT ENTRIES: none matched — rely on the summary and suggest a page or WhatsApp.",
  ].join("\n");
}

/** Extrait des chemins internes cités par le LLM pour en faire des boutons. */
export function actionsFromText(
  text: string,
  knowledge: SiteKnowledge,
  lang: AssistantLang,
  limit = 2,
): AssistantAction[] {
  const ui = UI[lang];
  const found = new Map<string, KnowledgeDoc>();
  const pathRe = /(?:^|[\s(«"'`])(\/[a-z0-9\-/]+)(?=$|[\s).,;:»"'`،؟!?])/gi;
  for (const match of text.matchAll(pathRe)) {
    const path = match[1].replace(/\/+$/, "") || "/";
    if (found.has(path)) continue;
    const doc =
      knowledge.docs.find((d) => d.path === path) ??
      knowledge.docs.find((d) => d.path.split("/").slice(0, 2).join("/") === path.split("/").slice(0, 2).join("/"));
    if (doc) found.set(path, doc);
    if (found.size >= limit) break;
  }
  const actions: AssistantAction[] = [...found.entries()].map(([path, doc]) => ({
    label: `${ui.open} — ${docTitle(doc, lang)}`.slice(0, 60),
    href: path,
  }));
  if (/whatsapp|واتساب/i.test(text) && actions.length < limit) {
    actions.push({ label: ui.whatsapp, href: knowledge.whatsappHref, external: true });
  }
  return actions;
}
