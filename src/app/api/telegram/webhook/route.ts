import { measureTelegram, traceTelegram, telegramServerTiming } from "@/lib/telegram-performance";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSiteDataCached } from "@/lib/store";
import { siteBaseUrl } from "@/lib/site-url";
import {
  detectTelegramLocale,
  fillTemplate,
  formatBotOrderSummary,
  formatCustomerRelay,
  isTelegramLocale,
  languageKeyboard,
  mainMenuKeyboard,
  telegramMiniAppUrl,
  botCopy,
  offersKeyboard,
  orderRefFromStartPayload,
  orderRefFromText,
  parseTelegramCommand,
  sanitizeStartPayload,
  type TelegramLocale,
} from "@/lib/telegram-core";
import {
  formatWatchConfirmation,
  watchOrderFromTelegram,
} from "@/lib/telegram-delivery";
import {
  handleShopCallback,
  handleShopEmailInput,
  openTelegramShop,
  openTelegramShopCategory,
  type ShopBotContext,
} from "@/lib/telegram-shop";
import { shopTargetFromStartPayload } from "@/lib/telegram-links";
import { shopLocale, shopWhatsappUrl } from "@/lib/telegram-shop-core";

import {
  clearTelegramPendingCheckout,
  findOrderForBot,
  getTelegramSubscriber,
  notifyTelegramAdmin,
  recordTelegramMessage,
  resolveWebhookSecret,
  saveTelegramSubscriber,
  sendTelegramMessage,
  editTelegramMessage,
  setTelegramLanguage,
  setTelegramMarketingOptIn,
  telegramConfig,
  telegramApi,
  telegramConfigured,
  type SendMessageOptions,
} from "@/lib/telegram";

/**
 * Webhook du bot Telegram — `/api/telegram-webhook`.
 *
 * URL canonique déclarée à Telegram (`setWebhook`) ; l'ancienne adresse
 * `/api/telegram/webhook` reste valable via une rewrite `next.config.ts`
 * (aucune installation existante à casser).
 *
 * Telegram POSTe chaque message / clic de bouton ici. Trois règles :
 *
 *  1. **Authentification** : l'en-tête `x-telegram-bot-api-secret-token`
 *     doit correspondre au secret du `setWebhook` (env ou base). Sans
 *     secret configuré, la route refuse tout : une URL de webhook devinée
 *     ne doit pas permettre d'injecter de faux messages ni de polluer la
 *     base d'abonnés.
 *  2. **Toujours répondre 200** une fois authentifié : un 5xx déclenche
 *     des ré-envois Telegram en boucle (et donc des messages doublés aux
 *     clients). Les erreurs sont journalisées, pas renvoyées.
 *  3. **Aucune donnée sensible** : le bot ne renvoie jamais de code livré,
 *     d'e-mail complet ni d'adresse crypto — seulement statut, libellé,
 *     montant, date.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
  /** Code de langue du client Telegram (« ar », « en-US »…), indicatif seulement. */
  language_code?: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  date: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface BotContext {
  siteName: string;
  siteUrl: string;
  email: string;
  whatsapp: string;
}

export async function GET() {
  const { token, botUsername, adminChatId } = telegramConfig();
  return NextResponse.json({
    ok: true,
    configured: telegramConfigured(),
    bot: botUsername ? `@${botUsername}` : null,
    alerts: Boolean(adminChatId),
    expects: "POST (webhook Telegram)",
    tokenFormat: Boolean(token),
  });
}

export async function POST(req: Request) {
  return traceTelegram("webhook", async (trace) => {
    const response = await measureTelegram("webhook_total", () => processUpdate(req));
    response.headers.set("Server-Timing", telegramServerTiming(trace));
    return response;
  });
}

async function processUpdate(req: Request) {
  if (!telegramConfigured()) {
    return NextResponse.json(
      { ok: false, error: "telegram_not_configured" },
      { status: 503 },
    );
  }

  const secret = await measureTelegram("auth_secret", () => resolveWebhookSecret());
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "webhook_secret_missing" },
      { status: 503 },
    );
  }

  const provided = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ ok: false, error: "invalid_secret" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    if (update.callback_query) {
      await measureTelegram("callback_total", () => handleCallback(update.callback_query!));
    } else if (update.message?.text) {
      await measureTelegram("message_total", () => handleMessage(update.message!));
    }
  } catch (error) {
    console.warn(
      "[telegram] mise à jour ignorée :",
      error instanceof Error ? error.message : error,
    );
  }

  return NextResponse.json({ ok: true });
}

