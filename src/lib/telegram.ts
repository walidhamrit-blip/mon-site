import { measureTelegram } from "@/lib/telegram-performance";
/**
 * Bot Telegram — accès réseau (API Bot) + persistance.
 *
 * Ce module est **serveur uniquement** : il lit `TELEGRAM_BOT_TOKEN` et ne
 * doit jamais être importé par un composant client (le jeton donnerait à
 * quiconque le contrôle du bot).
 *
 * Philosophie : tout est « au mieux ». Une panne Telegram ne doit jamais
 * faire échouer une commande, un paiement ou une demande de devis — les
 * fonctions de notification renvoient un résultat, elles ne lèvent pas.
 *
 * Mise en place (résumé — guide détaillé : `docs/telegram-bot.md`) :
 *   1. @BotFather → /newbot → coller `TELEGRAM_BOT_TOKEN` dans Vercel ;
 *   2. envoyer un message au bot, lire le chat id, coller
 *      `TELEGRAM_ADMIN_CHAT_ID` (alertes ventes & demandes) ;
 *   3. `/admin/telegram` → « Installer le webhook » (secret généré seul).
 */

import { desc, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders, digitalOrders, settings, telegramCampaigns, telegramSubscribers } from "@/db/schema";
import {
  composeBroadcast,
  escapeTelegramHtml,
  formatDeliveryFailureAlert,
  formatLeadAlert,
  formatPaymentAlert,
  isTelegramBotToken,
  isTelegramLocale,
  telegramClamp,
  type BotOrderSummary,
  type DeliveryAlertInput,
  type LeadAlertInput,
  type PaymentAlertInput,
  type TelegramButton,
  type TelegramLocale,
} from "@/lib/telegram-core";

const API_BASE = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 8_000;
const WEBHOOK_SECRET_SETTING = "telegram_webhook_secret";
const SHOP_EVENTS_SETTING = "telegram:shop-events";
const MAX_SHOP_EVENTS = 25;
/** Telegram : ~30 messages/seconde par bot. On reste large en dessous. */
const BROADCAST_CHUNK = 20;
const BROADCAST_PAUSE_MS = 1_100;
/** Plafond par envoi : une fonction Vercel doit répondre en moins de 60 s. */
export const BROADCAST_MAX_RECIPIENTS = 400;

export interface TelegramConfig {
  token: string;
  adminChatId: string;
  webhookSecret: string;
  botUsername: string;
}

/** Configuration lue dans l'environnement (aucune valeur codée en dur). */
export function telegramConfig(): TelegramConfig {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  return {
    token: isTelegramBotToken(token) ? token : "",
    adminChatId: (process.env.TELEGRAM_ADMIN_CHAT_ID ?? "").trim(),
    webhookSecret: (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim(),
    botUsername: (process.env.TELEGRAM_BOT_USERNAME ?? "").trim().replace(/^@/, ""),
  };
}

/** Le bot est-il configuré (jeton au bon format) ? */
export function telegramConfigured(): boolean {
  return Boolean(telegramConfig().token);
}

/* --------------------------------- API Bot -------------------------------- */

export interface TelegramApiResult<T = unknown> {
  ok: boolean;
  result?: T;
  error?: string;
}

/**
 * Appel générique à l'API Bot. Ne lève jamais : renvoie `{ ok: false }`
 * avec le message Telegram (`description`) pour l'afficher dans l'admin.
 */
export async function telegramApi<T = unknown>(
  method: string,
  payload: Record<string, unknown> = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<TelegramApiResult<T>> {
  // Allowlisted method names only: never log the API URL (it contains the token).
  const label = ["answerCallbackQuery", "editMessageText", "sendMessage"].includes(method) ? method : "other";
  return measureTelegram(`network_${label}`, () => telegramApiRequest<T>(method, payload, timeoutMs));
}

async function telegramApiRequest<T = unknown>(
  method: string,
  payload: Record<string, unknown> = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<TelegramApiResult<T>> {
  const { token } = telegramConfig();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN absent ou invalide." };

  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; result?: T; description?: string }
      | null;
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.description ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, result: data.result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "requête Telegram impossible",
    };
  }
}

