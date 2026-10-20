export const siteConfig = {
  name: "Nukhba",
  nameAr: "نخبة",
  tagline: "Agence Web Premium — Tripoli",
  domain: "nokhba.net.ly",
  url: "https://nokhba.net.ly",
  email: "hello@nukhba.ly",
  phone: "+218 91 234 5678",
  whatsapp: "218912345678", // sans +
  address: "شارع الجمهورية، طرابلس، ليبيا",
  addressEn: "Al Jumhouriya Street, Tripoli, Libya",
  hours: "السبت - الخميس: 9:00 - 23:00",
  hoursEn: "Sat - Thu: 9:00 AM - 11:00 PM",

  // Apparence principale du site — modifiable depuis /admin → Réglages.
  // Ce sont les valeurs par DÉFAUT : chaque visiteur peut toujours basculer
  // thème / mode / langue depuis les sélecteurs du site (son choix est alors
  // mémorisé sur son appareil et prime sur ces valeurs).
  appearance: {
    /** Thème principal (palette de couleurs, voir src/lib/themes.ts). */
    themeId: "nukhba",
    /** Mode d'affichage principal : "light" (clair) ou "dark" (sombre). */
    mode: "light",
    /** Langue principale du site : "ar" (arabe) ou "en" (anglais). */
    defaultLocale: "ar",
  },

  // Prix modifiables ici — source unique.
  // La devise principale est le DOLLAR ($) dans toutes les langues : les
  // prix principaux s'affichent en USD (c'est aussi la devise facturée via
  // la passerelle de paiement). Les montants en Livre libyenne restent
  // affichés comme équivalent indicatif (« ≈ … د.ل / LYD »).
  pricing: {
    currency: "$",
    currencyEn: "$",
    plans: [
      {
        id: "vitrine",
        name: "الواجهة",
        nameEn: "Vitrine",
        price: 1490,
        // Équivalent USD pour le paiement crypto (NOWPayments ne
        // facture pas en Livre libyenne). Ajustez selon votre taux.
        priceUsd: 300,
        originalPrice: 1900,
        period: "/ مرة واحدة",
        periodEn: "/ one-time",
        description: "مثالي للانطلاقة الاحترافية",
        descriptionEn: "Perfect for a professional launch",
        featured: false,
        cta: "ابدأ الآن",
        ctaEn: "Start now",
        features: [
          "تصميم حصري على الهوية",
          "5 صفحات مصممة بإتقان",
          "متجاوب 100% — موبايل أولاً",
          "تحسين SEO أساسي",
          "نموذج تواصل + واتساب",
          "تسليم في 7 أيام",
          "دعم 30 يوم",
        ],
        featuresEn: [
          "Exclusive design on brand",
          "5 crafted pages",
          "100% responsive — mobile first",
          "Essential SEO setup",
          "Contact form + WhatsApp",
          "Delivery in 7 days",
          "30 days support",
        ],
      },
      {
        id: "vitrine-plus",
        name: "الواجهة بلس",
        nameEn: "Vitrine+",
        price: 2490,
        priceUsd: 510,
        originalPrice: 3200,
        period: "/ مرة واحدة",
        periodEn: "/ one-time",
        description: "الأكثر طلباً — توازن مثالي",
        descriptionEn: "Most popular — perfect balance",
        featured: true,
        badge: "الأكثر اختياراً",
        badgeEn: "Most chosen",
        cta: "اختر هذه الباقة",
        ctaEn: "Choose this plan",
        features: [
          "كل مزايا الواجهة +",
          "حتى 10 صفحات + مدونة",
          "حجز مواعيد / طاولات",
          "ربط Google Maps & Analytics",
          "تحسين سرعة متقدم (90+ Lighthouse)",
          "لغتين (عربي/إنجليزي)",
          "تسليم في 10 أيام",
          "دعم 60 يوم + تدريب",
        ],
        featuresEn: [
          "All Vitrine features +",
          "Up to 10 pages + blog",
          "Booking / reservation",
          "Google Maps & Analytics",
          "Advanced speed (90+ Lighthouse)",
          "Bilingual (AR/EN)",
          "Delivery in 10 days",
          "60 days support + training",
        ],
      },
      {
        id: "boutique",
        name: "المتجر / الحجز",
        nameEn: "Boutique",
        price: 4290,
        priceUsd: 880,
        originalPrice: null,
        period: "/ مرة واحدة",
        periodEn: "/ one-time",
        description: "للبيع والحجز عبر الإنترنت",
        descriptionEn: "For selling & booking online",
        featured: false,
        cta: "تحدث معنا",
        ctaEn: "Talk to us",
        features: [
          "متجر إلكتروني / نظام حجز كامل",
          "دفع عند الاستلام + تحويل",
          "إدارة منتجات / غرف / خدمات",
          "لوحة تحكم سهلة",
          "إشعارات واتساب تلقائية",
          "تحسين SEO متقدم",
          "تسليم في 14-21 يوم",
          "دعم 90 يوم + صيانة",
        ],
        featuresEn: [
          "Full e-commerce / booking",
          "Cash on delivery + transfer",
          "Products / rooms / services",
          "Easy dashboard",
          "Auto WhatsApp notifications",
          "Advanced SEO",
          "Delivery in 14-21 days",
          "90 days support + maintenance",
        ],
      },
    ],
  },

  // Couleurs — changez en une ligne
  theme: {
    accent: "#C6A664", // doré luxe
    accentHover: "#B89652",
    // Alternative émeraude: "#0F766E"
    // Alternative profonde: "#1A1A1E"
  },

  social: {
    instagram: "https://instagram.com/nukhba.ly",
    facebook: "https://facebook.com/nukhba.ly",
    whatsapp: "https://wa.me/218912345678",
    tiktok: "https://tiktok.com/@nukhba.ly",
  },

  // Réassurance
  stats: {
    delivery: "7 أيام",
    deliveryEn: "7 days",
    sitesDelivered: "120+",
    satisfaction: "98%",
    support: "24/7",
    // Note moyenne + nombre d'avis — SOURCE UNIQUE : affichage site,
    // JSON-LD (aggregateRating, src/lib/seo.ts) et llms.txt lisent ces
    // deux champs. À garder synchronisés avec les avis réellement
    // affichés (section témoignages / fiche Google).
    ratingValue: "4.9",
    reviewCount: "86",
  },

  // Réservation prioritaire — petit acompte pour prendre une place
  // dans le planning. Le montant est déduit du prix final du projet.
  reservation: {
    enabled: true,
    depositUsd: 1,
    depositLyd: 6,
  },

  // Paiement flexible 1 $+ — montant éditable pour contourner les
  // limites minimales des réseaux crypto (ex: certaines pièces exigent
  // ≥ 3–5 $). Le client peut ajuster le montant à la hausse.
  flexiblePayment: {
    enabled: true,
    minUsd: 1,
    maxUsd: 5000,
    suggested: [1, 5, 10, 25, 50, 100, 250],
    noteAr:
      "بعض العملات تفرض حداً أدنى (مثلاً 3–5 دولارات حسب العملة). المبلغ المختار ثابت عند الدفع. إذا كان أقل من الحد الأدنى، ارجع هنا لاختيار مبلغ جديد. ادفع دائماً المبلغ المحدد في الفاتورة.",
    noteEn:
      "Some coins require a minimum (e.g. $3–5 depending on the coin). Your selected amount is locked at checkout. If it is too low, return here to choose a new amount. Always pay the exact amount shown on the invoice.",
  },

  // Services libres / à la carte — petites missions vendues au forfait
  standaloneServices: [
    {
      id: "restyle",
      icon: "Palette",
      titleAr: "إعادة تصميم موقع قديم",
      titleEn: "Restyle an Old Website",
      descAr: "نحوّل موقعك القديم إلى واجهة عصرية سريعة ومتجاوبة — بدون فقدان المحتوى أو الـ SEO.",
      descEn: "Turn your outdated site into a modern, fast, responsive showcase — no content or SEO loss.",
      priceFromUsd: 49,
      priceFromLyd: 290,
      badgeAr: "الأكثر طلباً",
      badgeEn: "Most requested",
      featuresAr: ["تصميم جديد على هويتك", "تسريع + تحسين SEO", "نقل المحتوى مجاناً"],
      featuresEn: ["Fresh brand-aligned design", "Speed + SEO boost", "Free content migration"],
    },
    {
      id: "add-section",
      icon: "LayoutGrid",
      titleAr: "إضافة قسم جديد",
      titleEn: "Add a New Section",
      descAr: "قسم جديد لموقعك الحالي: معرض أعمال، مدونة، حجز مواعيد، متجر مصغّر، أسئلة شائعة...",
      descEn: "A new section for your current site: portfolio, blog, booking, mini-shop, FAQ…",
      priceFromUsd: 19,
      priceFromLyd: 110,
      featuresAr: ["متجاوب 100%", "لوحة تحكم لو احتجت", "تسليم 48–72 ساعة"],
      featuresEn: ["100% responsive", "Admin if needed", "Delivery in 48–72h"],
    },
    {
      id: "slides",
      icon: "Presentation",
      titleAr: "بناء شرائح وعروض",
      titleEn: "Slides & Pitch Decks",
      descAr: "عروض PowerPoint / Google Slides / Keynote فاخرة: بيتش ديك، بروفايل شركة، عرض مبيعات.",
      descEn: "Premium PowerPoint / Google Slides / Keynote decks: pitch deck, company profile, sales deck.",
      priceFromUsd: 29,
      priceFromLyd: 170,
      featuresAr: ["تصميم على الهوية", "إنفوغرافيك وأيقونات", "ملف قابل للتعديل + PDF"],
      featuresEn: ["On-brand design", "Infographics & icons", "Editable file + PDF"],
    },
    {
      id: "branding",
      icon: "PenTool",
      titleAr: "تصميم وهوية",
      titleEn: "Branding & Design",
      descAr: "شعار، ألوان، خطوط، بطاقات، فلاير، منشورات سوشيال — هوية متكاملة جاهزة للطباعة والويب.",
      descEn: "Logo, colors, fonts, cards, flyers, social posts — complete identity ready for print & web.",
      priceFromUsd: 39,
      priceFromLyd: 230,
      featuresAr: ["شعار + دليل ألوان", "قوالب سوشيال", "ملفات AI/SVG/PNG"],
      featuresEn: ["Logo + color guide", "Social templates", "AI/SVG/PNG files"],
    },
    {
      id: "landing",
      icon: "Rocket",
      titleAr: "صفحة هبوط سريعة",
      titleEn: "Landing Page Sprint",
      descAr: "صفحة هبوط واحدة عالية التحويل لإطلاق منتج، حملة، أو حدث — مع فورم وواتساب.",
      descEn: "One high-converting landing page to launch a product, campaign or event — with form & WhatsApp.",
      priceFromUsd: 59,
      priceFromLyd: 350,
      featuresAr: ["كوبي رايتنغ مقنع", "فورم + واتساب + تحليلات", "تسليم 3–5 أيام"],
      featuresEn: ["Persuasive copy", "Form + WhatsApp + analytics", "Delivery in 3–5 days"],
    },
    {
      id: "fix-optimize",
      icon: "Wrench",
      titleAr: "إصلاح وتحسين",
      titleEn: "Fix & Optimize",
      descAr: "حل مشاكل السرعة، التجاوب، الأخطاء، الـ SEO، أو الأمان — تدقيق + إصلاح + تقرير.",
      descEn: "Fix speed, responsiveness, bugs, SEO or security — audit + fix + report.",
      priceFromUsd: 15,
      priceFromLyd: 90,
      featuresAr: ["تدقيق شامل", "إصلاح فوري", "تقرير قبل/بعد"],
      featuresEn: ["Full audit", "Instant fix", "Before/after report"],
    },
  ],
} as const;

export type PricingPlan = (typeof siteConfig.pricing.plans)[number];
