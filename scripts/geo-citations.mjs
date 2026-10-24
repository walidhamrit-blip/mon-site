#!/usr/bin/env node
/**
 * GEO Tracker — suivi hebdomadaire des citations IA.
 *
 * Interroge les moteurs de réponse (OpenAI / ChatGPT Search et Perplexity)
 * avec les requêtes commerciales cibles de l'agence, puis mesure si la marque
 * « نخبة Nukhba » et le domaine `nokhba.net.ly` sont cités.
 *
 *   node scripts/geo-citations.mjs            # appel réel si les clés existent
 *   node scripts/geo-citations.mjs --dry-run  # affiche seulement les prompts
 *
 * Variables (toutes optionnelles — sans clé, le script se contente d'un
 * rapport « skipped » et n'échoue jamais) :
 *   OPENAI_API_KEY, OPENAI_MODEL (gpt-4o-mini), OPENAI_BASE_URL
 *   PERPLEXITY_API_KEY, PERPLEXITY_MODEL (sonar)
 *
 * « grounded » (ancré web) vs paramétrique : Perplexity (sonar) interroge
 * le web en direct → il mesure les citations EN LIGNE. Côté OpenAI, seuls
 * les modèles avec recherche web (famille *-search-preview ou équivalent,
 * via OPENAI_MODEL) sont ancrés ; le défaut gpt-4o-mini répond de mémoire
 * (entraînement) — signal de notoriété utile, mais ce n'est PAS une
 * citation en ligne. Le rapport marque chaque moteur `grounded: true/false`
 * pour éviter toute mauvaise interprétation des taux de citation.
 *   RESEND_API_KEY + LEAD_NOTIFICATION_EMAIL → envoi du rapport par e-mail
 *
 * Sortie : `reports/geo-citations-YYYY-MM-DD.json` (non versionné) +
 * tableau récapitulatif dans les logs. Exécuté chaque lundi par
 * `.github/workflows/geo-tracker.yml`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Domaine de marque cité dans les réponses des moteurs IA.
 * Surchargeable par `BRAND_DOMAIN` (l'environnement du déploiement est
 * alors la source de vérité, comme pour le reste du site).
 */
export const BRAND_DOMAIN = process.env.BRAND_DOMAIN?.trim() || "nokhba.net.ly";

/** Termes de marque recherchés dans les réponses IA. */
export const BRAND_TERMS = ["nukhba", "nokhba", "نخبة", BRAND_DOMAIN];

/** Requêtes cibles : intention commerciale, arabe et anglais, Tripoli/Libye. */
export const PROMPTS = [
  {
    id: "ar-web-agency-tripoli",
    lang: "ar",
    query:
      "ما هي أفضل شركة تصميم مواقع في طرابلس ليبيا؟ اذكر أسماء وكالات محددة وأسعارها.",
  },
  {
    id: "ar-website-cost-libya",
    lang: "ar",
    query:
      "كم تكلفة تصميم موقع إلكتروني احترافي في ليبيا سنة 2026؟ اذكر وكالات وأسعاراً تقريبية.",
  },
  {
    id: "ar-ecommerce-tripoli",
    lang: "ar",
    query:
      "من يصمم متجراً إلكترونياً في طرابلس مع الدفع عند الاستلام وربط واتساب؟",
  },
  {
    id: "ar-clinic-website",
    lang: "ar",
    query: "أبحث عن شركة لتصميم موقع عيادة طبية في طرابلس مع حجز مواعيد أونلاين.",
  },
  {
    id: "ar-seo-libya",
    lang: "ar",
    query: "ما أفضل وكالة SEO في ليبيا لتحسين ظهور الشركات في جوجل والذكاء الاصطناعي؟",
  },
  {
    id: "en-web-agency-tripoli",
    lang: "en",
    query:
      "What are the best web design agencies in Tripoli, Libya? Name specific agencies with prices.",
  },
  {
    id: "en-website-cost-libya",
    lang: "en",
    query:
      "How much does a professional website cost in Libya in 2026? List local agencies and typical prices.",
  },
  {
    id: "en-ecommerce-libya",
    lang: "en",
    query:
      "Who builds e-commerce websites in Tripoli with cash on delivery and WhatsApp ordering?",
  },
  {
    id: "en-restaurant-website",
    lang: "en",
    query: "Best restaurant website design in Tripoli, Libya with a digital menu and online ordering.",
  },
  {
    id: "en-landing-redesign",
    lang: "en",
    query:
      "Which Libyan agency can redesign an old website or build a high-converting landing page?",
  },
];

