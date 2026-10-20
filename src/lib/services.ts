import type { Faq } from "./site-types";
import { absoluteUrl } from "./seo";

/**
 * Pages de services à la carte (/services et /services/[service]).
 *
 * Chaque service vendu au forfait dans `config.standaloneServices` obtient
 * une page dédiée, indexable et citable par les moteurs IA :
 *   - un titre/description SEO bilingue calibré pour la requête commerciale
 *     (« إعادة تصميم موقع », « صفحة هبوط », « تصميم شعار »… ) ;
 *   - une réponse directe en tête de page (format « answer-first » apprécié
 *     des extraits enrichis et des LLM) ;
 *   - une FAQ bilingue balisée `FAQPage` ;
 *   - un schéma `Service` + `Offer` (`priceFromUsd`) synchronisé avec /admin.
 *
 * Le contenu éditorial ci-dessous est le socle par défaut. Les champs
 * commercialisés (titre, description courte, prix, prestations) restent lus
 * en direct dans la configuration enregistrée depuis /admin → Réglages :
 * modifier un tarif met immédiatement à jour la page, son schéma et llms.txt.
 */

export interface ServiceLike {
  id: string;
  icon?: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  priceFromUsd: number;
  priceFromLyd: number;
  badgeAr?: string;
  badgeEn?: string;
  featuresAr: readonly string[];
  featuresEn: readonly string[];
}

export interface ServiceLandingContent {
  /** Titre SEO (le suffixe de marque est ajouté par le template Next). */
  titleAr: string;
  titleEn: string;
  /** Meta description calibrée ~150-160 caractères. */
  descriptionAr: string;
  descriptionEn: string;
  h1Ar: string;
  h1En: string;
  subtitleAr: string;
  subtitleEn: string;
  /**
   * Réponse directe placée en tête d'article : la phrase que Google et les
   * assistants IA peuvent reprendre telle quelle. Cible le `speakable`.
   */
  answerAr: string;
  answerEn: string;
  keywordsAr: string[];
  keywordsEn: string[];
  deliverablesAr: string[];
  deliverablesEn: string[];
  deliveryAr: string;
  deliveryEn: string;
  bestForAr: string;
  bestForEn: string;
  faqs: Faq[];
  /** Secteurs du site à mettre en avant en maillage interne. */
  relatedSectors?: string[];
}

/** FAQ communes affichées sur le hub /services. */
export const servicesHubFaqs: Faq[] = [
  {
    qAr: "كيف أطلب خدمة من نخبة؟",
    qEn: "How do I order a service from Nukhba?",
    aAr: "أرسل تفاصيل مشروعك عبر واتساب أو نموذج التواصل. نرد خلال ساعتين في أوقات العمل بعرض سعر واضح ومدة تسليم محددة، ثم نبدأ بعد تأكيد الدفعة الأولى.",
    aEn: "Send your project details via WhatsApp or the contact form. We reply within 2 business hours with a clear quote and delivery date, then start after the first payment is confirmed.",
  },
  {
    qAr: "هل الأسعار المعروضة نهائية؟",
    qEn: "Are the displayed prices final?",
    aAr: "الأسعار «تبدأ من» وتشمل النطاق المعتاد لكل خدمة. السعر النهائي يُثبَّت في عرض مكتوب قبل البدء، ولا تتغير التكلفة بعد الاتفاق.",
    aEn: "Prices are “starting from” and cover the usual scope of each service. The final price is fixed in a written quote before we start, and never changes after agreement.",
  },
  {
    qAr: "كيف يتم الدفع؟",
    qEn: "How does payment work?",
    aAr: "تحويل بنكي أو نقداً أو بالعملات الرقمية عبر NOWPayments، مع إمكانية التقسيط على دفعتين أو ثلاث. نبدأ العمل بعد دفعة مقدمة 50%، والباقي عند التسليم.",
    aEn: "Bank transfer, cash or crypto via NOWPayments, with 2–3 instalments available. Work starts after a 50% deposit and the balance is due on delivery.",
  },
  {
    qAr: "هل تعملون مع عملاء خارج طرابلس؟",
    qEn: "Do you work with clients outside Tripoli?",
    aAr: "نعم — نعمل مع عملاء في كل ليبيا وعن بُعد في الخليج وأوروبا. كل التواصل والتسليم يتم أونلاين مع اجتماعات فيديو عند الحاجة.",
    aEn: "Yes — we work with clients across Libya and remotely in the Gulf and Europe. All communication and delivery happens online, with video calls when needed.",
  },
];

