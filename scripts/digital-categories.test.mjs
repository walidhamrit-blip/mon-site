import { test, after } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const temp = mkdtempSync(join(tmpdir(), "digital-categories-"));
after(() => rmSync(temp, { recursive: true, force: true }));
const outfile = join(temp, "test.cjs");
await build({
  stdin: {
    contents: `export * from "./src/lib/digital-categories";
      export { generateMetadata, default as Page } from "./src/app/(site)/codes/category/[kind]/page";
      export { renderToStaticMarkup } from "react-dom/server";`,
    resolveDir: process.cwd(),
  },
  outfile, bundle: true, platform: "node", format: "cjs", jsx: "automatic",
  plugins: [{ name: "category-fixtures", setup(builder) {
    builder.onResolve({ filter: /^(next\/link|next\/navigation|@\/lib\/store|@\/lib\/digital-store|@\/lib\/catalog-cache|@\/components\/store-status-notice|@\/components\/localized-link)$/ }, (args) => ({ path: args.path, namespace: "fixtures" }));
    builder.onLoad({ filter: /.*/, namespace: "fixtures" }, ({ path }) => {
      const fixtures = {
        "next/link": `import {createElement} from 'react'; export default function Link({children,...props}) { return createElement('a',props,children); }`,
        "@/components/localized-link": `import {createElement} from 'react'; export function LocalizedLink({children,...props}) { return createElement('a',props,children); }`,
        "next/navigation": `export function notFound() { throw new Error('NOT_FOUND'); }`,
        "@/lib/store": `export async function getSiteDataCached() { return {config: {url:'https://store.example',market:null,appearance:{primaryLocale:globalThis.__categoryLocale || 'en'},phone:''}}; }`,
        "@/lib/digital-store": `export async function getDigitalCatalog() { return globalThis.__categoryProducts; } export function digitalCatalogStatus() { return {degraded:!!globalThis.__categoryDegraded}; }`,
        // Cache de données partagé (Next `unstable_cache`) : le test rend la
        // page sans serveur Next, on sert donc le même snapshot que la base.
        "@/lib/catalog-cache": `export async function getPublicCatalogCached() { return { products: globalThis.__categoryProducts, degraded: !!globalThis.__categoryDegraded }; } export async function getSiteDataCachedShared() { return { config: { url: "https://store.example", market: null, appearance: { primaryLocale: globalThis.__categoryLocale || "en" }, phone: "" } }; }`,
        "@/components/store-status-notice": `import {createElement} from 'react'; export function StoreUnavailableNotice() {return createElement('p',null,'Maintenance');}`,
      };
      return { contents: fixtures[path], loader: "js", resolveDir: process.cwd() };
    });
  } }],
  logLevel: "silent",
});
const category = createRequire(import.meta.url)(outfile);
const products = Array.from({ length: 55 }, (_, index) => ({
  id: `gift-${index}`, slug: `gift-${index}`, kind: "gift_card", platform: "Steam",
  titleEn: `Gift ${index}`, titleAr: `هدية ${index}`, regions: ["GLOBAL"],
  status: "available", denominations: [],
}));
const props = (kind = "gift_card", page) => ({ params: Promise.resolve({ kind }), searchParams: Promise.resolve({ page }) });
const read = (path) => readFileSync(path, "utf8");

test("A07: four distinct bilingual categories and collision-free URLs", () => {
  assert.deepEqual(category.digitalCategories.map(({ kind }) => kind), ["gift_card", "game_topup", "software_key", "subscription_code"]);
  assert.equal(category.getDigitalCategory("unknown"), undefined);
  for (const item of category.digitalCategories) {
    for (const key of ["en", "ar", "descriptionEn", "descriptionAr"]) assert.ok(item[key]);
    assert.equal(category.categoryHref(item.kind), `/codes/category/${item.kind}`);
  }
  assert.equal(new Set(category.digitalCategories.map((item) => item.descriptionEn)).size, 4);
});

test("A07: strict page validation, complete traversal and no cross-category leakage", () => {
  for (const value of ["0", "-1", "1.5", "abc", "01", "", ["1", "2"], "9007199254740992"]) assert.equal(category.parseCategoryPage(value), null);
  assert.equal(category.parseCategoryPage(undefined), 1);
  assert.equal(category.parseCategoryPage("2"), 2);
  const mixed = [...products, { ...products[0], id: "other", kind: "game_topup" }];
  const seen = [1, 2, 3].flatMap((page) => category.categoryProducts(mixed, "gift_card", page).products);
  assert.equal(seen.length, 55);
  assert.equal(new Set(seen.map(({ id }) => id)).size, 55);
  assert.equal(category.categoryProducts(mixed, "gift_card").pageCount, 3);
  assert.equal(category.categoryProducts(mixed, "software_key").pageCount, 1);
  const paths = category.categorySitemapPaths(mixed, false);
  assert.ok(paths.includes("/codes/category/gift_card?page=3"));
  assert.ok(!paths.includes("/codes/category/gift_card?page=4"));
  assert.equal(category.categorySitemapPaths(mixed, true).length, 4);
});