export interface SendMessageOptions {
  keyboard?: TelegramButton[][];
  /** HTML par défaut (textes du bot) ; `undefined` = texte brut (campagnes). */
  parseMode?: "HTML" | undefined;
  disablePreview?: boolean;
  /** Délai max : court pour les alertes (ne pas ralentir un formulaire). */
  timeoutMs?: number;
}

/** Envoie un message à un chat. Renvoie `ok: false` + motif, sans lever. */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: SendMessageOptions = {},
): Promise<TelegramApiResult<{ message_id: number }>> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: telegramClamp(text),
    link_preview_options: { is_disabled: options.disablePreview !== false },
  };
  if (options.parseMode !== undefined) body.parse_mode = options.parseMode;
  if (options.keyboard?.length) body.reply_markup = { inline_keyboard: options.keyboard };
  return telegramApi<{ message_id: number }>("sendMessage", body, options.timeoutMs);
}

/**
 * Met à jour un message existant (`editMessageText`) — c'est ce qui rend la
 * navigation boutique fluide : catégories → produits → paiement remplacent
 * le même message au lieu d'empiler des bulles.
 *
 * `ok: true` sur « message is not modified » (re-clic sur le bouton déjà
 * affiché : rien à faire, ce n'est pas une erreur). L'appelant retombe sur
 * `sendMessage` quand le message n'est plus éditable (trop ancien, supprimé).
 */
export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  options: SendMessageOptions = {},
): Promise<TelegramApiResult> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text: telegramClamp(text),
    link_preview_options: { is_disabled: options.disablePreview !== false },
  };
  if (options.parseMode !== undefined) body.parse_mode = options.parseMode;
  if (options.keyboard?.length) body.reply_markup = { inline_keyboard: options.keyboard };
  const result = await telegramApi("editMessageText", body, options.timeoutMs);
  if (!result.ok && /message is not modified/i.test(result.error ?? "")) {
    return { ok: true };
  }
  return result;
}

/** Message au chat d'administration (alertes). Silencieux si non configuré. */
export async function notifyTelegramAdmin(
  text: string,
  keyboard?: TelegramButton[][],
  options: { parseMode?: "HTML"; timeoutMs?: number } = {},
): Promise<TelegramApiResult> {
  const { adminChatId } = telegramConfig();
  if (!adminChatId) return { ok: false, error: "TELEGRAM_ADMIN_CHAT_ID absent." };
  return sendTelegramMessage(adminChatId, text, {
    keyboard,
    parseMode: options.parseMode,
    timeoutMs: options.timeoutMs,
  });
}

/* --------------------------- Alertes métier (push) ------------------------ */

/**
 * Nouvelle demande de devis. Appelée depuis `/api/lead` APRÈS l'envoi des
 * e-mails : Telegram est un canal de plus, jamais un point de blocage.
 */
export async function notifyTelegramLead(
  lead: LeadAlertInput,
  siteName: string,
  siteUrl: string,
): Promise<void> {
  if (!telegramConfigured()) return;
  const { adminChatId } = telegramConfig();
  if (!adminChatId) return;
  const base = siteUrl.replace(/\/+$/, "");
  await sendTelegramMessage(adminChatId, formatLeadAlert(lead, siteName), {
    parseMode: "HTML",
    timeoutMs: 4_000,
    keyboard: [
      [
        { text: "📥 Demandes", url: `${base}/admin/leads` },
        { text: "💬 WhatsApp", url: `https://wa.me/${lead.phone.replace(/[^\d]/g, "")}` },
      ],
    ],
  }).catch(() => undefined);
}

/**
 * Paiement confirmé / échoué / expiré. Branché dans `sendPaymentConfirmedEmail`
 * pour couvrir d'un coup les projets web, les abonnements et les commandes
 * digitales.
 */
export async function notifyTelegramPayment(
  order: PaymentAlertInput,
  siteName: string,
  siteUrl: string,
  status: "paid" | "failed" | "expired" = "paid",
): Promise<void> {
  if (!telegramConfigured()) return;
  const { adminChatId } = telegramConfig();
  if (!adminChatId) return;
  const base = siteUrl.replace(/\/+$/, "");
  await sendTelegramMessage(
    adminChatId,
    formatPaymentAlert(order, siteName, siteUrl, status),
    {
      parseMode: "HTML",
      timeoutMs: 4_000,
      keyboard: [
        [{ text: "🧾 Voir la commande", url: `${base}/admin/orders` }],
      ],
    },
  ).catch(() => undefined);
}

