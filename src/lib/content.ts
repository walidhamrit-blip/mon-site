import type {
  HeroContent,
  HomeLayoutConfig,
  RibbonContent,
  SectionHeadings,
  ShowcasePageConfig,
  WhyUsItem,
  ProcessStep,
} from "./site-types";
import { BUILTIN_SECTION_IDS } from "./site-types";

export const demos = [
  {
    slug: "myphone-tripoli",
    sector: "electronics",
    sectorAr: "هواتف ذكية وإلكترونيات",
    sectorEn: "Smartphones & Electronics",
    title: "ماي فون — متجر الهواتف الذكية في طرابلس",
    titleEn: "MyPhone — Smartphone Store in Tripoli",
    description:
      "متجر إلكتروني متكامل للهواتف الذكية والأجهزة اللوحية والسماعات في طرابلس — كتالوج بالعلامات، سلة ودفع عبر واتساب، وتتبّع الطلب برقم مرجعي مع توصيل لكل ليبيا",
    descriptionEn:
      "Full smartphone, tablet & audio store in Tripoli — branded catalog, cart with WhatsApp checkout, order tracking by reference and delivery across Libya",
    image: "https://smartphine-demo.vercel.app/images/hero-phone.jpg",
    color: "#0EA5E9",
    features: ["هواتف ذكية وأجهزة لوحية", "تتبّع الطلب برقم مرجعي", "سلة + دفع عبر واتساب", "عربي + إنجليزي"],
    featuresEn: ["Phones, tablets & audio", "Order tracking by reference", "Cart & WhatsApp checkout", "Arabic + English"],
    previewUrl: "https://smartphine-demo.vercel.app/",
    planId: "boutique",
    categoryTier: 3,
  },
  {
    slug: "cabinet-sante-medecin",
    sector: "medical",
    sectorAr: "عيادات وخدمات صحية",
    sectorEn: "Clinics & Healthcare",
    title: "عيادة سانتي — طبيبك القريب منك",
    titleEn: "Cabinet Santé — Your Local Doctor",
    description:
      "موقع أنيق لعيادة طبية عامة — حجز موعد حسب نوع الاستشارة والتاريخ مع عرض أقرب موعد متاح، تعريف بالطبيب والخدمات، تقييم 4.9/5، وتواصل مباشر عبر واتساب",
    descriptionEn:
      "Elegant general practice site — appointment booking by consultation type & date with next availability shown, doctor & services showcase, 4.9/5 trust rating and direct WhatsApp contact",
    image: "https://demo-cabinet-medecin.vercel.app/images/doctor.jpg",
    color: "#059669",
    features: ["حجز مواعيد واختيار التاريخ", "تقييم 4.9/5 وشارة ثقة", "تواصل واتساب مباشر", "فرنسي + عربي + إنجليزي"],
    featuresEn: ["Appointment & Date Booking", "4.9/5 Trust Rating", "Direct WhatsApp Contact", "FR + AR + EN Trilingual"],
    previewUrl: "https://demo-cabinet-medecin.vercel.app/",
    planId: "vitrine-plus",
    categoryTier: 2,
  },
  {
    slug: "al-manhaj-company",
    sector: "stationery",
    sectorAr: "قرطاسية وتقنية وجملة",
    sectorEn: "Stationery, Tech & B2B",
    title: "شركة المنهج للقرطاسية والتقنية",
    titleEn: "Al-Manhaj Stationery & Tech",
    description:
      "متجر إلكتروني حقيقي للتجزئة والجملة في طرابلس — كتالوج شامل، سلة تسوق، حاسبة جملة للمدارس والشركات، وتتبع الطلبات",
    descriptionEn:
      "Live retail & B2B wholesale store in Tripoli — full catalog, cart, wholesale calculator & order tracking",
    image: "https://al-manhaj-company.vercel.app/images/new/landscape-01.jpg",
    color: "#C6A664",
    features: ["تجزئة وجملة B2B", "سلة وتتبع طلبات", "حاسبة خصومات الجملة", "عربي + إنجليزي"],
    featuresEn: ["Retail & B2B Store", "Cart & Order Tracking", "Wholesale Calculator", "Arabic + English"],
    previewUrl: "https://al-manhaj-company.vercel.app/",
    planId: "boutique",
    categoryTier: 3,
  },
  {
    slug: "tripo-teck-outillage",
    sector: "hardware",
    sectorAr: "مواد البناء والعدد",
    sectorEn: "Hardware & Construction",
    title: "تريبو-تيك — مواد البناء والعدد الاحترافية",
    titleEn: "TRIPO-TECK — Hardware & Construction",
    description:
      "متجر متكامل للعدد الكهربائية واليدوية ومواد البناء والدهانات ومعدات السلامة في طرابلس — سلة تسوق وعروض أسعار للمقاولين والورشات",
    descriptionEn:
      "Power tools, construction materials, paints & safety equipment store in Tripoli — online cart & B2B contractor quotes",
    image: "https://m-et-outillage-modele-3.vercel.app/images/hero1.jpg",
    color: "#D97706",
    features: ["عدد ومواد بناء", "سلة وطلب فوري", "عروض أسعار للمقاولين", "8 أقسام متخصصة"],
    featuresEn: ["Tools & Construction", "Instant Cart & Order", "Contractor B2B Quotes", "8 Pro Categories"],
    previewUrl: "https://m-et-outillage-modele-3.vercel.app/",
    planId: "boutique",
    categoryTier: 3,
  },
  {
    slug: "tulin-magazin",
    sector: "appliances",
    sectorAr: "أثاث وأجهزة أوروبية",
    sectorEn: "European Home & Appliances",
    title: "تولين — بضائع أوروبية لبيت ليبي",
    titleEn: "Tulin — European Home & Appliances",
    description:
      "معرض ومتجر إلكتروني للبضائع الأوروبية في طرابلس — أثاث منزلي، أجهزة كهربائية أصلية، وعدة بريكولاج مع سلة وطلب عبر واتساب",
    descriptionEn:
      "European furniture, home appliances & DIY store in Tripoli — 8 categories, countdown deals, cart & WhatsApp ordering",
    image: "https://images.pexels.com/photos/6585763/pexels-photo-6585763.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800",
    color: "#0F766E",
    features: ["8 أقسام منزلية", "عروض بعدّاد تنازلي", "سلة وطلب واتساب", "توصيل 22 مدينة"],
    featuresEn: ["8 Home Categories", "Countdown Deals", "Cart & WhatsApp Order", "22-City Delivery"],
    previewUrl: "https://tulin-magazin.vercel.app/",
    planId: "boutique",
    categoryTier: 3,
  },
  {
    slug: "pizzeria-forno-tripoli",
    sector: "restaurant",
    sectorAr: "مطاعم وبيتزا إيطالية",
    sectorEn: "Restaurants & Pizzeria",
    title: "بيتزا فورنو — مطعم إيطالي على الحطب",
    titleEn: "Pizza Forno — Wood-Fired Pizzeria",
    description:
      "موقع مطعم بيتزا إيطالي في حي الأندلس بطرابلس — قائمة تفاعلية، استوديو تخصيص البيتزا خطوة بخطوة، سلة طلبات وتوصيل سريع",
    descriptionEn:
      "Wood-fired Italian pizzeria in Tripoli — interactive menu, custom Pizza Studio builder, cart & fast delivery",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80",
    color: "#DC2626",
    features: ["استوديو تخصيص البيتزا", "قائمة تفاعلية بالفلترة", "باقات عائلية وعروض", "طلب وتوصيل فوري"],
    featuresEn: ["Custom Pizza Studio", "Interactive Menu", "Family Packs & Deals", "Instant Delivery Order"],
    previewUrl: "https://pizzeria-demo1.vercel.app/",
    planId: "boutique",
    categoryTier: 3,
  },
  {
    slug: "maison-tripoli-meubles",
    sector: "furniture",
    sectorAr: "مفروشات وتصميم داخلي",
    sectorEn: "Luxury Furniture & Interiors",
    title: "ميزون طرابلس — مفروشات فاخرة وتصميم داخلي",
    titleEn: "Maison Tripoli — Luxury Furniture & Interiors",
    description:
      "معرض مفروشات فاخرة وتصميم داخلي حسب الطلب — كتالوج تفاعلي، اختيار الخامات والأخشاب، طلب تسعير وحجز زيارة خاصة للمعرض",
    descriptionEn:
      "Bespoke luxury furniture & interior architecture showroom — interactive wood/stone selector, custom quote cart & private showroom booking",
    image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=90",
    color: "#8B5A2B",
    features: ["تخصيص الأخشاب والرخام", "طلب تسعير ومقاسات خاصة", "حجز زيارة خاصة للمعرض", "معرض أعمال القصور والفلل"],
    featuresEn: ["Material & Wood Selector", "Custom Quote Builder", "Private Showroom Booking", "Luxury Villa Portfolio"],
    previewUrl: "https://demo-meubles.vercel.app/",
    planId: "vitrine-plus",
    categoryTier: 2,
  },
  {
    slug: "hala-perfumes",
    sector: "beauty",
    sectorAr: "عطور وتجميل فاخر",
    sectorEn: "Perfumes & Beauty",
    title: "حلا للعطور والتجميل الفاخر",
    titleEn: "HALA Perfumes & Luxury Beauty",
    description:
      "متجر عطور ومستحضرات تجميل وعناية بالبشرة — باقات «3 بسعر واحد»، أكواد خصم داخل المتجر، مجموعات هدايا، وتجربة ثنائية اللغة",
    descriptionEn:
      "Luxury fragrances, cosmetics & skincare e-commerce — Mix & Match bundles, promo codes, gift sets & bilingual AR/EN experience",
    image: "https://hala-dun.vercel.app/images/hero-perfume.jpg",
    color: "#9D174D",
    features: ["عروض Mix & Match", "عطور ومكياج وعناية", "أكواد خصم وسلة ذكية", "عربي + إنجليزي"],
    featuresEn: ["Mix & Match Bundles", "Perfumes & Beauty", "Promo Codes & Smart Cart", "Arabic + English"],
    previewUrl: "https://hala-dun.vercel.app/",
    planId: "boutique",
    categoryTier: 3,
  },
  {
    slug: "al-massa-mattresses",
    sector: "furniture",
    sectorAr: "مراتب ومفروشات فاخرة",
    sectorEn: "Mattresses & Bedding",
    title: "الماسة الزرقاء — للمراتب والمفروشات الفاخرة",
    titleEn: "Al-Massa Blue Diamond — Luxury Mattresses",
    description:
      "معرض الماسة الزرقاء في طرابلس (الوكيل المعتمد لشركة الفراشة) — مراتب طبية وفندقية، أسرّة حسب المقاس، وأطقم مفروشات فندقية مع طلب مباشر عبر واتساب",
    descriptionEn:
      "Blue Diamond showroom in Tripoli (Al-Farasha authorized dealer) — orthopedic & hotel mattresses, custom velvet beds & WhatsApp cart ordering",
    image: "https://al-massa.vercel.app/images/product-diamond-mattress.jpg",
    color: "#1E3A8A",
    features: ["مراتب طبية وأسرّة حسب المقاس", "سلة مرتبطة بواتساب", "معرض صور حقيقي ومدونة", "ضمان الوكيل المعتمد"],
    featuresEn: ["Custom Beds & Mattresses", "WhatsApp Smart Cart", "Real Showroom & Blog", "Authorized Dealer Warranty"],
    previewUrl: "https://al-massa.vercel.app/",
    planId: "boutique",
    categoryTier: 3,
  },
  {
    slug: "toy-store-tripoly",
    sector: "toys",
    sectorAr: "ألعاب وهدايا أطفال",
    sectorEn: "Kids & Toys Store",
    title: "توي ستور طرابلس — عالم ألعاب الأطفال",
    titleEn: "Toy Store Tripoly — Kids & Toys Mega-Store",
    description:
      "متجر ألعاب أطفال متكامل في طرابلس — تشكيلات ليغو، دمى باربي، سكوترات ودراجات وألعاب ذكاء مع الدفع عند الاستلام وفروع متعددة",
    descriptionEn:
      "Mega toy store in Tripoli — LEGO, Barbie, electric scooters, bikes & educational games with Cash-on-Delivery and multi-branch locator",
    image: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?q=80&w=1200&auto=format&fit=crop",
    color: "#E11D48",
    features: ["ليغو وباربي وسكوترات", "سلة ودفع عند الاستلام", "فروع طرابلس التفاعلية", "عربي + إنجليزي"],
    featuresEn: ["LEGO, Barbie & Scooters", "Cart & Cash on Delivery", "Tripoli Branch Locator", "Arabic + English"],
    previewUrl: "https://demo-jouets.vercel.app/",
    planId: "boutique",
    categoryTier: 3,
  },
  {
    slug: "al-bay-family-restaurant",
    sector: "restaurant",
    sectorAr: "مطاعم وطبخ ليبية",
    sectorEn: "Restaurants & Libyan Cuisine",
    title: "مطعم العيلة — مطبخ طرابلس الأصيل",
    titleEn: "Al-Bay — Family Restaurant, Tripoli",
    description:
      "مطعم عائلي في قلب طرابلس — قائمة ليبية أصيلة (كسكس، بازين، مشاوي، رشتة، مبخبقة) بأسعار واضحة، سلة طلب، وقائمة رقمية للتصفح والمشاركة",
    descriptionEn:
      "Family restaurant in the heart of Tripoli — authentic Libyan menu (couscous, bazin, grills, rishta, mbakbaka) with clear prices, a basket and a shareable digital menu",
    image: "https://al-bay.vercel.app/assets/family-table.jpg",
    color: "#C2410C",
    features: ["قائمة ليبية أصيلة", "سلة طلب + واتساب", "قائمة رقمية للمشاركة", "هوية دافئة بلمسة عصرية"],
    featuresEn: ["Authentic Libyan menu", "Basket & WhatsApp", "Shareable digital menu", "Warm modern identity"],
    previewUrl: "https://al-bay.vercel.app/",
    planId: "vitrine-plus",
    categoryTier: 2,
  },
  {
    slug: "alssadaka-sanitary",
    sector: "sanitary",
    sectorAr: "أطقم صحية وصنابير نحاس",
    sectorEn: "Sanitary & Brassware",
    title: "الصداقة — أطقم صحية ونحاس فاخر",
    titleEn: "Alssadaka — Premium Sanitary & Brassware",
    description:
      "مصنّع وموزّع أطقم صحية وصنابير نحاسية — كتالوج منتجات مع فلترة فورية (حمام، مطبخ، صمامات)، ضمان 5 سنوات، ونموذج تواصل ثنائي اللغة",
    descriptionEn:
      "Manufacturer & distributor of sanitary fixtures, brass valves and premium mixers — instantly filtered catalog (bathroom, kitchen, valves), 5-year warranty and a bilingual contact form",
    image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
    color: "#0F766E",
    features: ["كتالوج مع فلترة فورية", "أطقم + صنابير + صمامات", "ضمان 5 سنوات", "عربي + إنجليزي"],
    featuresEn: ["Instantly filtered catalog", "Fixtures, mixers & valves", "5-year warranty", "Arabic + English"],
    previewUrl: "https://alssadaka-sanitary.vercel.app/",
    planId: "vitrine",
    categoryTier: 1,
  },
] as const;

