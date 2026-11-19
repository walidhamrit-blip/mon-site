#!/usr/bin/env node
/**
 * Contrôle des liens — interne (sitemap + navigation) et externe.
 *
 * Appelé par `.github/workflows/liens.yml` une fois par semaine, et
 * utilisable à la main :
 *   SITE_URL=https://nokhba.net.ly node scripts/link-check.mjs
 *
 * Périmètre volontairement borné pour ne pas marteler la production :
 *   - toutes les pages du sitemap (40 maximum) ;
 *   - 80 liens internes découverts dans ces pages ;
 *   - 60 liens externes (5 par page maximum).
 *
 * Un 404/410/5xx est un échec. Un 401/403/429 est un avertissement : ces
 * codes viennent souvent d'une protection anti-robots, pas d'un lien mort.
 *
 * Les timeouts et les 429/5xx sont retentés (2 fois, avec pause) : un scan
 * qui suit un déploiement ne doit pas ouvrir une fausse alerte. Si le sitemap
 * lui-même est limité (429), le contrôle est reporté sans issue.
 */
import {
  classifyStatus,
  extractLinks,
  isRetryableStatus,
  isSameOrigin,
  parseSitemap,
  summarize,
} from "./lib/link-checks.mjs";

const BASE = (process.env.SITE_URL ?? "https://nokhba.net.ly").replace(/\/$/, "");
const MAX_PAGES = 40;
const MAX_INTERNAL = 80;
const MAX_EXTERNAL = 60;
const EXTERNAL_PER_PAGE = 5;
const CONCURRENCY = 4;
const TIMEOUT_MS = 25_000;
const RETRIES = 2;
const RETRY_DELAYS_MS = [2_000, 5_000];

const USER_AGENT = "Nukhba-LinkCheck/1.1 (+https://nokhba.net.ly)";
const results = [];
const checked = new Set();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `fetch` avec délai maximal et nouvelles tentatives sur réseau, 429 et 5xx.
 * Les autres statuts (404, 403…) sont retournés tels quels : ils sont
 * significatifs et ne doivent pas être masqués par des essais répétés.
 */
async function fetchWithRetry(url, { accept = "text/html,application/xhtml+xml" } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT, accept },
      });

      if (isRetryableStatus(response.status) && attempt < RETRIES) {
        await response.body?.cancel().catch(() => {});
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

async function fetchPage(url) {
  const response = await fetchWithRetry(url);
  const body = await response.text();
  return { status: response.status, body };
}

async function fetchStatus(url) {
  const response = await fetchWithRetry(url, { accept: "*/*" });
  // Seul le statut nous intéresse : on annule le corps pour ne pas
  // télécharger des pages entières chez des tiers.
  await response.body?.cancel().catch(() => {});
  return { status: response.status };
}

async function mapLimit(items, limit, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      output[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

function record(url, httpStatus, source) {
  results.push({ url, httpStatus, status: classifyStatus(httpStatus), source });
}

async function checkUrl(url, source) {
  const key = url.replace(/#.*$/, "");
  if (checked.has(key)) return;
  checked.add(key);

  try {
    const { status } = await fetchStatus(url);
    record(url, status, source);
  } catch (error) {
    results.push({
      url,
      httpStatus: 0,
      status: "fail",
      source,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function printReport({ sitemapError, deferred } = {}) {
  const { failures, warnings, total, ok } = summarize(results);
  console.log(`# Contrôle des liens — ${new URL(BASE).hostname}`);
  console.log(`Date : ${new Date().toISOString()}`);

  if (sitemapError) {
    console.log(`\nImpossible de lire le sitemap : ${sitemapError}`);
    console.log("\nRésultat : ÉCHEC (sitemap inaccessible)");
    return;
  }

  if (deferred) {
    console.log(`\nContrôle reporté : ${deferred}`);
    console.log("\nRésultat : REPORTÉ (aucune alerte)");
    return;
  }

  console.log(
    `Périmètre : ${checked.size} URL contrôlées (${failures.length} échec(s), ${warnings.length} avertissement(s)).`,
  );

  if (failures.length > 0) {
    console.log("\n## Échecs");
    for (const failure of failures) {
      const detail = failure.error ? ` (${failure.error})` : "";
      console.log(
        `- **${failure.httpStatus || "réseau"}** ${failure.url}${detail} — depuis ${failure.source}`,
      );
    }
  }

  if (warnings.length > 0) {
    console.log("\n## Avertissements (protection anti-robots probable)");
    for (const warning of warnings) {
      console.log(`- **${warning.httpStatus}** ${warning.url} — depuis ${warning.source}`);
    }
  }

  console.log(
    `\nRésultat : ${failures.length > 0 ? "ÉCHEC" : "OK"} ` +
      `(${ok}/${total} OK, ${warnings.length} avertissement(s), ${failures.length} échec(s))`,
  );
}

async function main() {
  let sitemap;
  try {
    const response = await fetchWithRetry(`${BASE}/sitemap.xml`, {
      accept: "application/xml,text/xml",
    });
    if (response.status === 429) {
      printReport({ deferred: "sitemap limité (HTTP 429), réessayer plus tard" });
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    sitemap = await response.text();
  } catch (error) {
    printReport({
      sitemapError: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
    return;
  }

  const pages = parseSitemap(sitemap)
    .filter((url) => isSameOrigin(url, BASE))
    .slice(0, MAX_PAGES);

  const internal = new Set();
  const external = new Set();

  await mapLimit(pages, CONCURRENCY, async (url) => {
    checked.add(url);
    try {
      const { status, body } = await fetchPage(url);
      record(url, status, "sitemap");
      if (status >= 200 && status < 300) {
        let count = 0;
        for (const link of extractLinks(body, url)) {
          if (isSameOrigin(link, BASE)) {
            if (!checked.has(link) && internal.size < MAX_INTERNAL) internal.add(link);
          } else if (count < EXTERNAL_PER_PAGE && external.size < MAX_EXTERNAL) {
            external.add(link);
            count += 1;
          }
        }
      }
    } catch (error) {
      results.push({
        url,
        httpStatus: 0,
        status: "fail",
        source: "sitemap",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await mapLimit([...internal], CONCURRENCY, (url) => checkUrl(url, "interne"));
  await mapLimit([...external], CONCURRENCY, (url) => checkUrl(url, "externe"));

  printReport();
  const { failures } = summarize(results);
  process.exitCode = failures.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("# Contrôle des liens interrompu");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
