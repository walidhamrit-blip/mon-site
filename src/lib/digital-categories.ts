import type { DigitalKind, DigitalProduct } from "./digital-types";
import type { Faq } from "./site-types";
import { sortByDemand } from "./digital-priority";

export interface DigitalCategoryMeta {
  kind: DigitalKind;
  en: string;
  ar: string;
  seoTitleEn: string;
  seoTitleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  guideHeadingEn: string;
  guideHeadingAr: string;
  guideParagraphsEn: readonly string[];
  guideParagraphsAr: readonly string[];
  checklistTitleEn: string;
  checklistTitleAr: string;
  checklistEn: readonly string[];
  checklistAr: readonly string[];
  faqs: readonly Faq[];
}

/** Separate namespace: never competes with /codes/[slug] product URLs. */
export const digitalCategories = [
  {
    kind: "gift_card",
    en: "Gift cards",
    ar: "بطاقات هدايا",
    seoTitleEn: "Digital Gift Cards in USD & USDT",
    seoTitleAr: "بطاقات هدايا رقمية بالدولار وUSDT",
    descriptionEn:
      "Browse digital gift cards by platform and region. Compare available amounts and check account compatibility before receiving your code by email.",
    descriptionAr:
      "تصفح بطاقات الهدايا الرقمية حسب المنصة والمنطقة. قارن القيم المتاحة وتحقق من توافق حسابك قبل استلام الكود بالبريد الإلكتروني.",
    guideHeadingAr: "دليل شراء بطاقات الهدايا الرقمية وتفادي أخطاء المنطقة",
    guideHeadingEn: "How to choose the right digital gift card and account region",
    guideParagraphsAr: [
      "تعمل بطاقات الهدايا الرقمية كرصيد مسبق الدفع يُضاف مباشرة إلى محفظة حسابك على Steam أو PlayStation Network أو Xbox أو Apple أو Google Play دون الحاجة إلى ربط بطاقة مصرفية دولية. بعد تأكيد الدفع بالدولار الأمريكي أو عملة USDT (حيث يعادل 1 دولار = 1 USDT)، يُرسل كود الاسترداد الأصلي غير المستخدم إلى بريدك الإلكتروني لتفعيله فوراً داخل المتجر الرسمي.",
      "العامل الأهم قبل إتمام الطلب هو مطابقة منطقة البطاقة مع بلد الحساب الفعلي المسجّل في إعدادات المنصة. فبطاقة المتجر الأمريكي (US) لا تُقبل على حساب أوروبي أو خليجي والعكس صحيح، كما لا تسمح المتاجر الرقمية باسترجاع الكود بعد كشفه. لذلك نعرض نطاق كل بطاقة وفئاتها السعرية بوضوح على صفحة المنتج قبل الدفع.",
    ],
    guideParagraphsEn: [
      "Digital gift cards work as prepaid wallet credit that you redeem directly on Steam, PlayStation Network, Xbox, Apple or Google Play without linking an international bank card. As soon as your payment settles in US dollars or USDT via NOWPayments (1 USD = 1 USDT), a single unused redemption code from an official distributor is sent to the email address entered at checkout.",
      "Before ordering, always match the card region to the country configured inside your platform account settings. A US store voucher cannot be redeemed on a European, Turkish or MENA account, and digital codes cannot be reversed once issued. Every product sheet in this category lists the exact supported region and available denominations upfront so you can verify compatibility in seconds.",
    ],
    checklistTitleAr: "قائمة التحقق السريعة قبل طلب البطاقة",
    checklistTitleEn: "Quick checklist before ordering your card",
    checklistAr: [
      "تأكّد من دولة الحساب في إعدادات PlayStation أو Steam أو Apple أو Google Play قبل اختيار الفئة.",
      "اختر القيمة المالية المناسبة بالدولار؛ السعر المعروض نهائي ويشمل هامش الخدمة دون رسوم خفية.",
      "أدخل بريداً إلكترونياً صحيحاً يصلك عليه كود البطاقة وإيصال الطلب فور تأكيد الشبكة.",
      "استرد الكود من صفحة Redeem الرسمية داخل حسابك فقط ولا تشاركه مع أي طرف ثالث.",
    ],
    checklistEn: [
      "Confirm the country set in your PlayStation, Steam, Apple or Google Play account profile before picking a region.",
      "Select the exact wallet denomination you need in USD; displayed prices are final with 1 USD = 1 USDT.",
      "Enter an active email address at checkout to receive your redemption code and order receipt automatically.",
      "Redeem the voucher exclusively inside the official store account page and never share the code.",
    ],
    faqs: [
      {
        qAr: "كيف أستلم بطاقة الهدايا بعد الدفع بـ USDT؟",
        qEn: "How is my digital gift card delivered after paying with USDT?",
        aAr: "يُرسل كود البطاقة الرقمي إلى البريد الإلكتروني الذي أدخلته أثناء الطلب فور تأكيد الدفع عبر NOWPayments — عادةً خلال دقائق قليلة.",
        aEn: "The unused redemption code is emailed automatically to the address provided at checkout right after NOWPayments confirms your transaction — typically within a few minutes.",
      },
      {
        qAr: "ماذا يحدث إذا اشتريت بطاقة بمنطقة مختلفة عن حسابي؟",
        qEn: "What happens if I buy a gift card for the wrong store region?",
        aAr: "المتاجر مثل Steam وPSN وGoogle Play ترفض تفعيل بطاقة من دولة مغايرة لمنطقة الحساب، ولا يمكن استرداد الأكواد بعد تسليمها، لذا يجب التحقق من بلد الحساب أولاً.",
        aEn: "Platforms such as Steam, PSN and Google Play block vouchers from a different region than your account country, and delivered codes are non-refundable, so always check your account region first.",
      },
      {
        qAr: "هل أحتاج إلى إنشاء حساب في متجر نخبة للشراء؟",
        qEn: "Do I need a store account on Nukhba to buy a gift card?",
        aAr: "لا، يمكنك اختيار البطاقة والفئة السعرية وإتمام الدفع مباشرةً بالبريد الإلكتروني فقط دون تسجيل حساب مسبق.",
        aEn: "No store account is required. Pick your card and denomination, enter your delivery email and complete payment in USD/USDT.",
      },
    ],
  },
  {
    kind: "game_topup",
    en: "Game top-ups",
    ar: "شحن الألعاب",
    seoTitleEn: "Instant Game Top-Ups by Player ID",
    seoTitleAr: "شحن ألعاب فوري بمعرّف اللاعب وUSDT",
    descriptionEn:
      "Explore game top-ups and in-game currency. Check the game, region and player ID requirements before ordering a direct recharge to your account.",
    descriptionAr:
      "تصفح شحن الألعاب والعملات داخل اللعبة. تحقق من اللعبة والمنطقة ومتطلبات معرّف اللاعب قبل طلب الشحن المباشر إلى حسابك.",
    guideHeadingAr: "كيف يعمل الشحن المباشر للألعاب بمعرّف اللاعب (Player ID)",
    guideHeadingEn: "How direct game top-ups work using your Player ID",
    guideParagraphsAr: [
      "يختلف قسم شحن الألعاب عن البطاقات التقليدية: فبدلاً من إرسال كود نصي لإدخاله يدوياً، يُضاف الرصيد أو العملات داخل اللعبة (مثل شدات PUBG Mobile أو جواهر Free Fire) مباشرةً إلى حسابك داخل اللعبة اعتماداً على معرّف اللاعب الرقمي (Player ID) والمنطقة أو السيرفر عند الاقتضاء. لا نطلب كلمة مرور حسابك أبداً لإتمام عملية الشحن.",
      "بما أن الرصيد يُودع فوراً في الحساب المرتبط بالمعرّف فور تأكيد الدفع بالدولار أو USDT، فإن مراجعة أرقام معرّف اللاعب نسخاً ولصقاً من ملفك الشخصي داخل اللعبة خطوة أساسية؛ إذ لا يمكن عكس عملية الشحن بعد إضافتها إلى حساب آخر بالخطأ. توضح كل صفحة منتج مكان العثور على المعرّف والباقات المتوفرة بدقة.",
    ],
    guideParagraphsEn: [
      "Direct game top-ups differ from voucher cards: instead of emailing a text code to redeem manually, in-game currency or points (such as PUBG Mobile UC or Free Fire Diamonds) are credited straight to your game profile using your numeric Player ID and server/region when applicable. We never ask for your game login or password.",
      "Because the balance is pushed directly to the account tied to that Player ID once your USD or USDT payment is confirmed, copying and pasting your exact ID from your in-game profile is essential. Credits sent to a mistyped Player ID cannot be reversed after fulfillment. Each product page shows supported regions and exact bundle sizes before checkout.",
    ],
    checklistTitleAr: "خطوات التحقق قبل إرسال طلب شحن اللعبة",
    checklistTitleEn: "Verification steps before submitting a game top-up",
    checklistAr: [
      "انسخ معرّف اللاعب (Player ID) مباشرة من داخل اللعبة ولا تدخل بريدك الإلكتروني بدلاً منه.",
      "تحقّق من توافق نسخة اللعبة أو السيرفر (عالمي، الشرق الأوسط، أوروبا) مع الباقة المختارة.",
      "أكمل الدفع بالدولار أو USDT عبر الفاتورة المؤمّنة واحتفظ برقم الطلب للمتابعة.",
      "افتح اللعبة بعد تأكيد الطلب للتحقق من وصول العملات أو النقاط في رصيدك مباشرة.",
    ],
    checklistEn: [
      "Copy your numeric Player ID directly from your in-game profile — never enter an email address in the Player ID field.",
      "Check that your game client or server region (Global, MENA, Europe) matches the selected top-up listing.",
      "Settle the exact USD/USDT invoice amount and keep your order reference until the balance appears.",
      "Relaunch or refresh your game wallet a few minutes after payment confirmation to see the credited balance.",
    ],
    faqs: [
      {
        qAr: "هل أحتاج إلى إعطاء كلمة مرور حسابي لشحن اللعبة؟",
        qEn: "Do you ever need my game password for a top-up?",
        aAr: "لا إطلاقاً. يتم الشحن الرسمي حصرياً عبر معرّف اللاعب العام (Player ID) والسيرفر عند الحاجة دون أي وصول إلى بيانات تسجيل الدخول.",
        aEn: "Never. Official direct top-ups only require your public numeric Player ID (and server ID where applicable) — never share your account password.",
      },
      {
        qAr: "هل يُرسل شحن الألعاب ككود في البريد أم يُضاف مباشرة؟",
        qEn: "Is a game top-up delivered by email code or credited in-game?",
        aAr: "يُضاف الرصيد مباشرة إلى حساب اللعبة المرتبط بمعرّف اللاعب بعد تأكيد الدفع، بينما يصلك إشعار وتفاصيل الطلب للمتابعة.",
        aEn: "Game top-ups in this category are credited directly to the game account linked to your Player ID after payment confirmation rather than redeemed as an email voucher.",
      },
      {
        qAr: "ماذا لو أدخلت معرّف لاعب خاطئ عند الطلب؟",
        qEn: "Can a top-up be refunded if I typed the wrong Player ID?",
        aAr: "الشحن الذي يُنفَّذ على معرّف لاعب صالح آخر لا يمكن استرجاعه من ناشر اللعبة، لذلك نوصي دائماً بنسخ المعرّف ولصقه والتحقق من اسم الحساب.",
        aEn: "Once the publisher credits a valid Player ID, the transaction is final and irreversible. Always copy-paste your ID from inside the game before paying.",
      },
    ],
  },
  {
    kind: "software_key",
    en: "Game & software keys",
    ar: "مفاتيح ألعاب وبرامج",
    seoTitleEn: "Genuine Game & Software License Keys",
    seoTitleAr: "مفاتيح ألعاب وبرامج أصلية بالدولار",
    descriptionEn:
      "Browse game and software activation keys. Check the platform, licence details and region on each product before ordering your digital key by email.",
    descriptionAr:
      "تصفح مفاتيح تفعيل الألعاب والبرامج. تحقق من المنصة وتفاصيل الترخيص والمنطقة في صفحة المنتج قبل طلب مفتاحك الرقمي بالبريد الإلكتروني.",
    guideHeadingAr: "دليل اختيار مفاتيح البرامج والألعاب الرقمية وتفعيلها",
    guideHeadingEn: "Choosing and activating genuine software & PC game keys",
    guideParagraphsAr: [
      "تتيح مفاتيح البرامج والألعاب الأصلية تفعيل أنظمة التشغيل وتطبيقات الإنتاجية والحماية وألعاب الحاسوب مباشرة من الواجهة الرسمية للناشر دون وسطاء أو أدوات غير موثوقة. بمجرد تأكيد الدفع بالدولار أو عملة USDT، يصلك مفتاح تفعيل فريد غير مستخدم على بريدك الإلكتروني مرفقاً بخطوات الإدخال داخل الإعدادات أو حساب المنصة.",
      "قبل شراء أي ترخيص رقمي، راجع دائماً إصدار البرنامج المثبّت لديك (مثل إصدار Pro مقابل Home أو توافق نظام Windows مقابل macOS)، وعدد الأجهزة المشمولة بالترخيص، ونطاق التفعيل الجغرافي المذكور في بطاقة المنتج. الاحتفاظ برسالة الطلب والمفتاح في أرشيف بريدك يضمن لك الرجوع إليه عند إعادة تثبيت النظام أو طلب الدعم.",
    ],
    guideParagraphsEn: [
      "Genuine software and PC game activation keys unlock operating systems, productivity suites, security tools and digital titles directly inside the publisher's official launcher or settings panel without unsafe third-party installers. Once your USD or USDT payment is confirmed, a unique unused license key is delivered to your email along with step-by-step activation guidance.",
      "Before purchasing a software license, double-check the exact edition installed on your machine (for example Pro vs Home, or Windows vs macOS compatibility), the number of covered devices, and the regional scope displayed on the product sheet. Archiving your order confirmation email keeps your license key safe for future system reinstalls.",
    ],
    checklistTitleAr: "ما يجب مراجعته قبل شراء مفتاح التفعيل",
    checklistTitleEn: "What to check before buying a digital key",
    checklistAr: [
      "طابق إصدار البرنامج أو منصة اللعبة مع الإصدار المذكور في عنوان المنتج وتفاصيله.",
      "تأكّد من نظام التشغيل المدعوم (Windows أو macOS أو متعدد المنصات) ونطاق التفعيل.",
      "انسخ مفتاح التفعيل كما وصل في البريد الإلكتروني دون مسافات إضافية عند اللصق.",
      "احتفظ برسالة البريد الإلكتروني التي تحتوي على المفتاح للرجوع إليها عند صيانة الجهاز.",
    ],
    checklistEn: [
      "Match the exact software edition or PC launcher on your device with the edition stated on the listing.",
      "Verify operating-system compatibility (Windows, macOS or cross-platform) and regional activation rules.",
      "Paste the activation key exactly as delivered in your email without leading or trailing spaces.",
      "Keep your order email archived in case you need the license details during a clean OS reinstall.",
    ],
    faqs: [
      {
        qAr: "كيف أستلم مفتاح التفعيل بعد إتمام الدفع؟",
        qEn: "How do I receive my license key after payment?",
        aAr: "يُرسل مفتاح التفعيل الرقمي إلى بريدك الإلكتروني فور تأكيد الدفع بـ USDT أو الدولار، مع خطوات التفعيل الخاصة بالمنصة.",
        aEn: "Your activation key is emailed directly to the checkout address as soon as your USD or USDT transaction is confirmed, alongside redemption instructions.",
      },
      {
        qAr: "هل المفاتيح أصلية وتُفعّل من البرنامج الرسمي؟",
        qEn: "Are these genuine keys activated inside the official platform?",
        aAr: "نعم، جميع المفاتيح المعروضة من موزّعين معتمدين وتُفعّل مباشرة داخل إعدادات البرنامج أو موقع الناشر الرسمي لمرة واحدة لكل طلب.",
        aEn: "Yes. Every license key is sourced through authorized distribution channels and redeemed directly in the publisher's official activation screen or account portal.",
      },
      {
        qAr: "ماذا أفعل إذا ظهر خطأ أثناء تفعيل المفتاح؟",
        qEn: "What should I do if an activation error appears?",
        aAr: "تأكّد أولاً من مطابقة إصدار البرنامج والمنطقة، وإذا استمر الخطأ تواصل مع دعم نخبة خلال 48 ساعة مرفقاً لقطة شاشة كاملة للتحقق والاستبدال عند ثبوت الخلل.",
        aEn: "First verify that your installed software edition and region match the listing. If an issue persists, contact Nukhba support within 48 hours with a full screenshot so we can verify and replace a faulty key.",
      },
    ],
  },
  {
    kind: "subscription_code",
    en: "Subscription codes",
    ar: "أكواد الاشتراكات",
    seoTitleEn: "Digital Subscription Codes in USDT",
    seoTitleAr: "أكواد اشتراكات رقمية بدون بطاقة بنكية",
    descriptionEn:
      "Explore digital subscription codes. Compare services, durations and supported regions, then check activation requirements before ordering a code by email.",
    descriptionAr:
      "تصفح أكواد الاشتراكات الرقمية. قارن الخدمات والمدد والمناطق المدعومة وتحقق من متطلبات التفعيل قبل طلب الكود بالبريد الإلكتروني.",
    guideHeadingAr: "تفعيل وتجديد الاشتراكات الرقمية مسبقة الدفع بدون بطاقة مصرفية",
    guideHeadingEn: "Activating prepaid digital subscriptions without a bank card",
    guideParagraphsAr: [
      "تمنحك أكواد الاشتراكات مسبقة الدفع طريقة مباشرة لتفعيل أو تمديد عضويتك في منصات الموسيقى والبث والألعاب — مثل Spotify Premium وPlayStation Plus وXbox Game Pass — لفترة محددة (شهر، 3 أشهر، أو 12 شهراً) دون تفعيل سحب شهري تلقائي أو الحاجة إلى بطاقة ائتمان دولية. تدفع قيمة المدة مرة واحدة بالدولار أو USDT وتستلم الكود على بريدك الإلكتروني.",
      "عند اختيار كود اشتراك، انتبه إلى نقطتين أساسيتين: تطابق دولة الكود مع بلد حسابك على المنصة، وشروط المنصة بخصوص تكديس المدد أو الحسابات التي لديها اشتراك نشط من فئة مختلفة. تعرض كل صفحة منتج في هذا القسم المدة الدقيقة والمنطقة المدعومة وخطوات الاسترداد خطوة بخطوة قبل الشراء.",
    ],
    guideParagraphsEn: [
      "Prepaid subscription codes give you a clean way to activate or extend memberships on music, streaming and gaming services — including Spotify Premium, PlayStation Plus and Xbox Game Pass — for a fixed period (1, 3 or 12 months) with zero recurring auto-renewal charges and no international credit card required. Pay once in USD or USDT and receive your code by email.",
      "Before choosing a membership voucher, check two details on the product page: whether the code region matches the country registered on your platform account, and whether the service allows stacking on top of an active tier. Every listing in this section specifies the exact duration, regional compatibility and redemption steps upfront.",
    ],
    checklistTitleAr: "نصائح مهمة قبل تفعيل كود الاشتراك",
    checklistTitleEn: "Important checks before redeeming a subscription code",
    checklistAr: [
      "تحقّق من مطابقة منطقة كود الاشتراك مع الدولة المسجّلة في حساب المنصة قبل الدفع.",
      "راجع مدة الاشتراك وفئته (مثلاً فردي، أو Essential / Ultimate) لضمان توافقه مع عضويتك الحالية.",
      "استلم الكود عبر بريدك الإلكتروني وفعّله من صفحة Redeem الرسمية على موقع الخدمة عبر المتصفح.",
      "تستمر العضوية طوال المدة المدفوعة دون أي خصم تلقائي عند انتهائها.",
    ],
    checklistEn: [
      "Confirm that the subscription voucher region matches the country set on your target account.",
      "Check the exact membership tier and duration (1, 3 or 12 months) if you already hold an active plan.",
      "Redeem the emailed code on the service's official web account page rather than third-party links.",
      "Enjoy fixed-term access with no automatic billing when the prepaid period ends.",
    ],
    faqs: [
      {
        qAr: "هل يتجدد الاشتراك تلقائياً أو يطلب بطاقة بنكية عند التفعيل؟",
        qEn: "Will a prepaid subscription code charge me automatically when it expires?",
        aAr: "في معظم المنصات تعمل الأكواد مسبقة الدفع على تمديد الاشتراك للمدة المحددة دون سحب تلقائي؛ بعض الخدمات قد تطلب حساباً مفعّلاً في نفس الدولة فقط.",
        aEn: "No. Prepaid membership codes grant access for the exact purchased term without recurring billing on Nukhba.",
      },
      {
        qAr: "هل يمكن إضافة كود اشتراك جديد قبل انتهاء اشتراكي الحالي؟",
        qEn: "Can I stack a new subscription code onto an existing active plan?",
        aAr: "يعتمد ذلك على سياسة كل منصة وفئة العضوية؛ راجع الملاحظات الموضحة في صفحة المنتج لمعرفة قابلية تمديد الحسابات النشطة.",
        aEn: "Stacking rules depend on the platform and membership tier (for example upgrading vs extending the same tier). Check the notes on each product page before ordering.",
      },
      {
        qAr: "متى يصل كود الاشتراك بعد الدفع بعملة USDT؟",
        qEn: "How fast is the subscription code delivered after USDT payment?",
        aAr: "يُرسل الكود إلى البريد الإلكتروني المسجّل في الطلب فور تأكيد معاملة الدفع الرقمية، عادةً خلال دقائق.",
        aEn: "Your unused subscription code is emailed right after NOWPayments confirms the transaction on-chain, typically within minutes.",
      },
    ],
  },
] as const satisfies ReadonlyArray<DigitalCategoryMeta>;

