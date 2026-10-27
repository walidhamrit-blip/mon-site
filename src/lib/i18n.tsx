"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

export type Locale = "ar" | "en";

export const compareLabels = {
  badgeAr: "مقارنة صريحة",
  badgeEn: "Honest comparison",
  backAr: "كل المقارنات",
  backEn: "All comparisons",
  homeAr: "الرئيسية",
  homeEn: "Home",
  seePricingAr: "شاهد الباقات والأسعار",
  seePricingEn: "See plans & pricing",
  answerTitleAr: "باختصار — الجواب المباشر",
  answerTitleEn: "In short — the direct answer",
  criteriaTitleAr: "المقارنة التفصيلية",
  criteriaTitleEn: "The detailed comparison",
  criteriaSubAr: "سطراً بسطر — بلا مبالغة",
  criteriaSubEn: "line by line — no exaggeration",
  criterionAr: "المعيار",
  criterionEn: "Criterion",
  notIncludedAr: "غير متوفر ضمن الخدمة",
  notIncludedEn: "Not included",
  whenTitleAr: "متى يكون كل خيار منطقياً؟",
  whenTitleEn: "When each option actually makes sense",
  whenThemAr: "اختر {name} إذا",
  whenThemEn: "Choose {name} if",
  whenUsAr: "اختر نخبة إذا",
  whenUsEn: "Choose Nukhba if",
  faqTitleAr: "أسئلة شائعة",
  faqTitleEn: "FAQ",
  summaryTitleAr: "خلاصة المقارنة",
  summaryTitleEn: "The bottom line",
  summaryTextAr: "{note} — موقع من {site} مع تحسين SEO وبيانات منظمة، أو خدمة واحدة من {service}. الاستشارة مجانية والسعر مكتوب قبل البدء.",
  summaryTextEn: "{note} — a website from {site} with SEO and structured data, or a single service from {service}. The consultation is free and the price is written before we start.",
  deliveryAr: "تسليم من 7 أيام",
  deliveryEn: "Delivery in 7 days",
  ownershipAr: "ملكية كاملة للملفات",
  ownershipEn: "Full file ownership",
  replyAr: "رد خلال ساعتين",
  replyEn: "Reply within two hours",
  freeQuoteAr: "اطلب عرض سعر مجاني",
  freeQuoteEn: "Get a free quote",
  quoteAr: "اطلب عرض سعر",
  quoteEn: "Request a quote",
  whatsappAr: "واتساب الآن",
  whatsappEn: "WhatsApp now",
  otherAr: "مقارنات أخرى",
  otherEn: "Other comparisons",
  relatedServicesAr: "الخدمات المرتبطة",
  relatedServicesEn: "Related services",
  allPlansAr: "كل الباقات",
  allPlansEn: "All plans",
  hubTitleAr: "مقارنة صريحة: نخبة مقابل كل بديل",
  hubTitleEn: "An honest comparison: Nukhba vs every alternative",
  hubSubtitleAr: "لا نبيع الأوهام. في كل مقارنة نضع التكلفة والسرعة وملكية العملاء والأثر بعد المشروع — مع الإشارة إلى الحالات التي يكون فيها الخيار الآخر منطقياً.",
  hubSubtitleEn: "No hype: every comparison lays out cost, speed, customer ownership and what survives after the project ends — including the cases where the other option makes sense.",
  hubShortAr: "الإعلانات المدفوعة تشتري زيارات مؤقتة، ومنشئات المواقع الجاهزة تفرض تجديداً سنوياً، والمستقل لا يضمن موعداً ولا دعماً. نخبة تبني أصلاً تملكه: دفعة واحدة، تسليم من 7 أيام، و SEO مدمج من اليوم الأول.",
  hubShortEn: "Paid ads buy temporary traffic, ready-made builders force an annual renewal, and a freelancer guarantees neither a date nor support. Nukhba builds an asset you own: one payment, delivery in 7 days, and SEO built in from day one.",
  hubAllAr: "كل المقارنات",
  hubAllEn: "All comparisons",
  hubReadAr: "اقرأ المقارنة كاملة",
  hubReadEn: "Read the full comparison",
  hubFaqTitleAr: "أسئلة شائعة عن المقارنات",
  hubFaqTitleEn: "Questions about these comparisons",
  hubCtaTitleAr: "بعد المقارنة: عرض سعر خلال ساعتين",
  hubCtaTitleEn: "Read the comparison, then get a quote within two hours",
  hubCtaTextAr: "أرسل لنا نشاطك وميزانيتك التقريبية، ونرد بعرض سعر مكتوب ومدّة تسليم — دون التزام.",
  hubCtaTextEn: "Send us your business and rough budget, and we reply with a written quote and a delivery date — no commitment.",
  openServicesAr: "الخدمات السريعة",
  openServicesEn: "Open services",
  stripTitleAr: "لست متأكداً بين خياراتين؟",
  stripTitleEn: "Not sure between two options?",
  stripSubtitleAr: "قارن نخبة بالإعلانات المدفوعة ومنشئات المواقع والمستقلين واشتراكات SEO — التكلفة والسرعة وملكية العملاء، بصراحة.",
  stripSubtitleEn: "Compare Nukhba with paid ads, website builders, freelancers and SEO retainers — cost, speed and customer ownership, honestly.",
  stripCtaAr: "شاهد كل المقارنات",
  stripCtaEn: "See all comparisons",
  usNameAr: "نخبة Nukhba",
  usNameEn: "Nukhba",
};

/**
 * Libellés de la page « Open services » (/services).
 *
 * Même principe que `compareLabels` : une seule constante partagée par les
 * deux langues, branchée sur `ar` et `en` plus bas. Les contenus éditoriaux
 * (services, FAQ) restent dans `src/lib/services.ts` et la configuration
 * vivante — ici on ne stocke que l'interface de la page.
 */
