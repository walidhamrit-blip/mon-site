import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  botCopy,
  composeBroadcast,
  detectTelegramLocale,
  escapeTelegramHtml,
  fillTemplate,
  formatBotOrderSummary,
  formatCustomerRelay,
  formatLeadAlert,
  formatPaymentAlert,
  isTelegramBotToken,
  languageKeyboard,
  mainMenuKeyboard,
  offersKeyboard,
  orderRefFromText,
  parseTelegramCommand,
  sanitizeStartPayload,
  telegramClamp,
  telegramDeepLink,
  validateBroadcast,
  botCommandList,
} from "../src/lib/telegram-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/* ------------------------------- Jeton & liens ---------------------------- */

test("le jeton BotFather est validé avant tout appel réseau", () => {
  assert.equal(isTelegramBotToken("123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"), true);
  assert.equal(isTelegramBotToken(" 123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw "), true);
  assert.equal(isTelegramBotToken('"123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"'), false);
  assert.equal(isTelegramBotToken("123456789"), false);
  assert.equal(isTelegramBotToken("abc:def"), false);
  assert.equal(isTelegramBotToken(undefined), false);
});

test("le lien profond t.me encode la source et rejette le bruit", () => {
  assert.equal(telegramDeepLink("@nukhba_bot"), "https://t.me/nukhba_bot");
  assert.equal(
    telegramDeepLink("nukhba_bot", "Instagram Bio!"),
    "https://t.me/nukhba_bot?start=instagram-bio",
  );
  assert.equal(telegramDeepLink("", "site"), "");
  assert.equal(sanitizeStartPayload("--A__b--"), "a__b");
  assert.equal(sanitizeStartPayload(null), "");
  assert.equal(sanitizeStartPayload("x".repeat(200)).length, 64);
});

/* --------------------------------- Langues -------------------------------- */

test("le bot parle arabe, français et anglais", () => {
  assert.equal(detectTelegramLocale("كم سعر البطاقة؟"), "ar");
  assert.equal(detectTelegramLocale("Bonjour, je veux suivre ma commande"), "fr");
  assert.equal(detectTelegramLocale("Hello, where is my order?"), "en");
  assert.equal(detectTelegramLocale("", "fr"), "fr");
  // Les trois dictionnaires exposent les mêmes clés : aucune bulle vide.
  const reference = Object.keys(botCopy("fr")).sort();
  for (const lang of ["ar", "en"]) {
    assert.deepEqual(Object.keys(botCopy(lang)).sort(), reference, lang);
    assert.ok(botCopy(lang).welcome.length > 20, lang);
    assert.ok(botCopy(lang).statusLabels.delivered.length > 0, lang);
  }
});

/* -------------------------------- Références ------------------------------ */

test("une référence de commande se retrouve dans un message libre", () => {
  assert.equal(orderRefFromText("ma commande DGC-1A2B3C4D5E6F svp"), "DGC-1A2B3C4D5E6F");
  assert.equal(orderRefFromText("nkh-abcdef123456"), "NKH-ABCDEF123456");
  assert.equal(orderRefFromText("LIV-001122334455"), "LIV-001122334455");
  assert.equal(orderRefFromText("bonjour"), null);
  assert.equal(orderRefFromText("DGC-123"), null);
  assert.equal(orderRefFromText(undefined), null);
});

test("les commandes Telegram tolèrent le suffixe @bot", () => {
  assert.deepEqual(parseTelegramCommand("/start site"), { command: "start", args: "site" });
  assert.deepEqual(parseTelegramCommand("/commande@nukhba_bot DGC-1A2B3C4D5E6F"), {
    command: "commande",
    args: "DGC-1A2B3C4D5E6F",
  });
  assert.deepEqual(parseTelegramCommand("  bonjour  "), { command: "", args: "bonjour" });
  assert.deepEqual(parseTelegramCommand("/stop"), { command: "stop", args: "" });
});

/* ---------------------------------- Rendus -------------------------------- */

test("le HTML dynamique est échappé, jamais interprété", () => {
  assert.equal(escapeTelegramHtml("<b>a</b> & b"), "&lt;b&gt;a&lt;/b&gt; &amp; b");
  const alert = formatLeadAlert(
    {
      name: "<script>alert(1)</script>",
      business: "Test & Co",
      phone: "+218 91 000 0000",
      email: "client@example.com",
      need: "Site vitrine",
      budget: "500 USD",
      deadline: "2 semaines",
      message: "Bonjour <b>",
      locale: "fr",
      utm: "utm_source=instagram",
    },
    "Nukhba",
  );
  assert.doesNotMatch(alert, /<script>/);
  assert.match(alert, /&lt;script&gt;/);
  assert.match(alert, /Nouvelle demande/);
  assert.match(alert, /Site vitrine/);

  const payment = formatPaymentAlert(
    {
      ref: "DGC-1A2B3C4D5E6F",
      kind: "digital",
      planName: "Steam 20$",
      amountUsd: "22.50",
      payCurrency: "usdttrc20",
      payAmount: "22.60",
      installments: 3,
      installmentIndex: 2,
      groupRef: "NKH-ABC",
      clientName: "Client <x>",
    },
    "Nukhba",
    "https://nokhba.net.ly",
  );
  assert.match(payment, /Paiement confirmé/);
  assert.match(payment, /22\.50 USD/);
  assert.match(payment, /22\.60 USDTTRC20/);
  assert.match(payment, /Tranche 2\/3/);
  assert.match(payment, /https:\/\/nokhba\.net\.ly\/admin\/orders/);
  assert.doesNotMatch(payment, /<x>/);

  assert.match(
    formatPaymentAlert(
      {
        ref: "NKH-1",
        kind: "plan",
        planName: "Plan",
        amountUsd: "100",
      },
      "Nukhba",
      "https://nokhba.net.ly",
      "failed",
    ),
    /Paiement échoué/,
  );
});

