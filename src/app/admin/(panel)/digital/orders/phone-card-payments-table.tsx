"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Smartphone,
  XCircle,
} from "lucide-react";
import { recordOverpaymentAction, reviewPhoneCardPaymentAction } from "@/app/admin/actions";
import { PHONE_CARD_OPERATOR_LABELS, type PhoneCardOperator } from "@/lib/phone-card-core";
import type { AdminPhoneCardPaymentRow } from "@/lib/phone-card-payments";
import {
  OPEN_ORDER_EVENT,
  orderAnchor,
  orderHash,
  type OrderLinkTarget,
} from "@/lib/admin-order-link";
import { displayLyd, overpaymentLyd } from "@/lib/client-credits-core";

const STATUS_LABELS = {
  pending: "À vérifier",
  approved: "Acceptée",
  rejected: "Refusée",
} as const;

const STATUS_TONES = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-red-200 bg-red-50 text-red-800",
} as const;

function adminDate(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tripoli",
  });
}

/** Codes secrets visibles uniquement dans ce composant, derrière l'admin. */
export function PhoneCardPaymentsTable({ rows }: { rows: AdminPhoneCardPaymentRow[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [revealedRef, setRevealedRef] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const review = (ref: string, decision: "approved" | "rejected") => {
    if (
      decision === "approved" &&
      !window.confirm(
        `Confirmez-vous avoir vérifié la carte de ${ref} et avoir réellement reçu le crédit ? Cette action débloque la livraison manuelle.`,
      )
    ) {
      return;
    }
    setPendingRef(ref);
    startTransition(async () => {
      const result = await reviewPhoneCardPaymentAction(ref, decision, notes[ref] ?? "");
      setToast({
        ok: result.ok,
        text: result.message ?? result.error ?? "Vérification terminée.",
      });
      setPendingRef(null);
      if (result.ok) router.refresh();
      setTimeout(() => setToast(null), 7000);
    });
  };

  /**
   * Ouvre la commande correspondante dans le tableau plus bas.
   *
   * Ce bloc est un récapitulatif statique : cliquer la carte ne dépliait rien,
   * d'où l'impression que « la ligne ne s'ouvre pas ». On émet donc un
   * événement (immédiat) + un fragment d'URL (partageable, survit au
   * rechargement).
   */
  const openOrder = (ref: string, options: { offPlatform?: boolean } = {}) => {
    const detail: OrderLinkTarget = { ref, offPlatform: options.offPlatform === true };
    window.dispatchEvent(new CustomEvent(OPEN_ORDER_EVENT, { detail }));
    if (window.location.hash !== orderHash(ref, detail)) {
      window.location.hash = orderHash(ref, detail);
    } else {
      document
        .getElementById(orderAnchor(ref))
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  /**
   * Enregistre le trop-perçu (carte > devis dû) comme solde au nom du client.
   * Idempotent : un second clic répond « déjà enregistré » sans recréditer.
   */
  const saveCredit = (ref: string) => {
    setPendingRef(ref);
    startTransition(async () => {
      const result = await recordOverpaymentAction(ref);
      setToast({ ok: result.ok, text: result.message ?? result.error ?? "Terminé." });
      setPendingRef(null);
      if (result.ok) router.refresh();
      setTimeout(() => setToast(null), 7000);
    });
  };

  const copy = async (ref: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedRef(ref);
      setTimeout(() => setCopiedRef(null), 1600);
    } catch {
      window.prompt("Copier le code :", code);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-amber-200/80 bg-amber-50/35 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-black text-stone-900">
            <Smartphone className="h-4 w-4 text-amber-700" />
            Cartes téléphoniques à vérifier
          </h2>
          <p className="mt-1 max-w-3xl text-[12px] leading-5 text-stone-600">
            Vérifiez le crédit auprès de l’opérateur avant d’accepter. L’acceptation ne livre
            rien automatiquement : elle débloque seulement la saisie manuelle du code cadeau.
          </p>
        </div>
        <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-bold text-amber-800">
          {rows.filter((row) => row.status === "pending").length} en attente
        </span>
      </div>

      {toast && (
        <p className={`rounded-xl border px-3 py-2 text-[12px] font-semibold ${toast.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {toast.text}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-4 py-5 text-center text-[12.5px] text-stone-500">
          Aucune carte téléphonique reçue.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const revealed = revealedRef === row.ref;
            const isBusy = busy && pendingRef === row.ref;
            const operator = PHONE_CARD_OPERATOR_LABELS[row.operator as PhoneCardOperator] ?? row.operator;
            const quoteDelta = row.quote ? Number(row.cardValueLyd) - Number(row.quote.totalLyd) : null;
            return (
              <article key={row.ref} className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-[12px] font-bold text-stone-900">{row.ref}</code>
                      <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${STATUS_TONES[row.status]}`}>
                        {STATUS_LABELS[row.status]}
                      </span>
                    </div>
                    <h3 className="mt-1 text-[13.5px] font-bold text-stone-900">
                      {row.productTitle} — {row.denominationLabel} × {row.quantity}
                    </h3>
                    <p className="mt-1 break-words text-[11.5px] text-stone-500">
                      {row.recipientName || "Client"} · {row.recipientEmail}
                      {row.recipientPhone ? ` · ${row.recipientPhone}` : ""} · {adminDate(row.createdAt)}
                    </p>
                  </div>
                  <div className="text-end text-[12px]">
                    <div className="font-black text-stone-900">{operator} · {row.cardValueLyd} LYD</div>
                    <div className="mt-0.5 text-stone-500">Commande : {row.totalUsd} $</div>
                  </div>
                </div>

                {row.quote && (
                  <div className="mt-3 rounded-lg border border-[#C6A664]/40 bg-[#C6A664]/10 px-3 py-2.5 text-[11.5px] leading-5 text-stone-700">
                    <div className="font-black text-stone-900" dir="ltr">
                      {row.quote.amountUsdt} USDT × {row.quote.rateLyd} LYD × {100 + row.quote.markupPercent}% = {row.quote.totalLyd} LYD
                    </div>
                    <p className="mt-0.5">
                      Devis accepté par le client · source {row.quote.source === "fulus"
                        ? "Fulus"
                        : row.quote.source === "community"
                          ? "médiane de publications Telegram"
                          : "manuelle admin"}
                      {row.quote.rateUpdatedAt ? ` · taux du ${adminDate(row.quote.rateUpdatedAt)}` : ""}.
                      {quoteDelta != null && (
                        <strong className={quoteDelta < 0 ? "ml-1 text-red-700" : "ml-1 text-emerald-700"}>
                          {quoteDelta >= 0 ? "+" : ""}{quoteDelta.toFixed(2)} LYD par rapport à la carte déclarée.
                        </strong>
                      )}
                      {(() => {
                        const surplus = overpaymentLyd(row.cardValueLyd, row.quote?.totalLyd);
                        if (!surplus) return null;
                        return (
                          <span className="mt-1 block rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-bold text-emerald-900">
                            Reste dû au client : {displayLyd(surplus)} (carte{" "}
                            {displayLyd(row.cardValueLyd)} − devis {displayLyd(row.quote?.totalLyd)})
                            {row.status === "approved" ? " — à enregistrer comme solde." : " — à enregistrer après acceptation."}
                          </span>
                        );
                      })()}
                    </p>
                    {row.quote.references.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 border-t border-[#C6A664]/25 pt-1.5">
                        {row.quote.references.map((reference) => (
                          <li key={reference.url} className="flex flex-wrap gap-x-2">
                            <a
                              href={reference.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="font-bold text-[#8A6D2F] underline underline-offset-2"
                              dir="ltr"
                            >
                              {reference.label}
                            </a>
                            <span dir="ltr">{reference.rateLyd.toFixed(4)} LYD</span>
                            <span>publié le {adminDate(reference.rateUpdatedAt)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                  <div className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
                    Code de recharge · jamais affiché publiquement
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 break-all font-mono text-[14px] font-bold tracking-wide text-stone-900" dir="ltr">
                      {row.code ? (revealed ? row.code : row.codeHint) : "Lecture impossible — vérifiez la clé de chiffrement"}
                    </code>
                    {row.code && (
                      <>
                        <button
                          type="button"
                          onClick={() => setRevealedRef(revealed ? null : row.ref)}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-stone-300 bg-white px-2 text-[11px] font-bold text-stone-600 hover:bg-stone-100"
                        >
                          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {revealed ? "Masquer" : "Afficher"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void copy(row.ref, row.code ?? "")}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-stone-300 bg-white px-2 text-[11px] font-bold text-stone-600 hover:bg-stone-100"
                        >
                          {copiedRef === row.ref ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          Copier
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {row.status === "pending" ? (
                  <div className="mt-3 space-y-2.5">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-stone-500">
                        Note interne (obligatoire en cas de refus)
                      </span>
                      <input
                        value={notes[row.ref] ?? ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [row.ref]: event.target.value }))}
                        maxLength={500}
                        placeholder="Ex. crédit reçu / code déjà utilisé / valeur insuffisante"
                        className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-[12px] outline-none focus:border-amber-500"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isBusy || !row.code}
                        onClick={() => review(row.ref, "approved")}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[12px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Crédit vérifié — accepter
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || !(notes[row.ref] ?? "").trim()}
                        onClick={() => review(row.ref, "rejected")}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-[12px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Refuser la carte
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11.5px] leading-5 text-stone-500">
                      {row.reviewedAt ? `Traitée le ${adminDate(row.reviewedAt)}. ` : ""}
                      {row.reviewNote ? `Note : ${row.reviewNote}. ` : ""}
                      {row.status === "approved"
                        ? row.deliveryStatus === "delivered"
                          ? "Commande déjà livrée — rien d’autre à faire."
                          : "Il reste à livrer : ouvrez la commande puis saisissez le code, ou marquez-la livrée si le code est déjà parti (WhatsApp)."
                        : "Aucune livraison n’est autorisée."}
                    </p>
                    {row.status === "approved" && (
                      <div className="flex flex-wrap items-center gap-2">
                        {(() => {
                          const surplus = overpaymentLyd(row.cardValueLyd, row.quote?.totalLyd);
                          if (!surplus) return null;
                          return (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => saveCredit(row.ref)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-[12px] font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              {isBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Enregistrer le solde dû ({displayLyd(surplus)})
                            </button>
                          );
                        })()}
                      </div>
                    )}
                    {row.status === "approved" && row.deliveryStatus !== "delivered" && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openOrder(row.ref)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 text-[12px] font-bold text-stone-700 hover:bg-stone-50"
                        >
                          <ArrowDownToLine className="h-3.5 w-3.5" />
                          Ouvrir la commande
                        </button>
                        <button
                          type="button"
                          onClick={() => openOrder(row.ref, { offPlatform: true })}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[12px] font-bold text-white hover:bg-emerald-800"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Code déjà envoyé (WhatsApp…)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