/**
 * Échec de livraison fournisseur (FazerCards / Reloadly).
 *
 * Appelée par la file de livraison (`delivery-queue.ts`) quand un achat
 * échoue : alerte instantanée dans le chat admin, avec un bouton qui ouvre
 * la commande. Comme les autres notifications, elle ne lève JAMAIS : une
 * panne Telegram ne doit pas empêcher un retry de livraison.
 */
export async function notifyTelegramDeliveryFailure(
  alert: DeliveryAlertInput,
  siteName: string,
  siteUrl: string,
): Promise<void> {
  if (!telegramConfigured()) return;
  const { adminChatId } = telegramConfig();
  if (!adminChatId) return;
  const base = siteUrl.replace(/\/+$/, "");
  await sendTelegramMessage(
    adminChatId,
    formatDeliveryFailureAlert(alert, siteName, siteUrl),
    {
      parseMode: "HTML",
      timeoutMs: 4_000,
      keyboard: [
        [{ text: "📦 Traiter la commande", url: `${base}/admin/digital/orders` }],
      ],
    },
  ).catch(() => undefined);
}

/* -------------------------------- Webhook --------------------------------- */

/**
 * Secret du webhook : `TELEGRAM_WEBHOOK_SECRET` s'il existe, sinon celui
 * généré et stocké en base par le bouton « Installer le webhook » de
 * `/admin/telegram`. Un webhook sans secret est refusé (n'importe qui
 * pourrait injecter de fausses mises à jour).
 */
export async function resolveWebhookSecret(): Promise<string> {
  const { webhookSecret } = telegramConfig();
  if (webhookSecret) return webhookSecret;
  try {
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, WEBHOOK_SECRET_SETTING))
      .limit(1);
    return typeof row?.value === "string" ? row.value : "";
  } catch {
    return "";
  }
}

export async function storeWebhookSecret(secret: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key: WEBHOOK_SECRET_SETTING, value: secret, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: secret, updatedAt: new Date() },
    });
}

/**
 * Déclare l'URL du webhook auprès de Telegram. Le secret est généré ici
 * (32 octets) puis mémorisé : l'admin n'a aucun secret à inventer.
 *
 * URL canonique : `/api/telegram-webhook` (alias `/api/telegram/webhook`
 * conservé via une rewrite next.config pour les installations existantes).
 */
