import { websiteOfferSummary, websiteTimelineNote, paymentAvailabilityNote } from "@/lib/website-offer";
import type { Faq } from "./site-types";
import { absoluteUrl, applyMarketTokens } from "./seo";
import { resolveMarket } from "./market";
import { localizedAbsoluteUrl, type Locale } from "@/lib/locale";

/**
 * Moteur de pages comparatives (/compare et /compare/[slug]).
 *
 * Une seule source de données (`comparisons`) génère automatiquement :
 *   - une page indexable par comparaison (titre, description, canonical,
 *     Open Graph généré) ;
 *   - le visuel « annonce » en deux colonnes (rouge = l'alternative,
 *     vert = نخبة) rendu par next/og — c'est-à-dire la créative publicitaire
 *     dupliquée en code, au lieu d'être redessinée à la main ;
 *   - les schémas JSON-LD (Service + Offer, ItemList des critères, FAQPage,
 *     BreadcrumbList, WebPage) ;
 *   - les entrées de sitemap, de /llms.txt et de /llms-full.txt ;
 *   - le maillage interne (hub, comparaisons liées, services liés).
 *
 * Ajouter une comparaison = ajouter une entrée dans `comparisons` : rien
 * d'autre à câbler. C'est le principe « le SEO est programmé, pas écrit ».
 *
 * Règle éditoriale : les prix et caractéristiques de l'alternative sont
 * toujours présentés comme des ordres de grandeur du marché (« typical »),
 * jamais comme des faits assertsifs sur une société précise.
 */

/** Point d'une liste (✗ pour l'alternative, ✓ pour نخبة). */
export interface ComparisonPoint {
  textAr: string;
  textEn: string;
}

/**
 * Critère comparé, ligne par ligne.
 * `winner` pilote la couleur du tableau et le schéma ItemList :
 * « us » = نخبة gagne, « them » = l'alternative gagne, « tie » = égalité.
 */
export interface ComparisonCriterion {
  labelAr: string;
  labelEn: string;
  /** Verdict نخبة (colonne verte). */
  usAr: string;
  usEn: string;
  /** Verdict de l'alternative (colonne rouge) — absent = non inclus. */
  themAr?: string;
  themEn?: string;
  winner: "us" | "them" | "tie";
}

export interface ComparisonSeo {
  id: string;
  /** Nom de l'alternative comparée (colonne rouge). */
  competitorAr: string;
  competitorEn: string;
  /** Montant affiché dans l'en-tête de la colonne rouge. */
  themPriceLabel: string;
  /** Légende du montant rouge. */
  themPriceAr: string;
  themPriceEn: string;
  /** Montant affiché dans l'en-tête de la colonne verte. */
  usPriceLabelAr: string;
  usPriceLabelEn: string;
  /** Légende du montant vert (précisée à l'affichage avec les prix vivants). */
  usPriceNoteAr: string;
  usPriceNoteEn: string;
  /** Titre SEO (≤ 80 caractères après résolution des jetons de marché). */
  titleAr: string;
  titleEn: string;
  /** Meta description (50 à 180 caractères). */
  descriptionAr: string;
  descriptionEn: string;
  h1Ar: string;
  h1En: string;
  subtitleAr: string;
  subtitleEn: string;
  /** Réponse directe « answer-first » (cible du `speakable`). */
  answerAr: string;
  answerEn: string;
  keywordsAr: string[];
  keywordsEn: string[];
  /** Points faibles de l'alternative (affichés avec une croix rouge). */
  themPoints: ComparisonPoint[];
  /** Points forts de نخبة (affichés avec une coche verte). */
  usPoints: ComparisonPoint[];
  /** Tableau comparatif ligne par ligne. */
  criteria: ComparisonCriterion[];
  /** Quand choisir l'alternative — honnêteté éditoriale, renforce la confiance. */
  chooseThemAr: string[];
  chooseThemEn: string[];
  chooseUsAr: string[];
  chooseUsEn: string[];
  faqs: Faq[];
  /** Services à mettre en avant (maillage interne). */
  relatedServices: string[];
  /** Identifiants des comparaisons liées. */
  related: string[];
  /** Libellé du bouton d'appel à l'action. */
  ctaAr: string;
  ctaEn: string;
}