export const CATEGORY_PAGE_SIZE = 24;

export function getDigitalCategory(kind: string) {
  return digitalCategories.find((category) => category.kind === kind);
}

export function categoryHref(kind: DigitalKind, page = 1) {
  const path = `/codes/category/${kind}`;
  return page === 1 ? path : `${path}?page=${page}`;
}

/** Reject ambiguous/repeated and non-integer parameters rather than indexing aliases. */
export function parseCategoryPage(value: string | string[] | undefined): number | null {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : null;
}

export function categoryProducts(products: DigitalProduct[], kind: DigitalKind, page = 1) {
  const matching = sortByDemand(products.filter((product) => product.kind === kind));
  return {
    total: matching.length,
    pageCount: Math.max(1, Math.ceil(matching.length / CATEGORY_PAGE_SIZE)),
    products: matching.slice((page - 1) * CATEGORY_PAGE_SIZE, page * CATEGORY_PAGE_SIZE),
  };
}

/** First pages remain useful category guides even when a family is temporarily empty. */
export function categorySitemapPaths(products: DigitalProduct[], degraded: boolean) {
  return digitalCategories.flatMap(({ kind }) => {
    const pageCount = degraded ? 1 : categoryProducts(products, kind).pageCount;
    return Array.from({ length: pageCount }, (_, index) => categoryHref(kind, index + 1));
  });
}
