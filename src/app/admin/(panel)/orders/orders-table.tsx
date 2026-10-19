"use client";
import { Fragment, useState } from "react";
import {
  ORDER_KIND_LABELS,
  ORDER_STATUS_LABELS,
  type OrderRow,
} from "@/lib/site-types";
import { ChevronDown, ExternalLink, Copy } from "lucide-react";

const statusStyles: Record<OrderRow["status"], string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  expired: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-zinc-600">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-sm text-zinc-200 break-all ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible */
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-[#121218] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-zinc-500 border-b border-white/10">
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Commande</th>
              <th className="px-4 py-3 text-left font-semibold">Client</th>
              <th className="px-4 py-3 text-left font-semibold">Formule</th>
              <th className="px-4 py-3 text-left font-semibold">Montant</th>
              <th className="px-4 py-3 text-left font-semibold">Crypto</th>
              <th className="px-4 py-3 text-left font-semibold">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const isOpen = expanded === order.ref;
              return (
                <Fragment key={order.ref}>
                  <tr
                    className={`border-b border-white/5 transition-colors ${
                      isOpen ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="px-4 py-3.5 text-zinc-400 whitespace-nowrap text-xs">
                      {order.dateFr}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-zinc-300">
                      {order.ref}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-white">
                        {order.clientName || "—"}
                      </div>
                      {order.email && (
                        <div
                          className="text-xs text-zinc-500"
                          dir="ltr"
                        >
                          {order.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-300">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{order.planName}</span>
                        {order.kind === "reservation" && (
                          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 whitespace-nowrap">
                            {ORDER_KIND_LABELS.reservation}
                          </span>
                        )}
                        {order.kind === "flex" && (
                          <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-300 whitespace-nowrap">
                            {ORDER_KIND_LABELS.flex}
                          </span>
                        )}
                        {order.installments > 1 && (
                          <span className="inline-flex items-center rounded-full border border-[#C6A664]/30 bg-[#C6A664]/10 px-2 py-0.5 text-[10px] font-bold text-[#E8D5A9] whitespace-nowrap">
                            Tranche {order.installmentIndex}/{order.installments}
                          </span>
                        )}
                      </div>
                      {order.demoSlug && (
                        <div className="mt-0.5 text-[11px] text-zinc-600 font-mono">
                          /demos/{order.demoSlug}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-bold text-white">
                        {Number(order.amountLyd).toLocaleString("en-LY")} LYD
                      </span>
                      <span className="block text-xs text-zinc-500">
                        ${order.amountUsd}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-300">
                      {order.payCurrency ? (
                        <>
                          <span className="font-bold" dir="ltr">
                            {order.payAmount} {order.payCurrency.toUpperCase()}
                          </span>
                          {order.payAddress && (
                            <button
                              type="button"
                              onClick={() => copy(order.payAddress ?? "")}
                              className="ms-1.5 text-zinc-500 hover:text-[#C6A664] transition-colors cursor-pointer"
                              title="Copier l'adresse"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold whitespace-nowrap ${statusStyles[order.status]}`}
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : order.ref)}
                        className="h-8 w-8 rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 grid place-items-center transition-colors cursor-pointer"
                        aria-label="Détails"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="border-b border-white/10 bg-black/40">
                      <td colSpan={8} className="px-4 py-5">
                        <dl className="grid md:grid-cols-2 gap-x-6 gap-y-3.5 content-start">
                          <Detail
                            label="Type de commande"
                            value={
                              order.kind === "reservation"
                                ? "Réservation prioritaire (acompte)"
                                : "Formule complète"
                            }
                          />
                          <Detail label="Site du portfolio" value={order.demoSlug} />
                          {order.kind === "reservation" && (
                            <Detail
                              label="Acompte"
                              value="À déduire du prix final du projet"
                            />
                          )}
                          <Detail label="Téléphone" value={order.phone} />
                          <Detail label="E-mail" value={order.email} />
                          <Detail label="IPN (brut)" value={order.ipnStatus} />
                          <Detail label="Langue" value={order.locale} />
                          <Detail label="UTM" value={order.utm} />
                          <Detail
                            label="ID paiement NOWPayments"
                            value={order.paymentId}
                            mono
                          />
                          <Detail
                            label="Plan de paiement"
                            value={
                              order.installments > 1
                                ? `Tranche ${order.installmentIndex}/${order.installments} — groupe ${order.groupRef ?? order.ref}`
                                : "Paiement unique"
                            }
                          />
                          <div className="md:col-span-2">
                            <Detail
                              label="Adresse de dépôt"
                              value={order.payAddress}
                              mono
                            />
                          </div>
                          {order.paymentUrl && (
                            <div className="md:col-span-2">
                              <a
                                href={order.paymentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E8D5A9] hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Ouvrir le paiement NOWPayments
                              </a>
                            </div>
                          )}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {orders.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">
          Aucune commande pour l&apos;instant.
        </p>
      )}
    </div>
  );
}
