import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { build } from "esbuild";

const read = (path) => readFileSync(path, "utf8");
const { outputFiles } = await build({ entryPoints: ["src/lib/universes.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const universes = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

test("each public path belongs to exactly one universe, without changing any URL", () => {
  const cases = {
    "/": "hub",
    "/contact": "hub",
    "/avis": "hub",
    "/conditions": "hub",
    "/remboursement": "hub",
    "/mentions-legales": "hub",
    "/pay/success": "hub",
    "/codes": "store",
    "/codes/": "store",
    "/codes/category/gift_card": "store",
    "/codes/steam-wallet-20-usd": "store",
    "/codes/commande": "store",
    "/en/codes": "store",
    "/creation-sites": "studio",
    "/demos/clinic": "studio",
    "/pricing": "studio",
    "/services/seo": "studio",
    "/sectors/restaurants": "studio",
    "/abonnements/suivi": "studio",
    "/livraison/ABC123": "studio",
    "/blog/website-cost-libya-2026": "studio",
    "/compare/google-ads-vs-website": "studio",
    "/codesx": "hub",
    "/pricingx": "hub",
  };
  for (const [path, expected] of Object.entries(cases)) assert.equal(universes.universeForPath(path), expected, path);
  assert.equal(universes.universeForPath(null), "hub");
  assert.equal(universes.universeForPath("/codes?kind=gift_card"), "store");
});

test("every universe link points to an existing public route", () => {
  const routeExists = (href) => {
    const path = href.split(/[?#]/)[0];
    if (path === "/") return existsSync("src/app/(site)/page.tsx");
    const category = path.match(/^\/codes\/category\/([a-z_]+)$/);
    if (category) return read("src/lib/digital-categories.ts").includes(`kind: "${category[1]}"`);
    return existsSync(`src/app/(site)${path}/page.tsx`);
  };
  const links = [
    ...universes.universeNavigation.store,
    ...universes.universeNavigation.studio,
    ...Object.values(universes.universePrimaryAction),
    ...universes.universeSwitcher,
    ...Object.values(universes.universeBrands).map((brand) => ({ href: brand.home, ar: "x", en: "x" })),
  ];
  for (const link of links) {
    assert.ok(routeExists(link.href), link.href);
    assert.ok(link.ar && link.en, link.href);
  }
  // Chaque menu reste dans son univers (hors contact commun).
  for (const link of universes.universeNavigation.store) assert.equal(universes.universeForPath(link.href), "store", link.href);
  for (const link of universes.universeNavigation.studio) assert.ok(["studio", "hub"].includes(universes.universeForPath(link.href)), link.href);
  assert.equal(universes.universePrimaryAction.store.href, "/codes/commande");
  assert.match(universes.universePrimaryAction.studio.href, /^\/creation-sites#lead-form$/);
});

test("only the store follows the visitor's gaming palette; agency schema stays out of the store", () => {
  assert.equal(universes.universeUsesVisitorPalette("store"), true);
  assert.equal(universes.universeUsesVisitorPalette("studio"), false);
  assert.equal(universes.universeUsesVisitorPalette("hub"), false);
  assert.equal(universes.universeShowsAgencySchema("store"), false);
  assert.equal(universes.universeShowsAgencySchema("studio"), true);
  assert.equal(universes.universeShowsAgencySchema("hub"), true);
});

test("public shell exposes data-universe and the agency JSON-LD moved out of the root layout", () => {
  const shell = read("src/components/universe-shell.tsx");
  assert.match(shell, /data-universe=\{universe\}/);
  assert.match(shell, /universeShowsAgencySchema\(universe\)/);
  const siteLayout = read("src/app/(site)/layout.tsx");
  assert.match(siteLayout, /<UniverseShell className="public-shell" agencySchema=\{agencySchema\}>/);
  assert.match(siteLayout, /localBusinessJsonLd\(config, content\.testimonials\)/);
  const root = read("src/app/layout.tsx");
  assert.doesNotMatch(root, /localBusinessJsonLd\(/);
  assert.doesNotMatch(root, /offerCatalogJsonLd\(/);
  assert.match(root, /organizationJsonLd\(config\), websiteJsonLd\(config\)/);
  assert.match(root, /website-provider-loader/);
  assert.match(read("src/components/website-providers.tsx"), /import "@\/app\/universes\.css"/);
});

test("header and footer adapt to the universe and keep the endorsement visible", () => {
  const navbar = read("src/components/navbar.tsx");
  assert.match(navbar, /useUniverse\(\)/);
  assert.match(navbar, /universeNavigation\[universe\]/);
  assert.match(navbar, /universeSwitcher\.map/);
  assert.match(navbar, /showPalette \? <ThemeList \/> : null/);
  const footer = read("src/components/footer.tsx");
  assert.match(footer, /useUniverse\(\)/);
  assert.match(footer, /إحدى خدمات نخبة/);
  assert.match(footer, /Also by Nukhba:/);
  const gateway = read("src/components/sections/home-gateway.tsx");
  assert.match(gateway, /data-universe-preview=\{door\.universe\}/);
});

function luminance(hex) {
  const channels = hex.replace("#", "").match(/.{2}/g).map((v) => parseInt(v, 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
function block(css, selectorStart) {
  const start = css.indexOf(selectorStart);
  assert.ok(start >= 0, selectorStart);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
}

test("studio identity is readable by day and by night", () => {
  const css = read("src/app/universes.css");
  const day = block(css, '.public-shell:not([data-universe="store"]),');
  const night = block(css, 'html.dark .public-shell:not([data-universe="store"]),');
  for (const [name, palette] of [["day", day], ["night", night]]) {
    for (const [fg, bg] of [["foreground", "background"], ["card-foreground", "card"], ["muted-foreground", "background"], ["muted-foreground", "secondary"], ["accent-foreground", "accent"], ["accent-foreground", "accent-hover"], ["primary-foreground", "primary"], ["accent", "background"], ["accent", "secondary"], ["brand-gold", "background"], ["brand-gold", "secondary"]]) {
      assert.ok(contrast(palette[fg], palette[bg]) >= 4.5, `${name} ${fg} on ${bg}: ${contrast(palette[fg], palette[bg]).toFixed(2)}`);
    }
  }
  // La boutique garde la palette du visiteur, restaurée dans les aperçus.
  assert.match(css, /\.public-shell \[data-universe-preview="store"\] \{\s*--background: var\(--store-background\)/);
  assert.match(read("src/app/gaming.css"), /html\.dark\[data-theme="royal-gold"\] \.public-shell\[data-universe="store"\]/);
});
