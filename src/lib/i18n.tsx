"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

export type Locale = "ar" | "en";

const translations = {
  ar: {
    nav: {
      home: "الرئيسية",
      demos: "المعارض",
      pricing: "الباقات",
      contact: "تواصل",
    },
    hero: {
      badge: "✦ وكالة طرابلس الأولى للمواقع الفاخرة",
      title1: "موقعك الاحترافي",
      title2: "جاهز في أيام",
      title3: "وليس شهور",
      subtitle:
        "نحوّل فكرتك إلى موقع فاخر، سريع، ويبيع — مصمم على هويتك، محسّن لجوجل، وجاهز ليستقبل عملاءك من أول يوم.",
      ctaPrimary: "اطلب عرض سعر مجاني",
      ctaSecondary: "شاهد المعارض الحية",
      trusted: "يثق بنا 120+ نشاط في طرابلس",
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
      subtitle: "غيّر الألوان والخطوط وشاهد موقعك يتشكل أمامك — هذه هي المرونة التي ستحصل عليها",
      accent: "لون التميّز",
      font: "الخط",
      style: "نمط الأقسام",
      previewTitle: "مطعم الديوان",
      previewDesc: "تجربة طعام لا تُنسى في قلب طرابلس",
      previewBtn: "احجز طاولتك",
    },
    process: {
      title: "من الفكرة إلى الإطلاق",
      subtitle: "5 خطوات واضحة — تعرف أين نحن كل يوم",
      total: "إجمالي المدة: 7-14 يوم",
    },
    pricing: {
      title: "استثمار يعود أضعافاً",
      subtitle: "أسعار واضحة، بلا مفاجآت — وكل دينار محسوب ليجلب عملاء",
      compare: "قارن الباقات",
      perMonthNote: "دفع مرة واحدة + استضافة سنة مجاناً",
      popular: "الأكثر اختياراً",
      contactUs: "تحدث معنا",
    },
    testimonials: {
      title: "قصص نجاح من طرابلس",
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
      desc: "نصنع مواقع تبيع — فاخرة، سريعة، ومصممة على مقاس طموحك في طرابلس وليبيا.",
      links: "روابط سريعة",
      services: "خدماتنا",
      contact: "تواصل",
      rights: "© 2026 نخبة. كل الحقوق محفوظة. صُنع بفخر في طرابلس.",
      madeIn: "صُنع في طرابلس — للعالم",
    },
    contactPage: {
      title: "لنتحدث عن مشروعك",
      subtitle: "نرد خلال ساعتين — واتساب أو نموذج، كما تفضل",
      form: "أرسل رسالة",
      info: "معلومات التواصل",
      visit: "زرنا",
    },
  },
  en: {
    nav: {
      home: "Home",
      demos: "Demos",
      pricing: "Pricing",
      contact: "Contact",
    },
    hero: {
      badge: "✦ Tripoli's #1 Premium Web Agency",
      title1: "Your pro website",
      title2: "ready in days",
      title3: "not months",
      subtitle:
        "We turn your idea into a luxurious, fast, selling machine — crafted on your brand, optimized for Google, ready from day one.",
      ctaPrimary: "Get free quote",
      ctaSecondary: "View live demos",
      trusted: "Trusted by 120+ businesses in Tripoli",
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
      subtitle: "Change colors & fonts live — this is the flexibility you'll get",
      accent: "Accent color",
      font: "Font",
      style: "Section style",
      previewTitle: "Al-Diwan Restaurant",
      previewDesc: "Unforgettable dining in the heart of Tripoli",
      previewBtn: "Book your table",
    },
    process: {
      title: "From idea to launch",
      subtitle: "5 clear steps — you know where we are every day",
      total: "Total: 7-14 days",
    },
    pricing: {
      title: "Investment that pays back",
      subtitle: "Clear pricing, no surprises — every dinar calculated to bring clients",
      compare: "Compare plans",
      perMonthNote: "One-time + 1 year hosting free",
      popular: "Most popular",
      contactUs: "Talk to us",
    },
    testimonials: {
      title: "Success stories from Tripoli",
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
      desc: "We build sites that sell — luxurious, fast & tailored to your ambition in Tripoli & Libya.",
      links: "Quick links",
      services: "Services",
      contact: "Contact",
      rights: "© 2026 Nukhba. All rights reserved. Proudly made in Tripoli.",
      madeIn: "Made in Tripoli — for the world",
    },
    contactPage: {
      title: "Let's talk about your project",
      subtitle: "We reply in 2 hours — WhatsApp or form, your choice",
      form: "Send message",
      info: "Contact info",
      visit: "Visit us",
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

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    const saved = localStorage.getItem("nukhba-locale") as Locale | null;
    if (saved && (saved === "ar" || saved === "en")) setLocaleState(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("nukhba-locale", locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.classList.toggle("rtl", locale === "ar");
  }, [locale]);

  const setLocale = (l: Locale) => setLocaleState(l);
  const toggleLocale = () => setLocaleState((p) => (p === "ar" ? "en" : "ar"));
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