/** Comparaisons du site — source unique, une entrée = une page + une annonce. */
export const comparisons: Record<string, ComparisonSeo> = {
  "google-ads": {
    id: "google-ads",
    competitorAr: "إعلانات جوجل",
    competitorEn: "Google Ads",
    themPriceLabel: "$2,000+/mo",
    themPriceAr: "إنفاق إعلاني شهري (نموذج تسعير شائع)",
    themPriceEn: "Typical monthly ad spend",
    usPriceLabelAr: "مجاناً للبدء",
    usPriceLabelEn: "Free to start",
    usPriceNoteAr: "استشارة مجانية، ثم موقع يُدفع مرة واحدة",
    usPriceNoteEn: "Free consultation, then a website you pay for once",
    titleAr: "إعلانات جوجل أم موقع؟ مقارنة صريحة لعلامتك في {city}",
    titleEn: "Google Ads vs a website: an honest comparison for {cityEn}",
    descriptionAr:
      "مقارنة صريحة بين إعلانات جوجل وبناء موقع من نخبة: التكلفة الشهرية، ملكية الزوار، سرعة أول عميل، وأيهما يناسب نشاطك في {city} فعلياً.",
    descriptionEn:
      "Google Ads vs a Nukhba website: monthly cost, who owns the visitors, speed to the first customer, and which one really fits a {cityEn} business.",
    h1Ar: "إعلانات جوجل أم موقع إلكتروني؟",
    h1En: "Google Ads or a website?",
    subtitleAr:
      "الإعلان يجعلك تدفع لتزورك. الموقع يجعل الزوار يأتون إليك مرة واحدة. إليك المقارنة خطاً بخط، بلا مبالغة.",
    subtitleEn:
      "Ads make you pay for every visit. A website makes visitors come to you once. Here is the line-by-line comparison — no exaggeration.",
    answerAr: websiteOfferSummary("ar"),
    answerEn: websiteOfferSummary("en"),
    keywordsAr: ["إعلانات جوجل", "قارن إعلانات جوجل بالموقع", "تكلفة إعلانات جوجل", "تسويق عبر جوجل"],
    keywordsEn: ["google ads vs website", "google ads cost", "website vs ads", "should I run google ads"],
    themPoints: [
      { textAr: "تدفع عن كل نقرة واحدة", textEn: "You pay for every single click" },
      { textAr: "الزيارات تتوقف فور توقفك عن الدفع", textEn: "Traffic stops the second you stop paying" },
      { textAr: "سعر النقرة يرتفع كل ربع سنة", textEn: "CPCs keep rising every quarter" },
      { textAr: "المنافسون يرفعون أسعار كلماتك", textEn: "Competitors bid up your keywords" },
      { textAr: "النقرة ليست محادثة ولا عميلاً", textEn: "A click is not a conversation" },
      { textAr: "لا يبقى لك موقع ولا بيانات", textEn: "After the spend you own no site and no data" },
    ],
    usPoints: [
      { textAr: "يجدك من يبحث عن خدمتك بالاسم", textEn: "People who search for your service find you by name" },
      { textAr: "لغة واحدة مشمولة؛ اللغات الأخرى اختيارية", textEn: "One language included; extra languages are optional" },
      { textAr: "عنوان vercel.app؛ الدومين الخاص منفصل", textEn: "vercel.app address; a custom domain is separate" },
      { textAr: "روابط تواصل؛ الحجز والطلبات الآلية تحتاج وحدات إضافية", textEn: "Contact links; automated booking and orders require modules" },
      { textAr: websiteTimelineNote("ar"), textEn: websiteTimelineNote("en") },
      { textAr: "سعر أساسي مرة واحدة مع نطاق مكتوب", textEn: "One-time base price and a written scope" },
    ],
    criteria: [
      {
        labelAr: "التكلفة الشهرية",
        labelEn: "Monthly cost",
        usAr: "موقع ثابت 35 $ مرة واحدة؛ التكاليف الخارجية المتكررة منفصلة",
        usEn: "Static website $35 once; external recurring costs separate",
        themAr: "عادةً $500 – $2,000+ شهرياً حسب السوق والمنافسة",
        themEn: "Typically $500–$2,000+/month depending on market and competition",
        winner: "us",
      },
      {
        labelAr: "ملكية الزوار",
        labelEn: "Who owns the visitors",
        usAr: "روابط التواصل الخاصة بك؛ النماذج المتصلة حسب نطاق إضافي",
        usEn: "Your contact links; connected forms are scoped separately",
        themAr: "الزيارات تعود للمعلِن ما لم تُجدَّد الحملة",
        themEn: "Traffic goes back to the advertiser unless the campaign is renewed",
        winner: "us",
      },
      {
        labelAr: "سرعة أول عميل",
        labelEn: "Time to first customer",
        usAr: websiteTimelineNote("ar"),
        usEn: websiteTimelineNote("en"),
        themAr: "أسابيع من إعداد الحملة واختبار الجمهور قبل أول نتيجة",
        themEn: "Weeks of campaign setup and audience testing before the first result",
        winner: "us",
      },
      {
        labelAr: "الظهور في جوجل",
        labelEn: "Visibility on Google",
        usAr: "SEO تقني + محتوى + بيانات منظمة + بحث الذكاء الاصطناعي",
        usEn: "Technical SEO, content, structured data and AI-search readiness",
        themAr: "الإعلان يظهر في أعلى النتائج ما دمت تدفع — لا بعد ذلك",
        themEn: "Ads sit at the top of the results only while you keep paying",
        winner: "us",
      },
      {
        labelAr: "مخاطر الإيقاف",
        labelEn: "Risk of losing it all",
        usAr: "موقعك ملكك: لا حساب إعلاني يُرفض ولا ميزانية تُخفض",
        usEn: "Your site is yours: no ad account to reject, no budget to cut",
        themAr: "حساب الإعلانات قد يُرفض أو تتوقف فجأة بقرار خارج عن إرادتك",
        themEn: "An ad account can be rejected or paused overnight, outside your control",
        winner: "us",
      },
      {
        labelAr: "الأفضل لـ",
        labelEn: "Best for",
        usAr: "اختبار سريع لعرض محدود في سوق واحد",
        usEn: "Quickly testing one offer in a single market",
        themAr: "عرض مؤقت يحتاج نتيجة اليوم (تخفيضات، حدث، ترويج محدود)",
        themEn: "A time-sensitive promotion that needs results today (sale, event)",
        winner: "tie",
      },
    ],
    chooseThemAr: [
      "لديك عرض ينتهي اليوم أو خلال أيام",
      "تريد اختبار جمهور قبل بناء أي شيء",
      "ميزانيتك إعلانية أكبر من تكلفة الموقع بكثير",
    ],
    chooseThemEn: [
      "You have a promotion that ends today or within days",
      "You want to test an audience before building anything",
      "Your ad budget is far larger than the cost of a website",
    ],
    chooseUsAr: [
      "تريد حضوراً دائماً في نتائج جوجل",
      "تحتاج طلبات جاهزة (نموذج + واتساب) لا مجرد زيارات",
      "تفضّل دفعة واحدة على اشتراك شهري متكرر",
    ],
    chooseUsEn: [
      "You want permanent presence in Google results",
      "You need ready-to-take enquiries (form + WhatsApp), not raw visits",
      "You prefer one payment to a recurring monthly retainer",
    ],
    faqs: [
      {
        qAr: "أيّهما يعطي نتائج أسرع: إعلانات جوجل أم الموقع؟",
        qEn: "Which delivers results faster: Google Ads or a website?",
        aAr: "الإعلانات والموقع يؤديان دورين مختلفين. موعد نشر الموقع يؤكد حسب النطاق؛ الفهرسة والنتائج يقررها محرك البحث ولا نضمن ترتيباً أو عدداً من الطلبات.",
        aEn: "Ads and a website serve different roles. Website deployment is confirmed by scope; search engines determine indexing and results. No ranking or enquiry count is guaranteed.",
      },
      {
        qAr: "كم يكلّف الموقع مقارنة بالحملة الإعلانية؟",
        qEn: "How much does a website cost compared with an ad campaign?",
        aAr: websiteOfferSummary("ar"),
        aEn: websiteOfferSummary("en"),
      },
      {
        qAr: "هل أحتاج إلى الإعلان بعد إطلاق الموقع؟",
        qEn: "Do I still need ads after launching the site?",
        aAr: "ليس بالضرورة. الموقع مع SEO التقني والبيانات المنظمة يجلب زيارات مجانية من جوجل والبحث بالذكاء الاصطناعي. نستخدم الإعلان فقط حين نحتاج نتيجة فورية لعرض محدود — وننصح حينها ميزانية قصيرة ومحدودة لا اشتراك شهري.",
        aEn: "Not necessarily. A site with technical SEO and structured data attracts free traffic from Google and AI search. We only recommend ads when an immediate result is needed for a specific promotion — and then a short, capped budget rather than a monthly retainer.",
      },
      {
        qAr: "ماذا لو كان عندي موقع قديم بالفعل؟",
        qEn: "What if I already have an old website?",
        aAr: "نبدأ من الموقع القائم: نعيد تصميمه على هويتك مع الحفاظ على روابطك وتحويلات 301، أو نضيف له قسماً واحداً من 19 دولاراً. المهم أن تبقى القيمة التي بنيتها سابقاً، وتُضاف إليها أسس أداء تقنية وSEO جاهز للذكاء الاصطناعي.",
        aEn: "We start from what you have: we redesign it on your brand while preserving your URLs and 301 redirects, or add a single section from $19. The point is to keep the value you already built and add technical performance foundations and AI-ready SEO on top.",
      },
    ],
    relatedServices: ["landing", "restyle", "fix-optimize"],
    related: ["facebook-ads", "seo-agency"],
    ctaAr: "اطلب موقعك بدل ما تدفع لكل نقرة",
    ctaEn: "Get your website instead of paying per click",
  },

  "facebook-ads": {
    id: "facebook-ads",
    competitorAr: "إعلانات فيسبوك وإنستغرام",
    competitorEn: "Facebook & Instagram Ads",
    themPriceLabel: "$500+/mo",
    themPriceAr: "ميزانية إعلانية شهرية (نموذج شائع)",
    themPriceEn: "Typical monthly ad budget",
    usPriceLabelAr: "مجاناً للبدء",
    usPriceLabelEn: "Free to start",
    usPriceNoteAr: "استشارة مجانية، ثم موقع يُدفع مرة واحدة",
    usPriceNoteEn: "Free consultation, then a website you pay for once",
    titleAr: "إعلانات فيسبوك وإنستغرام أم موقع؟ مقارنة لـ {city}",
    titleEn: "Facebook & Instagram Ads vs a website for {cityEn} businesses",
    descriptionAr:
      "إعلانات فيسبوك أم موقع من نخبة؟ قارن التكلفة، ثبات الوصول، ملكية العملاء وسرعة ظهورك في البحث — بصفحة تشرح عرضك، لا مجرد زيارات.",
    descriptionEn:
      "Facebook ads or a Nukhba website? Compare cost, reach stability, customer ownership and how fast you appear in search — with a page that sells, not just visits.",
    h1Ar: "إعلانات فيسبوك وإنستغرام أم موقع؟",
    h1En: "Facebook & Instagram ads or a website?",
    subtitleAr:
      "الإعلان يعرض منشوراً ليوم واحد. الموقع يشرح عرضك بالتفصيل ويبقيه متاحاً دائماً في جوجل — كل يوم، بلا ميزانية إعلانية.",
    subtitleEn:
      "An ad shows one post for a day. A website explains your offer in full and keeps it available on Google — every day, with no ad budget.",
    answerAr: websiteOfferSummary("ar"),
    answerEn: websiteOfferSummary("en"),
    keywordsAr: ["إعلانات فيسبوك", "فيسبوك مقابل موقع", "تسويق فيسبوك ليبيا", "مقارنة إعلانات"],
    keywordsEn: ["facebook ads vs website", "instagram ads cost", "social media marketing libya"],
    themPoints: [
      { textAr: "الخوارزمية تغيّر وصولك بين ليلة وضحاها", textEn: "Reach can change overnight" },
      { textAr: "تتنافس مع غيرك على الجمهور نفسه", textEn: "You compete for the same audience" },
      { textAr: "الرسالة عامة — لا تخصّك", textEn: "A generic message, not tailored to you" },
      { textAr: "تحتاج ميزانية يومية لتبقى مرئياً", textEn: "You need a daily budget to stay visible" },
      { textAr: "لا تملك شيئاً مما بنيته", textEn: "You own nothing you built" },
      { textAr: "الأسعار ترتفع في مواسم البيع", textEn: "Costs spike in peak seasons" },
    ],
    usPoints: [
      { textAr: "صفحة تشرح عرضك بالتفصيل قبل أي سؤال", textEn: "A page that explains your offer in full" },
      { textAr: "محتوى بلغتك وبأسلوب عملائك", textEn: "Content in your customers' language" },
      { textAr: "نموذج طلب يوصلك على واتساب وبريدك", textEn: "A lead form that lands on WhatsApp and email" },
      { textAr: "يبقى أثرها في جوجل بعد انتهاء الحملة", textEn: "Its effect stays on Google after the campaign ends" },
      { textAr: websiteTimelineNote("ar"), textEn: websiteTimelineNote("en") },
      { textAr: "تكلفة لمرة واحدة", textEn: "A one-time cost" },
    ],
    criteria: [
      {
        labelAr: "التكلفة",
        labelEn: "Cost",
        usAr: "دفعة واحدة من $35 (خدمات بأسعار منشورة)",
        usEn: "One payment from $35 (services at published prices)",
        themAr: "متوسط $500 – $2,000 شهرياً لتغطية الجمهور",
        themEn: "On average $500–$2,000/month to cover the audience",
        winner: "us",
      },
      {
        labelAr: "ثبات الوصول",
        labelEn: "Reach stability",
        usAr: "الوصول ثابت: من يبحث يجدك في أي وقت",
        usEn: "Stable: whoever searches finds you at any time",
        themAr: "الوصول يرتفع وينخفض حسب المنافسة ووقت النشر",
        themEn: "Reach rises and falls with competition and posting time",
        winner: "us",
      },
      {
        labelAr: "الطلبات المؤهلة",
        labelEn: "Qualified enquiries",
        usAr: "نموذج يجمع الاسم والخدمة — طلب جاهز للتسعير",
        usEn: "A form that captures name and service — ready to quote",
        themAr: "تعليقات ورسائل غير منظّمة تحتاج وقتاً وفرزاً",
        themEn: "Comments and DMs arrive unsorted and need triage",
        winner: "us",
      },
      {
        labelAr: "العمر بعد الحملة",
        labelEn: "Life after the campaign",
        usAr: "سنوات: المحتوى يبقى في جوجل ويجلب طلبات",
        usEn: "Years: the content stays on Google and keeps bringing leads",
        themAr: "يومان: المنشور يختفي من الوصول العضوي",
        themEn: "Two days: the post disappears from organic reach",
        winner: "us",
      },
      {
        labelAr: "شكل الرسالة",
        labelEn: "Message control",
        usAr: "أنت تكتب العرض والأسعار والتفاصيل كاملة",
        usEn: "You write the offer, the prices and every detail",
        themAr: "خوارزمية تقرر من يرى المنشور وبأي ثمن",
        themEn: "The algorithm decides who sees the post and at what cost",
        winner: "us",
      },
      {
        labelAr: "الأفضل لـ",
        labelEn: "Best for",
        usAr: "هوية رقمية دائمة تُبنى عليها سمعتك",
        usEn: "A lasting digital identity your reputation is built on",
        themAr: "اختبار سريع لصور أو عروض موسمية",
        themEn: "Quick testing of creatives or seasonal offers",
        winner: "tie",
      },
    ],
    chooseThemAr: [
      "لديك عرض موسمي يحتاج وصولاً سريعاً اليوم",
      "تريد اختبار عدة صور أو رسائل إعلانية",
      "لديك جمهور متابع بالفعل ويمكن استهدافه",
    ],
    chooseThemEn: [
      "You have a seasonal offer that needs reach today",
      "You want to test several creatives or ad messages",
      "You already have an audience you can target",
    ],
    chooseUsAr: [
      "تبني حضوراً دائماً وليس حملات متقطعة",
      "تحتاج صفحة تقنع العميل وتردّ على اعتراضاته",
      "تريد طلبات منظّمة تصل إلى بريدك وواتساب",
    ],
    chooseUsEn: [
      "You want a permanent presence, not scattered campaigns",
      "You need a page that answers objections and closes",
      "You want enquiries organised into your inbox and WhatsApp",
    ],
    faqs: [
      {
        qAr: "هل يغني الإعلان عن إنشاء الموقع؟",
        qEn: "Does an ad replace building the website?",
        aAr: "لا، بل وظيفتان مختلفتان: الإعلان يجلب الانتباه، والموقع يحوّل الانتباه إلى طلبات منظّمة. أكثر عملائنا يبدؤون بصفحة هبوط واحدة من 59 دولاراً ثم يطوّرونها إلى موقع كامل.",
        aEn: "No, they do different jobs. An ad brings attention; the website turns that attention into structured enquiries. Many of our clients start with a single landing page at $59 and grow it into a full site later.",
      },
      {
        qAr: "كم ميزانية الإعلان المعقولة لنشاط صغير؟",
        qEn: "What ad budget makes sense for a small business?",
        aAr: "لأنظمة صغيرة، 300 إلى 500 دولار شهرياً قد تكفي لبدء اختبار، لكن العائد يعتمد على جودة العرض لا على حجم الإنفاق. إذا كانت ميزانيتك محدودة، استثمره في موقع يصمد ويجلب طلباً بدل إعلان يتوقف بانتهاء الشهر.",
        aEn: "For small businesses, $300–$500 per month can be enough to start testing, but the return depends on the offer, not on the spend. If the budget is tight, invest it in a site that lasts and keeps producing leads rather than an ad that stops at month end.",
      },
      {
        qAr: "هل أحتاج ميزانية إعلانية مع الموقع؟",
        qEn: "Do I need an ad budget once the site is live?",
        aAr: "غالباً لا في البداية: الموقع المحسّن SEO يجلب زيارات مجانية بشكل مستمر. نضيف حملات قصيرة فقط للمواسم أو إطلاق جديد، بميزانية محددة ومدة محددة — لا اشتراك شهري مفتوح.",
        aEn: "Usually not at first: an SEO-ready site brings steady free traffic. We only add short campaigns for seasons or launches, with a fixed budget and a fixed end date — never an open-ended monthly retainer.",
      },
      {
        qAr: "ماذا لو كان عملي على إنستغرام فقط؟",
        qEn: "What if my business runs on Instagram only?",
        aAr: "نستطيع بناء الملف الشخصي والقصة بشكل ممتاز، لكن الملف وحده لا يظهر في بحث جوجل ولا يستقبل طلبات خارج المتابعين. نربطه بموقع خفيف يجمع الطلبات — ثم يصير إنستغرام قناة لا الحدّ الوحيد.",
        aEn: "We can build the profile and stories beautifully, but a profile alone does not appear in Google search and cannot capture enquiries from non-followers. We connect it to a light site that collects the leads — Instagram then becomes a channel, not the whole limit.",
      },
    ],
    relatedServices: ["landing", "restyle"],
    related: ["google-ads", "seo-agency"],
    ctaAr: "حوّل متابعيك إلى زوار وطلبات",
    ctaEn: "Turn followers into visitors and enquiries",
  },

  wix: {
    id: "wix",
    competitorAr: "Wix ومنشئات المواقع",
    competitorEn: "Wix & website builders",
    themPriceLabel: "$20–50/mo",
    themPriceAr: "اشتراك شهري متكرر (نموذج شائع)",
    themPriceEn: "Typical recurring monthly subscription",
    usPriceLabelAr: "مجاناً للبدء",
    usPriceLabelEn: "Free to start",
    usPriceNoteAr: "استشارة مجانية، ثم موقع يُدفع مرة واحدة",
    usPriceNoteEn: "Free consultation, then a website you pay for once",
    titleAr: "Wix أم موقع مصمّم خصيصاً؟ مقارنة لـ {city}",
    titleEn: "Wix vs a custom website: the comparison for {cityEn}",
    descriptionAr:
      "منشئ مواقع جاهز أم موقع مصمّم خصيصاً لعلامتك؟ قارن التكلفة على 3 سنوات، السرعة، التحكم، ملكية الملفات و SEO قبل أن تختار.",
    descriptionEn:
      "A ready-made builder or a custom-built website? Compare the 3-year cost, speed, control, full file ownership and SEO before you choose.",
    h1Ar: "Wix ومنشئات المواقع أم موقع مصمّم خصيصاً؟",
    h1En: "Wix and website builders, or a custom website?",
    subtitleAr:
      "القوالب الجاهزة سريعة، لكنها تبقى قوالب. الموقع المصمّم لك وحدك يُبنى على هويتك، وبسرعة أعلى وبتكلفة تدفعها مرة واحدة.",
    subtitleEn:
      "Templates are fast, but they stay templates. A site built for you alone runs on your brand, loads faster and costs you once.",
    answerAr: websiteOfferSummary("ar"),
    answerEn: websiteOfferSummary("en"),
    keywordsAr: ["ووكس", "منشئ مواقع", "ووكس مقابل موقع مخصص", "تكلفة ووكس"],
    keywordsEn: ["wix alternative", "wix vs custom website", "website builder cost", "custom website libya"],
    themPoints: [
      { textAr: "قالب جاهز — لا تميّز لك", textEn: "A ready template, no real distinction" },
      { textAr: "رسوم شهرية تتكرر كل عام", textEn: "Recurring monthly fees every year" },
      { textAr: "الإضافات والخصائص تكلّف أكثر", textEn: "Paid add-ons and features cost more" },
      { textAr: "الملف يبقى داخل المنصة", textEn: "Your files stay locked inside the platform" },
      { textAr: "سرعة و SEO أضعف من موقع مخصّص", textEn: "Slower and weaker SEO than a custom build" },
      { textAr: "التعديلات الكبيرة تحتاج خبرة تقنية", textEn: "Big changes need technical know-how" },
    ],
    usPoints: [
      { textAr: "تصميم حصري على هويتك", textEn: "A design built only for your brand" },
      // A03 : ne jamais nier le renouvellement — l'hébergement n'est inclus
      // que la première année (voir la section tarifs), puis il se renouvelle.
      { textAr: "موقع ثابت 35 $؛ نشر vercel.app وفق أهلية وحدود Vercel", textEn: "Static site $35; vercel.app deployment subject to Vercel eligibility and limits" },
      { textAr: "قياس الأداء حسب النطاق المتفق عليه", textEn: "Performance measured for the agreed scope" },
      { textAr: "SEO و بحث الذكاء الاصطناعي جاهز", textEn: "SEO and AI-search ready" },
      { textAr: "إدارة محتوى اختيارية من 10 $ إضافية", textEn: "Optional content management from an extra $10" },
      { textAr: "ملكية كاملة للملفات والكود", textEn: "Full ownership of files and code" },
    ],
    criteria: [
      {
        labelAr: "التكلفة على 3 سنوات",
        labelEn: "Cost over 3 years",
        usAr: "موقع ثابت من 35 $؛ التكاليف الخارجية المتكررة منفصلة",
        usEn: "Static site from $35; external recurring costs disclosed separately",
        themAr: "اشتراك شهري يتكرر 36 مرة",
        themEn: "A monthly fee repeated 36 times",
        winner: "us",
      },
      {
        labelAr: "التصميم",
        labelEn: "Design",
        usAr: "نموذج تختاره مع تخصيص المحتوى الأولي",
        usEn: "Your choice of model with initial content personalization",
        themAr: "قالب جاهز يشاركك فيه آلاف المواقع",
        themEn: "A ready template shared by thousands of sites",
        winner: "us",
      },
      {
        labelAr: "السرعة",
        labelEn: "Speed",
        usAr: "نموذج متجاوب؛ الأداء حسب المحتوى والتكاملات",
        usEn: "Responsive model; performance depends on content and integrations",
        themAr: "أبطأ نسبياً بسبب مكتبة المنصة وبنية القوالب",
        themEn: "Slower in practice due to the platform bundle and template weight",
        winner: "us",
      },
      {
        labelAr: "ملكية الملفات",
        labelEn: "File ownership",
        usAr: "الكود والملفات ملكك بالكامل وتنتقل معك",
        usEn: "Code and files are yours and move with you",
        themAr: "المحتوى مرتبط بالمنصة ويصعب تصديره",
        themEn: "Content is tied to the platform and hard to export",
        winner: "us",
      },
      {
        labelAr: "التحكم",
        labelEn: "Control",
        usAr: "كل تفصيلة: تخطيط، حقول، ألوان، خطوط",
        usEn: "Every detail: layout, fields, colours, typefaces",
        themAr: "حدود المنصة: ما لم يوفّره القالب لا يُضاف بسهولة",
        themEn: "Platform limits: what the template lacks is hard to add",
        winner: "us",
      },
      {
        labelAr: "الأفضل لـ",
        labelEn: "Best for",
        usAr: "مشروع جاد يريد التميّز و SEO قوياً",
        usEn: "A serious project that needs to stand out and rank",
        themAr: "صفحة بسيطة سريعة بيوم واحد وبأقل تكلفة",
        themEn: "A simple page live in a day at the lowest possible cost",
        winner: "tie",
      },
    ],
    chooseThemAr: [
      "تحتاج صفحة بسيطة جداً هذا اليوم",
      "ميزانيتك صفر وتحتاج حلاً مجانياً مؤقتاً",
      "تختبر فكرة قبل أن تستثمر في موقع حقيقي",
    ],
    chooseThemEn: [
      "You need a very simple page today",
      "Your budget is zero and you need a temporary free option",
      "You are testing an idea before investing in a real site",
    ],
    chooseUsAr: [
      "علامتك تحتاج واجهة تعكسها لا قالباً",
      "تريد امتلاك ملفاتك وكودك بلا قيود",
      "الـ SEO جزء أساسي من مشروعك",
    ],
    chooseUsEn: [
      "Your brand needs an interface that reflects it, not a template",
      "You want to own your files and code without limits",
      "SEO is a core part of the project, not an afterthought",
    ],
    faqs: [
      {
        qAr: "هل Wix أرخص فعلاً على المدى الطويل؟",
        qEn: "Is Wix really cheaper in the long run?",
        aAr: websiteOfferSummary("ar"),
        aEn: websiteOfferSummary("en"),
      },
      {
        qAr: "هل أستطيع نقل موقع ووكس إلى نخبة لاحقاً؟",
        qEn: "Can I move a Wix site to Nukhba later?",
        aAr: "نعم. ننقل المحتوى والصور والروابط، ونضع تحويلات 301 لكل رابط قديم حتى لا تفقد ترتيبك في جوجل. نفضّل دائماً العمل على موقع قائم إن كان لديك واحد — إعادة البناء من الصفر ليست ضرورية.",
        aEn: "Yes. We migrate the content, images and URLs, and add 301 redirects for every legacy link so you keep your rankings. If you already have a site, working on it is always better — a rebuild from scratch is rarely necessary.",
      },
      {
        qAr: "ما الذي يجعل موقعكم أسرع؟",
        qEn: "What makes your site faster?",
        aAr: "نستخدم أسس النموذج التقنية ونقيس الأداء حسب المحتوى والتكاملات. لا نضمن درجة Lighthouse ثابتة أو ترتيباً محدداً في جوجل.",
        aEn: "We use the model’s technical foundations and assess performance against its content and integrations. No fixed Lighthouse score or Google ranking is guaranteed.",
      },
      {
        qAr: "هل يمكنني تعديل المحتوى بنفسي بعد التسليم؟",
        qEn: "Can I edit the content myself after delivery?",
        aAr: "الموقع الأساسي ثابت، ولا يشمل لوحة إدارة. إدارة المحتوى تبدأ من 10 دولارات إضافية وتشمل قاعدة البيانات والإدارة اللازمة ضمن نطاق محدد. التعديلات الكبيرة والصيانة اللاحقة منفصلة.",
        aEn: "The base website is static with no admin panel. Content management starts at an extra $10, including the required database and admin tools for an agreed scope. Structural changes and later maintenance are separate.",
      },
    ],
    relatedServices: ["restyle", "landing", "fix-optimize"],
    related: ["freelancer", "seo-agency"],
    ctaAr: "موقع مصمّم لك وحدك — بدفع واحد",
    ctaEn: "A website built for you alone — one payment",
  },

  freelancer: {
    id: "freelancer",
    competitorAr: "مستقل أو وكالة محلية",
    competitorEn: "A freelancer or local agency",
    themPriceLabel: "$300–$2,500",
    themPriceAr: "تكلفة مشروع لمرة واحدة (نطاق واسع)",
    themPriceEn: "One-off project cost (wide range)",
    usPriceLabelAr: "مجاناً للبدء",
    usPriceLabelEn: "Free to start",
    usPriceNoteAr: "استشارة مجانية، ثم عرض سعر مكتوب",
    usPriceNoteEn: "Free consultation, then a written quote",
    titleAr: "مستقل على الإنترنت أم وكالة نخبة؟ مقارنة قبل التوظيف",
    titleEn: "Hire a freelancer or Nukhba: the comparison before you hire",
    descriptionAr:
      "مستقل بالساعة أم وكالة بعرض سعر مكتوب؟ قارن التسليم، الدعم بعد التسليم، المراجعات، ملكية الملفات و SEO قبل أن تدفع لأحد.",
    descriptionEn:
      "An hourly freelancer or an agency with a written quote? Compare delivery, post-launch support, revisions, file ownership and SEO before you pay anyone.",
    h1Ar: "مستقل على الإنترنت أم وكالة نخبة؟",
    h1En: "A freelancer or Nukhba?",
    subtitleAr:
      "الفرق ليس في السعر فقط: الفرق في الموعد المضمون، والدعم بعد التسليم، ومن يملك الملفات حين تنتهي الحكاية.",
    subtitleEn:
      "The difference is not only price: it is the guaranteed date, the support after delivery, and who owns the files at the end.",
    answerAr: websiteOfferSummary("ar"),
    answerEn: websiteOfferSummary("en"),
    keywordsAr: ["توظيف مصمم مواقع", "توظيف مستقل", "فريلانسر تصميم مواقع", "وكالة مقابل مستقل"],
    keywordsEn: ["hire a web designer", "freelancer vs agency", "freelance web developer libya"],
    themPoints: [
      { textAr: "مواعيد التسليم غير مضمونة", textEn: "Delivery dates are never guaranteed" },
      { textAr: "الجودة تختلف بين مشروع وآخر", textEn: "Quality varies from project to project" },
      { textAr: "دعم ضعيف — غالباً ما ينتهي عند التسليم", textEn: "Weak support — usually ends at handover" },
      { textAr: "تسليم ناقص إن لم تتابع بنفسك", textEn: "Incomplete delivery if you don't chase it" },
      { textAr: "تكاليف مراجعات غير متوقعة", textEn: "Unexpected revision costs" },
      { textAr: "لا فريق خلف المشروع", textEn: "No team behind the project" },
    ],
    usPoints: [
      { textAr: "عرض سعر وعقد مكتوب قبل البدء", textEn: "A written quote and contract before we start" },
      { textAr: websiteTimelineNote("ar"), textEn: websiteTimelineNote("en") },
      { textAr: "تخصيص المحتوى الأولي ضمن النموذج المختار", textEn: "Initial content personalization within the chosen model" },
      { textAr: "صيانة اختيارية بعرض سعر منفصل", textEn: "Optional maintenance quoted separately" },
      { textAr: "فريق تصميم وتطوير و SEO في مكان واحد", textEn: "Design, development and SEO in one team" },
      { textAr: "وسائل الدفع المعروضة في صفحة الدفع مع فاتورة", textEn: "Payment methods shown at checkout, with an invoice" },
    ],
    criteria: [
      {
        labelAr: "ضمان الموعد",
        labelEn: "Guaranteed date",
        usAr: websiteTimelineNote("ar"),
        usEn: websiteTimelineNote("en"),
        themAr: "تقديري، ومخالفته غالباً بلا تعويض",
        themEn: "An estimate, usually with no compensation if it slips",
        winner: "us",
      },
      {
        labelAr: "الدعم بعد التسليم",
        labelEn: "Support after delivery",
        usAr: "صيانة منفصلة حسب الاتفاق",
        usEn: "Separate maintenance, according to agreement",
        themAr: "دفعات منفصلة أو بلا دعم",
        themEn: "Separate hourly fees, or nothing at all",
        winner: "us",
      },
      {
        labelAr: "ملكية الملفات",
        labelEn: "File ownership",
        usAr: "الملكية لك بالكامل في العقد",
        usEn: "Full ownership transferred in the contract",
        themAr: "يتوقف الملف عند المستقل ما لم يُتفق خلاف ذلك",
        themEn: "Stops with the freelancer unless agreed otherwise",
        winner: "us",
      },
      {
        labelAr: "SEO وبنية الموقع",
        labelEn: "SEO and site structure",
        usAr: "SEO تقني + بيانات منظمة + بحث الذكاء الاصطناعي",
        usEn: "Technical SEO, structured data and AI-search readiness",
        themAr: "قالب جاهز ووسوم وصفحات متاحة عند الطلب",
        themEn: "A template and meta tags, if you ask for them",
        winner: "us",
      },
      {
        labelAr: "الفردية في الأسلوب",
        labelEn: "One-of-a-kind style",
        usAr: "كل النماذج بنفس السعر الأساسي",
        usEn: "Every model at the same base price",
        themAr: "قوالب جاهزة يتكرر استخدامها",
        themEn: "The same templates reused across clients",
        winner: "us",
      },
      {
        labelAr: "الأفضل لـ",
        labelEn: "Best for",
        usAr: "مشروع يحتاج نتيجة موثوقة وموعداً واضحاً",
        usEn: "A project that needs a reliable result and a clear date",
        themAr: "مهمة صغيرة محددة (شعار، تعديل، استشارة)",
        themEn: "A small, clearly defined task (logo, tweak, advice)",
        winner: "tie",
      },
    ],
    chooseThemAr: [
      "مهمة صغيرة ومحددة لا تحتاج عقداً",
      "ميزانيتك أقل بكثير من الحد الأدنى للوكالة",
      "تجربة فردية سريعة بلا التزام طويل",
    ],
    chooseThemEn: [
      "A small, clearly scoped task that needs no contract",
      "Your budget sits far below an agency's minimum",
      "A quick one-off try with no long commitment",
    ],
    chooseUsAr: [
      "المشروع جزء من هويتك ولا يقبل المساومة",
      "تحتاج موعداً مضموناً ومسؤولية واضحة",
      "تريد موقعاً يُسوّق نفسه بعد الإطلاق",
    ],
    chooseUsEn: [
      "The project is part of your identity and cannot be compromised",
      "You need a guaranteed date and clear accountability",
      "You want a site that markets itself after launch",
    ],
    faqs: [
      {
        qAr: "هل أنتم أغلى من المستقل؟",
        qEn: "Are you more expensive than a freelancer?",
        aAr: "نعم غالباً، والسبب مكتوب: عقد وموعد ودعم بعد التسليم وملكية كاملة للملفات. لكن الموقع الجاهز يكلّف أقل بكثير من تعديل موقع مستقل بعد سنة، لأن البناء الآلي والصيانة الوقائية لا يرتفعان بنفس السرعة.",
        aEn: "Usually yes, and the reason is written down: a contract, a date, post-delivery support and full file ownership. But a well-built site costs far less than repairing a freelancer's work a year later, because automated build and preventive maintenance do not escalate the same way.",
      },
      {
        qAr: "كم يستغرق المشروع؟",
        qEn: "How long does a project take?",
        aAr: websiteTimelineNote("ar"),
        aEn: websiteTimelineNote("en"),
      },
      {
        qAr: "ماذا لو لم تعجبني النتيجة؟",
        qEn: "What if I don't like the result?",
        aAr: "تخصيص المحتوى الأولي ضمن النموذج مشمول. نراجع النتيجة وفق النطاق المكتوب؛ الطلبات الجديدة والتغيير الهيكلي يحتاجان اتفاقاً منفصلاً.",
        aEn: "Initial content personalization within the model is included. Delivery is reviewed against the written scope; new requests and structural changes need a separate agreement.",
      },
      {
        qAr: "هل أستطيع الدفع بالتدريج؟",
        qEn: "Can I pay in instalments?",
        aAr: paymentAvailabilityNote("ar"),
        aEn: paymentAvailabilityNote("en"),
      },
    ],
    relatedServices: ["restyle", "landing", "fix-optimize"],
    related: ["wix", "seo-agency"],
    ctaAr: "اطلب عرض سعر مكتوباً خلال أوقات العمل",
    ctaEn: "Get a written quote during opening hours",
  },

  "seo-agency": {
    id: "seo-agency",
    competitorAr: "اشتراك شهري في وكالة SEO",
    competitorEn: "A monthly SEO agency retainer",
    themPriceLabel: "$1,000+/mo",
    themPriceAr: "اشتراك شهري مستمر (نموذج شائع)",
    themPriceEn: "Typical ongoing monthly retainer",
    usPriceLabelAr: "مجاناً للبدء",
    usPriceLabelEn: "Free to start",
    usPriceNoteAr: "SEO مدمج في المشروع — بلا اشتراك",
    usPriceNoteEn: "SEO built into the project — no retainer",
    titleAr: "اشتراك SEO شهري أم موقع جاهز للبحث؟ مقارنة صريحة",
    titleEn: "Monthly SEO retainer or an SEO-ready website: an honest comparison",
    descriptionAr:
      "اشتراك شهري في وكالة SEO أم موقع مبني على SEO من اليوم الأول؟ قارن الكلفة السنوية، سرعة النتائج، ملكية المحتوى وأثر العمل بعد انتهاء الاشتراك.",
    descriptionEn:
      "A monthly SEO retainer or a website built with SEO from day one? Compare yearly cost, time to results, content ownership and what survives after the retainer ends.",
    h1Ar: "اشتراك SEO شهري أم موقع جاهز للبحث؟",
    h1En: "A monthly SEO retainer or an SEO-ready website?",
    subtitleAr:
      "اشتراك SEO يشتري وقت الفريق. الموقع الجاهز للبحث يشتري نتيجة تبقى بعد انتهاء الاشتراك.",
    subtitleEn:
      "An SEO retainer buys the agency's time. An SEO-ready website buys a result that stays after the retainer ends.",
    answerAr: websiteOfferSummary("ar"),
    answerEn: websiteOfferSummary("en"),
    keywordsAr: ["اشتراك seo", "وكالة seo", "تحسين محركات البحث", "seo مقابل موقع"],
    keywordsEn: ["seo retainer", "seo agency cost", "seo vs website redesign", "technical seo libya"],
    themPoints: [
      { textAr: "اشتراك شهري لا ينتهي", textEn: "An endless monthly retainer" },
      { textAr: "تقارير بلا أرقام واضحة", textEn: "Reports without clear numbers" },
      { textAr: "تكرار العمل نفسه كل شهر", textEn: "The same work repeated every month" },
      { textAr: "نتائج تظهر بعد 3 إلى 6 أشهر", textEn: "Results show up after 3–6 months" },
      { textAr: "كتابة المحتوى أحياناً عبر جهات خارجية", textEn: "Content writing sometimes outsourced" },
      { textAr: "لا تملك الموقع أصلاً", textEn: "You do not own the site in the first place" },
    ],
    usPoints: [
      { textAr: "SEO تقني مدمج من اليوم الأول", textEn: "Technical SEO built in from day one" },
      { textAr: "بنية جاهزة للبحث بالذكاء الاصطناعي", textEn: "Structured for AI search (llms.txt, JSON-LD)" },
      { textAr: "أسس أداء تقنية، وليست ضمان ترتيب", textEn: "Technical performance foundations, not a ranking guarantee" },
      { textAr: "دفعة واحدة بدل 12 دفعة", textEn: "One payment instead of twelve" },
      { textAr: websiteTimelineNote("ar"), textEn: websiteTimelineNote("en") },
      { textAr: "توثيق كامل والملفات عندك", textEn: "Full documentation, and the files are yours" },
    ],
    criteria: [
      {
        labelAr: "الكلفة السنوية",
        labelEn: "Yearly cost",
        usAr: "قاعدة ثابتة من 35 $ مرة واحدة؛ التكاليف الخارجية منفصلة",
        usEn: "One-time static base from $35; external costs separate",
        themAr: "12 × اشتراك شهري (من $1,000) = $12,000+",
        themEn: "12 × monthly retainer (from $1,000) = $12,000+",
        winner: "us",
      },
      {
        labelAr: "سرعة النتيجة",
        labelEn: "Time to result",
        usAr: websiteTimelineNote("ar"),
        usEn: websiteTimelineNote("en"),
        themAr: "3 إلى 6 أشهر قبل نتيجة تُذكر",
        themEn: "3–6 months before a result worth reporting",
        winner: "us",
      },
      {
        labelAr: "ملكية المحتوى",
        labelEn: "Content ownership",
        usAr: "كل كلمة ومقال وملف صورة ملكك",
        usEn: "Every word, article and image file is yours",
        themAr: "المحتوى يُنشر باسم الوكالة أو يبقى مرتبطاً بالعقد",
        themEn: "Content is published under the agency or stays tied to the contract",
        winner: "us",
      },
      {
        labelAr: "بعد انتهاء العقد",
        labelEn: "After the contract ends",
        usAr: "الأثر يبقى: الموقع يعمل ويحقق ترتيباً",
        usEn: "The effect remains: the site keeps working and ranking",
        themAr: "الترتيب يتراجع تدريجياً بدون تجديد",
        themEn: "Rankings decay gradually without renewing",
        winner: "us",
      },
      {
        labelAr: "العمل الإضافي",
        labelEn: "Ongoing work",
        usAr: "دعم بعد الإطلاق + حرية طلب تحسينات محددة",
        usEn: "Post-launch support plus room for targeted improvements",
        themAr: "محتوى مستمر ومقالات جديدة شهرياً",
        themEn: "Fresh content and new articles every month",
        winner: "them",
      },
      {
        labelAr: "الأفضل لـ",
        labelEn: "Best for",
        usAr: "مشروع جديد يبدأ من الصفر",
        usEn: "A new project starting from scratch",
        themAr: "موقع قائم يحتاج محتوى وبناء روابط مستمراً",
        themEn: "An existing site that needs a continuous content engine",
        winner: "tie",
      },
    ],
    chooseThemAr: [
      "لديك موقع قائم يعمل ويحتاج محتوى مستمراً",
      "حجم موقع عالٍ يستدعي محتوى أسبوعي",
      "تحتاج تقارير شهرية موثّقة لشركاء",
    ],
    chooseThemEn: [
      "You already have a working site that needs constant content",
      "Your site volume demands weekly publishing",
      "You need documented monthly reports for partners",
    ],
    chooseUsAr: [
      "تبدأ من الصفر ولا تملك موقعاً بعد",
      "تريد أفضل بداية ممكنة لمحركات البحث",
      "تفضّل تكلفة واضحة لمرة واحدة",
    ],
    chooseUsEn: [
      "You start from scratch and have no site yet",
      "You want the best possible start for search engines",
      "You prefer one clear, one-off cost",
    ],
    faqs: [
      {
        qAr: "هل ألغي اشتراك SEO بعد إطلاق الموقع؟",
        qEn: "Should I cancel my SEO retainer after launching the site?",
        aAr: "إذا كان موقعك جديداً وبُني على أساس تقني صحيح، فغالباً نعم: كلما قلّ العمل التكراري قلّت الحاجة للاشتراك. نبقى متاحين لتحديثات محددة (محتوى، تحسين سرعة، صفحات جديدة) بدون التزام شهري.",
        aEn: "If your site is new and was built on a correct technical base, usually yes: the less repetitive work, the less you need a retainer. We stay available for targeted work — content, speed fixes, new pages — with no monthly commitment.",
      },
      {
        qAr: "ماذا يتضمّن الـ SEO عندكم؟",
        qEn: "What does your SEO include?",
        aAr: "أساس تقني كامل: أسس أداء تقنية، بنية عناوين ووصفات، روابط داخلية، بيانات منظمة (Service, LocalBusiness, FAQPage, BreadcrumbList)، صور وسوم بديلة، خريطة موقع، وllms.txt لمحركات الذكاء الاصطناعي، إضافة إلى فحص الفهرسة في Search Console بعد الإطلاق.",
        aEn: "A complete technical foundation: technical performance foundations, a title and description architecture, internal linking, structured data (Service, LocalBusiness, FAQPage, BreadcrumbList), images and alt tags, a sitemap, and llms.txt for AI crawlers — plus an indexing check in Search Console after launch.",
      },
      {
        qAr: "كم يستغرق ظهور الموقع في جوجل؟",
        qEn: "How long until the site shows on Google?",
        aAr: "موعد التسليم يؤكد حسب النطاق. الفهرسة والترتيب يقررهما محرك البحث، وقد يختلفان حسب المحتوى والمنافسة؛ لا نضمن مهلة أو مركزاً محدداً.",
        aEn: "Delivery is confirmed according to scope. Search engines determine indexing and ranking; timing varies by content and competition. No indexing deadline or search position is guaranteed.",
      },
      {
        qAr: "هل يمكن شراء خدمة SEO فقط دون موقع؟",
        qEn: "Can I buy SEO alone without a website?",
        aAr: "نعم، عبر خدمة التدقيق والإصلاح (السعر المنشور على صفحة الخدمة): تقرير من 40+ نقطة عن السرعة والموبايل والـ SEO والأمان، مع إصلاح فوري. لكن الإصلاح بلا أساس تقني صحيح يبقى حلاً مؤقتاً — ولهذا نوصي ببناء الأساس أولاً.",
        aEn: "Yes, through the audit & fix service (its price is published on the service page): a 40+ point report on speed, mobile, SEO and security, with immediate fixes. But fixes without a correct technical base stay a temporary solution — which is why we recommend building the base first.",
      },
    ],
    relatedServices: ["fix-optimize", "restyle", "add-section"],
    related: ["google-ads", "wix"],
    ctaAr: "ابنِ الأساس الصحيح مرة واحدة",
    ctaEn: "Build the right foundation once",
  },
};

