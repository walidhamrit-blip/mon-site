"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
} from "lucide-react";

interface ConfigStatus {
  apiKey: boolean;
  secretKey: boolean;
  userId: boolean;
  webhookSecretToken: boolean;
  webhookUrl: boolean;
  webhookUrlIsHttps: boolean;
  apiConfigured: boolean;
  webhookConfigured: boolean;
}

interface StoreStatus {
  userId: string;
  accountStatus: string;
  sellerStatus: string;
  sellingCurrencies: string[];
}

interface Mapping {
  id: number;
  offerId: string;
  title: string;
  supplierKind: string;
  categoryId: string;
  supplierSkuId: string;
  saleCurrency: string;
  minMarginPercent: number;
  maxCostUsd: string;
  enabled: boolean;
  note: string | null;
}

interface ProbeResult {
  name: string;
  description: string;
  ok: boolean;
  httpStatus: number | null;
  code: string;
  message: string;
  requestId: string | null;
}

/**
 * Traduction de la famille d'erreur en action concrète.
 *
 * Sans ça, un `400` (notre requête est malformée) et un `401` (paire de clés
 * désynchronisée) se ressemblent et on régénère des clés pour rien.
 */
const STORE_HINTS: Record<string, string> = {
  signature:
    "Paire de clés désynchronisée. G2G_API_KEY et G2G_SECRET_KEY doivent venir de la MÊME génération (le même clic sur « Generate key »), et G2G_USER_ID doit être le Seller ID, pas un ID d'offre. En cas de doute : régénérer une paire et remplacer les DEUX valeurs ensemble.",
  headers:
    "En-tête refusé par G2G (souvent Content-Type). C'est un défaut de code, pas de clé : utilisez « Diagnostiquer les en-têtes » ci-dessous pour voir quelle variante G2G accepte.",
  request:
    "Requête refusée : paramètre manquant ou schéma invalide. Vérifiez le chemin appelé et les paramètres envoyés.",
  permissions:
    "Clé non autorisée : vérifiez le statut vendeur et les droits de la clé côté G2G.",
  rate_limit: "Trop d'appels en peu de temps. Réessayez dans quelques instants.",
  upstream: "G2G renvoie une erreur serveur. Réessayez plus tard.",
  network:
    "G2G injoignable depuis le serveur : vérifiez le réseau sortant et G2G_API_BASE.",
};

/**
 * Traduction du verdict d'un événement de test en action concrète.
 *
 * Le but : qu'un échec dise QUOI corriger plutôt que de laisser croire à une
 * panne. Le cas le plus fréquent (`bad_signature`) est un token régénéré côté
 * G2G sans mise à jour côté Vercel — pas un problème de code.
 */
const WEBHOOK_TEST_HINTS: Record<string, string> = {
  accepted:
    "Tout fonctionne : la signature est acceptée, l'événement est journalisé et une alerte Telegram a été envoyée. Vous pouvez passer à l'étape suivante.",
  duplicate:
    "Déjà reçu une fois : ce delivery_id est connu, donc la chaîne fonctionnait déjà. Relancez pour un nouvel identifiant.",
  bad_signature:
    "Signature refusée. Le secret token de G2G et G2G_WEBHOOK_SECRET_TOKEN (côté Vercel) ne correspondent pas, ou G2G_WEBHOOK_URL diffère de l'URL déclarée chez G2G au caractère près. Régénérez un token dans G2G → Webhook → « Generate random secret token », copiez-le AVANT de sauvegarder, mettez-le dans Vercel puis redéployez.",
  not_configured:
    "Le déploiement qui répond n'a pas les variables : après avoir ajouté G2G_WEBHOOK_SECRET_TOKEN, G2G_WEBHOOK_URL ou G2G_USER_ID, il faut redéployer (Deployments → ⋯ → Redeploy).",
  db_error:
    "La signature a été acceptée, mais la base de données est indisponible : l'événement n'a pas pu être journalisé. Vérifiez DATABASE_URL, puis relancez le test.",
  wrong_target:
    "G2G_WEBHOOK_URL ne pointe pas sur notre webhook. Elle doit être exactement https://votre-domaine/api/webhooks/g2g — sans slash final, sans paramètre.",
  rejected:
    "L'événement a été refusé avant traitement. Lisez le corps de réponse ci-dessous : il précise la raison (JSON invalide, quantité hors bornes…).",
  unreachable:
    "Le serveur n'arrive pas à joindre l'URL : DNS, TLS ou délai dépassé. En preview, les variables G2G sont « Production only » et donc absentes — testez depuis la production.",
  unexpected:
    "Réponse inattendue : le corps reçu ne ressemble pas à celui de notre webhook. Vérifiez que G2G_WEBHOOK_URL pointe bien sur /api/webhooks/g2g.",
};

