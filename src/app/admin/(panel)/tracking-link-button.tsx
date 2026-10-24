"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Link2, Loader2 } from "lucide-react";

interface TrackingLinkButtonProps {
  /** « order » = commande ponctuelle/réservation ; « subscription » = abonné. */
  kind: "order" | "subscription";
  /** Référence de la ligne (NKH-…, RSV-…, ABO-…). */
  reference: string;
  /** Libellé du bouton au repos. */
  label?: string;
}

/**
 * Régénère le jeton de suivi d'une ligne et expose le lien public :
 * le jeton n'existe qu'en clair au moment de sa création (seul son hash
 * est stocké), c'est donc la seule façon de récupérer un lien perdu.
 * L'ancien jeton est invalidé côté serveur.
 */
export function TrackingLinkButton({
  kind,
  reference,
  label = "Lien de suivi",
}: TrackingLinkButtonProps) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function regenerate() {
    setState("busy");
    setMessage(null);
    setCopied(false);
    try {
      const res = await fetch("/api/admin/tracking-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ref: reference }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; url: string }
        | { ok: false; message?: string }
        | null;
      if (!res.ok || !data || data.ok !== true) {
        setState("error");
        setMessage(
          data && "message" in data && data.message
            ? data.message
            : `Échec (HTTP ${res.status})`,
        );
        return;
      }
      setUrl(data.url);
      setState("done");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Connexion impossible");
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponible (permissions) : le lien reste sélectionnable.
    }
  }

  if (state === "done" && url) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs font-semibold hover:bg-stone-50"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Ouvrir
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#C6A664]/20 text-[#7A5D20] border border-[#C6A664]/45 text-xs font-semibold hover:bg-[#C6A664]/30"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copié" : "Copier le lien"}
        </button>
        <button
          type="button"
          onClick={regenerate}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-stone-300 bg-white text-stone-500 text-xs font-semibold hover:bg-stone-50"
        >
          <Link2 className="h-3.5 w-3.5" /> Régénérer
        </button>
        <span className="w-full text-[11px] text-stone-400 break-all">{url}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={regenerate}
        disabled={state === "busy"}
        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs font-semibold hover:bg-stone-50 disabled:opacity-50"
      >
        {state === "busy" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Link2 className="h-3.5 w-3.5" />
        )}
        {state === "busy" ? "Génération…" : label}
      </button>
      {state === "error" && (
        <span role="alert" className="text-[11px] text-red-600">
          {message ?? "Échec de la génération"}
        </span>
      )}
    </div>
  );
}
