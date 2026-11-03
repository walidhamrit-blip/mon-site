/**
 * Contenu SEO propre au catalogue digital (codes, cartes cadeaux, recharges).
 *
 * Les fiches produit étaient générées depuis le fournisseur avec une
 * description quasi identique (« recharge pour X — livraison immédiate ») :
 * 250 à 300 mots, dupliqués sur toutes les URLs. C'est exactement le profil
 * que Google classe comme « contenu mince » et qui plafonne un catalogue.
 *
 * Ce module construit, à partir des données réelles de la fiche (plateforme,
 * type, régions, montants, prix), du contenu **unique et vérifiable** :
 *  - un guide d'utilisation en 4 étapes adapté au type de produit ;
 *  - les questions/réponses réellement posées avant l'achat (région, ID de
 *    joueur, livraison, paiement, remboursement) ;
 *  - un titre et une description meta spécifiques (plateforme + région +
 *    prix d'entrée), pour éviter la duplication dans les SERP.
 *
 * Aucune donnée inventée : tout est dérivé de la fiche. Un produit sans
 * montant n'annonce pas de prix ; une fiche globale ne prétend pas être
 * régionale.
 */

import {
  DIGITAL_KIND_LABELS,
  lowestPriceUsd,
  regionLabel,
  regionalOnlyRegions,
  type DigitalProduct,
} from "@/lib/digital-types";

type Locale = "ar" | "en";

export interface DigitalFaq {
  q: string;
  a: string;
}

/** Étapes d'activation, adaptées au type de produit et à la plateforme (surchargeables dans /admin). */
export function redeemSteps(product: DigitalProduct, locale: Locale): string[] {
  const ar = locale === "ar";
  const customSteps = (ar ? product.seo?.redeemStepsAr : product.seo?.redeemStepsEn)
    ?.map((step) => step.trim())
    .filter(Boolean);
  if (customSteps && customSteps.length > 0) {
    return customSteps;
  }
  const platform = product.platform || (ar ? "المنصة" : "the platform");
  switch (product.kind) {
    case "game_topup":
      return ar
        ? [
            `أدخل معرّف اللاعب الخاص بك في ${platform} عند الطلب (وليس بريدك الإلكتروني).`,
            "اختر المبلغ أو الباقة، ثم أكمل الدفع بالدولار أو USDT.",
            `يُشحن الرصيد مباشرة إلى حساب ${platform} المرتبط بالمعرّف — عادة خلال دقائق.`,
            "تحقّق من الرصيد داخل اللعبة. المعرّف الخاطئ لا يمكن استرجاعه بعد الشحن.",
          ]
        : [
            `Enter your ${platform} player ID at checkout — not your email address.`,
            "Pick the amount or bundle and pay in USD or USDT.",
            `The credit is applied directly to the ${platform} account linked to that ID, usually within minutes.`,
            "Check the balance in-game. A wrong ID cannot be reversed after crediting.",
          ];
    case "software_key":
      return ar
        ? [
            "أكمل الطلب واستلم مفتاح التفعيل على بريدك الإلكتروني بعد تأكيد الدفع.",
            `افتح ${platform} ثم انتقل إلى الإعدادات ← الحساب ← التفعيل.`,
            "الصق المفتاح وانسخه كما هو (بدون مسافات إضافية).",
            "احتفظ بالمفتاح ورسالة الطلب — يحتاجها الدعم إذا تغيّر جهازك.",
          ]
        : [
            "Complete the order and receive the activation key by email after payment confirmation.",
            `Open ${platform}, then go to Settings → Account → Activate.`,
            "Paste the key exactly as received, without extra spaces.",
            "Keep the key and the order email — support may ask for them if you change device.",
          ];
    case "subscription_code":
      return ar
        ? [
            "اختر مدة الاشتراك، ثم أكمل الدفع بالدولار أو USDT.",
            "يصلك كود الاشتراك على بريدك الإلكتروني بعد تأكيد الدفع.",
            `افتح صفحة الحساب في ${platform} واختر «استرداد код / Redeem».`,
            "الصق الكود وسيُمدَّد الاشتراك تلقائياً دون بطاقة بنكية.",
          ]
        : [
            "Choose the subscription length and pay in USD or USDT.",
            "Your subscription code arrives by email after payment confirmation.",
            `Open the account page on ${platform} and choose “Redeem”.`,
            "Paste the code — the subscription is extended automatically, no bank card needed.",
          ];
    default:
      return ar
        ? [
            "أكمل الطلب واختر المنطقة الصحيحة للبطاقة قبل الدفع.",
            "يصلك كود البطاقة على بريدك الإلكتروني بعد تأكيد الدفع.",
            `افتح متجر ${platform} الرسمي واختر «استرداد بطاقة هدايا / Redeem».`,
            "أدخل الكود وسيُضاف الرصيد إلى المحفظة فوراً.",
          ]
        : [
            "Complete the order and select the correct card region before paying.",
            "The card code arrives by email after payment confirmation.",
            `Open the official ${platform} store and choose “Redeem gift card”.`,
            "Enter the code and the balance is added to your wallet instantly.",
          ];
  }
}

