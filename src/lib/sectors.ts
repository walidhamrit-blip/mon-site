import type { Demo, Faq } from "./site-types";

/**
 * Données SEO sectorielles — source unique pour les pages /sectors/[sector].
 * Chaque secteur possède titres, descriptions, mots-clés et FAQs dédiés
 * optimisés pour le SEO local Tripoli + GEO IA.
 */

export interface SectorSeo {
  id: string;
  labelAr: string;
  labelEn: string;
  // Titres SEO dédiés
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  h1Ar: string;
  h1En: string;
  heroSubtitleAr: string;
  heroSubtitleEn: string;
  keywordsAr: string[];
  keywordsEn: string[];
  // FAQs sectorielles (4-6 Q/R par secteur)
  faqsAr: Faq[];
}

/**
 * Base de données sectorielle — titres calibrés Google (60/160) avec
 * mention systématique de Tripoli/Libye et du secteur.
 * Ajoutez un nouveau secteur ici et il apparaît automatiquement au sitemap,
 * dans /llms.txt et en page dédiée.
 */
export const sectorSeo: Record<string, SectorSeo> = {
  medical: {
    id: "medical",
    labelAr: "عيادات وصحة",
    labelEn: "Clinics & Health",
    titleAr: "تصميم مواقع عيادات في طرابلس — حجز مواعيد أونلاين",
    titleEn: "Clinic & Healthcare Website Design in Tripoli — Online Booking",
    descriptionAr:
      "وكالة نخبة تصمم مواقع عيادات ومراكز صحية في طرابلس: حجز مواعيد حسب التاريخ، عرض الأطباء والخدمات، تقييم 4.9/5، وتواصل واتساب مباشر — تسليم 7-10 أيام.",
    descriptionEn:
      "Nukhba builds clinic & healthcare sites in Tripoli: date-based appointment booking, doctor & services showcase, 4.9/5 trust rating and WhatsApp contact — delivered in 7-10 days.",
    h1Ar: "تصميم مواقع عيادات ومراكز صحية في طرابلس",
    h1En: "Clinic & Healthcare Websites in Tripoli",
    heroSubtitleAr:
      "مواقع أنيقة لعيادات عامة وأسنان وتجميل — حجز ذاتي 24/7، تعريف بالطبيب، وخدمات واضحة تزيد ثقة المرضى وتحجز مواعيدهم حتى وأنت نائم.",
    heroSubtitleEn:
      "Elegant sites for general, dental & aesthetic clinics — self-booking 24/7, doctor profiles and clear services that build trust and fill appointments.",
    keywordsAr: ["تصميم موقع عيادة طرابلس", "حجز مواعيد أونلاين", "موقع طبي ليبيا"],
    keywordsEn: ["clinic website Tripoli", "medical booking Libya", "healthcare web design"],
    faqsAr: [
      {
        qAr: "كم يستغرق إنشاء موقع عيادة؟",
        qEn: "How long to build a clinic website?",
        aAr: "من 7 إلى 10 أيام: نطلق صفحة الحجز والتعريف بالطبيب في 48 ساعة، ثم نضيف الخدمات والتقييمات حتى التسليم.",
        aEn: "7 to 10 days: booking & doctor pages go live in 48h, then we add services & reviews until delivery.",
      },
      {
        qAr: "هل المرضى يستطيعون حجز موعد أونلاين؟",
        qEn: "Can patients book online?",
        aAr: "نعم — يختار المريض نوع الاستشارة والتاريخ، ويرى أقرب موعد متاح مع تأكيد عبر واتساب.",
        aEn: "Yes — patients pick consultation type & date, see next availability, and confirm via WhatsApp.",
      },
      {
        qAr: "هل الموقع يعمل بالعربية والإنجليزية والفرنسية؟",
        qEn: "Is it trilingual?",
        aAr: "نعم، واجهة ثلاثية اللغات مع RTL عربي صحيح وفلاتر لغة سهلة لكبار السن.",
        aEn: "Yes — AR/EN/FR with proper RTL Arabic and easy language switch for elderly patients.",
      },
      {
        qAr: "هل يظهر موقع العيادة في جوجل بسرعة؟",
        qEn: "Will the clinic rank on Google?",
        aAr: "نعم — بنية SEO محلية (Tripoli + geo)، بيانات منظمة وسرعة 90+ Lighthouse تجعل جوجل يجدكم قبل المنافسين.",
        aEn: "Yes — local SEO (Tripoli + geo), structured data & 90+ Lighthouse speed put you ahead on Google.",
      },
    ],
  },
  restaurant: {
    id: "restaurant",
    labelAr: "مطاعم",
    labelEn: "Restaurants",
    titleAr: "تصميم مواقع مطاعم في طرابلس — قائمة رقمية وطلب واتساب",
    titleEn: "Restaurant Website Design in Tripoli — Digital Menu & WhatsApp Orders",
    descriptionAr:
      "مواقع مطاعم في طرابلس بقائمة تفاعلية، استوديو تخصيص البيتزا، سلة طلبات وتوصيل سريع — مطابخ ليبية وإيطالية، مطاعم عائلية ومقاهٍ.",
    descriptionEn:
      "Restaurant sites in Tripoli with interactive menu, pizza customizer, cart & fast delivery — Libyan, Italian, family restaurants & cafés.",
    h1Ar: "تصميم مواقع مطاعم ومقاهٍ في طرابلس",
    h1En: "Restaurant Websites in Tripoli",
    heroSubtitleAr:
      "قوائم رقمية تفاعلية، تخصيص البيتزا خطوة بخطوة، باقات عائلية وعروض — طلب فوري عبر واتساب وتوصيل يزيد مبيعاتكم من أول أسبوع.",
    heroSubtitleEn:
      "Interactive digital menus, step-by-step pizza studio, family packs & deals — instant WhatsApp ordering & fast delivery that boosts sales week one.",
    keywordsAr: ["تصميم موقع مطعم طرابلس", "قائمة طعام رقمية", "طلب واتساب"],
    keywordsEn: ["restaurant website Tripoli", "digital menu Libya", "WhatsApp ordering"],
    faqsAr: [
      {
        qAr: "هل يشمل موقع المطعم قائمة طعام رقمية قابلة للمشاركة؟",
        qEn: "Does it include a shareable digital menu?",
        aAr: "نعم — قائمة بفلترة فورية، صور أطباق، أسعار واضحة، ورابط QR للمشاركة على الطاولات وواتساب.",
        aEn: "Yes — instantly filtered menu with dish photos, clear prices & QR share link for tables & WhatsApp.",
      },
      {
        qAr: "كيف يستقبل المطعم الطلبات؟",
        qEn: "How are orders received?",
        aAr: "سلة ذكية ترسل الطلب مباشرة إلى واتساب المطبخ مع تفاصيل العنوان والدفع عند الاستلام أو التحويل.",
        aEn: "Smart cart pushes orders straight to kitchen WhatsApp with address & cash/transfer details.",
      },
      {
        qAr: "هل يمكن عرض عروض مثل 3 بيتزا بسعر خاص؟",
        qEn: "Can we show bundle deals?",
        aAr: "نعم — وحدة عروض وباقات عائلية مع عداد تنازلي وأكواد خصم تشجع الطلب الجماعي.",
        aEn: "Yes — deals & family packs module with countdown & promo codes to drive group orders.",
      },
      {
        qAr: "ماذا عن مطاعم المطبخ الليبي الأصيل؟",
        qEn: "What about traditional Libyan cuisine?",
        aAr: "ندعم قوائم ليبية (كسكس، بازين، رشتة، مبخبقة) بهوية دافئة عصرية وقسم قصص المطبخ.",
        aEn: "We support Libyan menus (couscous, bazin, rishta, mbakbaka) with warm modern identity & kitchen stories.",
      },
    ],
  },
  beauty: {
    id: "beauty",
    labelAr: "عطور وتجميل",
    labelEn: "Perfumes & Beauty",
    titleAr: "تصميم متاجر عطور وتجميل في طرابلس — بيع أونلاين",
    titleEn: "Perfume & Beauty Store Design in Tripoli — Online Sales",
    descriptionAr:
      "متاجر عطور ومستحضرات تجميل في طرابلس: باقات Mix & Match، أكواد خصم، مجموعات هدايا، وسلة ذكية ثنائية اللغة — تصميم فاخر يبيع.",
    descriptionEn:
      "Perfume & beauty stores in Tripoli: Mix & Match bundles, promo codes, gift sets & bilingual smart cart — luxury design that sells.",
    h1Ar: "متاجر عطور وتجميل فاخر في طرابلس",
    h1En: "Perfume & Luxury Beauty Stores in Tripoli",
    heroSubtitleAr:
      "عطور، مكياج وعناية بشرة في واجهة فاخرة — باقات «3 بسعر واحد»، أكواد خصم داخل المتجر، وتجربة AR/EN تمنح الثقة وتزيد السلة المتوسطة.",
    heroSubtitleEn:
      "Fragrances, makeup & skincare in premium storefront — 3-for-one-price bundles, in-store promo codes & bilingual AR/EN experience boosting average cart.",
    keywordsAr: ["تصميم متجر عطور طرابلس", "متجر تجميل ليبيا"],
    keywordsEn: ["perfume store Tripoli", "beauty e-commerce Libya"],
    faqsAr: [
      {
        qAr: "هل يدعم المتجر عروض Mix & Match؟",
        qEn: "Does it support Mix & Match bundles?",
        aAr: "نعم — العملاء يختارون 3 منتجات بسعر باقة واحد مع احتساب تلقائي للسعر وتحديث السلة لحظياً.",
        aEn: "Yes — shoppers pick any 3 items at one bundle price with auto-priced cart & live updates.",
      },
      {
        qAr: "كيف نعرض الأكواد الترويجية؟",
        qEn: "How are promo codes handled?",
        aAr: "حقل كود خصم ذكي مع تحقق فوري وتطبيق الخصم على السلة مع رسالة تأكيد.",
        aEn: "Smart coupon field with instant validation & discount applied to cart with confirmation.",
      },
      {
        qAr: "هل المتجر آمن وسريع على الموبايل؟",
        qEn: "Is it fast & safe on mobile?",
        aAr: "نعم — Next.js مع 90+ Lighthouse، دفع عند الاستلام + تحويل، وصور WebP محسّنة.",
        aEn: "Yes — Next.js 90+ Lighthouse, cash-on-delivery + transfer, optimized WebP images.",
      },
    ],
  },
  furniture: {
    id: "furniture",
    labelAr: "مفروشات ومراتب",
    labelEn: "Furniture & Bedding",
    titleAr: "تصميم مواقع مفروشات ومراتب في طرابلس — كتالوج فاخر",
    titleEn: "Furniture & Mattress Website Design in Tripoli — Luxury Catalog",
    descriptionAr:
      "مواقع معارض مفروشات ومراتب فاخرة في طرابلس: كتالوج تفاعلي، اختيار خامات وأخشاب، طلب تسعير، وحجز زيارة خاصة — معارض فلل وقصور.",
    descriptionEn:
      "Luxury furniture & mattress showrooms in Tripoli: interactive catalog, wood/material selector, quote builder & private visit booking — villa projects.",
    h1Ar: "مواقع مفروشات ومراتب فاخرة في طرابلس",
    h1En: "Luxury Furniture & Mattress Sites in Tripoli",
    heroSubtitleAr:
      "أثاث حسب الطلب، مراتب طبية وفندقية، وأسرة بمقاسات خاصة — معرض صور حقيقي ومدونة تثبت خبرتكم في قصور وفلل طرابلس.",
    heroSubtitleEn:
      "Bespoke furniture, orthopedic & hotel mattresses & custom beds — real showroom gallery & blog proving villa expertise in Tripoli.",
    keywordsAr: ["تصميم موقع مفروشات طرابلس", "متجر مراتب ليبيا"],
    keywordsEn: ["furniture website Tripoli", "mattress store Libya"],
    faqsAr: [
      {
        qAr: "هل يمكن للعميل اختيار الخشب والقماش أونلاين؟",
        qEn: "Can clients pick wood & fabric online?",
        aAr: "نعم — منتقي خامات تفاعلي مع صور مقربة وأسعار تتحدث حسب الاختيار.",
        aEn: "Yes — interactive material selector with close-up photos & live pricing.",
      },
      {
        qAr: "كيف نستقبل طلبات التسعير؟",
        qEn: "How are quotes handled?",
        aAr: "سلة تسعير تجمع المقاسات والخامات وترسل طلباً مفصلاً عبر واتساب مع حجز زيارة.",
        aEn: "Quote cart collects dimensions & materials & sends detailed request via WhatsApp with visit booking.",
      },
      {
        qAr: "هل نشمل ضمان الوكيل المعتمد؟",
        qEn: "Is authorized dealer warranty shown?",
        aAr: "نعم — شارة ضمان، شهادات، ومعرض مشاريع فلل يزيد الثقة فوراً.",
        aEn: "Yes — warranty badge, certificates & villa portfolio boosting instant trust.",
      },
    ],
  },
  toys: {
    id: "toys",
    labelAr: "ألعاب أطفال",
    labelEn: "Kids & Toys",
    titleAr: "تصميم متاجر ألعاب أطفال في طرابلس — دفع عند الاستلام",
    titleEn: "Kids & Toys Store Design in Tripoli — Cash on Delivery",
    descriptionAr:
      "متاجر ألعاب أطفال في طرابلس: ليغو، باربي، سكوترات، دراجات وألعاب ذكاء — سلة ودفع عند الاستلام وفروع تفاعلية.",
    descriptionEn:
      "Toy stores in Tripoli: LEGO, Barbie, scooters, bikes & educational games — cart, cash on delivery & branch locator.",
    h1Ar: "متاجر ألعاب أطفال في طرابلس",
    h1En: "Kids & Toys Mega-Stores in Tripoli",
    heroSubtitleAr:
      "تشكيلات ليغو وباربي، سكوترات كهربائية ودراجات — فروع طرابلس على الخريطة وطلب واتساب سريع يطمئن الأهالي.",
    heroSubtitleEn:
      "LEGO & Barbie collections, electric scooters & bikes — Tripoli branches on map & fast WhatsApp checkout reassuring parents.",
    keywordsAr: ["تصميم متجر ألعاب طرابلس", "بيع ألعاب ليبيا"],
    keywordsEn: ["toy store Tripoli", "kids shop Libya"],
    faqsAr: [
      {
        qAr: "هل نعرض الفروع على الخريطة؟",
        qEn: "Are branches shown on map?",
        aAr: "نعم — خريطة فروع تفاعلية مع ساعات العمل وروابط واتساب مباشرة.",
        aEn: "Yes — interactive branch map with hours & direct WhatsApp links.",
      },
      {
        qAr: "هل الدفع عند الاستلام متاح؟",
        qEn: "Is cash on delivery available?",
        aAr: "نعم — سلة مع دفع عند الاستلام + تتبع الطلب برقم مرجعي.",
        aEn: "Yes — cart with cash on delivery & order tracking by reference.",
      },
    ],
  },
  appliances: {
    id: "appliances",
    labelAr: "أجهزة ومنزل",
    labelEn: "Home & Appliances",
    titleAr: "تصميم متاجر أجهزة منزلية في طرابلس — بضائع أوروبية",
    titleEn: "Home Appliance Store Design in Tripoli — European Goods",
    descriptionAr:
      "متاجر أجهزة منزلية وأثاث أوروبي في طرابلس: 8 أقسام، عروض بعدّاد تنازلي، سلة وطلب واتساب — توصيل 22 مدينة ليبية.",
    descriptionEn:
      "Home appliance & European furniture stores in Tripoli: 8 categories, countdown deals, cart & WhatsApp order — 22-city delivery.",
    h1Ar: "متاجر أجهزة منزلية وبضائع أوروبية في طرابلس",
    h1En: "Home Appliances & European Goods Stores in Tripoli",
    heroSubtitleAr:
      "أثاث منزلي، أجهزة كهربائية أصلية وعدة بريكولاج — عروض يومية بعدّاد وسلة واتساب تسرّع القرار.",
    heroSubtitleEn:
      "Furniture, genuine appliances & DIY tools — daily countdown deals & WhatsApp cart speeding decisions.",
    keywordsAr: ["تصميم متجر أجهزة طرابلس", "بضائع أوروبية ليبيا"],
    keywordsEn: ["appliance store Tripoli", "European home goods Libya"],
    faqsAr: [
      {
        qAr: "هل نعرض عروض بعدّاد تنازلي؟",
        qEn: "Countdown deals?",
        aAr: "نعم — عروض يومية بعدّاد وسعر قبل/بعد يزيد الإلحاح بشكل شرعي.",
        aEn: "Yes — daily countdown offers with before/after pricing driving urgency.",
      },
      {
        qAr: "هل التوصيل يشمل مدن ليبيا الأخرى؟",
        qEn: "Delivery beyond Tripoli?",
        aAr: "نعم — 22 مدينة مع تكلفة ومدة واضحة قبل تأكيد الطلب.",
        aEn: "Yes — 22 cities with clear cost & ETA before checkout.",
      },
    ],
  },
  electronics: {
    id: "electronics",
    labelAr: "هواتف ذكية وإلكترونيات",
    labelEn: "Smartphones & Electronics",
    titleAr: "تصميم متاجر هواتف وإلكترونيات في طرابلس — كتالوج وسلة",
    titleEn: "Smartphone & Electronics Store in Tripoli — Catalog & Cart",
    descriptionAr:
      "متاجر هواتف ذكية في طرابلس: كتالوج بالعلامات، سلة ودفع عبر واتساب، تتبع الطلب برقم مرجعي وتوصيل لكل ليبيا — ماي فون نموذجاً.",
    descriptionEn:
      "Smartphone stores in Tripoli: branded catalog, cart & WhatsApp checkout, order tracking & Libya-wide delivery — MyPhone showcase.",
    h1Ar: "متاجر هواتف ذكية وإلكترونيات في طرابلس",
    h1En: "Smartphone & Electronics Stores in Tripoli",
    heroSubtitleAr:
      "هواتف، أجهزة لوحية وسماعات بكتالوج علامات — سلة واتساب ذكية وتتبع برقم مرجعي يطمئن الزبون حتى الاستلام.",
    heroSubtitleEn:
      "Phones, tablets & audio with branded catalog — smart WhatsApp cart & reference tracking reassuring until delivery.",
    keywordsAr: ["تصميم متجر هواتف طرابلس", "بيع إلكترونيات ليبيا"],
    keywordsEn: ["phone store Tripoli", "electronics e-commerce Libya"],
    faqsAr: [
      {
        qAr: "هل العملاء يتتبعون طلبهم؟",
        qEn: "Can customers track orders?",
        aAr: "نعم — رقم مرجعي فوري مع حالات: قيد التجهيز، شُحن، تم التوصيل.",
        aEn: "Yes — instant reference with statuses: preparing, shipped, delivered.",
      },
      {
        qAr: "هل ندعم الدفع عبر واتساب؟",
        qEn: "WhatsApp checkout?",
        aAr: "نعم — السلة ترسل تفاصيل الطلب والعنوان إلى واتساب مع زر دفع مختصر.",
        aEn: "Yes — cart sends order & address to WhatsApp with short pay link.",
      },
    ],
  },
  hardware: {
    id: "hardware",
    labelAr: "مواد بناء وعدد",
    labelEn: "Tools & Construction",
    titleAr: "تصميم متاجر عدد ومواد بناء في طرابلس — تسعير مقاولين",
    titleEn: "Hardware & Construction Store in Tripoli — Contractor Quotes",
    descriptionAr:
      "متاجر عدد كهربائية ويدوية ومواد بناء ودهانات في طرابلس — سلة وعروض أسعار للمقاولين والورشات، 8 أقسام متخصصة.",
    descriptionEn:
      "Power tools, building materials, paints & safety gear in Tripoli — cart & B2B contractor quotes, 8 pro categories.",
    h1Ar: "متاجر عدد ومواد بناء في طرابلس",
    h1En: "Hardware & Construction Stores in Tripoli",
    heroSubtitleAr:
      "عدد كهربائية ومواد بناء ودهانات ومعدات سلامة — عروض جملة للمقاولين وطلب فوري يختصر المفاوضات.",
    heroSubtitleEn:
      "Power tools, materials, paints & safety — wholesale contractor offers & instant ordering shortening negotiations.",
    keywordsAr: ["تصميم متجر مواد بناء طرابلس", "بيع عدد احترافية"],
    keywordsEn: ["hardware store Tripoli", "construction supply Libya"],
    faqsAr: [
      {
        qAr: "هل هناك تسعير خاص للمقاولين؟",
        qEn: "Contractor pricing?",
        aAr: "نعم — نموذج طلب عرض سعر يجمع الكميات ويرسل تسعيرة مخصصة عبر واتساب/إيميل.",
        aEn: "Yes — RFQ form collecting quantities & sending custom quote via WhatsApp/email.",
      },
      {
        qAr: "هل الكتالوج مقسم حسب الاستعمال؟",
        qEn: "Catalog by use?",
        aAr: "نعم — 8 أقسام (كهرباء، دهان، سباكة، سلامة…) مع فلترة فورية.",
        aEn: "Yes — 8 sections (electrical, paint, plumbing, safety…) with instant filtering.",
      },
    ],
  },
  stationery: {
    id: "stationery",
    labelAr: "قرطاسية وتقنية",
    labelEn: "Stationery & Tech",
    titleAr: "تصميم متاجر قرطاسية وتقنية في طرابلس — جملة وتجزئة",
    titleEn: "Stationery & Tech Store in Tripoli — Retail & Wholesale",
    descriptionAr:
      "متاجر قرطاسية وتقنية في طرابلس: كتالوج شامل، سلة، حاسبة جملة للمدارس والشركات، وتتبع طلبات — شركة المنهج نموذجاً.",
    descriptionEn:
      "Stationery & tech stores in Tripoli: full catalog, cart, wholesale calculator for schools & firms, order tracking — Al-Manhaj showcase.",
    h1Ar: "متاجر قرطاسية وتقنية وجملة في طرابلس",
    h1En: "Stationery, Tech & B2B Stores in Tripoli",
    heroSubtitleAr:
      "تجزئة وجملة B2B — حاسبة خصومات حسب الكمية وتتبع طلبات يطمئن المدارس والشركات.",
    heroSubtitleEn:
      "Retail & B2B wholesale — quantity discount calculator & tracking reassuring schools & companies.",
    keywordsAr: ["تصميم متجر قرطاسية طرابلس", "جملة تقنية ليبيا"],
    keywordsEn: ["stationery store Tripoli", "B2B tech Libya"],
    faqsAr: [
      {
        qAr: "كيف نحسب خصومات الجملة؟",
        qEn: "Wholesale discounts?",
        aAr: "حاسبة جملة تفاعلية تحسب الخصم حسب الكمية وتعرض الإجمالي فوراً.",
        aEn: "Interactive wholesale calculator applying quantity discounts & showing total instantly.",
      },
      {
        qAr: "هل ندعم طلبات المدارس الكبيرة؟",
        qEn: "Bulk school orders?",
        aAr: "نعم — تحميل قائمة أصناف كاملة وإرسال عرض سعر موحد عبر واتساب.",
        aEn: "Yes — bulk item list upload & single quote via WhatsApp.",
      },
    ],
  },
  sanitary: {
    id: "sanitary",
    labelAr: "أطقم صحية وصنابير",
    labelEn: "Sanitary & Brassware",
    titleAr: "تصميم مواقع أطقم صحية وصنابير في طرابلس — ضمان 5 سنوات",
    titleEn: "Sanitary & Brassware Website in Tripoli — 5-Year Warranty",
    descriptionAr:
      "مواقع أطقم صحية وصنابير نحاسية في طرابلس: كتالوج بفلترة فورية (حمام، مطبخ، صمامات)، مصنّع وموزّع مع ضمان 5 سنوات.",
    descriptionEn:
      "Sanitary fixtures & brass valves in Tripoli: instantly filtered catalog (bathroom, kitchen, valves), manufacturer & distributor with 5-year warranty.",
    h1Ar: "مواقع أطقم صحية وصنابير نحاسية في طرابلس",
    h1En: "Sanitary & Brassware Sites in Tripoli",
    heroSubtitleAr:
      "أطقم حمامات ومطابخ وصمامات نحاس — فلترة فورية، ضمان 5 سنوات، ونموذج تواصل ثنائي اللغة.",
    heroSubtitleEn:
      "Bathroom & kitchen fixtures & brass valves — instant filtering, 5-year warranty & bilingual contact.",
    keywordsAr: ["تصميم موقع أطقم صحية طرابلس", "صنابير نحاس ليبيا"],
    keywordsEn: ["sanitary website Tripoli", "brassware Libya"],
    faqsAr: [
      {
        qAr: "هل نعرض الفلترة حسب الاستخدام؟",
        qEn: "Filter by use?",
        aAr: "نعم — حمام، مطبخ، صمامات وخلاطات مع فلترة فورية بدون إعادة تحميل.",
        aEn: "Yes — bathroom, kitchen, valves & mixers with instant no-reload filtering.",
      },
      {
        qAr: "كيف نبرز الضمان؟",
        qEn: "Warranty highlight?",
        aAr: "شارة ضمان 5 سنوات على كل منتج مع شهادات الجودة وتحميل دليل التركيب.",
        aEn: "5-year badge on each product with certificates & install guide download.",
      },
    ],
  },
};