const serviceLandingDefaults: Record<string, ServiceLandingContent> = {
  restyle: {
    titleAr: "إعادة تصميم موقع قديم في طرابلس — تجديد بدون فقدان SEO",
    titleEn: "Website Redesign in Tripoli — Modern Rebuild, Zero SEO Loss",
    descriptionAr:
      "نعيد تصميم موقعك القديم من 49 $ خلال 48–72 ساعة: واجهة عصرية متجاوبة، سرعة 90+، نقل كامل للمحتوى، وتحويلات 301 تحفظ روابطك وترتيبك في جوجل.",
    descriptionEn:
      "Redesign your old website from $49 in 48–72 hours: modern responsive UI, 90+ speed, full content migration and 301 redirects that keep your rankings.",
    h1Ar: "إعادة تصميم موقع قديم — واجهة جديدة تحافظ على ترتيبك",
    h1En: "Website Redesign — A Fresh Look Without Losing Rankings",
    subtitleAr:
      "موقعك يعمل لكنه يبدو قديماً؟ نحوّله إلى واجهة عصرية سريعة على هويتك الحالية، مع الحفاظ على كل صفحة وكل رابط وكل كلمة حسّنتها سابقاً.",
    subtitleEn:
      "Does your site still work but look dated? We rebuild it into a fast, modern storefront on your brand — keeping every page, every URL and every ranking you already earned.",
    answerAr:
      "إعادة تصميم موقع قديم هي تحديث الواجهة والبنية التقنية لموقع قائم مع الحفاظ على روابطه ومحتواه وترتيبه في محركات البحث. في نخبة تبدأ الخدمة من 49 دولاراً وتُسلّم خلال 48 إلى 72 ساعة، وتشمل تصميماً جديداً على هويتك، تحسين السرعة وSEO التقني، ونقل المحتوى مجاناً — دون أي توقف للموقع.",
    answerEn:
      "A website redesign modernises the interface and technical build of an existing site while preserving its URLs, content and search rankings. At Nukhba it starts at $49 and is delivered in 48–72 hours: a new on-brand design, speed and technical SEO improvements, and free content migration — with zero downtime.",
    keywordsAr: [
      "إعادة تصميم موقع قديم",
      "تجديد موقع طرابلس",
      "تحديث موقع ليبيا",
      "تحسين موقع قديم",
    ],
    keywordsEn: [
      "website redesign Tripoli",
      "old website makeover Libya",
      "site refresh Libya",
      "redesign website cost",
    ],
    deliverablesAr: [
      "تشخيص سريع للموقع الحالي: سرعة، موبايل، SEO، أمان",
      "واجهة جديدة كاملة على هويتك الحالية",
      "نقل المحتوى والصور وكل الصفحات دون فقدان",
      "خريطة تحويلات 301 لكل رابط قديم مهم",
      "تحسين السرعة والظهور على الهواتف",
      "تقرير قبل/بعد بأرقام السرعة والزيارات",
    ],
    deliverablesEn: [
      "Rapid audit of the current site: speed, mobile, SEO, security",
      "A complete new interface built on your existing brand",
      "Full migration of content, images and every page",
      "301 redirect map for every important legacy URL",
      "Speed and mobile-experience optimisation",
      "Before/after report with speed and traffic figures",
    ],
    deliveryAr: "48 – 72 ساعة بعد استلام المحتوى",
    deliveryEn: "48 – 72 hours after receiving content",
    bestForAr:
      "الشركات والمتاجر التي تملك موقعاً يعمل لكنه قديم أو بطيء، وتريد وجهاً جديداً دون خسارة ما بنته من سمعة وترتيب.",
    bestForEn:
      "Businesses and stores with a working but dated or slow site that need a new face without losing the reputation and rankings they built.",
    faqs: [
      {
        qAr: "هل سأفقد ترتيبي في جوجل بعد إعادة التصميم؟",
        qEn: "Will I lose my Google rankings after the redesign?",
        aAr: "لا. نحافظ على الروابط نفسها كلما أمكن، ونضع تحويلات 301 دقيقة لكل رابط متغير، ثم نراقب Search Console بعد الإطلاق. بهذه الطريقة ينتقل الترتيب إلى الواجهة الجديدة بدل أن يضيع.",
        aEn: "No. We keep the same URLs wherever possible and add precise 301 redirects for anything that moves, then monitor Search Console after launch. That transfers rankings to the new design instead of losing them.",
      },
      {
        qAr: "كم يستغرق تجديد الموقع؟",
        qEn: "How long does the redesign take?",
        aAr: "من 48 إلى 72 ساعة بعد استلام المحتوى وبيانات الوصول. المواقع الكبيرة (أكثر من 20 صفحة أو متجر بآلاف المنتجات) تحتاج تقديراً خاصاً في عرض السعر.",
        aEn: "48 to 72 hours after receiving content and access details. Larger sites (20+ pages or a store with thousands of products) get a tailored estimate in the quote.",
      },
      {
        qAr: "هل أحتاج معرفة تقنية أو استضافة جديدة؟",
        qEn: "Do I need technical skills or new hosting?",
        aAr: "لا. نتولى التثبيت والنشر على استضافتك الحالية إن كانت مناسبة، أو نرشّح بديلاً أسرع. لا تتعامل مع أي إعداد تقني بنفسك.",
        aEn: "No. We handle installation and deployment on your current hosting if it fits, or recommend a faster option. You never touch technical setup yourself.",
      },
      {
        qAr: "هل يمكن تغيير نظام إدارة المحتوى أثناء إعادة التصميم؟",
        qEn: "Can the CMS change during the redesign?",
        aAr: "نعم — ننقل المحتوى من النظام القديم إلى لوحة حديثة، ونمنحك تدريباً قصيراً بالفيديو لتعديل النصوص والصور بنفسك.",
        aEn: "Yes — we migrate content from the old CMS to a modern dashboard and give you a short video training to edit text and images yourself.",
      },
    ],
    relatedSectors: ["hardware", "stationery"],
  },

  "add-section": {
    titleAr: "إضافة قسم جديد لموقعك في طرابلس — تسليم 48–72 ساعة",
    titleEn: "Add a New Section to Your Website — 48–72h Delivery",
    descriptionAr:
      "نضيف لموقعك قسماً جديداً متجاوباً على هويتك: معرض أعمال، مدونة، حجز مواعيد، متجر مصغّر أو أسئلة شائعة — من 19 $ مع ربط النماذج بواتساب.",
    descriptionEn:
      "We add a responsive new section to your existing site — portfolio, blog, booking, mini-shop or FAQ — from $19, with forms connected to WhatsApp.",
    h1Ar: "إضافة قسم جديد لموقعك الحالي — بدون إعادة بناء",
    h1En: "Add a New Section to Your Existing Website",
    subtitleAr:
      "لا تحتاج موقعاً جديداً لكل فكرة. نضيف القسم الذي تحتاجه إلى موقعك الحالي بنفس الهوية والخطوط والألوان — جاهزاً للنشر في 48 إلى 72 ساعة.",
    subtitleEn:
      "You do not need a whole new website for every idea. We add the section you need to your current site, in the same identity, fonts and colours — ready to publish in 48–72 hours.",
    answerAr:
      "إضافة قسم جديد خدمة تسمح بتوسيع موقعك القائم دون إعادة بنائه: معرض أعمال، مدونة، نظام حجز، متجر مصغّر أو قسم أسئلة شائعة. تبدأ من 19 دولاراً، تُسلّم في 48 إلى 72 ساعة، وتشمل التصميم المتجاوب وربط النماذج بواتساب والبريد، مع لوحة تحكم إن كانت مطلوبة.",
    answerEn:
      "Adding a new section lets you extend an existing website without rebuilding it: portfolio, blog, booking module, mini-shop or FAQ. It starts at $19, ships in 48–72 hours, and includes responsive design, WhatsApp and email form wiring, plus an admin panel when needed.",
    keywordsAr: [
      "إضافة قسم لموقع",
      "تطوير موقع قائم طرابلس",
      "إضافة مدونة لموقع",
      "قسم حجز مواعيد",
    ],
    keywordsEn: [
      "add section to website",
      "website extension Tripoli",
      "add blog to website Libya",
      "booking section website",
    ],
    deliverablesAr: [
      "قسم جديد متجاوب 100% على هويتك الحالية",
      "محتوى وصور منظمين وجاهزين للنشر",
      "ربط النماذج بواتساب والبريد الإلكتروني",
      "لوحة تحكم بسيطة إن كان القسم قابلاً للتحديث",
      "اختبار على الهواتف والأجهزة اللوحية",
      "تركيب ونشر على موقعك الحالي",
    ],
    deliverablesEn: [
      "A fully responsive new section matching your current identity",
      "Organised, publication-ready content and images",
      "Forms connected to WhatsApp and email",
      "A simple admin panel if the section is editable",
      "Testing on phones and tablets",
      "Installation and deployment on your current site",
    ],
    deliveryAr: "48 – 72 ساعة",
    deliveryEn: "48 – 72 hours",
    bestForAr:
      "المواقع التي تعمل جيداً لكنها تفتقد قسماً واحداً: أعمال، مدونة، حجز، متجر خفيف أو أسئلة شائعة.",
    bestForEn:
      "Sites that work well but miss one piece: portfolio, blog, booking, a light shop or an FAQ.",
    faqs: [
      {
        qAr: "هل تحتاجون وصولاً إلى لوحة تحكم موقعي؟",
        qEn: "Do you need access to my website admin?",
        aAr: "نعم، حساباً مؤقتاً بدور محرر أو صلاحية رفع ملفات. وإن لم يكن متاحاً نجهّز القسم كملف مستقل جاهز للتركيب مع تعليمات واضحة.",
        aEn: "Yes, a temporary editor-level account or file-upload access. If that is not possible we deliver the section as a standalone drop-in file with clear instructions.",
      },
      {
        qAr: "هل يمكن إضافة أكثر من قسم بسعر مخفّض؟",
        qEn: "Can I add several sections at a discount?",
        aAr: "نعم — القسم الثاني في نفس الطلب يبدأ من 15 دولاراً، ونقدّم عرضاً مجمّعاً عند طلب ثلاثة أقسام أو أكثر.",
        aEn: "Yes — a second section in the same order starts at $15, and we quote a bundle for three or more sections.",
      },
      {
        qAr: "هل سيظهر القسم الجديد في نتائج جوجل؟",
        qEn: "Will the new section be indexed by Google?",
        aAr: "نعم، نضبط له عنواناً ووصفاً وبيانات منظمة مناسبة، ونضيفه إلى خريطة الموقع ونطلب فهرسته تلقائياً بعد النشر.",
        aEn: "Yes. We give it a dedicated title, description and structured data, add it to the sitemap and request indexing automatically after publishing.",
      },
      {
        qAr: "هل يبقى شكل القسم متطابقاً مع بقية الموقع؟",
        qEn: "Will the section match the rest of the site?",
        aAr: "بالضبط — نستخرج الألوان والخطوط والمسافات من موقعك ونجعل القسم امتداداً طبيعياً له، لا قالباً غريباً عنه.",
        aEn: "Exactly — we extract your colours, fonts and spacing so the section feels like a natural extension, not a bolted-on template.",
      },
    ],
    relatedSectors: ["medical", "restaurant"],
  },

  slides: {
    titleAr: "تصميم عرض تقديمي احترافي في طرابلس — Pitch Deck",
    titleEn: "Pitch Deck & Presentation Design in Tripoli",
    descriptionAr:
      "نصمم عروضاً تقديمية تبيع: Pitch Deck للمستثمرين، ملف شركة، وعرض مبيعات — إنفوغرافيك وأرقام واضحة، ملف قابل للتعديل وPDF، من 29 $.",
    descriptionEn:
      "We design presentations that sell: investor pitch decks, company profiles and sales decks — clear infographics and numbers, editable file and PDF, from $29.",
    h1Ar: "عروض تقديمية تبيع — Pitch Deck وملف شركة وعرض مبيعات",
    h1En: "Presentations That Sell — Pitch Decks, Profiles & Sales Decks",
    subtitleAr:
      "محتواك قوي لكن الشرائح تُضعف الرسالة؟ نحوّلها إلى قصة بصرية مرتبة تُقنع مستثمراً أو عميلاً في أقل من عشر دقائق.",
    subtitleEn:
      "Your content is strong but the slides weaken the message? We turn it into a clean visual story that convinces an investor or a client in under ten minutes.",
    answerAr:
      "تصميم العروض التقديمية هو تحويل محتوى الشركة إلى شرائح احترافية تحكي قصة واضحة: مشكلة، حل، أرقام، عرض. تبدأ الخدمة من 29 دولاراً وتُسلّم في 2 إلى 4 أيام، وتشمل الهيكل والكتابة المختصرة والإنفوغرافيك وملف PowerPoint أو Google Slides أو Keynote قابلاً للتعديل مع نسخة PDF.",
    answerEn:
      "Presentation design turns company content into professional slides that tell a clear story: problem, solution, traction, offer. Pricing starts at $29 with 2–4 day delivery, including structure, concise copywriting, infographics, an editable PowerPoint / Google Slides / Keynote file and a PDF export.",
    keywordsAr: [
      "تصميم عرض تقديمي",
      "بيتش ديك طرابلس",
      "ملف شركة احترافي",
      "عرض مبيعات",
    ],
    keywordsEn: [
      "pitch deck design Tripoli",
      "presentation design Libya",
      "company profile design",
      "sales deck design",
    ],
    deliverablesAr: [
      "هيكلة القصة وترتيب الشرائح منطقياً",
      "كتابة مختصرة وواضحة لكل شريحة",
      "تصميم على هويتك أو هوية جديدة",
      "إنفوغرافيك وأيقونات ومخططات مخصصة",
      "ملف PowerPoint / Google Slides / Keynote قابل للتعديل",
      "نسخة PDF عالية الجودة جاهزة للإرسال",
    ],
    deliverablesEn: [
      "Story structure and a logical slide sequence",
      "Concise, clear copy for every slide",
      "Design on your brand — or a new one",
      "Custom infographics, icons and charts",
      "Editable PowerPoint / Google Slides / Keynote file",
      "High-quality PDF ready to send",
    ],
    deliveryAr: "2 – 4 أيام",
    deliveryEn: "2 – 4 days",
    bestForAr:
      "الشركات الناشئة التي تبحث عن تمويل، وشركات الخدمات التي تحتاج ملفاً تجارياً مقنعاً، وفرق المبيعات التي تعرض كل أسبوع.",
    bestForEn:
      "Startups raising funding, service companies needing a convincing commercial profile, and sales teams presenting every week.",
    faqs: [
      {
        qAr: "هل تكتبون محتوى الشرائح أم أصممها فقط؟",
        qEn: "Do you write the slide copy or just design it?",
        aAr: "الاثنان. نراجع مادتك، نقترح هيكلاً أقوى، ونكتب نصاً مختصراً لكل شريحة ثم نصممه. يمكنك أيضاً إرسال نص نهائي جاهز ونكتفي بالتصميم.",
        aEn: "Both. We review your material, propose a stronger structure, write concise copy per slide, then design it. You can also send final copy and we handle design only.",
      },
      {
        qAr: "كم عدد الشرائح المشمولة؟",
        qEn: "How many slides are included?",
        aAr: "حتى 20 شريحة داخل السعر الأساسي. الشرائح الإضافية أو النسخ المتعددة (عربي/إنجليزي) تُحسب بسعر مخفّض في العرض.",
        aEn: "Up to 20 slides in the base price. Extra slides or multiple language versions (Arabic/English) are quoted at a reduced rate.",
      },
      {
        qAr: "هل الملف قابل للتعديل لاحقاً؟",
        qEn: "Is the file editable later?",
        aAr: "نعم — تسلّم الملف الأصلي القابل للتعديل مع الخطوط المستخدمة ودليل سريع لتحديث الأرقام والصور دون كسر التصميم.",
        aEn: "Yes — you receive the editable source file with the fonts used and a quick guide to update numbers and images without breaking the layout.",
      },
      {
        qAr: "هل تصممون عروضاً بالعربية؟",
        qEn: "Can you design Arabic presentations?",
        aAr: "نعم، والعربية أولويتنا: تنسيق RTL صحيح، خطوط عربية واضحة، وأرقام تُقرأ بسهولة على شاشة العرض أو الورق.",
        aEn: "Yes, Arabic is our priority: correct RTL layout, legible Arabic typefaces, and numbers that read well on screen or in print.",
      },
    ],
  },

  branding: {
    titleAr: "تصميم هوية بصرية وشعار لشركتك في طرابلس — من 39 $",
    titleEn: "Brand Identity & Logo Design in Tripoli — From $39",
    descriptionAr:
      "هوية بصرية متكاملة: شعار أصلي، دليل ألوان وخطوط، بطاقات عمل، قوالب سوشيال وملفات جاهزة للطباعة والويب — من 39 $ وتسليم 3–5 أيام.",
    descriptionEn:
      "Complete visual identity: original logo, colour and type guide, business cards, social templates and print/web-ready files — from $39 in 3–5 days.",
    h1Ar: "هوية بصرية متكاملة تبدأ من شعار أصلي",
    h1En: "A Complete Visual Identity, Starting With an Original Logo",
    subtitleAr:
      "الهوية ليست شعاراً فقط — بل كل ما يجعل عميلك يتعرّف عليك فوراً: الألوان، الخطوط، البطاقات، وقوالب المنشورات، متناسقة على الويب والطباعة.",
    subtitleEn:
      "Identity is more than a logo — it is everything that makes a client recognise you instantly: colours, type, cards and post templates, consistent on web and print.",
    answerAr:
      "الهوية البصرية هي مجموعة العناصر التي تميّز علامتك: الشعار، الألوان، الخطوط، وتطبيقاتها على البطاقات والسوشيال والموقع. تبدأ الخدمة من 39 دولاراً وتُسلّم في 3 إلى 5 أيام، وتشمل ثلاثة اتجاهات للشعار، دليل ألوان وخطوط، قوالب منشورات، وملفات AI/SVG/PNG/PDF جاهزة للطباعة والويب.",
    answerEn:
      "Visual identity is the set of elements that distinguish your brand: logo, colours, typography and their application to cards, social media and the website. Pricing starts at $39 with 3–5 day delivery, including three logo directions, a colour and type guide, social templates and AI/SVG/PNG/PDF files ready for print and web.",
    keywordsAr: [
      "تصميم شعار طرابلس",
      "هوية بصرية ليبيا",
      "تصميم بطاقات عمل",
      "دليل هوية الشركة",
    ],
    keywordsEn: [
      "logo design Tripoli",
      "brand identity Libya",
      "business card design",
      "brand guidelines",
    ],
    deliverablesAr: [
      "ثلاثة اتجاهات إبداعية للشعار مع مراجعتين",
      "دليل ألوان وخطوط قابل للاستخدام",
      "بطاقات عمل وفلاير وورق رسمي",
      "قوالب منشورات إنستغرام وسوشيال",
      "ملفات AI / SVG / PNG / PDF جاهزة",
      "دليل استخدام مبسّط لهوية العلامة",
    ],
    deliverablesEn: [
      "Three creative logo directions with two revision rounds",
      "A usable colour and typography guide",
      "Business cards, flyer and letterhead",
      "Instagram and social post templates",
      "Ready AI / SVG / PNG / PDF files",
      "A simple brand-usage guide",
    ],
    deliveryAr: "3 – 5 أيام",
    deliveryEn: "3 – 5 days",
    bestForAr:
      "المشاريع الجديدة التي تبني علامتها من الصفر، والشركات التي كبرت بهوية قديمة لم تعد تناسب حجمها.",
    bestForEn:
      "New ventures building a brand from scratch, and companies that outgrew an old identity.",
    faqs: [
      {
        qAr: "هل الشعار حصري وملكي بالكامل؟",
        qEn: "Is the logo exclusive and fully mine?",
        aAr: "نعم — بعد التسليم تحصل على ملكية كاملة وحقوق استخدام غير محدودة، ونحفظ لك الملفات المصدرية. لا نعيد استخدام الشعار لأي عميل آخر.",
        aEn: "Yes — after delivery you receive full ownership and unlimited usage rights, plus the source files. We never reuse the logo for another client.",
      },
      {
        qAr: "كم عدد المقترحات والمراجعات؟",
        qEn: "How many concepts and revisions?",
        aAr: "ثلاثة اتجاهات مختلفة في الجولة الأولى، ثم مراجعتان على الاتجاه المختار حتى تصل إلى نتيجة ترضيك.",
        aEn: "Three distinct directions in the first round, then two revision rounds on the chosen direction until you are happy.",
      },
      {
        qAr: "هل الملفات جاهزة للمطبعة؟",
        qEn: "Are the files print-ready?",
        aAr: "نعم، نسلّم نسخ CMYK بدقة عالية مع خطوط محوّلة ومساحات أمان للمطبعة، إضافة إلى نسخ RGB للويب والسوشيال.",
        aEn: "Yes. We deliver high-resolution CMYK versions with outlined fonts and bleed margins for printers, plus RGB versions for web and social.",
      },
      {
        qAr: "هل يمكن تطبيق الهوية على موقعي أيضاً؟",
        qEn: "Can the identity be applied to my website?",
        aAr: "بالتأكيد — نربط الهوية بموقعك ضمن خدمة إعادة التصميم أو إضافة قسم، لتبدو العلامة موحّدة من الشعار حتى آخر صفحة.",
        aEn: "Absolutely — we apply it to your site through the redesign or add-section service so the brand is consistent from the logo to the last page.",
      },
    ],
    relatedSectors: ["beauty", "restaurant"],
  },

  landing: {
    titleAr: "تصميم صفحة هبوط عالية التحويل في طرابلس — 3 إلى 5 أيام",
    titleEn: "High-Converting Landing Page Design in Tripoli — 3–5 Days",
    descriptionAr:
      "صفحة هبوط واحدة بهدف واحد: بيع أو تسجيل. هيكل إقناعي، كتابة إعلانية، نموذج مربوط بواتساب، تتبع تحويلات وسرعة عالية — من 59 $.",
    descriptionEn:
      "One landing page, one goal: sell or capture leads. Persuasive structure, ad copy, WhatsApp-wired form, conversion tracking and high speed — from $59.",
    h1Ar: "صفحة هبوط واحدة… هدف واحد: التحويل",
    h1En: "One Landing Page. One Goal. Conversion.",
    subtitleAr:
      "حملتك تستحق صفحة تشرح العرض في ثوانٍ وتدفع الزائر لاتخاذ خطوة واحدة — لا موقعاً كاملاً يشتت الانتباه.",
    subtitleEn:
      "Your campaign deserves a page that explains the offer in seconds and pushes the visitor to one action — not a full website that scatters attention.",
    answerAr:
      "صفحة الهبوط هي صفحة مستقلة مصممة حول عرض واحد ودعوة إجراء واحدة، هدفها تحويل الزائر إلى عميل أو تسجيل. تبدأ من 59 دولاراً وتُسلّم في 3 إلى 5 أيام، وتشمل هيكلاً إقناعياً، كتابة إعلانية، نموذجاً مربوطاً بواتساب، تتبّع التحويلات، وسرعة تحميل عالية على الهواتف.",
    answerEn:
      "A landing page is a standalone page built around a single offer and a single call to action, designed to turn visitors into customers or leads. It starts at $59 and ships in 3–5 days, including a persuasive structure, ad copy, a WhatsApp-connected form, conversion tracking and fast mobile loading.",
    keywordsAr: [
      "تصميم صفحة هبوط",
      "لاندينغ بيج طرابلس",
      "صفحة هبوط عالية التحويل",
      "حملة إعلانية ليبيا",
    ],
    keywordsEn: [
      "landing page design Tripoli",
      "high-converting landing page Libya",
      "campaign landing page",
      "lead capture page",
    ],
    deliverablesAr: [
      "هيكل إقناعي (عرض، دليل، اعتراضات، دعوة إجراء)",
      "كتابة إعلانية بيعية بالعربية أو الإنجليزية",
      "تصميم فريد على هويتك",
      "نموذج تسجيل مربوط بواتساب والبريد",
      "تتبّع التحويلات وربط Google Analytics",
      "سرعة عالية وتجربة موبايل أولاً",
      "ربط دومين مخصص أو مسار /lp",
    ],
    deliverablesEn: [
      "Persuasive structure (offer, proof, objections, CTA)",
      "Sales copywriting in Arabic or English",
      "A unique design matched to your brand",
      "Lead form connected to WhatsApp and email",
      "Conversion tracking with Google Analytics",
      "High speed and mobile-first experience",
      "Custom domain or /lp path setup",
    ],
    deliveryAr: "3 – 5 أيام",
    deliveryEn: "3 – 5 days",
    bestForAr:
      "إطلاق منتج أو خدمة، حملات إعلانات مدفوعة، تسجيل في حدث أو دورة، أو اختبار عرض جديد قبل بناء موقع كامل.",
    bestForEn:
      "Product or service launches, paid ad campaigns, event or course registration, or testing a new offer before building a full website.",
    faqs: [
      {
        qAr: "هل تشمل الخدمة كتابة النصوص؟",
        qEn: "Does the service include copywriting?",
        aAr: "نعم — نص بيعي كامل مبني على عرضك وجمهورك، مع نسخة بديلة للاختبار A/B إن رغبت. إن كان لديك نص جاهز نراجعه ونحسّنه.",
        aEn: "Yes — full sales copy built on your offer and audience, with an alternate version for A/B testing if you want. If you already have copy, we review and sharpen it.",
      },
      {
        qAr: "هل يمكن ربط الصفحة بحملة إعلانية؟",
        qEn: "Can the page be connected to an ad campaign?",
        aAr: "نعم، نضيف وسوم UTM وبيكسل Meta وGoogle Ads وتتبع تحويلات، ونجهّز الصفحة لاستقبال الزيارات المدفوعة من اليوم الأول.",
        aEn: "Yes. We add UTM tags, Meta and Google Ads pixels and conversion tracking, and prepare the page for paid traffic from day one.",
      },
      {
        qAr: "هل تعمل الصفحة بالعربية والإنجليزية؟",
        qEn: "Does it work in Arabic and English?",
        aAr: "نعم، واجهة ثنائية اللغة مع RTL عربي صحيح، أو نسختين منفصلتين إن كانت الحملتان مختلفتين.",
        aEn: "Yes — a bilingual page with correct Arabic RTL, or two separate versions if the two campaigns differ.",
      },
      {
        qAr: "هل أستطيع تعديل الصفحة بعد التسليم؟",
        qEn: "Can I edit the page after delivery?",
        aAr: "نعم، نسلّمك الصفحة مع طريقة تعديل النصوص والصور، أو نمنحك لوحة بسيطة إن كنت ستغيّر العروض كثيراً.",
        aEn: "Yes. You get the page with instructions to edit text and images, or a simple admin panel if you change offers often.",
      },
    ],
    relatedSectors: ["medical", "beauty"],
  },

  "fix-optimize": {
    titleAr: "تدقيق وإصلاح الموقع: سرعة، أخطاء، SEO وأمان — طرابلس",
    titleEn: "Website Audit, Speed Fix & SEO Cleanup — Tripoli",
    descriptionAr:
      "تدقيق 40+ نقطة وإصلاح فوري: بطء التحميل، أخطاء الموبايل، مشاكل SEO، روابط مكسورة وأمان — تقرير قبل/بعد واضح من 15 $.",
    descriptionEn:
      "40+ point audit and immediate fixes: slow loading, mobile bugs, SEO issues, broken links and security — a clear before/after report from $15.",
    h1Ar: "أصلح موقعك: سرعة، أخطاء، SEO وأمان في تقرير واحد",
    h1En: "Fix Your Website: Speed, Bugs, SEO and Security in One Report",
    subtitleAr:
      "موقعك بطيء أو تظهر فيه أخطاء أو لا يظهر في جوجل؟ نفحصه بدقة، نصلح ما يمكن إصلاحه فوراً، ونمنحك تقريراً بلغة مفهومة بما تبقّى.",
    subtitleEn:
      "Is your site slow, showing errors or invisible on Google? We inspect it thoroughly, fix what can be fixed immediately, and give you a plain-language report for the rest.",
    answerAr:
      "خدمة الإصلاح والتحسين هي تدقيق تقني شامل لموقعك يغطي السرعة، التوافق مع الهواتف، أخطاء الزحف والفهرسة، الروابط المكسورة، وأساسيات الأمان. تبدأ من 15 دولاراً، وتشمل إصلاحاً فورياً للأخطاء القابلة للإصلاح وتقريراً قبل/بعد واضحاً — عادة خلال 24 إلى 48 ساعة.",
    answerEn:
      "The fix-and-optimise service is a full technical audit covering speed, mobile compatibility, crawl and indexing errors, broken links and security basics. It starts at $15, includes immediate fixes for actionable issues and a clear before/after report — usually within 24–48 hours.",
    keywordsAr: [
      "إصلاح موقع",
      "تدقيق SEO موقع",
      "تحسين سرعة الموقع",
      "موقع بطيء ليبيا",
    ],
    keywordsEn: [
      "website audit Tripoli",
      "fix slow website Libya",
      "SEO audit Libya",
      "website speed optimisation",
    ],
    deliverablesAr: [
      "تدقيق 40+ نقطة: سرعة، موبايل، SEO، أمان",
      "إصلاح فوري للأخطاء المرصودة",
      "ضغط الصور وتحسين التحميل",
      "تصحيح العناوين والأوصاف والبيانات المنظمة",
      "فحص الروابط المكسورة وتحويلاتها",
      "تقرير قبل/بعد بلغة واضحة مع أولويات",
    ],
    deliverablesEn: [
      "40+ point audit: speed, mobile, SEO, security",
      "Immediate fixes for detected issues",
      "Image compression and loading optimisation",
      "Title, description and structured-data corrections",
      "Broken-link scan and redirect setup",
      "A plain-language before/after report with priorities",
    ],
    deliveryAr: "24 – 48 ساعة",
    deliveryEn: "24 – 48 hours",
    bestForAr:
      "كل من يملك موقعاً بطيئاً أو لا يظهر في جوجل، أو تظهر له رسائل أخطاء ولا يعرف من أين يبدأ.",
    bestForEn:
      "Anyone with a slow site, poor Google visibility or error messages, who does not know where to start.",
    faqs: [
      {
        qAr: "هل تشمل الخدمة إعادة تصميم الموقع؟",
        qEn: "Does the service include a redesign?",
        aAr: "لا — هذه خدمة تقنية منفصلة. إن كانت الواجهة قديمة أيضاً، نجمعها مع خدمة إعادة التصميم بسعر أفضل في عرض واحد.",
        aEn: "No — this is a separate technical service. If the interface is dated too, we bundle it with the redesign service at a better price in one quote.",
      },
      {
        qAr: "ماذا لو كانت المشكلة في الاستضافة نفسها؟",
        qEn: "What if the problem is the hosting itself?",
        aAr: "نوضح ذلك في التقرير مع بدائل مناسبة لميزانيتك، ويمكننا تولّي النقل إلى استضافة أسرع مقابل تكلفة منفصلة وواضحة.",
        aEn: "We flag it in the report with suitable alternatives for your budget, and can handle migration to faster hosting for a separate, clearly quoted fee.",
      },
      {
        qAr: "هل تحتاجون صلاحيات كاملة على الموقع؟",
        qEn: "Do you need full access to the site?",
        aAr: "صلاحية قراءة كافية للتدقيق؛ وللإصلاح نحتاج وصولاً محدوداً يمكن سحبه بعد الانتهاء. لا نلمس بيانات العملاء أو المدفوعات.",
        aEn: "Read access is enough for the audit; for fixes we need limited access that you can revoke afterwards. We never touch customer or payment data.",
      },
      {
        qAr: "هل تتابعون الموقع بعد الإصلاح؟",
        qEn: "Do you monitor the site after the fix?",
        aAr: "نعم، نراقب Search Console وأرقام السرعة لمدة أسبوعين بعد الإصلاح مجاناً، ونقدّم خطة متابعة شهرية اختيارية لمن يريد استمرارية.",
        aEn: "Yes — we monitor Search Console and speed metrics for two weeks after the fix at no cost, and offer an optional monthly monitoring plan.",
      },
    ],
    relatedSectors: ["hardware", "sanitary"],
  },
};

