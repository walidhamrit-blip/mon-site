#!/usr/bin/env node
/**
 * Diagnostic « Google Play » côté fournisseur — `npm run fazercards:google-play`
 *
 * Interroge directement l'API FazerCards (avec FAZERCARDS_API_KEY lu dans
 * .env.local / .env ou le shell — la clé n'est JAMAIS affichée) et reproduit
 * la logique exacte du site pour dire si une carte Google Play est vendable :
 *
 *   1. la catégorie « Google Play » existe-t-elle dans /giftcards ?
 *   2. a-t-elle des offres avec stock > 0 ?
 *   3. le prix de vente calculé (coût + marge, comme `fazercards-pricing.ts`)
 *      est-il ≤ 100 $ (politique `applyGiftCardSalesPolicy`) ?
 *
 * Verdict :
 *   - OUI  → le problème est chez NOUS (fiche masquée dans /admin/digital/products,
 *            corbeille) ;
 *   - NON  → le problème est chez FAZERCARDS (plus de catégorie, stock à 0
 *            ou prix > 100 $) : rien à corriger dans le code.
 *
 * Usage :
 *   FAZERCARDS_API_KEY=... npm run fazercards:google-play
 *   (ou avec la clé déjà dans .env.local : npm run fazercards:google-play)
 */

import { existsSync, readFileSync } from "node:fs";