/** Régions réellement couvertes, en clair (les fiches globales restent globales). */
function regionsText(product: DigitalProduct, locale: Locale): string {
  const ar = locale === "ar";
  const closed = regionalOnlyRegions(product.regions);
  if (closed.length === 0) {
    return ar
      ? "صالح عالمياً على أي حساب في المنصة (تحقّق من عملة الحساب عند الحاجة)."
      : "Valid worldwide on any account for this platform (check the account currency when relevant).";
  }
  const labels = closed.map((region) => regionLabel(region, locale)).join(ar ? "، " : ", ");
  return ar
    ? `بطاقة إقليمية: تعمل فقط على حساب مسجّل في ${labels}.`
    : `Region-locked card: valid only on an account registered in ${labels}.`;
}

/**
 * Nom commercial nettoyé d'une fiche.
 *
 * Les fiches du fournisseur arrivent avec un préfixe de rayon et un
 * qualificatif opérationnel entre parenthèses :
 *   « Game Top-Up — PUBG Mobile (Auto) »
 *   « Gift Card — Steam Wallet (Global) »
 *   « Game Key — PlayStation (SA) »
 * Ces fragments n'ont aucune valeur pour le client (la région est affichée
 * dans un champ dédié, le mode « auto » est une information de livraison) et
 * polluent le titre, le H1 et le schéma Product. On les retire pour obtenir
 * « PUBG Mobile », « Steam Wallet », « PlayStation ».
 *
 * Les éditions qui font partie du nom (« Minecraft: Java & Bedrock »,
 * « Red Dead Redemption 2 ») sont conservées : seuls les suffixes listés
 * ci-dessous sont retirés, jamais une parenthèse arbitraire.
 */
export function productDisplayName(product: DigitalProduct, locale: Locale): string {
  const raw = (locale === "ar" ? product.titleAr : product.titleEn).trim();
  const prefixes = [
    "بطاقة هدايا — ",
    "شحن لعبة — ",
    "مفتاح لعبة — ",
    "كود اشتراك — ",
    "كود برمجي — ",
    "Game Top-Up — ",
    "Gift Card — ",
    "Game Key — ",
    "Subscription Code — ",
    "Software Key — ",
  ];
  let name = raw;
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length);
      break;
    }
  }
  // Qualificatifs opérationnels en fin de nom : (Auto), (Global), (Fast),
  // (Exclusive), (MENA), (SA), (EU), (IN)… ou leurs équivalents arabes.
  name = name
    .replace(
      /\s*\((?:auto|global|fast|instant|exclusive|worldwide|mena|intl|[A-Z]{2,3})\)\s*$/i,
      "",
    )
    .replace(/\s*\((?:عالمي|عالمية|تلقائي|تلقائية|حصري|حصرية|سريع|فوري)\)\s*$/i, "")
    .trim();
  return name || raw;
}

/**
 * Nom SEO d'une fiche produit : nom commercial + qualificatif de région.
 *
 * Quand la fiche est verrouillée sur des régions précises (MENA, EU, SA…),
 * la région fait partie de l'identité du produit : deux variantes d'un même
 * jeu (ex. « Free Fire (MENA) » et « Free Fire (EU) ») doivent avoir des
 * title, H1 et nom structuré DISTINCTS — sinon les moteurs voient deux
 * pages dupliquées (audit SEO/GEO 2026-11-01, point A01). Les fiches
 * globales restent sans suffixe.
 */