/* --------------------------------- Routage -------------------------------- */

async function handleMessage(message: TelegramMessage): Promise<void> {
  // Uniquement les conversations privées : les groupes sont réservés aux
  // alertes internes (on n'y répond pas, sous peine de bruit).
  if (message.chat.type !== "private" || message.from?.is_bot) return;

  const chatId = String(message.chat.id);
  const text = (message.text ?? "").trim();
  if (!text) return;

  const ctx = await measureTelegram("site_context", () => botContext());
  const { command, args } = parseTelegramCommand(text);
  const stored = await measureTelegram("db_subscriber", () => getTelegramSubscriber(chatId));
  const isNew = !stored;
  const actor = {
    chatId,
    username: message.from?.username ?? null,
    firstName: message.from?.first_name ?? null,
  };

  // Langue : le choix EXPLICITE du client (boutons 🇬🇧/🇱🇾) prime — on ne
  // re-détecte pas à chaque message. Les nouveaux arrivants voient le
  // choix de langue dès /start ; un premier message libre garde la
  // détection automatique (ar par défaut, comme le site).
  // Lien « Continuer sur Telegram » du site (`/start shop-ar-gift_card`) :
  // la langue de la page visitée sert pour un nouvel arrivant.
  const shopTarget = command === "start" ? shopTargetFromStartPayload(args) : null;
  const language =
    stored?.language ?? shopTarget?.locale ?? detectTelegramLocale(command === "start" ? args : text, "ar");

  // Écriture abonné uniquement si nouveau chat, langue, pseudo ou prénom
  // changé (même optimisation que handleCallback, comparaison sur les champs
  // renvoyés par getTelegramSubscriber) : évite un upsert à chaque message.
  if (
    !stored ||
    stored.language !== language ||
    stored.username !== (message.from?.username ?? null) ||
    stored.firstName !== (message.from?.first_name ?? null)
  ) {
    await saveTelegramSubscriber({
      chatId,
      username: message.from?.username ?? null,
      firstName: message.from?.first_name ?? null,
      language,
      source: command === "start" ? sanitizeStartPayload(args) || null : stored ? undefined : "telegram",
    });
  }

  // Toute commande explicite (`/start`, `/aide`, `/commande`…) sort d'une
  // éventuelle attente d'e-mail pour éviter un état « pending » fantôme.
  if (command && command !== "shop" && command !== "codes" && command !== "catalogue" && command !== "catalog") {
    await clearTelegramPendingCheckout(chatId);
  }

  switch (command) {
    case "start": {
      // `/start order-dgc-…` : le client arrive depuis la page de suivi
      // d'une commande. On l'abonne immédiatement (consentement explicite :
      // il a cliqué un bouton « recevoir sur Telegram ») et on lui répond
      // avec le statut plutôt qu'avec le menu générique.
      const watchedRef = orderRefFromStartPayload(args);
      if (watchedRef) {
        await watchFromMessage(chatId, watchedRef, language, ctx);
        return;
      }
      // Arrivée depuis un rayon du site : boutique ouverte directement sur
      // ce rayon, dans la langue de la page (pas d'écran de langue).
      if (shopTarget) {
        await openTelegramShopCategory(actor, shopTarget.kind, shopLocale(language), shopCtx(ctx));
        return;
      }
      if (isNew) {
        // Choix de la langue dès /start (🇬🇧 English / 🇱🇾 العربية) —
        // le menu complet arrive dans la langue choisie.
        await reply(chatId, fillTemplate(botCopy(language).welcomeChoice, { site: ctx.siteName }), {
          keyboard: languageKeyboard(),
        });
        return;
      }
      await reply(
        chatId,
        fillTemplate(botCopy(language).welcome, { site: ctx.siteName }),
        { keyboard: mainMenuKeyboard(language, links(ctx)) },
      );
      return;
    }
    case "prevenir":
    case "notify":
    case "notifications":
      // `/prevenir DGC-…` : même consentement, saisi à la main dans le chat.
      await watchFromMessage(chatId, args, language, ctx);
      return;
    case "aide":
    case "help":
      await reply(chatId, botCopy(language).help, {
        keyboard: mainMenuKeyboard(language, links(ctx)),
      });
      return;
    case "shop":
    case "codes":
    case "catalogue":
    case "catalog":
      // Boutique INLINE : catégories → produits → paiement dans le même
      // message. Le lien web reste accessible depuis chaque vue.
      await openTelegramShop(chatId, null, shopLocale(language), shopCtx(ctx));
      return;
    case "commande":
    case "order":
    case "suivi":
      await sendOrderStatus(chatId, language, args, ctx);
      return;
    case "offres":
    case "offers":
    case "promo":
      await askOffers(chatId, language, stored?.marketingOptIn ?? false, ctx);
      return;
    case "stop":
    case "desabonner":
      await setTelegramMarketingOptIn(chatId, false);
      await reply(chatId, botCopy(language).offersOff);
      return;
    case "langue":
    case "lang":
    case "language":
      await reply(chatId, botCopy(language).langPrompt, { keyboard: languageKeyboard() });
      return;
    default:
      break;
  }

  // Caisse en attente : le texte suivant est l'e-mail de livraison.
  if (await handleShopEmailInput(actor, null, text, shopLocale(language), shopCtx(ctx))) {
    return;
  }

  // Texte libre : référence de commande, demande d'humain, ou question.
  await recordTelegramMessage(chatId, text);
  const ref = orderRefFromText(text);
  if (ref) {
    await sendOrderStatus(chatId, language, ref, ctx);
    return;
  }

  if (wantsHuman(text)) {
    await reply(
      chatId,
      fillTemplate(botCopy(language).human, {
        whatsapp: ctx.whatsapp,
        email: ctx.email,
      }),
      { keyboard: mainMenuKeyboard(language, links(ctx)) },
    );
    await forwardToTeam(chatId, message, language);
    return;
  }

  await reply(chatId, botCopy(language).fallback, {
    keyboard: mainMenuKeyboard(language, links(ctx)),
  });
  await forwardToTeam(chatId, message, language);
}

