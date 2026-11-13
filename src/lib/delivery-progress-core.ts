/**
 * Noyau PUR de la progression de livraison (« où en est ma commande ? »).
 *
 * ── Pourquoi ──
 * Un acheteur de codes paie en crypto, puis attend. L'attente est
 * anxiogène pour trois raisons distinctes qu'il ne peut pas distinguer
 * aujourd'hui :
 *   1. le réseau n'a pas encore confirmé les fonds (NOWPayments :
 *      `waiting`, `confirming`, `confirmed`, `sending`) ;
 *   2. les fonds sont confirmés mais l'émetteur n'a pas encore produit le
 *      code (achat fournisseur en cours, retries possibles) ;
 *   3. le code est émis et transmis.
 *
 * Ce module traduit l'état technique en **une seule progression lisible**
 * (attente de confirmation réseau → génération de la clé → livraison), avec
 * les libellés dans les trois langues du site et une estimation honnête du
 * délai de confirmation selon la cryptomonnaie utilisée.
 *
 * Aucun import de base, de réseau ou de secret : le composant client, le bot
 * Telegram et les tests peuvent l'utiliser directement.
 */

/* --------------------------------- Étapes --------------------------------- */

export const DELIVERY_STEPS = [
  /**
   * Attente du réseau : couvre « paiement pas encore vu » ET « transfert vu,
   * confirmations en cours ». Ce sont deux nuances du MÊME moment vécu par
   * le client (« j'ai payé, ça n'arrive pas ») : elles changent le message,
   * pas le nombre d'étapes. Trois étapes lisibles valent mieux que quatre
   * dont deux se ressemblent.
   */
  "confirmation",
  /** Les fonds sont confirmés : achat fournisseur / émission du code. */
  "issuing",
  /** Code transmis (ou crédit appliqué). */
  "delivered",
] as const;

export type DeliveryStep = (typeof DELIVERY_STEPS)[number];
export type StepState = "done" | "current" | "todo" | "alert";

export type DeliveryLocale = "ar" | "en" | "fr";

const STEP_LABELS: Record<DeliveryLocale, Record<DeliveryStep, string>> = {
  fr: {
    confirmation: "Confirmation du réseau",
    issuing: "Génération de votre code",
    delivered: "Livraison",
  },
  en: {
    confirmation: "Network confirmation",
    issuing: "Generating your code",
    delivered: "Delivery",
  },
  ar: {
    confirmation: "تأكيد الشبكة",
    issuing: "إنشاء الكود",
    delivered: "التسليم",
  },
};

/**
 * Libellés de l'étape « confirmation » pour un paiement par carte
 * téléphonique : il n'y a pas de blockchain, la vérification est humaine.
 * Le reste de la progression est identique.
 */
const PHONE_CARD_LABELS: Record<DeliveryLocale, string> = {
  fr: "Vérification de la carte",
  en: "Card verification",
  ar: "التحقق من البطاقة",
};

const STEP_HINTS: Record<DeliveryLocale, Record<DeliveryStep, string>> = {
  fr: {
    confirmation: "Transfert détecté : la blockchain attend le nombre de confirmations requis.",
    issuing: "Paiement confirmé. Nous achetons votre code chez notre fournisseur.",
    delivered: "Votre code est disponible ci-dessous et envoyé par e-mail.",
  },
  en: {
    confirmation: "Transfer detected: the blockchain is waiting for the required confirmations.",
    issuing: "Payment confirmed. We are buying your code from our supplier.",
    delivered: "Your code is available below and has been emailed to you.",
  },
  ar: {
    confirmation: "تم اكتشاف التحويل: الشبكة تنتظر عدد التأكيدات المطلوب.",
    issuing: "تم تأكيد الدفع. نشتري الكود من المورّد الآن.",
    delivered: "الكود متاح أدناه وتم إرساله إلى بريدك الإلكتروني.",
  },
};

