#!/usr/bin/env node
/**
 * Captures d'écran automatiques des démos — Playwright + Sharp.
 *
 *   npm run previews:capture                 # toutes les démos
 *   npm run previews:capture -- --dry-run    # plan sans navigateur
 *   npm run previews:capture -- --only=al-manhaj-company,hala-dun
 *   npm run previews:capture -- --base=https://nokhba.net.ly
 *
 * Ce que fait le script, pour chaque démo (`content.demos`) :
 *   1. vérifie que `previewUrl` répond en HTTP 200 (alerte si la démo tombe) ;
 *   2. capture le rendu réel en 1440×900 (desktop, pleine résolution) et
 *      390×693 @2x (mobile retina) ;
 *   3. convertit en WebP q90, respectivement 1440×900 et 780×1386 ;
 *   4. écrit `public/previews/<slug>-{desktop,mobile}.webp` ;
 *   5. met à jour `public/previews/manifest.json` (hash anti-cache, statut,
 *      date de capture) — source unique lue par le site, le sitemap d'images
 *      et les données structurées ;
 *   6. écrit un rapport `reports/demo-previews-AAAA-MM-JJ.json`.
 *
 * Une démo injoignable **conserve sa dernière capture** (marquée `down`) : le
 * site ne casse jamais parce qu'un site client est momentanément hors ligne.
 *
 * Codes de sortie :
 *   0 succès (même si des démos sont hors ligne → alertes dans le rapport)
 *   1 erreurs de capture sur des sites joignables
 *   3 Playwright / Sharp / navigateur manquant
 *   4 aucune démo exploitable
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PREVIEWS_DIR = join(ROOT, "public", "previews");
const MANIFEST_PATH = join(PREVIEWS_DIR, "manifest.json");
const REPORTS_DIR = join(ROOT, "reports");

export const MANIFEST_VERSION = 1;
export const WEBP_QUALITY = 90;
/** Viewports de rendu CSS (le mobile est capturé @2x, voir `deviceScaleFactor`). */
export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 693 },
};
/** Tailles finales des fichiers WebP servis. */
export const OUTPUT_SIZES = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 780, height: 1386 },
};

/* ─────────────────────────── Helpers purs ─────────────────────────── */