/** Identifiants de toutes les comparaisons, dans l'ordre d'affichage. */
export const comparisonIds: string[] = Object.keys(comparisons);

/**
 * Résout les jetons de marché ({city}, {country}, {cityEn}…) d'un champ de
 * comparaison.
 *
 * Les titres et descriptions sont écrits avec des jetons pour suivre le
 * marché configuré (Tripoli par défaut, mais Dubai, Le Caire, Worldwide…
 * depuis /admin). Tout affichage hors de `pageMetadata` — cartes du hub,
 * llms.txt, llms-full.txt — passe par cette fonction, sinon le visiteur
 * verrait le jeton brut.
 */
export function comparisonText(
  text: string,
  market?: Parameters<typeof resolveMarket>[0],
  locale: "ar" | "en" = "ar",
): string {
  return applyMarketTokens(text, resolveMarket(market), locale);
}

/**
 * Renvoie une copie de la comparaison avec tous les jetons de marché
 * résolus ({city}, {cityEn}, {country}…) : les champs arabes sont résolus
 * en arabe, les champs anglais en anglais.
 *
 * Appelé côté serveur avant de transmettre la comparaison au composant
 * client : le visiteur ne voit jamais un jeton brut, et la page servie ne
 * contient plus de `{city}` dans son HTML.
 */