/** Liste triée des secteurs avec SEO (utile pour sitemap & llms.txt) */
export const sectorIds = Object.keys(sectorSeo);

/** Résout le secteur demandé ou retombe sur null (404). */
export function getSectorSeo(sectorId: string): SectorSeo | null {
  return sectorSeo[sectorId] ?? null;
}

/** Filtre les démos d'un secteur donné. */
export function getDemosForSector(demos: readonly Demo[], sectorId: string): Demo[] {
  return demos.filter((d) => d.sector === sectorId);
}

/**
 * Génère le schéma CollectionPage + FAQPage sectoriel.
 * Utilisé dans /sectors/[sector]/page.tsx
 */
export function sectorCollectionJsonLd(
  config: { url: string; name: string; nameAr: string },
  sector: SectorSeo,
  demosInSector: Demo[],
) {
  const base = config.url.replace(/\/+$/, "");
  const url = `${base}/sectors/${sector.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name: sector.titleAr,
    alternateName: sector.titleEn,
    description: sector.descriptionAr,
    url,
    inLanguage: ["en", "ar"],
    isPartOf: { "@id": `${base}/#website` },
    about: {
      "@type": "Thing",
      name: sector.labelAr,
      alternateName: sector.labelEn,
    },
    numberOfItems: demosInSector.length,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: demosInSector.length,
      itemListElement: demosInSector.map((d, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${base}/demos/${d.slug}`,
        name: d.title,
        image: d.image,
      })),
    },
  };
}

export function sectorFaqJsonLd(sector: SectorSeo) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "en",
    mainEntity: sector.faqsAr.map((f) => ({
      "@type": "Question",
      name: f.qAr,
      acceptedAnswer: { "@type": "Answer", text: f.aAr },
    })),
  };
}