export async function installTelegramWebhook(
  siteUrl: string,
): Promise<{ ok: boolean; url: string; error?: string }> {
  const base = siteUrl.replace(/\/+$/, "");
  const url = `${base}/api/telegram-webhook`;
  if (!telegramConfigured()) {
    return { ok: false, url, error: "TELEGRAM_BOT_TOKEN absent ou invalide." };
  }
  let secret = telegramConfig().webhookSecret;
  if (!secret) {
    secret = (await resolveWebhookSecret()) || randomSecret();
    await storeWebhookSecret(secret).catch(() => undefined);
  }
  const result = await telegramApi("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  return result.ok ? { ok: true, url } : { ok: false, url, error: result.error };
}

function randomSecret(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Identité du bot (`getMe`) — sert à afficher le vrai @username. */
export async function telegramBotIdentity(): Promise<{ username: string; name: string } | null> {
  if (!telegramConfigured()) return null;
  const result = await telegramApi<{ username?: string; first_name?: string }>("getMe");
  if (!result.ok || !result.result?.username) return null;
  return {
    username: result.result.username,
    name: result.result.first_name ?? result.result.username,
  };
}

export interface TelegramWebhookStatus {
  configured: boolean;
  url?: string;
  pendingUpdates?: number;
  lastError?: string;
  lastErrorAt?: string;
}

/** État réel côté Telegram (affiché dans /admin/telegram). */
export async function telegramWebhookStatus(): Promise<TelegramWebhookStatus> {
  if (!telegramConfigured()) return { configured: false };
  const result = await telegramApi<{
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
    last_error_date?: number;
  }>("getWebhookInfo");
  if (!result.ok) return { configured: false, lastError: result.error };
  return {
    configured: Boolean(result.result?.url),
    url: result.result?.url,
    pendingUpdates: result.result?.pending_update_count ?? 0,
    lastError: result.result?.last_error_message,
    lastErrorAt: result.result?.last_error_date
      ? new Date(result.result.last_error_date * 1000).toISOString()
      : undefined,
  };
}

export async function deleteTelegramWebhook(): Promise<TelegramApiResult> {
  return telegramApi("deleteWebhook", { drop_pending_updates: false });
}

/** Enregistre les commandes visibles dans le menu Telegram (`/setcommands`). */
export async function publishTelegramCommands(
  commands: { command: string; description: string }[],
): Promise<TelegramApiResult> {
  return telegramApi("setMyCommands", { commands });
}

/**
 * Bouton menu ☰ du bot (à gauche du champ de saisie) → Mini App `/tg`.
 * Appliqué à tous les chats privés (pas de `chat_id`). Sans URL HTTPS,
 * Telegram refuserait : on renvoie une erreur lisible sans appeler l'API.
 */
export async function publishTelegramMenuButton(
  menuButton: { type: "web_app"; text: string; web_app: { url: string } } | null,
): Promise<TelegramApiResult> {
  if (!menuButton) {
    return { ok: false, error: "URL du site non HTTPS : la Mini App exige HTTPS." };
  }
  return telegramApi("setChatMenuButton", { menu_button: menuButton });
}

/** Message de test depuis l'admin — prouve que le jeton et le chat marchent. */
export async function sendTelegramTest(siteName: string): Promise<TelegramApiResult> {
  if (!telegramConfigured()) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN absent ou invalide." };
  }
  return notifyTelegramAdmin(
    `✅ <b>Test réussi</b> — ${escapeTelegramHtml(siteName)}\n\nCe chat recevra les alertes : nouvelle demande, paiement confirmé, campagne envoyée.`,
    undefined,
    { parseMode: "HTML" },
  );
}

/* ------------------------------- Abonnés ---------------------------------- */

export interface SubscriberInput {
  chatId: string;
  username?: string | null;
  firstName?: string | null;
  language?: TelegramLocale;
  source?: string | null;
}

/** Crée ou rafraîchit l'abonné à chaque interaction (opt-in inchangé). */
export async function saveTelegramSubscriber(input: SubscriberInput): Promise<void> {
  await ensureSchema();
  const now = new Date();
  await db
    .insert(telegramSubscribers)
    .values({
      chatId: input.chatId,
      username: input.username || null,
      firstName: input.firstName || null,
      language: isTelegramLocale(input.language) ? input.language : "ar",
      source: input.source || null,
      lastSeenAt: now,
      updatedAt: now,
      status: "active",
    })
    .onConflictDoUpdate({
      target: telegramSubscribers.chatId,
      set: {
        username: input.username || null,
        firstName: input.firstName || null,
        language: isTelegramLocale(input.language) ? input.language : "ar",
        lastSeenAt: now,
        updatedAt: now,
        status: "active",
      },
    });
}

export async function getTelegramSubscriber(
  chatId: string,
): Promise<{
  language: TelegramLocale;
  marketingOptIn: boolean;
  status: string;
  username: string | null;
  firstName: string | null;
} | null> {
  try {
    const [row] = await db
      .select({
        language: telegramSubscribers.language,
        marketingOptIn: telegramSubscribers.marketingOptIn,
        status: telegramSubscribers.status,
        username: telegramSubscribers.username,
        firstName: telegramSubscribers.firstName,
      })
      .from(telegramSubscribers)
      .where(eq(telegramSubscribers.chatId, chatId))
      .limit(1);
    if (!row) return null;
    return {
      language: isTelegramLocale(row.language) ? row.language : "ar",
      marketingOptIn: row.marketingOptIn,
      status: row.status,
      username: row.username || null,
      firstName: row.firstName || null,
    };
  } catch {
    return null;
  }
}

export async function setTelegramLanguage(chatId: string, language: TelegramLocale): Promise<void> {
  await ensureSchema();
  await db
    .update(telegramSubscribers)
    .set({ language, updatedAt: new Date() })
    .where(eq(telegramSubscribers.chatId, chatId));
}

/* ------------------------- Boutique inline (état) -------------------------- */

/**
 * État de navigation de la boutique (forme exacte dans
 * `telegram-shop-core.ts`, qui reste pur et testable sans base).
 */
export type TelegramShopState = Record<string, unknown>;

/** Récupère l'état boutique + l'e-mail de caisse mémorisé d'un chat. */
export async function getTelegramShopContext(
  chatId: string,
): Promise<{ shopState: TelegramShopState | null; checkoutEmail: string | null }> {
  try {
    const [row] = await db
      .select({
        shopState: telegramSubscribers.shopState,
        checkoutEmail: telegramSubscribers.checkoutEmail,
      })
      .from(telegramSubscribers)
      .where(eq(telegramSubscribers.chatId, chatId))
      .limit(1);
    return {
      shopState:
        row?.shopState && typeof row.shopState === "object" && !Array.isArray(row.shopState)
          ? (row.shopState as TelegramShopState)
          : null,
      checkoutEmail: row?.checkoutEmail || null,
    };
  } catch {
    return { shopState: null, checkoutEmail: null };
  }
}

/** Écrit l'état de navigation (fusion partielle gérée par l'appelant). */
export async function setTelegramShopState(
  chatId: string,
  state: TelegramShopState | null,
): Promise<void> {
  await ensureSchema();
  await db
    .update(telegramSubscribers)
    .set({ shopState: state, updatedAt: new Date() })
    .where(eq(telegramSubscribers.chatId, chatId))
    .catch(() => undefined);
}

/** Mémorise le dernier e-mail de caisse (proposition au prochain achat). */
export async function setTelegramCheckoutEmail(chatId: string, email: string): Promise<void> {
  await ensureSchema();
  await db
    .update(telegramSubscribers)
    .set({ checkoutEmail: email.slice(0, 254), updatedAt: new Date() })
    .where(eq(telegramSubscribers.chatId, chatId))
    .catch(() => undefined);
}

/**
 * Nettoie une éventuelle caisse en attente (`pending`) lorsque le client
 * quitte le tunnel (bouton Menu, nouvelle commande…). Best-effort.
 */
export async function clearTelegramPendingCheckout(chatId: string): Promise<void> {
  try {
    const { shopState } = await getTelegramShopContext(chatId);
    if (!shopState || shopState.pending == null) return;
    await setTelegramShopState(chatId, { ...shopState, pending: null });
  } catch {
    /* jamais bloquant */
  }
}

export interface TelegramShopCheckoutEvent {
  at: string;
  reason: string;
  alerted: boolean;
  slug: string;
  title: string;
  label: string;
  qty: number;
  totalUsd: string;
  actorLabel: string;
  maskedEmail: string;
  detail: string;
}

/**
 * Journalise un refus ou incident de la caisse Telegram dans `settings`
 * (`telegram:shop-events`, tampon circulaire de 25 entrées, aucun secret).
 */
export async function recordTelegramShopCheckoutEvent(
  event: TelegramShopCheckoutEvent,
): Promise<void> {
  try {
    await ensureSchema();
    const existing = await listTelegramShopCheckoutEvents(MAX_SHOP_EVENTS);
    const next = [event, ...existing].slice(0, MAX_SHOP_EVENTS);
    await db
      .insert(settings)
      .values({ key: SHOP_EVENTS_SETTING, value: next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: next, updatedAt: new Date() },
      });
  } catch (error) {
    console.warn(
      "[telegram][shop] journalisation impossible :",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Relit les derniers événements de caisse Telegram pour `/admin/telegram`. */
export async function listTelegramShopCheckoutEvents(
  limit = 10,
): Promise<TelegramShopCheckoutEvent[]> {
  try {
    await ensureSchema();
    const [row] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, SHOP_EVENTS_SETTING))
      .limit(1);
    if (!Array.isArray(row?.value)) return [];
    return row.value
      .filter((item): item is TelegramShopCheckoutEvent =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as TelegramShopCheckoutEvent).at === "string" &&
            typeof (item as TelegramShopCheckoutEvent).reason === "string",
        ),
      )
      .slice(0, Math.max(1, limit));
  } catch {
    return [];
  }
}

