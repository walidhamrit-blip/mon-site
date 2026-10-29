import type { BlogArticle } from "./blog";

/**
 * Contenu éditorial du blog — guides bilingues (EN principal / AR) ciblant
 * les requêtes informationnelles internationales à forte intention.
 * Devise unique affichée : USD (= USDT au paiement).
 *
 * Règles de rédaction (à conserver pour les prochains articles) :
 *  1. **Answer-first** : `answerAr` / `answerEn` répondent à la question du
 *     titre en 2–3 phrases, avec un chiffre et une date. C'est le passage que
 *     les LLM citent et que `speakable` désigne.
 *  2. **Faits chiffrés** : chaque `keyFacts` porte une donnée concrète (prix,
 *     délai, taux) — c'est ce qui distingue un guide citable d'un article creux.
 *  3. **Dates réelles** : `publishedAt` / `updatedAt` alimentent
 *     `datePublished` / `dateModified` (fraîcheur valorisée par Google et les
 *     moteurs de réponse).
 *  4. **Maillage** : chaque article pointe vers 1–2 services, 1–2 secteurs et
 *     les réalisations correspondantes — jamais de page orpheline.
 *  5. **Prix dynamiques** : `includePricing` affiche le tableau tarifaire lu
 *     dans /admin → Réglages, pour éviter toute divergence de prix.
 */
