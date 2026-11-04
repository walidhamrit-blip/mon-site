#!/usr/bin/env node
/**
 * Tests de l'assistant du site (`src/lib/site-assistant.ts` + `/api/chat`).
 *
 *   npm run test:assistant
 *
 * Vérifie que l'assistant couvre TOUT le contenu du site (formules,
 * paiement, abonnements, services, codes digitaux, portfolio, secteurs,
 * comparatifs, blog, apps, produits, conditions, remboursement, badge,
 * contact) en arabe, anglais et français, et que la route API respecte
 * CSRF, rate-limit, historique et repli sans clé. Aucun accès réseau.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, mkdirSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
// Les plafonds de la boutique sont lus depuis la politique (et non recopiés) :
// quand le plafond change, l'attente suit au lieu de casser la CI.
import {
  MAX_DIGITAL_ORDER_USD,
  MAX_GIFT_CARD_PRICE_USD,
} from "../src/lib/digital-sales-policy.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
// Sortie dans le dépôt : les dépendances externes (`packages: "external"`)
// doivent rester résolubles depuis node_modules.
mkdirSync(join(root, ".scratch"), { recursive: true });
const outDir = mkdtempSync(join(root, ".scratch", "site-assistant-"));

const aliasPlugin = {
  name: "alias-at-src",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => {
      const base = join(srcRoot, args.path.slice(2));
      const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, join(base, "index.ts")];
      const found = candidates.find((c) => existsSync(c) && statSync(c).isFile());
      return { path: found ?? base };
    });
  },
};

/** Simule la base et le catalogue : aucune connexion Neon dans les tests. */
const stubsPlugin = {
  name: "assistant-stubs",
  setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/store$/ }, () => ({ path: "store", namespace: "stub" }));
    builder.onResolve({ filter: /^@\/lib\/digital-store$/ }, () => ({ path: "digital", namespace: "stub" }));
    builder.onResolve({ filter: /^@\/db$/ }, () => ({ path: "db", namespace: "stub" }));
    builder.onLoad({ filter: /^store$/, namespace: "stub" }, () => ({
      loader: "js",
      contents: `export async function getSiteDataCached() { return globalThis.__assistantSite; }`,
    }));
    builder.onLoad({ filter: /^digital$/, namespace: "stub" }, () => ({
      loader: "js",
      contents: `
        export async function getDigitalCatalog() { return globalThis.__assistantProducts ?? []; }
        export function digitalCatalogStatus() { return { degraded: Boolean(globalThis.__assistantDegraded), reason: null, message: null, since: null }; }
      `,
    }));
    builder.onLoad({ filter: /^db$/, namespace: "stub" }, () => ({ loader: "js", contents: "export const db = {}; export async function ensureSchema() {}" }));
  },
};

