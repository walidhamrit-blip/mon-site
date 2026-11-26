import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { build } from "esbuild";

const view = readFileSync("src/components/digital-store-view.tsx", "utf8");
const catalog = readFileSync("src/components/digital-catalog.tsx", "utf8");
const page = readFileSync("src/app/(site)/codes/page.tsx", "utf8");
const filtersModule = readFileSync("src/lib/catalog-filters.ts", "utf8");

/* --------------------- Lecture/écriture de l'adresse --------------------- */

const root = process.cwd();
mkdirSync(join(root, ".scratch"), { recursive: true });
const outDir = mkdtempSync(join(root, ".scratch/store-filters-"));
after(() => rmSync(outDir, { recursive: true, force: true }));
const outfile = join(outDir, "filters.cjs");
await build({
  stdin: {
    contents: `
      export { parseCatalogFilters, applyCatalogFiltersToUrl, DEFAULT_CATALOG_FILTERS } from "@/lib/catalog-filters";`,
    resolveDir: root,
    loader: "tsx",
  },
  outfile,
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
  jsx: "automatic",
});
const { parseCatalogFilters, applyCatalogFiltersToUrl, DEFAULT_CATALOG_FILTERS } = createRequire(import.meta.url)(outfile);

const valid = { platforms: new Set(["Steam", "PlayStation"]), regions: new Set(["US", "GLOBAL"]) };

test("store family is controlled by the URL and shared by nav, chips and rail", () => {
  assert.match(view, /const \[kind, setKind\] = useState<DigitalKind \| "all">\(initialFilters\.kind\)/);
  assert.match(view, /aria-current=\{kind === category\.kind \? "page" : undefined\}/);
  assert.match(view, /kind=\{kind\}[\s\S]*?onKindChange=\{selectKind\}/);
  assert.match(catalog, /kind: DigitalKind \| "all";/);
  assert.match(catalog, /onKindChange: \(kind: DigitalKind \| "all"\) => void/);
  assert.match(catalog, /const setKind = onKindChange/);
  assert.doesNotMatch(catalog, /useState<DigitalKind \| "all">\(initialKind\)/);
});

test("all six shop filters live in the address through a single source of truth", () => {
  // La vue tient les six filtres, initialisés depuis le serveur.
  assert.match(view, /const \[platform, setPlatform\] = useState\(initialFilters\.platform\)/);
  assert.match(view, /const \[region, setRegion\] = useState\(initialFilters\.region\)/);
  assert.match(view, /const \[price, setPrice\] = useState<PriceRangeId>\(initialFilters\.price\)/);
  assert.match(view, /const \[sort, setSort\] = useState<SortId>\(initialFilters\.sort\)/);
  assert.match(view, /const \[query, setQuery\] = useState\(initialFilters\.q\)/);
  // Le serveur lit les paramètres de la requête et les valide contre le catalogue.
  assert.match(page, /parseCatalogFilters\(params, \{/);
  assert.match(page, /initialFilters=\{initialFilters\}/);
  // Le catalogue est entièrement contrôlé : aucun état local de filtre.
  assert.match(catalog, /query: string;/);
  assert.match(catalog, /onQueryChange: \(q: string\) => void/);
  assert.match(catalog, /platform: string;/);
  assert.match(catalog, /onPlatformChange: \(platform: string\) => void/);
  assert.match(catalog, /region: string;/);
  assert.match(catalog, /onRegionChange: \(region: string\) => void/);
  assert.match(catalog, /priceRange: PriceRangeId;/);
  assert.match(catalog, /onPriceRangeChange: \(price: PriceRangeId\) => void/);
  assert.match(catalog, /sort: SortId;/);
  assert.match(catalog, /onSortChange: \(sort: SortId\) => void/);
  assert.doesNotMatch(catalog, /useState<PriceRangeId>\("all"\)/);
  assert.doesNotMatch(catalog, /useState<SortId>\("popular"\)/);
});

test("discrete filter changes push a history entry, typing replaces after a delay", () => {
  // Un clic sur un filtre = une entrée d'historique (le retour arrière
  // restaure l'état précédent) ; la frappe ne crée pas d'entrée par lettre.
  assert.match(view, /window\.history\.pushState\(null, "", url\)/);
  assert.match(view, /window\.history\.replaceState\(null, "", url\)/);
  assert.match(view, /const QUERY_URL_DELAY_MS = 300;/);
  assert.match(view, /window\.setTimeout\(\(\) => \{/);
  assert.match(view, /QUERY_URL_DELAY_MS/);
  // Les valeurs par défaut ne polluent pas l'adresse.
  assert.match(filtersModule, /url\.searchParams\.delete\(key\)/);
  assert.match(filtersModule, /setOrDelete\("kind", filters\.kind, filters\.kind === "all"\)/);
  assert.match(filtersModule, /setOrDelete\("platform", filters\.platform, filters\.platform === "all"\)/);
  assert.match(filtersModule, /setOrDelete\("region", filters\.region, filters\.region === "all"\)/);
  assert.match(filtersModule, /setOrDelete\("price", filters\.price, filters\.price === "all"\)/);
  assert.match(filtersModule, /setOrDelete\("sort", filters\.sort, filters\.sort === "popular"\)/);
  assert.match(filtersModule, /setOrDelete\("q", q, q === ""\)/);
});

test("browser back restores every filter from the address", () => {
  assert.match(view, /window\.addEventListener\("popstate", onPopState\)/);
  assert.match(view, /parseCatalogFilters\(new URL\(window\.location\.href\)\.searchParams, \{/);
  assert.match(view, /setPlatform\(parsed\.platform\)/);
  assert.match(view, /setRegion\(parsed\.region\)/);
  assert.match(view, /setPrice\(parsed\.price\)/);
  assert.match(view, /setSort\(parsed\.sort\)/);
  assert.match(view, /setQuery\(parsed\.q\)/);
});

test("unknown filter values fall back to defaults instead of an empty grid", () => {
  const parsed = parseCatalogFilters(
    new URLSearchParams("kind=nope&platform=Nope&region=XX&price=99&sort=zzz&q=  steam  "),
    valid,
  );
  assert.deepEqual(parsed, { ...DEFAULT_CATALOG_FILTERS, q: "steam" });
});

test("platform lookup ignores case and region is uppercased", () => {
  const parsed = parseCatalogFilters(new URLSearchParams("platform=steam&region=us"), valid);
  assert.equal(parsed.platform, "Steam");
  assert.equal(parsed.region, "US");
});

test("a shared link round-trips through the address", () => {
  const filters = { kind: "gift_card", platform: "Steam", region: "US", price: "u10", sort: "price-asc", q: "roblox" };
  const url = applyCatalogFiltersToUrl(new URL("https://example.test/codes?lang=ar"), filters);
  assert.equal(url.searchParams.get("lang"), "ar", "les autres paramètres sont préservés");
  assert.deepEqual(parseCatalogFilters(url.searchParams, valid), filters);
});

test("default filters produce the bare canonical address", () => {
  const url = applyCatalogFiltersToUrl(new URL("https://example.test/codes?lang=ar"), DEFAULT_CATALOG_FILTERS);
  assert.equal(url.search, "?lang=ar");
});
