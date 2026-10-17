import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/site-types";

const styles: Record<LeadStatus, string> = {
  new: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  in_progress: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  archived: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  const key: LeadStatus =
    status in LEAD_STATUS_LABELS ? (status as LeadStatus) : "new";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold whitespace-nowrap ${styles[key]}`}
    >
      {LEAD_STATUS_LABELS[key]}
    </span>
  );
}