/** Variante de libellé : `phone_card` n'a pas d'étape réseau. */
export function deliveryStepLabel(
  step: DeliveryStep,
  locale: DeliveryLocale,
  variant: "nowpayments" | "phone_card" = "nowpayments",
): string {
  if (step === "confirmation" && variant === "phone_card") {
    return PHONE_CARD_LABELS[locale] ?? PHONE_CARD_LABELS.en;
  }
  return STEP_LABELS[locale]?.[step] ?? STEP_LABELS.en[step];
}

export function deliveryStepHint(step: DeliveryStep, locale: DeliveryLocale): string {
  return STEP_HINTS[locale]?.[step] ?? STEP_HINTS.en[step];
}

/* ------------------------------ Entrée / sortie ---------------------------- */

export interface DeliveryProgressInput {
  /** Statut de commande historique : pending | paid | manual | delivered | failed. */
  status: string;
  /** Statut granulaire (file de livraison). */
  fulfillmentStatus?: string | null;
  /** nowpayments | phone_card */
  paymentMethod?: string | null;
  /** pending | approved | rejected (cartes téléphoniques). */
  phoneCardStatus?: string | null;
  /** Statut brut NOWPayments : waiting, confirming, confirmed, sending, finished… */
  ipnStatus?: string | null;
  /** Crypto utilisée par le client (usdttrc20, btc…) — sert à l'estimation. */
  payCurrency?: string | null;
  /** Tentatives fournisseur déjà consommées. */
  attempts?: number | null;
}

export interface DeliveryProgress {
  steps: { id: DeliveryStep; state: StepState }[];
  /** Étape en cours (0 = paiement, 3 = livraison). */
  currentIndex: number;
  /** Avancement 0–100 (chaque étape vaut un quart). */
  percent: number;
  /** Ton global, pour la couleur de la barre et le bandeau. */
  tone: "waiting" | "active" | "done" | "alert" | "failed";
  /**
   * Code d'état, pour que l'interface choisisse son message :
   * `awaiting_payment`, `awaiting_network`, `awaiting_phone_card`,
   * `issuing`, `manual_review`, `delivered`, `failed`.
   */
  stage:
    | "awaiting_payment"
    | "awaiting_network"
    | "awaiting_phone_card"
    | "issuing"
    | "manual_review"
    | "delivered"
    | "failed";
  /** Estimation du délai de confirmation réseau (secondes), si connue. */
  confirmationEtaSeconds: number | null;
}

/** Statuts NOWPayments qui signifient « fonds vus, confirmations en cours ». */
const NETWORK_PENDING_STATUSES = new Set([
  "waiting",
  "confirming",
  "confirmed",
  "sending",
  "partially_paid",
]);

/**
 * Estimation du délai de confirmation, par actif (fourchettes prudentes,
 * jamais une promesse). Les valeurs reflètent les temps de bloc usuels :
 * une TRC-20 arrive en ~1 min, un virement Bitcoin peut dépasser 30 min.
 */
const CONFIRMATION_ETA_SECONDS: Record<string, number> = {
  usdttrc20: 90,
  usdterc20: 300,
  usdtbsc: 60,
  usdtpolygon: 60,
  usdtsol: 60,
  usdtton: 60,
  ltc: 600,
  doge: 300,
  trx: 90,
  bnbbsc: 60,
  eth: 600,
  btc: 2_400,
};

/**
 * Délai estimé (secondes) avant que le réseau ne confirme le transfert pour
 * cet actif. `null` = inconnu : on n'invente pas de délai.
 */
export function confirmationEtaSeconds(payCurrency: string | null | undefined): number | null {
  const key = (payCurrency ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!key) return null;
  // Lookup sûr : une clé comme `constructor` ne doit pas renvoyer une fonction.
  const known = Object.hasOwn(CONFIRMATION_ETA_SECONDS, key)
    ? CONFIRMATION_ETA_SECONDS[key]
    : undefined;
  return typeof known === "number" && known > 0 ? known : null;
}

