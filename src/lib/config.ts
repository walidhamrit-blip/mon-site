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
  hours: "السبت - الخميس: 9:00 - 18:00",
  hoursEn: "Sat - Thu: 9:00 AM - 6:00 PM",

  // Prix modifiables ici — source unique
  pricing: {
    currency: "د.ل",
    currencyEn: "LYD",
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
  },
} as const;

export type PricingPlan = (typeof siteConfig.pricing.plans)[number];