export const servicesHubLabels = {
  homeAr: "الرئيسية",
  homeEn: "Home",
  badgeAr: "خدمات مفتوحة · Open services",
  badgeEn: "Open services",
  heroTitleAr: "خدمات رقمية سريعة بأسعار معلنة — طرابلس، ليبيا",
  heroTitleEn: "Fast digital services at published prices — Tripoli, Libya",
  heroTextAr:
    "لا تحتاج مشروعاً كاملاً لكل فكرة. اختر الخدمة التي تحتاجها اليوم: تجديد موقعك، إضافة قسم، عرض تقديمي، هوية بصرية، صفحة هبوط أو إصلاح تقني — بأسعار تبدأ من {from} وتسليم يبدأ من {delivery}.",
  heroTextEn:
    "You don't need a full project for every idea. Pick the service you need today: refresh your site, add a section, a presentation deck, a visual identity, a landing page or a technical fix — starting at {from} with delivery from {delivery}.",
  heroSecondaryAr:
    "خدمات رقمية سريعة بأسعار ثابتة في طرابلس، ليبيا — تبدأ من 15 دولاراً وتسليم خلال 24 ساعة.",
  heroSecondaryEn:
    "Fast, fixed-scope digital services in Tripoli, Libya — from $15 with delivery in as little as 24 hours.",
  shortAr: "باختصار:",
  shortEn: "In short:",
  answerAr:
    "نخبة تقدم {count} خدمات رقمية جاهزة للتنفيذ عن بُعد حول العالم — إعادة تصميم موقع ({restyle})، إضافة قسم جديد ({addSection})، عروض تقديمية ({slides})، هوية بصرية ({branding})، صفحة هبوط ({landing})، وإصلاح وتحسين ({fix}). كل الأسعار بالدولار فقط وتُدفع بنفس المبلغ بـ USDT، كاملة أو على دفعتين/ثلاث.",
  answerEn:
    "Nukhba delivers {count} ready-to-run digital services remotely, worldwide — site restyle ({restyle}), new section ({addSection}), presentation decks ({slides}), visual identity ({branding}), landing page ({landing}), and fix & optimise ({fix}). All prices are in dollars only and paid 1:1 in USDT, in full or in two/three instalments.",
  ctaQuoteAr: "اطلب عرض سعر مجاني",
  ctaQuoteEn: "Get a free quote",
  ctaPricingAr: "شاهد باقات المواقع الكاملة",
  ctaPricingEn: "See the full website plans",
  bulletPriceAr: "سعر ثابت مكتوب قبل البدء",
  bulletPriceEn: "A fixed price written down before we start",
  bulletDeliveryAr: "تسليم 24 – 72 ساعة",
  bulletDeliveryEn: "Delivery in 24 – 72 hours",
  bulletRevisionsAr: "مراجعتان مجانيتان",
  bulletRevisionsEn: "Two free revisions",
  gridTitleAr: "كل الخدمات — {count} مهمة جاهزة للتنفيذ",
  gridTitleEn: "All services — {count} ready-to-run tasks",
  gridSubAr: "أسعار بالدولار فقط — 1 دولار = 1 USDT",
  gridSubEn: "USD pricing only — 1 USD = 1 USDT",
  fromAr: "تبدأ من",
  fromEn: "Starts at",
  deliveryAr: "التسليم: {value}",
  deliveryEn: "Delivery: {value}",
  detailsAr: "تفاصيل الخدمة",
  detailsEn: "Service details",
  stepsTitleAr: "كيف تعمل الخدمة السريعة؟",
  stepsTitleEn: "How does a fast service work?",
  stepsSubAr: "ثلاث خطوات، بدون اجتماعات طويلة.",
  stepsSubEn: "Three steps, no long meetings.",
  step1TitleAr: "أرسل التفاصيل",
  step1TitleEn: "Send the details",
  step1DescAr:
    "رابط موقعك أو ملف العرض + ما تريد الوصول إليه. الرد خلال ساعتين في أوقات العمل.",
  step1DescEn:
    "Your site link or deck file + what you want to achieve. Reply within two hours during working hours.",
  step2TitleAr: "عرض سعر ثابت",
  step2TitleEn: "A fixed-price quote",
  step2DescAr:
    "نحدد النطاق والمدة والسعر كتابياً. نبدأ بعد دفعة مقدمة 50% — الباقي عند التسليم.",
  step2DescEn:
    "We agree on scope, timing and price in writing. We start after a 50% deposit — the rest on delivery.",
  step3TitleAr: "تسليم ومراجعة",
  step3TitleEn: "Delivery and review",
  step3DescAr:
    "نسلّم الملفات أو النشر، ثم مراجعتان مجانيتان حتى الرضا الكامل — ودعم 14 يوماً بعدها.",
  step3DescEn:
    "We hand over the files or the go-live, then two free revisions until you're satisfied — plus 14 days of support after.",
  faqTitleAr: "أسئلة شائعة عن الخدمات المفتوحة",
  faqTitleEn: "FAQ about open services",
  faqSubAr: "الخدمات المفتوحة — أسئلة شائعة",
  faqSubEn: "Open services — FAQ",
  exploreAr: "استكشف أيضاً",
  exploreEn: "Explore also",
  linkSectorsAr: "مواقع حسب القطاع",
  linkSectorsEn: "Sites by sector",
  linkDemosAr: "معارض الأعمال الحية",
  linkDemosEn: "Live project showcases",
  linkPricingAr: "باقات المواقع الكاملة",
  linkPricingEn: "Full website plans",
  linkAppsAr: "تطبيقات قريباً",
  linkAppsEn: "Apps coming soon",
  linkContactAr: "تواصل معنا",
  linkContactEn: "Contact us",
};


/**
 * Libellés de la page d'un service (/services/[service]).
 *
 * Même modèle que `compareLabels` et `servicesHubLabels` : une seule
 * constante partagée par les deux langues, branchée sur `ar` et `en` plus
 * bas. Le contenu éditorial du service (titre, description, FAQ) reste dans
 * `src/lib/services.ts` — ici on ne stocke que l'interface de la page.
 */
