#!/usr/bin/env node
/**
 * Diagnostic / installation du bot Telegram — sans dépendre du site.
 *
 *   npm run telegram:check
 *   npm run telegram:check -- --webhook https://nokhba.net.ly
 *   npm run telegram:check -- --commands
 *   npm run telegram:check -- --delete-webhook
 *
 * Le script lit `.env.local` puis `.env` (comme Next.js). Il n'écrit jamais
 * le jeton dans un fichier et ne l'affiche jamais en entier.
 */

import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function loadEnvFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
const ADMIN_CHAT = (process.env.TELEGRAM_ADMIN_CHAT_ID ?? "").trim();
const SITE_URL = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
const BOT_USERNAME = (process.env.TELEGRAM_BOT_USERNAME ?? "").trim().replace(/^@/, "");

const ok = (text) => console.log(`  \x1b[32m✓\x1b[0m ${text}`);
const warn = (text) => console.log(`  \x1b[33m!\x1b[0m ${text}`);
const bad = (text) => console.log(`  \x1b[31m✗\x1b[0m ${text}`);
const title = (text) => console.log(`\n\x1b[1m${text}\x1b[0m`);

/** Masque le jeton : on ne montre que le préfixe numérique. */
function maskToken(token) {
  const [id, secret] = token.split(":");
  return `${id}:${(secret ?? "").slice(0, 4)}…${(secret ?? "").slice(-3)}`;
}

async function call(method, payload = {}) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  return { ok: Boolean(res.ok && data?.ok), data, status: res.status };
}

const COMMANDS = [
  { command: "start", description: "Menu principal / Main menu / القائمة" },
  { command: "codes", description: "Catalogue & boutique / الكتالوج" },
  { command: "commande", description: "Statut d'une commande (ex. /commande DGC-…)" },
  { command: "offres", description: "Recevoir les offres / استلام العروض" },
  { command: "stop", description: "Ne plus recevoir les offres" },
  { command: "aide", description: "Aide / Help / مساعدة" },
];

