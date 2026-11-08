#!/usr/bin/env node
/** Interrupteur admin du paiement manuel : rendu, persistance et gardes serveur. */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, mkdirSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import {
  normalizePhoneCardPaymentsEnabled,
  phoneCardUnavailableNotice,
  phoneCardDeliveryRoute,
} from "../src/lib/phone-card-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
mkdirSync(join(root, ".scratch"), { recursive: true });
const outDir = mkdtempSync(join(root, ".scratch", "phone-card-availability-"));
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const aliasPlugin = {
  name: "alias-at-src",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => {
      const base = join(root, "src", args.path.slice(2));
      const found = [base, `${base}.ts`, `${base}.tsx`].find((p) => existsSync(p) && statSync(p).isFile());
      return { path: found ?? base };
    });
  },
};

async function compile(entry, name, plugins = [aliasPlugin]) {
  const outfile = join(outDir, name);
  await build({
    entryPoints: [join(root, entry)], outfile, bundle: true, format: "esm",
    platform: "node", target: "node22", packages: "external", jsx: "automatic",
    plugins, logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

test("compatibilité ascendante : absent = activé ; seul true réactive explicitement", () => {
  assert.equal(normalizePhoneCardPaymentsEnabled(undefined), true);
  assert.equal(normalizePhoneCardPaymentsEnabled(true), true);
  for (const value of [false, null, "false", "true", 0, 1, {}]) {
    assert.equal(normalizePhoneCardPaymentsEnabled(value), false);
  }
});

test("message de pause bilingue : ne pas envoyer de code, crypto et anciennes commandes conservées", () => {
  assert.match(phoneCardUnavailableNotice("ar"), /لا ترسل رمز البطاقة/);
  assert.match(phoneCardUnavailableNotice("ar"), /العملات الرقمية/);
  assert.match(phoneCardUnavailableNotice("en"), /Do not submit a recharge code/);
  assert.match(phoneCardUnavailableNotice("en"), /crypto payment remains available/i);
  assert.match(phoneCardUnavailableNotice("en"), /Existing orders can still be processed/i);
});

test("la pause ne bloque jamais la revue/livraison d'une carte déjà acceptée", () => {
  assert.equal(phoneCardDeliveryRoute({ isPhoneCard: true, status: "approved", autoDeliver: true }), "supplier");
  assert.equal(phoneCardDeliveryRoute({ isPhoneCard: true, status: "approved" }), "manual");
  assert.equal(phoneCardDeliveryRoute({ isPhoneCard: true, status: "pending" }), "blocked");
  const review = read("src/lib/phone-card-payments.ts");
  assert.doesNotMatch(review, /readPhoneCardAvailability|phoneCardPaymentsEnabled/);
});

test("état dédié persistant : le formulaire global et sa réinitialisation ne l'écrasent pas", () => {
  const store = code(read("src/lib/store.ts"));
  assert.match(store, /KEY_PHONE_CARD_PAYMENTS_ENABLED = "phone_card_payments_enabled"/);
  assert.match(store, /mergeConfig\(map\.get\(KEY_CONFIG\), map\.get\(KEY_PHONE_CARD_PAYMENTS_ENABLED\)\)/);
  assert.match(store, /phoneCardPaymentsEnabled: normalizePhoneCardPaymentsEnabled\(phoneCardPaymentsEnabled\)/);
  const actions = code(read("src/app/admin/actions.ts"));
  const action = actions.slice(actions.indexOf("export async function setPhoneCardPaymentsEnabled"), actions.indexOf("/* ---------------- Contenu éditable"));
  assert.match(action, /await requireAdmin\(\)/);
  assert.match(action, /typeof enabled !== "boolean"/);
  assert.match(action, /upsertSetting\(SETTINGS_KEYS\.phoneCardPaymentsEnabled, enabled\)/);
  assert.ok(action.indexOf("await requireAdmin()") < action.indexOf("upsertSetting"));
  const reset = actions.slice(actions.indexOf("export async function resetSiteConfig"), actions.indexOf("export async function setPhoneCardPaymentsEnabled"));
  assert.match(reset, /deleteSetting\(SETTINGS_KEYS\.config\)/);
  assert.doesNotMatch(reset, /phoneCardPaymentsEnabled/);
  assert.doesNotMatch(read("src/lib/validation.ts"), /phoneCardPaymentsEnabled:/);
});

test("lecture serveur sans cache : activé, désactivé, base indisponible", async () => {
  globalThis.__availabilityRows = [];
  globalThis.__availabilityFailure = false;
  const stubs = {
    name: "availability-stubs",
    setup(builder) {
      builder.onResolve({ filter: /^@\/db$/ }, () => ({ path: "db", namespace: "stub" }));
      builder.onResolve({ filter: /^@\/db\/schema$/ }, () => ({ path: "schema", namespace: "stub" }));
      builder.onResolve({ filter: /^@\/lib\/store$/ }, () => ({ path: "store", namespace: "stub" }));
      builder.onLoad({ filter: /^db$/, namespace: "stub" }, () => ({ loader: "js", contents: `
        export async function ensureSchema() { if (globalThis.__availabilityFailure) throw new Error("database down"); }
        export const db = { select() { return { from() { return { where() { return { limit: async () => globalThis.__availabilityRows }; } }; } }; } };
      ` }));
      builder.onLoad({ filter: /^schema$/, namespace: "stub" }, () => ({ loader: "js", contents: "export const settings = { key: 'key', value: 'value' };" }));
      builder.onLoad({ filter: /^store$/, namespace: "stub" }, () => ({ loader: "js", contents: "export const SETTINGS_KEYS = { phoneCardPaymentsEnabled: 'phone_card_payments_enabled' };" }));
    },
  };
  const { readPhoneCardAvailability } = await compile("src/lib/phone-card-availability.ts", "availability.mjs", [stubs, aliasPlugin]);
  assert.equal(await readPhoneCardAvailability(), "enabled");
  globalThis.__availabilityRows = [{ value: false }];
  assert.equal(await readPhoneCardAvailability(), "disabled");
  globalThis.__availabilityRows = [{ value: true }];
  assert.equal(await readPhoneCardAvailability(), "enabled");
  globalThis.__availabilityFailure = true;
  assert.equal(await readPhoneCardAvailability(), "unavailable");
  delete globalThis.__availabilityRows;
  delete globalThis.__availabilityFailure;
});

test("checkout : garde avant chiffrement et relecture avant insertion, uniquement pour la carte", () => {
  const source = code(read("src/lib/fazercards-orders.ts"));
  const checkout = source.slice(source.indexOf("export async function createFazercardsCheckout"));
  const firstGate = checkout.indexOf("if (usesPhoneCard) await assertPhoneCardAvailable()");
  const encrypt = checkout.indexOf("preparePhoneCardPayment(input.phoneCard)");
  const insert = checkout.indexOf(".insert(digitalOrders)");
  const secondGate = checkout.indexOf("if (usesPhoneCard) await assertPhoneCardAvailable()", firstGate + 1);
  assert.ok(firstGate > 0 && firstGate < encrypt);
  assert.ok(secondGate > encrypt && secondGate < insert);
  assert.match(checkout, /PHONE_CARD_DISABLED_ERROR/);
  assert.match(checkout, /phone_card_availability_unavailable/);
  const quote = code(read("src/app/api/fazercards/phone-card-quote/route.ts"));
  assert.ok(quote.indexOf("await readPhoneCardAvailability()") < quote.indexOf("getPhoneCardLydQuote(amount)"));
  assert.match(quote, /availability !== "enabled"/);
  assert.match(quote, /"Cache-Control": "no-store"/);
});

test("admin : bouton présent sur tableau de bord, commandes et réglages, confirmation et erreurs", () => {
  for (const path of [
    "src/app/admin/(panel)/page.tsx",
    "src/app/admin/(panel)/digital/orders/page.tsx",
    "src/app/admin/(panel)/settings/settings-form.tsx",
  ]) {
    assert.match(read(path), /<PhoneCardPaymentsToggle enabled=/);
  }
  const toggle = read("src/app/admin/(panel)/phone-card-payments-toggle.tsx");
  assert.match(toggle, /role="switch"/);
  assert.match(toggle, /aria-checked=\{enabled\}/);
  assert.match(toggle, /window\.confirm/);
  assert.match(toggle, /setPhoneCardPaymentsEnabled\(next\)/);
  assert.match(toggle, /if \(result\.ok\)/);
  assert.match(toggle, /role=\{feedback\.ok \? "status" : "alert"\}/);
  assert.match(toggle, /réactivation uniquement de votre part/);
});

test("caisse publique : option désactivée et explication AR/EN, crypto conservée", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  // Un seul bundle partage les contextes React entre providers et dialogue.
  const outfile = join(outDir, "buy-dialog-tree.mjs");
  await build({
    stdin: { contents: `
      export { DigitalBuyDialog } from "@/components/digital-buy-dialog";
      export { SiteProvider } from "@/components/site-provider";
      export { I18nProvider } from "@/lib/i18n";
      export { siteConfig } from "@/lib/config";
    `, resolveDir: root, loader: "ts" },
    outfile, bundle: true, format: "esm", platform: "node", target: "node22",
    packages: "external", jsx: "automatic", plugins: [aliasPlugin], logLevel: "silent",
  });
  const { DigitalBuyDialog, SiteProvider, I18nProvider, siteConfig } = await import(pathToFileURL(outfile).href);
  const product = {
    id: "fzr-giftcard-test", slug: "test", kind: "gift_card", status: "available",
    platform: "Test", color: "#000000", titleAr: "اختبار", titleEn: "Test",
    descriptionAr: "", descriptionEn: "", image: "", regions: ["global"],
    featuresAr: [], featuresEn: [], deliveryNoteAr: "", deliveryNoteEn: "",
    sortOrder: 0, supplier: "fazercards",
    denominations: [{ id: "10", label: "$10", faceValue: "10 USD", region: "global", priceUsd: 10, available: true, fields: [] }],
  };
  for (const locale of ["ar", "en"]) {
    for (const enabled of [true, false]) {
      const config = { ...siteConfig, fazercards: { ...siteConfig.fazercards, phoneCardPaymentsEnabled: enabled } };
      const html = renderToStaticMarkup(createElement(I18nProvider, { defaultLocale: locale },
        createElement(SiteProvider, { config, content: {} }, createElement(DigitalBuyDialog, { product, denominationId: "10", onClose() {} }))));
      const text = html.replace(/<[^>]*>/g, " ");
      assert.match(text, locale === "ar" ? /عملات رقمية/ : /Crypto/);
      if (enabled) {
        assert.doesNotMatch(html, /id="phone-card-paused-notice"/);
        const phoneButton = html.match(/<button[^>]*>[\s\S]*?<\/button>/g)?.find((button) => button.includes('lucide-smartphone'));
        assert.ok(phoneButton);
        assert.doesNotMatch(phoneButton, /disabled=""/);
      } else {
        assert.match(html, /id="phone-card-paused-notice"/);
        const phoneButton = html.match(/<button[^>]*>[\s\S]*?<\/button>/g)?.find((button) => button.includes('lucide-smartphone'));
        assert.ok(phoneButton);
        assert.match(phoneButton, /disabled=""/);
        assert.match(text, locale === "ar" ? /الدفع اليدوي متوقف مؤقتاً/ : /Manual payments temporarily paused/);
        assert.doesNotMatch(text, /Recharge card code|رمز بطاقة التعبئة/);
      }
    }
  }
  const dialog = code(read("src/components/digital-buy-dialog.tsx"));
  assert.match(dialog, /const paymentMethod = phoneCardEnabled \? selectedPaymentMethod : "nowpayments"/);
  assert.match(dialog, /data\.error === PHONE_CARD_DISABLED_ERROR/);
  assert.match(dialog, /setCardCode\(""\)/);
});

test("assistant : il annonce la pause et ne promet pas de date de retour", async () => {
  const assistant = await compile("src/lib/site-assistant.ts", "assistant.mjs");
  const { siteConfig } = await compile("src/lib/config.ts", "config-assistant.mjs");
  const content = { demos: [], faqs: [], testimonials: [], hero: {}, ribbon: {}, whyUs: [], process: [], headings: {}, layout: { entries: [], customSections: [] }, appsPage: { items: [] }, productsPage: { items: [] } };
  const config = { ...siteConfig, fazercards: { ...siteConfig.fazercards, phoneCardPaymentsEnabled: false } };
  const knowledge = assistant.buildSiteKnowledge({ config, content });
  assert.equal(knowledge.phoneCardPaymentsEnabled, false);
  assert.match(knowledge.core, /TEMPORARILY PAUSED/);
  const prompt = assistant.buildSystemPrompt(knowledge, ["Can I pay with a Libyana card?"], "en");
  assert.match(prompt, /Do not invent a return date or bypass the pause/);
  const reply = assistant.answerLocally(knowledge, "Can I pay with a Libyana phone card?", "en");
  assert.match(reply.text, /temporarily paused/i);
  assert.match(reply.text, /Crypto remains available/i);
});
