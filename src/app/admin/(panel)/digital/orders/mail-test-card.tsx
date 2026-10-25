"use client";

import { useState, useTransition } from "react";
import { Loader2, MailCheck, Send, TriangleAlert } from "lucide-react";
import { sendTestEmailAction, type MailTestResult } from "@/app/admin/actions";

/**
 * Diagnostic d'envoi des e-mails (admin).
 *
 * Répond à la seule question qui compte quand un client ne reçoit pas ses
 * codes : le fournisseur a-t-il réellement accepté le message ? On affiche
 * l'identifiant renvoyé (à retrouver dans les journaux Resend/SMTP) ou le
 * refus exact.
 */
export function MailTestCard({
  provider,
  from,
  fromExplicit,
  domain,
}: {
  provider: string;
  from: string;
  fromExplicit: boolean;
  domain: string;
}) {
  const [to, setTo] = useState("");
  const [result, setResult] = useState<MailTestResult | null>(null);
  const [busy, startTransition] = useTransition();

  const configured = provider !== "none";

  const run = () => {
    if (!to.trim()) {
      setResult({ ok: false, error: "Saisissez une adresse de destination." });
      return;
    }
    startTransition(async () => {
      const outcome = await sendTestEmailAction(to.trim());
      setResult(outcome);
    });
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-black text-stone-900">Envoi des e-mails</h2>
          <p className="mt-1 text-[12.5px] text-stone-600">
            Les codes partent du site vers l&apos;adresse du client. Testez le canal
            avant d&apos;ouvrir les ventes.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-bold ${
            configured
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-orange-200 bg-orange-50 text-orange-800"
          }`}
        >
          {configured ? <MailCheck className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
          {configured ? `Canal : ${provider}` : "Aucun canal configuré"}
        </span>
      </div>

      <dl className="mt-3 grid gap-2 text-[12px] text-stone-600 sm:grid-cols-2">
        <div>
          <dt className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">Expéditeur</dt>
          <dd className="mt-0.5 font-bold text-stone-900">{from}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">Domaine</dt>
          <dd className="mt-0.5 font-bold text-stone-900">
            {domain}
            {fromExplicit ? "" : " (par défaut)"}
          </dd>
        </div>
      </dl>

      {!fromExplicit && (
        <p className="mt-2 rounded-lg bg-[#FAF9F6] px-3 py-2 text-[11.5px] leading-5 text-stone-600">
          L&apos;expéditeur par défaut est <code>no-reply@{domain}</code>. Si ce domaine
          n&apos;est pas vérifié chez votre fournisseur (Resend : <em>Domains</em>) avec
          SPF/DKIM, l&apos;envoi est accepté puis <strong>perdu ou classé en spam</strong>.
          Renseignez <code>EMAIL_FROM</code> avec une adresse vérifiée pour corriger.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block flex-1">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
            Envoyer un e-mail de test à
          </span>
          <input
            type="email"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="vous@exemple.com"
            className="mt-1 h-9 w-full rounded-md border border-stone-300 px-2 text-[13px] outline-none focus:border-[#B8923F]"
          />
        </label>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-stone-900 px-3 text-[12.5px] font-bold text-[#E5CA87] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Envoyer le test
        </button>
      </div>

      {result && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-[12px] leading-5 ${
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <p className="font-bold">{result.ok ? "Accepté par le fournisseur" : "Envoi refusé"}</p>
          <p className="mt-0.5 break-words">{result.ok ? result.message : result.error}</p>
          {result.id && (
            <p className="mt-1 text-[11px]">
              Identifiant du message : <code>{result.id}</code> — recherchez-le dans les
              journaux du fournisseur pour connaître la remise réelle.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
