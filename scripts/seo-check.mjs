#!/usr/bin/env node
/**
 * Garde-fou SEO & GEO (Référencement IA) automatique — exécuté en CI
 * (voir .github/workflows/seo.yml) et lançable localement après
 * `npm run build && npm run start` :
 *
 *   BASE_URL=http://localhost:3100 node scripts/seo-check.mjs
 *
 * Pour chaque URL publique listée dans le sitemap, il vérifie :
 *   - réponse HTTP 200
 *   - <title> présent, unique, longueur raisonnable
 *   - meta description présente et longueur raisonnable
 *   - canonical absolu en https
 *   - balises Open Graph (og:title, og:description, og:url) et Twitter Card
 *   - balises <link rel="alternate" type="text/markdown"> vers /llms.txt et /llms-full.txt
 *   - un seul <h1>
 *   - blocs JSON-LD tous parsables + conformité Google (FAQPage uniquement sur / et /pricing,
 *     HowTo sur /, ProfessionalService avec geo + review, CreativeWork avec offers sur /demos/[slug])
 *   - maillage interne serveur sur chaque fiche /demos/[slug]
 *   - absence de noindex accidentel sur une page indexable
 *   - aucune image sans attribut alt
 * Vérifie aussi robots.txt, sitemap.xml, llms.txt, llms-full.txt (et la présence de
 * toutes les réalisations du sitemap dans llms.txt & llms-full.txt) et le manifest.
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
  return { status: res.status, headers: res.headers, body: await res.text() };
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

  // ── Open Graph & Twitter Card ──
  if (!/<meta\s+property=["']og:title["']/i.test(html)) {
    record(page, "error", "meta og:title absente");
  }
  if (!/<meta\s+property=["']og:description["']/i.test(html)) {
    record(page, "error", "meta og:description absente");
  }
  if (!/<meta\s+name=["']twitter:card["']/i.test(html)) {
    record(page, "error", "meta twitter:card absente");
  }

  // ── Découverte IA (alternate markdown vers /llms.txt & /llms-full.txt) ──
  if (!/href=["']\/llms\.txt["']/i.test(html) || !/href=["']\/llms-full\.txt["']/i.test(html)) {
    record(page, "error", "liens alternate vers /llms.txt ou /llms-full.txt absents du <head>");
  }

  // ── Un seul H1 ──
  const h1Count = countMatches(/<h1[\s>]/gi, html);
  if (h1Count === 0) record(page, "error", "aucun <h1>");
  else if (h1Count > 1) record(page, "error", `${h1Count} balises <h1> (une seule attendue)`);

  // ── Noindex accidentel ──
  if (/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) {
    record(page, "error", "page indexable mais marquée noindex");
  }

  // ── JSON-LD valide & conformité des schémas ──
  const ldBlocks = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )];
  if (ldBlocks.length === 0) {
    record(page, "warn", "aucun bloc JSON-LD");
  }
  const parsedSchemas = [];
  for (const block of ldBlocks) {
    try {
      const parsed = JSON.parse(block[1]);
      if (Array.isArray(parsed)) parsedSchemas.push(...parsed);
      else parsedSchemas.push(parsed);
    } catch (err) {
      record(page, "error", `JSON-LD invalide : ${err.message.slice(0, 80)}`);
    }
  }

  const schemaTypes = new Set(parsedSchemas.map((s) => s && s["@type"]).filter(Boolean));
  const hasFaqSchema = schemaTypes.has("FAQPage");
  const isFaqExpected =
    page === "/" ||
    page === "/pricing" ||
    page === "/services" ||
    page === "/blog" ||
    page.startsWith("/sectors/") ||
    page.startsWith("/services/") ||
    page.startsWith("/blog/");
  if (isFaqExpected) {
    if (!hasFaqSchema) {
      record(page, "error", "schéma FAQPage attendu sur cette page mais absent");
    }
  } else if (hasFaqSchema) {
    record(page, "error", "schéma FAQPage présent sur une page sans section FAQ visible (non-conformité Google)");
  }

  if (page === "/" && !schemaTypes.has("HowTo")) {
    record(page, "error", "schéma HowTo attendu sur la page d'accueil mais absent");
  }

  const proService = parsedSchemas.find((s) => s && s["@type"] === "ProfessionalService");
  if (proService) {
    if (!proService.geo || proService.geo["@type"] !== "GeoCoordinates") {
      record(page, "error", "ProfessionalService sans coordonnées GPS (geo)");
    }
    if (!Array.isArray(proService.review) || proService.review.length === 0) {
      record(page, "error", "ProfessionalService sans avis structurés (review)");
    }
  }

  if (page.startsWith("/blog/") && page !== "/blog") {
    const post = parsedSchemas.find((s) => s && s["@type"] === "BlogPosting");
    if (!post) {
      record(page, "error", "schéma BlogPosting absent sur l'article");
    } else {
      if (!post.datePublished || !post.dateModified) {
        record(page, "error", "BlogPosting sans datePublished / dateModified");
      }
      if (!post.author || !post.publisher) {
        record(page, "error", "BlogPosting sans author / publisher");
      }
      if (!post.headline || post.headline.length < 20) {
        record(page, "warn", "BlogPosting avec headline trop courte");
      }
      if (!post.speakable) {
        record(page, "warn", "BlogPosting sans bloc speakable");
      }
    }
    if (!/id=["']article-answer["']/i.test(html)) {
      record(page, "error", "bloc de réponse directe #article-answer absent");
    }
    // Maillage interne : au moins un lien vers /services/* ou /sectors/*
    if (!/href=["']\/services\//i.test(html) && !/href=["']\/sectors\//i.test(html)) {
      record(page, "warn", "article sans lien de maillage vers /services ou /sectors");
    }
  }

  if (page.startsWith("/services/") && page !== "/services") {
    const serviceSchema = parsedSchemas.find((s) => s && s["@type"] === "Service");
    if (!serviceSchema) {
      record(page, "error", "schéma Service absent sur la page service");
    } else {
      if (!serviceSchema.offers || serviceSchema.offers["@type"] !== "Offer") {
        record(page, "error", "schéma Service sans bloc Offer tarifaire");
      }
      if (!Array.isArray(serviceSchema.areaServed) || serviceSchema.areaServed.length === 0) {
        record(page, "warn", "schéma Service sans zone desservie (areaServed)");
      }
      if (!serviceSchema.provider) {
        record(page, "warn", "schéma Service sans fournisseur (provider)");
      }
    }
    // Réponse directe « answer-first » : bloc lisible par les assistants IA
    // et ciblé par le `speakable` de la page.
    if (!/id=["']service-answer["']/i.test(html)) {
      record(page, "warn", "bloc de réponse directe #service-answer absent");
    }
  }

  if (page.startsWith("/demos/") && page !== "/demos") {
    const work = parsedSchemas.find((s) => s && s["@type"] === "CreativeWork");
    if (!work) {
      record(page, "error", "schéma CreativeWork absent sur la fiche réalisation");
    } else if (!work.offers || work.offers["@type"] !== "Offer") {
      record(page, "warn", "schéma CreativeWork sans bloc Offer tarifaire");
    }
    // Maillage interne serveur vers d'autres démos
    const internalDemoLinks = [...html.matchAll(/href=["']\/demos\/([a-z0-9-]+)["']/gi)]
      .map((m) => `/demos/${m[1]}`)
      .filter((href) => href !== page);
    if (internalDemoLinks.length === 0) {
      record(page, "error", "aucun lien de maillage interne vers d'autres réalisations dans le HTML serveur");
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
  console.log(`\n🔍 Audit SEO & Référencement IA (GEO) — ${BASE}\n`);

  // 1. Ressources globales
  const globalResources = [
    { path: "/robots.txt", mustContain: "Sitemap:" },
    { path: "/sitemap.xml", mustContain: "<loc>" },
    { path: "/llms.txt", mustContain: "/llms-full.txt" },
    { path: "/llms-full.txt", mustContain: "Complete Portfolio of Live Showcases" },
    { path: "/manifest.webmanifest", mustContain: "name" },
  ];
  const resourceBodies = new Map();
  for (const resource of globalResources) {
    try {
      const { status, body } = await fetchText(`${BASE}${resource.path}`);
      resourceBodies.set(resource.path, body);
      if (status !== 200) {
        record(resource.path, "error", `HTTP ${status}`);
      } else if (!body.includes(resource.mustContain)) {
        record(resource.path, "error", `contenu inattendu (« ${resource.mustContain} » absent)`);
      } else {
        record(resource.path, "pass", `HTTP 200`);
      }
    } catch (err) {
      record(resource.path, "error", `requête impossible : ${err.message}`);
    }
  }

  // 1b. Garde-fou CSP & iframes de démonstration (évite toute régression
  //     bloquant l'aperçu interactif des sites clients en <iframe>).
  try {
    const homeRes = await fetchText(`${BASE}/`);
    const csp = homeRes.headers.get("content-security-policy") || "";
    const frameSrcMatch = csp.match(/(?:^|;\s*)frame-src\s+([^;]+)/i);
    const frameSrc = frameSrcMatch ? frameSrcMatch[1] : "";
    if (!frameSrc.includes("'self'") || !frameSrc.includes("https:")) {
      record(
        "/",
        "error",
        `CSP frame-src bloque les démos interactives https: (« ${frameSrc || "absent"} »)`,
      );
    } else {
      record("/", "pass", "CSP frame-src autorise les sites clients en direct ('self' https:)");
    }

    const localDemo = await fetchText(`${BASE}/live-demos/tulin-magazin/index.html`);
    const localXfo = (localDemo.headers.get("x-frame-options") || "").toUpperCase();
    const localCsp = localDemo.headers.get("content-security-policy") || "";
    if (localDemo.status !== 200) {
      record("/live-demos/tulin-magazin/index.html", "error", `HTTP ${localDemo.status}`);
    } else if (localXfo === "DENY" || /frame-ancestors\s+'none'/i.test(localCsp)) {
      record(
        "/live-demos/tulin-magazin/index.html",
        "error",
        `démo locale bloquée en iframe (X-Frame-Options=${localXfo || "none"})`,
      );
    } else {
      record("/live-demos/tulin-magazin/index.html", "pass", "démo locale embarquable en iframe");
    }
  } catch (err) {
    record("CSP/iframes", "error", `vérification impossible : ${err.message}`);
  }

  // 2. URLs du sitemap
  let paths = [];
  try {
    const body = resourceBodies.get("/sitemap.xml") || (await fetchText(`${BASE}/sitemap.xml`)).body;
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

  // Vérifie que chaque réalisation du sitemap est bien synchronisée dans /llms.txt et /llms-full.txt
  const llmsBody = resourceBodies.get("/llms.txt") || "";
  const llmsFullBody = resourceBodies.get("/llms-full.txt") || "";
  for (const pathname of paths) {
    const mustBeInLlms =
      (pathname.startsWith("/demos/") && pathname !== "/demos") ||
      (pathname.startsWith("/services/") && pathname !== "/services") ||
      (pathname.startsWith("/blog/") && pathname !== "/blog");
    if (mustBeInLlms) {
      if (!llmsBody.includes(pathname)) {
        record("/llms.txt", "error", `page ${pathname} absente de /llms.txt`);
      }
      if (!llmsFullBody.includes(pathname)) {
        record("/llms-full.txt", "error", `page ${pathname} absente de /llms-full.txt`);
      }
    }
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
    console.log("❌ Audit SEO & GEO échoué — corrigez les erreurs ci-dessus.");
    process.exit(1);
  }
  console.log("✅ Audit SEO & GEO réussi.");
}

main().catch((err) => {
  console.error("Erreur du script seo-check :", err);
  process.exit(1);
});
