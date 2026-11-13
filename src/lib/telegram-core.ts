/**
 * Noyau du bot Telegram — fonctions PURES (aucune base, aucun réseau).
 *
 * Tout ce qui décide « quoi répondre » vit ici afin d'être testable sans
 * jeton ni PostgreSQL : détection de langue, extraction d'une référence de
 * commande, claviers inline, textes trilingues (ar / en / fr), composition
 * d'une campagne marketing. Les appels à l'API Telegram et les lectures en
 * base sont dans `src/lib/telegram.ts`.
 */

export type TelegramLocale = "ar" | "en" | "fr";

export const TELEGRAM_LOCALES: readonly TelegramLocale[] = ["ar", "en", "fr"] as const;

/** Une langue est-elle supportée par le bot ? */
export function isTelegramLocale(value: unknown): value is TelegramLocale {
  return typeof value === "string" && (TELEGRAM_LOCALES as readonly string[]).includes(value);
}

/**
 * Jeton BotFather : `<identifiant numérique>:<secret base64url>`.
 * Le format est vérifié AVANT tout appel réseau — une variable mal collée
 * (guillemets, espace, aperçu tronqué) donne une erreur claire dans l'admin
 * au lieu d'un 404 Telegram illisible.
 */
export const TELEGRAM_BOT_TOKEN_PATTERN = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/;

export function isTelegramBotToken(value: string | null | undefined): boolean {
  return TELEGRAM_BOT_TOKEN_PATTERN.test((value ?? "").trim());
}

/** Lien public du bot (`https://t.me/<username>`), avec payload de départ. */
export function telegramDeepLink(username: string, payload?: string): string {
  const handle = username.trim().replace(/^@/, "");
  if (!handle) return "";
  const clean = sanitizeStartPayload(payload);
  return clean
    ? `https://t.me/${handle}?start=${encodeURIComponent(clean)}`
    : `https://t.me/${handle}`;
}

/**
 * Charge utile de `/start` : on ne garde que `[a-z0-9_-]` (64 caractères
 * max). Elle sert de source d'acquisition (`?start=instagram-bio`), jamais
 * d'identifiant client.
 */
