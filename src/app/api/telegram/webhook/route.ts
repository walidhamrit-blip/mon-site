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
  findOrderForBot,
  getTelegramSubscriber,
  notifyTelegramAdmin,
  recordTelegramMessage,
  resolveWebhookSecret,
  saveTelegramSubscriber,
  sendTelegramMessage,
  setTelegramLanguage,
  setTelegramMarketingOptIn,
  telegramConfig,
  telegramApi,
  telegramConfigured,
  type SendMessageOptions,
} from "@/lib/telegram";

/**
 * Webhook du bot Telegram — `/api/telegram/webhook`.
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
  if (!telegramConfigured()) {
    return NextResponse.json(
      { ok: false, error: "telegram_not_configured" },
      { status: 503 },
    );
  }

  const secret = await resolveWebhookSecret();
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
      await handleCallback(update.callback_query);
    } else if (update.message?.text) {
      await handleMessage(update.message);
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

  const ctx = await botContext();
  const { command, args } = parseTelegramCommand(text);
  const stored = await getTelegramSubscriber(chatId);
  const language =
    command === "start"
      ? detectTelegramLocale(args, stored?.language ?? "ar")
      : stored?.language ?? detectTelegramLocale(text, "ar");

  await saveTelegramSubscriber({
    chatId,
    username: message.from?.username ?? null,
    firstName: message.from?.first_name ?? null,
    language,
    source: command === "start" ? sanitizeStartPayload(args) || null : stored ? undefined : "telegram",
  });

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
    case "codes":
    case "catalogue":
    case "catalog":
    case "shop":
      await reply(
        chatId,
        fillTemplate(botCopy(language).catalog, {
          store: `${ctx.siteUrl}/codes`,
        }),
        {
          keyboard: [
            [{ text: botCopy(language).catalogButton, url: `${ctx.siteUrl}/codes` }],
            [{ text: botCopy(language).buttons.menu, callback_data: "menu:home" }],
          ],
        },
      );
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
  const ctx = await botContext();
  const stored = await getTelegramSubscriber(chatId);
  const language: TelegramLocale = stored?.language ?? "ar";
  const copy = botCopy(language);

  await telegramAnswerCallback(query.id);

  await saveTelegramSubscriber({
    chatId,
    username: query.from.username ?? null,
    firstName: query.from.first_name ?? null,
    language,
  });

  if (data === "menu:home") {
    await reply(chatId, copy.menuTitle, { keyboard: mainMenuKeyboard(language, links(ctx)) });
    return;
  }
  if (data === "menu:orders") {
    await reply(chatId, copy.ordersPrompt, {
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
    await reply(chatId, copy.langPrompt, { keyboard: languageKeyboard() });
    return;
  }
  if (data === "offers:on") {
    await setTelegramMarketingOptIn(chatId, true);
    await reply(chatId, copy.offersOn, {
      keyboard: mainMenuKeyboard(language, links(ctx)),
    });
    return;
  }
  if (data === "offers:off") {
    await setTelegramMarketingOptIn(chatId, false);
    await reply(chatId, copy.offersOff, {
      keyboard: mainMenuKeyboard(language, links(ctx)),
    });
    return;
  }
  if (data.startsWith("lang:")) {
    const chosen = data.slice(5);
    if (isTelegramLocale(chosen)) {
      await setTelegramLanguage(chatId, chosen);
      const chosenCopy = botCopy(chosen);
      await reply(chatId, `${chosenCopy.langSaved}\n\n${chosenCopy.menuTitle}`, {
        keyboard: mainMenuKeyboard(chosen, links(ctx)),
      });
      return;
    }
  }
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
  );
}

/* --------------------------------- Outils --------------------------------- */

function links(ctx: BotContext) {
  return {
    site: ctx.siteUrl,
    store: `${ctx.siteUrl}/codes`,
    whatsapp: ctx.whatsapp,
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
  return {
    siteName: config?.name ?? "Nukhba",
    siteUrl: siteBaseUrl().replace(/\/+$/, ""),
    email: config?.email ?? "",
    whatsapp: config?.social?.whatsapp ?? "",
  };
}

/** Comparaison à temps constant entre le secret reçu et celui attendu. */
function safeEqual(received: string, expected: string): boolean {
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