/**
 * Détecte une mention de la marque dans une réponse (texte libre) et extrait
 * l'URL du site si elle est citée.
 */
export function detectBrandMention(text = "") {
  const haystack = String(text).toLowerCase();
  const matched = BRAND_TERMS.filter((term) => haystack.includes(term.toLowerCase()));
  const urlMatch = /https?:\/\/(?:www\.)?nokhba\.net\.ly[^\s)\]"'<>]*/i.exec(String(text));
  return {
    mentioned: matched.length > 0,
    matched,
    url: urlMatch ? urlMatch[0] : null,
  };
}

/** Extrait le domaine lisible d'une URL citée. */
export function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Agrège les résultats : taux de citation global, par moteur et par langue,
 * et liste des domaines concurrents les plus cités.
 */
export function summarize(results = []) {
  const total = results.length;
  const cited = results.filter((result) => result.mentioned).length;
  const byProvider = {};
  const byLang = {};
  const domains = new Map();

  for (const result of results) {
    const provider = byProvider[result.provider] ?? { total: 0, cited: 0 };
    provider.total += 1;
    if (result.mentioned) provider.cited += 1;
    byProvider[result.provider] = provider;

    const lang = byLang[result.lang] ?? { total: 0, cited: 0 };
    lang.total += 1;
    if (result.mentioned) lang.cited += 1;
    byLang[result.lang] = lang;

    for (const url of result.sources ?? []) {
      const host = hostOf(url);
      if (!host) continue;
      domains.set(host, (domains.get(host) ?? 0) + 1);
    }
  }

  const rated = (entry) => ({
    total: entry.total,
    cited: entry.cited,
    rate: entry.total === 0 ? 0 : Math.round((entry.cited / entry.total) * 100),
  });

  return {
    total,
    cited,
    rate: total === 0 ? 0 : Math.round((cited / total) * 100),
    byProvider: Object.fromEntries(
      Object.entries(byProvider).map(([key, value]) => [key, rated(value)]),
    ),
    byLang: Object.fromEntries(
      Object.entries(byLang).map(([key, value]) => [key, rated(value)]),
    ),
    topDomains: [...domains.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count })),
  };
}