export function resolveComparisonTokens(
  comparison: ComparisonSeo,
  market?: Parameters<typeof resolveMarket>[0],
): ComparisonSeo {
  const ar = (value: string) => comparisonText(value, market, "ar");
  const en = (value: string) => comparisonText(value, market, "en");
  return {
    ...comparison,
    titleAr: ar(comparison.titleAr),
    titleEn: en(comparison.titleEn),
    descriptionAr: ar(comparison.descriptionAr),
    descriptionEn: en(comparison.descriptionEn),
    h1Ar: ar(comparison.h1Ar),
    h1En: en(comparison.h1En),
    subtitleAr: ar(comparison.subtitleAr),
    subtitleEn: en(comparison.subtitleEn),
    answerAr: ar(comparison.answerAr),
    answerEn: en(comparison.answerEn),
    themPriceAr: ar(comparison.themPriceAr),
    themPriceEn: en(comparison.themPriceEn),
    usPriceLabelAr: ar(comparison.usPriceLabelAr),
    usPriceLabelEn: en(comparison.usPriceLabelEn),
    usPriceNoteAr: ar(comparison.usPriceNoteAr),
    usPriceNoteEn: en(comparison.usPriceNoteEn),
    themPoints: comparison.themPoints.map((point) => ({
      textAr: ar(point.textAr),
      textEn: en(point.textEn),
    })),
    usPoints: comparison.usPoints.map((point) => ({
      textAr: ar(point.textAr),
      textEn: en(point.textEn),
    })),
    criteria: comparison.criteria.map((criterion) => ({
      ...criterion,
      labelAr: ar(criterion.labelAr),
      labelEn: en(criterion.labelEn),
      usAr: ar(criterion.usAr),
      usEn: en(criterion.usEn),
      ...(criterion.themAr !== undefined ? { themAr: ar(criterion.themAr) } : {}),
      ...(criterion.themEn !== undefined ? { themEn: en(criterion.themEn) } : {}),
    })),
    chooseThemAr: comparison.chooseThemAr.map(ar),
    chooseThemEn: comparison.chooseThemEn.map(en),
    chooseUsAr: comparison.chooseUsAr.map(ar),
    chooseUsEn: comparison.chooseUsEn.map(en),
    faqs: comparison.faqs.map((faq) => ({
      qAr: ar(faq.qAr),
      qEn: en(faq.qEn),
      aAr: ar(faq.aAr),
      aEn: en(faq.aEn),
    })),
  };
}

