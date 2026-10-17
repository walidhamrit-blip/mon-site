"use client";
import { Fragment, useTransition, useState } from "react";
import {
  LEAD_STATUSES,
  type LeadRow,
} from "@/lib/site-types";
import { StatusBadge } from "../status-badge";
import {
  deleteLead,
  saveLeadNotes,
  updateLeadStatus,
} from "@/app/admin/actions";
import {
  ChevronDown,
  Trash2,
  Save,
  ExternalLink,
  Mail,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const waLink = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, "")}`;

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-zinc-600">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-200 whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, okMsg?: string) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) setNotice(okMsg ?? null);
      else setError(res.error ?? "Une erreur est survenue.");
    });
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-[#121218] overflow-hidden">
      {error && (
        <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}
      {notice && !error && (
        <div className="flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> {notice}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[940px]">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-zinc-500 border-b border-white/10">
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Demandeur</th>
              <th className="px-4 py-3 text-left font-semibold">Contact</th>
              <th className="px-4 py-3 text-left font-semibold">Projet</th>
              <th className="px-4 py-3 text-left font-semibold">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const isOpen = expanded === lead.id;
              return (
                <Fragment key={lead.id}>
                  <tr
                    className={`border-b border-white/5 transition-colors ${
                      isOpen ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="px-4 py-3.5 text-zinc-400 whitespace-nowrap text-xs">
                      {lead.dateFr}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-white">{lead.name}</div>
                      <div className="text-xs text-zinc-500">{lead.business}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <a
                        href={waLink(lead.phone)}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-[#C6A664] transition-colors"
                        dir="ltr"
                      >
                        <ExternalLink className="h-3 w-3" /> {lead.phone}
                      </a>
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="block text-xs text-zinc-500 hover:text-white transition-colors mt-0.5"
                          dir="ltr"
                        >
                          {lead.email}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-300">
                      <div className="text-xs">
                        <span className="font-semibold">{lead.need}</span> · {lead.budget}
                      </div>
                      <div className="text-xs text-zinc-600">{lead.deadline}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={lead.status}
                        disabled={pending}
                        onChange={(e) =>
                          run(() => updateLeadStatus(lead.id, e.target.value), "Statut mis à jour.")
                        }
                        className="h-9 px-2.5 rounded-xl border border-white/10 bg-black/40 text-xs font-semibold text-white outline-none focus:border-[#C6A664] cursor-pointer disabled:opacity-50"
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s === "new"
                              ? "Nouveau"
                              : s === "in_progress"
                                ? "En cours"
                                : s === "done"
                                  ? "Traité"
                                  : "Archivé"}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1.5">
                        <StatusBadge status={lead.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setExpanded(isOpen ? null : lead.id);
                            setNotesDraft((d) => ({ ...d, [lead.id]: d[lead.id] ?? lead.notes ?? "" }));
                          }}
                          className="h-8 w-8 rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 grid place-items-center transition-colors cursor-pointer"
                          aria-label="Détails"
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (
                              confirm(
                                `Supprimer définitivement la demande de ${lead.name} ? Cette action est irréversible.`,
                              )
                            ) {
                              setExpanded(null);
                              run(() => deleteLead(lead.id), "Demande supprimée.");
                            }
                          }}
                          className="h-8 w-8 rounded-lg border border-white/10 text-zinc-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 grid place-items-center transition-colors cursor-pointer disabled:opacity-50"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="border-b border-white/10 bg-black/40">
                      <td colSpan={6} className="px-4 py-5">
                        <div className="grid md:grid-cols-2 gap-6">
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 content-start">
                            <Detail label="Secteur" value={lead.sector} />
                            <Detail label="Besoin" value={lead.need} />
                            <Detail label="Budget" value={lead.budget} />
                            <Detail label="Délai" value={lead.deadline} />
                            <Detail label="Langue du site" value={lead.locale} />
                            <Detail label="UTM" value={lead.utm} />
                            <div className="col-span-2">
                              <Detail label="Message" value={lead.message} />
                            </div>
                          </dl>

                          <div>
                            <label
                              htmlFor={`notes-${lead.id}`}
                              className="text-[11px] uppercase tracking-wider text-zinc-600 font-semibold"
                            >
                              Notes internes
                            </label>
                            <textarea
                              id={`notes-${lead.id}`}
                              rows={4}
                              value={notesDraft[lead.id] ?? lead.notes ?? ""}
                              onChange={(e) =>
                                setNotesDraft((d) => ({ ...d, [lead.id]: e.target.value }))
                              }
                              placeholder="Relance prévue lundi, devis envoyé…"
                              className="mt-1.5 w-full rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none focus:border-[#C6A664] resize-y"
                            />
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  run(
                                    () => saveLeadNotes(lead.id, notesDraft[lead.id] ?? ""),
                                    "Notes enregistrées.",
                                  )
                                }
                                className="h-9 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Save className="h-3.5 w-3.5" /> Enregistrer les notes
                              </button>
                              <a
                                href={`mailto:${lead.email ?? ""}`}
                                className={`h-9 px-4 rounded-xl border border-white/10 text-xs font-semibold text-zinc-400 inline-flex items-center gap-1.5 hover:text-white transition-colors ${
                                  lead.email ? "" : "pointer-events-none opacity-40"
                                }`}
                              >
                                <Mail className="h-3.5 w-3.5" /> Répondre par email
                              </a>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