async function handleCallback(query: TelegramCallbackQuery): Promise<void> {
  const chatId = String(query.from.id);
  const data = (query.data ?? "").trim();
  const fromUsername = query.from.username ?? null;
  const fromFirstName = query.from.first_name ?? null;

  // 1) On acquitte le callback Telegram AVANT tout traitement long (lecture
  //    du site, base, boutique inline) : le spinner du bouton s'arrête
  //    immédiatement. answerCallbackQuery est indépendant de la réponse/edit
  //    qui suit, et la route renvoie 200 quoi qu'il arrive.
  await measureTelegram("callback_ack", () => telegramAnswerCallback(query.id));

  const ctx = await measureTelegram("site_context", () => botContext());
  const stored = await measureTelegram("db_subscriber", () => getTelegramSubscriber(chatId));
  const language: TelegramLocale = stored?.language ?? "ar";
  const copy = botCopy(language);
  // Navigation « au même endroit » : la boutique (et le menu) éditent le
  // message du clavier au lieu d'empiler des bulles.
  const messageId = query.message?.message_id ?? null;

  // 2) Écriture abonné uniquement si nécessaire : nouveau chat, ou l'un des
  //    champs utiles a changé (langue / pseudo / prénom). On compare sur le
  //    retour de getTelegramSubscriber (qui renvoie désormais ces champs)
  //    afin de ne pas perdre une mise à jour d'information tout en évitant un
  //    upsert PostgreSQL à chaque navigation de bout en bout.
  if (
    !stored ||
    stored.language !== language ||
    stored.username !== fromUsername ||
    stored.firstName !== fromFirstName
  ) {
    await saveTelegramSubscriber({
      chatId,
      username: fromUsername,
      firstName: fromFirstName,
      language,
    });
  }

  const actor = {
    chatId,
    username: query.from.username ?? null,
    firstName: query.from.first_name ?? null,
  };

  // Boutique inline : catégories → produits → détails & paiement, en
  // éditant le même message. `false` = pas une callback boutique.
  if (await handleShopCallback(actor, messageId, data, shopLocale(language), shopCtx(ctx))) {
    return;
  }

  if (data === "menu:home") {
    await clearTelegramPendingCheckout(chatId);
    await replyOrEdit(chatId, messageId, copy.menuTitle, {
      keyboard: mainMenuKeyboard(language, links(ctx)),
    });
    return;
  }
  if (data === "menu:orders") {
    await replyOrEdit(chatId, messageId, copy.ordersPrompt, {
      keyboard: [
        [{ text: copy.ordersButton, url: `${ctx.siteUrl}/codes/commande` }],
        [{ text: copy.buttons.menu, callback_data: "menu:home" }],
      ],
    });
    return;
  }
  if (data === "menu:offers") {
    await askOffers(chatId, language, stored?.marketingOptIn ?? false, ctx);
    return;
  }
  if (data === "menu:lang") {
    await replyOrEdit(chatId, messageId, copy.langPrompt, { keyboard: languageKeyboard() });
    return;
  }
  if (data === "offers:on") {
    await setTelegramMarketingOptIn(chatId, true);
    await replyOrEdit(chatId, messageId, copy.offersOn, {
      keyboard: mainMenuKeyboard(language, links(ctx)),
    });
    return;
  }
  if (data === "offers:off") {
    await setTelegramMarketingOptIn(chatId, false);
    await replyOrEdit(chatId, messageId, copy.offersOff, {
      keyboard: mainMenuKeyboard(language, links(ctx)),
    });
    return;
  }
  if (data.startsWith("lang:")) {
    const chosen = data.slice(5);
    if (isTelegramLocale(chosen)) {
      await setTelegramLanguage(chatId, chosen);
      const chosenCopy = botCopy(chosen);
      // Première visite : enchaîner directement sur le menu complet.
      const text = isNewSubscriberAfterLanguageChoice(stored)
        ? `${chosenCopy.langSaved}\n\n${fillTemplate(chosenCopy.welcome, { site: ctx.siteName })}`
        : `${chosenCopy.langSaved}\n\n${chosenCopy.menuTitle}`;
      await replyOrEdit(chatId, messageId, text, {
        keyboard: mainMenuKeyboard(chosen, links(ctx)),
      });
      return;
    }
  }
}