/** Normalise une URL de projet : sans slash final, fragment ni query. */
export function normalizePreviewUrl(url) {
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

/** Une URL est capturable si elle est publique (pas de localhost / fichier). */
export function isCapturableUrl(url) {
  const normalized = normalizePreviewUrl(url);
  if (!normalized || !/^https?:\/\//i.test(normalized)) return false;
  try {
    const host = new URL(normalized).hostname;
    if (!host || host === "localhost") return false;
    if (host === "127.0.0.1" || host === "0.0.0.0" || host === "[::1]") return false;
    if (host.endsWith(".local") || host.endsWith(".test") || host.endsWith(".invalid")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Slug de fichier sûr : `[a-z0-9-]`, jamais vide. */
export function safeSlug(slug, fallbackUrl = "") {
  const cleaned = String(slug ?? "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (cleaned) return cleaned;
  const fromUrl = normalizePreviewUrl(fallbackUrl)
    .replace(/^https?:\/\//i, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return fromUrl || "demo";
}

export function previewFileNames(slug) {
  return {
    desktop: `/previews/${slug}-desktop.webp`,
    mobile: `/previews/${slug}-mobile.webp`,
  };
}

/** Empreinte courte (10 caractères base64url) du contenu d'un fichier. */
export function shortHash(buffer) {
  return createHash("sha256").update(buffer).digest("base64url").slice(0, 10);
}

export function hashBuffers(...buffers) {
  const hash = createHash("sha256");
  for (const buffer of buffers) hash.update(buffer);
  return hash.digest("base64url").slice(0, 10);
}

/** Statut HTTP → décision métier. */
export function classifyHttpStatus(status) {
  if (status >= 200 && status < 300) return "ok";
  return "down";
}

/**
 * Fusionne les captures d'un run dans le manifeste précédent, sans muter
 * l'entrée d'origine. Les projets absents du run (option `--only`) sont
 * conservés tels quels.
 */
export function mergeManifest(previous, updates, { now = new Date(), prune = false } = {}) {
  const base =
    previous && typeof previous === "object" && previous.projects
      ? previous.projects
      : {};
  const projects = { ...base };
  for (const [key, entry] of Object.entries(updates ?? {})) {
    if (!key) continue;
    projects[key] = { ...(base[key] ?? {}), ...entry };
  }
  if (prune) {
    const kept = new Set(Object.keys(updates ?? {}));
    for (const key of Object.keys(projects)) {
      if (!kept.has(key)) delete projects[key];
    }
  }
  return {
    version: MANIFEST_VERSION,
    generatedAt: now.toISOString(),
    viewports: VIEWPORTS,
    projects,
  };
}

/** Synthèse d'un run : succès, hors ligne, erreurs, ignorés. */
export function summarizeResults(results = []) {
  const summary = {
    total: results.length,
    captured: 0,
    unchanged: 0,
    down: 0,
    error: 0,
    skipped: 0,
  };
  for (const result of results) {
    if (result.outcome === "captured") summary.captured += 1;
    else if (result.outcome === "unchanged") summary.unchanged += 1;
    else if (result.outcome === "down") summary.down += 1;
    else if (result.outcome === "error") summary.error += 1;
    else summary.skipped += 1;
  }
  return summary;
}

/**
 * Orchestration testable : pour chaque démo, vérifie l'URL puis capture.
 * `deps` injecte les effets de bord (réseau, navigateur, écriture disque).
 */
export async function captureAll({
  demos = [],
  previousManifest = null,
  deps = {},
  options = {},
  now = new Date(),
} = {}) {
  const {
    checkUrl = async () => ({ ok: true, status: 200 }),
    capture = async () => {
      throw new Error("capture non fournie");
    },
    convert = async (buffer) => ({ buffer, hash: shortHash(buffer) }),
    writePreview = async () => {},
    previewExists = async () => true,
  } = deps;

  const {
    only = null,
    force = false,
    concurrency = 3,
    maxAgeDays = 7,
    dryRun = false,
  } = options;

  const onlySet = only && only.length > 0 ? new Set(only) : null;
  const results = [];
  const updates = {};

  const queue = demos.filter((demo) => {
    if (!onlySet) return true;
    return onlySet.has(demo.slug) || onlySet.has(String(demo.slug ?? ""));
  });

  const workers = Math.max(1, Math.min(concurrency, queue.length || 1));
  let cursor = 0;

  const processOne = async (demo) => {
    const key = normalizePreviewUrl(demo.previewUrl);
    const base = { slug: demo.slug, url: key || String(demo.previewUrl ?? ""), title: demo.title };

    if (!isCapturableUrl(demo.previewUrl)) {
      return { ...base, outcome: "skipped", reason: "url_non_capturable" };
    }

    const previousEntry = previousManifest?.projects?.[key] ?? null;
    const lastCaptured = previousEntry?.capturedAt ? new Date(previousEntry.capturedAt) : null;
    const ageDays = lastCaptured
      ? (now.getTime() - lastCaptured.getTime()) / 86_400_000
      : Number.POSITIVE_INFINITY;
    if (!force && previousEntry?.source === "playwright" && ageDays < maxAgeDays) {
      return {
        ...base,
        outcome: "skipped",
        reason: "recent",
        ageDays: Math.round(ageDays * 10) / 10,
      };
    }

    // Plan à blanc : aucun appel réseau, aucune écriture.
    if (dryRun) {
      return { ...base, outcome: "captured", dryRun: true };
    }

    const check = await checkUrl(key, { timeoutMs: options.timeoutMs ?? 20_000 });
    const status = classifyHttpStatus(check.status ?? 0);
    if (!check.ok || status !== "ok") {
      // Site injoignable : on conserve la capture existante, marquée `down`.
      const entry = {
        ...(previousEntry ?? {}),
        status: "down",
        httpStatus: check.status ?? null,
        lastCheckedAt: now.toISOString(),
        lastError: String(check.error ?? `HTTP ${check.status ?? "?"}`).slice(0, 180),
      };
      updates[key] = entry;
      return {
        ...base,
        outcome: "down",
        httpStatus: check.status ?? null,
        error: check.error ?? null,
        keptPreviousCapture: Boolean(previousEntry),
      };
    }

    try {
      const slug = safeSlug(demo.slug, key);
      // Réutilise les chemins déjà publiés (historique Git stable, pas de
      // doublons) sauf si desktop et mobile partagent un même fichier.
      const reusable =
        previousEntry?.desktop &&
        previousEntry?.mobile &&
        previousEntry.desktop !== previousEntry.mobile
          ? { desktop: previousEntry.desktop, mobile: previousEntry.mobile }
          : null;
      const files = reusable ?? previewFileNames(slug);

      const desktopPng = await capture({ url: key, variant: "desktop", viewport: VIEWPORTS.desktop });
      const desktop = await convert(desktopPng, OUTPUT_SIZES.desktop);
      const mobilePng = await capture({ url: key, variant: "mobile", viewport: VIEWPORTS.mobile });
      const mobile = await convert(mobilePng, OUTPUT_SIZES.mobile);

      const newHash = hashBuffers(desktop.buffer, mobile.buffer);

      // Rendu identique + fichiers déjà présents : on ne salit pas le dépôt
      // avec un commit hebdomadaire de binaires inchangés.
      if (
        !force &&
        previousEntry?.hash === newHash &&
        previousEntry?.desktop === files.desktop &&
        (await previewExists(files.desktop)) &&
        (await previewExists(files.mobile))
      ) {
        updates[key] = {
          ...previousEntry,
          httpStatus: check.status ?? 200,
          status: "ok",
          lastCheckedAt: now.toISOString(),
        };
        return { ...base, outcome: "unchanged", slug, httpStatus: check.status ?? 200 };
      }

      await writePreview(files.desktop, desktop.buffer);
      await writePreview(files.mobile, mobile.buffer);

      updates[key] = {
        slug: previousEntry?.slug && reusable ? previousEntry.slug : slug,
        desktop: files.desktop,
        mobile: files.mobile,
        desktopSize: OUTPUT_SIZES.desktop,
        mobileSize: OUTPUT_SIZES.mobile,
        hash: newHash,
        capturedAt: now.toISOString(),
        httpStatus: check.status ?? 200,
        status: "ok",
        screenshot: true,
        source: "playwright",
      };

      return {
        ...base,
        outcome: "captured",
        slug,
        httpStatus: check.status ?? 200,
        bytes: { desktop: desktop.buffer.length, mobile: mobile.buffer.length },
      };
    } catch (error) {
      return {
        ...base,
        outcome: "error",
        httpStatus: check.status ?? null,
        error: (error instanceof Error ? error.message : String(error)).slice(0, 200),
      };
    }
  };

  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (cursor < queue.length) {
        const demo = queue[cursor];
        cursor += 1;
        results.push(await processOne(demo));
      }
    }),
  );

  const manifest = mergeManifest(previousManifest, updates, { now, prune: Boolean(options.prune) });
  return { results, summary: summarizeResults(results), updates, manifest };
}

/* ─────────────────────────── Dépendances réelles ─────────────────────────── */

async function loadDemos(options) {
  if (options.base) {
    const url = `${options.base.replace(/\/+$/, "")}/api/public/demos`;
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

  const { build } = await import("esbuild");
  const outDir = join(ROOT, ".next", "previews-capture");
  await mkdir(outDir, { recursive: true });
  const outfile = join(outDir, "content.mjs");
  await build({
    entryPoints: [join(ROOT, "src", "lib", "content.ts")],
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

async function readManifestFile(path = MANIFEST_PATH) {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function realCheckUrl(url, { timeoutMs = 20_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "NukhbaPreviewBot/1.0 (+https://nokhba.net.ly/; captures d'aperçu des réalisations)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    // Le corps n'est pas nécessaire : on libère la connexion immédiatement.
    await res.body?.cancel().catch(() => {});
    return { ok: res.ok, status: res.status };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const error = new Error(
      "Playwright n'est pas installé. Exécutez : npm i -D playwright && npx playwright install chromium",
    );
    error.code = "PLAYWRIGHT_MISSING";
    throw error;
  }
}

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default ?? mod;
  } catch {
    const error = new Error("Sharp n'est pas installé. Exécutez : npm i -D sharp");
    error.code = "SHARP_MISSING";
    throw error;
  }
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    force: false,
    prune: false,
    concurrency: 3,
    maxAgeDays: 7,
    only: null,
    base: process.env.CAPTURE_BASE_URL || "",
    timeoutMs: 20_000,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--prune") options.prune = true;
    else if (arg.startsWith("--only=")) {
      options.only = arg
        .slice("--only=".length)
        .split(",")
        .map((slug) => slug.trim())
        .filter(Boolean);
    } else if (arg.startsWith("--base=")) options.base = arg.slice("--base=".length).trim();
    else if (arg.startsWith("--concurrency=")) {
      options.concurrency = Math.max(1, Number.parseInt(arg.split("=")[1], 10) || 3);
    } else if (arg.startsWith("--max-age-days=")) {
      options.maxAgeDays = Math.max(0, Number.parseFloat(arg.split("=")[1]) || 0);
    } else if (arg === "--help" || arg === "-h") options.help = true;
  }
  return options;
}

function printHelp() {
  console.log(`
Captures d'écran des démos (Playwright + Sharp)

  --dry-run              plan seulement, aucun navigateur requis
  --force                ignore l'âge de la dernière capture
  --prune                retire du manifeste les projets disparus
  --only=slug1,slug2     limite la capture à certaines démos
  --base=URL             lit les démos de <URL>/api/public/demos (sinon
                         src/lib/content.ts)
  --concurrency=N        captures parallèles (défaut 3)
  --max-age-days=N       ne recapture pas les captures plus récentes (défaut 7)
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return 0;
  }

  console.log(`\n📸 Captures des démos${options.dryRun ? " (dry-run)" : ""}\n`);
  const demos = await loadDemos(options);
  if (!Array.isArray(demos) || demos.length === 0) {
    console.error("Aucune démo trouvée.");
    return 4;
  }

  const previousManifest = await readManifestFile();
  const deps = {
    checkUrl: realCheckUrl,
    // Un fichier disparu du dépôt ne doit jamais être annoncé « inchangé ».
    previewExists: async (relativePath) =>
      existsSync(join(ROOT, "public", relativePath.replace(/^\//, ""))),
    writePreview: async (relativePath, buffer) => {
      const target = join(ROOT, "public", relativePath.replace(/^\//, ""));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, buffer);
    },
  };

  let browser = null;
  if (!options.dryRun) {
    let playwright;
    try {
      playwright = await loadPlaywright();
    } catch (error) {
      console.error(`\n✖ ${error.message}`);
      return 3;
    }
    const sharp = await loadSharp();
    deps.convert = async (pngBuffer, size) => {
      const buffer = await sharp(pngBuffer)
        .resize(size.width, size.height, { fit: "cover", position: "top" })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      return { buffer, hash: shortHash(buffer) };
    };

    try {
      browser = await playwright.chromium.launch({ args: ["--no-sandbox"] });
    } catch (error) {
      console.error(
        `\n✖ Chromium n'a pas pu démarrer (${
          error instanceof Error ? error.message.split("\n")[0] : String(error)
        }).`,
      );
      console.error("  Exécutez : npx playwright install --with-deps chromium");
      return 3;
    }
    deps.capture = async ({ url, variant, viewport }) => {
      const context = await browser.newContext({
        viewport,
        // Mobile retina (@2x) : même mise en page 390 px, image deux fois
        // plus nette dans le cadre téléphone de la bannière principale.
        deviceScaleFactor: variant === "mobile" ? 2 : 1,
        isMobile: variant === "mobile",
        hasTouch: variant === "mobile",
        locale: "ar-LY",
        colorScheme: "light",
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 });
        await page
          .waitForLoadState("networkidle", { timeout: 8_000 })
          .catch(() => {});
        // Fige les animations et masque les bandeaux de cookies connus pour
        // obtenir une capture stable et représentative.
        await page
          .addStyleTag({
            content:
              "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;}" +
              "[id*='cookie' i],[class*='cookie' i]{display:none!important;}",
          })
          .catch(() => {});
        await page.waitForTimeout(600);
        return await page.screenshot({ type: "png", fullPage: false, animations: "disabled" });
      } finally {
        await context.close().catch(() => {});
      }
    };
  }

  let outcome;
  try {
    outcome = await captureAll({ demos, previousManifest, deps, options, now: new Date() });
  } finally {
    await browser?.close().catch(() => {});
  }

  const { results, summary, manifest } = outcome;

  if (!options.dryRun) {
    await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  await mkdir(REPORTS_DIR, { recursive: true });
  const reportPath = join(
    REPORTS_DIR,
    `demo-previews-${new Date().toISOString().slice(0, 10)}.json`,
  );
  await writeFile(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dryRun: options.dryRun,
        options: { only: options.only, force: options.force, base: options.base || null },
        summary,
        results,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  for (const result of results) {
    const icon =
      result.outcome === "captured"
        ? options.dryRun
          ? "•"
          : "✓"
        : result.outcome === "unchanged"
          ? "="
          : result.outcome === "down"
            ? "✖"
          : result.outcome === "error"
            ? "!"
            : "·";
    const detail =
      result.outcome === "captured"
        ? options.dryRun
          ? "capturerait"
          : `capturé (${Math.round(((result.bytes?.desktop ?? 0) + (result.bytes?.mobile ?? 0)) / 1024)} Ko)`
        : result.outcome === "down"
          ? `hors ligne (${result.httpStatus ?? "réseau"})${result.keptPreviousCapture ? " — capture précédente conservée" : ""}`
          : result.outcome === "error"
            ? `erreur : ${result.error}`
            : result.outcome === "unchanged"
              ? "inchangé"
              : `ignoré (${result.reason})`;
    console.log(`${icon} ${result.slug ?? result.url} — ${detail}`);
  }

  console.log(
    `\n${summary.captured} capturée(s) · ${summary.unchanged} inchangée(s) · ${summary.down} hors ligne · ${summary.error} erreur(s) · ${summary.skipped} ignorée(s)`,
  );
  console.log(`Rapport : ${reportPath}`);
  if (!options.dryRun) console.log(`Manifeste : public/previews/manifest.json`);

  if (summary.error > 0) return 1;
  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error("Captures des démos : échec inattendu", error);
      process.exitCode = 1;
    });
}