test("la fiche de suivi ne divulgue ni code ni donnée personnelle", () => {
  const summary = formatBotOrderSummary(
    {
      ref: "DGC-1A2B3C4D5E6F",
      kind: "digital",
      title: "Carte PSN 25$",
      status: "delivered",
      totalUsd: "26.00",
      createdAt: "2026-11-08T10:00:00.000Z",
      trackingUrl: "https://nokhba.net.ly/codes/commande?ref=DGC-1A2B3C4D5E6F",
    },
    "fr",
    "Nukhba",
  );
  assert.match(summary, /DGC-1A2B3C4D5E6F/);
  assert.match(summary, /Carte PSN 25\$/);
  assert.match(summary, /Livré/);
  assert.match(summary, /jamais envoyés sur Telegram/);
  // Aucun champ de code carte ne doit apparaître.
  assert.doesNotMatch(summary, /code_cipher|PIN|cardNumber/i);

  const arabic = formatBotOrderSummary(
    {
      ref: "NKH-ABCDEF123456",
      kind: "web",
      title: "Site vitrine",
      status: "pending",
      totalUsd: "450.00",
      createdAt: "2026-11-08T10:00:00.000Z",
      trackingUrl: "https://nokhba.net.ly/pay/success?ref=NKH-ABCDEF123456",
    },
    "ar",
    "Nukhba",
  );
  assert.match(arabic, /بانتظار الدفع/);
});

test("le relais client contient le chat id mais reste échappé", () => {
  const relay = formatCustomerRelay({
    chatId: "654321",
    username: "client",
    firstName: "Ali <b>",
    language: "fr",
    text: "Où est ma commande ? <script>",
  });
  assert.match(relay, /654321/);
  assert.match(relay, /@client/);
  assert.doesNotMatch(relay, /<script>/);
  assert.match(relay, /Où est ma commande/);
});

test("les textes tronqués respectent la limite Telegram", () => {
  assert.equal(telegramClamp("a".repeat(5000)).length, 3900);
  assert.match(telegramClamp("a".repeat(5000)), /…$/);
  assert.equal(telegramClamp(" court "), "court");
  assert.equal(fillTemplate("Salut {site}, {inconnu}", { site: "Nukhba" }), "Salut Nukhba, {inconnu}");
});

/* --------------------------------- Claviers ------------------------------- */

test("les boutons restent cohérents dans les trois langues", () => {
  const links = { site: "https://nokhba.net.ly", store: "https://nokhba.net.ly/codes", whatsapp: "https://wa.me/218913442640" };
  for (const lang of ["ar", "fr", "en"]) {
    const keyboard = mainMenuKeyboard(lang, links);
    const buttons = keyboard.flat();
    assert.ok(buttons.length >= 5, lang);
    for (const button of buttons) {
      assert.ok(button.text.trim().length > 0, `${lang} : libellé vide`);
      assert.ok(
        Boolean(button.url) !== Boolean(button.callback_data),
        `${lang} : bouton ni URL ni callback`,
      );
    }
    assert.equal(mainMenuKeyboard(lang, links)[0][0].url, links.store);
    assert.ok(offersKeyboard(lang).flat().some((b) => b.callback_data === "offers:on"));
  }
  assert.deepEqual(
    languageKeyboard().flat().map((b) => b.callback_data),
    ["lang:ar", "lang:fr", "lang:en"],
  );
  assert.ok(botCommandList().every((c) => /^[a-z]+$/.test(c.command)));
});

/* -------------------------------- Marketing ------------------------------- */

test("une campagne porte un lien UTM et un plafond de longueur", () => {
  const text = composeBroadcast({
    body: "  🎁 -20 % sur les cartes cadeaux  ",
    siteName: "Nukhba",
    siteUrl: "https://nokhba.net.ly/",
    slug: "Black Friday 2026",
  });
  assert.match(text, /^🎁 -20 % sur les cartes cadeaux/);
  assert.match(text, /— Nukhba/);
  assert.match(
    text,
    /https:\/\/nokhba\.net\.ly\/codes\?utm_source=telegram&utm_medium=bot&utm_campaign=black-friday-2026/,
  );
  assert.ok(text.length <= 3900);

  assert.deepEqual(validateBroadcast("Bonjour"), { ok: true });
  assert.equal(validateBroadcast("ok").ok, false);
  assert.equal(validateBroadcast("x".repeat(3001)).ok, false);
});