export const sectors = [
  { id: "all", labelAr: "الكل", labelEn: "All" },
  { id: "medical", labelAr: "عيادات وصحة", labelEn: "Clinics & Health" },
  { id: "restaurant", labelAr: "مطاعم", labelEn: "Restaurants" },
  { id: "beauty", labelAr: "عطور وتجميل", labelEn: "Perfumes & Beauty" },
  { id: "furniture", labelAr: "مفروشات ومراتب", labelEn: "Furniture & Bedding" },
  { id: "toys", labelAr: "ألعاب أطفال", labelEn: "Kids & Toys" },
  { id: "appliances", labelAr: "أجهزة ومنزل", labelEn: "Home & Appliances" },
  { id: "electronics", labelAr: "هواتف ذكية وإلكترونيات", labelEn: "Smartphones & Electronics" },
  { id: "hardware", labelAr: "مواد بناء وعدد", labelEn: "Tools & Construction" },
  { id: "stationery", labelAr: "قرطاسية وتقنية", labelEn: "Stationery & Tech" },
  { id: "sanitary", labelAr: "أطقم صحية وصنابير", labelEn: "Sanitary & Brassware" },
] as const;

export const whyUs = [
  {
    icon: "zap",
    titleAr: "سرعة تذهل",
    titleEn: "Blazing Fast",
    descAr: "موقعك جاهز في 7 أيام. نستخدم Next.js الأسرع في السوق — نقاط Lighthouse فوق 90 حتى على 3G.",
    descEn: "Your site ready in 7 days. Built with Next.js — 90+ Lighthouse even on 3G.",
  },
  {
    icon: "palette",
    titleAr: "تصميم نخبوي",
    titleEn: "Elite Design",
    descAr: "لسنا قوالب جاهزة. كل بيكسل مصمم على هويتك — فاخر، نظيف، ويترك أثراً.",
    descEn: "No templates. Every pixel crafted on your brand — luxurious, clean, memorable.",
  },
  {
    icon: "sliders",
    titleAr: "تخصيص كامل",
    titleEn: "Fully Bespoke",
    descAr: "ألوانك، خطوطك، أقسامك. غيّر كل شيء في دقائق — نحن نبرمج رؤيتك كما هي.",
    descEn: "Your colors, fonts, sections. Change everything in minutes — we code your vision.",
  },
  {
    icon: "search",
    titleAr: "ظهور في جوجل",
    titleEn: "Google Ready",
    descAr: "هيكلة SEO احترافية، خرائط، بيانات منظمة — عملاؤك يجدونك قبل منافسيك.",
    descEn: "Pro SEO structure, maps, structured data — clients find you before competitors.",
  },
  {
    icon: "headset",
    titleAr: "دعم حقيقي",
    titleEn: "Real Support",
    descAr: "واتساب مباشر، تدريب، وتحديثات. لسنا شركة تختفي بعد التسليم.",
    descEn: "Direct WhatsApp, training & updates. We don’t disappear after delivery.",
  },
] as const;