/**
 * Édite le message du clavier ; si l'édition est impossible (message trop
 * ancien, supprimé…), envoie un nouveau message — jamais de réponse muette.
 */
async function replyOrEdit(
  chatId: string,
  messageId: number | null,
  text: string,
  options: SendMessageOptions = {},
): Promise<void> {
  const edited = messageId
    ? await editTelegramMessage(chatId, messageId, text, { parseMode: "HTML", ...options })
    : { ok: false as const };
  if (!edited.ok) {
    await reply(chatId, text, options);
  }
}

/** Le client n'avait pas encore de langue enregistrée (premier /start). */
function isNewSubscriberAfterLanguageChoice(
  stored: Awaited<ReturnType<typeof getTelegramSubscriber>>,
): boolean {
  return !stored;
}

/* ------------------------------- Actions bot ------------------------------ */

async function sendOrderStatus(
  chatId: string,
  language: TelegramLocale,
  rawRef: string,
  ctx: BotContext,
): Promise<void> {
  const copy = botCopy(language);
  const ref = orderRefFromText(rawRef);
  if (!ref) {
    await reply(chatId, copy.ordersPrompt, {
      keyboard: [
        [{ text: copy.ordersButton, url: `${ctx.siteUrl}/codes/commande` }],
        [{ text: copy.buttons.menu, callback_data: "menu:home" }],
      ],
    });
    return;
  }

  const order = await findOrderForBot(ref);
  if (!order) {
    await reply(chatId, copy.orderNotFound, {
      keyboard: mainMenuKeyboard(language, links(ctx)),
    });
    return;
  }

  const trackingUrl = `${ctx.siteUrl}${order.trackingUrl}`;
  await reply(
    chatId,
    formatBotOrderSummary({ ...order, trackingUrl }, language, ctx.siteName),
    {
      keyboard: [
        [{ text: copy.ordersButton, url: trackingUrl }],
        [{ text: copy.buttons.menu, callback_data: "menu:home" }],
      ],
    },
  );
}

/**
 * Abonne le chat à la livraison d'une commande, puis répond avec le statut.
 *
 * Le message de confirmation dit explicitement que le CODE ne transite pas
 * par Telegram : le client ne doit pas attendre un code dans le chat.
 */
