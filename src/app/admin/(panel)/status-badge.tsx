import {
  LEAD_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  type LeadStatus,
  type OrderStatus,
} from "@/lib/site-types";

const LEAD_STYLES: Record<LeadStatus, string> = {
  new: "bg-amber-50 text-amber-800 border-amber-200",
  in_progress: "bg-sky-50 text-sky-800 border-sky-200",
  done: "bg-emerald-50 text-emerald-800 border-emerald-200",
  archived: "bg-stone-100 text-stone-600 border-stone-200",
};

const ORDER_STYLES: Record<OrderStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  paid: "bg-emerald-50 text-emerald-800 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-stone-100 text-stone-600 border-stone-200",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${LEAD_STYLES[status]}`}
    >
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ORDER_STYLES[status]}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