export const processSteps = [
  {
    num: "01",
    titleAr: "جلسة الاكتشاف",
    titleEn: "Discovery Call",
    descAr: "30 دقيقة نفهم نشاطك، جمهورك، وأهدافك. نخرج بخارطة طريق واضحة.",
    descEn: "30 min to understand your business, audience & goals. Clear roadmap out.",
    durationAr: "يوم واحد",
    durationEn: "1 day",
  },
  {
    num: "02",
    titleAr: "التصميم الحي",
    titleEn: "Live Design",
    descAr: "نصمم صفحتك الرئيسية أمامك — ترى وتعلّق فوراً. لا مفاجآت.",
    descEn: "We design your homepage live — you see & comment instantly. No surprises.",
    durationAr: "2-3 أيام",
    durationEn: "2-3 days",
  },
  {
    num: "03",
    titleAr: "التطوير السريع",
    titleEn: "Rapid Build",
    descAr: "نحوّل التصميم إلى موقع سريع، متجاوب، ومحسّن. تحديث يومي على واتساب.",
    descEn: "Design to fast, responsive, optimized site. Daily WhatsApp updates.",
    durationAr: "3-5 أيام",
    durationEn: "3-5 days",
  },
  {
    num: "04",
    titleAr: "المراجعة الدقيقة",
    titleEn: "Refinement",
    descAr: "جولتان من التعديلات مشمولة. نضبط حتى ترضى 100%.",
    descEn: "Two revision rounds included. We tweak until 100% satisfied.",
    durationAr: "1-2 أيام",
    durationEn: "1-2 days",
  },
  {
    num: "05",
    titleAr: "الإطلاق والتدريب",
    titleEn: "Launch & Train",
    descAr: "نرفع موقعك، نربط الدومين، وندرّبك على إدارة المحتوى بنفسك.",
    descEn: "We deploy, connect domain & train you to manage content yourself.",
    durationAr: "يوم واحد",
    durationEn: "1 day",
  },
] as const;

