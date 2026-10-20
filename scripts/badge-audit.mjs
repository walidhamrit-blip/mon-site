#!/usr/bin/env node
/**
 * Audit du badge de netlinking client (« badge Nukhba »).
 *
 *   npm run badge:audit                 # vérifie tous les clients
 *   npm run badge:audit -- --dry-run    # plan, sans réseau
 *   npm run badge:audit -- --only=hala-dun
 *   npm run badge:audit -- --base=https://nokhba.net.ly
 *
 * Pour chaque site client (démos publiées), le script :
 *   1. récupère le HTML du pied de page (page d'accueil) ;
 *   2. cherche un <a href="https://nokhba.net.ly…"> ;
 *   3. vérifie l'ancre (arabe/latine), `rel` (nofollow ou dofollow) et
 *      `utm_source=client_footer` ;
 *   4. classe : `verified` (lien dofollow exploitable), `nofollow` (lien
 *      présent mais neutralisé), `missing` (aucun lien), `down` (site
 *      injoignable), `pending` (jamais vérifié) ;
 *   5. met à jour `public/badge/clients.json` et écrit
 *      `reports/badge-audit-AAAA-MM-JJ.json`.
 *
 * Le rapport est un livrable commercial autant que technique : il liste, par
 * client, ce qu'il reste à faire pour obtenir le badge (lien, ancre, rel).
 *
 * Codes de sortie :
 *   0 succès (même si des badges manquent : c'est une mesure, pas une erreur)
 *   1 erreurs réseau inattendues sur un site joignable
 *   4 aucune démo exploitable
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLIENTS_PATH = join(ROOT, "public", "badge", "clients.json");
const REPORTS_DIR = join(ROOT, "reports");
const AT_ROOT = join(ROOT, "src");

export const CLIENTS_VERSION = 1;
/** Pages à essayer dans l'ordre : le crédit vit presque toujours en pied de page. */
export const SCAN_PATHS = ["/", "/ar", "/en"];

/* ─────────────────────────── Helpers purs ─────────────────────────── */

/** Normalise une URL de projet : sans slash final, fragment ni query. */
export function normalizeUrl(url) {
  const trimmed = String(url ?? "").trim();
  if (!trimmed || trimmed === "#") return "";
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.search = "";
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/[#?].*$/, "").replace(/\/+$/, "");
  }
}

