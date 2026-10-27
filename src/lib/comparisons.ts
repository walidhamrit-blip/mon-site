import type { Faq } from "./site-types";
import { absoluteUrl, applyMarketTokens } from "./seo";
import { resolveMarket } from "./market";

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
    answerAr:
      "إعلانات جوجل تشتري زيارات مؤقتة: تدفع عن كل نقرة، وتوقف الزيارات لحظة تتوقف عن الدفع، بينما موقع نخبة يُبنى مرة واحدة ويُسجَّل في جوجل لكلمة مفتاحية — فتصل إليك الطلبات حتى بعد إيقاف أي حملة. التكلفة النموذجية للإعلانات $500 إلى $2,000 شهرياً، في مقابل دفعة واحدة تبدأ من $300 لموقع كامل مع تحسين SEO وبيانات منظمة جاهزة للبحث بالذكاء الاصطناعي.",
    answerEn:
      "Google Ads buys temporary visits: you pay for every click and traffic stops the moment you stop paying. A Nukhba website is paid for once and gets indexed on Google for the keywords that matter, so enquiries keep coming after every campaign is switched off. Ads typically run $500–$2,000 per month, against a one-time $300 starting price for a complete site with technical SEO and AI-search structured data.",
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
      { textAr: "صفحات مكتوبة بالعربية والإنجليزية", textEn: "Pages written in Arabic and English" },
      { textAr: "يرسل من نطاقك أنت", textEn: "Sends from your own domain" },
      { textAr: "يستقبل الطلبات والمكالمات 24/7", textEn: "Books the calls and orders 24/7" },
      { textAr: "موقع مباشر في 7 أيام، لا بعد أشهر", textEn: "Live in 7 days, not after months of testing" },
      { textAr: "بلا عقود: تدفع مرة واحدة واملك الموقع", textEn: "No contracts: pay once and keep the site" },
    ],
    criteria: [
      {
        labelAr: "التكلفة الشهرية",
        labelEn: "Monthly cost",
        usAr: "دفعة واحدة: موقع من $300 + خدمات من $15",
        usEn: "One-time: website from $300, services from $15",
        themAr: "عادةً $500 – $2,000+ شهرياً حسب السوق والمنافسة",
        themEn: "Typically $500–$2,000+/month depending on market and competition",
        winner: "us",
      },
      {
        labelAr: "ملكية الزوار",
        labelEn: "Who owns the visitors",
        usAr: "بيانات العملاء تبقى عندك: نموذج يوصلك مباشرة",
        usEn: "Your leads stay with you: the form lands in your inbox and WhatsApp",
        themAr: "الزيارات تعود للمعلِن ما لم تُجدَّد الحملة",
        themEn: "Traffic goes back to the advertiser unless the campaign is renewed",
        winner: "us",
      },
      {
        labelAr: "سرعة أول عميل",
        labelEn: "Time to first customer",
        usAr: "الموقع مباشر خلال 7 أيام، وSEO يعمل بعدها تراكمياً",
        usEn: "Site live within 7 days, then SEO compounds month after month",
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
        aAr: "الإعلان أسرع في الأيام الأولى: تظهر الصفحة خلال ساعات. أما الموقع فيحتاج 7 أيام للظهور ثم يبدأ SEO بالعمل التراكمي، ويستمر أثره سنوات بعد أن يتوقف أي إنفاق إعلاني. أغلب عملائنا يجمعون الاثنين: موقع كحاضرة دائمة، وحملة إعلانية قصيرة مؤقتة عند الحاجة.",
        aEn: "Ads are faster in the first days: the page appears within hours. A website goes live in 7 days and then SEO compounds, lasting for years after ad spend stops. Most of our clients combine both: a site as a permanent reference, plus a short ad campaign when a promotion needs immediate reach.",
      },
      {
        qAr: "كم يكلّف الموقع مقارنة بالحملة الإعلانية؟",
        qEn: "How much does a website cost compared with an ad campaign?",
        aAr: "موقع نخبة يبدأ من 300 دولار لمرة واحدة، والخدمات السريعة من 15 دولاراً. الحملة الإعلانية النموذجية في هذا المجال 500 إلى 2000 دولار شهرياً — أي ما يعادل تكلفة موقع كامل خلال شهر أو شهرين، ثم تسقط التكلفة إلى صفر.",
        aEn: "A Nukhba website starts at $300 one-time, and standalone services from $15. A typical campaign in this market runs $500–$2,000 per month — the cost of a complete website within one or two months, after which the running cost drops to zero.",
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
        aAr: "نبدأ من الموقع القائم: نعيد تصميمه على هويتك مع الحفاظ على روابطك وتحويلات 301، أو نضيف له قسماً واحداً من 19 دولاراً. المهم أن تبقى القيمة التي بنيتها سابقاً، وتُضاف إليها سرعة 90+ وSEO جاهز للذكاء الاصطناعي.",
        aEn: "We start from what you have: we redesign it on your brand while preserving your URLs and 301 redirects, or add a single section from $19. The point is to keep the value you already built and add 90+ speed and AI-ready SEO on top.",
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
    answerAr:
      "إعلانات فيسبوك وإنستغرام مناسبة لاختبار سريع أو لعرض مؤقت يحتاج نتائج فورية، لكنها تعمل بنظام مزاد: تتغير التكلفة والوصول بين يوم وآخر، ولا يبني لك المنشور أي أصل دائم. موقع نخبة يكلّف دفعة واحدة تبدأ من 300 دولار، ويشرح عرضك بصفحات عربية وإنجليزية، ويجمع الطلبات في نموذج متصل بواتساب والبريد، ثم يظهر في نتائج جوجل والبحث بالذكاء الاصطناعي دون توقف.",
    answerEn:
      "Facebook and Instagram ads suit quick tests or time-boxed promotions that need instant results, but they run on an auction: cost and reach change from day to day, and a post builds no permanent asset. A Nukhba website costs one payment starting at $300, explains your offer in Arabic and English pages, funnels every enquiry into a form wired to WhatsApp and email, and then shows up in Google and AI search results without stopping.",
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
      { textAr: "تسليم في 7 أيام بدل أسابيع من التجريب", textEn: "Live in 7 days instead of weeks of ad testing" },
      { textAr: "تكلفة لمرة واحدة", textEn: "A one-time cost" },
    ],
    criteria: [
      {
        labelAr: "التكلفة",
        labelEn: "Cost",
        usAr: "دفعة واحدة من $300 (خدمات من $15)",
        usEn: "One payment from $300 (services from $15)",
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
      "منشئ مواقع جاهز أم موقع مصمّم خصيصاً من نخبة؟ قارن التكلفة على 3 سنوات، السرعة، التحكم، ملكية الملفات و SEO قبل أن تختار.",
    descriptionEn:
      "A ready-made builder or a custom Nukhba site? Compare the 3-year cost, speed, control, file ownership and SEO before you choose.",
    h1Ar: "Wix ومنشئات المواقع أم موقع مصمّم خصيصاً؟",
    h1En: "Wix and website builders, or a custom website?",
    subtitleAr:
      "القوالب الجاهزة سريعة، لكنها تبقى قوالب. الموقع المصمّم لك وحدك يُبنى على هويتك، وبسرعة أعلى وبتكلفة تدفعها مرة واحدة.",
    subtitleEn:
      "Templates are fast, but they stay templates. A site built for you alone runs on your brand, loads faster and costs you once.",
    answerAr:
      "منشئات المواقع مثل Wix مناسبة لقالب بسيط وسريع، لكنها تفرض اشتراكاً شهرياً متكرراً، وتبقى الملفات داخل المنصة، وتحدّ من التحكم بالسرعة وSEO وبنية الصفحات. موقع نخبة يُبنى بـ Next.js على نطاقك أنت: دفعة واحدة تبدأ من 300 دولار، سرعة 90+ على Lighthouse، بنية SEO تقنية وبيانات منظمة مهيّأة للبحث بالذكاء الاصطناعي، ولوحة تحكم بسيطة لتحديث محتواك بنفسك.",
    answerEn:
      "Builders like Wix are fine for a simple template that goes up quickly, but they impose a recurring monthly fee, keep your files inside the platform, and limit control over speed, SEO and page structure. A Nukhba site is built with Next.js on your own domain: a single payment starting at $300, 90+ Lighthouse performance, technical SEO with structured data for AI search, and a simple dashboard so you can update content yourself.",
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
      { textAr: "دفع واحد بلا تجديد سنوي", textEn: "One payment, no annual renewal" },
      { textAr: "سرعة 90+ على Lighthouse", textEn: "90+ Lighthouse performance" },
      { textAr: "SEO و بحث الذكاء الاصطناعي جاهز", textEn: "SEO and AI-search ready" },
      { textAr: "لوحة تحكم بسيطة مع تدريب", textEn: "A simple dashboard plus training" },
      { textAr: "ملكية كاملة للملفات والكود", textEn: "Full ownership of files and code" },
    ],
    criteria: [
      {
        labelAr: "التكلفة على 3 سنوات",
        labelEn: "Cost over 3 years",
        usAr: "دفعة واحدة (من $300) — لا تجديد",
        usEn: "One payment (from $300) — nothing to renew",
        themAr: "اشتراك شهري يتكرر 36 مرة",
        themEn: "A monthly fee repeated 36 times",
        winner: "us",
      },
      {
        labelAr: "التصميم",
        labelEn: "Design",
        usAr: "مصمم من الصفر على ألوانك وخطوطك",
        usEn: "Designed from scratch on your colours and type",
        themAr: "قالب جاهز يشاركك فيه آلاف المواقع",
        themEn: "A ready template shared by thousands of sites",
        winner: "us",
      },
      {
        labelAr: "السرعة",
        labelEn: "Speed",
        usAr: "90+ Lighthouse، صور محسّنة وتحميل فوري",
        usEn: "90+ Lighthouse, optimized images and instant loading",
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
        aAr: "اشتراك Wix يبدأ تقريباً من 20 إلى 50 دولاراً شهرياً حسب الباقة، أي 720 إلى 1800 دولار على 3 سنوات. موقع نخبة يبدأ من 300 دولار لمرة واحدة مع تخصيص واستضافة أول سنة ودعم — أي أرخص غالباً من السنة الأولى نفسها.",
        aEn: "Wix plans start around $20–$50 per month depending on the tier, i.e. $720–$1,800 over three years. A Nukhba site starts at $300 one-time, including customization, the first year of hosting and support — usually cheaper from the very first year.",
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
        aAr: "نبنيها بـ Next.js: ترميز HTML على الخادم، تقسيم الكود، تحميل الصور كـ WebP مع أبعاد محددة، وخطوط مستضافة محلياً ومضغوطة. النتيجة درجة 90+ على Lighthouse في اختبار سرعة الموبايل، وهو عامل ترتيب مباشر في بحث جوجل، خصوصاً على الموبايل.",
        aEn: "We build with Next.js: server-side rendering, code splitting, WebP images with explicit dimensions, and self-hosted compressed fonts. The result is a 90+ Lighthouse score, which is a direct ranking factor on Google — especially on mobile.",
      },
      {
        qAr: "هل يمكنني تعديل المحتوى بنفسي بعد التسليم؟",
        qEn: "Can I edit the content myself after delivery?",
        aAr: "نعم — بحسب المشروع نجهّز لوحة تحكم بسيطة أو نسلّم ملفات Markdown/Notion مهيّأة للنشر، مع تدريب قصير بالفيديو. إن أردت تغييراً كبيراً لاحقاً، نتكفّل به ضمن الدعم المضمون.",
        aEn: "Yes — depending on the project we set up a simple dashboard or hand over Markdown/Notion files ready to publish, with a short video walkthrough. For bigger changes later, we handle them within the guaranteed support.",
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
    answerAr:
      "العمل مع مستقل غالباً أرخص في البداية لكنه غير مضمون: لا عقد، لا موعد تسليم، لا دعم بعد التسليم، والجودة تختلف بين مشروع وآخر. نخبة تلتزم بعرض سعر مكتوب، وموعد تسليم من 7 إلى 14 يوماً، ومراجعتين مجانيتين، ودعم من 30 إلى 90 يوماً بعد الإطلاق، مع ملكية كاملة للملفات والشيفرة. إن كان مشروعك مهماً — علامة تجارية، متجر، نظام حجز — فالفرق في الموثوقية أهم من الفرق البسيط في السعر.",
    answerEn:
      "Working with a freelancer is often cheaper at the start but never guaranteed: no contract, no delivery date, no support after handover, and quality varies from project to project. Nukhba commits to a written quote, a 7–14 day delivery date, two free revision rounds and 30–90 days of support after launch, with full ownership of the files and code. When the project matters — a brand, a store, a booking system — reliability is worth more than a small price gap.",
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
      { textAr: "تسليم مضمون من 7 إلى 14 يوماً", textEn: "Guaranteed delivery in 7–14 days" },
      { textAr: "مراجعتان مجانيتان مشمولتان", textEn: "Two free revision rounds included" },
      { textAr: "دعم بعد الإطلاق من 30 إلى 90 يوماً", textEn: "30–90 days of support after launch" },
      { textAr: "فريق تصميم وتطوير و SEO في مكان واحد", textEn: "Design, development and SEO in one team" },
      { textAr: "دفعات آمنة عبر USDT أو البنك مع فاتورة", textEn: "Secure instalments via USDT or bank transfer, with an invoice" },
    ],
    criteria: [
      {
        labelAr: "ضمان الموعد",
        labelEn: "Guaranteed date",
        usAr: "من 7 إلى 14 يوماً، مكتوب في العرض",
        usEn: "7–14 days, written into the quote",
        themAr: "تقديري، ومخالفته غالباً بلا تعويض",
        themEn: "An estimate, usually with no compensation if it slips",
        winner: "us",
      },
      {
        labelAr: "الدعم بعد التسليم",
        labelEn: "Support after delivery",
        usAr: "30–90 يوماً حسب الباقة",
        usEn: "30–90 days depending on the plan",
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
        usAr: "تصميم حصري على هويتك في كل مشروع",
        usEn: "A bespoke design on your brand for every project",
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
        aAr: "الخدمات السريعة من 24 إلى 72 ساعة، والمواقع الكاملة من 7 إلى 14 يوماً حسب عدد الصفحات والحاجيات (متجر، حجز، لغات). الموعد يُثبَّت في العرض قبل أي دفعة.",
        aEn: "Standalone services take 24–72 hours; complete sites take 7–14 days depending on page count and features (store, booking, languages). The date is fixed in the quote before any payment.",
      },
      {
        qAr: "ماذا لو لم تعجبني النتيجة؟",
        qEn: "What if I don't like the result?",
        aAr: "كل مشروع يشمل مراجعتين مجانيتين ضمن النطاق المتفق عليه، ونعرض تقريراً قبل/بعد بأرقام السرعة. إن لم نصل إلى الاتفاق، نعيد العمل — عربون الحجز 1 دولار فقط يُخصم من السعر النهائي.",
        aEn: "Every project includes two free revision rounds within the agreed scope, plus a before/after report with performance figures. If we still cannot agree, we redo the work — the $1 priority reservation deposit is deducted from the final price.",
      },
      {
        qAr: "هل أستطيع الدفع بالتدريج؟",
        qEn: "Can I pay in instalments?",
        aAr: "نعم — دفعة مقدمة 50% لبدء العمل والباقي عند التسليم، أو تقسيط على دفعتين/ثلاث عبر NOWPayments (ودفعات بـ USDT). كل دفعة لها فاتورة وإيصال وتاريخ استحقاق واضح.",
        aEn: "Yes — a 50% deposit starts the work and the balance falls due on delivery, or you can split it into 2–3 instalments through NOWPayments (USDT recommended). Every payment comes with an invoice, a receipt and a deadline.",
      },
    ],
    relatedServices: ["restyle", "landing", "fix-optimize"],
    related: ["wix", "seo-agency"],
    ctaAr: "اطلب عرض سعر مكتوباً خلال ساعتين",
    ctaEn: "Get a written quote within two hours",
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
    answerAr:
      "وكالات SEO الجيدة تستحق الاشتراك حين يكون لديك موقع قائم يحتاج محتوى وبناء روابط مستمراً. أما مشروع جديد، فالأسرع والأوفر بناء الموقع أصلاً: بنية تقنية صحيحة، سرعة 90+، عناوين ووصفات محسّنة، بيانات منظمة، وllms.txt لمحركات الذكاء الاصطناعي. كلفة الاشتراك النموذجية 1000 دولار شهرياً، أي 12000 دولار سنوياً، مقابل دفعة واحدة من 300 دولار لموقع يبقى يعمل بعد انتهاء العقد.",
    answerEn:
      "Good SEO agencies earn their retainer when you already have a site that needs continuous content and link building. For a new project, the fastest and cheapest route is to build the site with SEO from the start: correct technical structure, 90+ speed, optimised titles and descriptions, structured data and llms.txt for AI crawlers. A typical retainer runs $1,000 per month — $12,000 a year — against a single $300 payment for a site that keeps working after the contract ends.",
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
      { textAr: "سرعة 90+ — عامل ترتيب مباشر", textEn: "90+ speed — a direct ranking factor" },
      { textAr: "دفعة واحدة بدل 12 دفعة", textEn: "One payment instead of twelve" },
      { textAr: "تسليم في 7 أيام", textEn: "Delivered in 7 days" },
      { textAr: "توثيق كامل والملفات عندك", textEn: "Full documentation, and the files are yours" },
    ],
    criteria: [
      {
        labelAr: "الكلفة السنوية",
        labelEn: "Yearly cost",
        usAr: "دفعة واحدة (من $300) للسنة الأولى",
        usEn: "One payment (from $300) for year one",
        themAr: "12 × اشتراك شهري (من $1,000) = $12,000+",
        themEn: "12 × monthly retainer (from $1,000) = $12,000+",
        winner: "us",
      },
      {
        labelAr: "سرعة النتيجة",
        labelEn: "Time to result",
        usAr: "موقع مباشر في 7 أيام + أساس تقني جاهز للترقية",
        usEn: "Site live in 7 days with a technical base ready to grow",
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
        aAr: "أساس تقني كامل: سرعة 90+، بنية عناوين ووصفات، روابط داخلية، بيانات منظمة (Service, LocalBusiness, FAQPage, BreadcrumbList)، صور وسوم بديلة، خريطة موقع، وllms.txt لمحركات الذكاء الاصطناعي، إضافة إلى فحص الفهرسة في Search Console بعد الإطلاق.",
        aEn: "A complete technical foundation: 90+ speed, a title and description architecture, internal linking, structured data (Service, LocalBusiness, FAQPage, BreadcrumbList), images and alt tags, a sitemap, and llms.txt for AI crawlers — plus an indexing check in Search Console after launch.",
      },
      {
        qAr: "كم يستغرق ظهور الموقع في جوجل؟",
        qEn: "How long until the site shows on Google?",
        aAr: "الفهرسة نفسها تستغرق من أيام إلى أسبوعين بعد الإطلاق. أما الترتيب على الكلمات التجارية فبين 1 و3 أشهر حسب المنافسة في سوقك. الوعد الذي نلتزم به هو الأساس الصحيح خلال 7 أيام، لا مركزًا في الصفحة خلال أسبوع.",
        aEn: "Indexing itself takes from a few days to two weeks after launch. Ranking for commercial keywords takes between one and three months depending on competition in your market. What we commit to is a correct foundation in 7 days — not page one in a week.",
      },
      {
        qAr: "هل يمكن شراء خدمة SEO فقط دون موقع؟",
        qEn: "Can I buy SEO alone without a website?",
        aAr: "نعم، عبر خدمة التدقيق والإصلاح (من 15 دولاراً): تقرير من 40+ نقطة عن السرعة والموبايل والـ SEO والأمان، مع إصلاح فوري. لكن الإصلاح بلا أساس تقني صحيح يبقى حلاً مؤقتاً — ولهذا نوصي ببناء الأساس أولاً.",
        aEn: "Yes, through the audit & fix service (from $15): a 40+ point report on speed, mobile, SEO and security, with immediate fixes. But fixes without a correct technical base stay a temporary solution — which is why we recommend building the base first.",
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
) {
  const url = absoluteUrl(config, comparePath(comparison.id));
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: `${comparison.competitorAr} مقابل ${comparison.usPriceLabelAr} — ${comparison.h1Ar}`,
    serviceType: comparison.competitorEn,
    description: comparison.answerAr,
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
              name: criterion.labelAr,
              description: `${criterion.usAr} — ${criterion.themAr ?? ""}`.trim(),
            })),
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      name: comparison.h1Ar,
      description: comparisonText(comparison.descriptionAr, config.market, "ar"),
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
) {
  const url = absoluteUrl(config, comparePath(comparison.id));
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${url}#criteria`,
    name: `${comparison.h1Ar} — معايير المقارنة`,
    numberOfItems: comparison.criteria.length,
    itemListElement: comparison.criteria.map((criterion, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: criterion.labelAr,
      alternateName: criterion.labelEn,
      description: `${criterion.labelAr}: ${criterion.usAr}`,
    })),
  };
}