export const testimonials = [
  {
    name: "أحمد الطرابلسي",
    nameEn: "Ahmed Trabelsi",
    role: "صاحب مطعم السرايا",
    roleEn: "Owner, Saraya Restaurant",
    text: "طلبات الواتساب زادت 3 أضعاف في أول شهر. التصميم يجعل الزبون يثق فوراً. فريق نخبة محترف بمعنى الكلمة.",
    textEn: "WhatsApp orders tripled in first month. Design builds instant trust. Nukhba team is truly pro.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80&auto=format&fit=crop&crop=face",
    rating: 5,
    beforeAfter: { before: "صفحة فيسبوك فقط", after: "موقع + حجوزات + طلبات" },
    beforeAfterEn: { before: "Facebook only", after: "Site + bookings + orders" },
  },
  {
    name: "د. سارة المنصوري",
    nameEn: "Dr. Sara Mansouri",
    text: "عيادتي الآن تحجز مواعيد حتى وأنا نائمة. واجهة راقية وسهلة لكبار السن أيضاً. أنصح بهم بشدة.",
    textEn: "My clinic now books even while I sleep. Elegant & easy even for elderly. Highly recommend.",
    role: "عيادة النور للأسنان",
    roleEn: "Noor Dental Clinic",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80&auto=format&fit=crop&crop=face",
    rating: 5,
    beforeAfter: { before: "حجوزات هاتفية", after: "حجز ذاتي 24/7" },
    beforeAfterEn: { before: "Phone bookings", after: "Self-booking 24/7" },
  },
  {
    name: "محمد الزنتاني",
    nameEn: "Mohamed Zentani",
    role: "دار العقار — طرابلس",
    roleEn: "Dar Real Estate — Tripoli",
    text: "كنت أدفع إعلانات كثيرة بلا فائدة. الآن العملاء يأتون من جوجل مباشرة. استثمار رجع أضعافه.",
    textEn: "I wasted on ads with no return. Now clients come from Google directly. Investment paid manifold.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80&auto=format&fit=crop&crop=face",
    rating: 5,
    beforeAfter: { before: "إعلانات مدفوعة", after: "ظهور طبيعي في جوجل" },
    beforeAfterEn: { before: "Paid ads", after: "Organic Google ranking" },
  },
] as const;

export const faqs = [
  {
    qAr: "كم يستغرق إنجاز موقعي؟",
    qEn: "How long to build my site?",
    aAr: "من 7 إلى 21 يوماً حسب الباقة. الواجهة البسيطة 7 أيام، المتجر حتى 21 يوماً. نلتزم بجدول واضح وترى التقدم يومياً على واتساب.",
    aEn: "7 to 21 days by plan. Simple Vitrine 7 days, Shop up to 21. Clear timeline with daily WhatsApp updates.",
  },
  {
    qAr: "هل السعر يشمل الاستضافة والدومين؟",
    qEn: "Does price include hosting & domain?",
    aAr: "السعر يشمل سنة استضافة فائقة السرعة (Vercel) + ربط الدومين. الدومين نفسه (~12 $/سنة) تشتريه باسمك ونحن نربطه مجاناً.",
    aEn: "Includes 1 year ultra-fast hosting (Vercel) + domain connect. Domain itself (~$12/year) you own, we connect free.",
  },
  {
    qAr: "هل أستطيع تعديل المحتوى بنفسي؟",
    qEn: "Can I edit content myself?",
    aAr: "نعم 100%. ندربك على لوحة سهلة لتغيير النصوص، الصور، الأسعار، وإضافة منتجات/مقالات بدون مبرمج.",
    aEn: "Yes 100%. We train you on easy dashboard to change texts, images, prices & add products/posts without dev.",
  },
  {
    qAr: "ماذا عن الدفع؟ تقسيط؟",
    qEn: "Payment? Installments?",
    aAr: "يمكنك أولاً حجز مكانك بعربون 1 $ (يُخصم من سعر المشروع). ثم تدفع الإجمالي بالدولار عبر العملات الرقمية — نفس المبلغ بـ USDT (1 دولار = 1 USDT) — دفعة واحدة أو على 2–3 أقساط عبر NOWPayments.",
    aEn: "You can first reserve your slot with a $1 deposit (deducted from the project price). Then pay the USD total in crypto — the same amount in USDT (1 USD = 1 USDT) — in one payment or 2–3 installments via NOWPayments.",
  },
  {
    qAr: "ماذا لو لم يعجبني التصميم؟",
    qEn: "What if I don't like design?",
    aAr: "نصمم أمامك مباشرة من اليوم الثاني — تعلّق وتعدّل فوراً. مع جولتين مراجعة مشمولة، الرضا مضمون.",
    aEn: "We design live from day 2 — you comment instantly. With 2 revision rounds, satisfaction guaranteed.",
  },
  {
    qAr: "هل الموقع يظهر في جوجل؟",
    qEn: "Will site show on Google?",
    aAr: "نعم. نبني هيكلة SEO احترافية: عناوين، خرائط، بيانات منظمة، وسرعة 90+. موقعك جاهز ليتصدر نتائج سوقك أينما كنت.",
    aEn: "Yes. Pro SEO structure: titles, sitemaps, structured data & 90+ speed. Ready to rank in your market, anywhere in the world.",
  },
  {
    qAr: "ماذا بعد التسليم؟ صيانة؟",
    qEn: "After delivery? Maintenance?",
    aAr: "دعم مجاني 30-90 يوم حسب الباقة. بعدها صيانة اختيارية 19 $/شهر تشمل تحديثات، نسخ احتياطي، وحماية.",
    aEn: "Free 30-90 days support by plan. Then optional $19/mo for updates, backups & security.",
  },
] as const;