/**
 * Traduit l'état d'une commande en progression lisible.
 *
 * Règles structurantes :
 *  - la livraison prime : `delivered` est terminal, tout est « done » ;
 *  - un échec fournisseur (`failed`) n'est PAS présenté comme une attente :
 *    l'étape « génération » passe en alerte et le client est orienté vers
 *    le support ;
 *  - `manual` / `manual_review` = un humain agit : l'étape « génération »
 *    reste l'étape courante, en alerte douce (pas de roue qui tourne à
 *    l'infini, ce qui donnait l'impression d'un bug) ;
 *  - pour une carte téléphonique, la « confirmation réseau » n'existe pas :
 *    l'étape devient la vérification manuelle de la carte.
 */
export function deliveryProgress(input: DeliveryProgressInput): DeliveryProgress {
  const status = (input.status ?? "").trim();
  const fulfillment = (input.fulfillmentStatus ?? "").trim();
  const ipn = (input.ipnStatus ?? "").trim().toLowerCase();
  const isPhoneCard = (input.paymentMethod ?? "").trim() === "phone_card";
  const eta = isPhoneCard ? null : confirmationEtaSeconds(input.payCurrency);

  const delivered = status === "delivered" || fulfillment === "delivered";
  const failed = status === "failed";
  const manual = status === "manual" || fulfillment === "manual_review";
  const paid = status === "paid" || fulfillment === "paid_fulfilling";

  // `delivered` est terminal : la livraison prime sur tout autre drapeau.
  if (delivered) {
    return {
      steps: [
        { id: "confirmation", state: "done" },
        { id: "issuing", state: "done" },
        { id: "delivered", state: "done" },
      ],
      currentIndex: 2,
      percent: 100,
      tone: "done",
      stage: "delivered",
      confirmationEtaSeconds: eta,
    };
  }

  // Échec : ce n'est PAS une attente. L'étape « génération » passe en
  // alerte et le client est orienté vers le support — sinon il attend
  // indéfiniment une livraison qui n'arrivera pas toute seule.
  if (failed || manual) {
    return {
      steps: [
        { id: "confirmation", state: "done" },
        { id: "issuing", state: "alert" },
        { id: "delivered", state: "todo" },
      ],
      currentIndex: 1,
      percent: 55,
      tone: failed ? "failed" : "alert",
      stage: failed ? "failed" : "manual_review",
      confirmationEtaSeconds: eta,
    };
  }

  // Fonds confirmés → l'étape 1 est terminée même si le statut brut du
  // réseau n'a pas été relu (le webhook est déjà passé).
  if (paid) {
    return {
      steps: [
        { id: "confirmation", state: "done" },
        { id: "issuing", state: "current" },
        { id: "delivered", state: "todo" },
      ],
      currentIndex: 1,
      percent: 66,
      tone: "active",
      stage: "issuing",
      confirmationEtaSeconds: eta,
    };
  }

  // Paiement pas encore confirmé — étape 1, deux nuances.
  if (isPhoneCard) {
    return {
      steps: [
        { id: "confirmation", state: "current" },
        { id: "issuing", state: "todo" },
        { id: "delivered", state: "todo" },
      ],
      currentIndex: 0,
      percent: 20,
      tone: "waiting",
      stage: "awaiting_phone_card",
      confirmationEtaSeconds: null,
    };
  }

  // `finished` sans `paid` ne devrait pas arriver (l'IPN fait passer la
  // commande à `paid`) ; s'il arrive, le client doit voir « réseau en
  // cours » plutôt qu'un retour à « rien reçu ».
  const networkSeen = NETWORK_PENDING_STATUSES.has(ipn) || ipn === "finished";
  return {
    steps: [
      { id: "confirmation", state: "current" },
      { id: "issuing", state: "todo" },
      { id: "delivered", state: "todo" },
    ],
    currentIndex: 0,
    percent: networkSeen ? 45 : 12,
    tone: networkSeen ? "active" : "waiting",
    stage: networkSeen ? "awaiting_network" : "awaiting_payment",
    confirmationEtaSeconds: eta,
  };
}

/* ---------------------------- Message principal --------------------------- */

/**
 * Phrase d'attente affichée sous la barre : elle dit ce que le client doit
 * faire (ou ne pas faire) MAINTENANT. Une attente expliquée n'est pas
 * signalée comme une panne.
 */