export const serviceDetailLabels = {
  allServicesAr: "كل الخدمات",
  allServicesEn: "All services",
  breadcrumbAr: "مسار التصفح",
  breadcrumbEn: "Breadcrumb",
  whatsappOrderAr: "اطلب الخدمة على واتساب",
  whatsappOrderEn: "Order this service on WhatsApp",
  quoteFormAr: "نموذج طلب عرض سعر",
  quoteFormEn: "Request a quote",
  startingAtAr: "السعر يبدأ من · STARTING AT",
  startingAtEn: "STARTING AT",
  deliveryAr: "التسليم: {value}",
  deliveryEn: "Delivery: {value}",
  fixedPriceAr: "سعر ثابت + مراجعتان مجانيتان",
  fixedPriceEn: "Fixed price + two free revisions",
  instalmentsAr: "دفع كامل أو 2–3 أقساط",
  instalmentsEn: "Pay in full or in 2–3 instalments",
  comparePlansAr: "مقارنة الباقات الكاملة",
  comparePlansEn: "Compare the full plans",
  shortAr: "باختصار:",
  shortEn: "In short:",
  includedAr: "ما الذي تحصل عليه؟",
  includedEn: "What is included",
  whoForAr: "لمن هذه الخدمة؟",
  whoForEn: "Who is this for?",
  pricingAr: "الأسعار والدفع",
  pricingEn: "Pricing and payment",
  pricingTextAr:
    "تبدأ الخدمة من {price}. السعر النهائي يعتمد على حجم العمل ويُثبَّت كتابياً قبل البدء. نعمل بدفعة مقدمة 50% والباقي عند التسليم، مع إمكانية الدفع بالتحويل البنكي أو نقداً أو بالعملات الرقمية عبر NOWPayments — كاملاً أو على دفعتين/ثلاث.",
  pricingTextEn:
    "The service starts from {price}. The final price depends on the scope and is fixed in writing before we start. We work with a 50% deposit and the balance on delivery, paid by bank transfer, cash or crypto via NOWPayments — in full or in two/three instalments.",
  sectorsAr: "قطاعات نخدمها بهذه الخدمة",
  sectorsEn: "Sectors we serve with this service",
  faqAr: "أسئلة شائعة — {title}",
  faqEn: "FAQ — {title}",
  showcasesAr: "أعمال أنجزناها في هذه القطاعات",
  showcasesEn: "Live showcases in these sectors",
  caseStudyAr: "عرض دراسة الحالة",
  caseStudyEn: "Read the case study",
  othersAr: "خدمات أخرى قد تحتاجها",
  othersEn: "Other services you may need",
  readyAr: "جاهز لتبدأ؟",
  readyEn: "Ready to start?",
  readyTextAr:
    "أرسل رابط موقعك أو ملفك، ونرد خلال ساعتين في أوقات العمل بعرض سعر ثابت ومدة تسليم واضحة. لا التزام قبل الموافقة.",
  readyTextEn:
    "Send your site link or file and we reply within two hours during working hours, with a fixed quote and a clear delivery time. No commitment before you approve.",
  whatsappDirectAr: "واتساب مباشر",
  whatsappDirectEn: "WhatsApp us",
  contactFormAr: "نموذج التواصل",
  contactFormEn: "Contact form",
  officialAr: "الصفحة الرسمية:",
  officialEn: "Official page:",
};

/**
 * Libellés des pages « secteurs » (/sectors et /sectors/[sector]).
 *
 * Même modèle que les autres blocs : une constante partagée, branchée sur
 * `ar` et `en`. Les contenus sectoriels (titres, FAQ) restent dans
 * `src/lib/sectors.ts`.
 */
export const sectorsLabels = {
  heroTitleAr: "تصميم مواقع حسب قطاعك في طرابلس",
  heroTitleEn: "Websites designed for your sector in Tripoli",
  heroTextAr:
    "كل قطاع له لغته، ألوانه ووظائفه — اختر نشاطك واكتشف مواقع حقيقية أنجزناها في نفس مجالك مع أسعار واضحة وخدمات مخصصة.",
  heroTextEn:
    "Every sector has its own language, colours and features — pick your industry and see real sites we built in your field, with clear prices and tailored services.",
  projectsAr: "{count} مشروع",
  projectsEn: "{count} projects",
  projectsOneAr: "مشروع واحد",
  projectsOneEn: "1 project",
  discoverAr: "اكتشف",
  discoverEn: "Explore",
};

/** Libellés de la page d'un secteur (/sectors/[sector]). */
export const sectorDetailLabels = {
  allSectorsAr: "كل القطاعات",
  allSectorsEn: "All sectors",
  browseSitesAr: "استعرض {count} مواقع في هذا القطاع",
  browseSitesEn: "Browse {count} live sites in this sector",
  browseSitesOneAr: "استعرض موقعاً واحداً في هذا القطاع",
  browseSitesOneEn: "Browse 1 live site in this sector",
  quoteFreeAr: "اطلب عرض سعر مجاني",
  quoteFreeEn: "Get a free quote",
  sitesTitleAr: "مواقع {label} — {count} مشروع حي",
  sitesTitleEn: "Sites for {label} — {count} live projects",
  sitesTitleOneAr: "موقع {label} — مشروع حي واحد",
  sitesTitleOneEn: "Site for {label} — 1 live project",
  noProjectsAr: "لا توجد مشاريع في هذا القطاع بعد — كن أول عميل!",
  noProjectsEn: "No projects in this sector yet — be the first client!",
  startProjectAr: "ابدأ مشروعك الآن",
  startProjectEn: "Start your project",
  tierAr: "فئة",
  tierEn: "Tier",
  modelPriceAr: "سعر النموذج",
  modelPriceEn: "Model price",
  onRequestAr: "حسب الطلب",
  onRequestEn: "On request",
  customisationAr: "التخصيص",
  customisationEn: "Customisation",
  quoteAr: "عرض سعر",
  quoteEn: "Quote",
  totalAr: "الإجمالي",
  totalEn: "Total",
  beforePaymentAr: "يُحدد قبل الدفع",
  beforePaymentEn: "Set before payment",
  detailsAr: "عرض التفاصيل",
  detailsEn: "View details",
  ctaTitleAr: "جاهز لموقع {label} احترافي؟",
  ctaTitleEn: "Ready for a professional site for {label}?",
  ctaTextAr:
    "نطلق موقعك في 7-14 يوم مع حجز/بيع أونلاين، SEO محلي، ومتابعة واتساب — احجز استشارتك المجانية اليوم.",
  ctaTextEn:
    "We launch your site in 7-14 days with booking and online sales, local SEO and WhatsApp follow-up — book your free consultation today.",
  ctaQuoteAr: "اطلب عرض سعر",
  ctaQuoteEn: "Request a quote",
  ctaPlansAr: "شاهد الباقات",
  ctaPlansEn: "See the plans",
  includesTitleAr: "ماذا يشمل موقع {label} من نخبة؟",
  includesTitleEn: "What a Nukhba website for {label} includes",
  priceFromAr: "مواقع {label} لدينا تبدأ من {price} حسب الحجم والميزات —",
  priceFromEn: "Our {label} sites start from {price} depending on size and features —",
  comparePlansAr: "قارن الباقات والأسعار",
  comparePlansEn: "Compare plans and pricing",
  faqTitleAr: "أسئلة شائعة — {label}",
  faqTitleEn: "FAQ — {label}",
  otherSectorsAr: "استكشف قطاعات أخرى",
  otherSectorsEn: "Explore other sectors",
};

/** Libellés du tableau comparatif des formules (/pricing). */
export const pricingTableLabels = {
  featureAr: "الميزة",
  featureEn: "Feature",
  websiteAr: "الواجهة",
  websiteEn: "Showcase",
  websitePlusAr: "الواجهة بلس",
  websitePlusEn: "Showcase Plus",
  storeAr: "المتجر",
  storeEn: "Store",
  rowPagesAr: "صفحات",
  rowPagesEn: "Pages",
  rowBlogAr: "مدونة",
  rowBlogEn: "Blog",
  rowBookingAr: "حجز / متجر",
  rowBookingEn: "Booking / store",
  rowLanguagesAr: "لغتين",
  rowLanguagesEn: "Two languages",
  rowSeoAr: "تحسين SEO",
  rowSeoEn: "SEO",
  seoBasicAr: "أساسي",
  seoBasicEn: "Basic",
  seoAdvancedAr: "متقدم",
  seoAdvancedEn: "Advanced",
  seoAdvancedPlusAr: "متقدم+",
  seoAdvancedPlusEn: "Advanced+",
  rowSupportAr: "دعم",
  rowSupportEn: "Support",
  daysAr: "{count} يوم",
  daysEn: "{count} days",
  bookingAr: "حجز",
  bookingEn: "Booking",
  fullStoreAr: "متجر كامل",
  fullStoreEn: "Full store",
};