/** Retrouve une comparaison par identifiant. */
export function getComparison(id: string): ComparisonSeo | null {
  return comparisons[id] ?? null;
}

/** URL canonique relative d'une page comparative. */
export function comparePath(id: string): string {
  return `/compare/${id}`;
}

/** Comparaisons liées à une comparaison donnée (hors elle-même). */
export function relatedComparisons(id: string): ComparisonSeo[] {
  const current = comparisons[id];
  const ids = current?.related ?? [];
  return ids
    .map((relatedId) => comparisons[relatedId])
    .filter((item): item is ComparisonSeo => Boolean(item));
}

/**
 * Schéma `Service` + `Offer` d'une page comparative : décrit l'offre نخبة
 * face à l'alternative, avec le prix de départ lu dans la configuration vivante.
 */
export function comparisonServiceJsonLd(
  config: {
    url: string;
    name: string;
    nameAr: string;
    phone?: string;
    email?: string;
    market?: Parameters<typeof resolveMarket>[0];
  },
  comparison: ComparisonSeo,
  priceUsd: number,
  locale?: Locale,
) {
  const url = locale ? localizedAbsoluteUrl(config.url, comparePath(comparison.id), locale) : absoluteUrl(config, comparePath(comparison.id));
  const ar = locale !== "en";
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: ar ? `${comparison.competitorAr} مقابل ${comparison.usPriceLabelAr} — ${comparison.h1Ar}` : `${comparison.competitorEn} vs ${comparison.usPriceLabelEn} — ${comparison.h1En}`,
    serviceType: comparison.competitorEn,
    description: ar ? comparison.answerAr : comparison.answerEn,
    url,
    image: absoluteUrl(config, "/og.jpg"),
    provider: { "@id": absoluteUrl(config, "#organization") },
    areaServed: [
      { "@type": "Place", name: "Worldwide" },
      { "@type": "Country", name: "Libya" },
      { "@type": "City", name: "Tripoli" },
    ],
    availableLanguage: ["en", "ar"],
    ...(comparison.criteria.length > 0
      ? {
          serviceOutput: {
            "@type": "ItemList",
            numberOfItems: comparison.criteria.length,
            itemListElement: comparison.criteria.map((criterion, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: ar ? criterion.labelAr : criterion.labelEn,
              description: ar ? `${criterion.usAr} — ${criterion.themAr ?? ""}`.trim() : `${criterion.usEn} — ${criterion.themEn ?? ""}`.trim(),
            })),
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      name: ar ? comparison.h1Ar : comparison.h1En,
      description: comparisonText(ar ? comparison.descriptionAr : comparison.descriptionEn, config.market, ar ? "ar" : "en"),
      url,
      priceCurrency: "USD",
      price: String(priceUsd),
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "USD",
        minPrice: priceUsd,
        valueAddedTaxIncluded: false,
      },
      availability: "https://schema.org/InStock",
      seller: { "@id": absoluteUrl(config, "#organization") },
    },
  };
}