export const blogArticles: BlogArticle[] = [
  /* ─────────── 0. Guide crypto USDT — PREMIER guide affiché ─────────── */
  {
    slug: "how-to-pay-with-crypto-usdt",
    titleAr: "كيف تدفع بالعملات الرقمية (USDT) خطوة بخطوة — دليل مصوّر 2026",
    titleEn: "How to Pay with Crypto (USDT) Step by Step — Photo Guide 2026",
    h1Ar: "كيف تدفع بالعملات الرقمية (USDT) خطوة بخطوة؟",
    h1En: "How to Pay with Crypto (USDT), Step by Step",
    descriptionAr:
      "ادفع بالدولار عبر USDT في 4 خطوات مصوّرة: افتح الفاتورة، انسخ المبلغ والعنوان بدقة، أرسل على الشبكة الصحيحة TRC20، وأكّد — 1 دولار = 1 USDT.",
    descriptionEn:
      "Pay a USD price with USDT in 4 pictured steps: open the invoice, copy the exact amount and address, send on the right network (TRC20), and confirm.",
    excerptAr:
      "أول دفعة كريبتو لك؟ هذا الدليل المصوّر يأخذك من اختيار الباقة حتى تأكيد الشبكة: ماذا تحتاج، أين تنسخ العنوان، أيّ شبكة تختار، والأخطاء التي يجب تجنّبها.",
    excerptEn:
      "First crypto payment? This photo guide takes you from picking a plan to network confirmation: what you need, where to copy the address, which network to choose, and the mistakes to avoid.",
    answerAr:
      "كل أسعار نخبة بالدولار الأمريكي، وتدفع نفس المبلغ تماماً بـ USDT لأن 1 دولار = 1 USDT. الدفع يتم في 4 خطوات: اختر الباقة وافتح نافذة الدفع، اختر USDT في صفحة فاتورة NOWPayments، أرسل المبلغ الدقيق من محفظتك إلى العنوان المعروض على نفس الشبكة (TRC20 عادةً الأرخص بنحو 1 USDT رسوم)، ثم انتظر تأكيد الشبكة — غالباً أقل من 10 دقائق. يمكنك الدفع دفعة واحدة أو على 2–3 أقساط.",
    answerEn:
      "All Nukhba prices are in US dollars, and you pay the exact same amount in USDT because 1 USD = 1 USDT. Payment takes 4 steps: pick your plan and open checkout, choose USDT on the NOWPayments invoice page, send the exact amount from your wallet to the address shown on the same network (TRC20 is usually cheapest, about 1 USDT in fees), then wait for network confirmation — typically under 10 minutes. You can pay in full or in 2–3 installments.",
    categoryAr: "الدفع بالكريبتو",
    categoryEn: "Crypto Payments",
    publishedAt: "2026-10-24",
    updatedAt: "2026-10-24",
    readingMinutes: 6,
    authorAr: "فريق نخبة",
    authorEn: "Nukhba team",
    keywordsAr: [
      "كيف ادفع USDT",
      "الدفع بالعملات الرقمية خطوة بخطوة",
      "شراء موقع بالكريبتو",
      "محفظة USDT شبكة TRC20",
    ],
    keywordsEn: [
      "how to pay with USDT",
      "pay with crypto step by step",
      "USDT TRC20 payment guide",
      "buy a website with crypto",
    ],
    keyFacts: [
      { labelAr: "سعر الصرف عند الدفع", labelEn: "Rate at checkout", valueAr: "1 $ = 1 USDT", valueEn: "1 USD = 1 USDT" },
      { labelAr: "عدد الخطوات", labelEn: "Steps", valueAr: "4 خطوات", valueEn: "4 steps" },
      { labelAr: "رسوم شبكة TRC20 النموذجية", labelEn: "Typical TRC20 fee", valueAr: "≈ 1 USDT", valueEn: "≈ 1 USDT" },
      { labelAr: "تأكيد الشبكة", labelEn: "Network confirmation", valueAr: "غالباً < 10 دقائق", valueEn: "Usually < 10 min" },
      { labelAr: "الأقساط المتاحة", labelEn: "Installments", valueAr: "1 أو 2–3 أقساط", valueEn: "1 or 2–3 payments" },
    ],
    sections: [
      {
        id: "what-is-usdt",
        headingAr: "1. ما هو USDT ولماذا الأسعار بالدولار؟",
        headingEn: "1. What Is USDT, and Why Are Prices in USD?",
        paragraphsAr: [
          "USDT (تيثر) عملة رقمية «مستقرة» مربوطة بالدولار الأمريكي: قيمتها تبقى 1 دولار تقريباً دائماً، بخلاف بيتكوين المتقلبة. لهذا نعرض كل أسعارنا بالدولار فقط — سعر 360 $ يعني أنك ترسل 360 USDT، بدون أي حسابات تحويل وبدون مفاجآت في يوم الدفع.",
          "تحتاج فقط إلى محفظة أو حساب منصة فيه رصيد USDT (مثل تطبيق محفظة على هاتفك أو حساب منصة تداول). إن لم يكن لديك USDT بعد، اشترِ مبلغاً يغطي الفاتورة زائد نحو 1–2 USDT لرسوم الشبكة. لا تحتاج بطاقة بنكية دولية ولا حساباً بنكياً أجنبياً.",
        ],
        paragraphsEn: [
          "USDT (Tether) is a «stablecoin» pegged to the US dollar: its value stays at roughly $1 at all times, unlike volatile Bitcoin. That is why all our prices are in USD only — a $360 price means you send 360 USDT, with no conversion maths and no surprises on payment day.",
          "You only need a wallet or an exchange account holding USDT (a wallet app on your phone, or an exchange account). If you do not hold USDT yet, buy enough to cover the invoice plus about 1–2 USDT for network fees. No international bank card or foreign bank account is required.",
        ],
        bulletsAr: [
          "1 USDT ≈ 1 دولار دائماً — المبلغ المعروض هو المبلغ المُرسَل",
          "جهّز رصيداً يغطي الفاتورة + رسوم الشبكة (1–2 USDT)",
          "أبقِ هاتفك (المحفظة) وجهاز الدفع جاهزين قبل فتح الفاتورة",
        ],
        bulletsEn: [
          "1 USDT ≈ $1 at all times — the amount shown is the amount you send",
          "Hold enough to cover the invoice + network fee (1–2 USDT)",
          "Have your phone (wallet) ready before opening the invoice",
        ],
        image: {
          src: "/guide-crypto/step-1-choose-plan.jpg",
          altAr: "صفحة أسعار بالدولار مع زر الدفع بالعملات الرقمية وعملة USDT بجانب الحاسوب",
          altEn: "USD pricing page with a Pay with crypto button and a USDT coin beside the laptop",
          captionAr: "خطوة 1 — اختر باقتك بالدولار ثم اضغط «ادفع بالكريبتو». شاشة توضيحية: الأسعار الفعلية في صفحة الباقات.",
          captionEn: "Step 1 — pick your USD plan, then press “Pay with crypto”. Demo screen: live prices are on the pricing page.",
        },
        calloutAr:
          "قاعدة ذهبية: لا ترسل أي مبلغ قبل إنشاء الفاتورة من موقعنا. العنوان والمبلغ الصحيحان يظهران فقط داخل صفحة الفاتورة الرسمية بعد تعبئة نافذة الدفع.",
        calloutEn:
          "Golden rule: never send anything before generating the invoice on our site. The correct address and amount only appear inside the official invoice page after you complete the checkout window.",
      },
      {
        id: "open-invoice",
        headingAr: "2. افتح الفاتورة وانسخ المبلغ والعنوان والشبكة",
        headingEn: "2. Open the Invoice and Copy Amount, Address and Network",
        paragraphsAr: [
          "بعد اختيار الموقع أو الباقة وتعبئة بريدك الإلكتروني في نافذة الدفع، تُحوَّل تلقائياً إلى صفحة فاتورة NOWPayments الآمنة. هناك اختر USDT من قائمة العملات — ستظهر لك ثلاثة عناصر حاسمة: المبلغ الدقيق (مثلاً 245.50 USDT)، عنوان الاستلام، واسم الشبكة (مثلاً Tron TRC20)، مع رمز QR يمكنك مسحه بهاتفك بدل النسخ اليدوي.",
          "انسخ العنوان بزر النسخ ولا تكتبه يدوياً أبداً: حرف واحد خاطئ يعني ضياع المبلغ نهائياً، لأن تحويلات الكريبتو لا يمكن التراجع عنها. وانتبه لعدّاد الفاتورة: أكمل الإرسال قبل انتهائها، وإذا انتهت أنشئ فاتورة جديدة من موقعنا بدل الإرسال إلى عنوان قديم.",
        ],
        paragraphsEn: [
          "After picking your site or plan and entering your email in the checkout window, you are redirected to the secure NOWPayments invoice page. There, choose USDT from the coin list — you will see three critical items: the exact amount (for example 245.50 USDT), the receiving address, and the network name (for example Tron TRC20), plus a QR code you can scan instead of copying by hand.",
          "Copy the address with the copy button and never type it manually: one wrong character means the funds are lost forever, because crypto transfers cannot be reversed. Watch the invoice timer: send before it expires, and if it does, create a fresh invoice on our site instead of sending to an old address.",
        ],
        bulletsAr: [
          "اختر USDT في صفحة الفاتورة ودوّن: المبلغ + العنوان + الشبكة",
          "انسخ بالزر أو امسح QR — لا تكتب العنوان يدوياً",
          "أرسل قبل انتهاء عدّاد الفاتورة؛ الفاتورة المنتهية = فاتورة جديدة",
        ],
        bulletsEn: [
          "Choose USDT on the invoice and note: amount + address + network",
          "Copy with the button or scan the QR — never type the address",
          "Send before the timer ends; an expired invoice means a new invoice",
        ],
        image: {
          src: "/guide-crypto/step-2-invoice-usdt.jpg",
          altAr: "شاشة فاتورة دفع USDT على الهاتف مع رمز QR وعنوان ومبلغ دقيق وشبكة TRC20",
          altEn: "USDT invoice screen on a phone with QR code, exact amount, address and TRC20 network",
          captionAr: "خطوة 2 — صفحة الفاتورة: المبلغ الدقيق، العنوان، ورمز QR. شاشة توضيحية: انسخ دائماً بيانات فاتورتك أنت.",
          captionEn: "Step 2 — the invoice page: exact amount, address and QR code. Demo screen: always copy your own invoice details.",
        },
      },
      {
        id: "send-from-wallet",
        headingAr: "3. أرسل من محفظتك على نفس الشبكة وبنفس المبلغ",
        headingEn: "3. Send From Your Wallet on the Same Network, Exact Amount",
        paragraphsAr: [
          "افتح محفظتك واختر إرسال USDT، الصق العنوان الذي نسخته، وأدخل المبلغ الدقيق رقماً برقم كما في الفاتورة (245.50 وليس 245 أو 246). ثم اختر الشبكة نفسها المكتوبة في الفاتورة — إذا كانت الفاتورة TRC20 اختر Tron (TRC20) في محفظتك؛ الإرسال على شبكة مختلفة (ERC20 مثلاً) إلى عنوان TRC20 يعني فقدان المبلغ.",
          "قبل التأكيد قارن أول 6 أحرف وآخر 6 أحرف من العنوان الملصوق مع شاشة الفاتورة، وتأكد أن الرسوم تُخصم من رصيدك الإضافي لا من مبلغ الفاتورة نفسه. رسوم TRC20 عادة نحو 1 USDT وتأكيدها خلال دقائق؛ شبكة Ethereum (ERC20) أغلى بكثير ولا ننصح بها إلا إذا طلبتها فاتورتك تحديداً.",
        ],
        paragraphsEn: [
          "Open your wallet, choose Send USDT, paste the copied address, and enter the exact amount digit for digit as shown on the invoice (245.50, not 245 or 246). Then select the same network written on the invoice — if the invoice says TRC20, pick Tron (TRC20) in your wallet; sending on a different network (for example ERC20) to a TRC20 address loses the funds.",
          "Before confirming, compare the first 6 and last 6 characters of the pasted address against the invoice screen, and make sure the fee comes out of your extra balance, not out of the invoice amount itself. TRC20 fees are usually about 1 USDT with confirmation in minutes; Ethereum (ERC20) costs far more and we only recommend it if your invoice specifically asks for it.",
        ],
        bulletsAr: [
          "الصق العنوان، أدخل المبلغ الدقيق، اختر نفس الشبكة حرفياً",
          "تحقق من أول 6 وآخر 6 أحرف قبل الضغط على تأكيد",
          "TRC20: رسوم ≈ 1 USDT — تجنّب ERC20 إلا إذا طلبته الفاتورة",
        ],
        bulletsEn: [
          "Paste the address, enter the exact amount, pick the identical network",
          "Check the first 6 and last 6 characters before confirming",
          "TRC20: ≈ 1 USDT fee — avoid ERC20 unless your invoice requires it",
        ],
        image: {
          src: "/guide-crypto/step-3-send-from-wallet.jpg",
          altAr: "إرسال USDT من محفظة هاتف مع عنوان المستلم والمبلغ واختيار الشبكة",
          altEn: "Sending USDT from a phone wallet with recipient address, amount and network selection",
          captionAr: "خطوة 3 — في محفظتك: العنوان الملصوق، المبلغ الدقيق، ونفس شبكة الفاتورة قبل التأكيد.",
          captionEn: "Step 3 — in your wallet: pasted address, exact amount, and the invoice's network before you confirm.",
        },
        calloutAr:
          "أرسلت مبلغاً مختلفاً عن الفاتورة؟ لا تُكمل بتحويل ثانٍ من تلقاء نفسك — راسلنا على واتساب برقم الطلب ولقطة المعاملة وسنرشدك، فبعض النواقص يمكن تسويتها يدوياً.",
        calloutEn:
          "Sent a different amount than the invoice? Do not top it up with a second transfer on your own — message us on WhatsApp with your order reference and a screenshot of the transaction and we will guide you; some shortfalls can be settled manually.",
      },
      {
        id: "confirmation",
        headingAr: "4. انتظر التأكيد وتابع طلبك",
        headingEn: "4. Wait for Confirmation and Track Your Order",
        paragraphsAr: [
          "بعد الإرسال تعرض صفحة متابعة الطلب الحالة مباشرة: «بانتظار التأكيد» ثم «تم استلام الدفع» فور تأكيد الشبكة — عادة أقل من 10 دقائق على TRC20، وقد تطول عند ازدحام الشبكة. يصلك في الوقت نفسه إيصال بالبريد الإلكتروني الذي أدخلته، ونتواصل معك خلال ساعتين في أوقات العمل لبدء مشروعك.",
          "إذا اخترت الدفع على 2–3 أقساط، تُدفع اليوم أول دفعة فقط، وتبقى بقية الأقساط ظاهرة في صفحة المتابعة برابط دفع خاص لكل قسط عند استحقاقه — بنفس الخطوات الأربع في هذا الدليل. احتفظ برابط المتابعة ورقم المعاملة (TXID) حتى يكتمل مشروعك.",
        ],
        paragraphsEn: [
          "After sending, the order tracking page updates live: “waiting for confirmation”, then “payment received” as soon as the network confirms — usually under 10 minutes on TRC20, longer if the network is congested. An email receipt arrives at the address you entered, and we contact you within 2 working hours to start your project.",
          "If you chose 2–3 installments, only the first payment is due today; the remaining installments stay visible on the tracking page, each with its own payment link when due — using the same four steps in this guide. Keep your tracking link and transaction ID (TXID) until your project is complete.",
        ],
        image: {
          src: "/guide-crypto/step-4-payment-confirmed.jpg",
          altAr: "صفحة متابعة طلب تؤكد استلام دفعة USDT بنجاح مع إشعار على الهاتف",
          altEn: "Order tracking page confirming a successful USDT payment with a phone notification",
          captionAr: "خطوة 4 — «تم استلام الدفع»: طلبك مؤكد ونبدأ التنفيذ. شاشة توضيحية لحالة المتابعة.",
          captionEn: "Step 4 — “Payment received”: your order is confirmed and we start building. Demo tracking screen.",
        },
      },
      {
        id: "mistakes-to-avoid",
        headingAr: "أخطاء يجب تجنّبها قبل أول دفعة",
        headingEn: "Mistakes to Avoid Before Your First Payment",
        paragraphsAr: [
          "أغلب مشاكل الدفع بالكريبتو سببها ثلاث لحظات تسرّع: اختيار شبكة مختلفة عن الفاتورة، تقريب المبلغ، أو كتابة العنوان يدوياً. تجنّبها وستمرّ دفعتك الأولى بسلاسة كأي تحويل بنكي — بل أسرع، ومتاحة من أي بلد في العالم دون بطاقة دولية.",
          "وللأمان: لن نطلب منك أبداً عبارة استرداد محفظتك (Seed Phrase) أو كلمة مرورك، ولن نرسل لك عناوين دفع عبر واتساب. العنوان الوحيد الموثوق هو الذي يظهر داخل صفحة الفاتورة بعد إنشائها من موقعنا الرسمي — من يطلب غير ذلك فهو محتال.",
        ],
        paragraphsEn: [
          "Most crypto payment problems come from three rushed moments: picking a different network than the invoice, rounding the amount, or typing the address by hand. Avoid those and your first payment flows as smoothly as a bank transfer — only faster, and available from any country without an international card.",
          "For safety: we will never ask for your wallet recovery phrase (seed phrase) or your password, and we never send payment addresses over WhatsApp. The only trusted address is the one shown inside the invoice page generated from our official website — anyone asking otherwise is a scammer.",
        ],
        bulletsAr: [
          "لا شبكة مختلفة، لا تقريب للمبلغ، لا كتابة يدوية للعنوان",
          "لا تُعد استخدام عنوان فاتورة منتهية — أنشئ فاتورة جديدة",
          "لا تشارك عبارة الاسترداد مع أي أحد، أبداً",
          "عنوان الدفع يأتي من صفحة الفاتورة فقط، لا من الرسائل",
        ],
        bulletsEn: [
          "No different network, no rounded amount, no hand-typed address",
          "Never reuse an expired invoice address — generate a new invoice",
          "Never share your seed phrase with anyone, ever",
          "Payment addresses come from the invoice page only, never from messages",
        ],
        calloutAr:
          "جاهز؟ اختر موقعاً من المعارض أو باقة من صفحة الأسعار، واضغط «ادفع بالكريبتو» — هذا الدليل يبقى مفتوحاً بجانبك خطوة بخطوة.",
        calloutEn:
          "Ready? Pick a site from the showcase or a plan on the pricing page and press “Pay with crypto” — keep this guide open beside you, step by step.",
      },
    ],
    faqs: [
      {
        qAr: "هل يجب أن أدفع بـ USDT حصراً، أم يمكنني استخدام عملات أخرى؟",
        qEn: "Must I pay in USDT, or can I use other coins?",
        aAr: "يمكنك الدفع بأكثر من 300 عملة في صفحة الفاتورة (بيتكوين، إيثريوم وغيرها) وسيُحسب المقابل تلقائياً بسعر الدولار المعروض. ننصح بـ USDT للمبتدئين لأنه ثابت القيمة: المبلغ بالدولار هو نفسه بعدد USDT، فلا مجال لخطأ في التحويل أثناء تقلّب السوق.",
        aEn: "You can pay with 300+ coins on the invoice page (Bitcoin, Ethereum and more) and the equivalent is calculated automatically from the USD price shown. We recommend USDT for first-timers because its value is stable: the dollar amount equals the USDT amount, so there is no conversion mistake while markets move.",
      },
      {
        qAr: "أيّ شبكة أختار عند إرسال USDT: TRC20 أم ERC20؟",
        qEn: "Which network should I choose for USDT: TRC20 or ERC20?",
        aAr: "اختر دائماً الشبكة المكتوبة في فاتورتك تحديداً. عملياً تكون Tron (TRC20) في أغلب الفواتير: رسومها نحو 1 USDT وتأكيدها خلال دقائق، بينما Ethereum (ERC20) قد تكلّف عدة دولارات رسوماً. الأهم من الرخص هو التطابق: شبكة الإرسال يجب أن تطابق شبكة الفاتورة حرفياً وإلا ضاع المبلغ.",
        aEn: "Always choose the exact network written on your invoice. In practice that is usually Tron (TRC20): about 1 USDT in fees and confirmation within minutes, while Ethereum (ERC20) can cost several dollars in fees. Matching matters more than cheapness: the sending network must match the invoice network exactly or the funds are lost.",
      },
      {
        qAr: "كم تستغرق الدفعة حتى تظهر مؤكدة؟",
        qEn: "How long until my payment shows as confirmed?",
        aAr: "على شبكة TRC20 تظهر الدفعة مؤكدة غالباً خلال أقل من 10 دقائق، وتتحدث صفحة متابعة الطلب تلقائياً كل بضع ثوانٍ. عند ازدحام الشبكة قد تمتد إلى نحو 30 دقيقة. إذا تجاوزت ساعة دون تأكيد، راسلنا برقم المعاملة (TXID) وسنتحقق معك فوراً من حالة التحويل على الشبكة.",
        aEn: "On TRC20, payments usually show as confirmed in under 10 minutes, and the tracking page refreshes automatically every few seconds. Network congestion can stretch this to about 30 minutes. If an hour passes with no confirmation, send us your transaction ID (TXID) and we will check the transfer status on-chain with you right away.",
      },
      {
        qAr: "هل يمكنني التقسيط بالكريبتو؟ وكيف أدفع بقية الأقساط؟",
        qEn: "Can I pay in installments with crypto? How do I pay the rest?",
        aAr: "نعم: في نافذة الدفع اختر دفعة واحدة أو قسطين أو ثلاثة. تُنشأ فاتورة اليوم للقسط الأول فقط بنفس خطوات هذا الدليل، وتبقى الأقساط التالية في صفحة متابعة الطلب مع زر «ادفع هذا القسط» الذي يفتح فاتورة جديدة بمبلغ القسط وعنوان جديد عند كل استحقاق.",
        aEn: "Yes: in the checkout window choose one payment, or 2 or 3 installments. Today's invoice covers only the first installment, using the same steps in this guide; the remaining installments stay on your tracking page with a “Pay this installment” button that opens a fresh invoice with that installment's amount and a new address each time.",
      },
    ],
    relatedServices: ["landing", "restyle"],
    relatedSectors: ["beauty", "restaurant"],
  },
  /* ───────────────────────── 1. Coût d'un site ───────────────────────── */
  {
    slug: "website-cost-libya-2026",
    titleAr: "كم تكلفة تصميم موقع إلكتروني في 2026؟ الأسعار الحقيقية بالدولار",
    titleEn: "How Much Does a Website Cost in 2026? Real Prices in USD",
    h1Ar: "كم تكلفة تصميم موقع إلكتروني في 2026؟",
    h1En: "What Does a Website Really Cost in 2026?",
    descriptionAr:
      "أسعار تصميم المواقع في 2026 بالدولار: من 300 $ لموقع الواجهة إلى 880 $ للمتجر الإلكتروني الكامل — ما يشمله السعر، وما يرفعه، وكيف تتفادى التكاليف الخفية.",
    descriptionEn:
      "Website pricing in 2026 in USD: from $300 for a showcase site to $880 for a full e-commerce store — what the price includes, what pushes it up, and how to avoid hidden costs.",
    excerptAr:
      "جدول أسعار واضح لثلاث فئات من المواقع بالدولار، مع ما يشمله كل سعر فعلاً وما يرفعه — بدون مبالغة ولا أسعار مخفية.",
    excerptEn:
      "A clear USD price grid for three website tiers, what each price really includes, and what pushes it up — no inflation, no hidden costs.",
    answerAr:
      "في 2026 تتراوح تكلفة موقع إلكتروني احترافي لدينا بين 300 دولار لموقع واجهة من 5 صفحات، و510 دولاراً لموقع مع حجز مواعيد ومدونة، و880 دولاراً لمتجر إلكتروني كامل بنظام دفع وإدارة. السعر يشمل التصميم والتطوير والاستضافة للسنة الأولى، ويُسلَّم في 7 إلى 21 يوماً.",
    answerEn:
      "In 2026 a professional website with us costs between $300 for a five-page showcase site, $510 for a site with booking and a blog, and $880 for a full e-commerce store with payments and an admin panel. The price includes design, development and first-year hosting, with delivery in 7 to 21 days.",
    categoryAr: "أسعار وميزانيات",
    categoryEn: "Pricing & Budgets",
    publishedAt: "2026-10-20",
    updatedAt: "2026-10-20",
    readingMinutes: 7,
    authorAr: "فريق نخبة",
    authorEn: "Nukhba team",
    keywordsAr: [
      "كم تكلفة تصميم موقع في ليبيا",
      "أسعار تصميم المواقع طرابلس",
      "تكلفة متجر إلكتروني ليبيا",
      "سعر موقع ويب 2026",
    ],
    keywordsEn: [
      "website cost Libya",
      "web design prices Tripoli",
      "e-commerce website cost Libya",
      "how much does a website cost 2026",
    ],
    keyFacts: [
      { labelAr: "موقع واجهة (5 صفحات)", labelEn: "Showcase site (5 pages)", valueAr: "$300 = 300 USDT", valueEn: "$300 = 300 USDT" },
      { labelAr: "موقع + حجز ومدونة", labelEn: "Site + booking + blog", valueAr: "$510 = 510 USDT", valueEn: "$510 = 510 USDT" },
      { labelAr: "متجر إلكتروني كامل", labelEn: "Full e-commerce store", valueAr: "$880 = 880 USDT", valueEn: "$880 = 880 USDT" },
      { labelAr: "مدة التسليم", labelEn: "Delivery time", valueAr: "7 – 21 يوماً", valueEn: "7 – 21 days" },
      { labelAr: "الاستضافة السنة الأولى", labelEn: "First-year hosting", valueAr: "مشمولة", valueEn: "Included" },
    ],
    sections: [
      {
        id: "ce-qui-determine-le-prix",
        headingAr: "ما الذي يحدد السعر فعلاً؟",
        headingEn: "What Actually Drives the Price?",
        paragraphsAr: [
          "السعر لا يُحدَّد بعدد الصفحات فقط، بل بثلاثة عوامل: حجم المحتوى الذي يجب كتابته وتصويره، عدد الوظائف التفاعلية (حجز، سلة، دفع، لوحة تحكم)، ومستوى التخصيص البصري المطلوب. موقع من 5 صفحات بمحتوى جاهز أرخص بكثير من موقع من 5 صفحات نكتب له المحتوى ونصوّر المنتجات.",
          "العامل الثاني هو التقنية: قالب جاهز معدّل يبدأ من 150 دولاراً، لكنه يبقى بطيئاً ومقيداً؛ بينما الموقع المبني على Next.js مع تحسين SEO وسرعة 90+ يكلّف أكثر في البداية وأقل بكثير على المدى الطويل (لا تحديثات أمنية شهرية، ولا إضافات مدفوعة).",
        ],
        paragraphsEn: [
          "Price is not driven by page count alone but by three factors: how much content must be written and photographed, how many interactive features are needed (booking, cart, payments, admin panel), and how much visual customisation is required. A five-page site with ready content costs far less than the same five pages where we write the copy and shoot the products.",
          "The second factor is technology: a modified off-the-shelf template starts at $150, but stays slow and constrained; a Next.js build with technical SEO and 90+ speed costs more upfront and much less over time (no monthly security patches, no paid plugins).",
        ],
        bulletsAr: [
          "محتوى جاهز (نصوص + صور) = أرخص وأسرع",
          "حجز، سلة، دفع، لوحة تحكم = كل وظيفة تضيف 100–200 $",
          "تصميم فريد من الصفر = أغلى من تعديل قالب، لكنه يبني علامة",
          "الاستضافة والدومين للسنة الأولى: عادةً مشمولة",
        ],
        bulletsEn: [
          "Ready content (copy + photos) = cheaper and faster",
          "Booking, cart, payments, admin panel = each feature adds $100–200",
          "Unique design from scratch = pricier than a template, but builds a brand",
          "Hosting and domain for year one: usually included",
        ],
        calloutAr:
          "قاعدة عملية: كل وظيفة تفاعلية جديدة تضيف ما بين 100 و200 دولار. اكتب قائمة الوظائف قبل طلب السعر، لا بعد التصميم.",
        calloutEn:
          "Practical rule: every new interactive feature adds $100–200. Write your feature list before requesting a quote, not after design starts.",
      },
      {
        id: "trois-niveaux",
        headingAr: "ثلاث فئات من المواقع… وثلاث ميزانيات",
        headingEn: "Three Website Tiers, Three Budgets",
        paragraphsAr: [
          "الفئة الأولى — الواجهة: 5 صفحات مصممة على هويتك، نموذج تواصل مربوط بواتساب، تحسين SEO أساسي وتسليم في 7 أيام. مناسبة للشركات التي تحتاج حضوراً مهنياً سريعاً.",
          "الفئة الثانية — الواجهة بلس: حتى 10 صفحات مع مدونة وحجز مواعيد أو طاولات، ربط Google Maps وAnalytics، لغتين (عربي/إنجليزي)، سرعة 90+ وتسليم في 10 أيام.",
          "الفئة الثالثة — المتجر أو نظام الحجز: منتجات أو خدمات غير محدودة، سلة، دفع عند الاستلام أو تحويل، لوحة تحكم، إشعارات واتساب تلقائية وSEO متقدم — تسليم 14 إلى 21 يوماً.",
        ],
        paragraphsEn: [
          "Tier one — Vitrine: five pages designed around your brand, a contact form wired to WhatsApp, essential SEO and seven-day delivery. Right for businesses that need a professional presence fast.",
          "Tier two — Vitrine+: up to ten pages with a blog and booking or table reservations, Google Maps and Analytics, bilingual (Arabic/English), 90+ speed and ten-day delivery.",
          "Tier three — Store or booking system: unlimited products or services, cart, cash-on-delivery or transfer, admin panel, automatic WhatsApp notifications and advanced SEO — delivered in 14 to 21 days.",
        ],
        calloutAr:
          "لا تدفع مقابل الفئة الثالثة إن كنت تبيع أقل من 20 منتجاً شهرياً وعبر واتساب فقط: الفئة الثانية + كتالوج PDF غالباً كافية.",
        calloutEn:
          "Do not pay for tier three if you sell fewer than 20 items a month and only via WhatsApp: tier two plus a PDF catalogue is usually enough.",
      },
      {
        id: "couts-caches",
        headingAr: "التكاليف الخفية التي يجب أن تسأل عنها",
        headingEn: "Hidden Costs You Must Ask About",
        paragraphsAr: [
          "أغلب المفاجآت تأتي بعد التسليم: تجديد الاستضافة، شهادة SSL، نسخ احتياطي، تحديثات أمنية، تعديلات بسيطة، أو نقل الموقع إلى مستضيف آخر. اطلب كتابياً قائمة ما سيُدفع سنوياً قبل توقيع العرض، ومن يملك الدومين والاستضافة باسم من.",
          "في نخبة، الاستضافة للسنة الأولى مشمولة، والدومين يُسجَّل باسم العميل، والملفات المصدرية تُسلَّم كاملة — لا احتكار تقني.",
        ],
        paragraphsEn: [
          "Most surprises arrive after delivery: hosting renewal, SSL certificate, backups, security updates, small edits, or migrating the site to another host. Ask in writing for the annual cost list before signing, and clarify who owns the domain and the hosting account.",
          "At Nukhba, first-year hosting is included, the domain is registered in the client's name, and all source files are handed over — no technical lock-in.",
        ],
        bulletsAr: [
          "من يملك حساب الاستضافة والدومين؟ يجب أن يكون باسمك",
          "هل التعديلات بعد التسليم مدفوعة؟ وما سعرها؟",
          "هل تُسلَّم الملفات المصدرية والوصول الكامل؟",
          "ما تكلفة التجديد السنوي بالدولار؟",
        ],
        bulletsEn: [
          "Who owns the hosting and domain accounts? It must be your name",
          "Are post-delivery edits paid? At what rate?",
          "Are source files and full access handed over?",
          "What is the annual renewal cost in USD?",
        ],
      },
      {
        id: "comment-economiser",
        headingAr: "أربع طرق لتخفيض الفاتورة دون خفض الجودة",
        headingEn: "Four Ways to Cut the Bill Without Cutting Quality",
        paragraphsAr: [
          "أولاً: جهّز المحتوى بنفسك (نصوص، صور، شعار) — يوفّر 15 إلى 25% من التكلفة. ثانياً: ابدأ بالفئة الأولى وأضف الوظائف لاحقاً عبر خدمة «إضافة قسم» بدل بناء كل شيء مرة واحدة. ثالثاً: احسم القرارات مبكراً؛ كل جولة مراجعة إضافية تستهلك وقتاً مدفوعاً. رابعاً: استفد من الدفع على دفعتين أو ثلاث عبر العملات الرقمية إن كان السيولة مؤجلة.",
        ],
        paragraphsEn: [
          "First: prepare your own content (copy, photos, logo) — it saves 15–25% of the cost. Second: start with tier one and add features later through the add-a-section service instead of building everything at once. Third: decide early; every extra revision round consumes paid time. Fourth: use two- or three-instalment crypto payment if cash flow is deferred.",
        ],
        calloutAr:
          "أرخص مشروع هو الذي تُحسم قراراته قبل بدء التصميم. أغلى مشروع هو الذي يُعاد تصميمه مرتين.",
        calloutEn:
          "The cheapest project is the one whose decisions are settled before design starts. The most expensive is the one redesigned twice.",
      },
    ],
    faqs: [
      {
        qAr: "هل الأسعار ثابتة أم قابلة للتفاوض؟",
        qEn: "Are these prices fixed or negotiable?",
        aAr: "الأسعار المعلنة هي نقطة البداية لنطاق محدد بوضوح. أي إضافة (صفحات، وظائف، محتوى) تُسعَّر كتابياً قبل البدء، والسعر النهائي لا يتغير بعد الموافقة.",
        aEn: "Published prices are the starting point for a clearly defined scope. Any addition (pages, features, content) is quoted in writing before work starts, and the final price never changes after approval.",
      },
      {
        qAr: "هل يجب دفع المبلغ كاملاً مقدماً؟",
        qEn: "Do I have to pay the full amount upfront?",
        aAr: "لا — دفعة مقدمة 50% للبدء والباقي عند التسليم. يمكن أيضاً التقسيم على ثلاث دفعات عبر NOWPayments، أو حجز أولوية بـ 1 دولار يُخصم من السعر النهائي.",
        aEn: "No — a 50% deposit to start and the balance on delivery. You can also split into three instalments via NOWPayments, or book priority for $1 deducted from the final price.",
      },
      {
        qAr: "ماذا لو احتجت تعديلات بعد التسليم؟",
        qEn: "What if I need changes after delivery?",
        aAr: "التعديلات البسيطة على النصوص والصور مجانية خلال 14 يوماً بعد التسليم. التعديلات الهيكلية لاحقاً تُسعَّر من 15 دولاراً حسب الخدمة المطلوبة.",
        aEn: "Minor text and image edits are free for 14 days after delivery. Later structural changes are quoted from $15 depending on the service needed.",
      },
      {
        qAr: "هل يوجد أرخص من ذلك في السوق الليبي؟",
        qEn: "Is there anything cheaper on the market?",
        aAr: "نعم، قوالب جاهزة من 100 إلى 150 دولاراً، لكنها غالباً بطيئة، غير محسّنة لمحركات البحث، وبدون دعم أو لوحة تحكم. احسب تكلفة إعادة بنائها بعد سنة قبل المقارنة.",
        aEn: "Yes, ready-made templates from $100–150, but they are usually slow, not search-optimised, and come without support or an admin panel. Count the cost of rebuilding in a year before comparing.",
      },
    ],
    includePricing: true,
    relatedServices: ["restyle", "landing"],
    relatedSectors: ["hardware", "stationery"],
  },

  /* ────────────────────── 2. Choisir une agence ────────────────────── */
  {
    slug: "choose-web-agency-tripoli",
    titleAr: "كيف تختار أفضل شركة تصميم مواقع؟ 7 معايير عملية قبل التعاقد",
    titleEn: "How to Choose a Web Design Agency: 7 Practical Criteria",
    h1Ar: "كيف تختار شركة تصميم مواقع تثق بها؟",
    h1En: "How to Choose a Web Design Agency You Can Trust",
    descriptionAr:
      "سبعة معايير لحسم الاختيار بين وكالات تصميم المواقع أينما كانت: أعمال حية لا صور، ملكية الدومين، السرعة، عقد واضح، دعم بعد التسليم، وشفافية الأسعار.",
    descriptionEn:
      "Seven criteria to pick a web design agency anywhere: live work over screenshots, domain ownership, speed, a clear contract, after-delivery support and transparent pricing.",
    excerptAr:
      "معايير قابلة للفحص في مكالمة واحدة — تفرّق بين وكالة تبني لك أصلاً رقمياً ووكالة تبيع لك قالباً.",
    excerptEn:
      "Criteria you can check in a single call — they separate an agency building you a digital asset from one selling you a template.",
    answerAr:
      "أفضل شركة تصميم مواقع هي التي تُظهر أعمالاً حية قابلة للتصفح (لا صور فقط)، تُسلّم ملكية الدومين والاستضافة والملفات لك، وتُقدّم سعراً مكتوباً بنطاق محدد ودعم بعد التسليم. اسأل عن هذه النقاط الأربع في أول مكالمة: الأغلبية تتضح خلال عشر دقائق.",
    answerEn:
      "The best web design agency is the one that shows live, browsable work (not just screenshots), hands you ownership of the domain, hosting and source files, and provides a written quote with a defined scope plus after-delivery support. Ask these four points in the first call: most of the answer becomes clear within ten minutes.",
    categoryAr: "اختيار الشريك",
    categoryEn: "Choosing a Partner",
    publishedAt: "2026-10-20",
    updatedAt: "2026-10-20",
    readingMinutes: 6,
    authorAr: "فريق نخبة",
    authorEn: "Nukhba team",
    keywordsAr: [
      "أفضل شركة تصميم مواقع طرابلس",
      "اختيار وكالة ويب ليبيا",
      "وكالة تصميم مواقع موثوقة",
      "شركة برمجة مواقع طرابلس",
    ],
    keywordsEn: [
      "best web design agency Tripoli",
      "how to choose web agency Libya",
      "trusted web design company",
      "web development company Tripoli",
    ],
    keyFacts: [
      { labelAr: "أعمال حية يمكن تجربتها", labelEn: "Live, testable work", valueAr: "12 موقعاً", valueEn: "12 live sites" },
      { labelAr: "ملكية الدومين", labelEn: "Domain ownership", valueAr: "باسم العميل", valueEn: "Client's name" },
      { labelAr: "مدة أول رد", labelEn: "First reply time", valueAr: "≤ ساعتين", valueEn: "≤ 2 hours" },
      { labelAr: "دعم بعد التسليم", labelEn: "After-delivery support", valueAr: "30 – 90 يوماً", valueEn: "30 – 90 days" },
    ],
    sections: [
      {
        id: "travaux-live",
        headingAr: "1. اطلب أعمالاً حية… لا صور شاشة",
        headingEn: "1. Ask for Live Work, Not Screenshots",
        paragraphsAr: [
          "أي وكالة تستطيع عرض صور جميلة. الفرق يظهر عندما تفتح الموقع على هاتفك وتجرّبه: هل يفتح في أقل من ثلاث ثوانٍ؟ هل يعمل النموذج فعلاً؟ هل الحجز يصل إلى واتساب؟ اطلب رابطين أو ثلاثة وافتحها بنفسك على شبكة عادية.",
          "اسأل أيضاً: من صمم هذا الموقع بالضبط، وهل يمكنني التحدث إلى صاحب النشاط؟ الوكالة الجدية لا تمانع في ذلك.",
        ],
        paragraphsEn: [
          "Any agency can show pretty pictures. The difference appears when you open the site on your phone and use it: does it load in under three seconds? Does the form actually work? Does the booking reach WhatsApp? Ask for two or three links and open them yourself on a normal connection.",
          "Also ask: who exactly designed this site, and can I speak to the business owner? A serious agency has no problem with that.",
        ],
        calloutAr: "قاعدة: إذا لم تستطع تجربة العمل بنفسك، فهو ليس عملاً حياً.",
        calloutEn: "Rule: if you cannot try the work yourself, it is not live work.",
      },
      {
        id: "propriete",
        headingAr: "2. من يملك الدومين والاستضافة والملفات؟",
        headingEn: "2. Who Owns the Domain, Hosting and Files?",
        paragraphsAr: [
          "أكبر مشكلة نراها في السوق الليبي: عميل يكتشف بعد سنتين أن الدومين مسجل باسم الوكالة، أو أن لوحة التحكم محجوزة. عندها يصبح تغيير المزوّد مستحيلاً إلا بدفع فدية تقنية.",
          "اشترط كتابياً: الدومين باسمك، والاستضافة باسمك، والملفات المصدرية تُسلَّم عند اكتمال الدفع، والوصول الكامل (FTP/لوحة التحكم/Git) يبقى معك.",
        ],
        paragraphsEn: [
          "The biggest problem we see again and again: a client discovers two years later that the domain is registered to the agency, or the admin panel is withheld. Changing providers then becomes impossible without paying a technical ransom.",
          "Require in writing: domain in your name, hosting in your name, source files handed over once payment completes, and full access (FTP/control panel/Git) kept with you.",
        ],
        bulletsAr: [
          "الدومين باسم العميل — تحقق من WHOIS قبل الدفع",
          "الاستضافة أو حساب Vercel باسم العميل",
          "الملفات المصدرية تُسلَّم كاملة",
          "حق المغادرة: تصدير المحتوى في أي وقت",
        ],
        bulletsEn: [
          "Domain in the client's name — check WHOIS before paying",
          "Hosting or Vercel account in the client's name",
          "Source files handed over completely",
          "Right to leave: export content whenever you want",
        ],
        calloutAr: "إذا رفضت الوكالة وضع الدومين باسمك، ابحث عن غيرها. هذه إشارة تحذير كافية.",
        calloutEn: "If the agency refuses to put the domain in your name, look elsewhere. That warning sign is enough.",
      },
      {
        id: "vitesse-seo",
        headingAr: "3. السرعة وSEO: اختبرهما بنفسك",
        headingEn: "3. Speed and SEO: Test Them Yourself",
        paragraphsAr: [
          "افتح PageSpeed Insights من جوجل واختبر موقعاً من أعمال الوكالة على الهاتف. نتيجة أقل من 70 تعني أن الوكالة تبيع تصميماً لا أداءً، وأنك ستدفع ثمن ذلك في ترتيب جوجل وفي مبيعاتك.",
          "اسأل عن البيانات المنظمة (Schema.org)، وخريطة الموقع، وخطة الظهور في محركات الذكاء الاصطناعي (ChatGPT، Perplexity، Google AI). في 2026، موقع غير مُهيّأ للـ GEO يفقد جزءاً من العملاء قبل أن يبدأ.",
        ],
        paragraphsEn: [
          "Open Google PageSpeed Insights and test one of the agency's sites on mobile. A score below 70 means the agency sells design, not performance — and you will pay for it in Google rankings and sales.",
          "Ask about structured data (Schema.org), the sitemap, and a plan for visibility in AI engines (ChatGPT, Perplexity, Google AI). In 2026 a site not prepared for GEO loses part of its customers before it starts.",
        ],
      },
      {
        id: "contrat",
        headingAr: "4. عقد مكتوب بنطاق واضح",
        headingEn: "4. A Written Contract With a Clear Scope",
        paragraphsAr: [
          "العرض الشفهي ليس عقداً. اطلب ورقة تحدد: عدد الصفحات، الوظائف، عدد جولات المراجعة، تاريخ التسليم، ما يحدث عند التأخير، وسعر أي إضافة خارج النطاق. الشرط الأخير هو الذي يمنع المفاجآت.",
        ],
        paragraphsEn: [
          "A verbal quote is not a contract. Ask for a document stating: page count, features, number of revision rounds, delivery date, what happens on delay, and the price of any addition outside scope. That last clause is what prevents surprises.",
        ],
        bulletsAr: [
          "نطاق محدد + عدد جولات المراجعة",
          "تاريخ تسليم مرتبط بدفع الدفعة الأولى",
          "سعر الإضافات مكتوب مسبقاً",
          "شروط الملكية والدعم بعد التسليم",
        ],
        bulletsEn: [
          "Defined scope + number of revision rounds",
          "Delivery date tied to the first payment",
          "Pre-agreed price for additions",
          "Ownership and after-delivery support terms",
        ],
      },
      {
        id: "support",
        headingAr: "5. الدعم بعد التسليم هو الاختبار الحقيقي",
        headingEn: "5. After-Delivery Support Is the Real Test",
        paragraphsAr: [
          "الموقع ليس منتجاً يُسلَّم مرة واحدة. اسأل: من يرد إن تعطّل النموذج يوم الجمعة؟ كم يوماً من الدعم مشمولة؟ هل هناك تكلفة سنوية للتحديثات؟ الوكالة التي تختفي بعد التسليم تكلّفك أضعاف ما وفّرته.",
          "في نخبة، الدعم يتراوح بين 30 و90 يوماً حسب الفئة، وكل موقع يأتي مع شرح فيديو لتعديل النصوص بنفسك — لا تعتمد على أحد لتغيير سطر.",
        ],
        paragraphsEn: [
          "A website is not a one-off delivery. Ask: who answers if the form breaks on Friday? How many support days are included? Is there an annual update cost? An agency that disappears after delivery costs you several times what you saved.",
          "At Nukhba support runs 30 to 90 days depending on tier, and every site ships with a video walkthrough so you can edit text yourself — never depend on someone to change a line.",
        ],
      },
    ],
    faqs: [
      {
        qAr: "هل أعمال الوكالة تكفي للحكم عليها؟",
        qEn: "Are an agency's past projects enough to judge it?",
        aAr: "الأعمال الحية ضرورية لكن غير كافية: اطلب التحدث إلى عميل واحد على الأقل، واختبر موقعين على الهاتف بنفسك، واسأل عن سبب اختيار التقنية المستخدمة.",
        aEn: "Live work is necessary but not sufficient: ask to speak to at least one client, test two sites on your phone yourself, and ask why the specific technology was chosen.",
      },
      {
        qAr: "هل السعر الأعلى يعني جودة أعلى؟",
        qEn: "Does a higher price mean better quality?",
        aAr: "ليس دائماً. السعر المنخفض جداً يعني غالباً قالباً جاهزاً بلا دعم، والسعر المرتفع جداً قد يدفع مقابل مظاهر. المعيار هو ما هو مكتوب في العرض: نطاق، ملكية، سرعة، دعم.",
        aEn: "Not always. A very low price usually means a template with no support, and a very high price may pay for appearances. What matters is what the proposal states: scope, ownership, speed, support.",
      },
      {
        qAr: "هل يمكن العمل مع وكالة عن بُعد وأنا في بلد آخر؟",
        qEn: "Can I work with an agency remotely from another country?",
        aAr: "نعم — العمل عن بُعد هو الوضع الطبيعي لدينا مع عملاء من بلدان مختلفة: اجتماعات فيديو، معاينات حية، تسليم أونلاين، ودفع بالدولار عبر USDT أو تحويل بنكي. المهم هو وضوح العقد وملكية الأصول، لا مكان الوكالة.",
        aEn: "Yes — remote work is our norm with clients in several countries: video calls, live previews, online delivery, and payment in USD via USDT or bank transfer. What matters is a clear contract and asset ownership, not the agency's location.",
      },
    ],
    relatedServices: ["restyle", "branding"],
    relatedSectors: ["medical", "restaurant"],
  },

  /* ─────────────────────── 3. Boutique en ligne ─────────────────────── */
  {
    slug: "launch-online-store-libya",
    titleAr: "كيف تطلق متجراً إلكترونياً في 2026؟ دليل عملي خطوة بخطوة",
    titleEn: "How to Launch an Online Store in 2026: Practical Step-by-Step",
    h1Ar: "كيف تطلق متجراً إلكترونياً يبيع فعلاً؟",
    h1En: "How to Launch an Online Store That Actually Sells",
    descriptionAr:
      "دليل عملي لإطلاق متجر إلكتروني: الدفع بالكريبتو وعند الاستلام، الطلب عبر واتساب، التوصيل، التصوير، والتكلفة من 880 $ — مع أخطاء شائعة يجب تجنبها.",
    descriptionEn:
      "A practical guide to launching an online store: crypto and cash-on-delivery payments, WhatsApp ordering, shipping, product photography and costs from $880.",
    excerptAr:
      "من اختيار المنتجات إلى أول 100 طلب: البنية التي تعمل فعلاً في السوق الليبي، بأرقام وتكاليف واقعية.",
    excerptEn:
      "From picking products to your first 100 orders: the setup that actually works today, with realistic numbers and USD costs.",
    answerAr:
      "إطلاق متجر إلكتروني يبدأ باختيار 20 إلى 50 منتجاً سريع الدوران، ثم بناء متجر بـ 880 دولاراً يشمل السلة والدفع عند الاستلام وربط واتساب ولوحة تحكم، خلال 14 إلى 21 يوماً. النقطة الحاسمة ليست التصميم بل الثقة: صور واضحة، سعر شامل للتوصيل، وسياسة إرجاع مكتوبة.",
    answerEn:
      "Launching an online store starts with 20 to 50 fast-moving products, then building a store for $880 including cart, cash-on-delivery, WhatsApp ordering and an admin panel, in 14 to 21 days. The decisive factor is not design but trust: clear photos, a price that includes delivery, and a written return policy.",
    categoryAr: "تجارة إلكترونية",
    categoryEn: "E-commerce",
    publishedAt: "2026-10-20",
    updatedAt: "2026-10-20",
    readingMinutes: 8,
    authorAr: "فريق نخبة",
    authorEn: "Nukhba team",
    keywordsAr: [
      "إنشاء متجر إلكتروني ليبيا",
      "متجر أونلاين طرابلس",
      "الدفع عند الاستلام ليبيا",
      "تكلفة متجر إلكتروني",
    ],
    keywordsEn: [
      "create online store Libya",
      "e-commerce Tripoli",
      "cash on delivery Libya",
      "e-commerce website cost",
    ],
    keyFacts: [
      { labelAr: "تكلفة المتجر الكامل", labelEn: "Full store cost", valueAr: "$880 = 880 USDT", valueEn: "$880 = 880 USDT" },
      { labelAr: "عدد المنتجات للانطلاق", labelEn: "Products to start", valueAr: "20 – 50 منتجاً", valueEn: "20 – 50 products" },
      { labelAr: "نسبة الإرجاع المتوقعة", labelEn: "Expected return rate", valueAr: "10 – 20%", valueEn: "10 – 20%" },
      { labelAr: "مدة البناء", labelEn: "Build time", valueAr: "14 – 21 يوماً", valueEn: "14 – 21 days" },
    ],
    sections: [
      {
        id: "pourquoi-maintenant",
        headingAr: "لماذا 2026 هو وقت مناسب؟",
        headingEn: "Why 2026 Is the Right Moment",
        paragraphsAr: [
          "الشراء عبر الهاتف أصبح سلوكاً يومياً في كل مكان، لكن كثيراً من المتاجر ما زالت تعمل بصفحات إنستغرام فقط: لا سلة، لا مخزون، ولا أرشيف للطلبات. المتجر الإلكتروني يمنحك ثلاثة أشياء لا يعطيها إنستغرام: بحث وفلاتر، حفظ للسلة، وتقارير بما يُباع فعلاً.",
          "الأهم: الظهور في جوجل. صفحة منتج واحدة قد تجلب طلبات لسنوات، بينما منشور إنستغرام يختفي بعد 48 ساعة.",
        ],
        paragraphsEn: [
          "Buying on mobile is a daily habit everywhere, yet many stores still run on Instagram pages only: no cart, no stock, no order history. An online store gives you three things Instagram does not: search and filters, a saved cart, and reporting on what actually sells.",
          "Most importantly: Google visibility. A single product page can bring orders for years, while an Instagram post disappears in 48 hours.",
        ],
      },
      {
        id: "produits",
        headingAr: "1. ابدأ بمنتجات قليلة وسريعة الدوران",
        headingEn: "1. Start With Few, Fast-Moving Products",
        paragraphsAr: [
          "الخطأ الأول للمبتدئين: رفع 300 منتج قبل أول عميل. ابدأ بـ 20 إلى 50 منتجاً تُبيعها فعلاً في متجرك أو عبر واتساب، حتى تعرف أيها يتحرك بسرعة. كل منتج يحتاج صورة نظيفة، وصفاً من 3 إلى 5 أسطر، وسعراً واضحاً يشمل التوصيل أو يوضحه.",
          "إن كان لديك متجر تقليدي، فالمتجر الإلكتروني ليس بديلاً بل طبقة إضافية: نفس المخزون، قناة بيع جديدة، وعنوان إنترنت تحيل إليه عملاءك الحاليين.",
        ],
        paragraphsEn: [
          "The first beginner mistake: uploading 300 products before the first customer. Start with 20 to 50 products you actually sell in-store or via WhatsApp, so you learn which ones move. Each product needs a clean photo, a three-to-five-line description, and a clear price that either includes delivery or states it.",
          "If you already have a physical shop, the online store is not a replacement but an extra layer: same stock, a new sales channel, and an internet address you can point existing customers to.",
        ],
        calloutAr: "قاعدة الـ 20: لا ترفع منتجاً واحداً قبل أن تجهّز له صورة ووصفاً وسعراً كاملاً.",
        calloutEn: "The rule of 20: never upload a product before it has a finished photo, description and price.",
      },
      {
        id: "paiement-livraison",
        headingAr: "2. الدفع والتوصيل: واقع السوق الليبي",
        headingEn: "2. Payment and Shipping: What Works Today",
        paragraphsAr: [
          "نوّع خيارات الدفع حسب عملائك: العملات الرقمية (USDT) للعملاء الدوليين ومن يفضّل الدفع المسبق، والدفع عند الاستلام أو التحويل حيث يناسب سوقك. القاعدة: كلما قلّ الاحتكاك عند الدفع زادت الطلبات المكتملة.",
          "للتوصيل: حدد مناطق واضحة (مدينتك، مدن قريبة، دولي…) وسعراً لكل منطقة، وموعداً متوقعاً. الشفافية هنا تقلل الإرجاع أكثر من أي خصم.",
        ],
        paragraphsEn: [
          "Match payment options to your customers: crypto (USDT) for international buyers and anyone who prefers paying upfront, plus cash-on-delivery or transfer where your market expects it. The rule: the less friction at checkout, the more completed orders.",
          "For shipping: define clear zones (your city, nearby cities, international…) with a price per zone and an expected date. This transparency reduces returns more than any discount.",
        ],
        bulletsAr: [
          "الدفع عند الاستلام: الخيار الأول دائماً",
          "تحويل بنكي/محفظة: للطلبات الكبيرة",
          "عملات رقمية (USDT): للعملاء الدوليين والدفع المسبق الآمن",
          "سعر توصيل واضح لكل منطقة قبل إتمام الطلب",
        ],
        bulletsEn: [
          "Cash on delivery: always the primary option",
          "Bank/wallet transfer: for larger orders",
          "Crypto: for customers abroad or preferring privacy",
          "Clear shipping price per zone before checkout completes",
        ],
      },
      {
        id: "whatsapp",
        headingAr: "3. واتساب ليس بديلاً عن المتجر — بل قناة إنقاذ",
        headingEn: "3. WhatsApp Is Not a Store Replacement — It Is a Rescue Channel",
        paragraphsAr: [
          "40 إلى 60% من الزوار لن يكملوا الطلب مهما كان التصميم. وجود زر «أكمل على واتساب» مع تفاصيل السلة يلتقط جزءاً من هؤلاء، ويحوّل التردد إلى محادثة بشرية.",
          "الأفضل: سلة كاملة + زر واتساب يرسل الطلب منسقاً (المنتجات، الكمية، العنوان). هكذا لا تعيد كتابة الطلبات يدوياً.",
        ],
        paragraphsEn: [
          "40 to 60% of visitors will not complete checkout regardless of design. An 'Continue on WhatsApp' button carrying the cart details catches part of them and turns hesitation into a human conversation.",
          "Best practice: a full cart plus a WhatsApp button that sends a formatted order (items, quantity, address). That way you never retype orders manually.",
        ],
      },
      {
        id: "apres-lancement",
        headingAr: "4. أول 90 يوماً بعد الإطلاق",
        headingEn: "4. The First 90 Days After Launch",
        paragraphsAr: [
          "أول شهر: راقب أي المنتجات تُشاهد ولا تُشترى (مشكلة سعر أو صورة)، وأيها تُشترى وتُرجَع (مشكلة وصف). ثاني شهر: أضف تقييمات العملاء — صفحة منتج فيها 12 تقييماً تبيع أضعاف صفحة بلا تقييمات. ثالث شهر: ابدأ SEO حقيقياً عبر صفحات تصنيف مكتوبة جيداً ومدونة تجيب عن أسئلة الشراء.",
          "استثمر في التصوير أكثر من الإعلانات: صورة سيئة تُفسد أفضل منتج، وصورة جيدة تبيع منتجاً عادياً.",
        ],
        paragraphsEn: [
          "Month one: watch which products get viewed but not bought (price or photo problem) and which get bought then returned (description problem). Month two: add customer reviews — a product page with 12 reviews outsells one with none. Month three: start real SEO through well-written category pages and a blog answering buying questions.",
          "Invest in photography more than ads: a bad photo ruins the best product, a good photo sells an ordinary one.",
        ],
        calloutAr: "لا تبدأ بالإعلانات المدفوعة قبل أن يتحول 1 من كل 50 زائراً إلى طلب. الإعلان يضخّ زواراً، لا يحلّ مشكلة منتج أو صفحة.",
        calloutEn: "Do not start paid ads before 1 in 50 visitors converts. Advertising pumps traffic; it does not fix a product or a page.",
      },
    ],
    faqs: [
      {
        qAr: "كم أحتاج من المال لإطلاق متجر؟",
        qEn: "How much money do I need to launch a store?",
        aAr: "المتجر الكامل يبدأ من 880 دولاراً. أضف ميزانية تصوير 100–200 دولار، ومخزوناً أولياً، وميزانية إعلانات تجريبية 100 دولار للشهر الأول.",
        aEn: "A full store starts at $880. Add a $100–200 photography budget, initial stock, and a $100 test-ads budget for month one.",
      },
      {
        qAr: "هل أحتاج شركة شحن أم أوصّل بنفسي؟",
        qEn: "Do I need a shipping company or deliver myself?",
        aAr: "ابدأ بنفسك داخل مدينتك، وأضف شركة شحن للمدن الأخرى بعد أول 30 طلباً. كثير من المتاجر الليبية تتعامل مع شركتين حسب المنطقة.",
        aEn: "Start delivering yourself inside your city and add a shipping company for other cities after the first 30 orders. Many stores work with two companies by zone.",
      },
      {
        qAr: "هل يمكن ربط المتجر بإنستغرام؟",
        qEn: "Can the store be connected to Instagram?",
        aAr: "نعم — نضيف روابط المنتجات في الوصف، ونضع واتساب للاستفسار، ويمكن إضافة كتالوج Meta للأعمال لاحقاً. المتجر يبقى المصدر الرسمي للسعر والمخزون.",
        aEn: "Yes — we add product links in your bio, WhatsApp for enquiries, and a Meta business catalogue can follow later. The store remains the official source of price and stock.",
      },
      {
        qAr: "ماذا عن الحماية القانونية والخصوصية؟",
        qEn: "What about legal protection and privacy?",
        aAr: "نضيف صفحات السياسة والخصوصية وشروط الإرجاع، ونحمي النماذج بـ CSRF وحد للطلبات، ولا نخزّن بيانات بطاقات لأننا لا نتعامل معها أصلاً.",
        aEn: "We add policy, privacy and returns pages, protect forms with CSRF and rate limiting, and never store card data because we never handle it.",
      },
    ],
    relatedServices: ["landing", "add-section"],
    relatedSectors: ["beauty", "stationery"],
  },

  /* ──────────────────── 4. Visibilité dans les IA (GEO) ──────────────────── */
  {
    slug: "get-cited-by-chatgpt-google-ai",
    titleAr: "كيف يظهر موقعك في ChatGPT وGoogle AI؟ دليل GEO العملي 2026",
    titleEn: "Get Your Website Cited by ChatGPT & Google AI: 2026 GEO Guide",
    h1Ar: "كيف يظهر موقعك في ChatGPT وGoogle AI؟",
    h1En: "How to Get Your Site Cited by ChatGPT and Google AI",
    descriptionAr:
      "دليل عملي للظهور في محركات الذكاء الاصطناعي: بيانات منظمة، llms.txt، إجابات مباشرة، مراجعات، واستشهادات — خطوات قابلة للقياس لأي شركة في 2026.",
    descriptionEn:
      "A practical guide to AI search visibility: structured data, llms.txt, answer-first content, reviews and citations — measurable steps for any business in 2026.",
    excerptAr:
      "لماذا تذكر ChatGPT منافسك ولا تذكرك؟ وما الخطوات التقنية والتحريرية التي تغيّر ذلك خلال أسابيع.",
    excerptEn:
      "Why does ChatGPT name your competitor and not you? And which technical and editorial steps change that within weeks.",
    answerAr:
      "الظهور في محركات الذكاء الاصطناعي (GEO) يعتمد على أربعة عناصر: بيانات منظمة تفهمها الآلة (Schema.org)، ملف llms.txt يلخّص نشاطك وأسعارك، محتوى يجيب على الأسئلة بصيغة مباشرة، وإشارات ثقة خارجية (مراجعات، أدلة، استشهادات). الشركات التي تنفّذها تبدأ بالظهور في إجابات ChatGPT وPerplexity وGoogle AI خلال 4 إلى 12 أسبوعاً.",
    answerEn:
      "AI search visibility (GEO) rests on four elements: structured data machines can read (Schema.org), an llms.txt file summarising your business and prices, content that answers questions directly, and external trust signals (reviews, directories, citations). Businesses that implement them start appearing in ChatGPT, Perplexity and Google AI answers within 4 to 12 weeks.",
    categoryAr: "الذكاء الاصطناعي وSEO",
    categoryEn: "AI & SEO",
    publishedAt: "2026-10-20",
    updatedAt: "2026-10-20",
    readingMinutes: 7,
    authorAr: "فريق نخبة",
    authorEn: "Nukhba team",
    keywordsAr: [
      "الظهور في ChatGPT",
      "تحسين محركات البحث بالذكاء الاصطناعي",
      "GEO ليبيا",
      "llms.txt شرح",
      "Google AI Overviews",
    ],
    keywordsEn: [
      "appear in ChatGPT answers",
      "AI search optimization",
      "GEO Libya",
      "llms.txt explained",
      "Google AI Overviews",
    ],
    keyFacts: [
      { labelAr: "أول نتائج ملحوظة", labelEn: "First visible results", valueAr: "4 – 12 أسبوعاً", valueEn: "4 – 12 weeks" },
      { labelAr: "بيانات منظمة", labelEn: "Structured data", valueAr: "9 أنواع JSON-LD", valueEn: "9 JSON-LD types" },
      { labelAr: "محركات مستهدفة", labelEn: "Target engines", valueAr: "ChatGPT · Perplexity · Gemini · Copilot", valueEn: "ChatGPT · Perplexity · Gemini · Copilot" },
      { labelAr: "الملف المرجعي للـ IA", labelEn: "AI reference file", valueAr: "/llms.txt + /llms-full.txt", valueEn: "/llms.txt + /llms-full.txt" },
    ],
    sections: [
      {
        id: "comment-les-ia-choisissent",
        headingAr: "كيف تختار محركات الذكاء الاصطناعي ما تذكره؟",
        headingEn: "How Do AI Engines Choose What to Mention?",
        paragraphsAr: [
          "المحرك لا «يتصفح» مثل جوجل فقط: يبحث، يقرأ صفحات، يستخرج جملاً، ثم يجمعها في إجابة. لذلك يفوز الموقع الذي يعطي جملة واضحة قابلة للاقتباس، ورقماً محدداً، وتاريخاً حديثاً — لا الذي يكتب فقرات تسويقية طويلة.",
          "العناصر الأربعة التي ترفع احتمال الاستشهاد بك: (1) اسم النشاط ومكانه وساعات عمله بصيغة واضحة، (2) أسعارك معلنة أو «تبدأ من»، (3) أسئلة وأجوبة مطابقة لما يسأله العميل، (4) إشارات خارجية تربط اسمك بالمكان والنشاط.",
        ],
        paragraphsEn: [
          "The engine does not merely crawl like Google: it searches, reads pages, extracts sentences, and assembles an answer. The site that wins is the one providing a clear quotable sentence, a specific number and a recent date — not one with long marketing paragraphs.",
          "Four elements raise your chance of being cited: (1) your business name, location and opening hours in a clear format, (2) published prices or 'starting from', (3) questions and answers matching what customers actually ask, (4) external signals linking your name to the place and the trade.",
        ],
        calloutAr: "اكتب كأنك تجيب على سؤال هاتفي: جملة أولى واضحة، ثم التفاصيل. أول جملة هي ما يُقتبس غالباً.",
        calloutEn: "Write as if answering a phone question: one clear sentence first, details after. The first sentence is what usually gets quoted.",
      },
      {
        id: "technique",
        headingAr: "1. الأساس التقني: بيانات منظمة وملف llms.txt",
        headingEn: "1. The Technical Base: Structured Data and llms.txt",
        paragraphsAr: [
          "البيانات المنظمة (JSON-LD) تخبر المحرك بما أنت: نشاطك، عنوانك، هاتفك، أسعارك، خدماتك، تقييماتك. موقع يفتقدها يبدو للمحرك صفحة نصية مجهولة الهوية.",
          "ملف llms.txt هو فهرس نصي مخصص لمحركات الذكاء الاصطناعي: من أنت، ماذا تبيع، بكم، وكيف تُذكر. أضف llms-full.txt للتفاصيل الكاملة. الملفان لا يستبدلان SEO التقليدي بل يكمّلانه.",
        ],
        paragraphsEn: [
          "Structured data (JSON-LD) tells the engine what you are: business type, address, phone, prices, services, reviews. A site missing it looks like an anonymous text page to an engine.",
          "llms.txt is a plain-text index for AI engines: who you are, what you sell, at what price, and how you should be cited. Add llms-full.txt for full detail. Neither replaces classic SEO — they complete it.",
        ],
        bulletsAr: [
          "Organization + LocalBusiness + من الخدمات والمنتجات",
          "FAQPage مطابق للأسئلة الظاهرة فعلاً على الصفحة",
          "OfferCatalog بأسعار بالدولار",
          "llms.txt وllms-full.txt محدّثان تلقائياً",
        ],
        bulletsEn: [
          "Organization + LocalBusiness + services and products",
          "FAQPage matching questions actually visible on the page",
          "OfferCatalog with USD prices",
          "llms.txt and llms-full.txt kept up to date automatically",
        ],
      },
      {
        id: "contenu",
        headingAr: "2. المحتوى الذي يُقتبس: إجابة أولاً، ثم تفصيل",
        headingEn: "2. Content That Gets Quoted: Answer First, Detail After",
        paragraphsAr: [
          "لكل صفحة مهمة، ابدأ بجملة تُجيب على السؤال مباشرة، ثم اشرح. هذا هو نمط «answer-first» الذي يعمل مع Google AI Overviews ومع ChatGPT على السواء. اكتب أرقاماً: «من 300 دولار» أفضل من «بأسعار تنافسية».",
          "أنشئ صفحة لكل خدمة ولكل قطاع ولكل سؤال متكرر. الصفحة المتخصصة تُقتبس أسرع من الصفحة العامة، وتستهدف عبارة واحدة بوضوح.",
        ],
        paragraphsEn: [
          "For every important page, start with a sentence that answers the question directly, then explain. That answer-first pattern works with both Google AI Overviews and ChatGPT. Use numbers: 'from $300' beats 'competitive prices'.",
          "Create a page for each service, each sector and each recurring question. A focused page gets cited faster than a general one and targets a single phrase clearly.",
        ],
      },
      {
        id: "confiance",
        headingAr: "3. إشارات الثقة: المراجعات والأدلة والاتساق",
        headingEn: "3. Trust Signals: Reviews, Directories, Consistency",
        paragraphsAr: [
          "المحركات تتحقق من وجودك خارج موقعك: ملف Google Business Profile، صفحات الأدلة الليبية، حسابات التواصل الاجتماعي، وذكر اسمك في مقالات أو مواقع أخرى. تطابق الاسم والعنوان والهاتف بين كل هذه المصادر شرط أساسي.",
          "اطلب من كل عميل راضٍ مراجعة على Google، واذكر عدد المراجعات والتقييم في موقعك بصيغة قابلة للقراءة الآلية. التقييم 4.9/5 مع 86 مراجعة أقوى من أي شعار «الأفضل».",
        ],
        paragraphsEn: [
          "Engines verify you exist outside your site: a Google Business Profile, directory listings in your market, social accounts, and mentions of your name in articles or other sites. Consistent name, address and phone across all sources is a prerequisite.",
          "Ask every satisfied client for a Google review, and state your review count and rating on your site in machine-readable form. A 4.9/5 with 86 reviews is stronger than any 'best agency' badge.",
        ],
        calloutAr: "اسم وعنوان وهاتف متطابقون في كل مكان — أصغر اختلاف يضعف الثقة الآلية.",
        calloutEn: "Identical name, address and phone everywhere — the smallest mismatch weakens machine trust.",
      },
      {
        id: "mesurer",
        headingAr: "4. كيف تقيس النتيجة بدل التخمين؟",
        headingEn: "4. How to Measure Instead of Guessing",
        paragraphsAr: [
          "اكتب 10 أسئلة يسألها عميلك الحقيقي (بالعربية والإنجليزية)، واسألها شهرياً في ChatGPT وPerplexity وسجّل: هل ذُكرت؟ بأي وصف؟ من ذُكر غيرك؟ التتبع المنتظم هو الفرق بين استراتيجية وخيال.",
          "راقب أيضاً زيارات الإحالة من محركات الذكاء الاصطناعي في Google Analytics، وعدد الاستفسارات التي تبدأ بـ «رأيتكم في ChatGPT».",
        ],
        paragraphsEn: [
          "Write 10 questions your real customer asks (in Arabic and English), ask them monthly in ChatGPT and Perplexity, and record: were you mentioned? With what description? Who else was named? Regular tracking is the difference between a strategy and a fantasy.",
          "Also watch AI-engine referral traffic in Google Analytics and count enquiries that start with 'I saw you on ChatGPT'.",
        ],
      },
    ],
    faqs: [
      {
        qAr: "هل GEO يستبدل SEO التقليدي؟",
        qEn: "Does GEO replace traditional SEO?",
        aAr: "لا. محركات الذكاء الاصطناعي تعتمد على نتائج البحث والزحف، لذا SEO التقليدي (سرعة، بنية، روابط) يبقى الأساس. GEO طبقة إضافية: بيانات منظمة، llms.txt، محتوى قابل للاقتباس وإشارات ثقة.",
        aEn: "No. AI engines rely on search results and crawling, so classic SEO (speed, structure, links) remains the base. GEO is an extra layer: structured data, llms.txt, quotable content and trust signals.",
      },
      {
        qAr: "كم يستغرق الظهور في إجابات ChatGPT؟",
        qEn: "How long before ChatGPT mentions me?",
        aAr: "من 4 إلى 12 أسبوعاً بعد الزحف والفهرسة، وأسرع إذا كان الموقع جديد النشاط وله مراجعات خارجية. لا توجد ضمانات: المحركات تعيد ترتيب المصادر باستمرار.",
        aEn: "Four to twelve weeks after crawling and indexing, faster with active content and external reviews. There are no guarantees: engines constantly reshuffle their sources.",
      },
      {
        qAr: "هل يجب أن أدفع لتحسين الظهور في الذكاء الاصطناعي؟",
        qEn: "Should I pay for AI visibility?",
        aAr: "الخطوات التقنية (بيانات منظمة، llms.txt، بنية الصفحات) تُنجز مرة واحدة ضمن بناء الموقع. الأهم هو الاستمرار: إضافة محتوى جديد، جمع مراجعات، وتحديث الأسعار.",
        aEn: "The technical steps (structured data, llms.txt, page structure) are done once as part of the build. The rest is ongoing: new content, collected reviews, updated prices.",
      },
    ],
    relatedServices: ["fix-optimize", "landing"],
    relatedSectors: ["medical", "hardware"],
  },

  /* ───────────────────────── 5. Site clinique ───────────────────────── */
  {
    slug: "clinic-website-booking-tripoli",
    titleAr: "موقع عيادة ناجح: حجز مواعيد أونلاين يملأ جدولك فعلاً",
    titleEn: "A Clinic Website That Works: Online Booking That Fills Your Day",
    h1Ar: "موقع عيادة: كيف يزيد الحجوزات فعلاً؟",
    h1En: "A Clinic Website: What Actually Increases Bookings",
    descriptionAr:
      "ما يحتاجه موقع العيادة الناجح: حجز 24/7، ملف الطبيب، الخدمات والأسعار، ثقة المرضى، وظهور في جوجل وخرائط — بتكلفة من 510 $ وتسليم 10 أيام.",
    descriptionEn:
      "What a successful clinic website needs: 24/7 booking, doctor profile, services and prices, patient trust, and visibility on Google and Maps — from $510, delivered in 10 days.",
    excerptAr:
      "لماذا يفقد كثير من العيادات مرضى جدداً قبل أن يصلوا إلى الهاتف — وكيف يحل الموقع هذه المشكلة.",
    excerptEn:
      "Why many clinics lose new patients before they even call — and how a website solves it.",
    answerAr:
      "موقع العيادة في طرابلس يزيد الحجوزات عندما يجيب على ثلاثة أسئلة فوراً: من الطبيب؟ ما الخدمات والأسعار؟ كيف أحجز الآن؟ الحجز الذاتي 24/7 مع تأكيد واتساب، وصفحة تعريف بالطبيب، وتقييمات مرضى ظاهرة، ترفع الحجوزات عادةً بين 20 و40% خلال ثلاثة أشهر. التكلفة تبدأ من 510 دولاراً مع تسليم في 10 أيام.",
    answerEn:
      "A clinic website in Tripoli increases bookings when it answers three questions immediately: who is the doctor? what are the services and prices? how do I book now? 24/7 self-booking with WhatsApp confirmation, a doctor profile page and visible patient reviews typically raise bookings by 20–40% within three months. Costs start at $510 with ten-day delivery.",
    categoryAr: "قطاع طبي",
    categoryEn: "Healthcare",
    publishedAt: "2026-10-20",
    updatedAt: "2026-10-20",
    readingMinutes: 6,
    authorAr: "فريق نخبة",
    authorEn: "Nukhba team",
    keywordsAr: [
      "تصميم موقع عيادة طرابلس",
      "حجز مواعيد أونلاين للأطباء",
      "موقع طبيب ليبيا",
      "تسويق عيادات ليبيا",
    ],
    keywordsEn: [
      "clinic website Tripoli",
      "online appointment booking Libya",
      "doctor website Libya",
      "clinic marketing Libya",
    ],
    keyFacts: [
      { labelAr: "تكلفة موقع العيادة", labelEn: "Clinic website cost", valueAr: "من $510 = 510 USDT", valueEn: "from $510 = 510 USDT" },
      { labelAr: "زيادة الحجوزات المتوقعة", labelEn: "Expected booking lift", valueAr: "+20% إلى +40%", valueEn: "+20% to +40%" },
      { labelAr: "الحجز متاح", labelEn: "Booking availability", valueAr: "24/7", valueEn: "24/7" },
      { labelAr: "مدة التسليم", labelEn: "Delivery", valueAr: "7 – 10 أيام", valueEn: "7 – 10 days" },
    ],
    sections: [
      {
        id: "perte-de-patients",
        headingAr: "أين يضيع المرضى اليوم؟",
        headingEn: "Where Patients Are Lost Today",
        paragraphsAr: [
          "المريض يبحث في جوجل أو يفتح إنستغرام، ويجد صفحة بلا أسعار ولا مواعيد. يتصل خارج ساعات العمل، لا يجد رداً، ثم يختار عيادة أخرى. المشكلة ليست في الطب بل في الوصول.",
          "موقع بسيط مع حجز فوري يوقف هذا النزيف: المريض يرى الأوقات المتاحة ويحجز في 30 ثانية، حتى منتصف الليل.",
        ],
        paragraphsEn: [
          "A patient searches Google or opens Instagram and finds a page with no prices and no availability. They call after hours, get no answer, then choose another clinic. The problem is not medicine — it is access.",
          "A simple site with instant booking stops that leak: the patient sees open slots and books in 30 seconds, even at midnight.",
        ],
      },
      {
        id: "ce-qui-convainc",
        headingAr: "ما الذي يقنع المريض الليبي؟",
        headingEn: "What Convinces a Libyan Patient?",
        paragraphsAr: [
          "ثلاثة عناصر تتكرر في كل حالة نجاح: تعريف واضح بالطبيب (شهاداته، تخصصه، سنوات الخبرة)، أسعار أو نطاق أسعار مفهوم، وتقييمات حقيقية بأسماء. المريض يثق بالعيادة التي لا تخفي شيئاً.",
          "أضف صوراً حقيقية للعيادة — لا صوراً من الإنترنت. غرفة استقبال نظيفة في صورة صادقة تُقنع أكثر من أي شعار.",
        ],
        paragraphsEn: [
          "Three elements recur in every successful case: a clear doctor profile (qualifications, specialty, years of experience), understandable prices or price ranges, and real named reviews. Patients trust the clinic that hides nothing.",
          "Add real photos of the clinic — not stock images. A clean waiting room in an honest photo convinces more than any slogan.",
        ],
        bulletsAr: [
          "ملف الطبيب: الشهادات والتخصص وسنوات الخبرة",
          "الخدمات مرتبة مع مدة كل جلسة",
          "أسعار أو نطاق واضح لكل خدمة",
          "تقييمات مرضى بأسماء وصور رمزية",
          "عنوان دقيق مع خريطة ومكان انتظار",
        ],
        bulletsEn: [
          "Doctor profile: qualifications, specialty, years of experience",
          "Services ordered with session duration",
          "Price or clear range per service",
          "Patient reviews with names and avatars",
          "Exact address with map and parking note",
        ],
      },
      {
        id: "reservation",
        headingAr: "الحجز: ما يعمل فعلاً في طرابلس",
        headingEn: "Booking: What Actually Works in Tripoli",
        paragraphsAr: [
          "التقويم الذاتي الكامل قد يكون مبالغة لعيادة صغيرة. النموذج الأنجح: يختار المريض نوع الاستشارة والتاريخ المفضّل، ثم يصله تأكيد عبر واتساب بعد مراجعة الاستقبال. هذا يحفظ مرونة العيادة ويمنع الحجوزات الوهمية.",
          "أضف تذكيراً قبل الموعد بـ 24 ساعة عبر واتساب — يقلل الغياب بنسبة كبيرة، وهو أهم من أي ميزة تقنية أخرى.",
        ],
        paragraphsEn: [
          "Full self-service calendars can be overkill for a small clinic. The most successful pattern: the patient picks consultation type and preferred date, then receives WhatsApp confirmation after reception review. This keeps clinic flexibility and prevents no-shows from fake bookings.",
          "Add a 24-hour WhatsApp reminder before the appointment — it cuts no-shows substantially and matters more than any other technical feature.",
        ],
        calloutAr: "تذكير واتساب قبل 24 ساعة = أعلى عائد على أي تحسين في موقع عيادة.",
        calloutEn: "A 24-hour WhatsApp reminder = the highest return of any clinic website improvement.",
      },
      {
        id: "google-maps",
        headingAr: "جوجل والخرائط: نصف العمل يحدث خارج الموقع",
        headingEn: "Google and Maps: Half the Work Happens Off-Site",
        paragraphsAr: [
          "معظم المرضى يبحثون «طبيب أسنان قريب مني» أو يفتحون الخرائط مباشرة. اربط الموقع بملف Google Business Profile كامل: صور، ساعات عمل، خدمات، وزر حجز. هذا الملف هو ما يظهر في نتائج «قريب مني».",
          "اطلب من المرضى الراضين تقييماً على جوجل، وردّ على كل تقييم — الردود تظهر للمرضى الجدد وتُقرأ من محركات الذكاء الاصطناعي أيضاً.",
        ],
        paragraphsEn: [
          "Most patients search 'dentist near me' or open Maps directly. Connect the site to a complete Google Business Profile: photos, hours, services and a booking button. That profile is what appears in 'near me' results.",
          "Ask satisfied patients for a Google review and reply to every review — replies are seen by new patients and read by AI engines too.",
        ],
      },
    ],
    faqs: [
      {
        qAr: "هل يمكن إخفاء الأسعار عن المنافسين؟",
        qEn: "Can I hide prices from competitors?",
        aAr: "يمكن عرض نطاق («من – إلى») بدل السعر الدقيق. الإخفاء الكامل يضر بالثقة: المريض يقارن غالباً بالثقة والوضوح أكثر من السعر نفسه.",
        aEn: "You can show a range ('from – to') instead of exact prices. Full concealment hurts trust: patients often compare on clarity and confidence more than on price itself.",
      },
      {
        qAr: "هل الموقع يتوافق مع خصوصية بيانات المرضى؟",
        qEn: "Does the site respect patient data privacy?",
        aAr: "نعم — نموذج الحجز يجمع الحد الأدنى (الاسم، الهاتف، نوع الاستشارة)، ونضيف صفحة خصوصية، ونمنع الفهرسة عن أي محتوى طبي حساس.",
        aEn: "Yes — the booking form collects the minimum (name, phone, consultation type), we add a privacy page, and keep any sensitive medical content out of indexing.",
      },
      {
        qAr: "هل أحتاج تطبيق جوال أيضاً؟",
        qEn: "Do I also need a mobile app?",
        aAr: "لا في البداية. موقع سريع ومتجاوب مع حجز عبر واتساب يغطي 95% من الحاجة. التطبيق يُنظر فيه بعد تجاوز عدد معين من المرضى والمواعيد.",
        aEn: "Not at first. A fast responsive site with WhatsApp booking covers 95% of the need. Consider an app only after a certain volume of patients and appointments.",
      },
    ],
    relatedServices: ["add-section", "branding"],
    relatedSectors: ["medical"],
  },
];
