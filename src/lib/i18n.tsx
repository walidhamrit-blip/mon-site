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
    crypto: {
      payWithCrypto: "ادفع بالعملات الرقمية",
      orQuote: "أو اطلب عرض سعر",
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
    crypto: {
      payWithCrypto: "Pay with crypto",
      orQuote: "or request a quote",
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