async function watchFromMessage(
  chatId: string,
  rawRef: string,
  language: TelegramLocale,
  ctx: BotContext,
): Promise<void> {
  const copy = botCopy(language);
  const ref = orderRefFromText(rawRef) ?? orderRefFromStartPayload(rawRef);
  if (!ref) {
    await reply(chatId, copy.watchPrompt, {
      keyboard: mainMenuKeyboard(language, links(ctx)),
    });
    return;
  }

  const result = await watchOrderFromTelegram(chatId, ref, language);
  if (!result.ok) {
    const message =
      result.error === "bot_unavailable"
        ? copy.botUnavailable
        : result.error === "not_digital"
          ? copy.watchNotDigital
          : copy.orderNotFound;
    await reply(chatId, message, { keyboard: mainMenuKeyboard(language, links(ctx)) });
    return;
  }

  await reply(chatId, formatWatchConfirmation(result.ref, language, ctx.siteName), {
    keyboard: [
      [
        {
          text: copy.ordersButton,
          url: `${ctx.siteUrl}/codes/commande?ref=${encodeURIComponent(result.ref)}`,
        },
      ],
      [{ text: copy.buttons.menu, callback_data: "menu:home" }],
    ],
  });
}

async function askOffers(
  chatId: string,
  language: TelegramLocale,
  alreadyOptedIn: boolean,
  ctx: BotContext,
): Promise<void> {
  const copy = botCopy(language);
  if (!alreadyOptedIn) {
    await reply(chatId, fillTemplate(copy.offersAsk, { site: ctx.siteName }), {
      keyboard: offersKeyboard(language),
    });
    return;
  }
  await reply(chatId, copy.offersAlready, { keyboard: offersKeyboard(language) });
}

async function forwardToTeam(
  chatId: string,
  message: TelegramMessage,
  language: TelegramLocale,
): Promise<void> {
  if (!telegramConfig().adminChatId) return;
  await notifyTelegramAdmin(
    formatCustomerRelay({
      chatId,
      username: message.from?.username ?? null,
      firstName: message.from?.first_name ?? null,
      language,
      text: message.text ?? "",
    }),
    undefined,
    { parseMode: "HTML" },
  );
}

/* --------------------------------- Outils --------------------------------- */

function links(ctx: BotContext) {
  const miniApp = telegramMiniAppUrl(ctx.siteUrl);
  return {
    site: ctx.siteUrl,
    store: `${ctx.siteUrl}/codes`,
    whatsapp: ctx.whatsapp,
    // Vitrine avec photos (Mini App `/tg`) — ajoutée en tête du menu.
    ...(miniApp ? { miniApp } : {}),
  };
}

async function reply(
  chatId: string,
  text: string,
  options: SendMessageOptions = {},
): Promise<void> {
  await sendTelegramMessage(chatId, text, { parseMode: "HTML", ...options });
}

async function telegramAnswerCallback(id: string): Promise<void> {
  await telegramApi("answerCallbackQuery", { callback_query_id: id });
}

const HUMAN_HINTS =
  /(humain|human|agent|conseiller|support|op[ée]rateur|بشري|موظف|دعم|مسؤول)/i;

/** Le client demande-t-il explicitement un humain ? */
function wantsHuman(text: string): boolean {
  return HUMAN_HINTS.test(text);
}

async function botContext(): Promise<BotContext> {
  const site = await getSiteDataCached().catch(() => null);
  const config = site?.config;
  const whatsappUrl =
    shopWhatsappUrl(config?.social?.whatsapp) ??
    shopWhatsappUrl(config?.whatsapp) ??
    config?.social?.whatsapp ??
    "";
  return {
    siteName: config?.name ?? "Nukhba",
    siteUrl: siteBaseUrl().replace(/\/+$/, ""),
    email: config?.email ?? "",
    whatsapp: whatsappUrl,
  };
}

/** Contexte attendu par la boutique inline (site + boutique web + WhatsApp). */
function shopCtx(ctx: BotContext): ShopBotContext {
  return {
    siteName: ctx.siteName,
    siteUrl: ctx.siteUrl,
    storeUrl: `${ctx.siteUrl}/codes`,
    whatsapp: ctx.whatsapp,
  };
}

/** Comparaison à temps constant entre le secret reçu et celui attendu. */
function safeEqual(received: string, expected: string): boolean {
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
