"use client";
import { useState, useTransition } from "react";
import { replySupportAction } from "./actions";

type RequestRow = { id: number; createdAt: string; firstName: string | null; username: string | null; message: string; reply: string | null; repliedAt: string | null };

export function SupportInbox({ requests, error }: { requests: RequestRow[]; error: boolean }) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [busy, startTransition] = useTransition();
  return <section id="support" className="rounded-2xl border border-stone-200 bg-white p-5">
    <h2 className="text-sm font-black">Demandes d’aide Telegram</h2>
    <p className="mt-1 text-xs text-stone-500">Les 50 dernières demandes adressées explicitement au support. Les réponses partent dans le chat du client via le bot.</p>
    {error ? <p className="mt-3 text-sm text-red-700">Impossible de charger les demandes. Vérifiez la base de données.</p> : requests.length === 0 ? <p className="mt-3 text-sm text-stone-500">Aucune demande reçue.</p> : <ul className="mt-3 divide-y divide-stone-100">
      {requests.map((item) => <li key={item.id} className="space-y-2 py-4">
        <div className="text-xs font-bold text-stone-600">{item.firstName || "Client"}{item.username ? ` · @${item.username}` : ""} · {new Date(item.createdAt).toLocaleString("fr-FR", { timeZone: "Africa/Tripoli" })}</div>
        <p className="whitespace-pre-wrap break-words text-sm">{item.message}</p>
        {item.reply && <p className="whitespace-pre-wrap rounded-lg bg-emerald-50 p-2 text-xs"><strong>Dernière réponse envoyée :</strong> {item.reply}</p>}
        <label className="block text-xs font-bold" htmlFor={`support-${item.id}`}>Répondre au client</label>
        <textarea id={`support-${item.id}`} maxLength={1500} value={drafts[item.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [item.id]: e.target.value })} className="w-full rounded-lg border border-stone-300 p-2 text-sm" rows={2} />
        <button type="button" disabled={busy || !drafts[item.id]?.trim()} onClick={() => startTransition(async () => { const result = await replySupportAction(item.id, drafts[item.id] ?? ""); setFeedback((prev) => ({ ...prev, [item.id]: result.message })); if (result.ok) setDrafts((prev) => ({ ...prev, [item.id]: "" })); })} className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Envoyer sur Telegram</button>
        {feedback[item.id] && <p role="status" className="text-xs">{feedback[item.id]}</p>}
      </li>)}
    </ul>}
  </section>;
}