/** Repli générique pour un service ajouté dans /admin sans contenu éditorial. */
function genericLanding(service: ServiceLike): ServiceLandingContent {
  return {
    titleAr: `${service.titleAr} في طرابلس — نخبة Nukhba`,
    titleEn: `${service.titleEn} in Tripoli — Nukhba`,
    descriptionAr: `${service.descAr} تبدأ من ${service.priceFromUsd} دولار مع تسليم سريع ودعم واتساب — وكالة نخبة في طرابلس، ليبيا.`,
    descriptionEn: `${service.descEn} Starting at $${service.priceFromUsd} with fast delivery and WhatsApp support — Nukhba agency, Tripoli, Libya.`,
    h1Ar: service.titleAr,
    h1En: service.titleEn,
    subtitleAr: service.descAr,
    subtitleEn: service.descEn,
    answerAr: `${service.titleAr}: ${service.descAr} تبدأ الخدمة من ${service.priceFromUsd} دولاراً وتشمل ${service.featuresAr.join("، ")}.`,
    answerEn: `${service.titleEn}: ${service.descEn} The service starts at $${service.priceFromUsd} and includes ${service.featuresEn.join(", ")}.`,
    keywordsAr: [service.titleAr, "خدمات ويب طرابلس"],
    keywordsEn: [service.titleEn, "web services Tripoli"],
    deliverablesAr: [...service.featuresAr],
    deliverablesEn: [...service.featuresEn],
    deliveryAr: "48 – 72 ساعة",
    deliveryEn: "48 – 72 hours",
    bestForAr: "الشركات والأفراد الذين يحتاجون هذه الخدمة بسرعة وبجودة عالية.",
    bestForEn: "Businesses and individuals who need this service quickly and at high quality.",
    faqs: servicesHubFaqs.slice(0, 2),
  };
}

