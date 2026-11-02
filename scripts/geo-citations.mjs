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
 *
 * A06 (audit SEO/GEO 2026-11-01) : l'URL de marque n'est reconnue que si le
 * HOSTNAME est exactement `BRAND_DOMAIN` — jamais une simple sous-chaîne,
 * sinon « nokhba.net.ly.evil.example » compterait comme une citation.
 */
export function detectBrandMention(text = "") {
  const haystack = String(text).toLowerCase();
  const nameTerms = BRAND_TERMS.filter((term) => term !== BRAND_DOMAIN);
  const matched = nameTerms.filter((term) => haystack.includes(term.toLowerCase()));
  let url = null;
  for (const match of String(text).matchAll(/https?:\/\/[^\s)\]"'<>]+/gi)) {
    if (hostOf(match[0]) === BRAND_DOMAIN) {
      url = match[0];
      break;
    }
  }
  return {
    mentioned: matched.length > 0 || url !== null,
    matched,
    url,
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
 * Vrai si au moins une source citée par le moteur pointe exactement sur le
 * domaine de marque (vérification par hostname, pas par sous-chaîne).
 */
export function citesBrandDomain(sources = [], domain = BRAND_DOMAIN) {
  return (sources ?? []).some((url) => hostOf(url) === domain);
}

/**
 * Agrège les résultats (A06, audit SEO/GEO 2026-11-01) en distinguant :
 *  - `mentionRate`  : la marque est nommée dans la réponse (texte libre) ;
 *  - `citationRate` : au moins une SOURCE citée par le moteur a un hostname
 *    exactement égal au domaine de marque (citation d'URL vérifiée) ;
 *  - `groundedCitationRate` : idem, restreint aux réponses ancrées web
 *    (`grounded: true`) — seules celles-là mesurent des citations en ligne ;
 *  - les requêtes en erreur (`status: "error"`) sont comptées à part et
 *    exclues des dénominateurs : une erreur API n'est pas une réponse négative.
 *
 * `rate`/`cited` restent exposés pour compatibilité (rate = mentionRate).
 */
export function summarize(results = []) {
  const pct = (n, d) => (d === 0 ? 0 : Math.round((n / d) * 100));
  const isCited = (result) =>
    result.cited ?? citesBrandDomain(result.sources ?? []);

  const total = results.length;
  const errors = results.filter((result) => result.status === "error").length;
  const answered = results.filter((result) => result.status !== "error");
  const mentioned = answered.filter((result) => result.mentioned).length;
  const cited = answered.filter(isCited).length;
  const grounded = answered.filter((result) => result.grounded);
  const groundedCited = grounded.filter(isCited).length;

  const byProvider = {};
  const byLang = {};
  const domains = new Map();

  for (const result of results) {
    const provider = byProvider[result.provider] ?? {
      total: 0, errors: 0, mentioned: 0, cited: 0,
    };
    provider.total += 1;
    if (result.status === "error") provider.errors += 1;
    if (result.status !== "error" && result.mentioned) provider.mentioned += 1;
    if (result.status !== "error" && isCited(result)) provider.cited += 1;
    byProvider[result.provider] = provider;

    const lang = byLang[result.lang] ?? { total: 0, errors: 0, mentioned: 0, cited: 0 };
    lang.total += 1;
    if (result.status === "error") lang.errors += 1;
    if (result.status !== "error" && result.mentioned) lang.mentioned += 1;
    if (result.status !== "error" && isCited(result)) lang.cited += 1;
    byLang[result.lang] = lang;

    for (const url of result.sources ?? []) {
      const host = hostOf(url);
      if (!host) continue;
      domains.set(host, (domains.get(host) ?? 0) + 1);
    }
  }

  const rated = (entry) => {
    const answeredCount = entry.total - entry.errors;
    return {
      total: entry.total,
      errors: entry.errors,
      answered: answeredCount,
      mentioned: entry.mentioned,
      mentionRate: pct(entry.mentioned, answeredCount),
      cited: entry.cited,
      citationRate: pct(entry.cited, answeredCount),
    };
  };

  return {
    total,
    errors,
    answered: answered.length,
    mentioned,
    mentionRate: pct(mentioned, answered.length),
    cited,
    citationRate: pct(cited, answered.length),
    groundedTotal: grounded.length,
    groundedCited,
    groundedCitationRate: pct(groundedCited, grounded.length),
    // Compatibilité avec l'ancien affichage « taux de citation ».
    rate: pct(mentioned, answered.length),
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
        `<td>${result.status === "error" ? "⚠ erreur" : result.mentioned ? "✅ mentionné" : "—"}</td>` +
        `<td>${result.status === "error" ? "—" : result.cited ? "🔗 URL citée" : "—"}</td>` +
        `<td>${(result.snippet ?? result.error ?? "").slice(0, 160)}</td></tr>`,
    )
    .join("");
  const html = `
    <h2>GEO Tracker — citations IA</h2>
    <p><strong>Mention : ${summary.mentionRate}%</strong> · <strong>Citation d'URL vérifiée : ${summary.citationRate}%</strong> · <strong>Citation ancrée web : ${summary.groundedCitationRate}%</strong> (${summary.cited}/${summary.answered} requêtes répondues, ${summary.errors} erreur(s)).</p>
    <p>Rapport : ${reportPath}</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>Moteur</th><th>Langue</th><th>Requête</th><th>Marque</th><th>Citation</th><th>Extrait</th></tr></thead>
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
        subject: `GEO Tracker — citation ${summary.citationRate}% / mention ${summary.mentionRate}% (${new Date().toISOString().slice(0, 10)})`,
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
          status: "ok",
          grounded: provider.grounded,
          mentioned: detection.mentioned,
          // A06 : citation = source du moteur dont le hostname est exactement
          // le domaine de marque — pas une simple mention textuelle.
          cited: citesBrandDomain(sources),
          matchedTerms: detection.matched,
          url: detection.url,
          sources: sources.slice(0, 10),
          snippet: answer.slice(0, 400),
          at: new Date().toISOString(),
        };
        results.push(result);
        console.log(
          `${detection.mentioned ? "✓" : "·"} ${citesBrandDomain(sources) ? "🔗" : " "} ${prompt.id}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // A06 : une erreur API est un état distinct, PAS une réponse négative.
        results.push({
          provider: provider.name,
          model: provider.model,
          id: prompt.id,
          lang: prompt.lang,
          query: prompt.query,
          status: "error",
          grounded: provider.grounded,
          mentioned: false,
          cited: false,
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
      `\nMention : ${summary.mentionRate}% · Citation d'URL vérifiée : ${summary.citationRate}% · Ancrée web : ${summary.groundedCitationRate}% (${summary.cited}/${summary.answered} répondues, ${summary.errors} erreur(s))`,
    );
    for (const [provider, stats] of Object.entries(summary.byProvider)) {
      console.log(
        `- ${provider}: citation ${stats.citationRate}% / mention ${stats.mentionRate}% (${stats.cited}/${stats.answered} répondues)`,
      );
    }
    for (const [lang, stats] of Object.entries(summary.byLang)) {
      console.log(
        `- ${lang}: citation ${stats.citationRate}% / mention ${stats.mentionRate}% (${stats.cited}/${stats.answered} répondues)`,
      );
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
