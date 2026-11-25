#!/usr/bin/env node
/**
 * Notification automatique post-déploiement des moteurs de recherche & IA :
 * - Détecte les pages publiques impactées par un commit sur `main`
 * - Préchauffe le cache Vercel de ces URLs
 * - Notifie IndexNow (Bing, Yandex, Naver, Seznam, ChatGPT Search)
 * - Inspecte / signale les URLs modifiées + sitemap.xml auprès de Google Search Console
 */

import { execFileSync } from "node:child_process";
import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_INDEXNOW_KEY = "496dc8c7fd1cb72cb39630115e74bdde";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const WEBMASTERS_SCOPE = "https://www.googleapis.com/auth/webmasters";

const PRIORITY_PATHS = [
  "/",
  "/pricing",
  "/contact",
  "/abonnements",
  "/creation-sites",
  "/codes",
  "/demos",
  "/demos/pizzeria-forno-tripoli",
  "/demos/al-manhaj-company",
  "/demos/toy-store-tripoly",
  "/services",
  "/sectors",
  "/blog",
];

export function mapChangedFilesToPaths(files, autopilotState = null) {
  const paths = new Set();
  let seoTouched = false;

  for (const rawFile of files) {
    const file = String(rawFile ?? "").trim();
    if (!file) continue;

    if (file === "src/app/sitemap.ts" || file.startsWith("src/lib/seo")) {
      seoTouched = true;
    }

    const appRouteMatch = file.match(/^src\/app\/\(site\)\/(.+)\/page\.tsx$/);
    if (appRouteMatch) {
      const segment = appRouteMatch[1];
      if (!segment.includes("[")) {
        paths.add(`/${segment}`);
        seoTouched = true;
      }
    } else if (file === "src/app/(site)/page.tsx") {
      paths.add("/");
      seoTouched = true;
    }

    if (file === "src/lib/content.ts") {
      paths.add("/");
      paths.add("/demos");
      paths.add("/pricing");
      seoTouched = true;
    }
    if (file === "src/lib/blog-articles.ts") {
      paths.add("/blog");
      seoTouched = true;
    }
    if (file === "src/lib/sectors.ts") {
      paths.add("/sectors");
      seoTouched = true;
    }
    if (file === "src/lib/comparisons.ts") {
      paths.add("/compare");
      seoTouched = true;
    }
    if (file === "src/lib/digital-seo.ts" || file === "src/lib/digital-categories.ts") {
      paths.add("/codes");
      seoTouched = true;
    }
    if (file === "src/lib/seo-autopilot-data.ts" && autopilotState?.overrides) {
      seoTouched = true;
      for (const p of Object.keys(autopilotState.overrides)) {
        paths.add(p);
      }
    }
  }

  return { paths: [...paths], seoTouched };
}

