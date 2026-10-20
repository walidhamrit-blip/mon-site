"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Mail, MessageCircle } from "lucide-react";
import { ORDER_KIND_LABELS, type OrderRow } from "@/lib/site-types";
import { OrderStatusBadge } from "../status-badge";

function whatsappHref(phone: string, ref: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  const text = encodeURIComponent(`مرحبا، معك فريق نخبة بخصوص طلبك رقم ${ref}`);
  return `https://wa.me/${digits}?text=${text}`;
}

export function OrdersTable({ rows }: { rows: OrderRow[] }) {
  const [openId, setOpenId] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500 shadow-2xs">
        Aucune commande ne correspond à ces critères.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white overflow-hidden divide-y divide-stone-100 shadow-2xs">
      {rows.map((order) => {
        const open = openId === order.id;
        return (
          <div key={order.id} className={open ? "bg-[#FAF9F6]" : "bg-white"}>
            <div className="px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : order.id)}
                className="flex items-center gap-3 min-w-0 text-left flex-1 cursor-pointer"
              >
                <ChevronDown
                  className={`h-4 w-4 text-stone-400 shrink-0 transition-transform ${
                    open ? "rotate-180 text-stone-800" : ""
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-stone-900 truncate">
                    {order.planName}
                    {order.kind !== "plan" && (
                      <span className="ml-2 inline-flex items-center rounded-md bg-[#C6A664]/20 px-2 py-0.5 text-[11px] font-semibold text-[#7A5D20]">
                        {ORDER_KIND_LABELS[order.kind]}
                      </span>
                    )}
                    {order.installments > 1 && (
                      <span className="text-[#8A6D2F] font-semibold">
                        {" "}
                        ({order.installmentIndex}/{order.installments})
                      </span>
                    )}
                    {order.clientName && (
                      <span className="text-stone-500 font-normal">
                        {" "}
                        — {order.clientName}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-stone-500 truncate mt-0.5">
                    {order.ref} · {order.amountUsd} $ · {order.amountLyd} LYD
                    {order.demoSlug ? ` · ${order.demoSlug}` : ""}
                    {order.payAmount && order.payCurrency
                      ? ` · ${order.payAmount} ${order.payCurrency.toUpperCase()}`
                      : ""}
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:inline text-xs text-stone-400 tabular-nums">
                  {order.dateFr}
                </span>
                <OrderStatusBadge status={order.status} />
              </div>
            </div>

            {open && (
              <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-stone-200/80 space-y-4 text-sm">
                <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <Detail label="Créée le" value={order.dateFr} />
                  <Detail label="Référence" value={order.ref} />
                  <Detail label="Type" value={ORDER_KIND_LABELS[order.kind]} />
                  <Detail label="Formule" value={order.planName} />
                  {order.demoSlug && (
                    <Detail label="Projet réservé" value={order.demoSlug} />
                  )}
                  <Detail
                    label="Tranche"
                    value={
                      order.installments > 1
                        ? `${order.installmentIndex} sur ${order.installments}`
                        : "Paiement comptant"
                    }
                  />
                  {order.groupRef && (
                    <Detail label="Dossier (tranches)" value={order.groupRef} />
                  )}
                  <Detail label="Montant" value={`${order.amountLyd} LYD`} />
                  <Detail
                    label="Montant facturé"
                    value={`${order.amountUsd} ${order.currency}`}
                  />
                  <Detail
                    label="Crypto demandée"
                    value={
                      order.payAmount && order.payCurrency
                        ? `${order.payAmount} ${order.payCurrency.toUpperCase()}`
                        : "—"
                    }
                  />
                  <Detail label="Client" value={order.clientName || "—"} />
                  <Detail label="Téléphone" value={order.phone || "—"} />
                  <Detail label="Email" value={order.email || "—"} />
                  <Detail label="ID NOWPayments" value={order.paymentId || "—"} />
                  <Detail label="Statut IPN" value={order.ipnStatus || "—"} />
                  {order.locale && <Detail label="Langue" value={order.locale} />}
                  {order.utm && <Detail label="Origine (UTM)" value={order.utm} />}
                </dl>

                {order.payAddress && (
                  <div className="rounded-xl bg-white border border-stone-200 px-3 py-2">
                    <div className="text-[11px] font-medium text-stone-400">
                      Adresse de dépôt crypto
                    </div>
                    <div className="text-xs text-stone-800 break-all font-mono mt-0.5">
                      {order.payAddress}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {order.paymentUrl && (
                    <a
                      href={order.paymentUrl}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#C6A664]/20 text-[#7A5D20] border border-[#C6A664]/45 text-xs font-semibold hover:bg-[#C6A664]/30"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Page NOWPayments
                    </a>
                  )}
                  <a
                    href={`/payment/success?order=${encodeURIComponent(order.ref)}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs font-semibold hover:bg-stone-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Suivi client
                  </a>
                  {order.phone && (
                    <a
                      href={whatsappHref(order.phone, order.ref)}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  )}
                  {order.email && (
                    <a
                      href={`mailto:${order.email}?subject=${encodeURIComponent(`Commande ${order.ref}`)}`}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs font-semibold hover:bg-stone-50"
                    >
                      <Mail className="h-3.5 w-3.5" /> Email
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white border border-stone-200 px-3 py-2">
      <dt className="text-[11px] font-medium text-stone-400">{label}</dt>
      <dd className="text-sm font-medium text-stone-900 break-words">{value}</dd>
    </div>
  );
}