/**
 * `ItemList` des critères comparés : les moteurs (et les LLM) lisent la
 * comparaison ligne par ligne, avec le critère et le verdict de chaque côté.
 */
export function comparisonCriteriaJsonLd(
  config: { url: string },
  comparison: ComparisonSeo,
  locale?: Locale,
) {
  const url = locale ? localizedAbsoluteUrl(config.url, comparePath(comparison.id), locale) : absoluteUrl(config, comparePath(comparison.id));
  const ar = locale !== "en";
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${url}#criteria`,
    name: ar ? `${comparison.h1Ar} — معايير المقارنة` : `${comparison.h1En} — comparison criteria`,
    numberOfItems: comparison.criteria.length,
    itemListElement: comparison.criteria.map((criterion, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: ar ? criterion.labelAr : criterion.labelEn,
      alternateName: ar ? criterion.labelEn : criterion.labelAr,
      description: ar ? `${criterion.labelAr}: ${criterion.usAr}` : `${criterion.labelEn}: ${criterion.usEn}`,
    })),
  };
}

/** FAQPage d'une comparaison. */
export function comparisonFaqJsonLd(comparison: ComparisonSeo, locale?: Locale) {
  const ar = locale !== "en";
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale ?? ["en", "ar"],
    mainEntity: comparison.faqs.map((faq) => ({
      "@type": "Question",
      name: ar ? faq.qAr : faq.qEn,
      ...(locale ? {} : { alternateName: faq.qEn }),
      acceptedAnswer: {
        "@type": "Answer",
        text: locale ? (ar ? faq.aAr : faq.aEn) : `${faq.aAr} — ${faq.aEn}`,
      },
    })),
  };
}