/* ---------- Sections éditables de la page d'accueil ---------- */

/** Textes par défaut du Hero (modifiables dans /admin → Contenu → Accueil). */
export const heroContent: HeroContent = {
  badgeAr: "✦ وكالة مواقع فاخرة — عملاء من كل العالم",
  badgeEn: "✦ Premium Web Agency — Clients Worldwide",
  title1Ar: "موقعك الاحترافي",
  title1En: "Your pro website",
  title2Ar: "جاهز في أيام",
  title2En: "ready in days",
  title3Ar: "وليس شهور",
  title3En: "not months",
  subtitleAr:
    "نحوّل فكرتك إلى موقع فاخر، سريع، ويبيع — مصمم على هويتك، محسّن لجوجل، وجاهز ليستقبل عملاءك من أول يوم.",
  subtitleEn:
    "We turn your idea into a luxurious, fast, selling machine — crafted on your brand, optimized for Google, ready from day one.",
  ctaPrimaryAr: "اطلب عرض سعر مجاني",
  ctaPrimaryEn: "Get free quote",
  ctaSecondaryAr: "شاهد المعارض الحية",
  ctaSecondaryEn: "View live demos",
  trustedAr: "يثق بنا 120+ نشاط حول العالم",
  trustedEn: "Trusted by 120+ businesses worldwide",
  ratingAr: "تقييم 4.9/5",
  ratingEn: "4.9/5 rating",
  chipsAr: ["✓ تسليم 7 أيام", "✓ بدون دفعة كبيرة", "✓ دعم واتساب"],
  chipsEn: ["✓ 7-day delivery", "✓ No big upfront", "✓ WhatsApp support"],
};

/** Bandeau défilant « services / points forts » (modifiable dans l'admin). */
export const servicesRibbonContent: RibbonContent = {
  taglineAr: "كل ما يحتاجه نشاطك لينمو",
  taglineEn: "Everything your business needs to grow",
  items: [
    { ar: "تصميم مواقع حسب الطلب", en: "Bespoke web design" },
    { ar: "متاجر إلكترونية", en: "E-commerce" },
    { ar: "تصميم متجاوب", en: "Mobile-first design" },
    { ar: "تحسين محركات البحث", en: "Search engine optimization" },
    { ar: "عربي + إنجليزي", en: "Arabic + English" },
    { ar: "طلبات عبر واتساب", en: "WhatsApp ordering" },
    { ar: "سرعة وأداء", en: "Speed & performance" },
    { ar: "دعم وتدريب", en: "Support & training" },
  ],
};

/** Cartes « Pourquoi nous ? ». */
export const defaultWhyUs: WhyUsItem[] = whyUs.map((item) => ({ ...item }));

/** Étapes du processus. */
export const defaultProcess: ProcessStep[] = processSteps.map((step) => ({ ...step }));

