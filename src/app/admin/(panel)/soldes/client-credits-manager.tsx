"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Coins, Loader2, Plus, Undo2, Wallet, XCircle } from "lucide-react";
import {
  addCreditMovementAction,
  approveCreditRequestAction,
  rejectCreditRequestAction,
} from "@/app/admin/actions";
import {
  CREDIT_MOVEMENT_LABELS,
  CREDIT_MOVEMENT_SIGNS,
  balanceLabel,
  displayLyd,
  type CreditMovementKind,
} from "@/lib/client-credits-core";
import type { AdminClientCredit, AdminCreditMovement } from "@/lib/client-credits";
import type { AdminCreditRequest } from "@/lib/client-credit-requests";

const MANUAL_KINDS: CreditMovementKind[] = ["use", "refund", "adjustment"];

function frDate(value: string): string {
  const date = new Date(value);
  try {
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Tripoli",
    });
  } catch {
    return date.toLocaleString("fr-FR");
  }
}

function clientLabel(credit: {
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientKey: string;
}): string {
  return (
    credit.clientName?.trim() ||
    credit.clientEmail?.trim() ||
    credit.clientPhone?.trim() ||
    credit.clientKey
  );
}

export function ClientCreditsManager({
  credits,
  movements,
  requests = [],
}: {
  credits: AdminClientCredit[];
  movements: AdminCreditMovement[];
  requests?: AdminCreditRequest[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [openId, setOpenId] = useState<number | null>(null);
  const [kind, setKind] = useState<CreditMovementKind>("use");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const flash = (k: "ok" | "err", text: string) => {
    setToast({ kind: k, text });
    setTimeout(() => setToast(null), 7000);
  };

  const pendingRequests = requests.filter((request) => request.status === "pending");
  const handledRequests = requests.filter((request) => request.status !== "pending").slice(0, 5);

  const decide = (requestId: number, decision: "approve" | "reject", orderRef: string) => {
    if (
      decision === "approve" &&
      !window.confirm(
        `Débiter le solde du client pour la commande ${orderRef} ? Le mouvement sera enregistré au nom de cette commande.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result =
        decision === "approve"
          ? await approveCreditRequestAction(requestId)
          : await rejectCreditRequestAction(requestId);
      flash(result.ok ? "ok" : "err", result.message ?? result.error ?? "Terminé.");
      if (result.ok) router.refresh();
    });
  };

  const submit = (creditId: number) => {
    startTransition(async () => {
      const result = await addCreditMovementAction({ creditId, kind, amountLyd: amount, note, orderRef });
      flash(result.ok ? "ok" : "err", result.message ?? result.error ?? "Terminé.");
      if (result.ok) {
        setOpenId(null);
        setAmount("");
        setNote("");
        setOrderRef("");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div
          className={`rounded-xl border px-4 py-3 text-[13px] font-semibold ${
            toast.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.text}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/40 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/70 bg-white/60 px-4 py-3">
          <span className="text-[12px] font-bold uppercase tracking-wide text-amber-900">
            Demandes des clients
          </span>
          <span className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
            {pendingRequests.length} en attente
          </span>
        </div>
        {pendingRequests.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-stone-500">
            Aucune demande en attente. Un client peut demander à utiliser son solde depuis le
            suivi de sa commande ; rien n&rsquo;est débité avant votre validation.
          </p>
        ) : (
          <ul className="divide-y divide-amber-200/60">
            {pendingRequests.map((request) => (
              <li key={request.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-[12px] font-bold text-stone-900">
                        {request.orderRef}
                      </code>
                      <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10.5px] font-bold text-amber-800">
                        {balanceLabel(request.amountLyd)} demandés
                      </span>
                    </div>
                    <p className="mt-1 break-words text-[11.5px] text-stone-600">
                      {request.clientName || "Client"} · {request.clientEmail || request.clientPhone || "—"}
                      {request.productTitle ? ` · ${request.productTitle}` : ""} ·{" "}
                      {frDate(request.createdAt)}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-stone-500">
                      Solde actuel : <strong>{balanceLabel(request.balanceLyd)}</strong>
                      {request.clientNote ? ` · Message : ${request.clientNote}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => decide(request.id, "approve", request.orderRef)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[12px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Valider l&rsquo;utilisation
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => decide(request.id, "reject", request.orderRef)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-[12px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Refuser
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {handledRequests.length > 0 && (
          <div className="border-t border-amber-200/60 bg-white/50 px-4 py-2.5">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
              Dernières demandes traitées
            </div>
            <ul className="mt-1 space-y-0.5 text-[11.5px] text-stone-600">
              {handledRequests.map((request) => (
                <li key={request.id}>
                  {request.orderRef} · {balanceLabel(request.amountLyd)} ·{" "}
                  {request.status === "approved" ? "validée" : "refusée"} ·{" "}
                  {request.reviewedAt ? frDate(request.reviewedAt) : "—"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-2xs">
        <div className="border-b border-stone-100 px-4 py-3 text-[12px] font-bold uppercase tracking-wide text-stone-500">
          Clients avec un solde
        </div>
        {credits.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-stone-500">
            Aucun solde enregistré. Les trop-perçus des cartes téléphoniques apparaissent ici
            automatiquement dès que la carte est acceptée.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {credits.map((credit) => {
              const open = openId === credit.id;
              return (
                <li key={credit.id} className={open ? "bg-[#FAF9F6]" : "bg-white"}>
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-stone-900">
                        {clientLabel(credit)}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-stone-500">
                        {[credit.clientEmail, credit.clientPhone].filter(Boolean).join(" · ") ||
                          credit.clientKey}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[12px] font-bold ${
                          Number(credit.balanceLyd) > 0
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-stone-200 bg-stone-50 text-stone-600"
                        }`}
                      >
                        {balanceLabel(credit.balanceLyd)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenId(open ? null : credit.id);
                          setKind("use");
                          setAmount("");
                          setNote("");
                          setOrderRef("");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-[12px] font-bold text-stone-700 hover:bg-stone-50"
                      >
                        <Coins className="h-3.5 w-3.5" />
                        Mouvement
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="space-y-2 border-t border-stone-200 px-4 py-3">
                      <p className="text-[11.5px] leading-5 text-stone-600">
                        « Utilisé » et « remboursé » débitent le solde (jamais au-delà de{" "}
                        <strong>{balanceLabel(credit.balanceLyd)}</strong>). Un ajustement peut
                        corriger dans les deux sens.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-500">
                            Type
                          </span>
                          <select
                            value={kind}
                            onChange={(event) => setKind(event.target.value as CreditMovementKind)}
                            className="w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-[12.5px]"
                          >
                            {MANUAL_KINDS.map((value) => (
                              <option key={value} value={value}>
                                {CREDIT_MOVEMENT_LABELS[value]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-500">
                            Montant (LYD)
                          </span>
                          <input
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            inputMode="decimal"
                            placeholder="12.04"
                            className="w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-[12.5px]"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-500">
                            Commande
                          </span>
                          <input
                            value={orderRef}
                            onChange={(event) => setOrderRef(event.target.value)}
                            placeholder="DGC-…"
                            className="w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-[12.5px]"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-500">
                            Note
                          </span>
                          <input
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            maxLength={300}
                            placeholder="Ex. utilisé sur la commande du 12/11"
                            className="w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-[12.5px]"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => submit(credit.id)}
                        disabled={busy || !amount.trim()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-[12px] font-bold text-white hover:bg-stone-800 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Enregistrer le mouvement
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-2xs">
        <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3 text-[12px] font-bold uppercase tracking-wide text-stone-500">
          <Wallet className="h-3.5 w-3.5" /> Derniers mouvements
        </div>
        {movements.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-stone-500">Aucun mouvement.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {movements.map((movement) => {
              const sign = CREDIT_MOVEMENT_SIGNS[movement.kind];
              const amount = Number(movement.amountLyd.replace(",", "."));
              return (
                <li key={movement.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[12.5px]">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-stone-900">
                      {clientLabel({
                        clientName: movement.clientName,
                        clientEmail: movement.clientEmail,
                        clientPhone: movement.clientPhone,
                        clientKey: "—",
                      })}
                      <span className="ml-2 font-normal text-stone-500">
                        {CREDIT_MOVEMENT_LABELS[movement.kind]}
                        {movement.orderRef ? ` · ${movement.orderRef}` : ""}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[11.5px] text-stone-500">
                      {frDate(movement.createdAt)}
                      {movement.note ? ` · ${movement.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 font-bold tabular-nums">
                    <span className={sign > 0 ? "text-emerald-700" : "text-red-700"}>
                      {sign > 0 ? "+" : "−"}
                      {displayLyd(Math.abs(amount))}
                    </span>
                    <span className="text-[11px] font-normal text-stone-500">
                      solde {balanceLabel(movement.balanceAfterLyd)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-stone-100 px-4 py-2 text-[11px] text-stone-500">
          <Undo2 className="mr-1 inline h-3 w-3" />
          Un mouvement ne s&rsquo;efface pas : une erreur se corrige par un ajustement opposé.
        </p>
      </section>
    </div>
  );
}