/**
 * `CollectionPage` + `ItemList` du hub /compare : liste chaque comparaison
 * avec son URL canonique, pour que Google comprenne l'ensemble du thème.
 */
export function comparisonsCollectionJsonLd(
  config: {
    url: string;
    name: string;
    nameAr: string;
    market?: Parameters<typeof resolveMarket>[0];
  },
  items: ReadonlyArray<ComparisonSeo>,
  locale?: Locale,
) {
  const url = locale ? localizedAbsoluteUrl(config.url, "/compare", locale) : absoluteUrl(config, "/compare");
  const ar = locale !== "en";
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name:
      locale === "en"
        ? "Honest Comparisons: Nukhba vs the Alternatives"
        : "مقارنات صريحة — نخبة Nukhba",
    description:
      locale === "en"
        ? "Honest side-by-side comparisons between Nukhba, paid ads, website builders, freelancers and SEO retainers: cost, speed, ownership and long-term value."
        : "مقارنات صريحة بين نخبة والإعلانات المدفوعة ومنشئات المواقع والمستقلين واشتراكات SEO: التكلفة، السرعة، الملكية والأثر بعد المشروع.",
    url,
    inLanguage: locale ?? ["en", "ar"],
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((comparison, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: locale ? localizedAbsoluteUrl(config.url, comparePath(comparison.id), locale) : absoluteUrl(config, comparePath(comparison.id)),
        name: ar ? `${comparison.h1Ar} — ${comparison.competitorAr}` : `${comparison.h1En} — ${comparison.competitorEn}`,
        description: comparisonText(ar ? comparison.descriptionAr : comparison.descriptionEn, config.market, ar ? "ar" : "en"),
      })),
    },
  };
}