/** Une URL est auditable si elle est publique (pas de localhost / fichier). */
export function isAuditableUrl(url) {
  const normalized = normalizeUrl(url);
  if (!normalized || !/^https?:\/\//i.test(normalized)) return false;
  try {
    const host = new URL(normalized).hostname;
    if (!host || host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
      return false;
    }
    if (host === "[::1]" || host.endsWith(".local") || host.endsWith(".test")) return false;
    if (host.endsWith(".invalid")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Extrait le HTML utile d'une page : tout le document (le pied de page peut
 * être injecté côté client, on ne peut vérifier que le HTML initial ou SSR).
 */
export function extractHtml(body) {
  return typeof body === "string" ? body : "";
}

/** Statut HTTP → décision métier. */
export function classifyStatus(httpStatus) {
  if (httpStatus >= 200 && httpStatus < 300) return "ok";
  return "down";
}

/**
 * Fusionne les résultats d'un audit dans le fichier clients précédent.
 * `checkedAt` n'est mis à jour que lorsque le statut change : le fichier ne
 * bouge pas à chaque exécution (aucun bruit dans les revues).
 */
export function mergeClients(previous, results, { now = new Date(), prune = false } = {}) {
  const base = previous && typeof previous === "object" && previous.clients ? previous.clients : {};
  const clients = { ...base };
  let changed = false;
  for (const result of results ?? []) {
    if (!result?.url || !result.slug) continue;
    const before = base[result.url] ?? null;
    const sameStatus = before?.status === result.status;
    const entry = {
      slug: result.slug,
      title: result.title ?? before?.title ?? "",
      titleEn: result.titleEn ?? before?.titleEn,
      status: result.status,
      checkedAt: sameStatus ? (before?.checkedAt ?? null) : now.toISOString(),
      anchor: result.anchor ?? before?.anchor,
      rel: result.rel ?? before?.rel,
    };
    if (
      !before ||
      before.status !== entry.status ||
      before.anchor !== entry.anchor ||
      before.rel !== entry.rel ||
      before.slug !== entry.slug
    ) {
      changed = true;
    }
    clients[result.url] = entry;
  }
  // Un client retiré du contenu (démo supprimée) ne doit pas rester compté :
  // `prune` n'est activé que sur un run complet (pas de `--only`).
  if (prune) {
    const kept = new Set((results ?? []).filter((r) => r?.url).map((r) => r.url));
    for (const url of Object.keys(clients)) {
      if (!kept.has(url)) {
        delete clients[url];
        changed = true;
      }
    }
  }
  return {
    changed,
    doc: {
      version: CLIENTS_VERSION,
      generatedAt: changed ? now.toISOString() : (previous?.generatedAt ?? now.toISOString()),
      clients,
    },
  };
}

/** Synthèse chiffrée d'un run. */
export function summarize(results = []) {
  const summary = {
    total: results.length,
    verified: 0,
    nofollow: 0,
    missing: 0,
    down: 0,
    pending: 0,
    error: 0,
    skipped: 0,
  };
  for (const result of results) {
    if (result.status in summary) summary[result.status] += 1;
    else if (result.status === "error") summary.error += 1;
    else summary.skipped += 1;
  }
  return summary;
}

/** Message actionnable pour un client qui n'a pas encore de badge valide. */
export function adviceFor(status, { nofollow = false } = {}) {
  if (status === "verified") return "Badge en place et suivi (dofollow).";
  if (status === "nofollow") {
    return "Lien présent mais en nofollow : retirer rel=\"nofollow\" pour transmettre l'autorité.";
  }
  if (status === "down") return "Site injoignable : relancer le contrôle plus tard.";
  if (status === "missing") return "Ajouter le badge en pied de page (extrait prêt sur /badge).";
  if (nofollow) return "Lien en nofollow : à corriger.";
  return "Jamais vérifié.";
}

/**
 * Orchestration testable : pour chaque site, récupère le HTML puis détecte
 * le badge. `deps` injecte le réseau et le détecteur.
 */
export async function auditAll({
  sites = [],
  previousClients = null,
  deps = {},
  options = {},
  now = new Date(),
} = {}) {
  const {
    fetchHtml = async () => ({ ok: true, status: 200, html: "" }),
    detect = () => ({ found: false }),
  } = deps;
  const { only = null, dryRun = false } = options;

  const onlySet = only && only.length > 0 ? new Set(only) : null;
  const queue = sites.filter((site) => {
    if (!onlySet) return true;
    return onlySet.has(site.slug);
  });

  const results = [];
  const workers = Math.max(1, Math.min(options.concurrency ?? 3, queue.length || 1));
  let cursor = 0;

  const processOne = async (site) => {
    const url = normalizeUrl(site.previewUrl);
    const base = {
      slug: site.slug,
      url,
      title: site.title,
      titleEn: site.titleEn,
    };

    if (!isAuditableUrl(site.previewUrl)) {
      return { ...base, status: "skipped", reason: "url_non_auditable" };
    }
    if (dryRun) {
      return { ...base, status: "pending", dryRun: true };
    }

    // On interroge la racine, puis /ar et /en : certains sites séparent le
    // pied de page par langue. La première page qui porte réellement le badge
    // gagne ; à défaut on retient la première page atteignable (statut
    // `missing`) ; si aucune ne répond, le site est `down`.
    let reachable = null;
    let lastError = null;

    for (const path of SCAN_PATHS) {
      const target = `${url}${path === "/" ? "" : path}`;
      let fetched;
      try {
        fetched = await fetchHtml(target, { timeoutMs: options.timeoutMs ?? 20_000 });
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        continue;
      }
      if (!(fetched.status >= 200 && fetched.status < 300)) {
        lastError = `HTTP ${fetched.status}`;
        continue;
      }
      reachable ??= { target, status: fetched.status };
      const detection = detect(fetched.html);
      if (detection?.found) {
        return {
          ...base,
          status: detection.nofollow ? "nofollow" : "verified",
          httpStatus: fetched.status,
          scannedUrl: target,
          anchor: detection.anchor ?? null,
          rel: detection.rel ?? null,
          utm: Boolean(detection.utm),
          imageOnly: Boolean(detection.imageOnly),
          href: detection.href ?? null,
        };
      }
    }

    if (!reachable) {
      return { ...base, status: "down", httpStatus: 0, error: lastError ?? "aucune réponse" };
    }
    return {
      ...base,
      status: "missing",
      httpStatus: reachable.status,
      scannedUrl: reachable.target,
    };
  };

  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (cursor < queue.length) {
        const site = queue[cursor];
        cursor += 1;
        results.push(await processOne(site));
      }
    }),
  );

  // Ordre stable pour les rapports et les diffs.
  results.sort((a, b) => String(a.slug).localeCompare(String(b.slug)));

  // Plan à blanc : aucune écriture, aucun fichier clients modifié.
  if (dryRun) {
    return {
      results,
      summary: summarize(results),
      doc: previousClients ?? { version: CLIENTS_VERSION, generatedAt: now.toISOString(), clients: {} },
      changed: false,
    };
  }

  const { doc, changed } = mergeClients(previousClients, results, {
    now,
    // Run partiel (`--only`) : on ne supprime jamais les clients non visités.
    prune: options.prune ?? !onlySet,
  });
  return { results, summary: summarize(results), doc, changed };
}

/* ─────────────────────────── Dépendances réelles ─────────────────────────── */