const translations = {
  ar: {
    compare: compareLabels,
    servicesHub: servicesHubLabels,
    serviceDetail: serviceDetailLabels,
    sectors: sectorsLabels,
    sectorDetail: sectorDetailLabels,
    pricingTable: pricingTableLabels,
    nav: {
      home: "الرئيسية",
      demos: "المعارض",
      pricing: "الباقات",
      services: "خدمات مفتوحة",
      contact: "تواصل",
    },
    hero: {
      badge: "✦ وكالة مواقع فاخرة — عملاء من كل العالم",
      title1: "موقعك الاحترافي",
      title2: "جاهز في أيام",
      title3: "وليس شهور",
      subtitle:
        "نحوّل فكرتك إلى موقع فاخر، سريع، ويبيع — مصمم على هويتك، محسّن لجوجل، وجاهز ليستقبل عملاءك من أول يوم.",
      ctaPrimary: "اطلب عرض سعر مجاني",
      ctaSecondary: "شاهد المعارض الحية",
      trusted: "يثق بنا 120+ نشاط حول العالم",
      rating: "تقييم 4.9/5",
    },
    trust: {
      delivery: "أيام للتسليم",
      projects: "موقع مُنجز",
      satisfaction: "رضا العملاء",
      support: "دعم متواصل",
    },
    why: {
      title: "لماذا نخبة؟",
      subtitle: "لسنا مجرد مصممين — نحن شريك نموك الرقمي",
    },
    demos: {
      title: "معارض تنطق بالفخامة",
      subtitle: "كل معرض موقع حقيقي، سريع، وجاهز للتخصيص على نشاطك",
      viewDemo: "معاينة",
      all: "عرض كل المعارض",
      filter: "فلترة حسب النشاط",
    },
    customizer: {
      title: "جرّب قوة التخصيص",
      subtitle: "غيّر الألوان والخطوط وشاهد موقع الماسة الزرقاء يتشكل أمامك — هذه هي المرونة التي ستحصل عليها",
      accent: "لون التميّز",
      font: "الخط",
      style: "نمط الأقسام",
      previewTitle: "الماسة الزرقاء — للمراتب والمفروشات الفاخرة",
      previewDesc: "فخامة تُعاش، تفاصيل تُروى — الوكيل المعتمد لشركة الفراشة للمراتب الطبية والمفروشات الأصلية في طرابلس",
      previewBtn: "تصفّح المجموعة",
    },
    themes: {
      title: "ثيمات جاهزة… اختر هوية موقعك",
      subtitle:
        "8 ثيمات فاخرة — الأكثر طلباً في مواقع الشركات الفاخرة. كل ثيم يعمل بنسخة فاتحة وأخرى داكنة، والتبديل بينهما يتم بزر مستقل تماماً عن اختيار الثيم.",
      note: "كل ثيم متاح في الوضعين الفاتح والداكن — زر الوضع مستقل في الشريط العلوي أعلى الصفحة.",
    },
    process: {
      title: "من الفكرة إلى الإطلاق",
      subtitle: "5 خطوات واضحة — تعرف أين نحن كل يوم",
      total: "إجمالي المدة: 7-14 يوم",
    },
    pricing: {
      title: "استثمار يعود أضعافاً",
      subtitle: "أسعار واضحة بالدولار، بلا مفاجآت — وكل دولار محسوب ليجلب عملاء",
      compare: "قارن الباقات",
      perMonthNote: "دفع مرة واحدة + استضافة سنة مجاناً",
      popular: "الأكثر اختياراً",
      contactUs: "تحدث معنا",
    },
    testimonials: {
      title: "قصص نجاح عملائنا",
      subtitle: "قبل وبعد — كيف غيّر الموقع أعمالهم",
      before: "قبل",
      after: "بعد",
    },
    faq: {
      title: "أسئلة تهمك",
      subtitle: "كل ما تريد معرفته قبل أن نبدأ",
    },
    cta: {
      title: "جاهز لتنطلق؟",
      subtitle: "احجز استشارتك المجانية اليوم — نرد في أقل من ساعتين",
      formTitle: "اطلب عرضك المجاني",
      guarantee: "✓ رد خلال ساعتين  ✓ بدون التزام  ✓ استشارة مجانية",
    },
    footer: {
      desc: "نصنع مواقع تبيع — فاخرة، سريعة، ومصممة على مقاس طموحك في {place}، وأينما كنت في العالم.",
      links: "روابط سريعة",
      services: "خدماتنا",
      contact: "تواصل",
      rights: "© 2026 نخبة. كل الحقوق محفوظة.",
      madeIn: "من {city} — إلى العالم",
    },
    contactPage: {
      title: "لنتحدث عن مشروعك",
      subtitle: "نرد خلال ساعتين — واتساب أو نموذج، كما تفضل",
      form: "أرسل رسالة",
      info: "معلومات التواصل",
      visit: "زرنا",
    },
    crypto: {
      payWithCrypto: "ادفع بالعملات الرقمية",
      orQuote: "أو اطلب عرض سعر",
      usdNoteAr: "بالدولار — 1 دولار = 1 USDT، دفع آمن عبر NOWPayments",
      usdNoteEn: "in USD — 1 USD = 1 USDT, secure via NOWPayments",
      installmentNoteAr: "دفعة كاملة أو 2-3 أقساط",
      installmentNoteEn: "Pay in full or 2–3 installments",
    },
    checkout: {
      titleAr: "الدفع بالعملات الرقمية",
      titleEn: "Crypto checkout",
      subtitleAr: "دفع آمن عبر NOWPayments — أكثر من 300 عملة",
      subtitleEn: "Secure payment via NOWPayments — 300+ coins",
      nameAr: "الاسم (اختياري)",
      nameEn: "Your name (optional)",
      emailAr: "البريد الإلكتروني",
      emailEn: "Email address",
      emailHintAr: "سنرسل إليك إيصال الدفع وتفاصيل الطلب",
      emailHintEn: "We'll send your receipt and order details here",
      phoneAr: "الهاتف (اختياري)",
      phoneEn: "Phone (optional)",
      continueAr: "متابعة إلى الدفع",
      continueEn: "Continue to payment",
      secureAr: "🔒 تشفير كامل — لا نخزن أي بيانات دفع",
      secureEn: "🔒 Fully encrypted — we never store payment data",
      guaranteeTitleAr: "🛡️ ضمان الخدمة — دفعك محمي",
      guaranteeTitleEn: "🛡️ Service guarantee — your payment is protected",
      guarantee1Ar:
        "التزام كامل بالتسليم حسب المواصفات المتفق عليها — وإن لم تُسلَّم الخدمة كما اتفقنا، تسترجع مبلغك كاملاً.",
      guarantee1En:
        "We deliver the agreed specifications in full — if the service is not delivered as agreed, you get a full refund.",
      guarantee2Ar:
        "دفع آمن عبر بوابة NOWPayments الرسمية — تشفير كامل، ولا نصل إلى بيانات محفظتك أو بطاقتك ولا نخزّنها إطلاقاً.",
      guarantee2En:
        "Secure payment through the official NOWPayments gateway — fully encrypted, we never access or store your wallet or card data.",
      guarantee3Ar:
        "إيصال تأكيد فوري يصلك بالبريد الإلكتروني، وطلبك يُفعَّل فور تأكيد الشبكة — مع متابعتنا لك خلال ساعتين.",
      guarantee3En:
        "Instant email receipt, your order activates as soon as the network confirms — and we follow up within 2 hours.",
      creatingAr: "جارٍ إنشاء الدفع…",
      creatingEn: "Creating your payment…",
      readyAr: "تم إنشاء الدفع. التحويل خلال",
      readyEn: "Payment created. Redirecting in",
      openAr: "فتح صفحة الدفع الآن",
      openEn: "Open payment page now",
      manualAr: "أو ادفع يدوياً من محفظتك:",
      manualEn: "Or pay manually from your wallet:",
      amountDueAr: "المبلغ المستحق",
      amountDueEn: "Amount due",
      payToAr: "العنوان",
      payToEn: "Pay to",
      copyAr: "نسخ",
      copyEn: "Copy",
      copiedAr: "تم النسخ ✓",
      copiedEn: "Copied ✓",
      waitNoteAr:
        "يظهر طلبك كمدفوع على صفحتنا فور تأكيد الشبكة (عادة أقل من 10 دقائق). سنتواصل معك خلال ساعتين.",
      waitNoteEn:
        "Your order shows as paid on our side once the network confirms it (usually under 10 minutes). We'll contact you within 2 hours.",
      errorAr: "تعذر إنشاء الدفع حالياً — حاول مجدداً.",
      errorEn: "Payment could not be created — please retry.",
      retryAr: "إعادة المحاولة",
      retryEn: "Retry",
      closeAr: "إغلاق",
      closeEn: "Close",
      diagTitleAr: "تفاصيل الفشل (تشخيص)",
      diagTitleEn: "Failure details (diagnostic)",
      hintKeyAr: "مفتاح NOWPayments API غير موجود على الخادم — افتح /api/health وتحقق من NOWPAYMENTS_API_KEY على Vercel (بيئة Production) ثم أعد النشر.",
      hintKeyEn:
        "The NOWPayments API key is missing on the server — open /api/health and check NOWPAYMENTS_API_KEY on Vercel (Production environment), then redeploy.",
      hintKeyRejectedAr: "وصل الخادم إلى NOWPayments لكن مفتاح API مرفوض (401/403) — انسخ المفتاح من Settings → API keys (وليس سرّ IPN)، وطابِق البيئة: مفتاح إنتاج مع NOWPAYMENTS_SANDBOX=false أو مفتاح اختبار مع =true، ثم أكّد apiKeyValid:true عبر /api/health.",
      hintKeyRejectedEn:
        "The server reached NOWPayments but the API key was rejected (401/403) — copy the key from Settings → API keys (not the IPN secret) and match the environment: production key with NOWPAYMENTS_SANDBOX=false, or sandbox key with =true. Then confirm apiKeyValid:true via /api/health.",
      hintGatewayAr: "NOWPayments رفض إنشاء الفاتورة — الرسالة الدقيقة أدناه.",
      hintGatewayEn: "NOWPayments refused to create the invoice — exact message below.",
      hintDbAr: "خطأ في قاعدة البيانات — تحقق من DATABASE_URL عبر /api/health.",
      hintDbEn: "Database error — check DATABASE_URL via /api/health.",
      hintNetworkAr: "تعذر الوصول إلى NOWPayments من الخادم (شبكة/مهلة زمنية) — أعد المحاولة.",
      hintNetworkEn:
        "The server could not reach NOWPayments (network/timeout) — please retry.",
      hintOrderAr: "مشكلة في الطلب — راجع صفحة التتبع أو تواصل معنا.",
      hintOrderEn: "Order issue — check the tracking page or contact us.",
      hintPlanAr: "هذه الباقة غير قابلة للدفع عبر الإنترنت — تواصل معنا لعرض سعر.",
      hintPlanEn: "This plan is not payable online — contact us for a quote.",
      hintGenericAr: "الرسالة التقنية أدناه تحدد السبب.",
      hintGenericEn: "The technical message below states the cause.",
      healthLinkAr: "فتح /api/health (تشخيص الخادم)",
      healthLinkEn: "Open /api/health (server diagnostic)",
      totalUsdAr: "الإجمالي بالدولار (= USDT)",
      totalUsdEn: "Total in USD (= USDT)",
      modeAr: "طريقة الدفع",
      modeEn: "Payment method",
      fullAr: "دفعة واحدة",
      fullEn: "One payment",
      tranchesAr: "أقساط",
      tranchesEn: "Installments",
      dueTodayAr: "المستحق اليوم",
      dueTodayEn: "Due today",
      trancheAr: "القسط",
      trancheEn: "Installment",
      trancheNoteAr:
        "يُفتح الدفع الآن للقسط الأول فقط. يمكنك سداد الأقساط المتبقية لاحقاً من صفحة متابعة الطلب.",
      trancheNoteEn:
        "Only the first installment is charged now. You can pay the remaining ones later from the order tracking page.",
    },
    pay: {
      pendingTitleAr: "بانتظار تأكيد الدفع…",
      pendingTitleEn: "Waiting for payment confirmation…",
      pendingNoteAr:
        "بمجرد تأكيد الشبكة، سيظهر طلبك كمدفوع. سنتواصل معك خلال ساعتين لبدء مشروعك.",
      pendingNoteEn:
        "Once the network confirms, your order will show as paid. We'll contact you within 2 hours to start your project.",
      liveAr: "تحديث مباشر كل بضع ثوانٍ",
      liveEn: "Live updates every few seconds",
      paidTitleAr: "تم استلام الدفع ✓",
      paidTitleEn: "Payment received ✓",
      paidNoteAr:
        "شكراً لثقتك بنخبة! أكملنا طلبك وسنتواصل معك خلال ساعتين لبدء مشروعك.",
      paidNoteEn:
        "Thank you for trusting Nukhba! Your order is confirmed and we'll contact you within 2 hours to start your project.",
      failedTitleAr: "الدفع لم يكتمل",
      failedTitleEn: "Payment not completed",
      expiredTitleAr: "انتهت صلاحية الدفع",
      expiredTitleEn: "Payment expired",
      failedNoteAr:
        "لم نستلم الدفعة. يمكنك إعادة المحاولة أو مراسلتنا عبر واتساب.",
      failedNoteEn:
        "We didn't receive the payment. You can retry or message us on WhatsApp.",
      orderAr: "الطلب",
      orderEn: "Order",
      planAr: "الباقة",
      planEn: "Plan",
      amountAr: "المبلغ",
      amountEn: "Amount",
      cryptoAr: "العملة",
      cryptoEn: "Crypto",
      emailAr: "البريد",
      emailEn: "Email",
      notFoundAr: "الطلب غير موجود",
      notFoundEn: "Order not found",
      tranchesTitleAr: "خطة الأقساط",
      tranchesTitleEn: "Installment plan",
      trancheAr: "القسط",
      trancheEn: "Installment",
      payTrancheAr: "ادفع هذا القسط",
      payTrancheEn: "Pay this installment",
      tranchePaidAr: "مدفوع",
      tranchePaidEn: "Paid",
      trancheOpenAr: "متابعة الدفع",
      trancheOpenEn: "Resume payment",
      remainingAr: "المتبقي",
      remainingEn: "Remaining",
      allTranchesPaidAr: "تم سداد جميع الأقساط ✓",
      allTranchesPaidEn: "All installments paid ✓",
      trancheErrorAr: "تعذر إنشاء دفع هذا القسط — حاول مجدداً.",
      trancheErrorEn: "Could not start this installment payment — please retry.",
    },
    flexPay: {
      titleAr: "ادفع ما تشاء — 1 دولار أو أكثر",
      titleEn: "Pay what you want — $1 or more",
      subtitleAr: "حدّد المبلغ بنفسك — مفتوح من 1 دولار. مفيد خصوصاً عندما تفرض منصات العملات الرقمية حدوداً دنيا على المبلغ.",
      subtitleEn: "Set your own amount — open from $1 up. Especially handy when crypto platforms enforce minimum payment limits.",
      amountAr: "المبلغ بالدولار",
      amountEn: "Amount in USD",
      customAr: "أو أدخل مبلغاً مخصصاً",
      customEn: "Or enter a custom amount",
      quickAr: "مبالغ سريعة",
      quickEn: "Quick amounts",
      payAr: "ادفع الآن بالعملات الرقمية",
      payEn: "Pay now with crypto",
      secureAr: "دفع آمن عبر NOWPayments — أكثر من 300 عملة",
      secureEn: "Secure payment via NOWPayments — 300+ coins",
      minErrAr: "الحد الأدنى هو 1 دولار",
      minErrEn: "The minimum is $1",
      maxErrAr: "الحد الأقصى هو 5000 دولار للدفعة الواحدة",
      maxErrEn: "The maximum is $5,000 per payment",
      purposeAr: "وصف (اختياري)",
      purposeEn: "Description (optional)",
      purposeHintAr: "مثال: عربون، دفعة مشروع، دعم…",
      purposeHintEn: "e.g. deposit, project payment, support…",
    },
    services: {
      titleAr: "خدماتنا المفتوحة — اختر ما تحتاجه فقط",
      titleEn: "Open-serve services — pick only what you need",
      subtitleAr: "مهام صغيرة بأسعار واضحة — إعادة تصميم موقع قديم، إضافة قسم، بناء شرائح وعروض تقديمية، تصميم وهوية والمزيد.",
      subtitleEn: "Small tasks, clear prices — restyle an old site, add a section, build slides & decks, branding & design and more.",
      fromAr: "يبدأ من",
      fromEn: "Starting at",
      ctaAr: "اطلب هذه الخدمة",
      ctaEn: "Request this service",
      customAr: "تحتاج شيئاً آخر؟",
      customEn: "Need something else?",
      customCtaAr: "تحدث معنا — ننفّذ كل المهام الرقمية",
      customCtaEn: "Talk to us — we handle any digital task",
    },
  },
  en: {
    compare: compareLabels,
    servicesHub: servicesHubLabels,
    serviceDetail: serviceDetailLabels,
    sectors: sectorsLabels,
    sectorDetail: sectorDetailLabels,
    pricingTable: pricingTableLabels,
    nav: {
      home: "Home",
      demos: "Demos",
      pricing: "Pricing",
      services: "Open services",
      contact: "Contact",
    },
    hero: {
      badge: "✦ Premium Web Agency — Clients Worldwide",
      title1: "Your pro website",
      title2: "ready in days",
      title3: "not months",
      subtitle:
        "We turn your idea into a luxurious, fast, selling machine — crafted on your brand, optimized for Google, ready from day one.",
      ctaPrimary: "Get free quote",
      ctaSecondary: "View live demos",
      trusted: "Trusted by 120+ businesses worldwide",
      rating: "4.9/5 rating",
    },
    trust: {
      delivery: "days delivery",
      projects: "sites delivered",
      satisfaction: "client satisfaction",
      support: "support",
    },
    why: {
      title: "Why Nukhba?",
      subtitle: "Not just designers — your digital growth partner",
    },
    demos: {
      title: "Showcases that speak luxury",
      subtitle: "Each demo is a real, fast site — ready to tailor to your business",
      viewDemo: "Preview",
      all: "View all demos",
      filter: "Filter by sector",
    },
    customizer: {
      title: "Feel the customization",
      subtitle: "Change colors & fonts live on Al-Massa Blue Diamond — this is the flexibility you'll get",
      accent: "Accent color",
      font: "Font",
      style: "Section style",
      previewTitle: "Al-Massa Blue Diamond — Luxury Mattresses",
      previewDesc: "Luxury lived, details told — Authorized Al-Farasha dealer for orthopedic mattresses & bespoke bedding in Tripoli",
      previewBtn: "Explore Collection",
    },
    themes: {
      title: "Ready-made themes… pick your identity",
      subtitle:
        "8 premium themes — the most requested palettes on luxury business websites. Each one runs in a light and a dark version, switched by a button of its own.",
      note: "Every theme ships in both light and dark — the mode has its own button in the top bar.",
    },
    process: {
      title: "From idea to launch",
      subtitle: "5 clear steps — you know where we are every day",
      total: "Total: 7-14 days",
    },
    pricing: {
      title: "Investment that pays back",
      subtitle: "Clear USD pricing, no surprises — every dollar calculated to bring clients",
      compare: "Compare plans",
      perMonthNote: "One-time + 1 year hosting free",
      popular: "Most popular",
      contactUs: "Talk to us",
    },
    testimonials: {
      title: "Client success stories",
      subtitle: "Before & after — how the site transformed them",
      before: "Before",
      after: "After",
    },
    faq: {
      title: "Good to know",
      subtitle: "Everything before we start",
    },
    cta: {
      title: "Ready to launch?",
      subtitle: "Book your free consult today — we reply within 2 hours",
      formTitle: "Get your free quote",
      guarantee: "✓ Reply in 2h  ✓ No commitment  ✓ Free consult",
    },
    footer: {
      desc: "We build sites that sell — luxurious, fast & tailored to your ambition in {place}, and wherever you are in the world.",
      links: "Quick links",
      services: "Services",
      contact: "Contact",
      rights: "© 2026 Nukhba. All rights reserved.",
      madeIn: "From {city} — for the world",
    },
    contactPage: {
      title: "Let's talk about your project",
      subtitle: "We reply in 2 hours — WhatsApp or form, your choice",
      form: "Send message",
      info: "Contact info",
      visit: "Visit us",
    },
    crypto: {
      payWithCrypto: "Pay with crypto",
      orQuote: "or request a quote",
      usdNoteAr: "in USD — secure via NOWPayments",
      usdNoteEn: "in USD — 1 USD = 1 USDT, secure via NOWPayments",
      installmentNoteAr: "Pay in full or 2–3 installments",
      installmentNoteEn: "Pay in full or 2–3 installments",
    },
    checkout: {
      titleAr: "الدفع بالعملات الرقمية",
      titleEn: "Crypto checkout",
      subtitleAr: "دفع آمن عبر NOWPayments — أكثر من 300 عملة",
      subtitleEn: "Secure payment via NOWPayments — 300+ coins",
      nameAr: "Your name (optional)",
      nameEn: "Your name (optional)",
      emailAr: "Email address",
      emailEn: "Email address",
      emailHintAr: "Your receipt and order details go here",
      emailHintEn: "Your receipt and order details go here",
      phoneAr: "Phone (optional)",
      phoneEn: "Phone (optional)",
      continueAr: "Continue to payment",
      continueEn: "Continue to payment",
      secureAr: "🔒 Fully encrypted — we never store payment data",
      secureEn: "🔒 Fully encrypted — we never store payment data",
      guaranteeTitleAr: "🛡️ Service guarantee — your payment is protected",
      guaranteeTitleEn: "🛡️ Service guarantee — your payment is protected",
      guarantee1Ar:
        "We deliver the agreed specifications in full — if the service is not delivered as agreed, you get a full refund.",
      guarantee1En:
        "We deliver the agreed specifications in full — if the service is not delivered as agreed, you get a full refund.",
      guarantee2Ar:
        "Secure payment through the official NOWPayments gateway — fully encrypted, we never access or store your wallet or card data.",
      guarantee2En:
        "Secure payment through the official NOWPayments gateway — fully encrypted, we never access or store your wallet or card data.",
      guarantee3Ar:
        "Instant email receipt, your order activates as soon as the network confirms — and we follow up within 2 hours.",
      guarantee3En:
        "Instant email receipt, your order activates as soon as the network confirms — and we follow up within 2 hours.",
      creatingAr: "Creating your payment…",
      creatingEn: "Creating your payment…",
      readyAr: "Payment created. Redirecting in",
      readyEn: "Payment created. Redirecting in",
      openAr: "Open payment page now",
      openEn: "Open payment page now",
      manualAr: "Or pay manually from your wallet:",
      manualEn: "Or pay manually from your wallet:",
      amountDueAr: "Amount due",
      amountDueEn: "Amount due",
      payToAr: "Pay to",
      payToEn: "Pay to",
      copyAr: "Copy",
      copyEn: "Copy",
      copiedAr: "Copied ✓",
      copiedEn: "Copied ✓",
      waitNoteAr:
        "Your order shows as paid on our side once the network confirms it (usually under 10 minutes). We'll contact you within 2 hours.",
      waitNoteEn:
        "Your order shows as paid on our side once the network confirms it (usually under 10 minutes). We'll contact you within 2 hours.",
      errorAr: "Payment could not be created — please retry.",
      errorEn: "Payment could not be created — please retry.",
      retryAr: "Retry",
      retryEn: "Retry",
      closeAr: "Close",
      closeEn: "Close",
      diagTitleAr: "Failure details (diagnostic)",
      diagTitleEn: "Failure details (diagnostic)",
      hintKeyAr: "The NOWPayments API key is missing on the server — open /api/health and check NOWPAYMENTS_API_KEY on Vercel (Production environment), then redeploy.",
      hintKeyEn:
        "The NOWPayments API key is missing on the server — open /api/health and check NOWPAYMENTS_API_KEY on Vercel (Production environment), then redeploy.",
      hintKeyRejectedAr: "The server reached NOWPayments but the API key was rejected (401/403) — copy the key from Settings → API keys (not the IPN secret) and match the environment: production key with NOWPAYMENTS_SANDBOX=false, or sandbox key with =true. Then confirm apiKeyValid:true via /api/health.",
      hintKeyRejectedEn:
        "The server reached NOWPayments but the API key was rejected (401/403) — copy the key from Settings → API keys (not the IPN secret) and match the environment: production key with NOWPAYMENTS_SANDBOX=false, or sandbox key with =true. Then confirm apiKeyValid:true via /api/health.",
      hintGatewayAr: "NOWPayments refused to create the invoice — exact message below.",
      hintGatewayEn: "NOWPayments refused to create the invoice — exact message below.",
      hintDbAr: "Database error — check DATABASE_URL via /api/health.",
      hintDbEn: "Database error — check DATABASE_URL via /api/health.",
      hintNetworkAr: "The server could not reach NOWPayments (network/timeout) — please retry.",
      hintNetworkEn:
        "The server could not reach NOWPayments (network/timeout) — please retry.",
      hintOrderAr: "Order issue — check the tracking page or contact us.",
      hintOrderEn: "Order issue — check the tracking page or contact us.",
      hintPlanAr: "This plan is not payable online — contact us for a quote.",
      hintPlanEn: "This plan is not payable online — contact us for a quote.",
      hintGenericAr: "The technical message below states the cause.",
      hintGenericEn: "The technical message below states the cause.",
      healthLinkAr: "Open /api/health (server diagnostic)",
      healthLinkEn: "Open /api/health (server diagnostic)",
      totalUsdAr: "Total in USD (= USDT)",
      totalUsdEn: "Total in USD (= USDT)",
      modeAr: "Payment method",
      modeEn: "Payment method",
      fullAr: "One payment",
      fullEn: "One payment",
      tranchesAr: "Installments",
      tranchesEn: "Installments",
      dueTodayAr: "Due today",
      dueTodayEn: "Due today",
      trancheAr: "Installment",
      trancheEn: "Installment",
      trancheNoteAr:
        "Only the first installment is charged now. You can pay the remaining ones later from the order tracking page.",
      trancheNoteEn:
        "Only the first installment is charged now. You can pay the remaining ones later from the order tracking page.",
    },
    pay: {
      pendingTitleAr: "Waiting for payment confirmation…",
      pendingTitleEn: "Waiting for payment confirmation…",
      pendingNoteAr:
        "Once the network confirms, your order will show as paid. We'll contact you within 2 hours to start your project.",
      pendingNoteEn:
        "Once the network confirms, your order will show as paid. We'll contact you within 2 hours to start your project.",
      liveAr: "Live updates every few seconds",
      liveEn: "Live updates every few seconds",
      paidTitleAr: "Payment received ✓",
      paidTitleEn: "Payment received ✓",
      paidNoteAr:
        "Thank you for trusting Nukhba! Your order is confirmed and we'll contact you within 2 hours to start your project.",
      paidNoteEn:
        "Thank you for trusting Nukhba! Your order is confirmed and we'll contact you within 2 hours to start your project.",
      failedTitleAr: "Payment not completed",
      failedTitleEn: "Payment not completed",
      expiredTitleAr: "Payment expired",
      expiredTitleEn: "Payment expired",
      failedNoteAr:
        "We didn't receive the payment. You can retry or message us on WhatsApp.",
      failedNoteEn:
        "We didn't receive the payment. You can retry or message us on WhatsApp.",
      orderAr: "Order",
      orderEn: "Order",
      planAr: "Plan",
      planEn: "Plan",
      amountAr: "Amount",
      amountEn: "Amount",
      cryptoAr: "Crypto",
      cryptoEn: "Crypto",
      emailAr: "Email",
      emailEn: "Email",
      notFoundAr: "Order not found",
      notFoundEn: "Order not found",
      tranchesTitleAr: "Installment plan",
      tranchesTitleEn: "Installment plan",
      trancheAr: "Installment",
      trancheEn: "Installment",
      payTrancheAr: "Pay this installment",
      payTrancheEn: "Pay this installment",
      tranchePaidAr: "Paid",
      tranchePaidEn: "Paid",
      trancheOpenAr: "Resume payment",
      trancheOpenEn: "Resume payment",
      remainingAr: "Remaining",
      remainingEn: "Remaining",
      allTranchesPaidAr: "All installments paid ✓",
      allTranchesPaidEn: "All installments paid ✓",
      trancheErrorAr: "Could not start this installment payment — please retry.",
      trancheErrorEn: "Could not start this installment payment — please retry.",
    },
    flexPay: {
      titleAr: "Pay what you want — $1 or more",
      titleEn: "Pay what you want — $1 or more",
      subtitleAr: "Set your own amount — open from $1 up. Especially handy when crypto platforms enforce minimum payment limits.",
      subtitleEn: "Set your own amount — open from $1 up. Especially handy when crypto platforms enforce minimum payment limits.",
      amountAr: "Amount in USD",
      amountEn: "Amount in USD",
      customAr: "Or enter a custom amount",
      customEn: "Or enter a custom amount",
      quickAr: "Quick amounts",
      quickEn: "Quick amounts",
      payAr: "Pay now with crypto",
      payEn: "Pay now with crypto",
      secureAr: "Secure payment via NOWPayments — 300+ coins",
      secureEn: "Secure payment via NOWPayments — 300+ coins",
      minErrAr: "The minimum is $1",
      minErrEn: "The minimum is $1",
      maxErrAr: "The maximum is $5,000 per payment",
      maxErrEn: "The maximum is $5,000 per payment",
      purposeAr: "Description (optional)",
      purposeEn: "Description (optional)",
      purposeHintAr: "e.g. deposit, project payment, support…",
      purposeHintEn: "e.g. deposit, project payment, support…",
    },
    services: {
      titleAr: "Open-serve services — pick only what you need",
      titleEn: "Open-serve services — pick only what you need",
      subtitleAr: "Small tasks, clear prices — restyle an old site, add a section, build slides & decks, branding & design and more.",
      subtitleEn: "Small tasks, clear prices — restyle an old site, add a section, build slides & decks, branding & design and more.",
      fromAr: "Starting at",
      fromEn: "Starting at",
      ctaAr: "Request this service",
      ctaEn: "Request this service",
      customAr: "Need something else?",
      customEn: "Need something else?",
      customCtaAr: "Talk to us — we handle any digital task",
      customCtaEn: "Talk to us — we handle any digital task",
    },
  },
};