/** FAQ communes du hub /compare. */
export const comparisonsHubFaqs: Faq[] = [
  {
    qAr: "ما المقارنة الأنسب لنسألتنا؟",
    qEn: "Which comparison fits our question best?",
    aAr: "إن كنت تسأل «هل الإعلانات أجدى من موقع؟» ابدأ بمقارنة إعلانات جوجل. إن كان سؤالك «هل القالب الجاهز يكفي؟» فمقارنة Wix هي الأنسب. أما إن كنت تبحث عن أفضل سعر ومضمون، فراجع مقارنة المستقل.",
    aEn: "If your question is “are ads better than a website?”, start with Google Ads. If it is “is a template enough?”, read the Wix comparison. If you are looking for a guaranteed price and delivery, read the freelancer comparison.",
  },
  {
    qAr: "هل المقارنات مبنية على أرقام حقيقية؟",
    qEn: "Are these comparisons based on real numbers?",
    aAr: "الأرقام الخاصة بنخبة مأخوذة من أسعارنا المنشورة (الخدمات والمواقع على صفحات الخدمات والباقات). أرقام البدائل معروضة كـ «نمط تسعير شائع» لأنها تختلف حسب السوق والمنافسة والإعدادات — ونحن نذكر ذلك في كل صفحة.",
    aEn: "Nukhba's own numbers come from our published prices (services and websites on their respective pages). Competitor figures are presented as “typical pricing patterns” because they vary by market, competition and settings — and each page states that explicitly.",
  },
  {
    qAr: "هل يمكن أن تكون المقارنة في صالح البديل؟",
    qEn: "Can a comparison favour the alternative?",
    aAr: "نعم، وده المقصود: لكل مقارنة قسم «الأفضل لـ» يذكر الحالات التي يكون فيها الاختيار الآخر منطقياً — عرض يحتاج نتيجة اليوم، أو مهمة صغيرة لمرة واحدة. المقارنة التي لا تعترف بحدودها ليست مقارنة.",
    aEn: "Yes, and that is the point: every comparison has a “best for” section listing the cases where the other choice makes sense — a promotion that needs results today, or a small one-off task. A comparison that never admits its limits is not a comparison.",
  },
  {
    qAr: "هل تقبلون مشروعاً واحداً فقط؟",
    qEn: "Do you take on single projects?",
    aAr: "بالتأكيد. الخدمات السريعة تُسعَّر وفق الأسعار المنشورة وبعرض سعر مكتوب، ونقبل المشاريع الصغيرة كما نقبل المواقع الكاملة. الاستشارة الأولى مجانية؛ الرد خلال أوقات العمل.",
    aEn: "Absolutely. Standalone services are quoted from our published prices, and we take small projects as seriously as full sites. The initial consultation is free; replies are handled during opening hours.",
  },
];