/** Titres / sous-titres par défaut des sections du site. */
export const defaultSectionHeadings: SectionHeadings = {
  why: {
    titleAr: "لماذا نخبة؟",
    titleEn: "Why Nukhba?",
    subtitleAr: "لسنا مجرد مصممين — نحن شريك نموك الرقمي",
    subtitleEn: "Not just designers — your digital growth partner",
  },
  demos: {
    titleAr: "معارض تنطق بالفخامة",
    titleEn: "Showcases that speak luxury",
    subtitleAr:
      "تصفّح مواقع عملائنا الحقيقية مباشرةً أو افتحها بملء الشاشة مع إمكانية التبديل بين عرض الحاسوب والهاتف",
    subtitleEn:
      "Browse our real client websites live or open them in fullscreen with Desktop and Mobile view options",
  },
  identityCustomizer: {
    titleAr: "جرّب قوة التخصيص",
    titleEn: "Feel the customization",
    subtitleAr:
      "غيّر الألوان والخطوط وشاهد موقع الماسة الزرقاء يتشكل أمامك — هذه هي المرونة التي ستحصل عليها",
    subtitleEn:
      "Change colors & fonts live on Al-Massa Blue Diamond — this is the flexibility you'll get",
  },
  identityThemes: {
    titleAr: "ثيمات جاهزة… اختر هوية موقعك",
    titleEn: "Ready-made themes… pick your identity",
    subtitleAr:
      "6 ثيمات — أكثر لوحات الألوان تقديراً في مجال الوكالات ومواقع الشركات، مرتبة حسب الطلب. كل ثيم يعمل بنسخة فاتحة وأخرى داكنة، والتبديل بينهما يتم بزر مستقل تماماً عن اختيار الثيم.",
    subtitleEn:
      "6 themes — the most appreciated palettes in the agency & corporate web field, ranked by demand. Each one runs in a light and a dark version, switched by a button of its own.",
  },
  process: {
    titleAr: "من الفكرة إلى الإطلاق",
    titleEn: "From idea to launch",
    subtitleAr: "5 خطوات واضحة — تعرف أين نحن كل يوم",
    subtitleEn: "5 clear steps — you know where we are every day",
    noteAr: "إجمالي المدة: 7-14 يوم",
    noteEn: "Total: 7-14 days",
  },
  pricing: {
    titleAr: "استثمار يعود أضعافاً",
    titleEn: "Investment that pays back",
    subtitleAr: "أسعار واضحة بالدولار، بلا مفاجآت — وكل دولار محسوب ليجلب عملاء",
    subtitleEn: "Clear pricing, no surprises — every dinar calculated to bring clients",
    noteAr: "دفع مرة واحدة + استضافة سنة مجاناً",
    noteEn: "One-time + 1 year hosting free",
  },
  flexPay: {
    titleAr: "ادفع ما تشاء — 1 دولار أو أكثر",
    titleEn: "Pay what you want — $1 or more",
    subtitleAr:
      "حدّد المبلغ بنفسك — مفتوح من 1 دولار. مفيد خصوصاً عندما تفرض منصات العملات الرقمية حدوداً دنيا على المبلغ.",
    subtitleEn:
      "Set your own amount — open from $1 up. Especially handy when crypto platforms enforce minimum payment limits.",
  },
  services: {
    titleAr: "خدماتنا المفتوحة — اختر ما تحتاجه فقط",
    titleEn: "Open-serve services — pick only what you need",
    subtitleAr:
      "مهام صغيرة بأسعار واضحة — إعادة تصميم موقع قديم، إضافة قسم، بناء شرائح وعروض تقديمية، تصميم وهوية والمزيد.",
    subtitleEn:
      "Small tasks, clear prices — restyle an old site, add a section, build slides & decks, branding & design and more.",
  },
  testimonials: {
    titleAr: "قصص نجاح عملائنا",
    titleEn: "Client success stories",
    subtitleAr: "قبل وبعد — كيف غيّر الموقع أعمالهم",
    subtitleEn: "Before & after — how the site transformed them",
  },
  faq: {
    titleAr: "أسئلة تهمك",
    titleEn: "Good to know",
    subtitleAr: "كل ما تريد معرفته قبل أن نبدأ",
    subtitleEn: "Everything before we start",
  },
  cta: {
    titleAr: "جاهز لتنطلق؟",
    titleEn: "Ready to launch?",
    subtitleAr: "احجز استشارتك المجانية اليوم — نرد في أقل من ساعتين",
    subtitleEn: "Book your free consult today — we reply within 2 hours",
    noteAr: "✓ رد خلال ساعتين  ✓ بدون التزام  ✓ استشارة مجانية",
    noteEn: "✓ Reply in 2h  ✓ No commitment  ✓ Free consult",
  },
};

/** Ordre et état par défaut des sections de la page d'accueil. */
export const defaultHomeLayout: HomeLayoutConfig = {
  entries: BUILTIN_SECTION_IDS.map((builtinId) => ({
    key: builtinId,
    kind: "builtin" as const,
    builtinId,
    enabled: true,
  })),
  customSections: [],
};