type Translations = typeof translations.ar;

const I18nContext = createContext<{
  locale: Locale;
  t: Translations;
  dir: "rtl" | "ltr";
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
} | null>(null);

// Seuls les choix explicites du visiteur (bouton de langue du site) sont
// mémorisés, sous cette clé. L'ancienne clé `nukhba-locale` était écrite
// automatiquement à chaque visite — y compris pour la simple langue par
// défaut de l'admin — ce qui empêchait tout changement de langue principale
// depuis /admin de prendre effet sur les navigateurs déjà passés par le site.
const LOCALE_KEY = "nukhba-locale-choice";

export function I18nProvider({
  children,
  defaultLocale = "en",
}: {
  children: React.ReactNode;
  /**
   * Langue principale du site, choisie dans /admin → Réglages.
   * Le visiteur qui a déjà choisi une langue (localStorage) la conserve.
   */
  defaultLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    // Priorité : langue explicitement choisie par le visiteur >
    // langue principale (admin), y compris si elle change après coup.
    try {
      localStorage.removeItem("nukhba-locale");
      const saved = localStorage.getItem(LOCALE_KEY) as Locale | null;
      if (saved && (saved === "ar" || saved === "en")) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocaleState(saved);
        return;
      }
    } catch {
      /* localStorage indisponible */
    }
    setLocaleState(defaultLocale);
  }, [defaultLocale]);

  useEffect(() => {
    // ⚠️ Aucune écriture localStorage ici : enregistrer la langue courante
    // transformerait le défaut admin en faux « choix du visiteur ».
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.classList.toggle("rtl", locale === "ar");
  }, [locale]);

  const setLocale = (l: Locale) => {
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      /* localStorage indisponible */
    }
    setLocaleState(l);
  };
  const toggleLocale = () => setLocale(locale === "ar" ? "en" : "ar");
  const t = translations[locale];
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <I18nContext.Provider value={{ locale, t, dir, setLocale, toggleLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be inside I18nProvider");
  return ctx;
}
