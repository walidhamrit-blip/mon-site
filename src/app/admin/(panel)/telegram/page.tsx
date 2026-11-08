import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Megaphone } from "lucide-react";
import {
  listTelegramCampaigns,
  listTelegramSubscribers,
  telegramAudienceStats,
  telegramBotIdentity,
  telegramConfig,
  telegramWebhookStatus,
  type TelegramCampaignView,
  type TelegramSubscriberView,
  type TelegramWebhookStatus,
} from "@/lib/telegram";
import { telegramDeepLink } from "@/lib/telegram-core";
import { TelegramPanel } from "./telegram-panel";

export const metadata: Metadata = {
  title: "Bot Telegram — Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
/** Une campagne de 400 abonnés doit tenir dans la fonction (Vercel). */
export const maxDuration = 60;

const DEFAULTS = {
  webhook: { configured: false } as TelegramWebhookStatus,
  audience: { total: 0, optedIn: 0, blocked: 0 },
  subscribers: [] as TelegramSubscriberView[],
  campaigns: [] as TelegramCampaignView[],
};

export default async function AdminTelegramPage() {
  const cfg = telegramConfig();

  const [webhook, audience, subscribers, campaigns, identity] = await Promise.all([
    telegramWebhookStatus().catch(() => DEFAULTS.webhook),
    telegramAudienceStats().catch(() => DEFAULTS.audience),
    listTelegramSubscribers(12).catch(() => DEFAULTS.subscribers),
    listTelegramCampaigns(8).catch(() => DEFAULTS.campaigns),
    telegramBotIdentity().catch(() => null),
  ]);

  const botUsername = cfg.botUsername || identity?.username || "";
  const configured = Boolean(cfg.token);
  const deepLink = botUsername ? telegramDeepLink(botUsername, "site") : "";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Bot Telegram</h1>
          <p className="mt-1 text-[13px] text-stone-500">
            Alertes de ventes sur votre téléphone, suivi de commande pour les clients,
            campagnes marketing vers les abonnés consentants.
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tableau de bord
        </Link>
      </header>

      {!configured ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-sm font-black tracking-tight text-amber-950">
            Il reste 3 minutes de configuration
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-amber-950">
            <li>
              Ouvrez Telegram → <b>@BotFather</b> → <code>/newbot</code>. Copiez le jeton
              (<code>123456789:AA…</code>).
            </li>
            <li>
              Sur Vercel : <b>Settings → Environment Variables</b> →
              <code>TELEGRAM_BOT_TOKEN</code> = le jeton, puis <b>Redeploy</b>.
            </li>
            <li>
              Envoyez <code>/start</code> au bot, puis mettez votre chat id dans{" "}
              <code>TELEGRAM_ADMIN_CHAT_ID</code> (obtenu via{" "}
              <code>https://api.telegram.org/bot&lt;JETON&gt;/getUpdates</code>).
            </li>
            <li>
              Revenez ici → <b>Installer le webhook</b> : le bot se met à répondre.
            </li>
          </ol>
          <p className="mt-3 text-[12px] text-amber-800">
            Guide complet, commandes et dépannage :{" "}
            <code>docs/telegram-bot.md</code> dans le dépôt.
          </p>
        </section>
      ) : null}

      <TelegramPanel
        configured={configured}
        tokenValid={configured}
        adminChatId={Boolean(cfg.adminChatId)}
        webhook={webhook}
        botUsername={botUsername}
        audience={audience}
        deepLink={deepLink}
      />

      {/* Journal ------------------------------------------------------------- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <header className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-stone-500" />
            <h2 className="text-sm font-black tracking-tight">Dernières campagnes</h2>
          </header>
          {campaigns.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-stone-500">
              Aucune campagne envoyée pour le moment.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-stone-800">
                      {campaign.title}
                    </div>
                    <div className="text-[11px] text-stone-400">
                      {formatDate(campaign.createdAt)} · {campaign.status}
                    </div>
                  </div>
                  <span className="shrink-0 text-[12px] font-bold text-stone-700">
                    {campaign.sent}/{campaign.audience}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <header className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-stone-500" />
            <h2 className="text-sm font-black tracking-tight">Derniers abonnés</h2>
          </header>
          {subscribers.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-stone-500">
              Personne n&apos;a encore ouvert le bot. Partagez le lien t.me depuis le site
              (pied de page) ou vos réseaux.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {subscribers.map((subscriber) => (
                <li
                  key={subscriber.chatId}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-stone-800">
                      {subscriber.firstName || "—"}
                      {subscriber.username ? (
                        <span className="ml-1 font-normal text-stone-400">
                          @{subscriber.username}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-stone-400">
                      {subscriber.language.toUpperCase()} ·{" "}
                      {formatDate(subscriber.createdAt)}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      subscriber.status === "blocked"
                        ? "bg-stone-100 text-stone-400"
                        : subscriber.marketingOptIn
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {subscriber.status === "blocked"
                      ? "bloqué"
                      : subscriber.marketingOptIn
                        ? "opt-in"
                        : "support"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
