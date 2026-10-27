"use client";

import { useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react";
import {
  closeDigitalOrderWithoutCodeAction,
  manualDigitalDeliveryAction,
  resendDigitalEmailAction,
  retryDigitalDeliveryAction,
} from "@/app/admin/actions";
import {
  DIGITAL_ORDER_STATUS_LABELS,
  DIGITAL_ORDER_STATUS_TONES,
  type DigitalOrderStatus,
} from "@/lib/digital-order-core";
/** Ligne aplatie reçue du serveur (dates ISO, codes déchiffrés). */
export interface AdminDigitalOrderRow {
  ref: string;
  createdAt: string;
  productTitle: string;
  platform: string;
  denominationLabel: string;
  region: string;
  quantity: number;
  unitPriceUsd: string;
  totalUsd: string;
  recipientEmail: string;
  recipientName: string | null;
  recipientPhone: string | null;
  status: DigitalOrderStatus;
  /** Famille du produit : une recharge (`game_topup`) ne produit aucun code. */
  kind: string;
  fulfillment: string;
  reloadlyProductId: number | null;
  reloadlyUnitPrice: string | null;
  reloadlyTransactionId: string | null;
  reloadlyStatus: string | null;
  deliveredAt: string | null;
  emailSentAt: string | null;
  emailProviderId: string | null;
  emailLastError: string | null;
  attempts: number;
  lastError: string | null;
  codes: { cardNumber: string; pinCode: string | null; redemptionUrl: string | null }[];
}

function frDate(value: string | null): string {
  if (!value) return "—";
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

/**
 * Tableau des commandes de codes (admin) : détail dépliable, codes
 * livrés, motif d'échec et relance de la livraison.
 */
export function DigitalOrdersTable({ rows }: { rows: AdminDigitalOrderRow[] }) {
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [manualRef, setManualRef] = useState<string | null>(null);
  const [manualCodes, setManualCodes] = useState("");

  const flash = (msg: string, kind: "ok" | "err") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 6000);
  };

  const retry = (ref: string) => {
    setPendingRef(ref);
    startTransition(async () => {
      const result = await retryDigitalDeliveryAction(ref);
      flash(result.message ?? result.error ?? "Terminé.", result.ok ? "ok" : "err");
      setPendingRef(null);
    });
  };

  const resend = (ref: string) => {
    setPendingRef(ref);
    startTransition(async () => {
      const result = await resendDigitalEmailAction(ref);
      flash(result.message ?? result.error ?? "Terminé.", result.ok ? "ok" : "err");
      setPendingRef(null);
    });
  };

  const closeWithoutCode = (ref: string) => {
    setPendingRef(ref);
    startTransition(async () => {
      const result = await closeDigitalOrderWithoutCodeAction(ref);
      flash(result.message ?? result.error ?? "Terminé.", result.ok ? "ok" : "err");
      setPendingRef(null);
    });
  };

  const saveManual = (ref: string) => {
    setPendingRef(ref);
    startTransition(async () => {
      const result = await manualDigitalDeliveryAction(ref, manualCodes);
      flash(result.message ?? result.error ?? "Terminé.", result.ok ? "ok" : "err");
      if (result.ok) {
        setManualRef(null);
        setManualCodes("");
      }
      setPendingRef(null);
    });
  };

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      window.prompt("Copier :", value);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500 shadow-2xs">
        Aucune commande de code pour le moment. Dès qu&apos;une commande est payée,
        elle apparaît ici avec son état de livraison.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toast && (
        <div
          className={`rounded-xl border px-4 py-3 text-[13px] font-semibold ${
            toast.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-2xs divide-y divide-stone-100">
        {rows.map((row) => {
          const open = openRef === row.ref;
          const status = row.status as DigitalOrderStatus;
          const canRetry = ["paid", "manual", "failed"].includes(status);
          const isBusy = busy && pendingRef === row.ref;

          return (
            <div key={row.ref} className={open ? "bg-[#FAF9F6]" : "bg-white"}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <button
                  type="button"
                  onClick={() => setOpenRef(open ? null : row.ref)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-stone-400 transition-transform ${
                      open ? "rotate-180 text-stone-800" : ""
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-stone-900">
                      {row.productTitle}
                      <span className="ml-2 font-normal text-stone-500">
                        — {row.denominationLabel} × {row.quantity}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-stone-500">
                      {row.ref} · {row.totalUsd} $ · {row.recipientEmail}
                      {row.platform ? ` · ${row.platform}` : ""}
                    </div>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-xs tabular-nums text-stone-400 sm:inline">
                    {frDate(row.createdAt)}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${DIGITAL_ORDER_STATUS_TONES[status]}`}
                  >
                    {DIGITAL_ORDER_STATUS_LABELS[status]}
                  </span>
                </div>
              </div>

              {open && (
                <div className="space-y-4 border-t border-stone-200 px-4 py-4 sm:px-5">
                  <dl className="grid gap-2 text-[12.5px] sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 font-bold text-stone-500">Client</dt>
                      <dd className="min-w-0 break-words">
                        {row.recipientName || "—"} · {row.recipientEmail}
                        {row.recipientPhone ? ` · ${row.recipientPhone}` : ""}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 font-bold text-stone-500">Montant</dt>
                      <dd>
                        {row.unitPriceUsd} $ × {row.quantity} = <strong>{row.totalUsd} $</strong>
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 font-bold text-stone-500">Mode</dt>
                      <dd>
                        {row.fulfillment === "auto" ? "Automatique (Reloadly)" : "Manuel"}
                        {row.reloadlyProductId
                          ? ` · produit #${row.reloadlyProductId} / ${row.reloadlyUnitPrice}${
                              row.region ? ` (${row.region})` : ""
                            }`
                          : " · aucun produit Reloadly relié"}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 font-bold text-stone-500">Reloadly</dt>
                      <dd>
                        {row.reloadlyTransactionId || "—"}
                        {row.reloadlyStatus ? ` (${row.reloadlyStatus})` : ""}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 font-bold text-stone-500">Livrée le</dt>
                      <dd>{frDate(row.deliveredAt)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 font-bold text-stone-500">E-mail codes</dt>
                      <dd>
                        {frDate(row.emailSentAt)} · {row.attempts} tentative
                        {row.attempts > 1 ? "s" : ""}
                        {row.emailProviderId && (
                          <span className="mt-0.5 block break-all text-[11px] text-stone-500">
                            message : <code>{row.emailProviderId}</code>
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  {row.emailLastError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-900">
                      <strong>E-mail non envoyé :</strong> {row.emailLastError}
                      <span className="mt-1 block text-[11px] text-red-800/80">
                        Testez le canal dans « Envoi des e-mails » ci-dessus : un domaine
                        non vérifié (SPF/DKIM) est accepté puis perdu.
                      </span>
                    </p>
                  )}

                  {row.lastError && (
                    <p className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] leading-5 text-orange-900">
                      <strong>Motif :</strong> {row.lastError}
                    </p>
                  )}

                  {row.codes.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-stone-500">
                        Codes livrés ({row.codes.length})
                      </div>
                      {row.codes.map((code, index) => (
                        <div
                          key={`${row.ref}-${index}`}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2"
                        >
                          <code className="break-all font-mono text-[13px] font-bold" dir="ltr">
                            {code.cardNumber}
                          </code>
                          {code.pinCode && (
                            <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[12px]">
                              PIN {code.pinCode}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => copy(code.cardNumber, `${row.ref}-${index}`)}
                            className="ml-auto inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-600 hover:bg-stone-50"
                          >
                            {copied === `${row.ref}-${index}` ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            Copier
                          </button>
                          {code.redemptionUrl && (
                            <a
                              href={code.redemptionUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-600 hover:bg-stone-50"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Activer
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {canRetry && (
                      <button
                        type="button"
                        onClick={() => retry(row.ref)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#C6A664] px-3 py-2 text-[12px] font-bold text-stone-900 hover:bg-[#B8923F] disabled:opacity-60"
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Relancer la livraison
                      </button>
                    )}
                    {row.codes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => resend(row.ref)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-[12px] font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Renvoyer l&apos;e-mail
                      </button>
                    )}
                    {status !== "delivered" && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualRef(manualRef === row.ref ? null : row.ref);
                          setManualCodes("");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-[12px] font-bold text-stone-700 hover:bg-stone-50"
                      >
                        Saisir les codes manuellement
                      </button>
                    )}
                  </div>

                  <p className="text-[11.5px] leading-5 text-stone-500">
                    {status === "delivered"
                      ? "Code acheté et transmis — rien d'autre à faire."
                      : row.fulfillment === "auto"
                        ? "La relance achète le code chez Reloadly (débit du solde marchand). Aucun second achat si une transaction existe déjà."
                        : "Mode manuel : achetez le code dans le tableau Reloadly, puis saisissez-le ci-dessous — le client reçoit l'e-mail automatiquement. Si la fiche vient d'être passée en automatique, « Relancer la livraison » relit la fiche et achète le code, sans nouveau paiement."}
                  </p>

                  {manualRef === row.ref && status !== "delivered" && (
                    <div className="rounded-xl border border-stone-200 bg-white p-3">
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-500">
                          Codes (un par ligne : numéro | PIN | URL d&apos;activation)
                        </span>
                        <textarea
                          rows={3}
                          value={manualCodes}
                          onChange={(event) => setManualCodes(event.target.value)}
                          placeholder={"6120200345149064 | EFSDCEAFSD | https://…"}
                          dir="ltr"
                          className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-[12.5px] outline-none focus:border-[#B8923F]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => saveManual(row.ref)}
                        disabled={isBusy || !manualCodes.trim()}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-[12px] font-bold text-white hover:bg-stone-800 disabled:opacity-60"
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Enregistrer et envoyer au client
                      </button>

                      {/* Une recharge de jeu ne produit aucun code : le
                          crédit part sur le compte du joueur. Ce bouton
                          clôture la commande sans exiger de faux code. */}
                      {row.kind === "game_topup" && (
                        <button
                          type="button"
                          onClick={() => closeWithoutCode(row.ref)}
                          disabled={isBusy}
                          className="mt-2 ms-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Recharge créditée (aucun code)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