export function productSeoName(product: DigitalProduct, locale: Locale): string {
  const customH1 = (locale === "ar" ? product.seo?.h1Ar : product.seo?.h1En)?.trim();
  if (customH1) return customH1;
  const base = productDisplayName(product, locale);
  const closed = regionalOnlyRegions(product.regions);
  if (closed.length === 0) return base;
  const labels = closed
    .map((region) => regionLabel(region, locale))
    .join(locale === "ar" ? "، " : ", ");
  return `${base} (${labels})`;
}

/**
 * Mode de livraison RÉEL d'une fiche, selon sa nature (A02, audit SEO/GEO
 * 2026-11-01) :
 *  - `game_topup` : recharge directe sur le Player ID — aucun code par e-mail ;
 *  - cartes cadeaux, clés logicielles, abonnements : code envoyé par e-mail.
 * Ne jamais promettre l'e-mail pour un top-up (et inversement) : c'était une
 * contradiction confirmée sur les fiches en production.
 */
export function deliveryText(product: DigitalProduct, locale: Locale): string {
  const ar = locale === "ar";
  const platform = product.platform || (ar ? "المنصة" : "the platform");
  if (product.kind === "game_topup") {
    return ar
      ? `يُشحن الرصيد مباشرة على معرّف اللاعب في ${platform} بعد الدفع — لا يُرسل أي كود بالبريد.`
      : `The balance is credited directly to your ${platform} player ID after payment — no code is emailed.`;
  }
  return ar
    ? "يُرسل الكود إلى بريدك الإلكتروني مباشرة بعد الدفع."
    : "The code is emailed to you right after payment.";
}

/** Questions fréquentes d'une fiche produit — toutes visibles sur la page (surchargeables dans /admin). */
export function productFaqs(product: DigitalProduct, locale: Locale): DigitalFaq[] {
  const ar = locale === "ar";
  if (Array.isArray(product.seo?.faqs) && product.seo.faqs.length > 0) {
    const customFaqs = product.seo.faqs
      .map((item) => ({
        q: (ar ? item.qAr || item.qEn : item.qEn || item.qAr).trim(),
        a: (ar ? item.aAr || item.aEn : item.aEn || item.aAr).trim(),
      }))
      .filter((item) => item.q.length > 0 && item.a.length > 0);
    if (customFaqs.length > 0) return customFaqs;
  }
  const title = productDisplayName(product, locale);
  const platform = product.platform || (ar ? "المنصة" : "the platform");
  const from = lowestPriceUsd(product);
  const denominations = product.denominations
    .filter((denomination) => denomination.available)
    .map((denomination) => denomination.label)
    .slice(0, 6)
    .join(" · ");

  const faqs: DigitalFaq[] = [
    {
      q: ar ? `كيف أستلم ${title} بعد الدفع؟` : `How do I receive ${title} after payment?`,
      // A02 : le mode de livraison dépend de la nature du produit (top-up =
      // Player ID, pas d'e-mail) — fallback cohérent, note fournisseur prioritaire.
      a: ar
        ? product.deliveryNoteAr || deliveryText(product, "ar")
        : product.deliveryNoteEn || deliveryText(product, "en"),
    },
    {
      q: ar ? `هل ${title} تعمل في بلدي؟` : `Does ${title} work in my country?`,
      a: regionsText(product, locale),
    },
    {
      q: ar
        ? `ما المبالغ المتاحة وأسعارها؟`
        : `Which amounts are available, and at what price?`,
      a: ar
        ? `${denominations || "تُعلن المبالغ عند فتح البيع"}${from != null ? ` — تبدأ من ${from.toFixed(2)} دولار.` : "."} الأسعار بالدولار الأمريكي (1 دولار = 1 USDT).`
        : `${denominations || "Amounts are announced when sales open"}${from != null ? ` — starting at $${from.toFixed(2)}.` : "."} All prices are in USD (1 USD = 1 USDT).`,
    },
    {
      q: ar ? "هل الكود أصلي وآمن؟" : "Is the code genuine and safe?",
      a: ar
        ? `نعم — ${title} من موزّع رسمي، ويُسلَّم كود واحد غير مستخدم مقابل كل طلب. لا نطلب كلمة مرور حسابك، فقط معرّف اللاعب عند الحاجة.`
        : `Yes — ${title} comes from an official distributor and one unused code is delivered per order. We never ask for your account password, only your player ID when required.`,
    },
    {
      q: ar ? "هل يمكن استرجاع الكود؟" : "Can I get a refund?",
      a: ar
        ? "الأكواد الرقمية غير قابلة للاسترجاع بعد التسليم. إذا وصل الكود تالفاً أو غير صالح، تواصل معنا خلال 48 ساعة مع صورة الخطأ وسنستبدله."
        : "Digital codes cannot be refunded once delivered. If a code arrives damaged or invalid, contact us within 48 hours with a screenshot and we will replace it.",
    },
  ];

  if (product.kind === "game_topup") {
    faqs.splice(1, 0, {
      q: ar ? "ما المعرّف المطلوب للشحن؟" : "Which ID do I need to provide?",
      a: ar
        ? `معرّف اللاعب (Player ID) أو معرّف الحساب في ${platform}، مع المنطقة/السيرفر إذا كان مطلوباً. البريد الإلكتروني لا يُستخدم للشحن.`
        : `Your ${platform} player ID (and region/server if required). An email address cannot be used for a top-up.`,
    });
  }
  return faqs;
}

