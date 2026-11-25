import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";

const outDir = mkdtempSync(join(tmpdir(), "website-offer-"));
after(() => rmSync(outDir, { recursive: true, force: true }));
const outfile = join(outDir, "offer.mjs");
await build({
  stdin: { contents: `export * from "./src/lib/website-offer";
    export * from "./src/lib/classification";
    export { siteConfig } from "./src/lib/config";
    export { demos, faqs } from "./src/lib/content";
    export { mergeConfig, buildSiteData } from "./src/lib/store";
    export { demoJsonLd, offerCatalogJsonLd, localBusinessJsonLd } from "./src/lib/seo";`,
    resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "esm", platform: "node", outfile,
  packages: "external", logLevel: "silent",
  plugins: [{ name: "offline-store", setup(builder) {
    builder.onResolve({ filter: /^@\/db(?:\/schema)?$/ }, args => ({ path: args.path, namespace: "offline-db" }));
    builder.onLoad({ filter: /.*/, namespace: "offline-db" }, () => ({ contents: "export const db = {}; export const settings = {}; export async function ensureSchema() {}" }));
    builder.onResolve({ filter: /^@\/lib\/cache-invalidate$/ }, () => ({ path: "cache", namespace: "offline-cache" }));
    builder.onLoad({ filter: /.*/, namespace: "offline-cache" }, () => ({ contents: "export function invalidateSiteCaches() {}" }));
    builder.onResolve({ filter: /^@\// }, args => ({ path: resolve("src", args.path.slice(2) + ".ts") }));
  } }],
});
// External dependencies resolve from the repository, not the system temp folder.
// React / Drizzle are only needed by the store module's imports, not by these tests.
const bundled = readFileSync(outfile, "utf8").replace(/from "(react|drizzle-orm)"/g,
  (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const { writeFileSync } = await import("node:fs");
writeFileSync(outfile, bundled);
const offer = await import(outfile);

test("one design-independent base plan: $35, initial personalization $0", () => {
  assert.equal(offer.siteConfig.pricing.plans.length, 1);
  assert.deepEqual(offer.resolvePlanPriceBreakdown(offer.websiteBasePlan), {
    modelPriceUsd: 35, customizationPercent: 0, customizationUsd: 0, totalPriceUsd: 35,
  });
});

test("every catalog model uses $35, ignoring all historical tiers and overrides", () => {
  for (const demo of [...offer.demos,
    { planId: "boutique", categoryTier: 99, priceUsd: 9999 },
    { planId: "vitrine-plus", categoryTier: 2, priceUsd: 1 },
    { priceUsd: null },
  ]) {
    const result = offer.resolveDemoClassification(demo, offer.siteConfig.pricing.plans);
    assert.equal(result.planId, offer.WEBSITE_BASE_PLAN_ID);
    assert.equal(result.totalPriceUsd, 35);
    assert.equal(result.customizationUsd, 0);
    assert.equal(result.customPrice, false);
    assert.equal(result.tier, 1);
  }
});

test("stored legacy pricing cannot restore expensive tiers or 20% fees", () => {
  const old = { name: "My agency", pricing: { currency: "$", plans: [
    { id: "vitrine", priceUsd: 300, customizationPercent: 20 },
    { id: "boutique", priceUsd: 880, customizationPercent: 20 },
  ] } };
  const before = JSON.stringify(old);
  const config = offer.mergeConfig(old);
  assert.equal(config.name, "My agency");
  assert.deepEqual(config.pricing.plans, [offer.websiteBasePlan]);
  assert.equal(JSON.stringify(old), before, "legacy persisted input is not mutated");
  assert.equal(offer.mergeConfig(null).pricing.plans[0].priceUsd, 35);
});

test("live FAQ and hero replace retired commercial promises, preserving custom FAQs", () => {
  const custom = { qAr: "سؤال مخصص", qEn: "A custom question", aAr: "جواب", aEn: "Custom answer" };
  const result = offer.buildSiteData([
    { key: "content_faqs", value: [
      { ...offer.faqs[2], aEn: "Includes 1 year hosting" }, custom,
    ] },
    { key: "content_hero", value: { subtitleEn: "Old premium offer" } },
  ]);
  assert.equal(result.config.pricing.plans[0].priceUsd, 35);
  assert.equal(result.content.faqs.filter(f => f.qEn === offer.faqs[2].qEn).length, 1);
  assert.doesNotMatch(JSON.stringify(result.content.faqs), /Includes 1 year hosting/);
  assert.ok(result.content.faqs.some(f => f.qEn === custom.qEn));
  assert.match(result.content.hero.subtitleEn, /\$35/);
});

test("option prices and unknown prices remain distinct; no invented booking/store charge", () => {
  const options = Object.fromEntries(offer.websiteOptions.map(option => [option.id, option]));
  assert.equal(options.language.priceUsd, 10);
  assert.equal(options.language.from, false);
  assert.equal(options.content.priceUsd, 10);
  assert.equal(options.content.from, true);
  for (const id of ["booking", "store", "payment"]) assert.equal(options[id].priceUsd, null);
  assert.match(offer.websiteOfferSummary("en"), /never charged twice/);
  assert.match(offer.websiteOfferSummary("en"), /Vercel eligibility and limits/);
});

test("demo structured data contains the unified offer, not the historical model price", () => {
  const demo = { ...offer.demos[0], priceUsd: 1000, planId: "boutique" };
  const schema = offer.demoJsonLd(offer.siteConfig, demo, "en");
  assert.match(JSON.stringify(schema), /35/);
  assert.doesNotMatch(JSON.stringify(schema), /1000/);
});

test("new payment requests still use server-resolved configuration and shared pricing", () => {
  const route = readFileSync("src/app/api/payments/create/route.ts", "utf8");
  assert.match(route, /await getSiteData\(\)/);
  assert.match(route, /resolveDemoClassification\(demo, config.pricing.plans\)/);
  assert.match(route, /resolvePlanPriceBreakdown\(plan, modelPriceUsd\)/);
  assert.match(route, /const totalUsd = grossTotalUsd/);
});

test("legacy content is updated by exact defaults, without overwriting custom text", () => {
  const steps = [{ num: "03", titleAr: "عنوان مخصص", titleEn: "Rapid Build",
    descAr: "نص مخصص", descEn: "My custom delivery process", durationAr: "مدة مخصصة", durationEn: "3-5 days" }];
  const result = offer.buildSiteData([
    { key: "content_process_step06_migrated", value: true },
    { key: "content_process", value: steps },
    { key: "content_why_us", value: [{ titleEn: "Custom title", descEn: "Your site ready in 7 days. Built with Next.js — 90+ Lighthouse even on 3G." }] },
    { key: "content_headings", value: { process: { titleEn: "Custom heading", noteEn: "Total: 7-14 days" } } },
  ]);
  assert.equal(result.content.process[0].descEn, "My custom delivery process");
  assert.equal(result.content.process[0].durationEn, "By agreed scope");
  assert.match(result.content.whyUs[0].descEn, /confirmed before ordering/);
  assert.equal(result.content.whyUs[0].titleEn, "Custom title");
  assert.doesNotMatch(JSON.stringify(result.content.headings), /Total: 7-14 days/);
  assert.equal(steps[0].durationEn, "3-5 days", "do not mutate stored inputs");
  const empty = offer.buildSiteData([{ key: "content_why_us", value: [] }]);
  assert.deepEqual(empty.content.whyUs, []);
});

test("shared deposit and demo disclosures state actual checkout limitations", () => {
  assert.match(offer.websiteDepositNote("en"), /does not automatically deduct/);
  assert.match(offer.websiteDepositNote("en"), /remaining balance/);
  assert.match(offer.websiteDemoNote("en"), /not everything included in the base price/);
  for (const path of ["src/components/checkout-dialog.tsx", "src/components/reservation-dialog.tsx"]) {
    assert.match(readFileSync(path, "utf8"), /websiteDepositNote\(locale\)/);
  }
  assert.match(offer.paymentAvailabilityNote("en"), /manual transfer when enabled/);
  assert.match(offer.paymentAvailabilityNote("en"), /display conversions are indicative/);
});

test("SEO, social cards, manifest and emails no longer guarantee seven-day delivery", () => {
  for (const path of ["src/lib/seo.ts", "src/lib/og-image.tsx", "src/app/manifest.ts", "src/lib/emails.ts", "src/lib/sectors.ts"]) {
    const text = readFileSync(path, "utf8");
    assert.doesNotMatch(text, /delivered in 7 days|7-day delivery|تسليم في 7 أيام|goes live in 7 to 14 days|delivered in 7-10 days/);
  }
  assert.doesNotMatch(readFileSync("src/lib/seo.ts", "utf8"), /totalTime: "P14D"/);
});

test("public production-shaped settings cannot reinstate the old 60/100/299 plus 10% offer", () => {
  // Public values observed on nokhba.net.ly, not a database export.
  const config = offer.mergeConfig({
    pricing: { plans: [
      { id: "vitrine", priceUsd: 60, customizationPercent: 10 },
      { id: "vitrine-plus", priceUsd: 100, customizationPercent: 10 },
      { id: "boutique", priceUsd: 299, customizationPercent: 10 },
    ] },
    reservation: { depositUsd: 5, enabled: true },
  });
  assert.equal(config.reservation.depositUsd, 5, "keep configured reservation amount");
  assert.equal(config.pricing.plans.length, 1);
  assert.equal(offer.resolvePlanPriceBreakdown(config.pricing.plans[0]).totalPriceUsd, 35);
  const demo = offer.resolveDemoClassification({ planId: "vitrine-plus", categoryTier: 2, priceUsd: 120 }, config.pricing.plans);
  assert.equal(demo.totalPriceUsd, 35);
  assert.equal(demo.customizationUsd, 0);
});

test("contact and AI index do not revive unconditional reply or payment promises", () => {
  for (const path of ["src/lib/i18n.tsx", "src/lib/content.ts", "src/lib/llms-txt.ts", "src/app/(site)/contact/contact-client.tsx"]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /We reply in 2 hours|we reply within 2 hours|نرد في أقل من ساعتين|Open now · fast reply|bank transfer on request/);
  }
  assert.match(readFileSync("src/lib/llms-txt.ts", "utf8"), /websiteDepositNote\("en"\)/);
});


test("closing at 22:00 is consistent for defaults, legacy settings and business JSON-LD", () => {
  for (const stored of [null,
    { hours: "السبت - الخميس: 9:00 - 22:00", hoursEn: "Sat - Thu: 9:00 AM - 6:00 PM" },
    { hours: "السبت - الخميس: 9:00 - 23:00", hoursEn: "Sat - Thu: 9:00 AM - 11:00 PM" },
  ]) {
    const before = JSON.stringify(stored);
    const config = offer.mergeConfig(stored);
    assert.equal(config.hours, "السبت - الخميس: 9:00 - 22:00");
    assert.equal(config.hoursEn, "Sat - Thu: 9:00 AM - 10:00 PM");
    const schema = offer.localBusinessJsonLd(config);
    assert.equal(schema.openingHoursSpecification[0].opens, "09:00");
    assert.equal(schema.openingHoursSpecification[0].closes, "22:00");
    assert.equal(JSON.stringify(stored), before, "stored input is not mutated");
  }
});
