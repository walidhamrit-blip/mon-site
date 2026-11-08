"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getSiteData } from "@/lib/store";
import { siteBaseUrl } from "@/lib/site-url";
import {
  broadcastTelegram,
  deleteTelegramWebhook,
  installTelegramWebhook,
  publishTelegramCommands,
  sendTelegramTest,
  telegramConfigured,
} from "@/lib/telegram";
import {
  botCommandList,
  composeBroadcast,
  validateBroadcast,
} from "@/lib/telegram-core";

/**
 * Actions du panneau `/admin/telegram`.
 *
 * Toutes commencent par `requireAdmin()` : une action serveur est un point
 * d'entrée HTTP public, elle ne peut pas se reposer sur le fait que la page
 * soit protégée.
 */

export interface TelegramActionResult {
  ok: boolean;
  message: string;
}

export async function installWebhookAction(): Promise<
  TelegramActionResult & { url?: string }
> {
  await requireAdmin();
  if (!telegramConfigured()) {
    return {
      ok: false,
      message:
        "Aucun jeton valide : ajoutez TELEGRAM_BOT_TOKEN (BotFather) dans les variables d'environnement, puis redéployez.",
    };
  }
  const result = await installTelegramWebhook(siteBaseUrl());
  if (!result.ok) {
    return { ok: false, message: `Telegram a refusé : ${result.error ?? "erreur inconnue"}` };
  }
  // Profite de l'occasion pour publier le menu des commandes (`/`).
  await publishTelegramCommands(botCommandList());
  revalidatePath("/admin/telegram");
  return { ok: true, message: "Webhook installé et commandes publiées.", url: result.url };
}

export async function removeWebhookAction(): Promise<TelegramActionResult> {
  await requireAdmin();
  const result = await deleteTelegramWebhook();
  revalidatePath("/admin/telegram");
  return result.ok
    ? { ok: true, message: "Webhook supprimé : le bot ne répond plus jusqu'à sa réinstallation." }
    : { ok: false, message: result.error ?? "Suppression impossible." };
}

export async function sendTestAction(): Promise<TelegramActionResult> {
  await requireAdmin();
  const { config } = await getSiteData();
  const result = await sendTelegramTest(config.name);
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.error === "TELEGRAM_ADMIN_CHAT_ID absent."
          ? "TELEGRAM_ADMIN_CHAT_ID n'est pas défini : envoyez /start au bot, puis copiez son chat id dans les variables d'environnement."
          : `Échec : ${result.error ?? "raison inconnue"}`,
    };
  }
  return { ok: true, message: "Message de test envoyé — regardez Telegram 📲" };
}

export interface BroadcastActionInput {
  title: string;
  message: string;
  slug?: string;
}

export interface BroadcastActionResult extends TelegramActionResult {
  audience?: number;
  sent?: number;
  failed?: number;
  blocked?: number;
}

/**
 * Envoie une campagne marketing aux seuls abonnés ayant coché l'opt-in.
 * Le texte est validé ici (longueur) puis composé avec la signature et un
 * lien UTM — on ne fait jamais confiance au HTML envoyé par le navigateur.
 */
export async function broadcastAction(
  input: BroadcastActionInput,
): Promise<BroadcastActionResult> {
  await requireAdmin();

  const title = (input.title ?? "").trim();
  const message = (input.message ?? "").trim();
  if (!title) return { ok: false, message: "Donnez un nom à la campagne." };

  const valid = validateBroadcast(message);
  if (!valid.ok) return { ok: false, message: valid.error };

  if (!telegramConfigured()) {
    return {
      ok: false,
      message: "Bot non configuré : renseignez TELEGRAM_BOT_TOKEN puis redéployez.",
    };
  }

  const { config } = await getSiteData();
  const base = siteBaseUrl();
  const preview = composeBroadcast({
    body: message,
    siteName: config.name,
    siteUrl: base,
    slug: input.slug || title,
  });

  const outcome = await broadcastTelegram({
    title,
    body: message,
    siteName: config.name,
    siteUrl: base,
  });

  revalidatePath("/admin/telegram");

  if (!outcome.ok) {
    return { ok: false, message: outcome.error ?? "Envoi impossible." };
  }
  if (outcome.audience === 0) {
    return {
      ok: false,
      message:
        "Aucun abonné n'a encore accepté les offres : ils doivent ouvrir /admin (bouton Telegram) et appuyer sur « Offres » dans le bot.",
    };
  }

  const parts = [
    `Campagne envoyée à ${outcome.sent}/${outcome.audience} abonnés.`,
    outcome.blocked ? `${outcome.blocked} ont bloqué le bot (désabonnés d'office).` : "",
    outcome.failed ? `${outcome.failed} échecs réseau.` : "",
  ].filter(Boolean);

  return {
    ok: outcome.sent > 0,
    message: `${parts.join(" ")}\n\n${preview}`,
    audience: outcome.audience,
    sent: outcome.sent,
    failed: outcome.failed,
    blocked: outcome.blocked,
  };
}
