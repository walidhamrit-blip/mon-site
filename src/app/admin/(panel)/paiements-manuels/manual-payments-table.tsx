"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Loader2,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  deliverManualPaymentOrderAction,
  reviewManualPaymentAction,
} from "@/app/admin/manual-payments-actions";
import type { AdminManualPaymentRow } from "@/lib/manual-payments";

const STATUS_LABELS = {
  pending: "À vérifier",
  approved: "Accepté",
  rejected: "Refusé",
} as const;

const STATUS_TONES = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-red-200 bg-red-50 text-red-800",
} as const;

const KIND_LABELS = {
  digital: "Code digital",
  order: "Projet web",
  subscription: "Abonnement",
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

/**
 * File de vérification des virements manuels (Skrill, Neteller, Airtm, D17, Volet, WebMoney et Kashy).
 *
 * L'argent n'est jamais confirmé automatiquement : l'administrateur compare
 * la preuve déclarée à son propre relevé, puis accepte (avec ou sans
 * livraison) ou refuse avec un motif. Un refus ne déclenche aucun achat.
 */
export function ManualPaymentsTable({ rows }: { rows: AdminManualPaymentRow[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const notify = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 12000);
  };

  const review = (row: AdminManualPaymentRow, decision: "approved" | "rejected", autoDeliver = false) => {
    if (decision === "approved") {
      const question = autoDeliver
        ? `Confirmez-vous avoir réellement reçu le virement de ${row.ref} (${row.payAmount} ${row.payCurrency}) ? Le site achètera ensuite le code chez le fournisseur et l’enverra au client.`
        : `Confirmez-vous avoir réellement reçu le virement de ${row.ref} (${row.payAmount} ${row.payCurrency}) ? Vous devrez saisir le code vous-même.`;
      if (!window.confirm(question)) return;
    }
    setPendingRef(row.ref);
    startTransition(async () => {
      const result = await reviewManualPaymentAction(row.ref, decision, notes[row.ref] ?? "", {
        autoDeliver: decision === "approved" && autoDeliver,
      });
      notify(result.ok, result.message ?? result.error ?? "Vérification terminée.");
      setPendingRef(null);
      if (result.ok) router.refresh();
    });
  };

  const deliver = (row: AdminManualPaymentRow) => {
    const code = (codes[row.ref] ?? "").trim();
    if (code.length < 3) {
      notify(false, "Saisissez le code à livrer.");
      return;
    }
    setPendingRef(row.ref);
    startTransition(async () => {
      const result = await deliverManualPaymentOrderAction(row.ref, code, notes[row.ref] ?? "");
      notify(result.ok, result.message ?? result.error ?? "Livraison terminée.");
      setPendingRef(null);
      if (result.ok) {
        setCodes((current) => ({ ...current, [row.ref]: "" }));
        router.refresh();
      }
    });
  };

  const pendingCount = rows.filter((row) => row.status === "pending").length;

  return (
    <section className="space-y-3 rounded-2xl border border-[#C6A664]/40 bg-[#C6A664]/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-black text-stone-900">
            <Wallet className="h-4 w-4 text-[#8A6D2F]" />
            Paiements manuels à vérifier
          </h2>
          <p className="mt-1 max-w-3xl text-[12px] leading-5 text-stone-600">
            Binance Pay, OKX, Bybit, RedotPay, USDT direct, Skrill, Neteller, Airtm, D17, Volet, WebMoney et Kashy. Confrontez le compte expéditeur et
            l’identifiant de transaction à votre relevé AVANT d’accepter : le site
            ne peut pas vérifier la réception à votre place. Sans votre
            acceptation, aucun code n’est livré et aucun achat fournisseur n’est fait.
          </p>
        </div>
        <span className="rounded-full border border-[#C6A664]/50 bg-white px-3 py-1 text-[11px] font-bold text-[#8A6D2F]">
          {pendingCount} en attente
        </span>
      </div>

      {toast && (
        <p
          className={`rounded-xl border px-3 py-2 text-[12px] font-semibold ${
            toast.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.text}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white px-4 py-5 text-center text-[12.5px] text-stone-500">
          Aucun paiement manuel reçu.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const isBusy = busy && pendingRef === row.ref;
            const delta = Number(row.amountUsd) > 0 ? Number(row.payAmount) / Number(row.amountUsd) : null;
            return (
              <article key={row.ref} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-[12px] font-bold text-stone-900">{row.ref}</code>
                      <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${STATUS_TONES[row.status]}`}>
                        {STATUS_LABELS[row.status]}
                      </span>
                      <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10.5px] font-bold text-stone-600">
                        {KIND_LABELS[row.kind]} · {row.methodLabel}
                      </span>
                    </div>
                    <h3 className="mt-1 text-[13.5px] font-bold text-stone-900">{row.productTitle}</h3>
                    <p className="mt-1 break-words text-[11.5px] text-stone-500">
                      {row.recipientName || "Client"} · {row.recipientEmail || "—"}
                      {row.recipientPhone ? ` · ${row.recipientPhone}` : ""} · {adminDate(row.createdAt)}
                    </p>
                  </div>
                  <div className="text-end text-[12px]">
                    <div className="font-black text-stone-900" dir="ltr">
                      {row.payAmount} {row.payCurrency}
                    </div>
                    <div className="mt-0.5 text-stone-500" dir="ltr">
                      Commande : {row.amountUsd} USD
                      {delta && Math.abs(delta - 1) > 0.001 ? ` · taux ${row.payRate}` : ""}
                      {Number(row.feePercent) > 0 ? ` · +${row.feePercent}%` : ""}
                    </div>
                  </div>
                </div>

                {/* Preuve déclarée par le client — à confronter au relevé. */}
                <div className="mt-3 grid gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-[11.5px] sm:grid-cols-2">
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
                      Compte expéditeur déclaré
                    </div>
                    <div className="mt-0.5 break-all font-bold text-stone-900" dir="ltr">
                      {row.senderAccount}
                    </div>
                    <div className="text-stone-500">{row.senderName}</div>
                  </div>
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
                      Identifiant de transaction
                    </div>
                    <div className="mt-0.5 break-all font-mono font-bold text-stone-900" dir="ltr">
                      {row.transactionRef}
                    </div>
                  </div>
                  <div className="sm:col-span-2 border-t border-stone-200 pt-2">
                    <div className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
                      Compte à créditer (celui affiché au client)
                    </div>
                    <div className="mt-0.5 break-all text-stone-700" dir="ltr">
                      {row.targetAccount}
                      {row.targetBeneficiary ? ` · ${row.targetBeneficiary}` : ""}
                    </div>
                  </div>
                  {row.note && (
                    <p className="sm:col-span-2 border-t border-stone-200 pt-2 text-stone-600">
                      Note du client : {row.note}
                    </p>
                  )}
                  {row.reviewNote && (
                    <p className="sm:col-span-2 border-t border-stone-200 pt-2 text-stone-600">
                      Note de vérification : {row.reviewNote}
                      {row.reviewedAt ? ` · ${adminDate(row.reviewedAt)}` : ""}
                    </p>
                  )}
                </div>

                {row.status === "pending" && (
                  <div className="mt-3 space-y-2.5">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-stone-500">
                        Note interne (obligatoire en cas de refus)
                      </span>
                      <input
                        value={notes[row.ref] ?? ""}
                        onChange={(event) =>
                          setNotes((current) => ({ ...current, [row.ref]: event.target.value }))
                        }
                        maxLength={500}
                        placeholder="Ex. montant reçu / référence introuvable / montant différent"
                        className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-[12px] outline-none focus:border-[#C6A664]"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {row.kind === "digital" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => review(row, "approved", true)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[12px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Virement reçu — accepter et livrer
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => review(row, "approved", false)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 text-[12px] font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {row.kind === "subscription"
                          ? "Accepter et activer l’abonnement"
                          : "Accepter sans livrer"}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy || !(notes[row.ref] ?? "").trim()}
                        onClick={() => review(row, "rejected")}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-[12px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Refuser
                      </button>
                    </div>
                  </div>
                )}

                {row.status === "approved" && row.kind === "digital" && row.deliveryStatus !== "delivered" && (
                  <div className="mt-3 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
                    <div className="text-[11px] font-bold text-emerald-900">
                      Paiement accepté — livraison du code
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={codes[row.ref] ?? ""}
                        onChange={(event) =>
                          setCodes((current) => ({ ...current, [row.ref]: event.target.value }))
                        }
                        placeholder="Code cadeau à envoyer au client"
                        dir="ltr"
                        className="h-10 min-w-0 flex-1 rounded-lg border border-emerald-300 bg-white px-3 font-mono text-[12px] outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => deliver(row)}
                        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[12px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowDownToLine className="h-3.5 w-3.5" />
                        )}
                        Livrer
                      </button>
                    </div>
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
