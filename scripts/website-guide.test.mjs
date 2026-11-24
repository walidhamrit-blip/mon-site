import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const dir = mkdtempSync(join(tmpdir(), "website-guide-"));
after(() => rmSync(dir, { recursive: true, force: true }));
await build({ entryPoints: ["src/lib/website-guide.ts"], bundle: true, platform: "node", format: "esm", outfile: join(dir, "guide.mjs"), logLevel: "silent" });
const { estimateWebsiteGuide: estimate, buildWebsiteGuideMessage: message, DEFAULT_WEBSITE_GUIDE: defaults, MAX_GUIDE_LANGUAGES, MAX_GUIDE_NOTE } = await import(join(dir, "guide.mjs"));

test("default: one language, static site $35, personalization $0, no invented extras", () => {
  const result = estimate(defaults);
  assert.equal(result.knownSubtotalUsd, 35);
  assert.equal(result.requiresQuote, false);
  assert.equal(result.hasStartingPrice, false);
  assert.equal(result.lines.find(l => l.id === "personalization").amountUsd, 0);
  assert.equal(result.lines.length, 2);
});

test("each extra language adds exactly $10 to the same base, not a design tier", () => {
  for (let count = 0; count <= MAX_GUIDE_LANGUAGES; count++) {
    assert.equal(estimate({ extraLanguages: count }).knownSubtotalUsd, 35 + 10 * count);
  }
});

test("standalone content management is from $10, making a starting price, not a fixed quote", () => {
  const result = estimate({ updates: "admin", extraLanguages: 1 });
  assert.equal(result.knownSubtotalUsd, 55);
  assert.equal(result.hasStartingPrice, true);
  assert.equal(result.requiresQuote, true);
  assert.equal(result.hasUnpricedOptions, false);
  assert.equal(result.lines.find(l => l.id === "content").kind, "from");
});

test("booking, store and payment have no invented price; content foundation is not charged twice", () => {
  for (const id of ["booking", "store", "payment"]) {
    const result = estimate({ [id]: true, updates: "admin", extraLanguages: 2 });
    assert.equal(result.knownSubtotalUsd, 55);
    assert.equal(result.hasUnpricedOptions, true);
    assert.equal(result.hasStartingPrice, false);
    assert.equal(result.lines.find(l => l.id === id).amountUsd, null);
    assert.equal(result.lines.find(l => l.id === "content").kind, "bundled");
    assert.equal(result.lines.find(l => l.id === "content").amountUsd, null);
  }
});

test("combined modules keep their unknown scope, do not become a fake $35 full store", () => {
  const result = estimate({ updates: "admin", booking: true, store: true, payment: true });
  assert.equal(result.lines.filter(l => l.kind === "quote").length, 3);
  assert.equal(result.knownSubtotalUsd, 35);
  const text = message(result.selection, "en");
  assert.match(text, /Known portion only, not the project total/);
  assert.match(text, /\+ unpriced options/);
  assert.match(text, /foundation not charged twice/);
  assert.doesNotMatch(text, /From \$45/);
});

test("unlisted needs, content preparation and custom domains always require a quote", () => {
  for (const input of [{ updates: "unsure" }, { customRequest: true }, { note: "Add a members-only area" }, { contentHelp: true }, { customDomain: true }]) {
    const result = estimate(input);
    assert.equal(result.hasUnpricedOptions, true);
    assert.equal(result.requiresQuote, true);
    assert.equal(result.knownSubtotalUsd, 35);
  }
  assert.equal(estimate({ note: "   " }).requiresQuote, false);
});

test("summary is localized AR/EN, includes custom notes, caveats and final confirmation request", () => {
  const input = { extraLanguages: 1, store: true, note: "I need a size selector & filtering" };
  const en = message(input, "en");
  const ar = message(input, "ar");
  for (const text of [en, ar]) {
    assert.match(text, /\$45 USD/);
    assert.match(text, /size selector & filtering/);
    assert.match(text, /Vercel/);
  }
  assert.match(en, /not a final quote or a payment request/);
  assert.match(en, /External and recurring costs are separate/);
  assert.match(en, /Please confirm the final price/);
  assert.match(ar, /ليس عرض سعر نهائياً/);
  assert.match(ar, /غير المسعرة/);
});