async function main() {
  title("Bot Telegram — diagnostic");

  if (!TOKEN) {
    bad("TELEGRAM_BOT_TOKEN est vide.");
    console.log(
      "\n  1. Telegram → @BotFather → /newbot → copiez le jeton\n" +
        "  2. Ajoutez-le dans Vercel (Production) puis redéployez,\n" +
        "     ou dans .env.local pour un test local.\n" +
        "  3. Relancez : npm run telegram:check\n",
    );
    process.exitCode = 1;
    return;
  }

  if (!/^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(TOKEN)) {
    bad("Format du jeton invalide (attendu : 123456789:AA…).");
    console.log("  Vérifiez qu'aucun guillemet ou espace n'a été collé avec.");
    process.exitCode = 1;
    return;
  }
  ok(`Jeton présent : ${maskToken(TOKEN)}`);

  const me = await call("getMe");
  if (!me.ok) {
    bad(`Telegram refuse le jeton : ${me.data?.description ?? `HTTP ${me.status}`}`);
    process.exitCode = 1;
    return;
  }
  ok(`Bot joignable : @${me.data.result.username} (${me.data.result.first_name})`);
  if (BOT_USERNAME && BOT_USERNAME !== me.data.result.username) {
    warn(`TELEGRAM_BOT_USERNAME (${BOT_USERNAME}) ≠ @${me.data.result.username}`);
  }

  if (ADMIN_CHAT) {
    const chat = await call("getChat", { chat_id: ADMIN_CHAT });
    if (chat.ok) {
      const label = chat.data.result.title ?? chat.data.result.first_name ?? "";
      ok(`Chat des alertes : ${ADMIN_CHAT} (${label})`);
    } else {
      warn(
        `Chat des alertes introuvable (${ADMIN_CHAT}) : le bot doit d'abord recevoir un message de ce chat.`,
      );
    }
  } else {
    warn("TELEGRAM_ADMIN_CHAT_ID est vide : aucune alerte ne sera envoyée.");
  }

  const info = await call("getWebhookInfo");
  const webhookUrl = info.data?.result?.url ?? "";
  if (webhookUrl) {
    ok(`Webhook actif : ${webhookUrl}`);
    if (info.data.result.pending_update_count) {
      warn(`${info.data.result.pending_update_count} mise(s) à jour en attente`);
    }
    if (info.data.result.last_error_message) {
      warn(`Dernière erreur : ${info.data.result.last_error_message}`);
    }
  } else {
    warn("Aucun webhook : le bot ne répond pas encore.");
    if (SITE_URL) {
      console.log(`  → installez-le : npm run telegram:check -- --webhook ${SITE_URL}`);
    } else {
      console.log("  → renseignez SITE_URL puis : npm run telegram:check -- --webhook https://votre-site");
    }
  }

  if (flag("--webhook")) {
    const url = (valueAfter("--webhook") ?? SITE_URL ?? "").replace(/\/+$/, "");
    if (!url || !/^https:\/\//.test(url)) {
      bad("URL invalide : Telegram exige HTTPS (ex. https://nokhba.net.ly).");
      process.exitCode = 1;
      return;
    }
    const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim() || randomBytes(32).toString("hex");
    const set = await call("setWebhook", {
      url: `${url}/api/telegram/webhook`,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
    if (!set.ok) {
      bad(`setWebhook refusé : ${set.data?.description ?? set.status}`);
      process.exitCode = 1;
      return;
    }
    ok(`Webhook installé : ${url}/api/telegram/webhook`);
    if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.log(
        "\n  ⚠️  Secret généré (à coller dans Vercel → TELEGRAM_WEBHOOK_SECRET) :\n" +
          `     ${secret}\n` +
          "     Sans lui, le webhook répond 503 et le bot reste muet.",
      );
    }
    console.log("  → vérifiez ensuite /admin/telegram");
  }

  if (flag("--commands")) {
    const set = await call("setMyCommands", { commands: COMMANDS });
    set.ok ? ok("Menu des commandes publié.") : bad(`setMyCommands : ${set.data?.description}`);
  }

  if (flag("--delete-webhook")) {
    const del = await call("deleteWebhook", { drop_pending_updates: false });
    del.ok ? ok("Webhook supprimé (le bot ne répond plus).") : bad(`deleteWebhook : ${del.data?.description}`);
  }

  if (!webhookUrl) {
    // getUpdates ne fonctionne que SANS webhook : sert à trouver le chat id.
    const updates = await call("getUpdates", { limit: 20, timeout: 0 });
    const chats = new Map();
    for (const update of updates.data?.result ?? []) {
      const chat = update.message?.chat ?? update.callback_query?.message?.chat;
      const from = update.message?.from ?? update.callback_query?.from;
      if (!chat) continue;
      chats.set(String(chat.id), {
        type: chat.type,
        label: chat.title ?? [from?.first_name, from?.username ? `@${from.username}` : null].filter(Boolean).join(" "),
      });
    }
    if (chats.size === 0) {
      console.log(
        "\n  Aucun chat détecté. Envoyez /start au bot puis relancez ce script\n" +
          "  pour récupérer le chat id à mettre dans TELEGRAM_ADMIN_CHAT_ID.",
      );
    } else {
      title("Chats détectés (à copier dans TELEGRAM_ADMIN_CHAT_ID)");
      for (const [id, chat] of chats) {
        console.log(`  chat id = ${id}  (${chat.type}${chat.label ? ` · ${chat.label}` : ""})`);
      }
    }
  }

  title("Résumé");
  const ready = Boolean(webhookUrl && ADMIN_CHAT);
  if (ready) {
    ok("Tout est en place : alertes + réponses du bot.");
  } else {
    warn("Configuration incomplète — suivez les étapes ci-dessus, puis /admin/telegram.");
  }
  console.log("");
}

main().catch((error) => {
  console.error("\nErreur :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