export function sanitizeStartPayload(payload: string | null | undefined): string {
  return (payload ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/* ------------------------------- Échappement ------------------------------ */

/** Texte sûr pour `parse_mode: "HTML"` (sinon `<` casse tout l'envoi). */
export function escapeTelegramHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Tronque proprement sous la limite Telegram (4096 caractères). */
export function telegramClamp(text: string, limit = 3900): string {
  const clean = text.trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`;
}

/** Commande Telegram : `/commande@MonBot DGC-…` → `commande` + `DGC-…`. */
export function parseTelegramCommand(text: string): { command: string; args: string } {
  const trimmed = (text ?? "").trim();
  if (!trimmed.startsWith("/")) return { command: "", args: trimmed };
  const [rawCommand, ...rest] = trimmed.slice(1).split(/\s+/);
  const command = rawCommand.split("@")[0].toLowerCase();
  return { command, args: rest.join(" ").trim() };
}

/* -------------------------------- Références ------------------------------ */

/**
 * Références internes : NKH (projet), RSV (réservation), ABO (abonnement),
 * DGC (commande digitale), LIV (livraison). On accepte la saisie en
 * minuscules et avec des espaces autour — le client copie/colle.
 */
export const ORDER_REF_PATTERN = /\b((?:NKH|RSV|ABO|DGC|LIV)-[A-Za-z0-9]{6,})\b/i;

export function orderRefFromText(text: string | null | undefined): string | null {
  const match = ORDER_REF_PATTERN.exec(text ?? "");
  return match ? match[1].toUpperCase() : null;
}

/* --------------------------------- Langues -------------------------------- */

const ARABIC = /[\u0600-\u06FF]/;
const FRENCH_HINTS =
  /\b(bonjour|salut|merci|commande|prix|combien|svp|s'il vous pla[iî]t|livraison|aide|bonsoir|je veux|j'aimerais)\b/i;

/**
 * Langue du visiteur : arabe si le message contient des caractères arabes,
 * français si des mots français évidents apparaissent, sinon la langue
 * mémorisée (ou l'anglais). L'arabe reste la langue par défaut du site.
 */
export function detectTelegramLocale(
  text: string | null | undefined,
  fallback: TelegramLocale = "ar",
): TelegramLocale {
  const value = (text ?? "").trim();
  if (!value) return fallback;
  if (ARABIC.test(value)) return "ar";
  if (FRENCH_HINTS.test(value)) return "fr";
  return "en";
}

/* ---------------------------------- Textes -------------------------------- */

export interface TelegramCopy {
  welcome: string;
  menuTitle: string;
  catalog: string;
  catalogButton: string;
  ordersPrompt: string;
  ordersButton: string;
  orderNotFound: string;
  orderHeader: string;
  offersAsk: string;
  offersOn: string;
  offersAlready: string;
  offersOff: string;
  offersOffAlready: string;
  human: string;
  forwarded: string;
  help: string;
  unsubscribed: string;
  fallback: string;
  langSaved: string;
  langPrompt: string;
  buttons: {
    catalog: string;
    orders: string;
    offers: string;
    human: string;
    language: string;
    menu: string;
    whatsapp: string;
    site: string;
    on: string;
    off: string;
  };
  statusLabels: Record<string, string>;
}

const COPY: Record<TelegramLocale, TelegramCopy> = {
  fr: {
    welcome:
      "Bienvenue chez {site} 👋\n\nJe suis votre assistant Telegram : je vous aide à trouver un produit, à suivre une commande et à recevoir les offres.\n\nQue voulez-vous faire ?",
    menuTitle: "Que souhaitez-vous faire ?",
    catalog: "Le catalogue complet est ici — codes, cartes cadeaux et abonnements :\n{store}",
    catalogButton: "Ouvrir la boutique",
    ordersPrompt:
      "Envoyez votre référence de commande (ex. <code>DGC-1A2B3C4D5E6F</code>) et je vous donne son statut.",
    ordersButton: "Page de suivi",
    orderNotFound:
      "Je ne trouve aucune commande avec cette référence. Vérifiez la saisie (elle figure dans l'e-mail de confirmation), ou écrivez-nous.",
    orderHeader: "Commande <b>{ref}</b>",
    offersAsk:
      "Voulez-vous recevoir les offres et nouveautés de {site} sur Telegram ?\n\nVous pourrez vous désabonner à tout moment avec /stop.",
    offersOn: "C'est noté ✅ Vous recevrez nos offres. /stop pour vous désabonner.",
    offersAlready: "Vous êtes déjà abonné aux offres ✅",
    offersOff: "Désabonné des offres ✅ Vous continuerez à recevoir les réponses du support.",
    offersOffAlready: "Vous n'étiez pas abonné aux offres.",
    human:
      "Un humain peut vous répondre :\n\n💬 WhatsApp : {whatsapp}\n✉️ {email}\n\nVotre message vient d'être transmis à l'équipe.",
    forwarded: "Message transmis à l'équipe ✅ Nous revenons vers vous rapidement.",
    help:
      "Voici ce que je sais faire :\n\n/start — menu principal\n/codes — catalogue et boutique\n/commande RÉFÉRENCE — statut d'une commande\n/offres — recevoir nos offres\n/stop — ne plus recevoir les offres\n/aide — cette aide\n\nUne question ? Écrivez-la simplement ici.",
    unsubscribed: "Vous ne recevrez plus d'offres. Tapez /start pour rouvrir le menu.",
    fallback:
      "Je n'ai pas compris cette demande. Choisissez une option ci-dessous, ou écrivez « humain » pour joindre l'équipe.",
    langSaved: "Langue enregistrée : français 🇫🇷",
    langPrompt: "Choisissez votre langue :",
    buttons: {
      catalog: "🛍️ Catalogue",
      orders: "📦 Suivre une commande",
      offers: "🎁 Offres & promos",
      human: "💬 Parler à un humain",
      language: "🌍 Langue",
      menu: "⬅️ Menu",
      whatsapp: "WhatsApp",
      site: "Visiter le site",
      on: "Oui, recevoir les offres",
      off: "Se désabonner",
    },
    statusLabels: {
      pending: "En attente de paiement",
      paid: "Payé",
      delivered: "Livré",
      manual: "Traitement manuel en cours",
      failed: "Échoué",
      expired: "Expiré",
      new: "Nouveau",
      active: "Actif",
      cancelled: "Annulé",
    },
  },
  ar: {
    welcome:
      "مرحباً بك في {site} 👋\n\nأنا مساعدك على تيليجرام: أساعدك على إيجاد منتج، متابعة طلب، واستلام العروض.\n\nماذا تريد أن تفعل؟",
    menuTitle: "ماذا تريد أن تفعل؟",
    catalog: "الكتالوج الكامل هنا — أكواد، بطاقات هدايا واشتراكات:\n{store}",
    catalogButton: "فتح المتجر",
    ordersPrompt:
      "أرسل رقم طلبك (مثال <code>DGC-1A2B3C4D5E6F</code>) وسأخبرك بحالته.",
    ordersButton: "صفحة المتابعة",
    orderNotFound:
      "لم أجد أي طلب بهذا الرقم. تأكد من الكتابة (الرقم موجود في بريد التأكيد) أو راسلنا.",
    orderHeader: "الطلب <b>{ref}</b>",
    offersAsk:
      "هل تريد استلام عروض وجديد {site} على تيليجرام؟\n\nيمكنك إلغاء الاشتراك في أي وقت بالأمر /stop.",
    offersOn: "تم ✅ ستستلم عروضنا. /stop لإلغاء الاشتراك.",
    offersAlready: "أنت مشترك بالفعل في العروض ✅",
    offersOff: "تم إلغاء الاشتراك في العروض ✅ ستبقى ردود الدعم متاحة.",
    offersOffAlready: "لم تكن مشتركاً في العروض.",
    human:
      "يمكن لأحد أعضاء الفريق الرد عليك:\n\n💬 واتساب: {whatsapp}\n✉️ {email}\n\nتم تحويل رسالتك إلى الفريق.",
    forwarded: "تم تحويل رسالتك إلى الفريق ✅ سنعود إليك قريباً.",
    help:
      "هذه هي أوامري:\n\n/start — القائمة الرئيسية\n/codes — الكتالوج والمتجر\n/commande رقم الطلب — حالة الطلب\n/offres — استلام العروض\n/stop — إلغاء اشتراك العروض\n/aide — المساعدة\n\nلديك سؤال؟ اكتبه هنا مباشرة.",
    unsubscribed: "لن تستلم عروضاً بعد الآن. اكتب /start لإعادة فتح القائمة.",
    fallback:
      "لم أفهم هذا الطلب. اختر أحد الخيارات أدناه، أو اكتب «humain» للتواصل مع الفريق.",
    langSaved: "تم حفظ اللغة: العربية 🇱🇾",
    langPrompt: "اختر لغتك:",
    buttons: {
      catalog: "🛍️ الكتالوج",
      orders: "📦 متابعة طلب",
      offers: "🎁 العروض",
      human: "💬 التحدث مع فريق",
      language: "🌍 اللغة",
      menu: "⬅️ القائمة",
      whatsapp: "واتساب",
      site: "زيارة الموقع",
      on: "نعم، أريد العروض",
      off: "إلغاء الاشتراك",
    },
    statusLabels: {
      pending: "بانتظار الدفع",
      paid: "مدفوع",
      delivered: "تم التسليم",
      manual: "قيد المعالجة اليدوية",
      failed: "فشل",
      expired: "منتهي",
      new: "جديد",
      active: "نشط",
      cancelled: "ملغى",
    },
  },
  en: {
    welcome:
      "Welcome to {site} 👋\n\nI'm your Telegram assistant: find a product, track an order, and get our offers.\n\nWhat would you like to do?",
    menuTitle: "What would you like to do?",
    catalog: "The full catalogue — codes, gift cards and subscriptions:\n{store}",
    catalogButton: "Open the store",
    ordersPrompt:
      "Send your order reference (e.g. <code>DGC-1A2B3C4D5E6F</code>) and I'll tell you its status.",
    ordersButton: "Tracking page",
    orderNotFound:
      "I can't find an order with that reference. Double-check it (it's in your confirmation email) or contact us.",
    orderHeader: "Order <b>{ref}</b>",
    offersAsk:
      "Would you like to receive {site} offers and news on Telegram?\n\nYou can unsubscribe anytime with /stop.",
    offersOn: "Done ✅ You'll receive our offers. /stop to unsubscribe.",
    offersAlready: "You're already subscribed to offers ✅",
    offersOff: "Unsubscribed from offers ✅ Support replies stay available.",
    offersOffAlready: "You weren't subscribed to offers.",
    human:
      "A human can reply:\n\n💬 WhatsApp: {whatsapp}\n✉️ {email}\n\nYour message has been forwarded to the team.",
    forwarded: "Message forwarded to the team ✅ We'll get back to you shortly.",
    help:
      "Here's what I can do:\n\n/start — main menu\n/codes — catalogue & store\n/commande REFERENCE — order status\n/offres — get our offers\n/stop — stop offers\n/aide — this help\n\nAny question? Just type it here.",
    unsubscribed: "You won't receive offers anymore. Type /start to reopen the menu.",
    fallback:
      "I didn't get that. Pick an option below, or type “human” to reach the team.",
    langSaved: "Language saved: English 🇬🇧",
    langPrompt: "Choose your language:",
    buttons: {
      catalog: "🛍️ Catalogue",
      orders: "📦 Track an order",
      offers: "🎁 Offers",
      human: "💬 Talk to a human",
      language: "🌍 Language",
      menu: "⬅️ Menu",
      whatsapp: "WhatsApp",
      site: "Visit the site",
      on: "Yes, send me offers",
      off: "Unsubscribe",
    },
    statusLabels: {
      pending: "Awaiting payment",
      paid: "Paid",
      delivered: "Delivered",
      manual: "Manual processing",
      failed: "Failed",
      expired: "Expired",
      new: "New",
      active: "Active",
      cancelled: "Cancelled",
    },
  },
};

export function botCopy(lang: TelegramLocale): TelegramCopy {
  return COPY[isTelegramLocale(lang) ? lang : "ar"];
}

/** Remplace `{site}`, `{store}`, `{whatsapp}`, `{email}`, `{ref}`… */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? values[key] : whole,
  );
}

/* --------------------------------- Claviers ------------------------------- */

export interface TelegramButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TelegramButtonLinks {
  site: string;
  store: string;
  whatsapp: string;
}

/** Boutons du menu principal (réutilisés après presque chaque réponse). */
export function mainMenuKeyboard(
  lang: TelegramLocale,
  links: TelegramButtonLinks,
): TelegramButton[][] {
  const copy = botCopy(lang);
  return [
    [
      { text: copy.buttons.catalog, url: links.store },
      { text: copy.buttons.orders, callback_data: "menu:orders" },
    ],
    [
      { text: copy.buttons.offers, callback_data: "menu:offers" },
      { text: copy.buttons.human, url: links.whatsapp },
    ],
    [
      { text: copy.buttons.language, callback_data: "menu:lang" },
      { text: copy.buttons.site, url: links.site },
    ],
  ];
}

export function languageKeyboard(): TelegramButton[][] {
  return [
    [
      { text: "العربية", callback_data: "lang:ar" },
      { text: "Français", callback_data: "lang:fr" },
    ],
    [{ text: "English", callback_data: "lang:en" }],
  ];
}

export function offersKeyboard(lang: TelegramLocale): TelegramButton[][] {
  const copy = botCopy(lang);
  return [
    [
      { text: copy.buttons.on, callback_data: "offers:on" },
      { text: copy.buttons.off, callback_data: "offers:off" },
    ],
    [{ text: copy.buttons.menu, callback_data: "menu:home" }],
  ];
}

/** Commandes proposées dans BotFather (`/setcommands`). */
export function botCommandList(): { command: string; description: string }[] {
  return [
    { command: "start", description: "Menu principal / Main menu / القائمة" },
    { command: "codes", description: "Catalogue & boutique / الكتالوج" },
    { command: "commande", description: "Statut d'une commande (ex. /commande DGC-…)" },
    { command: "offres", description: "Recevoir les offres / استلام العروض" },
    { command: "stop", description: "Ne plus recevoir les offres" },
    { command: "aide", description: "Aide / Help / مساعدة" },
  ];
}

/* ------------------------------ Rendu commande ---------------------------- */

export interface BotOrderSummary {
  ref: string;
  /** « digital » = codes/cartes, « web » = projet, abonnement, livraison… */
  kind: "digital" | "web";
  title: string;
  status: string;
  totalUsd: string;
  createdAt: string;
  trackingUrl: string;
}

/** Fiche de suivi lisible — aucune donnée personnelle, aucun code livré. */
export function formatBotOrderSummary(
  order: BotOrderSummary,
  lang: TelegramLocale,
  siteName: string,
): string {
  const copy = botCopy(lang);
  const label = copy.statusLabels[order.status] ?? order.status;
  const amount = order.totalUsd ? `${order.totalUsd} USD` : "—";
  const date = formatShortDate(order.createdAt, lang);
  const lines = [
    fillTemplate(copy.orderHeader, { ref: escapeTelegramHtml(order.ref) }),
    "",
    `📦 ${escapeTelegramHtml(order.title)}`,
    `📅 ${date}`,
    `💵 ${escapeTelegramHtml(amount)}`,
    `🔖 ${escapeTelegramHtml(label)}`,
  ];
  if (order.kind === "digital") {
    lines.push(
      "",
      lang === "ar"
        ? "لأسباب أمنية لا تُرسل الأكواد في تيليجرام: ستجدها في بريدك الإلكتروني."
        : lang === "fr"
          ? "Par sécurité, les codes ne sont jamais envoyés sur Telegram : vous les recevez par e-mail."
          : "For security, codes are never sent on Telegram: you receive them by email.",
    );
  }
  lines.push("", `${escapeTelegramHtml(siteName)} · ${escapeTelegramHtml(order.trackingUrl)}`);
  return lines.join("\n");
}

function formatShortDate(value: string, lang: TelegramLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return date.toLocaleDateString(lang === "ar" ? "ar-LY" : lang === "fr" ? "fr-FR" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Africa/Tripoli",
    });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/* ------------------------------ Alertes internes -------------------------- */

export interface LeadAlertInput {
  name: string;
  business: string;
  phone: string;
  email?: string | null;
  need: string;
  budget: string;
  deadline: string;
  message?: string | null;
  locale?: string | null;
  utm?: string | null;
}

/** Notification « nouvelle demande » pour l'équipe (chat admin). */
export function formatLeadAlert(lead: LeadAlertInput, siteName: string): string {
  const rows = [
    `🔔 <b>Nouvelle demande</b> — ${escapeTelegramHtml(siteName)}`,
    "",
    `👤 ${escapeTelegramHtml(lead.name)}${lead.business ? ` · ${escapeTelegramHtml(lead.business)}` : ""}`,
    `📞 ${escapeTelegramHtml(lead.phone)}`,
    lead.email ? `✉️ ${escapeTelegramHtml(lead.email)}` : null,
    `🎯 ${escapeTelegramHtml(lead.need)}`,
    `💰 ${escapeTelegramHtml(lead.budget)} · ⏳ ${escapeTelegramHtml(lead.deadline)}`,
    lead.message ? `\n💬 ${escapeTelegramHtml(clip(lead.message, 600))}` : null,
    `\n🌍 ${escapeTelegramHtml(lead.locale || "—")}${lead.utm ? ` · ${escapeTelegramHtml(clip(lead.utm, 120))}` : ""}`,
  ].filter((row): row is string => row !== null);
  return rows.join("\n");
}

export interface PaymentAlertInput {
  ref: string;
  kind: string;
  planName: string;
  amountUsd: string;
  clientName?: string | null;
  email?: string | null;
  phone?: string | null;
  payCurrency?: string | null;
  payAmount?: string | null;
  installments?: number;
  installmentIndex?: number;
  groupRef?: string | null;
  locale?: string | null;
  utm?: string | null;
}

/** Notification « paiement reçu » : l'argent entre, l'équipe doit le savoir. */
export function formatPaymentAlert(
  order: PaymentAlertInput,
  siteName: string,
  siteUrl: string,
  status: "paid" | "failed" | "expired" = "paid",
): string {
  const icon = status === "paid" ? "💰" : status === "failed" ? "⚠️" : "⌛";
  const title =
    status === "paid"
      ? "Paiement confirmé"
      : status === "failed"
        ? "Paiement échoué"
        : "Facture expirée";
  const payInfo =
    order.payCurrency && order.payAmount
      ? `${order.payAmount} ${order.payCurrency.toUpperCase()}`
      : "—";
  const tranche =
    order.installments && order.installments > 1
      ? `Tranche ${order.installmentIndex ?? 1}/${order.installments}${order.groupRef ? ` · ${order.groupRef}` : ""}`
      : null;
  return [
    `${icon} <b>${title}</b> — ${escapeTelegramHtml(siteName)}`,
    "",
    `🧾 <b>${escapeTelegramHtml(order.ref)}</b> · ${escapeTelegramHtml(order.planName)}`,
    `💵 <b>${escapeTelegramHtml(order.amountUsd)} USD</b> (${escapeTelegramHtml(payInfo)})`,
    tranche ? `🔢 ${escapeTelegramHtml(tranche)}` : null,
    order.clientName ? `👤 ${escapeTelegramHtml(order.clientName)}` : null,
    order.email ? `✉️ ${escapeTelegramHtml(order.email)}` : null,
    order.phone ? `📞 ${escapeTelegramHtml(order.phone)}` : null,
    `\n🛠️ ${escapeTelegramHtml(`${siteUrl.replace(/\/+$/, "")}/admin/orders`)}`,
  ]
    .filter((row): row is string => row !== null)
    .join("\n");
}

/* ------------------- Alerte échec de livraison fournisseur ------------------ */

export interface DeliveryAlertInput {
  ref: string;
  /** Nom du produit vendu (ex. « PlayStation Store 50 USD »). */
  productTitle: string;
  /** Fournisseur visé (fazercards / reloadly). */
  supplier: string;
  /** Montant payé par le client, en USD (texte tel que stocké). */
  totalUsd: string;
  /** E-mail du destinataire des codes. */
  recipientEmail?: string | null;
  /** Nombre de tentatives déjà consommées. */
  attempts: number;
  /** Tentatives maximales avant revue manuelle. */
  maxAttempts: number;
  /** Motif lisible du dernier échec (message fournisseur expurgé). */
  reason: string;
  /** `transient` = retry programmé ; `permanent` = revue manuelle immédiate. */
  kind: "transient" | "permanent" | "exhausted";
}

/**
 * Alerte Telegram « livraison fournisseur en échec ».
 *
 * Deux cas, deux tons :
 *  - retry programmé (`transient` avant épuisement) : information, rien à
 *    faire, on prévient juste l'équipe que la commande est payée et que
 *    l'achat sera retenté ;
 *  - revue manuelle (`permanent` ou `exhausted`) : action requise, le
 *    message dit explicitement ce qu'il faut faire (acheter le code à la
 *    main ou rembourser).
 *
 * Le motif est expurgé en amont (jamais de code, jamais de secret) et
 * tronqué ici : un message Telegram illisible ne sert à personne.
 */
export function formatDeliveryFailureAlert(
  input: DeliveryAlertInput,
  siteName: string,
  siteUrl: string,
): string {
  const base = siteUrl.replace(/\/+$/, "");
  const actionRequired = input.kind !== "transient";
  const header = actionRequired
    ? "🚨 <b>Livraison à traiter à la main</b>"
    : "⚠️ <b>Livraison fournisseur en échec — retry programmé</b>";
  const attemptLine =
    input.kind === "transient"
      ? `🔁 Tentative ${input.attempts}/${input.maxAttempts} — nouvel essai automatique`
      : input.kind === "exhausted"
        ? `🔁 ${input.attempts}/${input.maxAttempts} tentatives épuisées`
        : `🛑 Échec définitif après ${input.attempts} tentative(s)`;

  return [
    `${header} — ${escapeTelegramHtml(siteName)}`,
    "",
    `🧾 <b>${escapeTelegramHtml(input.ref)}</b> · ${escapeTelegramHtml(clip(input.productTitle, 80))}`,
    `💵 <b>${escapeTelegramHtml(input.totalUsd)} USD</b> déjà encaissés · fournisseur ${escapeTelegramHtml(input.supplier)}`,
    input.recipientEmail ? `✉️ ${escapeTelegramHtml(input.recipientEmail)}` : null,
    attemptLine,
    `❗ ${escapeTelegramHtml(clip(input.reason, 400))}`,
    actionRequired
      ? "\n👉 Acheter le code chez le fournisseur et le transmettre depuis l'admin, ou rembourser le client."
      : null,
    `\n🛠️ ${escapeTelegramHtml(`${base}/admin/digital/orders`)}`,
  ]
    .filter((row): row is string => row !== null)
    .join("\n");
}

function clip(value: string, max: number): string {
  const clean = value.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/* -------------------------------- Marketing ------------------------------- */

export interface BroadcastInput {
  body: string;
  siteName: string;
  siteUrl: string;
  /** Slug UTM pour mesurer la campagne dans le site. */
  slug?: string;
}

/**
 * Texte final d'une campagne : message de l'admin + signature avec un lien
 * marqué UTM (`utm_source=telegram&utm_medium=bot&utm_campaign=<slug>`),
 * pour que les ventes Telegram soient attribuées dans `/admin`.
 */
export function composeBroadcast({ body, siteName, siteUrl, slug }: BroadcastInput): string {
  const base = siteUrl.replace(/\/+$/, "");
  const campaign = sanitizeStartPayload(slug || "telegram");
  const link = `${base}/codes?utm_source=telegram&utm_medium=bot&utm_campaign=${campaign}`;
  return telegramClamp(`${body.trim()}\n\n— ${siteName}\n${link}`);
}

/** Valide le texte d'une campagne avant envoi (message clair à l'admin). */
export function validateBroadcast(body: string): { ok: true } | { ok: false; error: string } {
  const length = body.trim().length;
  if (length < 5) return { ok: false, error: "Message trop court (5 caractères minimum)." };
  if (length > 3000) return { ok: false, error: "Message trop long (3000 caractères maximum)." };
  return { ok: true };
}

/** Corps envoyé à un client qui vient d'écrire (transmis à l'équipe). */
export function formatCustomerRelay(input: {
  chatId: string;
  username?: string | null;
  firstName?: string | null;
  language: TelegramLocale;
  text: string;
}): string {
  return [
    "📨 <b>Message client (Telegram)</b>",
    "",
    `👤 ${escapeTelegramHtml(
      [input.firstName, input.username ? `@${input.username}` : null]
        .filter(Boolean)
        .join(" · ") || "—",
    )}`,
    `🆔 <code>${escapeTelegramHtml(input.chatId)}</code> · 🌍 ${input.language}`,
    "",
    escapeTelegramHtml(clip(input.text, 1500)),
  ].join("\n");
}