/** Contenu éditorial complet d'un service (socle par défaut ou repli générique). */
export function resolveServiceLanding(service: ServiceLike): ServiceLandingContent {
  return serviceLandingDefaults[service.id] ?? genericLanding(service);
}

/** Retrouve un service dans la configuration vivante par son identifiant. */
export function findService(
  services: ReadonlyArray<ServiceLike>,
  id: string,
): ServiceLike | null {
  return services.find((service) => service.id === id) ?? null;
}

/** URL canonique relative d'une page service. */
export function servicePath(id: string): string {
  return `/services/${id}`;
}

/** Schéma `Service` + `Offer` d'une page /services/[service]. */
export function serviceJsonLd(
  config: { url: string; name: string; nameAr: string; phone?: string; email?: string },
  service: ServiceLike,
  landing: ServiceLandingContent,
) {
  const url = absoluteUrl(config, servicePath(service.id));
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: `${service.titleAr} — ${service.titleEn}`,
    serviceType: service.titleEn,
    description: landing.answerAr,
    url,
    image: absoluteUrl(config, "/og.jpg"),
    provider: { "@id": absoluteUrl(config, "#organization") },
    areaServed: [
      { "@type": "City", name: "Tripoli" },
      { "@type": "Country", name: "Libya" },
    ],
    availableLanguage: ["ar", "en"],
    ...(service.featuresAr.length > 0
      ? {
          serviceOutput: {
            "@type": "Thing",
            name: service.titleAr,
            description: service.featuresAr.join(" · "),
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      name: `${service.titleAr} — ${service.titleEn}`,
      description: landing.descriptionAr,
      url,
      priceCurrency: "USD",
      price: String(service.priceFromUsd),
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "USD",
        minPrice: service.priceFromUsd,
        valueAddedTaxIncluded: false,
      },
      availability: "https://schema.org/InStock",
      seller: { "@id": absoluteUrl(config, "#organization") },
    },
    ...(service.priceFromLyd > 0
      ? {
          additionalProperty: {
            "@type": "PropertyValue",
            name: "Indicative price in Libyan Dinar (LYD)",
            value: service.priceFromLyd,
            unitText: "LYD",
          },
        }
      : {}),
  };
}

/** FAQPage d'un service. */
export function serviceFaqJsonLd(landing: ServiceLandingContent) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: ["ar-LY", "en"],
    mainEntity: landing.faqs.map((faq) => ({
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
 * `CollectionPage` + `ItemList` du hub /services : liste chaque page service
 * avec son URL canonique et son prix de départ, pour que Google et les LLM
 * comprennent immédiatement l'offre à la carte.
 */
export function servicesCollectionJsonLd(
  config: { url: string; name: string; nameAr: string },
  services: ReadonlyArray<ServiceLike>,
) {
  const url = absoluteUrl(config, "/services");
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name: "خدمات نخبة الرقمية السريعة — Nukhba open services",
    description:
      "خدمات رقمية سريعة في طرابلس: إعادة تصميم موقع، إضافة قسم، عروض تقديمية، هوية بصرية، صفحة هبوط، وإصلاح وتحسين — بأسعار معلنة وتسليم سريع.",
    url,
    inLanguage: ["ar-LY", "en"],
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: services.length,
      itemListElement: services.map((service, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(config, servicePath(service.id)),
        name: `${service.titleAr} — ${service.titleEn}`,
        description: service.descAr,
      })),
    },
  };
}
