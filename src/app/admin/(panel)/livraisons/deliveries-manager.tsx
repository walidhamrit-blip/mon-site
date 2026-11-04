"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Mail, Plus, Send, Trash2, X } from "lucide-react";
import {
  createDeliveryAction,
  deleteDeliveryAction,
  deliveryLinkAction,
  sendDeliveryLinkAction,
} from "@/app/admin/actions";
import type { DeliveryRow } from "@/lib/deliveries";
import { DELIVERY_STATUS_LABELS, deliveryAmountLabel } from "@/lib/delivery-kit";

const LINK_PRESETS = [
  "Site en ligne",
  "Interface d’administration",
  "Dépôt de code",
  "Dossier & documents",
  "Vidéo de formation",
];

const ITEM_PRESETS = [
  "Design validé sur mobile et ordinateur",
  "Formulaire de contact testé",
  "SEO de base + sitemap",
  "Formation à la gestion du contenu",
];

function frDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tripoli",
  });
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* repli ci-dessous */
  }
  return false;
}

export function DeliveriesManager({ rows }: { rows: DeliveryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [created, setCreated] = useState<{ ref: string; url: string } | null>(null);

  // Formulaire de création
  const [clientName, setClientName] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [warrantyDays, setWarrantyDays] = useState(30);
  const [notes, setNotes] = useState("");
  const [links, setLinks] = useState<{ label: string; url: string }[]>([
    { label: LINK_PRESETS[0], url: "" },
    { label: LINK_PRESETS[1], url: "" },
  ]);
  const [items, setItems] = useState<{ label: string }[]>([{ label: "" }]);

  const flash = (tone: "ok" | "err", text: string) => {
    setFeedback({ tone, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  function submit() {
    if (!clientName.trim() || !projectTitle.trim()) {
      flash("err", "Nom du client et intitulé du projet sont obligatoires.");
      return;
    }
    startTransition(async () => {
      const result = await createDeliveryAction({
        clientName: clientName.trim(),
        projectTitle: projectTitle.trim(),
        email: email.trim(),
        phone: phone.trim(),
        amountUsd: amountUsd.trim(),
        warrantyDays,
        notes: notes.trim(),
        links: links.filter((link) => link.url.trim()),
        checklist: items.filter((item) => item.label.trim()),
      });
      if (!result.ok || !result.delivery) {
        flash("err", result.error ?? "Création impossible.");
        return;
      }
      setCreated({ ref: result.delivery.ref, url: result.delivery.url });
      setClientName("");
      setProjectTitle("");
      setEmail("");
      setPhone("");
      setAmountUsd("");
      setNotes("");
      setLinks([{ label: LINK_PRESETS[0], url: "" }, { label: LINK_PRESETS[1], url: "" }]);
      setItems([{ label: "" }]);
      flash("ok", `Dossier ${result.delivery.ref} créé — transmettez le lien au client.`);
      router.refresh();
    });
  }

  function copyLink(ref: string) {
    startTransition(async () => {
      const result = await deliveryLinkAction(ref);
      if (!result.ok || !result.url) {
        flash("err", result.error ?? "Lien indisponible.");
        return;
      }
      const copied = await copyText(result.url);
      flash(
        copied ? "ok" : "err",
        copied ? `Lien de ${ref} copié.` : `Copie impossible — lien : ${result.url}`,
      );
    });
  }

  function sendLink(ref: string) {
    startTransition(async () => {
      const result = await sendDeliveryLinkAction(ref);
      flash(result.ok ? "ok" : "err", result.message ?? result.error ?? "Envoi impossible.");
    });
  }

  function remove(id: number, ref: string) {
    if (!window.confirm(`Supprimer le dossier ${ref} ? Le lien du client deviendra invalide.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteDeliveryAction(id);
      flash(result.ok ? "ok" : "err", result.message ?? result.error ?? "Suppression impossible.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <p
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.text}
        </p>
      )}

      {created && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-emerald-900">
            Lien de validation du dossier {created.ref}
          </p>
          <code className="block break-all rounded-lg bg-white px-3 py-2 text-xs text-stone-700">
            {created.url}
          </code>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyLink(created.ref)}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" /> Copier le lien
            </button>
            <a
              href={created.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ouvrir
            </a>
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold text-stone-500"
            >
              <X className="h-3.5 w-3.5" /> Masquer
            </button>
          </div>
          <p className="text-xs text-emerald-800">
            Le jeton n’apparaît que dans ce lien : transmettez-le tel quel (WhatsApp ou e-mail).
          </p>
        </div>
      )}

      {/* Création d'un dossier */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs space-y-4">
        <h2 className="text-base font-bold text-stone-900">Nouvelle livraison</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom du client *">
            <input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              className={inputClass}
              placeholder="Ahmed Ali"
            />
          </Field>
          <Field label="Intitulé du projet *">
            <input
              value={projectTitle}
              onChange={(event) => setProjectTitle(event.target.value)}
              className={inputClass}
              placeholder="Site vitrine — clinique Al Noor"
            />
          </Field>
          <Field label="E-mail du client">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="client@exemple.com"
            />
          </Field>
          <Field label="Téléphone / WhatsApp">
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={inputClass}
              placeholder="218 91 000 0000"
            />
          </Field>
          <Field label="Montant encaissé (USD)">
            <input
              value={amountUsd}
              onChange={(event) => setAmountUsd(event.target.value)}
              className={inputClass}
              placeholder="510"
              inputMode="decimal"
            />
          </Field>
          <Field label="Garantie (jours)">
            <input
              type="number"
              min={1}
              max={365}
              value={warrantyDays}
              onChange={(event) => setWarrantyDays(Number(event.target.value) || 30)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-stone-800">Liens remis</span>
            <button
              type="button"
              onClick={() => setLinks([...links, { label: "", url: "" }])}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter
            </button>
          </div>
          {links.map((link, index) => (
            <div key={index} className="flex flex-wrap gap-2">
              <input
                list="delivery-link-presets"
                value={link.label}
                onChange={(event) =>
                  setLinks(links.map((l, i) => (i === index ? { ...l, label: event.target.value } : l)))
                }
                className={`${inputClass} sm:max-w-[240px]`}
                placeholder="Libellé"
                aria-label={`Libellé du lien ${index + 1}`}
              />
              <input
                value={link.url}
                onChange={(event) =>
                  setLinks(links.map((l, i) => (i === index ? { ...l, url: event.target.value } : l)))
                }
                className={`${inputClass} flex-1`}
                placeholder="https://…"
                inputMode="url"
                aria-label={`URL du lien ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => setLinks(links.filter((_, i) => i !== index))}
                aria-label={`Retirer le lien ${index + 1}`}
                className="rounded-lg border border-stone-300 px-2 py-1 text-stone-500 hover:bg-stone-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <datalist id="delivery-link-presets">
            {LINK_PRESETS.map((preset) => (
              <option key={preset} value={preset} />
            ))}
          </datalist>
          <p className="text-xs text-stone-500">
            Seules les adresses http(s) sont enregistrées. N’écrivez jamais de mot de passe
            ici : les identifiants se transmettent par un autre canal.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-stone-800">
              Éléments livrés (grille de recette)
            </span>
            <button
              type="button"
              onClick={() => setItems([...items, { label: "" }])}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-50"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter
            </button>
          </div>
          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <input
                list="delivery-item-presets"
                value={item.label}
                onChange={(event) =>
                  setItems(items.map((it, i) => (i === index ? { label: event.target.value } : it)))
                }
                className={inputClass}
                placeholder="Élément livré"
                aria-label={`Élément livré ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => setItems(items.filter((_, i) => i !== index))}
                aria-label={`Retirer l’élément ${index + 1}`}
                className="rounded-lg border border-stone-300 px-2 py-1 text-stone-500 hover:bg-stone-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <datalist id="delivery-item-presets">
            {ITEM_PRESETS.map((preset) => (
              <option key={preset} value={preset} />
            ))}
          </datalist>
        </div>

        <Field label="Notes internes (jamais montrées au client)">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Solde encaissé le …, domaine transféré le …"
          />
        </Field>

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {pending ? "…" : "Créer le dossier et générer le lien"}
        </button>
      </section>

      {/* Dossiers existants */}
      <section className="rounded-2xl border border-stone-200 bg-white shadow-2xs overflow-hidden">
        <h2 className="border-b border-stone-200 px-5 py-4 text-base font-bold text-stone-900">
          Dossiers de livraison
        </h2>
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-stone-500">
            Aucune livraison enregistrée. Créez un dossier après encaissement du solde, puis
            transmettez le lien au client.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-5 py-3">Référence</th>
                  <th className="px-5 py-3">Projet</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Remis le</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-stone-100">
                    <td className="px-5 py-3 font-mono text-xs">{row.ref}</td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-stone-800">{row.projectTitle}</div>
                      {row.amountUsd && (
                        <div className="text-xs text-stone-500">
                          {deliveryAmountLabel(row.amountUsd)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-stone-700">{row.clientName}</div>
                      {row.email && <div className="text-xs text-stone-500">{row.email}</div>}
                    </td>
                    <td className="px-5 py-3 text-stone-600">{frDate(row.createdAt)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          row.status === "accepted"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                        }`}
                      >
                        {DELIVERY_STATUS_LABELS[row.status].fr}
                      </span>
                      {row.acceptedAt && (
                        <div className="mt-1 text-xs text-stone-500">
                          {frDate(row.acceptedAt)}
                          {row.acceptedByName ? ` · ${row.acceptedByName}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyLink(row.ref)}
                          disabled={pending}
                          title="Copier le lien de validation"
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                        >
                          <Copy className="h-3.5 w-3.5" /> Lien
                        </button>
                        <button
                          type="button"
                          onClick={() => sendLink(row.ref)}
                          disabled={pending || !row.email}
                          title={row.email ? "Renvoyer le lien par e-mail" : "Aucun e-mail client"}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                        >
                          <Mail className="h-3.5 w-3.5" /> <Send className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(row.id, row.ref)}
                          disabled={pending}
                          title="Supprimer le dossier"
                          className="inline-flex items-center rounded-lg border border-stone-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-stone-800">{label}</span>
      {children}
    </label>
  );
}
