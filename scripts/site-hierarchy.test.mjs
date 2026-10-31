import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const { outputFiles } = await build({ entryPoints: ["src/lib/site-hierarchy.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const hierarchy = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
const read = (path) => readFileSync(path, "utf8");

test("four primary destinations, same bilingual source for both menus", () => {
  assert.deepEqual(hierarchy.primaryNavigation.map((link) => link.href), ["/", "/codes", "/creation-sites", "/contact"]);
  for (const link of hierarchy.primaryNavigation) { assert.ok(link.ar); assert.ok(link.en); }
  assert.match(read("src/components/navbar.tsx"), /primaryNavigation\.map/);
});

test("only supported supplier kinds are exposed as store facets", () => {
  assert.deepEqual(hierarchy.storeCategories.map((item) => item.kind), ["all", "gift_card", "software_key", "game_topup", "subscription_code"]);
  assert.match(read("src/app/(site)/codes/page.tsx"), /storeCategories\.find/);
});

test("home FAQ has one source for visible text and structured data", () => {
  const page = read("src/app/(site)/page.tsx");
  const view = read("src/components/sections/home-sections.tsx");
  assert.match(page, /homeFaqs\.map/);
  assert.match(view, /homeFaqs\.map/);
  assert.doesNotMatch(page, /howToJsonLd/);
  assert.match(page, /degraded \? <StoreUnavailableNotice/);
  for (const faq of hierarchy.homeFaqs) for (const key of ["qAr", "qEn", "aAr", "aEn"]) assert.ok(faq[key]);
});

test("website hub is canonical, discoverable, and displays the declared steps", () => {
  const page = read("src/app/(site)/creation-sites/page.tsx");
  assert.match(page, /path: "\/creation-sites"/);
  assert.match(page, /breadcrumbJsonLd/);
  assert.match(read("src/app/sitemap.ts"), /\$\{base\}\/creation-sites/);
  const view = read("src/components/website-creation-view.tsx");
  for (const component of ["Pricing", "DemosGallery", "Process", "CTAForm", "FAQ"]) assert.match(view, new RegExp(`<${component} />`));
  assert.match(read("src/components/home-legacy-anchors.tsx"), /#lead-form/);
});
