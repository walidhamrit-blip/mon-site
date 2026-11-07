"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import {
  closeDigitalOrderWithoutCodeAction,
  manualDigitalDeliveryAction,
  markDeliveredOffPlatformAction,
  resendDigitalEmailAction,
  retryDigitalDeliveryAction,
} from "@/app/admin/actions";
import {
  OFF_PLATFORM_CHANNELS,
  OFF_PLATFORM_CHANNEL_LABELS,
  OFF_PLATFORM_NOTE_MAX,
  type OffPlatformChannel,
} from "@/lib/digital-offplatform-core";
import {
  OPEN_ORDER_EVENT,
  orderAnchor,
  parseOrderHash,
  type OrderLinkTarget,
} from "@/lib/admin-order-link";
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
  paymentMethod: "nowpayments" | "phone_card";
  phoneCardStatus: "pending" | "approved" | "rejected" | null;
  /** Famille du produit : une recharge (`game_topup`) ne produit aucun code. */
  kind: string;
  /** Fournisseur qui livre la commande (déduit du préfixe de slug). */
  supplier: "fazercards" | "reloadly";
  /**
   * Champs acheteur mémorisés à la caisse — donc l'identifiant RÉELLEMENT
   * transmis au fournisseur (recharge : `user_id`, `server_id`…).
   */
  buyerFields: Record<string, string | number>;
  /**
   * Contrôle d'identifiant fait à la caisse : vérifié (pseudo), refusé, ou
   * jeu non vérifiable certifié par le client. `null` = commande antérieure
   * au garde-fou.
   */
  playerIdCheck: {
    checked: boolean;
    valid: boolean;
    playerName?: string;
    region?: string;
    reason?: string;
    confirmedByCustomer?: boolean;
  } | null;
  fulfillment: string;
  reloadlyProductId: number | null;
  reloadlyUnitPrice: string | null;
  reloadlyTransactionId: string | null;
  reloadlyStatus: string | null;
  deliveredAt: string | null;
  emailSentAt: string | null;
  emailProviderId: string | null;
  emailLastError: string | null;
  /** Livraison hors système (WhatsApp…) : canal + note interne. */
  deliveryChannel: string | null;
  deliveryNote: string | null;
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

/** Nom lisible du fournisseur (jamais de jargon interne dans l'admin). */
function supplierLabel(supplier: "fazercards" | "reloadly"): string {
  return supplier === "fazercards" ? "FazerCards" : "Archive (ancien fournisseur)";
}

/**
 * Détail du mode de livraison, spécifique au fournisseur.
 *
 * Les colonnes de la base sont héritées de Reloadly : pour une commande
 * FazerCards, `reloadlyProductId` est toujours vide (l'achat se fait avec
 * l'identifiant de catégorie, pas avec un produit relié). Afficher
 * « archive : fournisseur retiré » sur ces lignes faisait croire à une
 * configuration manquante.
 */
function modeDetail(row: AdminDigitalOrderRow): string {
  if (row.supplier === "fazercards") {
    return row.kind === "game_topup"
      ? " · recharge à la commande (aucun produit à relier)"
      : " · achat à la commande chez FazerCards";
  }
  return row.reloadlyProductId
    ? ` · produit #${row.reloadlyProductId} / ${row.reloadlyUnitPrice}${
        row.region ? ` (${row.region})` : ""
      }`
    : " · archive : fournisseur retiré";
}

/**
 * Résumé du contrôle d'identifiant pour l'admin.
 *
 * Un identifiant « certifié par le client » (jeu non vérifiable) n'a pas la
 * même valeur qu'un identifiant « vérifié » : l'affichage doit le dire, sinon
 * un litige se traite sans savoir ce qui a réellement été contrôlé.
 */