async function loadDemos(options) {
  if (options.base) {
    const url = `${String(options.base).replace(/\/+$/, "")}/api/public/demos`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const body = await res.json();
        if (Array.isArray(body?.demos) && body.demos.length > 0) {
          console.log(`  source : ${url} (${body.demos.length} démos)`);
          return body.demos;
        }
      }
      console.warn(`  ⚠ ${url} → HTTP ${res.status} ; repli sur le contenu local`);
    } catch (error) {
      console.warn(`  ⚠ ${url} injoignable (${error.message}) ; repli sur le contenu local`);
    }
  }

  const outDir = join(ROOT, ".next", "badge-audit");
  await mkdir(outDir, { recursive: true });
  const outfile = join(outDir, "content.mjs");
  await build({
    entryPoints: [join(AT_ROOT, "lib", "content.ts")],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "silent",
  });
  const mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  console.log(`  source : src/lib/content.ts (${mod.demos.length} démos par défaut)`);
  return mod.demos;
}

async function loadBadgeLib() {
  const outDir = join(ROOT, ".next", "badge-audit");
  await mkdir(outDir, { recursive: true });
  const outfile = join(outDir, "badge.mjs");
  await build({
    entryPoints: [join(AT_ROOT, "lib", "badge.ts")],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "silent",
  });
  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}

async function readClientsFile(path = CLIENTS_PATH) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function realFetchHtml(url, { timeoutMs = 20_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "NukhbaBadgeBot/1.0 (+https://nokhba.net.ly/badge; vérification du crédit de conception)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const html = res.ok ? await res.text() : "";
    return { ok: res.ok, status: res.status, html };
  } finally {
    clearTimeout(timer);
  }
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    only: null,
    base: process.env.BADGE_BASE_URL || "",
    concurrency: 3,
    timeoutMs: 20_000,
    prune: null,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--prune") options.prune = true;
    else if (arg === "--no-prune") options.prune = false;
    else if (arg.startsWith("--only=")) {
      options.only = arg
        .slice("--only=".length)
        .split(",")
        .map((slug) => slug.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--base=")) options.base = arg.slice("--base=".length).trim();
    else if (arg.startsWith("--concurrency=")) {
      options.concurrency = Math.max(1, Number.parseInt(arg.split("=")[1], 10) || 3);
    } else if (arg === "--help" || arg === "-h") options.help = true;
  }
  return options;
}

function printHelp() {
  console.log(`
Audit du badge de netlinking client (Nukhba)

  --dry-run              plan seulement, aucun appel réseau
  --prune                retire les clients absents du contenu (défaut sur
                         un run complet)
  --no-prune             conserve les clients même s'ils ne sont plus listés
  --only=slug1,slug2     limite l'audit à certaines démos
  --base=URL             lit les démos de <URL>/api/public/demos
  --concurrency=N        contrôles parallèles (défaut 3)
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return 0;
  }

  console.log(`\n🏷️  Audit du badge client${options.dryRun ? " (dry-run)" : ""}\n`);
  const demos = await loadDemos(options);
  if (!Array.isArray(demos) || demos.length === 0) {
    console.error("Aucune démo trouvée.");
    return 4;
  }

  const badgeLib = await loadBadgeLib();
  const previous = await readClientsFile();

  const { results, summary, doc, changed } = await auditAll({
    sites: demos,
    previousClients: previous,
    deps: { fetchHtml: realFetchHtml, detect: badgeLib.detectBadge },
    options,
    now: new Date(),
  });

  if (!options.dryRun && changed) {
    await mkdir(dirname(CLIENTS_PATH), { recursive: true });
    await writeFile(CLIENTS_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  }

  await mkdir(REPORTS_DIR, { recursive: true });
  const reportPath = join(REPORTS_DIR, `badge-audit-${new Date().toISOString().slice(0, 10)}.json`);
  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dryRun: options.dryRun,
        options: { only: options.only, base: options.base || null },
        summary,
        clients: results,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const icon = { verified: "✓", nofollow: "~", missing: "·", down: "✖", pending: "·", skipped: "·" };
  for (const result of results) {
    const detail =
      result.status === "verified"
        ? `badge en place${result.anchor ? ` — « ${result.anchor.slice(0, 48)} »` : ""}`
        : result.status === "nofollow"
          ? "lien en nofollow"
          : result.status === "missing"
            ? "aucun lien vers nokhba.net.ly"
            : result.status === "down"
              ? `hors ligne (${result.httpStatus ?? "réseau"})`
              : "en attente";
    console.log(`${icon[result.status] ?? "·"} ${result.slug} — ${detail}`);
  }

  console.log(
    `\n${summary.verified} vérifié(s) · ${summary.nofollow} nofollow · ${summary.missing} manquant(s) · ${summary.down} hors ligne · ${summary.pending} en attente · ${summary.error} erreur(s)`,
  );
  console.log(`Rapport : ${reportPath}`);
  if (!options.dryRun) {
    console.log(
      changed
        ? "Clients    : public/badge/clients.json (mis à jour)"
        : "Clients    : public/badge/clients.json (inchangé)",
    );
  }

  if (!options.dryRun && existsSync(CLIENTS_PATH) === false && changed) return 1;
  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error("Audit du badge : échec inattendu", error);
      process.exitCode = 1;
    });
}