/** FAQPage d'une comparaison. */
export function comparisonFaqJsonLd(comparison: ComparisonSeo) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: ["en", "ar"],
    mainEntity: comparison.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.qAr,
      alternateName: faq.qEn,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${faq.aAr} — ${faq.aEn}`,
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
) {
  const url = absoluteUrl(config, "/compare");
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name: "مقارنات صريحة — نخبة Nukhba",
    description:
      "مقارنات صريحة بين نخبة والإعلانات المدفوعة ومنشئات المواقع والمستقلين واشتراكات SEO: التكلفة، السرعة، الملكية والأثر بعد المشروع.",
    url,
    inLanguage: ["en", "ar"],
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((comparison, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(config, comparePath(comparison.id)),
        name: `${comparison.h1Ar} — ${comparison.competitorAr}`,
        description: comparisonText(comparison.descriptionAr, config.market, "ar"),
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
    aAr: "الأرقام الخاصة بنخبة مأخوذة من أسعارنا المنشورة (تبدأ من 15 دولاراً للخدمات ومن 300 دولار للمواقع). أرقام البدائل معروضة كـ «نمط تسعير شائع» لأنها تختلف حسب السوق والمنافسة والإعدادات — ونحن نذكر ذلك في كل صفحة.",
    aEn: "Nukhba's own numbers come from our published prices (services from $15, websites from $300). Competitor figures are presented as “typical pricing patterns” because they vary by market, competition and settings — and each page states that explicitly.",
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
    aAr: "بالتأكيد. الخدمات السريعة تبدأ من 15 دولاراً بعرض سعر مكتوب، ونقبل المشاريع الصغيرة كما نقبل المواقع الكاملة. الاستشارة الأولى مجانية وتستغرق ساعتين.",
    aEn: "Absolutely. Standalone services start at $15 with a written quote, and we take small projects as seriously as full sites. The first consultation is free and takes about two hours.",
  },
];