/** Questions fréquentes du rayon `/codes` (page hub). */
export function storeFaqs(locale: Locale): DigitalFaq[] {
  const ar = locale === "ar";
  return [
    {
      q: ar ? "كيف أشتري بطاقة هدايا أو كود لعبة؟" : "How do I buy a gift card or game code?",
      a: ar
        ? "اختر المنتج والمبلغ والمنطقة، ثم ادفع بالدولار أو USDT عبر NOWPayments. لا حاجة إلى حساب على المتجر."
        : "Pick the product, amount and region, then pay in USD or USDT via NOWPayments. No store account is required.",
    },
    {
      q: ar ? "متى يستلم المشتري الكود؟" : "When is the code delivered?",
      a: ar
        ? "يُرسل الكود إلى البريد الإلكتروني المستخدم في الطلب مباشرة بعد تأكيد الدفع — عادة خلال دقائق، وبحد أقصى بضع ساعات في أوقات الذروة."
        : "The code is emailed to the address used at checkout right after payment confirmation — usually minutes, at most a few hours during peak times.",
    },
    {
      q: ar ? "لماذا يجب اختيار المنطقة؟" : "Why is the region so important?",
      a: ar
        ? "بطاقات Steam وPlayStation وXbox وGoogle Play وغيرها مرتبطة بمنطقة الحساب. شراء بطاقة أمريكية لحساب ليبي لا يعمل، والاسترداد غير ممكن بعد التسليم. تحقّق من منطقة حسابك قبل الشراء."
        : "Steam, PlayStation, Xbox, Google Play and other cards are tied to the account region. A US card does not work on a Libyan account and cannot be refunded after delivery. Check your account region before buying.",
    },
    {
      q: ar ? "هل الأسعار نهائية؟" : "Are the prices final?",
      a: ar
        ? "الأسعار المعروضة بالدولار الأمريكي وتشمل هامش الخدمة. الدفع يُسوّى بعملة رقمية: 1 دولار = 1 USDT، وبدون رسوم مخفية."
        : "Prices are displayed in US dollars and include our service margin. Payment settles in crypto: 1 USD = 1 USDT, with no hidden fees.",
    },
    {
      q: ar ? "هل الأكواد أصلية؟" : "Are the codes genuine?",
      a: ar
        ? "نعم. تُشترى الأكواد من الموزّع/Reloadly/FazerCards الرسمي عند الطلب، وتُسلَّم مرة واحدة لكل عملية شراء."
        : "Yes. Codes are purchased from the official distributor (FazerCards/Reloadly) on demand and delivered once per order.",
    },
  ];
}

/**
 * Titre SEO d'une fiche produit.
 *
 * Gabarit : « {type} {nom} — à partir de {prix} | نخبة ».
 * Il contient le mot-clé de recherche réel (« بطاقة هدايا Steam »,
 * « شحن PUBG Mobile », « مفتاح Minecraft »), un prix (les annonces sans prix
 * sont moins cliquées) et la marque. `pageMetadata` le borne ensuite à
 * 60 caractères.
 */