interface WebhookTestResult {
  ok: boolean;
  verdict: string;
  httpStatus: number | null;
  targetUrl: string;
  deliveryId: string;
  response: unknown;
  networkError?: string | null;
}

interface Diagnostic {
  ok: boolean;
  config: ConfigStatus;
  store: StoreStatus | null;
  storeError: string | null;
  storeHint: string | null;
  probe: ProbeResult[] | null;
  mappings: Mapping[];
  dbError: string | null;
  suggestedWebhookUrl: string;
  deploy: { sha: string; env: string; region: string };
  autoDeliveryEnabled: boolean;
}

interface FormState {
  offerId: string;
  title: string;
  supplierKind: string;
  categoryId: string;
  supplierSkuId: string;
  saleCurrency: string;
  minMarginPercent: string;
  maxCostUsd: string;
  enabled: boolean;
  note: string;
}

const EMPTY_FORM: FormState = {
  offerId: "",
  title: "",
  supplierKind: "gift_card",
  categoryId: "",
  supplierSkuId: "",
  saleCurrency: "USD",
  minMarginPercent: "12",
  maxCostUsd: "25",
  enabled: false,
  note: "",
};

const CHECKS: { key: keyof ConfigStatus; label: string; hint: string }[] = [
  { key: "apiKey", label: "G2G_API_KEY", hint: "Clé publique générée dans API Integration" },
  { key: "secretKey", label: "G2G_SECRET_KEY", hint: "Secret affiché une seule fois par G2G" },
  { key: "userId", label: "G2G_USER_ID", hint: "Seller ID du compte vendeur" },
  { key: "webhookSecretToken", label: "G2G_WEBHOOK_SECRET_TOKEN", hint: "Fenêtre « Callback URL » → Generate random secret token (pas la Secret Key)" },
  { key: "webhookUrl", label: "G2G_WEBHOOK_URL", hint: "Callback URL exact déclaré chez G2G" },
];

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 outline-none focus:border-stone-500";
const labelClass = "block text-[11px] font-semibold text-stone-600";

/**
 * Panneau admin du pilote G2G (phase 1).
 *
 * Vérifie la clé (`GET /v2/store`), affiche l'URL de webhook à copier et
 * gère les correspondances offre G2G ↔ `card_id` / `key_id` FazerCards.
 * Aucune clé n'est saisie ici : tout est configuré côté serveur (Vercel).
 */