export function deliveryProgressMessage(
  progress: DeliveryProgress,
  locale: DeliveryLocale,
  options: { botUsername?: string | null } = {},
): string {
  const bot = (options.botUsername ?? "").trim();
  const viaTelegram =
    bot.length > 0
      ? locale === "ar"
        ? ` يمكنك أيضاً استلام الكود عبر تيليجرام @${bot}.`
        : locale === "fr"
          ? ` Vous pouvez aussi recevoir le code sur Telegram : @${bot}.`
          : ` You can also get the code on Telegram: @${bot}.`
      : "";

  switch (progress.stage) {
    case "awaiting_payment":
      return locale === "ar"
        ? "لم نستلم الدفع بعد. أرسل المبلغ إلى العنوان الموضّح أعلاه؛ تُحدَّث الحالة تلقائياً."
        : locale === "fr"
          ? "Nous n'avons pas encore reçu le paiement. Envoyez le montant à l'adresse indiquée ci-dessus ; la page se met à jour automatiquement."
          : "We have not received the payment yet. Send the amount to the address above; this page updates automatically.";
    case "awaiting_network": {
      const minutes = progress.confirmationEtaSeconds
        ? Math.max(1, Math.round(progress.confirmationEtaSeconds / 60))
        : null;
      return (
        (locale === "ar"
          ? "تم اكتشاف تحويلك، والشبكة تؤكده الآن."
          : locale === "fr"
            ? "Votre transfert a été détecté, le réseau le confirme."
            : "Your transfer has been detected; the network is confirming it.") +
        (minutes
          ? locale === "ar"
            ? ` المدة المعتادة لهذه العملة: حوالي ${minutes} دقيقة.`
            : locale === "fr"
              ? ` Délai habituel pour cette cryptomonnaie : environ ${minutes} min.`
              : ` Usual time for this coin: about ${minutes} min.`
          : "") +
        (locale === "ar"
          ? " لا ترسل دفعة ثانية."
          : locale === "fr"
            ? " N'envoyez pas de second paiement."
            : " Do not send a second payment.")
      );
    }
    case "awaiting_phone_card":
      return locale === "ar"
        ? "بطاقتك قيد التحقق اليدوي. لا ترسل بطاقة أخرى قبل أن نتواصل معك."
        : locale === "fr"
          ? "Votre carte est en cours de vérification manuelle. N'envoyez pas d'autre carte avant notre réponse."
          : "Your card is being verified manually. Do not submit another card before our reply.";
    case "issuing":
      return (
        (locale === "ar"
          ? "الدفع مؤكد. نشتري الكود من المورّد الآن — عادةً في أقل من دقيقة، وقد يتأخر قليلاً عند الضغط."
          : locale === "fr"
            ? "Paiement confirmé. Nous achetons votre code chez le fournisseur — généralement moins d'une minute, parfois un peu plus en cas d'affluence."
            : "Payment confirmed. We are buying your code from our supplier — usually under a minute, sometimes a little longer at peak times.") +
        viaTelegram
      );
    case "manual_review":
      return locale === "ar"
        ? "فريقنا يتولى طلبك يدوياً ويواصل معك قريباً. الدفع محفوظ، لا حاجة لإعادة الدفع."
        : locale === "fr"
          ? "Notre équipe prend votre commande en main et revient vers vous rapidement. Votre paiement est enregistré, ne payez pas deux fois."
          : "Our team is handling your order and will get back to you shortly. Your payment is recorded; do not pay twice.";
    case "delivered":
      return locale === "ar"
        ? "تم تسليم الكود. احتفظ به في مكان آمن."
        : locale === "fr"
          ? "Votre code est livré. Conservez-le en lieu sûr."
          : "Your code is delivered. Keep it in a safe place.";
    case "failed":
      return locale === "ar"
        ? "تعذّر إصدار الكود آلياً. تواصل معنا مع ذكر مرجع الطلب وسنحل الأمر أو نعيد المبلغ."
        : locale === "fr"
          ? "Le code n'a pas pu être émis automatiquement. Écrivez-nous avec votre référence : nous le remplaçons ou nous remboursons."
          : "The code could not be issued automatically. Contact us with your reference: we will replace it or refund you.";
  }
}