/** Consentement marketing — `true` horodate l'opt-in, `false` le retire. */
export async function setTelegramMarketingOptIn(
  chatId: string,
  optIn: boolean,
): Promise<void> {
  await ensureSchema();
  const now = new Date();
  await db
    .update(telegramSubscribers)
    .set({
      marketingOptIn: optIn,
      optedInAt: optIn ? now : null,
      updatedAt: now,
      status: "active",
    })
    .where(eq(telegramSubscribers.chatId, chatId));
}

export async function setTelegramBlocked(chatId: string): Promise<void> {
  await db
    .update(telegramSubscribers)
    .set({ status: "blocked", marketingOptIn: false, updatedAt: new Date() })
    .where(eq(telegramSubscribers.chatId, chatId))
    .catch(() => undefined);
}

/** Mémorise le dernier message (support) — visible dans l'admin. */
export async function recordTelegramMessage(chatId: string, text: string): Promise<void> {
  await db
    .update(telegramSubscribers)
    .set({ lastMessage: telegramClamp(text, 500), updatedAt: new Date() })
    .where(eq(telegramSubscribers.chatId, chatId))
    .catch(() => undefined);
}

export interface TelegramSubscriberView {
  chatId: string;
  username: string | null;
  firstName: string | null;
  language: string;
  marketingOptIn: boolean;
  status: string;
  createdAt: Date;
  lastSeenAt: Date;
}