export function G2gPanel() {
  const [data, setData] = useState<Diagnostic | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [probing, setProbing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [webhookTest, setWebhookTest] = useState<WebhookTestResult | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/g2g", { cache: "no-store" });
      const body = (await response.json()) as Diagnostic & { error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Diagnostic indisponible");
      setData(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, []);

  // Le chargement initial part dans une tâche asynchrone : aucune mise à
  // jour d'état synchrone dans le corps de l'effet (règle react-hooks).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  /**
   * Sonde `GET /v2/store` avec plusieurs jeux d'en-têtes pour identifier
   * celui que G2G accepte. Strictement en lecture seule.
   */
  const runProbe = useCallback(async () => {
    setProbing(true);
    setError("");
    try {
      const response = await fetch("/api/admin/g2g?probe=1", { cache: "no-store" });
      const body = (await response.json()) as Diagnostic & { error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Diagnostic indisponible");
      setData(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setProbing(false);
    }
  }, []);

  /**
   * Envoie un `order.api_delivery` synthétique et signé à notre propre
   * webhook, puis affiche le verdict. Aucun achat, aucune livraison.
   */
  const runWebhookTest = useCallback(async () => {
    setTesting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/g2g/webhook-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: form.offerId }),
        cache: "no-store",
      });
      const result = (await response.json()) as WebhookTestResult & {
        error?: string;
        message?: string;
      };
      if (!response.ok && !result.verdict) {
        throw new Error(result.message ?? result.error ?? "Test impossible");
      }
      setWebhookTest(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setTesting(false);
    }
  }, [form.offerId]);

  const field = (key: keyof FormState, value: string | boolean) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  async function save() {
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/admin/g2g", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          minMarginPercent: Number(form.minMarginPercent),
          maxCostUsd: Number(form.maxCostUsd),
        }),
      });
      const body = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.message ?? body.error ?? "Enregistrement refusé");
      }
      setForm((previous) => ({ ...EMPTY_FORM, offerId: "" }));
      setNotice("Correspondance enregistrée.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  async function remove(offerId: string) {
    setNotice("");
    setError("");
    try {
      const response = await fetch(
        `/api/admin/g2g?offer_id=${encodeURIComponent(offerId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Suppression refusée");
      setNotice(`${offerId} supprimé.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function edit(mapping: Mapping) {
    setForm({
      offerId: mapping.offerId,
      title: mapping.title,
      supplierKind: mapping.supplierKind,
      categoryId: mapping.categoryId,
      supplierSkuId: mapping.supplierSkuId,
      saleCurrency: mapping.saleCurrency,
      minMarginPercent: String(mapping.minMarginPercent),
      maxCostUsd: mapping.maxCostUsd,
      enabled: mapping.enabled,
      note: mapping.note ?? "",
    });
    setNotice("Champs chargés : modifiez puis enregistrez.");
  }

  async function copyWebhookUrl(url: string) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copie impossible : sélectionnez l'URL manuellement.");
    }
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-stone-900">G2G — pilote OpenAPI v2</h2>
          <p className="mt-0.5 text-xs text-stone-600">
            Vérification de la clé, webhook signé et mapping des offres vers FazerCards.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Tester la connexion
        </button>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Phase 1 — aucun achat automatique.</strong> Le webhook vérifie la signature,
          journalise et alerte, mais n&apos;achète rien et ne livre rien. Gardez{" "}
          <code className="font-mono">api_qty = 0</code> sur toutes vos offres G2G jusqu&apos;au
          déploiement de la phase 2. Ne collez jamais vos clés dans un chat ou un ticket :
          uniquement dans les variables d&apos;environnement Vercel.
        </p>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-800">{error}</p>
      ) : null}
      {notice ? (
        <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 text-xs text-emerald-800">{notice}</p>
      ) : null}

      {data ? (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-bold text-stone-800">1. Secrets côté serveur</h3>
              <ul className="mt-2 space-y-1.5">
                {CHECKS.map((check) => {
                  const present = Boolean(data.config[check.key]);
                  return (
                    <li key={check.key} className="flex items-start gap-2 text-[11px]">
                      <span
                        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${present ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-400"}`}
                      >
                        {present ? <Check className="h-3 w-3" /> : "–"}
                      </span>
                      <span>
                        <code className="font-mono font-semibold text-stone-800">{check.label}</code>{" "}
                        <span className="text-stone-500">— {check.hint}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {!data.config.webhookUrlIsHttps && data.config.webhookUrl ? (
                <p className="mt-2 text-[11px] text-red-700">L&apos;URL du webhook doit être en HTTPS.</p>
              ) : null}
            </div>

            <div>
              <h3 className="text-xs font-bold text-stone-800">2. Compte vendeur (GET /v2/store)</h3>
              {data.store ? (
                <dl className="mt-2 space-y-1 text-[11px] text-stone-700">
                  <div className="flex justify-between gap-2"><dt>User ID</dt><dd className="font-mono">{data.store.userId}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Compte</dt><dd>{data.store.accountStatus}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Statut vendeur</dt><dd>{data.store.sellerStatus}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Devises de vente</dt><dd>{data.store.sellingCurrencies.join(", ") || "—"}</dd></div>
                </dl>
              ) : (
                <p className="mt-2 rounded-lg border border-stone-200 bg-stone-50 p-2.5 text-[11px] text-stone-600">
                  {data.storeError ?? "Appel non effectué."}
                </p>
              )}
              {data.storeHint && STORE_HINTS[data.storeHint] ? (
                <p className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900">
                  <strong>Que faire :</strong> {STORE_HINTS[data.storeHint]}
                </p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void runProbe()}
                  disabled={probing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5 text-[11px] font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  {probing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Diagnostiquer les en-têtes
                </button>
                <span className="text-[11px] text-stone-500">
                  Code déployé :{" "}
                  <code className="font-mono">
                    {data.deploy?.sha || "inconnu (hors Vercel)"}
                  </code>
                  {data.deploy?.env ? ` · ${data.deploy.env}` : ""}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-stone-500">
                Si le SHA ne correspond pas au dernier commit de la branche, le
                correctif n&apos;est pas encore en production : redéployez avant
                de conclure.
              </p>

              {data.probe ? (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="text-stone-500">
                      <tr>
                        <th className="py-1.5 pr-2">Variante d&apos;en-têtes</th>
                        <th className="py-1.5 pr-2">HTTP</th>
                        <th className="py-1.5 pr-2">Code</th>
                        <th className="py-1.5 pr-2">Réponse G2G</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {data.probe.map((row) => (
                        <tr key={row.name} className={row.ok ? "bg-emerald-50" : undefined}>
                          <td className="py-1.5 pr-2 text-stone-700">
                            <span className="font-mono">{row.name}</span>
                            <span className="block text-stone-500">{row.description}</span>
                          </td>
                          <td className="py-1.5 pr-2">{row.httpStatus ?? "—"}</td>
                          <td className="py-1.5 pr-2 font-mono">{row.code || "—"}</td>
                          <td className="py-1.5 pr-2 text-stone-600">
                            {row.ok ? "✅ accepté" : row.message || "—"}
                            {row.requestId ? (
                              <span className="block font-mono text-stone-400">
                                request_id {row.requestId}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <h3 className="mt-3 text-xs font-bold text-stone-800">3. Callback URL à déclarer chez G2G</h3>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 font-mono text-[11px] text-stone-800">
                  {data.suggestedWebhookUrl || "https://votre-domaine/api/webhooks/g2g"}
                </code>
                <button
                  type="button"
                  onClick={() => void copyWebhookUrl(data.suggestedWebhookUrl)}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2 py-1.5 text-[11px] font-bold text-stone-700 hover:bg-stone-50"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copié" : "Copier"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-stone-500">
                Copiez cette chaîne EXACTE dans G2G → API Integration → Webhook, puis mettez
                la même valeur dans <code className="font-mono">G2G_WEBHOOK_URL</code> (la signature
                porte sur l&apos;URL). Événement à cocher : <code className="font-mono">order.api_delivery</code>.
              </p>

              <h3 className="mt-4 text-xs font-bold text-stone-800">
                3 bis. Tester la réception (sans commande réelle)
              </h3>
              <p className="mt-1 text-[11px] text-stone-500">
                Envoie un <code className="font-mono">order.api_delivery</code> synthétique et
                signé à notre propre webhook. Aucun achat, aucune livraison, aucune modification
                d&apos;offre. Indispensable en phase 1 : avec <code className="font-mono">api_qty = 0</code>,
                G2G n&apos;émettra jamais d&apos;événement tout seul.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void runWebhookTest()}
                  disabled={testing || !data.config.webhookConfigured}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  {testing ? "Envoi…" : "Envoyer un événement de test"}
                </button>
                {!data.config.webhookConfigured ? (
                  <span className="text-[11px] text-amber-700">
                    Renseignez d&apos;abord G2G_WEBHOOK_SECRET_TOKEN, G2G_WEBHOOK_URL et G2G_USER_ID.
                  </span>
                ) : null}
              </div>

              {webhookTest ? (
                <div
                  className={`mt-2 rounded-lg border p-2.5 text-[11px] ${
                    webhookTest.verdict === "accepted" || webhookTest.verdict === "duplicate"
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <p className="font-bold text-stone-800">
                    {webhookTest.verdict === "accepted" || webhookTest.verdict === "duplicate"
                      ? "✅ Webhook opérationnel"
                      : "⚠️ À corriger"}
                    <span className="ml-1.5 font-mono font-normal text-stone-600">
                      HTTP {webhookTest.httpStatus ?? "—"} · {webhookTest.verdict}
                    </span>
                  </p>
                  <dl className="mt-1.5 space-y-0.5 font-mono text-[10px] text-stone-600">
                    <div>
                      <dt className="inline text-stone-500">cible :</dt>{" "}
                      <dd className="inline break-all">{webhookTest.targetUrl}</dd>
                    </div>
                    <div>
                      <dt className="inline text-stone-500">delivery_id :</dt>{" "}
                      <dd className="inline break-all">{webhookTest.deliveryId}</dd>
                    </div>
                    {webhookTest.networkError ? (
                      <div>
                        <dt className="inline text-stone-500">réseau :</dt>{" "}
                        <dd className="inline break-all">{webhookTest.networkError}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {WEBHOOK_TEST_HINTS[webhookTest.verdict] ? (
                    <p className="mt-1.5 font-sans text-stone-700">
                      {WEBHOOK_TEST_HINTS[webhookTest.verdict]}
                    </p>
                  ) : null}
                  <pre className="mt-1.5 overflow-x-auto rounded border border-stone-200 bg-white p-1.5 font-mono text-[10px] text-stone-700">
                    {JSON.stringify(webhookTest.response, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>

          {data.dbError ? (
            <p className="mt-3 text-[11px] text-red-700">Base de données : {data.dbError}</p>
          ) : null}

          <h3 className="mt-5 text-xs font-bold text-stone-800">4. Correspondances G2G ↔ FazerCards</h3>
          {data.mappings.length > 0 ? (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="text-stone-500">
                  <tr>
                    <th className="py-1.5 pr-2">Offre G2G</th>
                    <th className="py-1.5 pr-2">Type</th>
                    <th className="py-1.5 pr-2">catégorie / SKU FazerCards</th>
                    <th className="py-1.5 pr-2">Devise</th>
                    <th className="py-1.5 pr-2">Marge min.</th>
                    <th className="py-1.5 pr-2">Actif</th>
                    <th className="py-1.5 pr-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {data.mappings.map((mapping) => (
                    <tr key={mapping.id}>
                      <td className="py-1.5 pr-2 font-mono text-stone-800">
                        {mapping.offerId}
                        {mapping.title ? <span className="block font-sans text-stone-500">{mapping.title}</span> : null}
                      </td>
                      <td className="py-1.5 pr-2">{mapping.supplierKind === "game_key" ? "Clé jeu" : "Carte"}</td>
                      <td className="py-1.5 pr-2 font-mono text-stone-600">
                        {mapping.categoryId || "—"} / {mapping.supplierSkuId || "—"}
                      </td>
                      <td className="py-1.5 pr-2">{mapping.saleCurrency}</td>
                      <td className="py-1.5 pr-2">{mapping.minMarginPercent} %</td>
                      <td className="py-1.5 pr-2">{mapping.enabled ? "✅" : "⏸"}</td>
                      <td className="py-1.5 pr-2">
                        <div className="flex gap-1">
                          <button type="button" onClick={() => edit(mapping)} className="rounded border border-stone-300 px-1.5 py-1 hover:bg-stone-50">Éditer</button>
                          <button type="button" onClick={() => void remove(mapping.offerId)} className="rounded border border-red-200 px-1.5 py-1 text-red-700 hover:bg-red-50" aria-label={`Supprimer ${mapping.offerId}`}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-stone-500">Aucune correspondance pour l&apos;instant.</p>
          )}

          <div className="mt-4 grid gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block"><span className={labelClass}>offer_id G2G *</span><input className={inputClass} value={form.offerId} onChange={(e) => field("offerId", e.target.value.toUpperCase())} placeholder="G1793906316865GE" /></label>
            <label className="block"><span className={labelClass}>Libellé</span><input className={inputClass} value={form.title} onChange={(e) => field("title", e.target.value)} placeholder="iTunes TRY 100 (TR)" /></label>
            <label className="block"><span className={labelClass}>Type fournisseur</span>
              <select className={inputClass} value={form.supplierKind} onChange={(e) => field("supplierKind", e.target.value)}>
                <option value="gift_card">Carte cadeau (card_id)</option>
                <option value="game_key">Clé de jeu (key_id)</option>
              </select>
            </label>
            <label className="block"><span className={labelClass}>category_id / game_id</span><input className={inputClass} value={form.categoryId} onChange={(e) => field("categoryId", e.target.value)} placeholder="UUID ou slug FazerCards" /></label>
            <label className="block"><span className={labelClass}>card_id / key_id exact</span><input className={inputClass} value={form.supplierSkuId} onChange={(e) => field("supplierSkuId", e.target.value)} placeholder="Trouvé via le chercheur ci-dessus" /></label>
            <label className="block"><span className={labelClass}>Devise de l&apos;offre</span><input className={inputClass} value={form.saleCurrency} onChange={(e) => field("saleCurrency", e.target.value.toUpperCase())} maxLength={3} /></label>
            <label className="block"><span className={labelClass}>Marge nette min. (%)</span><input className={inputClass} type="number" min={0} max={90} value={form.minMarginPercent} onChange={(e) => field("minMarginPercent", e.target.value)} /></label>
            <label className="block"><span className={labelClass}>Plafond d&apos;achat auto (USD)</span><input className={inputClass} type="number" min={1} max={1000} value={form.maxCostUsd} onChange={(e) => field("maxCostUsd", e.target.value)} /></label>
            <label className="flex items-center gap-2 self-end pb-1.5 text-[11px] font-semibold text-stone-700">
              <input type="checkbox" checked={form.enabled} onChange={(e) => field("enabled", e.target.checked)} className="h-3.5 w-3.5" />
              Mapping validé (région + format du code vérifiés)
            </label>
            <label className="block sm:col-span-2 lg:col-span-3"><span className={labelClass}>Note interne</span><input className={inputClass} value={form.note} onChange={(e) => field("note", e.target.value)} placeholder="Région Global, code texte, restrictions…" /></label>
            <div className="sm:col-span-2 lg:col-span-3">
              <button type="button" onClick={() => void save()} disabled={saving || !form.offerId} className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-stone-800 disabled:opacity-50">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Enregistrer la correspondance
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
            Rappel : ne liez jamais un top-up par ID joueur à une offre G2G qui attend un code.
            Vérifiez la région (Global ou pays exact) et le format attendu par G2G (
            <code className="font-mono">code_label</code> de l&apos;offre) avant d&apos;activer un mapping.
          </p>
        </>
      ) : null}
    </section>
  );
}