export function productSeoTitle(product: DigitalProduct, locale: Locale): string {
  const customTitle = (
    locale === "ar" ? product.seo?.seoTitleAr : product.seo?.seoTitleEn
  )?.trim();
  if (customTitle) return customTitle;
  const ar = locale === "ar";
  // Nom SEO avec la région quand la fiche est régionale (A01) : deux
  // variantes d'un même jeu ne doivent pas partager le même title.
  const name = productSeoName(product, locale);
  const kind = ar
    ? DIGITAL_KIND_LABELS[product.kind].ar
    : DIGITAL_KIND_LABELS[product.kind].en;
  const from = lowestPriceUsd(product);
  // Les fiches historiques portent déjà le type dans leur nom
  // (« بطاقة Xbox », « بطاقة محفظة Steam ») : on n'ajoute pas un second
  // préfixe, sinon le titre devient « بطاقة هدايا بطاقة Xbox ».
  const alreadyTyped = ar
    ? new RegExp(
        `^(${kind.split(" ")[0]}|${DIGITAL_KIND_LABELS[product.kind].ar.split(" ")[0]})`,
      ).test(name)
    : new RegExp(`^(${kind}|${kind.split(" ")[0]})`, "i").test(name);
  const label = alreadyTyped ? "" : `${kind} `;
  if (ar) {
    return `${label}${name}${from != null ? ` — من ${from.toFixed(2)} دولار` : ""} | نخبة`;
  }
  return `${label}${name}${from != null ? ` — from $${from.toFixed(2)}` : ""} | Nukhba`;
}

/**
 * Description meta unique : type + région + prix d'entrée + livraison.
 * C'est cette phrase qui s'affiche sous le lien dans la SERP ; elle doit
 * différer d'un produit à l'autre, sinon Google réécrit la description.
 */
export function productSeoDescription(
  product: DigitalProduct,
  locale: Locale,
): string {
  const customDesc = (
    locale === "ar" ? product.seo?.seoDescriptionAr : product.seo?.seoDescriptionEn
  )?.trim();
  if (customDesc) return customDesc;
  const ar = locale === "ar";
  const title = productDisplayName(product, locale);
  const kind = ar
    ? DIGITAL_KIND_LABELS[product.kind].ar
    : DIGITAL_KIND_LABELS[product.kind].en.toLowerCase();
  const from = lowestPriceUsd(product);
  const closed = regionalOnlyRegions(product.regions);
  const region = closed.length
    ? closed.map((item) => regionLabel(item, locale)).join(ar ? "، " : ", ")
    : ar
      ? "عالمي"
      : "worldwide";
  // La région est présentée comme un champ (« النطاق: عالمي ») et non comme
  // un attribut : « متاح لـعالمي » était fautif, et l'accord varie selon le
  // genre du nom (بطاقة / كود). Le libellé reste ainsi grammatical pour
  // toutes les fiches. Longueur visée : ≤ 155 caractères, sans troncature.
  if (ar) {
    const head = `${title} — ${kind}${from != null ? ` من ${from.toFixed(2)} دولار` : ""}.`;
    return `${head} النطاق: ${region}. ${deliveryText(product, "ar")} (1 USD = 1 USDT).`;
  }
  const head = `${title} — ${kind}${from != null ? ` from $${from.toFixed(2)}` : ""}.`;
  return `${head} Region: ${region}. ${deliveryText(product, "en")} (1 USD = 1 USDT).`;
}

/** Texte alternatif SEO de l'image produit (≤ 125 car.). */
export function productImageAlt(product: DigitalProduct, locale: Locale): string {
  const customAlt = (
    locale === "ar" ? product.seo?.imageAltAr : product.seo?.imageAltEn
  )?.trim();
  if (customAlt) return customAlt;
  const name = productSeoName(product, locale);
  return locale === "ar" ? `صورة ${name}` : `${name} product visual`;
}

/** Résumé factuel « Answer-First » GEO pour moteurs IA (ChatGPT, Perplexity, AI Overviews). */
export function productGeoSummary(product: DigitalProduct, locale: Locale): string {
  const customGeo = (
    locale === "ar" ? product.seo?.geoSummaryAr : product.seo?.geoSummaryEn
  )?.trim();
  return customGeo || "";
}

/** Liste dédoublonnée des mots-clés SEO bilingues d'une fiche produit. */
export function productSeoKeywords(product: DigitalProduct): string[] {
  const base = [
    ...(product.seo?.keywordsAr ?? []),
    ...(product.seo?.keywordsEn ?? []),
    product.titleAr,
    product.titleEn,
    product.platform,
    `${product.platform} code`,
    `${product.platform} gift card`,
    `${product.platform} ليبيا`,
    `شراء ${product.titleAr}`,
    `buy ${product.titleEn} USDT`,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const kw of base) {
    const clean = String(kw ?? "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out.slice(0, 24);
}