async function compileModule(relPath, outName, plugins = [aliasPlugin]) {
  const outfile = join(outDir, outName);
  await build({
    entryPoints: [join(srcRoot, relPath)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    packages: "external",
    jsx: "automatic",
    plugins,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const assistant = await compileModule("lib/site-assistant.ts", "site-assistant.mjs");
const { siteConfig } = await compileModule("lib/config.ts", "config.mjs");
const content = await compileModule("lib/content.ts", "content.mjs");
const { defaultDigitalProducts } = await compileModule("lib/digital-seed.ts", "digital-seed.mjs");
const chatbot = await compileModule("lib/chatbot.ts", "chatbot.mjs");

const siteContent = {
  demos: content.demos.map((d) => ({ ...d })),
  faqs: content.faqs.map((f) => ({ ...f })),
  testimonials: content.testimonials.map((t) => ({ ...t })),
  hero: content.heroContent,
  ribbon: content.servicesRibbonContent,
  whyUs: content.defaultWhyUs,
  process: content.defaultProcess,
  headings: content.defaultSectionHeadings,
  layout: content.defaultHomeLayout,
  appsPage: content.defaultAppsPage,
  productsPage: content.defaultProductsPage,
};

const knowledge = assistant.buildSiteKnowledge({
  config: siteConfig,
  content: siteContent,
  digitalProducts: defaultDigitalProducts,
  degraded: false,
});

test.after(() => rmSync(outDir, { recursive: true, force: true }));

/* ───────────────────────── Index ───────────────────────────────────────── */

test("l'index couvre toutes les sections du site", () => {
  const sections = new Set(knowledge.docs.map((d) => d.section));
  for (const section of ["general", "pricing", "payment", "subscriptions", "services", "digital", "product", "demos", "sectors", "compare", "blog", "apps", "products", "legal", "contact", "faq"]) {
    assert.ok(sections.has(section), `section manquante : ${section}`);
  }
  const ids = knowledge.docs.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, "identifiants de fiches dupliqués");
  for (const id of ["plan-vitrine", "plan-boutique", "service-restyle", "service-fix-optimize", "service-add-section", "sector-medical", "sector-sanitary", "compare-wix", "compare-seo-agency", "blog-how-to-pay-with-crypto-usdt", "demo-myphone-tripoli", "apps-nukhba-clinic-app", "products-nukhba-cloud-pos", "terms", "refund", "badge", "contact", "subscription-tracking", "digital-delivery"]) {
    assert.ok(ids.includes(id), `fiche manquante : ${id}`);
  }
  assert.equal(knowledge.productCount, defaultDigitalProducts.length);
});

test("le résumé LLM cite les prix exacts, les horaires et les limites de la boutique", () => {
  assert.match(knowledge.core, /Vitrine \(vitrine\): model \$300 \+ 20% customization \$60 = total \$360/);
  assert.match(knowledge.core, /Boutique \(boutique\): model \$880/);
  assert.match(knowledge.core, /\$10\/mo or \$69\/yr/);
  assert.match(knowledge.core, /\$25\/mo or \$199\/yr/);
  assert.match(knowledge.core, /grace period max 5 days/);
  assert.match(
    knowledge.core,
    new RegExp(
      `Max \\$${MAX_DIGITAL_ORDER_USD} per order, gift cards ≤ \\$${MAX_GIFT_CARD_PRICE_USD}`,
    ),
  );
  assert.match(knowledge.core, /Player ID/);
  assert.match(knowledge.core, new RegExp(siteConfig.hoursEn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(knowledge.core, /Never claim 24\/7/);
  assert.doesNotMatch(knowledge.core, /reloadly/i);
});

/* ───────────────────────── Langue ──────────────────────────────────────── */

test("detectLanguage reconnaît AR / EN / FR et respecte le repli", () => {
  assert.equal(assistant.detectLanguage("كم سعر الموقع؟", "en"), "ar");
  assert.equal(assistant.detectLanguage("How much is a website?", "ar"), "en");
  assert.equal(assistant.detectLanguage("Combien coûte un site vitrine ?", "en"), "fr");
  assert.equal(assistant.detectLanguage("Quels sont vos abonnements", "ar"), "fr");
  assert.equal(assistant.detectLanguage("steam", "ar"), "en");
  assert.equal(assistant.detectLanguage("xyz", "fr"), "fr");
});

/* ───────────────────────── Recherche ───────────────────────────────────── */

const expectTop = (query, expectedId, lang = "en") => {
  const hits = assistant.searchKnowledge(knowledge, query, 5);
  assert.ok(hits.length > 0, `aucun résultat pour « ${query} »`);
  const ids = hits.slice(0, 3).map((h) => h.doc.id);
  assert.ok(ids.includes(expectedId), `« ${query} » (${lang}) → attendu ${expectedId}, obtenu ${ids.join(", ")}`);
};

test("recherche EN : chaque domaine du site est retrouvé", () => {
  expectTop("How much does a website cost?", "pricing-overview");
  expectTop("What's included in the Boutique plan?", "plan-boutique");
  expectTop("How do I pay with USDT?", "payment");
  expectTop("Can I reserve a slot with a deposit?", "reservation");
  expectTop("What are your subscription prices for hosting?", "subscriptions");
  expectTop("How do I cancel my subscription?", "subscription-tracking");
  expectTop("How much is a landing page?", "service-landing");
  expectTop("Do you redesign old websites?", "service-restyle");
  expectTop("Where is my order? I didn't receive my code", "digital-delivery");
  expectTop("Buy a Steam gift card", "digital-overview");
  expectTop("Show me examples of clinic websites", "sector-medical");
  expectTop("Nukhba vs Wix", "compare-wix");
  expectTop("How to get cited by ChatGPT", "blog-get-cited-by-chatgpt-google-ai");
  expectTop("Do you have a mobile app for clinics?", "apps-nukhba-clinic-app");
  expectTop("Cloud POS software", "products-nukhba-cloud-pos");
  expectTop("What is your refund policy?", "refund");
  expectTop("Terms and conditions, who owns the website?", "terms");
  expectTop("What is the footer badge?", "badge");
  expectTop("What are your opening hours?", "contact");
  expectTop("How long does it take to build the site?", "process");
});

test("recherche AR : chaque domaine du site est retrouvé", () => {
  expectTop("كم سعر الموقع؟", "pricing-overview", "ar");
  expectTop("كيف أدفع بالعملات الرقمية؟", "payment", "ar");
  expectTop("ما هي الاشتراكات الشهرية؟", "subscriptions", "ar");
  expectTop("أين طلبي؟ لم يصلني الكود", "digital-delivery", "ar");
  expectTop("أريد بطاقة هدايا بلايستيشن", "product-playstation-store", "ar");
  expectTop("هل تصممون مواقع مطاعم؟", "sector-restaurant", "ar");
  expectTop("ما سياسة الاسترداد؟", "refund", "ar");
  expectTop("ما هي ساعات العمل؟", "contact", "ar");
  expectTop("كم يستغرق تنفيذ الموقع؟", "process", "ar");
  expectTop("ما خدماتكم المفتوحة؟", "services-overview", "ar");
  expectTop("إعادة تصميم موقع قديم", "service-restyle", "ar");
  expectTop("هل لديكم تطبيقات؟", "apps-overview", "ar");
});

test("recherche FR : les synonymes français atteignent les bonnes fiches", () => {
  expectTop("Combien coûte un site ?", "pricing-overview", "fr");
  expectTop("Comment payer en crypto ?", "payment", "fr");
  expectTop("Quels sont vos abonnements ?", "subscriptions", "fr");
  expectTop("Où est ma commande ?", "digital-delivery", "fr");
  expectTop("Je veux une carte cadeau Steam", "digital-overview", "fr");
  expectTop("Politique de remboursement", "refund", "fr");
  expectTop("Quels sont vos horaires ?", "contact", "fr");
  expectTop("Vos services à la carte", "services-overview", "fr");
  expectTop("Avez-vous des applications mobiles ?", "apps-overview", "fr");
});

test("les produits digitaux sont retrouvés par plateforme / slug", () => {
  const first = defaultDigitalProducts[0];
  const hits = assistant.searchKnowledge(knowledge, first.titleEn, 5);
  assert.ok(hits.some((h) => h.doc.id === `product-${first.slug}`), `produit ${first.slug} introuvable`);
});

/* ───────────────────────── Réponse locale ──────────────────────────────── */

test("answerLocally : salutations, remerciements, inconnu", () => {
  const hello = assistant.answerLocally(knowledge, "Bonjour", "fr");
  assert.match(hello.text, /assistant Nukhba/);
  assert.equal(hello.suggestions.length, 8);
  const thanks = assistant.answerLocally(knowledge, "شكراً", "ar");
  assert.match(thanks.text, /الرحب/);
  const unknown = assistant.answerLocally(knowledge, "zzzz qqqq", "en");
  assert.match(unknown.text, /couldn't find/);
  assert.equal(unknown.actions[0].external, true);
  assert.equal(unknown.mode, "local");
});

test("answerLocally : réponses exactes AR/EN/FR avec bouton vers la page", () => {
  const price = assistant.answerLocally(knowledge, "كم سعر الموقع؟", "ar");
  assert.match(price.text, /\$300/);
  assert.match(price.text, /\$360/);
  assert.equal(price.actions[0].href, "/pricing");
  assert.ok(price.suggestions.length >= 2 && price.suggestions.length <= 4);

  const subs = assistant.answerLocally(knowledge, "What are the subscriptions?", "en");
  assert.match(subs.text, /\$10\/month or \$69\/year/);
  assert.match(subs.text, /at most 5 days/);
  assert.equal(subs.actions[0].href, "/abonnements");

  const order = assistant.answerLocally(knowledge, "Où est ma commande ?", "fr");
  assert.match(order.text, /Player ID/);
  assert.equal(order.actions[0].href, "/codes/commande");

  const hours = assistant.answerLocally(knowledge, "What are your opening hours?", "en");
  assert.match(hours.text, /Sat - Thu/);
  assert.doesNotMatch(hours.text, /24\/7/);
  assert.equal(hours.actions[0].external, true);
  assert.match(hours.actions[0].href, /^https:\/\/wa\.me\//);
});

test("catalogue dégradé : aucun prix produit, message d'indisponibilité", () => {
  const degraded = assistant.buildSiteKnowledge({
    config: siteConfig,
    content: siteContent,
    digitalProducts: defaultDigitalProducts,
    degraded: true,
  });
  assert.equal(degraded.productCount, 0);
  assert.ok(!degraded.docs.some((d) => d.section === "product"));
  assert.match(degraded.core, /TEMPORARILY UNAVAILABLE/);
  const reply = assistant.answerLocally(degraded, "Buy a Steam gift card", "en");
  assert.match(reply.text, /temporarily unavailable/);
});

/* ───────────────────────── Prompt LLM ──────────────────────────────────── */

test("buildSystemPrompt : langue, règles et fiches pertinentes (requête + contexte)", () => {
  const prompt = assistant.buildSystemPrompt(knowledge, ["What are the subscriptions?", "and how do I cancel?"], "fr");
  assert.match(prompt, /Answer in French/);
  assert.match(prompt, /Track or cancel a subscription/);
  assert.match(prompt, /Subscriptions \(hosting & maintenance\)/);
  assert.match(prompt, /never invent numbers/);
  assert.match(prompt, /crypto only/);
  assert.ok(prompt.length < 40_000, `prompt trop long : ${prompt.length}`);
  assert.doesNotMatch(prompt, /reloadly/i);
});

test("le prompt reste borné même avec un grand catalogue (2 000 produits)", () => {
  const many = Array.from({ length: 2000 }, (_, i) => ({
    ...defaultDigitalProducts[i % defaultDigitalProducts.length],
    id: `p-${i}`,
    slug: `product-${i}`,
    titleEn: `Product ${i}`,
    titleAr: `منتج ${i}`,
  }));
  const big = assistant.buildSiteKnowledge({ config: siteConfig, content: siteContent, digitalProducts: many });
  assert.equal(big.productCount, 2000);
  const prompt = big && assistant.buildSystemPrompt(big, ["Product 1457 price"], "en");
  assert.match(prompt, /Product 1457/);
  assert.ok(prompt.length < 40_000, `prompt trop long : ${prompt.length}`);
});

test("actionsFromText transforme les chemins cités en boutons", () => {
  const actions = assistant.actionsFromText("Voir /pricing et /codes/commande, ou WhatsApp.", knowledge, "fr");
  assert.deepEqual(actions.map((a) => a.href), ["/pricing", "/codes/commande"]);
  assert.match(actions[0].label, /^Ouvrir la page/);
});

/* ───────────────────────── Arbre local (repli client) ──────────────────── */

test("chatbot.ts : les nœuds locaux couvrent les nouveaux domaines en AR/EN/FR", () => {
  const nodes = chatbot.buildChatNodes({
    locale: "en",
    plans: siteConfig.pricing.plans,
    currency: "$",
    currencyEn: "$",
    whatsappHref: "https://wa.me/1",
    reservationUsd: 1,
    hours: siteConfig.hoursEn,
    phone: siteConfig.phone,
    email: siteConfig.email,
    address: siteConfig.addressEn,
    services: siteConfig.standaloneServices,
  });
  for (const id of chatbot.START_NODES) assert.ok(nodes[id], `nœud de départ manquant : ${id}`);
  assert.equal(chatbot.matchChatNode("Quels abonnements proposez-vous ?", nodes), "subscriptions");
  assert.equal(chatbot.matchChatNode("أين طلبي؟", nodes), "order");
  assert.equal(chatbot.matchChatNode("carte cadeau steam", nodes), "codes");
  assert.equal(chatbot.matchChatNode("refund please", nodes), "refund");
  assert.equal(chatbot.matchChatNode("What services do you offer?", nodes), "services");
  assert.match(nodes.services.answer, /\$49/);
  assert.match(nodes.contact.answer, new RegExp(siteConfig.phone.replace(/[+]/g, "\\+")));
});

/* ───────────────────────── Route /api/chat ─────────────────────────────── */

globalThis.__assistantSite = { config: siteConfig, content: siteContent };
globalThis.__assistantProducts = defaultDigitalProducts;
globalThis.__assistantDegraded = false;
delete process.env.AI_GATEWAY_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.CHAT_API_KEY;
delete process.env.INTERNAL_API_SECRET;

const route = await compileModule("app/api/chat/route.ts", "chat-route.mjs", [stubsPlugin, aliasPlugin]);

const ORIGIN = `https://${siteConfig.domain}`;
let ipCounter = 0;
function post(body, { origin = ORIGIN, ip } = {}) {
  const headers = { "Content-Type": "application/json", "x-forwarded-for": ip ?? `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}` };
  if (origin) headers.Origin = origin;
  return route.POST(new Request(`${ORIGIN}/api/chat`, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
}

test("/api/chat refuse les origines étrangères (CSRF)", async () => {
  const res = await post({ prompt: "hello" }, { origin: "https://evil.example" });
  assert.equal(res.status, 403);
});

test("/api/chat valide le corps", async () => {
  assert.equal((await post("not json")).status, 400);
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ prompt: "x".repeat(1001) })).status, 400);
  assert.equal((await post({ messages: [{ role: "assistant", content: "hi" }] })).status, 400);
});

test("/api/chat sans clé → réponse locale complète en AR/EN/FR", async () => {
  const ar = await (await post({ prompt: "كم سعر الموقع؟", locale: "ar" })).json();
  assert.equal(ar.mode, "local");
  assert.match(ar.text, /\$360/);
  assert.equal(ar.actions[0].href, "/pricing");

  const fr = await (await post({ prompt: "Comment payer en USDT ?", locale: "en" })).json();
  assert.match(fr.text, /NOWPayments/);
  assert.ok(fr.suggestions.some((s) => /coûte|commande|abonnements|humain|carte cadeau/i.test(s)), `suggestions FR attendues, obtenu : ${fr.suggestions.join(" | ")}`);

  const en = await (await post({ messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "Hi!" }, { role: "user", content: "What is your refund policy?" }], locale: "en" })).json();
  assert.match(en.text, /full-refund guarantee/i);
  assert.equal(en.actions[0].href, "/remboursement");
});

test("/api/chat catalogue dégradé → pas de prix produit", async () => {
  globalThis.__assistantDegraded = true;
  try {
    const reply = await (await post({ prompt: "Buy a Steam gift card", locale: "en" })).json();
    assert.match(reply.text, /temporarily unavailable/);
  } finally {
    globalThis.__assistantDegraded = false;
  }
});

test("/api/chat limite le débit (429 + Retry-After)", async () => {
  const ip = "203.0.113.77";
  let last;
  for (let i = 0; i < 25; i++) {
    last = await post({ prompt: `ping ${i}` }, { ip });
    if (last.status === 429) break;
  }
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get("Retry-After")) >= 1);
});

test("/api/chat avec OPENAI_API_KEY : prompt ancré, historique transmis, mode llm", async () => {
  process.env.OPENAI_API_KEY = "sk-test";
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ choices: [{ message: { content: "Les abonnements sont sur /abonnements. Écrivez-nous sur WhatsApp." } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const res = await post({
      locale: "en",
      messages: [
        { role: "user", content: "Bonjour" },
        { role: "assistant", content: "Bonjour !" },
        { role: "user", content: "Quels sont vos abonnements ?" },
      ],
    });
    const reply = await res.json();
    assert.equal(reply.mode, "llm");
    assert.match(captured.url, /chat\/completions$/);
    assert.equal(captured.body.messages[0].role, "system");
    assert.match(captured.body.messages[0].content, /Answer in French/);
    assert.match(captured.body.messages[0].content, /\$10\/mo or \$69\/yr/);
    assert.equal(captured.body.messages.length, 4);
    assert.equal(captured.body.messages.at(-1).content, "Quels sont vos abonnements ?");
    assert.equal(reply.actions[0].href, "/abonnements");
    assert.ok(reply.actions.some((a) => a.external));
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test("/api/chat avec GEMINI_API_KEY : endpoint Gemini compatible OpenAI, prioritaire, modèle par défaut", async () => {
  process.env.GEMINI_API_KEY = "AIza-test";
  process.env.OPENAI_API_KEY = "sk-should-not-be-used";
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), auth: init.headers.Authorization, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ choices: [{ message: { content: "Les tarifs sont sur /pricing." } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const reply = await (await post({ prompt: "Combien coûte un site ?", locale: "en" })).json();
    assert.equal(reply.mode, "llm");
    assert.equal(captured.url, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    assert.equal(captured.auth, "Bearer AIza-test");
    assert.equal(captured.body.model, "gemini-2.5-flash");
    assert.equal(captured.body.reasoning_effort, "low");
    assert.equal(reply.provider, "gemini");
    assert.equal(captured.body.messages[0].role, "system");
    assert.match(captured.body.messages[0].content, /Answer in French/);
    assert.equal(reply.actions[0].href, "/pricing");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  }
});

test("/api/chat avec CHAT_API_KEY : fournisseur compatible OpenAI configurable (ex. DeepSeek)", async () => {
  process.env.CHAT_API_KEY = "ds-test";
  process.env.CHAT_BASE_URL = "https://api.deepseek.com/v1/";
  process.env.CHAT_MODEL = "deepseek-chat";
  const originalFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const reply = await (await post({ prompt: "hello there", locale: "en" })).json();
    assert.equal(reply.mode, "llm");
    assert.equal(captured.url, "https://api.deepseek.com/v1/chat/completions");
    assert.equal(captured.body.model, "deepseek-chat");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.CHAT_API_KEY;
    delete process.env.CHAT_BASE_URL;
    delete process.env.CHAT_MODEL;
  }
});

test("/api/chat Gemini : 404 sur le modèle → essai des modèles de repli, config normalisée", async () => {
  process.env.GEMINI_API_KEY = "AIza-test";
  process.env.GEMINI_MODEL = "models/gemini-9-pro";
  process.env.GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/";
  const originalFetch = globalThis.fetch;
  const tried = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    tried.push({ url: String(url), model: body.model });
    if (body.model !== "gemini-2.0-flash") {
      return new Response(JSON.stringify({ error: { code: 404, message: `models/${body.model} is not found` } }), { status: 404 });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: "Voir /pricing." } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const reply = await (await post({ prompt: "Combien coûte un site ?", locale: "fr" })).json();
    assert.equal(reply.mode, "llm");
    assert.deepEqual(tried.map((t) => t.model), ["gemini-9-pro", "gemini-2.5-flash", "gemini-2.0-flash"]);
    assert.equal(tried[0].url, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_BASE_URL;
  }
});

test("GET /api/chat : diagnostic du fournisseur sans secret", async () => {
  let diag = await (await route.GET()).json();
  assert.deepEqual(diag, { assistant: "ok", provider: null, model: null, mode: "local" });
  process.env.GEMINI_API_KEY = "AIza-test";
  try {
    diag = await (await route.GET()).json();
    assert.equal(diag.provider, "gemini");
    assert.equal(diag.model, "gemini-2.5-flash");
    assert.equal(diag.mode, "llm");
    assert.ok(!JSON.stringify(diag).includes("AIza-test"));
  } finally {
    delete process.env.GEMINI_API_KEY;
  }
});

test("/api/chat : échec LLM → repli local transparent", async () => {
  process.env.OPENAI_API_KEY = "sk-test";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("upstream down", { status: 502 });
  try {
    const reply = await (await post({ prompt: "What are the subscriptions?", locale: "en" })).json();
    assert.equal(reply.mode, "local");
    assert.equal(reply.provider, "openai");
    assert.match(reply.fallback, /HTTP 502/);
    assert.match(reply.text, /\$69\/year/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

/* ───────────────────────── Garde-fous statiques ────────────────────────── */

test("aucune mention du fournisseur retiré ni de « support 24/7 » dans l'assistant", () => {
  for (const file of ["src/lib/site-assistant.ts", "src/lib/chatbot.ts", "src/app/api/chat/route.ts", "src/components/site-chatbot.tsx"]) {
    const source = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(source, /reloadly/i, `${file} mentionne le fournisseur retiré`);
    // Les lignes qui interdisent explicitement la promesse sont autorisées.
    const promises = source.split("\n").filter((line) => /24\/7/.test(line) && !/never/i.test(line));
    assert.deepEqual(promises, [], `${file} promet un support 24/7`);
  }
});