// Lecture minimaliste de .env.local / .env (sans dépendance externe) :
// les variables déjà exportées dans le shell restent prioritaires.
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    const value = raw.replace(/^["']|["']$/g, "").trim();
    if (value) process.env[key] = value;
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const API_KEY = (process.env.FAZERCARDS_API_KEY ?? "").trim();
const BASE = (process.env.FAZERCARDS_API_BASE ?? "https://api.fzr.cards/api/v2")
  .trim()
  .replace(/\/+$/, "");

// ── Reproduction fidèle de la politique de prix du site ────────────────────
const MIN_RETAIL_USD = 1.5;
const MAX_GIFT_CARD_PRICE_USD = 100; // src/lib/digital-sales-policy.ts
const MARGIN_TIERS = [
  { maxCostUsd: 5, marginPercent: 20, minProfitUsd: 0.45 },
  { maxCostUsd: 20, marginPercent: 15, minProfitUsd: 1 },
  { maxCostUsd: 60, marginPercent: 12, minProfitUsd: 2.5 },
  { maxCostUsd: null, marginPercent: 10, minProfitUsd: 0 },
];

function marginTierFor(cost) {
  for (const tier of MARGIN_TIERS) {
    if (tier.maxCostUsd === null || cost < tier.maxCostUsd) return tier;
  }
  return MARGIN_TIERS[MARGIN_TIERS.length - 1];
}

function ceilToCent(value) {
  return Math.ceil(value * 100 - 1e-9) / 100;
}

function retailPriceForCost(cost) {
  if (cost == null || !Number.isFinite(cost) || cost <= 0) return 0;
  const tier = marginTierFor(cost);
  const byPercent = cost / (1 - tier.marginPercent / 100);
  const byFloor = cost + tier.minProfitUsd;
  return ceilToCent(Math.max(Math.max(byPercent, byFloor), MIN_RETAIL_USD));
}

// ── Client API minimal (mêmes endpoints que src/lib/fazercards.ts) ──────────
async function api(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "X-API-Key": API_KEY, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const raw = await response.text().catch(() => "");
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  if (!response.ok || (body && body.ok === false)) {
    const msg = body?.error ?? `HTTP ${response.status}`;
    throw new Error(`FazerCards ${path} → ${msg}`);
  }
  return body;
}

async function collect(listPath, idOf) {
  const items = [];
  const seen = new Set();
  let cursor = null;
  for (let page = 0; page < 50; page += 1) {
    const params = new URLSearchParams({ limit: "100" });
    if (cursor) params.set("cursor", cursor);
    const body = await api(`${listPath}?${params.toString()}`);
    for (const item of body?.items ?? []) {
      const id = idOf(item);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      items.push(item);
    }
    const next = body?.meta?.next_cursor ?? null;
    if (!body?.meta?.has_more || !next) break;
    cursor = next;
  }
  return items;
}

// ── Diagnostic ──────────────────────────────────────────────────────────────
if (!API_KEY) {
  console.error(
    "FAZERCARDS_API_KEY est vide : exportez-la ou mettez-la dans .env.local.\n" +
      "Exemple : FAZERCARDS_API_KEY=... npm run fazercards:google-play",
  );
  process.exit(1);
}

console.log(`Base API : ${BASE}`);
console.log("Scan des 3 familles du catalogue fournisseur à la recherche de « google »…\n");

const families = [
  {
    label: "Cartes cadeaux (/giftcards)",
    listPath: "/giftcards",
    idOf: (c) => c.category_id,
    detailPath: (c) => `/giftcards/cards?category_id=${encodeURIComponent(c.category_id)}`,
    offersOf: (body) => body?.offers ?? [],
    priceOf: (o) => o.price_usd,
    stockOf: (o) => o.stock,
    giftCardPolicy: true,
  },
  {
    label: "Top-ups (/topups)",
    listPath: "/topups",
    idOf: (c) => c.category_id,
    detailPath: (c) => `/topups/offers?category_id=${encodeURIComponent(c.category_id)}`,
    offersOf: (body) => body?.offers ?? [],
    priceOf: (o) => o.price_usd,
    stockOf: () => 1, // les top-ups n'ont pas de stock : toujours vendables
    giftCardPolicy: false,
  },
  {
    label: "Clés de jeux (/gamekeys)",
    listPath: "/gamekeys",
    idOf: (c) => c.game_id,
    detailPath: (c) => `/gamekeys/keys?game_id=${encodeURIComponent(c.game_id)}`,
    offersOf: (body) => body?.keys ?? [],
    priceOf: (o) => o.price_usd,
    stockOf: (o) => o.stock ?? 1,
    giftCardPolicy: false,
  },
];

let anySellable = false;

for (const family of families) {
  let categories;
  try {
    categories = await collect(family.listPath, family.idOf);
  } catch (error) {
    console.log(`❌ ${family.label} : liste illisible — ${error.message}`);
    continue;
  }
  console.log(`${family.label} : ${categories.length} catégories au total`);
  const matches = categories.filter((c) => /google/i.test(c.name ?? ""));
  if (matches.length === 0) {
    console.log("   → aucune catégorie « google » dans cette famille\n");
    continue;
  }
  for (const category of matches) {
    console.log(`   🎯 catégorie trouvée : « ${category.name} » (id ${family.idOf(category)})`);
    let offers;
    try {
      const body = await api(family.detailPath(category));
      offers = family.offersOf(body);
    } catch (error) {
      console.log(`      ❌ détails illisibles — ${error.message}`);
      continue;
    }
    if (offers.length === 0) {
      console.log("      → aucune offre dans cette catégorie");
      continue;
    }
    for (const offer of offers) {
      const cost = Number(family.priceOf(offer));
      const retail = retailPriceForCost(cost);
      const stock = family.stockOf(offer);
      const inStock = stock > 0;
      const underCap = !family.giftCardPolicy || retail <= MAX_GIFT_CARD_PRICE_USD;
      const sellable = inStock && Number.isFinite(retail) && retail > 0 && underCap;
      if (sellable) anySellable = true;
      const flags = [
        inStock ? "stock ok" : `STOCK = ${stock}`,
        underCap ? "" : `prix vente ${retail.toFixed(2)} $ > ${MAX_GIFT_CARD_PRICE_USD} $ (coupé)`,
        sellable ? "✅ VENDABLE" : "❌ masqué par le site",
      ].filter(Boolean);
      console.log(
        `      - ${offer.name ?? offer.card_id ?? offer.offer_id ?? offer.key_id} | ` +
          `coût ${Number.isFinite(cost) ? cost.toFixed(2) : "?"} $ | vente ${retail.toFixed(2)} $ | ${flags.join(" | ")}`,
      );
    }
  }
  console.log("");
}

console.log("═══════════════════════════════════════");
if (anySellable) {
  console.log("VERDICT : une fiche Google Play EST vendable chez FazerCards.");
  console.log("→ Le problème est chez NOUS : allez dans /admin/digital/products,");
  console.log("  filtre « Masquées / Corbeille », recherchez « google » et restaurez la fiche.");
} else {
  console.log("VERDICT : AUCUNE carte Google Play vendable chez FazerCards");
  console.log("(pas de catégorie, ou stock à 0, ou prix de vente > 100 $).");
  console.log("→ Le problème est chez FAZERCARDS : rien à corriger dans le code,");
  console.log("  voyez avec leur support ou retirez Google Play des textes du site.");
}