/** Page « Nos applications » (en cours de préparation / prochainement). */
export const defaultAppsPage: ShowcasePageConfig = {
  statusBadgeAr: "قيد التحضير • قريباً",
  statusBadgeEn: "In Preparation • Coming Soon",
  titleAr: "تطبيقاتنا الذكية",
  titleEn: "Our Smart Applications",
  highlightAr: "قيد التحضير للإطلاق القريب",
  highlightEn: "Currently in final preparation",
  subtitleAr:
    "نطوّر الجيل القادم من تطبيقات الجوال والويب للشركات والعيادات والمتاجر حول العالم — تجربة سريعة، إشعارات فورية، وربط مباشر بواتساب ونظام الإدارة.",
  subtitleEn:
    "We are crafting our flagship line of iOS, Android & Web applications for clinics, stores and restaurants worldwide — fast native feel, instant alerts and seamless WhatsApp sync.",
  bannerNoteAr:
    "هذه التطبيقات قيد التحضير حالياً — سجّل اهتمامك لتكون أول من يجرّب النسخة التجريبية أو اطلب تطبيقاً مخصّصاً لهويتك.",
  bannerNoteEn:
    "These applications are currently in preparation — join the priority list for early access or request your custom branded app today.",
  ctaLabelAr: "أعلمني فور الإطلاق",
  ctaLabelEn: "Notify me at launch",
  items: [
    {
      id: "app-clinic-mobile",
      slug: "nukhba-clinic-app",
      status: "in_preparation",
      badgeAr: "قيد التحضير",
      badgeEn: "In Preparation",
      categoryAr: "صحة وعيادات",
      categoryEn: "Clinics & Health",
      titleAr: "نخبة كلينك — تطبيق حجز المواعيد والعيادات",
      titleEn: "Nukhba Clinic — Patient & Booking App",
      descriptionAr:
        "تطبيق جوال للعيادات والمراكز الطبية يتيح للمرضى حجز المواعيد في ثوانٍ، استلام تذكيرات تلقائية عبر الإشعارات وواتساب، ومتابعة الوصفات والزيارات.",
      descriptionEn:
        "Mobile app for clinics & medical centers letting patients book appointments in seconds, receive automatic push & WhatsApp reminders, and access visit history.",
      image:
        "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80",
      color: "#059669",
      platforms: ["iOS", "Android", "Web App"],
      featuresAr: [
        "حجز مواعيد ذكي حسب الطبيب والتخصص",
        "تذكيرات فورية لتقليل الغياب",
        "ملف متابعة رقمي لكل مريض",
        "عربي + إنجليزي بواجهة مريحة",
      ],
      featuresEn: [
        "Smart slot booking by doctor & specialty",
        "Instant reminders cutting no-shows",
        "Digital follow-up file per patient",
        "Bilingual Arabic & English UI",
      ],
      progress: 85,
      priceHintUsd: null,
      demoUrl: "",
    },
    {
      id: "app-commerce-go",
      slug: "nukhba-shop-app",
      status: "in_preparation",
      badgeAr: "قيد التحضير",
      badgeEn: "In Preparation",
      categoryAr: "تجارة إلكترونية",
      categoryEn: "E-Commerce",
      titleAr: "نخبة شوب — تطبيق المتجر والتوصيل السريع",
      titleEn: "Nukhba Shop — Native Store & Delivery App",
      descriptionAr:
        "تطبيق متجر إلكتروني بهويتك الخاصة على App Store وGoogle Play: تصفح فائق السرعة، إشعارات عروض وتخفيضات، دفع عند الاستلام وتتبع حالة المندوب مباشرة.",
      descriptionEn:
        "Branded mobile store for iOS & Android with instant browsing, push flash-sale notifications, cash-on-delivery checkout and live courier status tracking.",
      image:
        "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1200&q=80",
      color: "#C6A664",
      platforms: ["iOS", "Android"],
      featuresAr: [
        "إشعارات عروض تزيد تكرار الشراء",
        "سلة سريعة ودفع عند الاستلام",
        "تتبع الطلب خطوة بخطوة",
        "مزامنة كاملة مع موقع المتجر",
      ],
      featuresEn: [
        "Push promos boosting repeat orders",
        "1-minute cart & Cash on Delivery",
        "Step-by-step order tracking",
        "Real-time sync with web store",
      ],
      progress: 80,
      priceHintUsd: null,
      demoUrl: "",
    },
    {
      id: "app-food-qr",
      slug: "nukhba-food-order",
      status: "coming_soon",
      badgeAr: "قريباً",
      badgeEn: "Coming Soon",
      categoryAr: "مطاعم ومقاهي",
      categoryEn: "Restaurants & Cafés",
      titleAr: "نخبة فود — تطبيق الطلب والمنيو التفاعلي",
      titleEn: "Nukhba Food — Ordering, Loyalty & QR App",
      descriptionAr:
        "منظومة طلب متكاملة للمطاعم والمقاهي تجمع تطبيق العميل للطلب والتوصيل، قائمة الطاولة عبر QR، وبرنامج نقاط الولاء لعملائك الدائمين.",
      descriptionEn:
        "All-in-one restaurant ordering app uniting delivery & pickup orders, QR table menu ordering, kitchen ticket screen and customer loyalty points.",
      image:
        "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
      color: "#DC2626",
      platforms: ["iOS", "Android", "QR Web"],
      featuresAr: [
        "طلب توصيل أو استلام بدون عمولة وسيط",
        "تخصيص الإضافات والوجبات بسهولة",
        "نقاط ولاء وكوبونات خصم",
        "شاشة استقبال فورية للمطبخ",
      ],
      featuresEn: [
        "Zero-commission delivery & pickup",
        "Easy meal & topping customization",
        "Built-in loyalty points & coupons",
        "Live kitchen order display",
      ],
      progress: 65,
      priceHintUsd: null,
      demoUrl: "",
    },
    {
      id: "app-business-pilot",
      slug: "nukhba-pilot-app",
      status: "coming_soon",
      badgeAr: "قريباً",
      badgeEn: "Coming Soon",
      categoryAr: "إدارة الأعمال",
      categoryEn: "Business Control",
      titleAr: "نخبة بايلوت — لوحة قيادة مشروعك في جيبك",
      titleEn: "Nukhba Pilot — Owner Dashboard in Your Pocket",
      descriptionAr:
        "تطبيق مخصّص لأصحاب المشاريع لمتابعة مبيعات اليوم، الطلبات الجديدة، تنبيهات المخزون ورسائل العملاء لحظة بلحظة من الهاتف أينما كنت.",
      descriptionEn:
        "Executive mobile companion giving business owners real-time daily sales, incoming web orders, low-stock alerts and one-tap WhatsApp replies anywhere.",
      image:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
      color: "#0EA5E9",
      platforms: ["iOS", "Android", "Web"],
      featuresAr: [
        "ملخص مبيعات وطلبات لحظي",
        "تنبيه فوري لكل طلب أو حجز جديد",
        "تقارير يومية وأسبوعية مبسّطة",
        "صلاحيات متعددة لفريق العمل",
      ],
      featuresEn: [
        "Live daily revenue & order pulse",
        "Instant alert on every new lead/order",
        "Clean daily & weekly summaries",
        "Role-based team access",
      ],
      progress: 55,
      priceHintUsd: null,
      demoUrl: "",
    },
  ],
};