export async function listTelegramSubscribers(limit = 50): Promise<TelegramSubscriberView[]> {
  await ensureSchema();
  const rows = await db
    .select({
      chatId: telegramSubscribers.chatId,
      username: telegramSubscribers.username,
      firstName: telegramSubscribers.firstName,
      language: telegramSubscribers.language,
      marketingOptIn: telegramSubscribers.marketingOptIn,
      status: telegramSubscribers.status,
      createdAt: telegramSubscribers.createdAt,
      lastSeenAt: telegramSubscribers.lastSeenAt,
    })
    .from(telegramSubscribers)
    .orderBy(telegramSubscribers.createdAt)
    .limit(limit);
  return rows;
}

export interface TelegramAudienceStats {
  total: number;
  optedIn: number;
  blocked: number;
}

export async function telegramAudienceStats(): Promise<TelegramAudienceStats> {
  await ensureSchema();
  const rows = await db
    .select({ status: telegramSubscribers.status, optIn: telegramSubscribers.marketingOptIn })
    .from(telegramSubscribers);
  return {
    total: rows.length,
    optedIn: rows.filter((row) => row.optIn && row.status === "active").length,
    blocked: rows.filter((row) => row.status === "blocked").length,
  };
}

/* ------------------------------- Campagnes -------------------------------- */

export interface BroadcastOutcome {
  ok: boolean;
  audience: number;
  sent: number;
  failed: number;
  blocked: number;
  error?: string;
  campaignId?: number;
}

/**
 * Envoie une campagne aux abonnés ayant donné leur accord explicite.
 * Découpage en lots de 20 + pause : Telegram limite à ~30 messages/seconde,
 * un envoi en rafale ferait bloquer le bot (429) et perdre des envois.
 * Le résultat est journalisé dans `telegram_campaigns`.
 */
