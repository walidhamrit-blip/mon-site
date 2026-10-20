"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  MessageCircle,
  Mail,
  Trash2,
  Check,
  Sparkles,
  Copy,
  ExternalLink,
  X,
} from "lucide-react";
import {
  deleteLead,
  generateDemoFromLead,
  saveLeadNotes,
  updateLeadStatus,
  type GenerateDemoResult,
} from "@/app/admin/actions";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadRow,
  type LeadStatus,
} from "@/lib/site-types";
import { StatusBadge } from "../status-badge";

function whatsappHref(phone: string, name: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  const text = encodeURIComponent(`مرحبا ${name}، معك فريق نخبة بخصوص طلبك`);
  return `https://wa.me/${digits}?text=${text}`;
}

export function LeadsTable({ rows }: { rows: LeadRow[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [reviewModal, setReviewModal] = useState<GenerateDemoResult | null>(null);
  const [copiedWa, setCopiedWa] = useState(false);

  const flash = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const onStatus = (id: number, status: LeadStatus) => {
    startTransition(async () => {
      const res = await updateLeadStatus(id, status);
      flash(res.ok ? "Statut mis à jour." : (res.error ?? "Erreur"));
      router.refresh();
    });
  };

  const onSaveNotes = (lead: LeadRow) => {
    const value = notesDraft[lead.id] ?? lead.notes ?? "";
    startTransition(async () => {
      const res = await saveLeadNotes(lead.id, value);
      flash(res.ok ? "Notes enregistrées." : (res.error ?? "Erreur"));
      router.refresh();
    });
  };

  const onDelete = (lead: LeadRow) => {
    if (
      !confirm(
        `Supprimer définitivement la demande de « ${lead.name} » (${lead.business}) ?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteLead(lead.id);
      flash(res.ok ? "Demande supprimée." : (res.error ?? "Erreur"));
      router.refresh();
    });
  };

  const onDeliverAndReview = (lead: LeadRow) => {
    startTransition(async () => {
      const res = await generateDemoFromLead(lead.id);
      if (res.ok) {
        setReviewModal(res);
        setCopiedWa(false);
        router.refresh();
      } else {
        flash(res.error ?? "Échec de la génération");
      }
    });
  };

  const copyWhatsappMessage = async () => {
    if (!reviewModal?.whatsappMessage) return;
    try {
      await navigator.clipboard.writeText(reviewModal.whatsappMessage);
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 2500);
    } catch {
      flash("Impossible de copier automatiquement.");
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500 shadow-2xs">
        Aucune demande ne correspond à ces critères.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {feedback && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-stone-900 text-white px-4 py-2.5 text-xs font-semibold shadow-xl flex items-center gap-2">
          <Check className="h-3.5 w-3.5 text-[#E5CA87]" /> {feedback}
        </div>
      )}

      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8A6D2F]">
                  <Sparkles className="h-3.5 w-3.5" /> Projet livré → Avis + Fiche démo
                </span>
                <h3 className="text-base font-black text-stone-900 mt-1">
                  {reviewModal.message ?? "Fiche créée avec succès"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                className="text-stone-400 hover:text-stone-800 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {reviewModal.demoUrl && (
              <div className="rounded-xl bg-[#FAF9F6] border border-stone-200 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                <span className="text-stone-600 truncate">
                  Fiche créée :{" "}
                  <strong className="text-stone-900">{reviewModal.demoSlug}</strong>
                </span>
                <a
                  href={`/demos/${reviewModal.demoSlug}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 text-[#8A6D2F] font-semibold hover:underline shrink-0"
                >
                  Voir <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                Message WhatsApp pré-rempli :
              </label>
              <textarea
                rows={7}
                readOnly
                value={reviewModal.whatsappMessage ?? ""}
                dir="rtl"
                className="w-full rounded-xl bg-[#FAF9F6] border border-stone-200 p-3 text-xs text-stone-800 leading-relaxed focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={copyWhatsappMessage}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
              >
                {copiedWa ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Copié !
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copier le texte
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <a
                  href="/admin/sites"
                  className="inline-flex items-center gap-1 h-9 px-3.5 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Modifier la fiche
                </a>
                {reviewModal.whatsappUrl && (
                  <a
                    href={reviewModal.whatsappUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#25D366] text-white text-xs font-bold hover:brightness-95 shadow-xs"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Envoyer sur WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-stone-200/90 bg-white overflow-hidden divide-y divide-stone-100 shadow-2xs">
        {rows.map((lead) => {
          const open = openId === lead.id;
          const notes = notesDraft[lead.id] ?? lead.notes ?? "";
          return (
            <div key={lead.id} className={open ? "bg-[#FAF9F6]" : "bg-white"}>
              <div className="px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : lead.id)}
                  className="flex items-center gap-3 min-w-0 text-left flex-1 cursor-pointer"
                >
                  <ChevronDown
                    className={`h-4 w-4 text-stone-400 shrink-0 transition-transform ${
                      open ? "rotate-180 text-stone-800" : ""
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-stone-900 truncate">
                      {lead.business}
                      <span className="text-stone-500 font-normal">
                        {" "}
                        — {lead.name}
                      </span>
                    </div>
                    <div className="text-xs text-stone-500 truncate mt-0.5">
                      {lead.phone} · {lead.sector} · {lead.need} · {lead.budget}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline text-xs text-stone-400 tabular-nums">
                    {lead.dateFr}
                  </span>
                  <StatusBadge status={lead.status} />
                  <select
                    aria-label="Changer le statut"
                    value={lead.status}
                    disabled={pending}
                    onChange={(e) =>
                      onStatus(lead.id, e.target.value as LeadStatus)
                    }
                    className="h-8 rounded-lg bg-stone-50 border border-stone-300 px-2.5 text-xs font-medium text-stone-800 focus:outline-none focus:border-[#B8923F] cursor-pointer"
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {LEAD_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {open && (
                <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-stone-200/80 space-y-4 text-sm">
                  <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Detail label="Reçue le" value={lead.dateFr} />
                    <Detail label="Client" value={lead.name} />
                    <Detail label="Activité" value={lead.business} />
                    <Detail label="Téléphone" value={lead.phone} />
                    <Detail label="Email" value={lead.email || "—"} />
                    <Detail label="Secteur" value={lead.sector} />
                    <Detail label="Besoin" value={lead.need} />
                    <Detail label="Budget" value={lead.budget} />
                    <Detail label="Délai souhaité" value={lead.deadline} />
                    {lead.locale && <Detail label="Langue" value={lead.locale} />}
                    {lead.utm && <Detail label="Origine (UTM)" value={lead.utm} />}
                  </dl>

                  {lead.message && (
                    <div>
                      <div className="text-xs font-semibold text-stone-500 mb-1">
                        Message du client
                      </div>
                      <p className="rounded-xl bg-white border border-stone-200 p-3 text-sm text-stone-800 whitespace-pre-wrap">
                        {lead.message}
                      </p>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor={`notes-${lead.id}`}
                      className="block text-xs font-semibold text-stone-500 mb-1"
                    >
                      Notes internes (visibles uniquement ici)
                    </label>
                    <textarea
                      id={`notes-${lead.id}`}
                      rows={2}
                      value={notes}
                      onChange={(e) =>
                        setNotesDraft({ ...notesDraft, [lead.id]: e.target.value })
                      }
                      placeholder="Rappel prévu mardi, devis 1 490 LYD envoyé…"
                      className="w-full rounded-xl bg-white border border-stone-300 p-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#B8923F]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onSaveNotes(lead)}
                        className="h-9 px-4 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
                      >
                        Enregistrer les notes
                      </button>
                      <a
                        href={whatsappHref(lead.phone, lead.name)}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-stone-300 bg-white text-stone-700 text-xs font-semibold hover:bg-stone-50"
                        >
                          <Mail className="h-3.5 w-3.5" /> Email
                        </a>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onDeliverAndReview(lead)}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#C6A664]/20 text-[#7A5D20] border border-[#C6A664]/45 text-xs font-bold hover:bg-[#C6A664]/30 disabled:opacity-50 cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Projet livré → Avis + Démo
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onDelete(lead)}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-red-600 hover:bg-red-50 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Supprimer
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