/** Page « Nos produits numériques & logiciels » (prochainement). */
export const defaultProductsPage: ShowcasePageConfig = {
  statusBadgeAr: "قريباً • منتجات وبرامج نخبة",
  statusBadgeEn: "Coming Soon • Nukhba Software Suite",
  titleAr: "منتجاتنا الرقمية وبرامجنا",
  titleEn: "Digital Products & Software",
  highlightAr: "قريباً للشركات والروّاد",
  highlightEn: "Coming soon for modern businesses",
  subtitleAr:
    "حزمة متكاملة من البرامج السحابية والأنظمة الإدارية والمنتجات الرقمية الجاهزة — مصممة لبيئات العمل حول العالم بواجهة عربية وإنجليزية فائقة السلاسة.",
  subtitleEn:
    "A curated suite of cloud software, POS & ERP systems, and ready-to-launch digital assets tailored for businesses worldwide.",
  bannerNoteAr:
    "جميع البرامج والمنتجات الرقمية أدناه تُطرح قريباً — احجز نسختك المبكرة بسعر الإطلاق التفضيلي.",
  bannerNoteEn:
    "All digital products & software packages below are launching soon — reserve early-bird access via WhatsApp.",
  ctaLabelAr: "احجز نسختك عند الإطلاق",
  ctaLabelEn: "Reserve launch access",
  items: [
    {
      id: "prod-cloud-pos",
      slug: "nukhba-cloud-pos",
      status: "coming_soon",
      badgeAr: "قريباً",
      badgeEn: "Coming Soon",
      categoryAr: "نقاط بيع ومخزون",
      categoryEn: "POS & Inventory",
      titleAr: "نخبة POS السحابي — نظام المبيعات والمخزون والفوترة",
      titleEn: "Nukhba Cloud POS — Billing, Barcode & Multi-Store Stock",
      descriptionAr:
        "برنامج كاشير ومخازن سريع يعمل على الحاسوب والتابلت مع دعم قارئ الباركود، تعدد العملات ($ / USDT)، جرد الفروع، وتقارير الأرباح اليومية بضغطة زر.",
      descriptionEn:
        "Fast desktop & tablet POS software supporting barcode scanners, USD & USDT pricing, multi-branch stock transfers and instant daily profit reports.",
      image:
        "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80",
      color: "#C6A664",
      platforms: ["Windows / Mac", "Web Cloud", "Tablet"],
      featuresAr: [
        "فواتير سريعة ودعم قارئ الباركود",
        "إدارة مخزون وتنبيهات النفاد",
        "حسابات بالدولار وUSDT",
        "يعمل أونلاين وبدون انقطاع",
      ],
      featuresEn: [
        "Instant invoicing & barcode scanning",
        "Multi-warehouse stock & low-stock alerts",
        "USD & USDT accounting",
        "Offline-resilient cloud sync",
      ],
      progress: 80,
      priceHintUsd: null,
      demoUrl: "",
    },
    {
      id: "prod-whatsapp-crm",
      slug: "nukhba-whatsapp-crm",
      status: "coming_soon",
      badgeAr: "قريباً",
      badgeEn: "Coming Soon",
      categoryAr: "إدارة عملاء CRM",
      categoryEn: "CRM & Automation",
      titleAr: "نخبة CRM — نظام إدارة العملاء ومبيعات واتساب",
      titleEn: "Nukhba CRM — Lead Pipeline & WhatsApp Sales Desk",
      descriptionAr:
        "نظّم كل رسائل العملاء وعروض الأسعار في لوحة واحدة: تصنيف تلقائي للعملاء المحتملين، قوالب ردود جاهزة، تذكير بالمتابعة، وقياس أداء المبيعات.",
      descriptionEn:
        "Centralize every prospect, quote and follow-up in one clean workspace with smart status pipelines, quick reply templates and conversion analytics.",
      image:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
      color: "#0F766E",
      platforms: ["Web SaaS", "Mobile Web", "API"],
      featuresAr: [
        "مسار مبيعات مرئي من أول رسالة حتى الإغلاق",
        "عروض أسعار PDF احترافية في دقيقة",
        "تذكيرات متابعة تلقائية للفريق",
        "تصدير تقارير وبيانات Excel / CSV",
      ],
      featuresEn: [
        "Visual Kanban pipeline from lead to deal",
        "1-minute branded PDF quotes",
        "Automated team follow-up reminders",
        "One-click CSV / Excel exports",
      ],
      progress: 75,
      priceHintUsd: null,
      demoUrl: "",
    },
    {
      id: "prod-medsuite-erp",
      slug: "nukhba-medsuite",
      status: "in_preparation",
      badgeAr: "قيد التحضير",
      badgeEn: "In Preparation",
      categoryAr: "برامج طبية وإدارية",
      categoryEn: "Medical & Clinic Software",
      titleAr: "نخبة ميد سويت — برنامج إدارة العيادات والمصحات",
      titleEn: "Nukhba MedSuite — Complete Clinic & Polyclinic Software",
      descriptionAr:
        "برنامج متكامل لإدارة الاستقبال، طابور الانتظار، السجلات الطبية، الوصفات المطبوعة، وحسابات الأطباء والخزينة اليومية بخصوصية وأمان عالٍ.",
      descriptionEn:
        "Comprehensive clinic management software covering reception queue, electronic patient records, printed prescriptions and doctor revenue split.",
      image:
        "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80",
      color: "#2563EB",
      platforms: ["Desktop", "Local Network", "Cloud"],
      featuresAr: [
        "إدارة استقبال وطابور انتظار ذكي",
        "أرشيف إلكتروني آمن لملفات المرضى",
        "طباعة وصفات وتقارير بهوية العيادة",
        "حساب نسب الأطباء والخزينة تلقائياً",
      ],
      featuresEn: [
        "Smart reception & waiting-room queue",
        "Secure searchable patient records",
        "Branded prescription & report printing",
        "Automated doctor payout & cashbox",
      ],
      progress: 70,
      priceHintUsd: null,
      demoUrl: "",
    },
    {
      id: "prod-launch-kits",
      slug: "nukhba-digital-kits",
      status: "coming_soon",
      badgeAr: "قريباً",
      badgeEn: "Coming Soon",
      categoryAr: "منتجات وقوالب رقمية",
      categoryEn: "Digital Kits & Templates",
      titleAr: "حزم نخبة الرقمية — قوالب أعمال وهوية جاهزة للانطلاق",
      titleEn: "Nukhba Digital Kits — Ready-to-Use Business & Brand Packs",
      descriptionAr:
        "منتجات رقمية فورية التحميل لأصحاب المشاريع: عروض تقديمية تفاعلية، قوائم أسعار رقمية، حزم محتوى سوشيال ميديا، وجداول إدارة مالية احترافية.",
      descriptionEn:
        "Instant-download digital packs for founders: interactive pitch decks, digital price menus, social brand kits and financial planning dashboards.",
      image:
        "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&q=80",
      color: "#9333EA",
      platforms: ["Instant Download", "Figma / PDF / Web"],
      featuresAr: [
        "جاهزة للتعديل الفوري باسم مشروعك",
        "تصميم عربي وإنجليزي متقن",
        "تحديثات مجانية مدى الحياة",
        "شرح فيديو مبسّط خطوة بخطوة",
      ],
      featuresEn: [
        " Customize in minutes with your brand",
        "Crafted for Arabic & English layouts",
        "Lifetime free updates included",
        "Step-by-step video walkthrough",
      ],
      progress: 90,
      priceHintUsd: null,
      demoUrl: "",
    },
  ],
};