/* ------------------------- Garde-fous d'intégration ----------------------- */

test("le webhook exige le secret Telegram et répond toujours 200", () => {
  const route = code(read("src/app/api/telegram/webhook/route.ts"));
  assert.match(route, /x-telegram-bot-api-secret-token/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /invalid_secret/);
  assert.match(route, /webhook_secret_missing/);
  assert.match(route, /status: 401/);
  // Après authentification, on renvoie 200 même si le traitement échoue
  // (sinon Telegram réessaie en boucle et double les messages).
  assert.match(route, /catch \(error\) \{[\s\S]*\[telegram\] mise à jour ignorée/);
  assert.match(route, /return NextResponse\.json\(\{ ok: true \}\)/);
  // Un groupe n'est jamais interrogé : il sert aux alertes internes.
  assert.match(route, /message\.chat\.type !== "private"/);
});

test("aucun composant client n'importe le module serveur du bot", () => {
  const files = walk(join(root, "src"));
  const offenders = files
    .filter((file) => /\.(tsx?|jsx?)$/.test(file))
    .filter((file) => {
      const source = readFileSync(file, "utf8");
      return /^["']use client["']/m.test(source) && /from ["']@\/lib\/telegram["']/.test(source);
    });
  assert.deepEqual(offenders, []);
});

test("le jeton reste une variable d'environnement documentée", () => {
  const env = read(".env.example");
  for (const key of [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_ADMIN_CHAT_ID",
    "TELEGRAM_WEBHOOK_SECRET",
    "TELEGRAM_BOT_USERNAME",
  ]) {
    assert.match(env, new RegExp(`^${key}=`, "m"), key);
  }
  const lib = code(read("src/lib/telegram.ts"));
  assert.match(lib, /process\.env\.TELEGRAM_BOT_TOKEN/);
  // Aucun jeton en dur (littéral BotFather) dans le code.
  assert.doesNotMatch(lib, /\d{8,12}:[A-Za-z0-9_-]{30,}/);
});

test("les campagnes ne visent que les abonnés opt-in", () => {
  const lib = code(read("src/lib/telegram.ts"));
  assert.match(lib, /eq\(telegramSubscribers\.marketingOptIn, true\)/);
  assert.match(lib, /BROADCAST_MAX_RECIPIENTS/);
  // Un blocage est enregistré : plus jamais relancé.
  assert.match(lib, /setTelegramBlocked/);
  assert.match(lib, /blocked\|chat not found/);
});

test("alertes branchées sur les demandes et les paiements", () => {
  assert.match(code(read("src/app/api/lead/route.ts")), /notifyTelegramLead\(/);
  assert.match(code(read("src/lib/order-emails.ts")), /notifyTelegramPayment\(/);
});

test("les tables Telegram existent dans le schéma ET dans le DDL", () => {
  const schema = read("src/db/schema.ts");
  const ddl = read("src/db/index.ts");
  for (const table of ["telegram_subscribers", "telegram_campaigns"]) {
    assert.match(schema, new RegExp(`pgTable\\("${table}"`), table);
    assert.match(ddl, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  assert.match(schema, /marketingOptIn: boolean\("marketing_opt_in"\)/);
});

test("l'admin expose le panneau et le lien public est piloté par l'env", () => {
  assert.match(read("src/app/admin/(panel)/admin-nav.tsx"), /href: "\/admin\/telegram"/);
  const panel = read("src/app/admin/(panel)/telegram/page.tsx");
  assert.match(panel, /Installer le webhook|TelegramPanel/);
  const actions = read("src/app/admin/(panel)/telegram/actions.ts");
  assert.match(actions, /requireAdmin\(\)/);
  assert.match(actions, /broadcastAction/);

  const footer = code(read("src/components/footer.tsx"));
  // Le @username vient du serveur (prop du layout), pas d'une variable
  // NEXT_PUBLIC_ : Vercel avertit sur ce préfixe, et un jour un jeton
  // pourrait s'y retrouver et fuiter dans le bundle navigateur.
  assert.match(footer, /telegramBot\?: string/);
  assert.doesNotMatch(footer, /NEXT_PUBLIC_/);
  assert.match(read("src/app/(site)/layout.tsx"), /process\.env\.TELEGRAM_BOT_USERNAME/);
  // Le lien n'est rendu que si le username correspond au format Telegram.
  assert.match(footer, /\^\[A-Za-z0-9_\]\{4,32\}\$/);
});

test("le guide de mise en route est livré", () => {
  const doc = read("docs/telegram-bot.md");
  assert.match(doc, /BotFather/);
  assert.match(doc, /TELEGRAM_BOT_TOKEN/);
  assert.match(doc, /\/admin\/telegram/);
  assert.match(doc, /opt-in/);
  assert.match(doc, /Dépannage/);
});