export async function broadcastTelegram(input: {
  title: string;
  body: string;
  siteName: string;
  siteUrl: string;
}): Promise<BroadcastOutcome> {
  if (!telegramConfigured()) {
    return { ok: false, audience: 0, sent: 0, failed: 0, blocked: 0, error: "Bot non configuré." };
  }

  const text = composeBroadcast({
    body: input.body,
    siteName: input.siteName,
    siteUrl: input.siteUrl,
    slug: input.title,
  });

  try {
    await ensureSchema();
    const recipients = await db
      .select({ chatId: telegramSubscribers.chatId })
      .from(telegramSubscribers)
      .where(eq(telegramSubscribers.marketingOptIn, true))
      .limit(BROADCAST_MAX_RECIPIENTS);

    const active = recipients.filter((row) => row.chatId);
    let sent = 0;
    let failed = 0;
    let blocked = 0;

    for (let index = 0; index < active.length; index += BROADCAST_CHUNK) {
      const chunk = active.slice(index, index + BROADCAST_CHUNK);
      const results = await Promise.all(
        chunk.map((row) =>
          sendTelegramMessage(row.chatId, text, { disablePreview: false }),
        ),
      );
      results.forEach((result, i) => {
        if (result.ok) {
          sent += 1;
          return;
        }
        if (/blocked|chat not found|user is deactivated/i.test(result.error ?? "")) {
          blocked += 1;
          void setTelegramBlocked(chunk[i].chatId);
        } else {
          failed += 1;
        }
      });
      if (index + BROADCAST_CHUNK < active.length) {
        await new Promise((resolve) => setTimeout(resolve, BROADCAST_PAUSE_MS));
      }
    }

    const status = failed + blocked > 0 ? (sent > 0 ? "partial" : "failed") : "sent";
    const [campaign] = await db
      .insert(telegramCampaigns)
      .values({
        title: input.title.slice(0, 160) || "Campagne",
        body: text,
        audience: active.length,
        sent,
        failed,
        blocked,
        status,
      })
      .returning({ id: telegramCampaigns.id });

    return { ok: true, audience: active.length, sent, failed, blocked, campaignId: campaign?.id };
  } catch (error) {
    return {
      ok: false,
      audience: 0,
      sent: 0,
      failed: 0,
      blocked: 0,
      error: error instanceof Error ? error.message : "envoi impossible",
    };
  }
}

export interface TelegramCampaignView {
  id: number;
  title: string;
  audience: number;
  sent: number;
  failed: number;
  blocked: number;
  status: string;
  createdAt: Date;
}

export async function listTelegramCampaigns(limit = 10): Promise<TelegramCampaignView[]> {
  await ensureSchema();
  return db
    .select({
      id: telegramCampaigns.id,
      title: telegramCampaigns.title,
      audience: telegramCampaigns.audience,
      sent: telegramCampaigns.sent,
      failed: telegramCampaigns.failed,
      blocked: telegramCampaigns.blocked,
      status: telegramCampaigns.status,
      createdAt: telegramCampaigns.createdAt,
    })
    .from(telegramCampaigns)
    .orderBy(desc(telegramCampaigns.createdAt))
    .limit(limit);
}

/* ---------------------------- Suivi de commande --------------------------- */

/**
 * Retrouve une commande par sa référence, côté digital puis côté projets.
 * Ne renvoie QUE ce qui est publiable : libellé, statut, montant, date.
 * Jamais d'e-mail complet, de téléphone, d'adresse crypto ni de code.
 */
export async function findOrderForBot(ref: string): Promise<BotOrderSummary | null> {
  const normalized = ref.trim().toUpperCase();
  if (!normalized) return null;
  try {
    await ensureSchema();

    const [digital] = await db
      .select({
        ref: digitalOrders.ref,
        productTitle: digitalOrders.productTitle,
        status: digitalOrders.status,
        totalUsd: digitalOrders.totalUsd,
        createdAt: digitalOrders.createdAt,
      })
      .from(digitalOrders)
      .where(eq(digitalOrders.ref, normalized))
      .limit(1);

    if (digital) {
      return {
        ref: digital.ref,
        kind: "digital",
        title: digital.productTitle,
        status: digital.status,
        totalUsd: digital.totalUsd,
        createdAt: digital.createdAt.toISOString(),
        trackingUrl: `/codes/commande?ref=${encodeURIComponent(digital.ref)}`,
      };
    }

    const [web] = await db
      .select({
        ref: orders.ref,
        planName: orders.planName,
        status: orders.status,
        amountUsd: orders.amountUsd,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.ref, normalized))
      .limit(1);

    if (web) {
      return {
        ref: web.ref,
        kind: "web",
        title: web.planName,
        status: web.status,
        totalUsd: web.amountUsd,
        createdAt: web.createdAt.toISOString(),
        trackingUrl: `/pay/success?ref=${encodeURIComponent(web.ref)}`,
      };
    }

    return null;
  } catch {
    return null;
  }
}