test("A07: rendered HTML has category H1, real product anchors, numbered/previous/next links and self canonical", async () => {
  globalThis.__categoryProducts = products;
  const html = category.renderToStaticMarkup(await category.Page(props("gift_card", "2")));
  assert.match(html, /<h1[^>]*>Gift cards.*Page 2<\/h1>/);
  assert.equal((html.match(/href="\/codes\/gift-/g) || []).length, 24);
  assert.match(html, /rel="prev" href="\/codes\/category\/gift_card"/);
  assert.match(html, /rel="next" href="\/codes\/category\/gift_card\?page=3"/);
  assert.match(html, /aria-current="page" aria-label="Page 2"/);
  const meta = await category.generateMetadata(props("gift_card", "2"));
  assert.equal(meta.alternates.canonical, "https://store.example/codes/category/gift_card?page=2");
  assert.match(meta.description, /^Page 2\./);
  const firstMeta = await category.generateMetadata(props());
  assert.equal(firstMeta.alternates.canonical, "https://store.example/codes/category/gift_card");
  assert.notEqual(meta.title, firstMeta.title);
  assert.match(html, /"position":25/);
});

test("A07: unknown/out-of-range URLs 404; empty categories remain useful; outage is noindex without demo links", async () => {
  globalThis.__categoryProducts = products;
  for (const input of [props("unknown"), props("gift_card", "0"), props("gift_card", "4")]) await assert.rejects(category.Page(input), /NOT_FOUND/);
  const empty = category.renderToStaticMarkup(await category.Page(props("software_key")));
  assert.match(empty, /No products in this category/);
  assert.doesNotMatch(empty, /Category pagination/);
  globalThis.__categoryDegraded = true;
  try {
    const html = category.renderToStaticMarkup(await category.Page(props("gift_card", "9")));
    assert.match(html, /Maintenance/);
    assert.doesNotMatch(html, /href="\/codes\/gift-|"ItemList"/);
    const meta = await category.generateMetadata(props());
    assert.equal(meta.robots.index, false);
  } finally { globalThis.__categoryDegraded = false; }
});

test("A07: Arabic H1 and metadata stay aligned with the configured locale", async () => {
  globalThis.__categoryProducts = products;
  globalThis.__categoryLocale = "ar";
  try {
    const html = category.renderToStaticMarkup(await category.Page(props("gift_card", "2")));
    assert.match(html, /<h1[^>]*>بطاقات هدايا — الصفحة 2<\/h1>/);
    assert.match(html, /aria-label="الصفحة 2"/);
    const meta = await category.generateMetadata(props("gift_card", "2"));
    assert.match(meta.description, /^الصفحة 2/);
    assert.match(meta.title, /بطاقات هدايا/);
  } finally { globalThis.__categoryLocale = "en"; }
});

test("A07: discovery is wired into the store, product breadcrumbs and sitemap without removing legacy kind filters", () => {
  // Une seule barre de catégories sur /codes : les pastilles `?kind=` qui
  // filtrent le catalogue en place. La rangée de liens vers les rayons
  // `/codes/category/<kind>` n'y est plus dupliquée ; elle reste sur les
  // pages de rayon (navigation transversale) et les fiches produit gardent
  // le lien vers leur catégorie.
  const storeView = read("src/components/digital-store-view.tsx");
  assert.doesNotMatch(storeView, /<DigitalCategoryNavigation ar=/);
  assert.match(storeView, /codes\?kind=/);
  assert.match(read("src/app/(site)/codes/category/[kind]/page.tsx"), /<DigitalCategoryNavigation ar=\{ar\} current=\{category\.kind\} \/>/);
  assert.match(read("src/app/(site)/codes/page.tsx"), /storeCategories\.find/);
  assert.match(read("src/app/(site)/codes/[slug]/page.tsx"), /path: categoryHref\(category.kind\)/);
  const sitemap = read("src/app/sitemap.ts");
  assert.match(sitemap, /categorySitemapPaths\(catalog, digitalCatalogStatus\(\).degraded\)/);
  assert.match(sitemap, /\.\.\.digitalRoutes/);
  assert.match(sitemap, /\.\.\.categoryRoutes/);
  const audit = read("scripts/seo-check.mjs");
  assert.match(audit, /if \(isCodeCategory\)/);
  assert.match(audit, /if \(isCodeProduct\)/);
  assert.match(audit, /return \(url.pathname \|\| "\/"\) \+ url.search/);
});

test("A08: category ?lang=en overrides the default locale with self canonical and reciprocal hreflang", async () => {
  globalThis.__categoryProducts = products;
  globalThis.__categoryLocale = "ar";
  try {
    const props = { params: Promise.resolve({ kind: "gift_card" }), searchParams: Promise.resolve({ page: "2", lang: "en" }) };
    const html = category.renderToStaticMarkup(await category.Page(props));
    assert.match(html, /<h1[^>]*>Gift cards.*Page 2<\/h1>/);
    const meta = await category.generateMetadata(props);
    assert.equal(meta.alternates.canonical, "https://store.example/codes/category/gift_card?page=2&lang=en");
    assert.deepEqual(meta.alternates.languages, {
      ar: "https://store.example/codes/category/gift_card?page=2",
      en: "https://store.example/codes/category/gift_card?page=2&lang=en",
      "x-default": "https://store.example/codes/category/gift_card?page=2",
    });
  } finally { globalThis.__categoryLocale = "en"; }
});
