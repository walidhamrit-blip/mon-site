#!/usr/bin/env node
/**
 * Audit du catalogue digital (/codes et ses fiches) — `node scripts/catalog-audit.mjs`.
 *
 * Contrôle, produit par produit :
 *   - la fiche répond 200 et est liée depuis la boutique ;
 *   - elle est présente dans le sitemap.xml (donc soumise aux moteurs) ;
 *   - titre, description, canonique, Open Graph et JSON-LD (Product + offre
 *     avec prix et disponibilité) sont complets ;
 *   - le prix et la région sont affichés dans la page ;
 *   - la langue du titre, de la description et du H1 correspond à celle du
 *     document (`<html lang>`) — l'invariant n'est plus « tout en anglais » :
 *     le site sert l'arabe à son marché principal (Libye), et une fiche
 *     anglaise sur un document arabe (ou l'inverse) reste une erreur.
 *
 * Usage : `BASE_URL=http://localhost:3100 npm run audit:catalog`
 * (par défaut : http://localhost:3100)
 */
import { readFileSync } from "node:fs";

const BASE = (process.env.BASE_URL || "http://localhost:3100").replace(/\/+$/, "");
const AR = /[\u0600-\u06FF]/;

const issues = [];
const note = (scope, message) => issues.push(`${scope} — ${message}`);

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "user-agent": "nukhba-catalog-audit" },
  });
  const body = await res.text();
  return { status: res.status, body, headers: res.headers };
}

const pick = (html, re) => html.match(re)?.[1]?.trim() ?? null;

// ── 1. La boutique ────────────────────────────────────────────────────────
const shop = await get("/codes");
if (shop.status !== 200) {
  note("/codes", `HTTP ${shop.status}`);
} else {
  const links = [
    ...new Set(
      [...shop.body.matchAll(/href="\/codes\/([a-z0-9][a-z0-9-]*)"/g)].map((m) => m[1]),
    ),
  ];
  const jsonLd = [...shop.body.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .join("\n");
  const itemList = jsonLd.match(/"@type":"ItemList"[\s\S]*?"numberOfItems":(\d+)/);
  if (!itemList) {
    note("/codes", "JSON-LD ItemList absent ou sans numberOfItems");
  } else if (Number(itemList[1]) !== links.length) {
    note(
      "/codes",
      `JSON-LD annonce ${itemList[1]} produits alors que la page en liste ${links.length}`,
    );
  }
  console.log(`Boutique /codes : ${links.length} produits (HTTP ${shop.status})`);

  // ── 2. Le sitemap ───────────────────────────────────────────────────────
  const sitemap = await get("/sitemap.xml");
  const sitemapUrls = [
    ...[...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]),
  ];
  const sitemapPaths = new Set(
    sitemapUrls.map((u) => {
      try {
        return new URL(u).pathname;
      } catch {
        return u;
      }
    }),
  );
  if (!sitemapPaths.has("/codes")) {
    note("/sitemap.xml", "/codes absent du sitemap");
  }

  // ── 3. Chaque fiche ─────────────────────────────────────────────────────
  let checked = 0;
  for (const slug of links) {
    const path = `/codes/${slug}`;
    const page = await get(path);
    const scope = path;
    if (page.status !== 200) {
      note(scope, `HTTP ${page.status}`);
      continue;
    }
    checked += 1;

    const title = pick(page.body, /<title>([^<]*)<\/title>/);
    const description = pick(
      page.body,
      /<meta name="description" content="([^"]*)"/,
    );
    const canonical = pick(page.body, /<link rel="canonical" href="([^"]*)"/);
    const ogTitle = pick(page.body, /<meta property="og:title" content="([^"]*)"/);
    const ogDescription = pick(
      page.body,
      /<meta property="og:description" content="([^"]*)"/,
    );
    const h1 = pick(page.body, /<h1[^>]*>([\s\S]*?)<\/h1>/);

    if (!title) note(scope, "titre manquant");
    else if (title.length > 60) note(scope, `titre trop long (${title.length} car., max 60)`);
    if (!description) note(scope, "meta description manquante");
    else if (description.length > 160)
      note(scope, `description trop longue (${description.length} car., max 160)`);
    if (!canonical) note(scope, "canonique manquante");
    else if (!canonical.includes(path)) note(scope, `canonique inattendue : ${canonical}`);
    if (!ogTitle) note(scope, "og:title manquant");
    if (!ogDescription) note(scope, "og:description manquant");
    if (!h1) note(scope, "h1 manquant");

    // JSON-LD Product + offre chiffrée
    const ld = [
      ...page.body.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g),
    ]
      .map((m) => m[1])
      .join("\n");
    if (!/"@type":"Product"/.test(ld)) note(scope, "JSON-LD Product absent");
    if (!/"lowPrice"/.test(ld)) note(scope, "JSON-LD sans prix (lowPrice)");
    if (!/"availability"/.test(ld)) note(scope, "JSON-LD sans disponibilité");

    // Prix et région affichés
    if (!/\$\s?\d/.test(page.body)) note(scope, "aucun prix affiché");
    if (!/region/i.test(page.body)) note(scope, "région non mentionnée");

    // Fiche présente dans le sitemap
    if (!sitemapPaths.has(path)) note(scope, "absente du sitemap.xml");

    // Cohérence de langue : les métadonnées doivent parler la langue du
    // document. Le nom de marque « Nukhba نخبة » est bilingue par
    // convention (suffixe du gabarit de titre) : il est retiré avant le
    // contrôle.
    const lang = pick(page.body, /<html[^>]*\slang=["']([^"']+)["']/i)?.slice(0, 2) ?? "";
    const strip = (value) => value.replaceAll("Nukhba نخبة", "").replaceAll("نخبة", "").trim();
    const h1Text = h1 ? strip(h1.replace(/<[^>]+>/g, "")) : null;
    if (lang === "en") {
      if (title && AR.test(strip(title))) note(scope, `titre en arabe sur un document anglais : ${strip(title)}`);
      if (description && AR.test(description))
        note(scope, `description en arabe sur un document anglais : ${description.slice(0, 60)}…`);
      if (h1Text && AR.test(h1Text)) note(scope, `h1 en arabe sur un document anglais : ${h1Text.slice(0, 60)}`);
    } else if (lang === "ar") {
      // Un document arabe sans un seul caractère arabe dans son titre est le
      // symptôme d'une page restée en anglais après un changement de langue.
      if (title && !AR.test(title)) note(scope, `titre sans arabe sur un document arabe : ${title}`);
      if (description && !AR.test(description))
        note(scope, `description sans arabe sur un document arabe : ${description.slice(0, 60)}…`);
    } else {
      note(scope, "<html lang> absent");
    }
  }
  console.log(`Fiches contrôlées : ${checked}/${links.length}`);
}

// ── 4. Verdict ────────────────────────────────────────────────────────────
if (issues.length > 0) {
  console.error(`\n❌ ${issues.length} problème(s) :`);
  for (const issue of issues) console.error(`   • ${issue}`);
  process.exit(1);
}
console.log("\n✅ Catalogue digital conforme (fiches, sitemap, métadonnées, prix, régions).");