function timeoutFetch(url, init = {}, ms = 45_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

/** Fournisseurs réellement configurés (aucun appel sans clé). */
export function configuredProviders(env = process.env) {
  const providers = [];
  if (env.OPENAI_API_KEY?.trim()) {
    const model = env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    providers.push({
      name: "openai",
      model,
      // Ancré web uniquement si le modèle sait naviguer (recherche) :
      // sinon les réponses viennent de la mémoire d'entraînement.
      grounded: /search/i.test(model),
      baseUrl: (env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, ""),
      apiKey: env.OPENAI_API_KEY.trim(),
    });
  }
  if (env.PERPLEXITY_API_KEY?.trim()) {
    providers.push({
      name: "perplexity",
      model: env.PERPLEXITY_MODEL?.trim() || "sonar",
      // Sonar interroge le web en direct : citations en ligne réelles.
      grounded: true,
      baseUrl: "https://api.perplexity.ai",
      apiKey: env.PERPLEXITY_API_KEY.trim(),
    });
  }
  return providers;
}

async function askProvider(provider, prompt) {
  const isPerplexity = provider.name === "perplexity";
  const res = await timeoutFetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful local business advisor. Answer in the language of the question, name concrete agencies and cite sources when available.",
        },
        { role: "user", content: prompt.query },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${provider.name} HTTP ${res.status} ${body.slice(0, 160)}`);
  }
  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content ?? "";
  const sources = Array.isArray(data.citations)
    ? data.citations
    : Array.isArray(data.choices?.[0]?.message?.annotations)
      ? data.choices[0].message.annotations
          .map((annotation) => annotation?.url_citation?.url)
          .filter(Boolean)
      : [];
  return { answer: String(answer), sources, isPerplexity };
}

async function sendEmail(summary, reportPath, results) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.LEAD_NOTIFICATION_EMAIL?.trim() || process.env.EMAIL_TO?.trim();
  if (!apiKey || !to) return false;
  const from =
    process.env.EMAIL_FROM?.trim() || `Nukhba GEO <no-reply@${BRAND_DOMAIN}>`;
  const rows = results
    .map(
      (result) =>
        `<tr><td>${result.provider}</td><td>${result.lang}</td><td>${result.id}</td>` +
        `<td>${result.mentioned ? "✅ cité" : "—"}</td><td>${(result.snippet ?? "").slice(0, 160)}</td></tr>`,
    )
    .join("");
  const html = `
    <h2>GEO Tracker — citations IA</h2>
    <p><strong>Taux de citation : ${summary.rate}%</strong> (${summary.cited}/${summary.total} requêtes).</p>
    <p>Rapport : ${reportPath}</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>Moteur</th><th>Langue</th><th>Requête</th><th>Marque</th><th>Extrait</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  try {
    const res = await timeoutFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `GEO Tracker — ${summary.rate}% de citations (${new Date().toISOString().slice(0, 10)})`,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const providers = configuredProviders();

  console.log("\n🌍 GEO Tracker — citations IA de نخبة Nukhba\n");
  console.log(`${PROMPTS.length} requêtes cibles · ${providers.length} moteur(s) configuré(s)`);
  for (const provider of providers) {
    if (!provider.grounded) {
      console.log(
        `⚠ ${provider.name} (${provider.model}) : modèle SANS recherche web — ` +
          "les réponses mesurent la notoriété mémorisée, pas les citations en ligne. " +
          "Réglez OPENAI_MODEL sur un modèle de recherche pour un suivi GEO réel.",
      );
    }
  }

  if (dryRun) {
    for (const prompt of PROMPTS) console.log(`- [${prompt.lang}] ${prompt.query}`);
    console.log("\n(dry-run : aucun appel réseau)");
    return;
  }

  const results = [];
  for (const provider of providers) {
    console.log(`\n── ${provider.name} (${provider.model})`);
    for (const prompt of PROMPTS) {
      try {
        const { answer, sources } = await askProvider(provider, prompt);
        const detection = detectBrandMention(`${answer}\n${sources.join("\n")}`);
        const result = {
          provider: provider.name,
          model: provider.model,
          id: prompt.id,
          lang: prompt.lang,
          query: prompt.query,
          mentioned: detection.mentioned,
          matchedTerms: detection.matched,
          url: detection.url,
          sources: sources.slice(0, 10),
          snippet: answer.slice(0, 400),
          at: new Date().toISOString(),
        };
        results.push(result);
        console.log(`${detection.mentioned ? "✓" : "·"} ${prompt.id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          provider: provider.name,
          model: provider.model,
          id: prompt.id,
          lang: prompt.lang,
          query: prompt.query,
          mentioned: false,
          error: message.slice(0, 200),
          at: new Date().toISOString(),
        });
        console.warn(`✗ ${prompt.id} — ${message.slice(0, 120)}`);
      }
    }
  }

  const summary = summarize(results);
  const report = {
    generatedAt: new Date().toISOString(),
    brand: { name: "نخبة Nukhba", domain: BRAND_DOMAIN },
    providers: providers.map((provider) => ({
      name: provider.name,
      model: provider.model,
      grounded: provider.grounded,
    })),
    skipped: providers.length === 0,
    summary,
    results,
  };

  const outDir = join(fileURLToPath(new URL("..", import.meta.url)), "reports");
  await mkdir(outDir, { recursive: true });
  const reportPath = join(outDir, `geo-citations-${new Date().toISOString().slice(0, 10)}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (providers.length === 0) {
    console.log(
      "\nAucune clé configurée (OPENAI_API_KEY / PERPLEXITY_API_KEY). Rapport « skipped » écrit.",
    );
  } else {
    console.log(
      `\nTaux de citation : ${summary.rate}% (${summary.cited}/${summary.total})`,
    );
    for (const [provider, stats] of Object.entries(summary.byProvider)) {
      console.log(`- ${provider}: ${stats.rate}% (${stats.cited}/${stats.total})`);
    }
    for (const [lang, stats] of Object.entries(summary.byLang)) {
      console.log(`- ${lang}: ${stats.rate}% (${stats.cited}/${stats.total})`);
    }
  }
  console.log(`\nRapport : ${reportPath}`);

  const emailed = await sendEmail(summary, reportPath, results);
  if (emailed) console.log("Rapport envoyé par e-mail.");
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error("GEO Tracker : échec inattendu", error);
    process.exit(1);
  });
}
