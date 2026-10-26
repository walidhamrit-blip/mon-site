import type { DigitalProduct } from "@/lib/digital-types";

/**
 * Catalogue par défaut du catalogue digital.
 *
 * Ces fiches sont l'ossature de la future boutique de codes : elles
 * décrivent les plateformes les plus demandées (Steam, PlayStation, Xbox,
 * Nintendo, Roblox, Google Play, Amazon) et les abonnement (Spotify), avec
 * leurs dénominations et leurs régions.
 *
 * Elles sont insérées en base au premier accès (comme le reste du schéma)
 * et restent modifiables depuis /admin → Codes & cartes cadeaux.
 * `status: "coming_soon"` par défaut : la vitrine est en ligne, la caisse
 * arrive plus tard — c'est exactement ce que permet le périmètre retenu.
 */

const GLOBAL_DELIVERY_AR =
  "تصلك الكود مباشرة على بريدك الإلكتروني خلال دقائق من تأكيد الدفع.";
const GLOBAL_DELIVERY_EN =
  "Your code is delivered straight to your inbox within minutes of payment confirmation.";

export const defaultDigitalProducts: DigitalProduct[] = [
  {
    id: "steam-wallet",
    slug: "steam-wallet",
    kind: "gift_card",
    status: "coming_soon",
    platform: "Steam",
    color: "#1B2838",
    titleAr: "بطاقة محفظة Steam",
    titleEn: "Steam Wallet Code",
    descriptionAr:
      "شحن رصيد محفظة Steam لشراء الألعاب والإضافات وعروض Winter Sale. الكود يُرسل على بريدك مباشرة بعد تأكيد الدفع.",
    descriptionEn:
      "Top up your Steam wallet for games, DLC and seasonal sales. The code lands in your inbox as soon as payment is confirmed.",
    image: "/digital-products/steam-wallet.jpg",
    regions: ["global", "US", "EU", "TR", "SA", "AE", "EG"],
    featuresAr: [
      "يعمل على حساب Steam فوراً",
      "قابل للاستخدام على أي منطقة على حسابك",
      "لا يحتاج وسيط",
    ],
    featuresEn: [
      "Redeemable on your Steam account instantly",
      "Region-free on your account",
      "No reseller markup",
    ],
    deliveryNoteAr: GLOBAL_DELIVERY_AR,
    deliveryNoteEn: GLOBAL_DELIVERY_EN,
    denominations: [
      { id: "steam-5", label: "$5", faceValue: "5 USD", region: "global", priceUsd: 5.4, available: true },
      { id: "steam-10", label: "$10", faceValue: "10 USD", region: "global", priceUsd: 10.6, available: true },
      { id: "steam-25", label: "$25", faceValue: "25 USD", region: "global", priceUsd: 25.9, available: true },
      { id: "steam-50", label: "$50", faceValue: "50 USD", region: "global", priceUsd: 50.5, available: true },
      { id: "steam-100", label: "$100", faceValue: "100 USD", region: "global", priceUsd: 100.4, available: true },
    ],
    sortOrder: 10,
  },
  {
    id: "playstation-store",
    slug: "playstation-store",
    kind: "gift_card",
    status: "coming_soon",
    platform: "PlayStation",
    color: "#003791",
    titleAr: "بطاقة PlayStation Store",
    titleEn: "PlayStation Store Card",
    descriptionAr:
      "بطاقة PlayStation Store لشراء ألعاب PS4 وPS5 واشتراكات PlayStation Plus. مثالية للألعاب مع أصدقائك في المنطقة.",
    descriptionEn:
      "PlayStation Store cards for PS4 and PS5 games plus PlayStation Plus subscriptions — perfect for gifting friends across the region.",
    image: "/digital-products/playstation-store.jpg",
    regions: ["US", "SA", "AE", "EG", "global"],
    featuresAr: [
      "ألعاب PS4 وPS5",
      "اشتراك PlayStation Plus",
      "يختلف سعر البطاقة حسب المنطقة",
    ],
    featuresEn: [
      "PS4 and PS5 titles",
      "PlayStation Plus subscriptions",
      "Region-specific card pricing",
    ],
    deliveryNoteAr: GLOBAL_DELIVERY_AR,
    deliveryNoteEn: GLOBAL_DELIVERY_EN,
    denominations: [
      { id: "ps-10-us", label: "$10 · US", faceValue: "10 USD", region: "US", priceUsd: 10.8, available: true },
      { id: "ps-25-us", label: "$25 · US", faceValue: "25 USD", region: "US", priceUsd: 25.9, available: true },
      { id: "ps-50-us", label: "$50 · US", faceValue: "50 USD", region: "US", priceUsd: 50.5, available: true },
      { id: "ps-70-sa", label: "SAR 70", faceValue: "70 SAR", region: "SA", priceUsd: 19.1, available: true },
      { id: "ps-100-sa", label: "SAR 100", faceValue: "100 SAR", region: "SA", priceUsd: 27.2, available: true },
    ],
    sortOrder: 20,
  },
  {
    id: "xbox-gift-card",
    slug: "xbox-gift-card",
    kind: "gift_card",
    status: "coming_soon",
    platform: "Xbox",
    color: "#107C10",
    titleAr: "بطاقة Xbox",
    titleEn: "Xbox Gift Card",
    descriptionAr:
      "بطاقة Xbox لشراء الألعاب والاشتراكات على Xbox One وSeries X|S. تُضاف مباشرة إلى محفظتك.",
    descriptionEn:
      "Xbox cards for games and subscriptions on Xbox One and Series X|S, credited straight to your wallet.",
    image: "/digital-products/xbox-gift-card.jpg",
    regions: ["US", "EU", "SA", "AE", "global"],
    featuresAr: [
      "متوافقة مع Xbox One وSeries X|S",
      "تشمل اشتراك Game Pass",
      "تفعيل فوري بثلاث خطوات",
    ],
    featuresEn: [
      "Works on Xbox One and Series X|S",
      "Covers Game Pass subscriptions",
      "Redeem in three steps",
    ],
    deliveryNoteAr: GLOBAL_DELIVERY_AR,
    deliveryNoteEn: GLOBAL_DELIVERY_EN,
    denominations: [
      { id: "xbox-10", label: "$10", faceValue: "10 USD", region: "global", priceUsd: 10.8, available: true },
      { id: "xbox-25", label: "$25", faceValue: "25 USD", region: "global", priceUsd: 25.9, available: true },
      { id: "xbox-50", label: "$50", faceValue: "50 USD", region: "global", priceUsd: 50.5, available: true },
      { id: "xbox-100", label: "$100", faceValue: "100 USD", region: "global", priceUsd: 100.4, available: true },
    ],
    sortOrder: 30,
  },
  {
    id: "robux-roblox",
    slug: "robux-roblox",
    kind: "game_topup",
    status: "coming_soon",
    platform: "Roblox",
    color: "#E2231A",
    titleAr: "شحن Robux لحساب Roblox",
    titleEn: "Robux for Roblox",
    descriptionAr:
      "شحن رصيد Robux مباشرة على حساب Roblox الخاص بك — لاستخدامه في Avatar وItems وPasses_ANY.",
    descriptionEn:
      "Top up Robux straight onto your Roblox account for avatars, items and passes.",
    image: "/digital-products/robux-roblox.jpg",
    regions: ["global"],
    featuresAr: [
      "شحن مباشر على الحساب",
      "يعمل على كل المنصات",
      "بدون كلمة مرور للحساب",
    ],
    featuresEn: [
      "Credited directly to your account",
      "Works on every platform",
      "No account password needed",
    ],
    deliveryNoteAr: GLOBAL_DELIVERY_AR,
    deliveryNoteEn: GLOBAL_DELIVERY_EN,
    denominations: [
      { id: "robux-80", label: "80 Robux", faceValue: "80 Robux", region: "global", priceUsd: 1.2, available: true },
      { id: "robux-400", label: "400 Robux", faceValue: "400 Robux", region: "global", priceUsd: 4.9, available: true },
      { id: "robux-800", label: "800 Robux", faceValue: "800 Robux", region: "global", priceUsd: 9.8, available: true },
      { id: "robux-1700", label: "1 700 Robux", faceValue: "1700 Robux", region: "global", priceUsd: 19.9, available: true },
      { id: "robux-4500", label: "4 500 Robux", faceValue: "4500 Robux", region: "global", priceUsd: 49.9, available: true },
    ],
    sortOrder: 40,
  },
  {
    id: "google-play-gift",
    slug: "google-play-gift",
    kind: "gift_card",
    status: "coming_soon",
    platform: "Google Play",
    color: "#01875F",
    titleAr: "بطاقة Google Play",
    titleEn: "Google Play Gift Card",
    descriptionAr:
      "بطاقة Google Play لتطبيقات الألعاب والنتائج والتطبيقات المدفوعة على متجر Play.",
    descriptionEn:
      "Google Play cards for paid apps, in-app purchases and games on the Play Store.",
    image: "/digital-products/google-play-gift.jpg",
    regions: ["US", "SA", "AE", "EG", "TR", "global"],
    featuresAr: [
      "تطبيقات ونتائج واشتراكات",
      "متاحة بعدة مناطق",
      "صلاحية طويلة",
    ],
    featuresEn: [
      "Apps, in-app purchases and subscriptions",
      "Multiple regions available",
      "Long validity",
    ],
    deliveryNoteAr: GLOBAL_DELIVERY_AR,
    deliveryNoteEn: GLOBAL_DELIVERY_EN,
    denominations: [
      { id: "gplay-10", label: "$10", faceValue: "10 USD", region: "US", priceUsd: 10.7, available: true },
      { id: "gplay-25", label: "$25", faceValue: "25 USD", region: "US", priceUsd: 25.8, available: true },
      { id: "gplay-50", label: "$50", faceValue: "50 USD", region: "US", priceUsd: 50.5, available: true },
      { id: "gplay-100", label: "$100", faceValue: "100 USD", region: "US", priceUsd: 100.4, available: true },
    ],
    sortOrder: 50,
  },
  {
    id: "amazon-gift-card",
    slug: "amazon-gift-card",
    kind: "gift_card",
    status: "coming_soon",
    platform: "Amazon",
    color: "#FF9900",
    titleAr: "بطاقة أمازون",
    titleEn: "Amazon Gift Card",
    descriptionAr:
      "بطاقة أمازون للاستخدام في المتجر أو Kindle أو Prime Video — حسب المنطقة.",
    descriptionEn:
      "Amazon cards for the store, Kindle or Prime Video, depending on the region.",
    image: "/digital-products/amazon-gift-card.jpg",
    regions: ["US", "AE", "SA", "EG", "global"],
    featuresAr: [
      "متجر أمازون وPrime Video",
      "مناطق متعددة",
      "استرداد سريع",
    ],
    featuresEn: [
      "Amazon store and Prime Video",
      "Multiple regions",
      "Fast replenishment",
    ],
    deliveryNoteAr: GLOBAL_DELIVERY_AR,
    deliveryNoteEn: GLOBAL_DELIVERY_EN,
    denominations: [
      { id: "amazon-10", label: "$10", faceValue: "10 USD", region: "US", priceUsd: 10.6, available: true },
      { id: "amazon-25", label: "$25", faceValue: "25 USD", region: "US", priceUsd: 25.7, available: true },
      { id: "amazon-50", label: "$50", faceValue: "50 USD", region: "US", priceUsd: 50.4, available: true },
      { id: "amazon-100", label: "$100", faceValue: "100 USD", region: "US", priceUsd: 100.4, available: true },
    ],
    sortOrder: 60,
  },
  {
    id: "spotify-premium",
    slug: "spotify-premium",
    kind: "subscription_code",
    status: "coming_soon",
    platform: "Spotify",
    color: "#1DB954",
    titleAr: "كود اشتراك Spotify Premium",
    titleEn: "Spotify Premium Code",
    descriptionAr:
      "تفعيل اشتراك Spotify Premium على حسابك — استماع بلا إعلانات وتحميل للأجهزة.",
    descriptionEn:
      "Activate Spotify Premium on your account: ad-free listening and offline downloads.",
    image: "/digital-products/spotify-premium.jpg",
    regions: ["global"],
    featuresAr: [
      "بدون إعلانات",
      "تشغيل بلا اتصال",
      "على جهاز واحد أو أكثر",
    ],
    featuresEn: [
      "Ad-free listening",
      "Offline playback",
      "One or more devices",
    ],
    deliveryNoteAr: GLOBAL_DELIVERY_AR,
    deliveryNoteEn: GLOBAL_DELIVERY_EN,
    denominations: [
      { id: "spotify-3m", label: "3 أشهر", faceValue: "3 months", region: "global", priceUsd: 17.9, available: true },
      { id: "spotify-6m", label: "6 أشهر", faceValue: "6 months", region: "global", priceUsd: 32.9, available: true },
      { id: "spotify-12m", label: "12 شهراً", faceValue: "12 months", region: "global", priceUsd: 59.9, available: true },
    ],
    sortOrder: 70,
  },
  {
    id: "nvidia-s redeem",
    slug: "nvidia-redeem",
    kind: "software_key",
    status: "coming_soon",
    platform: "NVIDIA",
    color: "#76B900",
    titleAr: "كود تفعيل NVIDIA Gift Card",
    titleEn: "NVIDIA Gift Card Code",
    descriptionAr:
      "كود بطاقات هدايا NVIDIAلرصيد حساب NVIDIA أو اشتراك GeForce Now — تجديد أو إضافة رصيد.",
    descriptionEn:
      "NVIDIA gift card codes for GeForce Now or account credit — top up or renew.",
    image: "/digital-products/nvidia-redeem.jpg",
    regions: ["US", "EU", "global"],
    featuresAr: [
      "رصيد حساب NVIDIA",
      "يشمل اشتراكات NVIDIA",
      "تفعيل بكود واحد",
    ],
    featuresEn: [
      "NVIDIA account credit",
      "Covers NVIDIA subscriptions",
      "Single-code redemption",
    ],
    deliveryNoteAr: GLOBAL_DELIVERY_AR,
    deliveryNoteEn: GLOBAL_DELIVERY_EN,
    denominations: [
      { id: "nvidia-25", label: "$25", faceValue: "25 USD", region: "global", priceUsd: 25.9, available: true },
      { id: "nvidia-50", label: "$50", faceValue: "50 USD", region: "global", priceUsd: 50.6, available: true },
      { id: "nvidia-100", label: "$100", faceValue: "100 USD", region: "global", priceUsd: 100.6, available: true },
    ],
    sortOrder: 80,
  },
];
