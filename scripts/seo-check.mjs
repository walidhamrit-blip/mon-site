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
 *   - blocs JSON-LD tous parsables + conformité Google (FAQPage sur les pages avec FAQ visible,
 *     HowTo sur /creation-sites, ProfessionalService avec geo, CreativeWork avec offers sur /demos/[slug])
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

/** Texte visible approximatif (scripts, styles et balises retirés). */
function visibleText(html) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "manual" });
  return { status: res.status, headers: res.headers, body: await res.text() };
}

function checkPage(pathname, html) {
  const page = pathname || "/";
  let title = "";

  // ── Title ──
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) {
    record(page, "error", "balise <title> absente");
  } else {
    title = decode(titleMatch[1].trim());
    if (title.length < 20) record(page, "warn", `title très court (${title.length} car.) : ${title}`);
    // Google coupe autour de 60 caractères (≈600 px). Un titre plus long
    // perd sa fin — souvent le mot-clé ou la ville. `serpTitle()` borne tous
    // les titres du site à 60 : dépasser ici signale une page qui contourne
    // le gabarit.
    if (title.length > 60) {
      record(page, "error", `title trop long (${title.length} car., max 60) : ${title}`);
    }
    // Marque citée deux fois (« … — Nukhba | Nukhba نخبة ») : gaspillage de
    // la largeur d'affichage et signal de duplication.
    const brandHits = (title.match(/nukhba|نخبة/gi) || []).length;
    if (brandHits > 1) {
      record(page, "error", `marque répétée ${brandHits}× dans le title : ${title}`);
    }
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
    if (len > 160) record(page, "warn", `description longue (${len} car., max conseillé 160)`);
  }

  // ── Canonical ──
  const canonicalMatch = html.match(
    /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i,
  );
  if (!canonicalMatch) {
    record(page, "error", "balise canonical absente");
  } else if (!/^https:\/\//.test(canonicalMatch[1])) {
    record(page, "error", `canonical non absolu/https : ${canonicalMatch[1]}`);
  } else {
    // La canonique doit désigner LA page testée, pas une autre URL du site.
    try {
      const canonicalPath = new URL(canonicalMatch[1]).pathname.replace(/\/+$/, "") || "/";
      const expected = page === "/" ? "/" : page.replace(/\/+$/, "");
      if (canonicalPath !== expected) {
        record(page, "error", `canonical incohérente (${canonicalPath}) pour ${expected}`);
      }
    } catch {
      record(page, "error", `canonical illisible : ${canonicalMatch[1]}`);
    }
  }

  // ── Langue du document vs métadonnées ──
  const langMatch = html.match(/<html[^>]*\slang=["']([^"']+)["']/i);
  const lang = langMatch ? langMatch[1].toLowerCase().slice(0, 2) : "";
  if (!lang || (lang !== "ar" && lang !== "en")) {
    record(page, "error", `<html lang> absent ou invalide (« ${lang || "?"} »)`);
  }
  const ogLocaleMatch = html.match(
    /<meta\s+property=["']og:locale["']\s+content=["']([^"']+)["']/i,
  );
  if (ogLocaleMatch && ogLocaleMatch[1].toLowerCase().slice(0, 2) !== lang) {
    record(
      page,
      "error",
      `og:locale (${ogLocaleMatch[1]}) ne correspond pas à <html lang="${lang}">`,
    );
  }
  // Le vocabulaire du titre doit être celui de la page : un titre arabe sur
  // un document déclaré en anglais (et inversement) est le symptôme exact
  // du mélange de langues relevé dans l'audit.
  const ARABIC = /[\u0600-\u06FF]/;
  const titleLang = ARABIC.test(title) ? "ar" : "en";
  if (lang && titleLang !== lang) {
    record(page, "error", `title en « ${titleLang} » sur un document lang="${lang}"`);
  }
  // La description doit elle aussi être dans la langue du document : une
  // meta arabe sur une page anglaise (ou l'inverse) est un signal de
  // duplication/mauvaise langue, très courant après un changement de
  // langue par défaut.
  const description = (html.match(
    /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i,
  ) || [])[1];
  if (description && lang) {
    const descLang = ARABIC.test(description) ? "ar" : "en";
    if (descLang !== lang) {
      record(page, "error", `description en « ${descLang} » sur un document lang="${lang}"`);
    }
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
    page === "/creation-sites" ||
    page === "/services" ||
    page === "/blog" ||
    page === "/compare" ||
    page === "/abonnements" ||
    page === "/codes" ||
    page.startsWith("/sectors/") ||
    page.startsWith("/services/") ||
    page.startsWith("/blog/") ||
    page.startsWith("/compare/") ||
    page.startsWith("/codes/");
  if (isFaqExpected) {
    if (!hasFaqSchema) {
      record(page, "error", "schéma FAQPage attendu sur cette page mais absent");
    }
  } else if (hasFaqSchema) {
    record(page, "error", "schéma FAQPage présent sur une page sans section FAQ visible (non-conformité Google)");
  }

  if (page === "/creation-sites" && !schemaTypes.has("HowTo")) {
    record(page, "error", "schéma HowTo attendu sur la page création de sites mais absent");
  }

  const proService = parsedSchemas.find((s) => s && s["@type"] === "ProfessionalService");
  if (proService) {
    if (!proService.geo || proService.geo["@type"] !== "GeoCoordinates") {
      record(page, "error", "ProfessionalService sans coordonnées GPS (geo)");
    }
    // Depuis 2019, Google n'affiche pas les avis « auto-déclarés » d'une
    // entreprise sur sa propre page. Les baliser n'apporte aucun rich
    // result et expose à un signalement pour données structurées trompeuses.
    // On signale donc leur présence comme une dette, pas comme un manque.
    if (
      proService.aggregateRating ||
      (Array.isArray(proService.review) && proService.review.length > 0)
    ) {
      record(
        page,
        "warn",
        "avis auto-déclarés dans ProfessionalService (non éligibles Google — utiliser une fiche Google Business Profile)",
      );
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

  if (page.startsWith("/compare/") && page !== "/compare") {
    // Page comparative : schéma Service + Offer (notre prix) et réponse
    // directe lisible par les assistants IA.
    const comparisonSchema = parsedSchemas.find((s) => s && s["@type"] === "Service");
    if (!comparisonSchema) {
      record(page, "error", "schéma Service absent sur la page comparative");
    } else {
      if (!comparisonSchema.offers || comparisonSchema.offers["@type"] !== "Offer") {
        record(page, "error", "schéma Service sans bloc Offer tarifaire (comparatif)");
      }
      if (!comparisonSchema.provider) {
        record(page, "warn", "schéma Service sans fournisseur (provider) — comparatif");
      }
    }
    if (!parsedSchemas.some((s) => s && s["@type"] === "ItemList")) {
      record(page, "warn", "comparatif sans ItemList des critères comparés");
    }
    if (!/id=[\"']compare-answer[\"']/i.test(html)) {
      record(page, "warn", "bloc de réponse directe #compare-answer absent");
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

  // ── Fiches produits du catalogue digital ──
  if (page.startsWith("/codes/") && page !== "/codes" && !page.startsWith("/codes/commande")) {
    const product = parsedSchemas.find((s) => s && s["@type"] === "Product");
    if (!product) {
      record(page, "error", "schéma Product absent sur la fiche produit");
    } else {
      if (!product.image) {
        record(page, "error", "schéma Product sans image (vignette SERP impossible)");
      }
      if (!product.sku) {
        record(page, "warn", "schéma Product sans sku");
      }
      if (product.offers && !product.offers.priceCurrency) {
        record(page, "error", "offres Product sans priceCurrency");
      }
    }
    if (!hasFaqSchema) {
      record(page, "error", "FAQPage attendue sur la fiche produit (région, livraison, paiement)");
    }
    const words = visibleText(html).split(/\s+/).filter(Boolean).length;
    if (words < 400) {
      record(page, "warn", `fiche produit mince (${words} mots, min conseillé 400)`);
    }
    // Maillage de retour : une fiche produit doit ramener vers le rayon,
    // sinon les pages profondes n'irriguent plus le hub.
    if (!/href=["']\/codes["']/.test(html)) {
      record(page, "error", "aucun lien de retour vers /codes depuis la fiche produit");
    }
  }

  // ── Hub boutique ──
  if (page === "/codes") {
    if (!parsedSchemas.some((s) => s && s["@type"] === "Store")) {
      record(page, "error", "schéma Store absent du hub /codes");
    }
    // L'ItemList des produits est imbriqué dans `mainEntity` du
    // CollectionPage : on inspecte donc récursivement le JSON-LD.
    const hasItemList = parsedSchemas.some((schema) => {
      let found = false;
      const walk = (node) => {
        if (found || !node || typeof node !== "object") return;
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (node["@type"] === "ItemList") found = true;
        Object.values(node).forEach(walk);
      };
      walk(schema);
      return found;
    });
    if (!hasItemList) {
      record(page, "error", "ItemList des produits absent du hub /codes");
    }
    const words = visibleText(html).split(/\s+/).filter(Boolean).length;
    if (words < 650) {
      record(page, "warn", `hub boutique mince (${words} mots, min conseillé 650)`);
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

  // 1a. Sitemap d'images : les captures locales (public/previews) doivent
  //     être publiées pour les réalisations — signal d'image pour Google.
  try {
    const sitemapBody =
      resourceBodies.get("/sitemap.xml") || (await fetchText(`${BASE}/sitemap.xml`)).body;
    const imageLocs = [...sitemapBody.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map(
      (match) => match[1].trim(),
    );
    const localPreviews = imageLocs.filter((url) => /\/previews\/[a-z0-9-]+\.webp$/i.test(url));
    if (imageLocs.length === 0) {
      record("/sitemap.xml", "warn", "aucune image déclarée dans le sitemap");
    } else if (localPreviews.length === 0) {
      record(
        "/sitemap.xml",
        "warn",
        "aucune capture locale /previews/*.webp dans le sitemap d'images",
      );
    } else {
      record(
        "/sitemap.xml",
        "pass",
        `${localPreviews.length} capture(s) locale(s) dans le sitemap d'images`,
      );
    }
  } catch (err) {
    record("/sitemap.xml", "warn", `images non vérifiées : ${err.message}`);
  }

  // 1a bis. Dates `lastmod` : une date identique sur tout le sitemap signifie
  // « build date », pas « contenu modifié ». Google cesse alors de s'y fier.
  try {
    const sitemapBody =
      resourceBodies.get("/sitemap.xml") || (await fetchText(`${BASE}/sitemap.xml`)).body;
    const lastmods = [...sitemapBody.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(
      (match) => match[1].trim(),
    );
    const future = lastmods.filter((value) => {
      const time = Date.parse(value);
      return Number.isFinite(time) && time > Date.now() + 86_400_000;
    });
    if (future.length > 0) {
      record("/sitemap.xml", "error", `${future.length} lastmod dans le futur`);
    }
    if (lastmods.length >= 10) {
      const counts = new Map();
      for (const value of lastmods) {
        const day = value.slice(0, 10);
        counts.set(day, (counts.get(day) ?? 0) + 1);
      }
      const mostCommon = Math.max(...counts.values());
      if (mostCommon / lastmods.length > 0.8) {
        record(
          "/sitemap.xml",
          "warn",
          `${mostCommon}/${lastmods.length} lastmod identiques (date de build, pas de contenu)`,
        );
      }
    }
  } catch (err) {
    record("/sitemap.xml", "warn", `lastmod non vérifiés : ${err.message}`);
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

  // 2a. Badge de netlinking client : la page /badge doit être publiée, citer le
  //     lien de crédit et servir ses propres assets. Sans elle, les sites
  //     clients n'ont aucune source officielle où copier le badge.
  try {
    if (!paths.includes("/badge")) {
      record("/badge", "error", "page /badge absente du sitemap");
    }
    const { status, body } = await fetchText(`${BASE}/badge`);
    if (status !== 200) {
      record("/badge", "error", `HTTP ${status}`);
    } else if (!/https:\/\/nokhba\.net\.ly\/\?utm_source=client_footer/.test(body)) {
      record("/badge", "error", "lien de crédit (utm_source=client_footer) absent de la page");
    } else if (!/nukhba-badge(-light)?\.svg/.test(body)) {
      record("/badge", "warn", "asset du badge non référencé sur /badge");
    } else {
      record("/badge", "pass", "page badge et extrait de crédit publiés");
    }
    for (const asset of ["/badge/nukhba-badge.svg", "/badge/nukhba-badge-light.svg"]) {
      const res = await fetchText(`${BASE}${asset}`);
      if (res.status !== 200) record(asset, "error", `HTTP ${res.status}`);
      else if (!/^<svg[\s>]/i.test(res.body.trim())) {
        record(asset, "error", "le fichier servi n'est pas un SVG");
      } else {
        record(asset, "pass", `SVG servi (${res.body.length} octets)`);
      }
    }
  } catch (err) {
    record("/badge", "error", `badge non vérifié : ${err.message}`);
  }

  // Vérifie que chaque réalisation du sitemap est bien synchronisée dans /llms.txt et /llms-full.txt
  const llmsBody = resourceBodies.get("/llms.txt") || "";
  const llmsFullBody = resourceBodies.get("/llms-full.txt") || "";
  for (const pathname of paths) {
    const mustBeInLlms =
      (pathname.startsWith("/demos/") && pathname !== "/demos") ||
      (pathname.startsWith("/services/") && pathname !== "/services") ||
      (pathname.startsWith("/blog/") && pathname !== "/blog") ||
      (pathname.startsWith("/compare/") && pathname !== "/compare");
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