function playerIdCheckLabel(row: AdminDigitalOrderRow): React.ReactNode {
  const check = row.playerIdCheck;
  if (!check) {
    return (
      <span className="text-stone-500">
        Non enregistré (commande antérieure au contrôle)
      </span>
    );
  }
  if (check.checked && check.valid) {
    return (
      <span className="font-semibold text-emerald-700">
        Vérifié chez le fournisseur
        {check.playerName ? ` · compte « ${check.playerName} »` : ""}
        {check.region ? ` (${check.region})` : ""}
      </span>
    );
  }
  if (check.checked && !check.valid) {
    return (
      <span className="font-semibold text-red-700">
        Identifiant refusé par le fournisseur
      </span>
    );
  }
  if (check.confirmedByCustomer) {
    return (
      <span className="font-semibold text-amber-700">
        Non vérifiable chez le fournisseur — certifié par le client
        {check.reason ? ` (${check.reason})` : ""}
      </span>
    );
  }
  return (
    <span className="text-stone-500">
      Non vérifiable chez le fournisseur{check.reason ? ` (${check.reason})` : ""}
    </span>
  );
}

/** Livraison manuelle autorisée : carte téléphonique acceptée, ou autre moyen. */
function rowAllowsManualDelivery(row: AdminDigitalOrderRow): boolean {
  return row.paymentMethod !== "phone_card" || row.phoneCardStatus === "approved";
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
  const [offPlatformRef, setOffPlatformRef] = useState<string | null>(null);
  const [offPlatformChannel, setOffPlatformChannel] = useState<OffPlatformChannel>("whatsapp");
  const [offPlatformNote, setOffPlatformNote] = useState("");

  // Ouverture depuis la zone « Cartes téléphoniques à vérifier » : fragment
  // d'URL (#commande-…), ou événement si le fragment est déjà le bon.
  useEffect(() => {
    const apply = (target: OrderLinkTarget) => {
      const row = rows.find((item) => item.ref === target.ref);
      if (!row) return;
      setOpenRef(target.ref);
      setManualRef(null);
      setManualCodes("");
      if (
        target.offPlatform &&
        row.status !== "delivered" &&
        row.codes.length === 0 &&
        rowAllowsManualDelivery(row)
      ) {
        setOffPlatformRef(target.ref);
      } else {
        setOffPlatformRef(null);
      }
      window.requestAnimationFrame(() => {
        document
          .getElementById(orderAnchor(target.ref))
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    };

    const fromHash = () => {
      const parsed = parseOrderHash(window.location.hash);
      if (parsed) apply(parsed);
    };
    const fromEvent = (event: Event) => {
      const detail = (event as CustomEvent<OrderLinkTarget>).detail;
      if (detail?.ref) apply(detail);
    };

    fromHash();
    window.addEventListener("hashchange", fromHash);
    window.addEventListener(OPEN_ORDER_EVENT, fromEvent);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener(OPEN_ORDER_EVENT, fromEvent);
    };
  }, [rows]);

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

  const saveOffPlatform = (ref: string) => {
    setPendingRef(ref);
    startTransition(async () => {
      const result = await markDeliveredOffPlatformAction(ref, offPlatformChannel, offPlatformNote);
      flash(result.message ?? result.error ?? "Terminé.", result.ok ? "ok" : "err");
      if (result.ok) {
        setOffPlatformRef(null);
        setOffPlatformNote("");
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
          const canRetry =
            row.paymentMethod !== "phone_card" &&
            row.supplier === "fazercards" &&
            ["paid", "manual", "failed"].includes(status);
          const canDeliverManually = rowAllowsManualDelivery(row);
          const buyerFieldEntries = Object.entries(row.buyerFields ?? {});
          const isBusy = busy && pendingRef === row.ref;

          return (
            <div
              key={row.ref}
              id={orderAnchor(row.ref)}
              className={`scroll-mt-24 ${open ? "bg-[#FAF9F6]" : "bg-white"}`}
            >
              <button
                type="button"
                onClick={() => setOpenRef(open ? null : row.ref)}
                aria-expanded={open}
                aria-controls={`detail-${orderAnchor(row.ref)}`}
                className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-stone-50/70 sm:px-5"
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-stone-400 transition-transform ${
                      open ? "rotate-180 text-stone-800" : ""
                    }`}
                  />
                  <span className="block min-w-0">
                    <span className="block truncate text-sm font-bold text-stone-900">
                      {row.productTitle}
                      <span className="ml-2 font-normal text-stone-500">
                        — {row.denominationLabel} × {row.quantity}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-stone-500">
                      {row.ref} · {row.totalUsd} $ · {row.recipientEmail}
                      {row.platform ? ` · ${row.platform}` : ""}
                    </span>
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-xs tabular-nums text-stone-400 sm:inline">
                    {frDate(row.createdAt)}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${DIGITAL_ORDER_STATUS_TONES[status]}`}
                  >
                    {DIGITAL_ORDER_STATUS_LABELS[status]}
                  </span>
                </span>
              </button>

              {open && (
                <div
                  id={`detail-${orderAnchor(row.ref)}`}
                  className="space-y-4 border-t border-stone-200 px-4 py-4 sm:px-5"
                >
                  {status !== "delivered" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
                        À acheter chez {supplierLabel(row.supplier)}
                      </div>
                      <p className="mt-1 text-[14px] font-bold text-stone-900">{row.productTitle}</p>
                      <p className="mt-0.5 text-[12.5px] text-stone-700">
                        {[
                          row.platform,
                          row.denominationLabel,
                          `région ${(row.region || "global").toUpperCase()}`,
                          `quantité ${row.quantity}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-1 text-[11.5px] leading-5 text-amber-900/80">
                        {row.kind === "game_topup"
                          ? "Recharge : créditer l'identifiant joueur — aucun code à saisir, puis « Clôturer sans code »."
                          : "Vérifiez plateforme, valeur et région avant l'achat : un code hors région est refusé par le client."}
                      </p>
                    </div>
                  )}

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
                        {row.fulfillment === "auto"
                          ? `Automatique (${supplierLabel(row.supplier)})`
                          : "Manuel"}
                        {modeDetail(row)}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 font-bold text-stone-500">
                        {supplierLabel(row.supplier)}
                      </dt>
                      <dd className="min-w-0 break-words">
                        {row.reloadlyTransactionId || "—"}
                        {row.reloadlyStatus ? ` (${row.reloadlyStatus})` : ""}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 font-bold text-stone-500">
                        Identifiant transmis
                      </dt>
                      <dd className="min-w-0 break-words">
                        {buyerFieldEntries.length > 0 ? (
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {buyerFieldEntries.map(([key, value]) => (
                              <span key={key} className="inline-flex items-center gap-1.5">
                                <span className="text-stone-500">{key}</span>
                                <code
                                  className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[12px] font-bold"
                                  dir="ltr"
                                >
                                  {value}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => copy(String(value), `${row.ref}-${key}`)}
                                  className="rounded border border-stone-200 p-0.5 text-stone-500 hover:bg-stone-50"
                                  aria-label={`Copier ${key}`}
                                >
                                  {copied === `${row.ref}-${key}` ? (
                                    <Check className="h-3 w-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </span>
                            ))}
                          </span>
                        ) : row.kind === "game_topup" ? (
                          <span className="text-red-700">
                            Aucun identifiant enregistré — vérifier la commande avant toute
                            relance.
                          </span>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    {row.kind === "game_topup" && (
                      <div className="flex gap-2">
                        <dt className="w-32 shrink-0 font-bold text-stone-500">
                          Contrôle identifiant
                        </dt>
                        <dd className="min-w-0 break-words">{playerIdCheckLabel(row)}</dd>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <dt className="w-32 shrink-0 font-bold text-stone-500">Livrée le</dt>
                      <dd>{frDate(row.deliveredAt)}</dd>
                    </div>
                    {row.deliveryChannel && (
                      <div className="flex gap-2 sm:col-span-2">
                        <dt className="w-32 shrink-0 font-bold text-stone-500">Livraison</dt>
                        <dd className="min-w-0 break-words">
                          Hors système —{" "}
                          {OFF_PLATFORM_CHANNEL_LABELS[
                            row.deliveryChannel as OffPlatformChannel
                          ] ?? row.deliveryChannel}
                          {row.deliveryNote ? ` · ${row.deliveryNote}` : ""}
                          <span className="mt-0.5 block text-[11px] text-stone-500">
                            Le code n&apos;est pas stocké ici : il a été transmis au client par ce canal.
                          </span>
                        </dd>
                      </div>
                    )}
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
                    {status !== "delivered" && canDeliverManually && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualRef(manualRef === row.ref ? null : row.ref);
                          setManualCodes("");
                          setOffPlatformRef(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-[12px] font-bold text-stone-700 hover:bg-stone-50"
                      >
                        Saisir les codes manuellement
                      </button>
                    )}
                    {status !== "delivered" && canDeliverManually && row.codes.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setOffPlatformRef(offPlatformRef === row.ref ? null : row.ref);
                          setManualRef(null);
                          setManualCodes("");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800 hover:bg-emerald-100"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Livré hors système (WhatsApp…)
                      </button>
                    )}
                  </div>

                  <p className="text-[11.5px] leading-5 text-stone-500">
                    {row.paymentMethod === "phone_card" && !canDeliverManually
                      ? "Paiement par carte téléphonique : utilisez la zone de vérification ci-dessus. La livraison reste verrouillée tant que la carte n’est pas acceptée."
                      : status === "delivered"
                      ? row.kind === "game_topup"
                        ? "Recharge créditée sur le compte du joueur — rien d'autre à faire."
                        : row.deliveryChannel
                          ? "Code transmis hors système (voir « Livraison ») — rien d'autre à faire."
                          : "Code acheté et transmis — rien d'autre à faire."
                      : row.fulfillment === "auto"
                        ? `La relance achète ${row.kind === "game_topup" ? "la recharge" : "le code"} chez ${supplierLabel(row.supplier)} (débit du solde marchand). Aucun second achat si une transaction existe déjà.`
                        : `Mode manuel : achetez ${row.kind === "game_topup" ? "la recharge" : "le code"} chez le fournisseur, puis saisissez-le ci-dessous — le client reçoit l'e-mail automatiquement. Si la fiche vient d'être passée en automatique, « Relancer la livraison » relit la fiche et achète sans nouveau paiement.`}
                  </p>

                  {offPlatformRef === row.ref && status !== "delivered" && canDeliverManually && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                      <p className="text-[11.5px] leading-5 text-stone-700">
                        À utiliser si le code a <strong>déjà été transmis au client</strong> (WhatsApp,
                        téléphone, e-mail direct). La commande passera en « Livré », le client recevra un
                        e-mail de confirmation <strong>sans le code</strong>, et un nouveau lien de suivi
                        sera créé — l&apos;ancien cessera de fonctionner.
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-500">
                            Canal utilisé
                          </span>
                          <select
                            value={offPlatformChannel}
                            onChange={(event) =>
                              setOffPlatformChannel(event.target.value as OffPlatformChannel)
                            }
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#B8923F]"
                          >
                            {OFF_PLATFORM_CHANNELS.map((channel) => (
                              <option key={channel} value={channel}>
                                {OFF_PLATFORM_CHANNEL_LABELS[channel]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-stone-500">
                            Note interne (facultatif)
                          </span>
                          <input
                            value={offPlatformNote}
                            maxLength={OFF_PLATFORM_NOTE_MAX}
                            onChange={(event) => setOffPlatformNote(event.target.value)}
                            placeholder="Ex. envoyé par WhatsApp au 091… à 21:40"
                            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#B8923F]"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => saveOffPlatform(row.ref)}
                        disabled={isBusy}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-[12px] font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Marquer livré et prévenir le client
                      </button>
                      <p className="mt-1 text-[11px] text-stone-500">
                        La note reste interne : elle n&apos;est jamais envoyée au client.
                      </p>
                    </div>
                  )}

                  {manualRef === row.ref && status !== "delivered" && canDeliverManually && (
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