export function buildLocalizedUrlBatch(baseUrl, paths) {
  const origin = String(baseUrl).trim().replace(/\/+$/, "");
  const urls = new Set();
  for (const rawPath of paths) {
    const clean = rawPath === "/" ? "/" : `/${String(rawPath).replace(/^\/+|\/+$/g, "")}`;
    urls.add(`${origin}${clean}`);
    urls.add(clean === "/" ? `${origin}/?lang=en` : `${origin}${clean}?lang=en`);
  }
  urls.add(`${origin}/sitemap.xml`);
  urls.add(`${origin}/llms.txt`);
  return [...urls];
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function getGoogleAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: WEBMASTERS_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${base64url(signer.sign(privateKey))}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth Google ${res.status}`);
  }
  return data.access_token;
}

async function warmProductionUrls(urls) {
  let okCount = 0;
  for (const url of urls.slice(0, 24)) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Nukhba-SEO-Autopilot/1.0", "Cache-Control": "no-cache" },
      });
      if (res.ok) okCount += 1;
    } catch {
      // ignore network hiccup on warmup
    }
  }
  return okCount;
}

async function submitIndexNow(baseUrl, urls) {
  const origin = baseUrl.replace(/\/+$/, "");
  const host = new URL(origin).host;
  const key = process.env.INDEXNOW_KEY?.trim() || DEFAULT_INDEXNOW_KEY;
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `${origin}/${key}.txt`,
      urlList: urls,
    }),
  });
  return { ok: res.ok || res.status === 202, status: res.status };
}

async function notifyGoogleChanges(baseUrl, canonicalUrls) {
  const email = process.env.GOOGLE_INDEXING_CLIENT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_INDEXING_PRIVATE_KEY?.trim();
  if (!email || !rawKey) return { status: "skipped_unconfigured" };

  const privateKey = rawKey.replace(/\\n/g, "\n");
  const accessToken = await getGoogleAccessToken(email, privateKey);
  const origin = baseUrl.replace(/\/+$/, "");
  const siteOverride = process.env.GOOGLE_INDEXING_SITE_URL?.trim();
  const property = siteOverride
    ? siteOverride.startsWith("sc-domain:")
      ? siteOverride
      : `${siteOverride.replace(/\/+$/, "")}/`
    : `${origin}/`;
  const sitemapUrl = `${origin}/sitemap.xml`;

  // 1. Ping sitemap Google Search Console
  const smEndpoint =
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}` +
    `/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  const smRes = await fetch(smEndpoint, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 2. Inspection API sur les URLs canoniques modifiées (jusqu'à 8 URLs)
  let inspected = 0;
  for (const inspectionUrl of canonicalUrls.slice(0, 8)) {
    try {
      const inspRes = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inspectionUrl,
          siteUrl: property,
          languageCode: "ar",
        }),
      });
      if (inspRes.ok) inspected += 1;
    } catch {
      // non bloquant
    }
  }

  return {
    status: smRes.ok ? "submitted" : `http_${smRes.status}`,
    inspectedUrls: inspected,
  };
}

function readChangedFilesFromGit(beforeSha, afterSha) {
  if (!beforeSha || /^0+$/.test(beforeSha) || !afterSha) return [];
  try {
    const out = execFileSync("git", ["diff", "--name-only", beforeSha, afterSha], {
      encoding: "utf8",
    });
    return out.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  let beforeSha = "";
  let afterSha = "";
  let forcePriority = false;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--before") beforeSha = args[++i] || "";
    else if (args[i] === "--after") afterSha = args[++i] || "";
    else if (args[i] === "--all-priority") forcePriority = true;
  }

  const baseUrl = (process.env.SITE_URL || "https://nokhba.net.ly").trim().replace(/\/+$/, "");
  let autopilotState = null;
  const autopilotFile = resolve(process.cwd(), "src/lib/seo-autopilot-data.ts");
  if (existsSync(autopilotFile)) {
    const src = readFileSync(autopilotFile, "utf8");
    const match = src.match(/SEO_AUTOPILOT_STATE:\s*SeoAutopilotState\s*=\s*(\{[\s\S]*\});\s*$/);
    if (match) autopilotState = JSON.parse(match[1]);
  }

  let targetPaths = [];
  if (forcePriority) {
    targetPaths = [...PRIORITY_PATHS];
  } else {
    const files = readChangedFilesFromGit(beforeSha, afterSha);
    const mapped = mapChangedFilesToPaths(files, autopilotState);
    if (!mapped.seoTouched && mapped.paths.length === 0) {
      console.log("ℹ️ Aucun fichier public/SEO modifié sur ce commit — aucun ping nécessaire.");
      return;
    }
    targetPaths = mapped.paths.length > 0 ? mapped.paths : ["/", "/pricing", "/contact"];
  }

  const urls = buildLocalizedUrlBatch(baseUrl, targetPaths);
  const canonicalUrls = targetPaths.map((p) => `${baseUrl}${p === "/" ? "/" : p}`);

  const warmed = await warmProductionUrls(urls);
  console.log(`🔥 Cache préchauffé : ${warmed}/${Math.min(urls.length, 24)} URL(s).`);

  try {
    const indexNow = await submitIndexNow(baseUrl, urls);
    console.log(`📡 IndexNow (${urls.length} URLs) : ok=${indexNow.ok} (HTTP ${indexNow.status})`);
  } catch (err) {
    console.warn("⚠️ IndexNow ignoré :", err instanceof Error ? err.message : err);
  }

  try {
    const gsc = await notifyGoogleChanges(baseUrl, canonicalUrls);
    console.log(`🔎 Google Search Console : sitemap=${gsc.status}, inspectées=${gsc.inspectedUrls ?? 0}`);
  } catch (err) {
    console.warn("⚠️ Google Search Console ignoré :", err instanceof Error ? err.message : err);
  }
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error("❌ Erreur seo-index-ping :", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
