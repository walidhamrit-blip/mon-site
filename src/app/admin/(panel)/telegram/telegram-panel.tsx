"use client";

import { useState, useTransition } from "react";
import {
  BadgeCheck,
  Bot,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Megaphone,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import {
  broadcastAction,
  installWebhookAction,
  removeWebhookAction,
  sendTestAction,
  type TelegramActionResult,
  type BroadcastActionResult,
} from "./actions";

interface Props {
  configured: boolean;
  tokenValid: boolean;
  adminChatId: boolean;
  webhook: {
    configured: boolean;
    url?: string;
    pendingUpdates?: number;
    lastError?: string;
  };
  botUsername: string;
  audience: { total: number; optedIn: number; blocked: number };
  deepLink: string;
}

type Busy = "install" | "test" | "remove" | "broadcast" | null;

export function TelegramPanel({
  configured,
  tokenValid,
  adminChatId,
  webhook,
  botUsername,
  audience,
  deepLink,
}: Props) {
  const [busy, setBusy] = useState<Busy>(null);
  const [result, setResult] = useState<TelegramActionResult | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  function run(kind: Exclude<Busy, null>, action: () => Promise<TelegramActionResult>) {
    setBusy(kind);
    setResult(null);
    startTransition(() => {
      void (async () => {
        try {
          const res = await action();
          setResult(res);
          if (res.ok) {
            setConfirming(false);
            if (kind === "broadcast") {
              setTitle("");
              setMessage("");
            }
          }
        } catch (error) {
          setResult({
            ok: false,
            message: error instanceof Error ? error.message : "Action impossible.",
          });
        } finally {
          setBusy(null);
        }
      })();
    });
  }

  async function copyLink() {
    if (!deepLink) return;
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible : le lien reste sélectionnable à l'écran.
    }
  }

  const characters = message.trim().length;
  const tooLong = characters > 3000;

  return (
    <div className="space-y-6">
      {/* 1 — État de la liaison ------------------------------------------------- */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <header className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-stone-500" />
          <h2 className="text-sm font-black tracking-tight">Liaison avec Telegram</h2>
        </header>

        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          <Status ok={tokenValid} label="Jeton du bot">
            {configured ? "Valide" : tokenValid ? "Configuration incomplète" : "Absent / invalide"}
          </Status>
          <Status ok={adminChatId} label="Chat des alertes">
            {adminChatId ? "Renseigné" : "TELEGRAM_ADMIN_CHAT_ID manquant"}
          </Status>
          <Status ok={webhook.configured} label="Webhook">
            {webhook.configured ? "Actif" : "Non installé"}
          </Status>
        </ul>

        {webhook.lastError ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Dernière erreur Telegram : {webhook.lastError}
          </p>
        ) : null}

        {deepLink ? (
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Lien à partager (site, Instagram, bio, QR code)
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <code className="break-all text-[12px] text-stone-700">{deepLink}</code>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copié" : "Copier"}
              </button>
              <a
                href={deepLink}
                target="_blank"
                rel="noopener"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
              >
                <ExternalLink className="h-3 w-3" />
                Ouvrir
              </a>
            </div>
            <p className="mt-1.5 text-[11px] text-stone-500">
              Le paramètre <code>?start=site</code> enregistre la source : vous saurez
              combien d&apos;abonnés viennent du site.
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => run("install", installWebhookAction)}
            disabled={busy !== null || !configured}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-40"
          >
            {busy === "install" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            {webhook.configured ? "Réinstaller le webhook" : "Installer le webhook"}
          </button>
          <button
            type="button"
            onClick={() => run("test", sendTestAction)}
            disabled={busy !== null || !configured}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            {busy === "test" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Envoyer un test
          </button>
          <button
            type="button"
            onClick={() => run("remove", removeWebhookAction)}
            disabled={busy !== null || !webhook.configured}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 text-xs font-semibold text-stone-500 hover:bg-stone-50 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Retirer
          </button>
          {webhook.configured && typeof webhook.pendingUpdates === "number" ? (
            <span className="inline-flex items-center gap-1.5 self-center text-[11px] text-stone-400">
              <RefreshCw className="h-3 w-3" />
              {webhook.pendingUpdates} mise(s) à jour en attente
            </span>
          ) : null}
        </div>

        {result ? <ResultLine result={result} /> : null}
      </section>

      {/* 2 — Audience ---------------------------------------------------------- */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <header className="flex items-center gap-2">
          <Users className="h-4 w-4 text-stone-500" />
          <h2 className="text-sm font-black tracking-tight">Audience</h2>
        </header>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Abonnés au bot" value={audience.total} />
          <Metric label="Ont accepté les offres" value={audience.optedIn} tone="gold" />
          <Metric label="Ont bloqué le bot" value={audience.blocked} tone="muted" />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-stone-500">
          Le consentement est explicite : démarrer le bot n&apos;abonne à aucune campagne.
          Un abonné devient « opt-in » quand il appuie sur <b>Offres &amp; promos</b> puis
          <b> Oui, recevoir les offres</b> — et il peut se retirer avec <code>/stop</code>.
        </p>
      </section>

      {/* 3 — Campagne ---------------------------------------------------------- */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <header className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-stone-500" />
          <h2 className="text-sm font-black tracking-tight">Nouvelle campagne</h2>
        </header>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Nom interne (et slug UTM)
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              placeholder="black-friday-2026"
              className="mt-1 h-10 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-900"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Message
            </span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={7}
              dir="auto"
              placeholder={"🎁 -20 % sur toutes les cartes cadeaux jusqu'à dimanche.\nCode : TELEGRAM20"}
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900"
            />
            <span
              className={`mt-1 block text-[11px] ${tooLong ? "text-red-600" : "text-stone-400"}`}
            >
              {characters}/3000 · signature et lien UTM ajoutés automatiquement
            </span>
          </label>

          {confirming ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="text-[12px] font-semibold text-amber-900">
                Envoyer maintenant à {audience.optedIn} abonné(s) ? Cette action est
                immédiate et ne peut pas être annulée.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    run("broadcast", () =>
                      broadcastAction({ title, message, slug: title }),
                    )
                  }
                  disabled={busy !== null || tooLong || audience.optedIn === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#7A5D20] px-3.5 text-xs font-semibold text-white hover:bg-[#664d1a] disabled:opacity-40"
                >
                  {busy === "broadcast" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Megaphone className="h-3.5 w-3.5" />
                  )}
                  Confirmer l&apos;envoi
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="h-9 rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-semibold text-stone-600"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={
                busy !== null ||
                !title.trim() ||
                characters < 5 ||
                tooLong ||
                audience.optedIn === 0
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-40"
            >
              <Megaphone className="h-3.5 w-3.5" />
              Préparer la campagne
            </button>
          )}

          {audience.optedIn === 0 ? (
            <p className="text-[11px] text-stone-500">
              Aucun abonné opt-in pour l&apos;instant : partagez le lien du bot, les
              clients choisiront eux-mêmes de recevoir les offres.
            </p>
          ) : null}
        </div>

        {result && !result.ok ? <ResultLine result={result} /> : null}
        {result && result.ok && "sent" in result ? (
          <ResultLine result={result as BroadcastActionResult} />
        ) : null}
      </section>
    </div>
  );
}

function Status({
  ok,
  label,
  children,
}: {
  ok: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-500">
        {ok ? (
          <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
        )}
        {label}
      </span>
      <span className="mt-1 block text-[12.5px] font-semibold text-stone-800">{children}</span>
    </li>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "gold" | "muted";
}) {
  const color =
    tone === "gold" ? "text-[#7A5D20]" : tone === "muted" ? "text-stone-400" : "text-stone-900";
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
      <div className={`text-2xl font-black tracking-tight ${color}`}>{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        {label}
      </div>
    </div>
  );
}

function ResultLine({ result }: { result: TelegramActionResult }) {
  return (
    <p
      role="status"
      className={`mt-3 whitespace-pre-wrap rounded-xl px-3 py-2 text-[12px] ${
        result.ok
          ? "bg-emerald-50 text-emerald-900"
          : "bg-red-50 text-red-800"
      }`}
    >
      {result.message}
    </p>
  );
}
