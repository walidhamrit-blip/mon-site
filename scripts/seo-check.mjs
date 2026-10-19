#!/usr/bin/env node
/**
 * Garde-fou SEO automatique — exécuté en CI (voir .github/workflows/seo.yml)
 * et lançable localement après `npm run build && npm run start` :
 *
 *   BASE_URL=http://localhost:3100 node scripts/seo-check.mjs
 *
 * Pour chaque URL publique listée dans le sitemap, il vérifie :
 *   - réponse HTTP 200
 *   - <title> présent, unique, longueur raisonnable
 *   - meta description présente et longueur raisonnable
 *   - canonical absolu en https
 *   - un seul <h1>
 *   - blocs JSON-LD tous parsables
 *   - absence de noindex accidentel sur une page indexable
 *   - aucune image sans attribut alt
 * Vérifie aussi robots.txt, sitemap.xml, llms.txt et le manifest.
 *
 * Code de sortie 1 si au moins une erreur bloquante (les warnings ne font
 * pas échouer la CI).
 */

const BASE = (process.env.BASE_URL || "http://localhost:3100").replace(/\/+$/, "");

const results = [];
const titles = new Map();

function record(page, level, message) {
  results.push({ page, level, message });
}

function decode(entities) {
  return entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function countMatches(regex, html) {
  return [...html.matchAll(regex)].length;
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "manual" });
  return { status: res.status, body: await res.text() };
}

function checkPage(pathname, html) {
  const page = pathname || "/";

  // ── Title ──
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) {
    record(page, "error", "balise <title> absente");
  } else {
    const title = decode(titleMatch[1].trim());
    if (title.length < 20) record(page, "warn", `title très court (${title.length} car.) : ${title}`);
    // Le seuil haut remonte à 80 car. : les titres arabes sont plus compacts
    // en largeur de pixels et le suffixe de marque (« | نخبة Nukhba ») s'ajoute.
    if (title.length > 80) record(page, "warn", `title trop long (${title.length} car., max conseillé 80)`);
    if (titles.has(title)) record(page, "error", `title dupliqué avec ${titles.get(title)}`);
    titles.set(title, page);
  }

  // ── Description ──
  const descMatch = html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i,
  );
  if (!descMatch || !descMatch[1].trim()) {
    record(page, "error", "meta description absente ou vide");
  } else {
    const len = descMatch[1].trim().length;
    if (len < 50) record(page, "warn", `description courte (${len} car., min conseillé 50)`);
    if (len > 180) record(page, "warn", `description longue (${len} car., max conseillé 180)`);
  }

  // ── Canonical ──
  const canonicalMatch = html.match(
    /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i,
  );
  if (!canonicalMatch) {
    record(page, "error", "balise canonical absente");
  } else if (!/^https:\/\//.test(canonicalMatch[1])) {
    record(page, "error", `canonical non absolu/https : ${canonicalMatch[1]}`);
  }

  // ── Un seul H1 ──
  const h1Count = countMatches(/<h1[\s>]/gi, html);
  if (h1Count === 0) record(page, "error", "aucun <h1>");
  else if (h1Count > 1) record(page, "error", `${h1Count} balises <h1> (une seule attendue)`);

  // ── Noindex accidentel ──
  if (/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) {
    record(page, "error", "page indexable mais marquée noindex");
  }

  // ── JSON-LD valide ──
  const ldBlocks = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )];
  if (ldBlocks.length === 0) {
    record(page, "warn", "aucun bloc JSON-LD");
  }
  for (const block of ldBlocks) {
    try {
      JSON.parse(block[1]);
    } catch (err) {
      record(page, "error", `JSON-LD invalide : ${err.message.slice(0, 80)}`);
    }
  }

  // ── Images sans alt ──
  const imgs = [...html.matchAll(/<img\s[^>]*>/gi)].map((m) => m[0]);
  for (const img of imgs) {
    if (!/\salt\s*=/i.test(img)) {
      record(page, "error", `image sans attribut alt : ${img.slice(0, 100)}`);
    }
  }
}

async function main() {
  console.log(`\n🔍 Audit SEO — ${BASE}\n`);

  // 1. Ressources globales
  const globalResources = [
    { path: "/robots.txt", mustContain: "Sitemap:" },
    { path: "/sitemap.xml", mustContain: "<loc>" },
    { path: "/llms.txt", mustContain: "#" },
    { path: "/manifest.webmanifest", mustContain: "name" },
  ];
  for (const resource of globalResources) {
    try {
      const { status, body } = await fetchText(`${BASE}${resource.path}`);
      if (status !== 200) {
        record(resource.path, "error", `HTTP ${status}`);
      } else if (!body.includes(resource.mustContain)) {
        record(resource.path, "warn", `contenu inattendu (« ${resource.mustContain} » absent)`);
      } else {
        record(resource.path, "pass", `HTTP 200`);
      }
    } catch (err) {
      record(resource.path, "error", `requête impossible : ${err.message}`);
    }
  }

  // 2. URLs du sitemap
  let paths = [];
  try {
    const { body } = await fetchText(`${BASE}/sitemap.xml`);
    const urls = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    // Le sitemap contient les URLs canoniques (domaine de production) : on
    // n'extrait que le chemin pour le tester contre le serveur courant,
    // quel que soit son hôte (local, preview CI, production).
    paths = urls.map((u) => {
      try {
        return new URL(u).pathname || "/";
      } catch {
        return u;
      }
    });
  } catch (err) {
    record("sitemap.xml", "error", `lecture impossible : ${err.message}`);
  }

  if (paths.length === 0) {
    record("sitemap.xml", "error", "aucune URL découverte dans le sitemap");
  }

  for (const pathname of paths) {
    try {
      const { status, body } = await fetchText(`${BASE}${pathname}`);
      if (status !== 200) {
        record(pathname, "error", `HTTP ${status}`);
        continue;
      }
      checkPage(pathname, body);
      record(pathname, "pass", "vérifications de page OK");
    } catch (err) {
      record(pathname, "error", `requête impossible : ${err.message}`);
    }
  }

  // 3. Bilan
  const errors = results.filter((r) => r.level === "error");
  const warnings = results.filter((r) => r.level === "warn");
  const passes = results.filter((r) => r.level === "pass");

  for (const r of results) {
    if (r.level === "pass") continue; // détail : seulement warnings + erreurs
    const icon = r.level === "error" ? "✖" : "⚠";
    console.log(`${icon}  [${r.level.toUpperCase()}] ${r.page} — ${r.message}`);
  }

  console.log(`\n${passes.length} pages/ressources validées · ${warnings.length} avertissement(s) · ${errors.length} erreur(s)\n`);

  if (errors.length > 0) {
    console.log("❌ Audit SEO échoué — corrigez les erreurs ci-dessus.");
    process.exit(1);
  }
  console.log("✅ Audit SEO réussi.");
}

main().catch((err) => {
  console.error("Erreur du script seo-check :", err);
  process.exit(1);
});