test("invalid numbers and unexpected fields cannot set a total, and inputs are not mutated", () => {
  for (const extraLanguages of [NaN, Infinity, -4, "3", null]) assert.equal(estimate({ extraLanguages }).knownSubtotalUsd, 35);
  assert.equal(estimate({ extraLanguages: 1.9 }).knownSubtotalUsd, 45);
  assert.equal(estimate({ extraLanguages: 1000 }).selection.extraLanguages, MAX_GUIDE_LANGUAGES);
  const input = { updates: "admin", booking: true, priceUsd: 1, amountUsd: 1, note: "  notes  " };
  const before = JSON.stringify(input);
  assert.equal(estimate(input).knownSubtotalUsd, 35);
  assert.equal(JSON.stringify(input), before);
  assert.equal(estimate({ note: "x".repeat(2000) }).selection.note.length, MAX_GUIDE_NOTE);
});

test("all 1,056 combinations respect the known subtotal and shared-foundation rules", () => {
  let checked = 0;
  for (const updates of ["code", "admin", "unsure"]) {
    for (let count = 0; count <= MAX_GUIDE_LANGUAGES; count++) {
      for (let bits = 0; bits < 32; bits++) {
        const input = { updates, extraLanguages: count, booking: !!(bits & 1), store: !!(bits & 2), payment: !!(bits & 4), contentHelp: !!(bits & 8), customDomain: !!(bits & 16) };
        const connected = input.booking || input.store || input.payment;
        const result = estimate(input);
        const standaloneAdmin = updates === "admin" && !connected;
        assert.equal(result.knownSubtotalUsd, 35 + count * 10 + (standaloneAdmin ? 10 : 0));
        assert.equal(result.hasStartingPrice, standaloneAdmin);
        assert.equal(result.hasUnpricedOptions, connected || input.contentHelp || input.customDomain || updates === "unsure");
        checked++;
      }
    }
  }
  assert.equal(checked, 1056);
});

test("guide is shared by pricing and creation, linked from gallery and creation navigation", () => {
  const pricing = readFileSync("src/components/sections/pricing.tsx", "utf8");
  assert.match(pricing, /<WebsiteChoiceGuide \/>/);
  assert.match(readFileSync("src/components/website-creation-view.tsx", "utf8"), /<Pricing \/>/);
  assert.match(readFileSync("src/app/(site)/pricing/pricing-client.tsx", "utf8"), /<Pricing \/>/);
  assert.match(readFileSync("src/components/creation-anchor-nav.tsx", "utf8"), /#website-guide/);
  assert.match(readFileSync("src/app/(site)/demos/demos-client.tsx", "utf8"), /\/pricing#website-guide/);
});

test("UI offers direct contextual contact, copy fallback, native accessible inputs and no payment", () => {
  const source = readFileSync("src/components/website-choice-guide.tsx", "utf8");
  for (const pattern of [/whatsappLink\(config.whatsapp, message\)/, /href="\/contact"/, /navigator.clipboard.writeText\(message\)/, /setCopyState\("failed"\)/, /readOnly value=\{message\}/, /<fieldset/, /<legend/, /type="radio"/, /type="checkbox"/, /aria-live="polite"/, /htmlFor="guide-extra-languages"/, /htmlFor="guide-custom-note"/, /setSelection\(\{ \.\.\.DEFAULT_WEBSITE_GUIDE \}\)/]) assert.match(source, pattern);
  assert.doesNotMatch(source, /fetch\(|\/api\/payments|CheckoutDialog|localStorage|sessionStorage|dangerouslySetInnerHTML/);
  assert.match(source, /No order is placed and no extras are charged here/);
  assert.match(source, /not the project total/);
});


test("truncating an emoji at the note limit cannot break the encoded contact link", () => {
  const input = { note: "x".repeat(MAX_GUIDE_NOTE - 1) + "🙂" };
  assert.doesNotThrow(() => encodeURIComponent(message(input, "en")));
});


test("locale provider keeps the site default separate from the URL language for contact/guide links", () => {
  const source = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(source, /const primaryLocale = siteLocale\(config\)/);
  assert.match(source, /<I18nProvider defaultLocale=\{primaryLocale\}/);
});

test("SEO category backlink guard accepts the localized codes hub but not product links", () => {
  const source = readFileSync("scripts/seo-check.mjs", "utf8");
  const guard = source.match(/if \(!(.+)\.test\(html\)\) \{\s*record\(page, "error", "aucun lien de retour vers \/codes depuis le rayon"/);
  assert.ok(guard, "category backlink guard exists");
  const regex = new RegExp(guard[1].slice(1, -1));
  for (const href of ["/codes", "/codes?lang=en", "/codes?lang=ar"]) assert.ok(regex.test(`<a href="${href}">Codes</a>`), href);
  for (const href of ["/codes/example", "/codes/category/gift_card", "/codes-other"]) assert.equal(regex.test(`<a href="${href}">Other</a>`), false, href);
});
