import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeTelegramHandle,
  SHOP_LINK_KINDS,
  shopStartPayload,
  shopTargetFromStartPayload,
  telegramShopUrl,
} from "../src/lib/telegram-links.ts";
import { DIGITAL_KINDS } from "../src/lib/digital-types.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("liens boutique : un lien par rayon, dans la langue de la page", () => {
  assert.equal(telegramShopUrl("@NokhbaGamebot", { kind: "gift_card", locale: "ar" }), "https://t.me/NokhbaGamebot?start=shop-ar-gift_card");
  assert.equal(telegramShopUrl("NokhbaGamebot", { locale: "en" }), "https://t.me/NokhbaGamebot?start=shop-en");
  assert.equal(telegramShopUrl("NokhbaGamebot"), "https://t.me/NokhbaGamebot?start=shop");
  for (const kind of DIGITAL_KINDS) {
    const payload = shopStartPayload({ kind, locale: "ar" });
    // Contrainte Telegram : [A-Za-z0-9_-], 64 caractères au plus.
    assert.match(payload, /^[A-Za-z0-9_-]{1,64}$/);
    assert.deepEqual(shopTargetFromStartPayload(payload), { kind, locale: "ar" });
  }
});

test("les rayons des liens Telegram suivent exactement ceux du catalogue", () => {
  assert.deepEqual([...SHOP_LINK_KINDS], [...DIGITAL_KINDS]);
});

test("bot absent ou invalide : aucun lien (jamais de lien mort)", () => {
  assert.equal(telegramShopUrl(undefined, { kind: "gift_card" }), "");
  assert.equal(telegramShopUrl("", { kind: "gift_card" }), "");
  assert.equal(telegramShopUrl("bad name!"), "");
  assert.equal(normalizeTelegramHandle(" @Nokhba_Bot "), "Nokhba_Bot");
});

test("lecture du /start : seuls les liens boutique sont reconnus", () => {
  assert.deepEqual(shopTargetFromStartPayload("shop"), { kind: null, locale: null });
  assert.deepEqual(shopTargetFromStartPayload("shop-en"), { kind: null, locale: "en" });
  assert.deepEqual(shopTargetFromStartPayload("shop-game_topup"), { kind: "game_topup", locale: null });
  assert.deepEqual(shopTargetFromStartPayload("shop-ar-unknown"), { kind: null, locale: "ar" });
  assert.equal(shopTargetFromStartPayload("site"), null);
  assert.equal(shopTargetFromStartPayload("order-dgc-1a2b3c4d5e6f"), null);
  assert.equal(shopTargetFromStartPayload("shopping"), null);
  assert.equal(shopTargetFromStartPayload(null), null);
});

test("le bot ouvre la boutique sur le rayon demandé, sans écran de langue", () => {
  const webhook = read("src/app/api/telegram/webhook/route.ts");
  assert.match(webhook, /shopTargetFromStartPayload\(args\)/);
  assert.match(webhook, /stored\?\.language \?\? shopTarget\?\.locale \?\?/);
  // Le lien boutique passe AVANT l'écran de langue des nouveaux arrivants,
  // mais APRÈS le suivi de commande (`order-…`).
  const start = webhook.indexOf('case "start":');
  const order = webhook.indexOf("orderRefFromStartPayload(args)", start);
  const shop = webhook.indexOf("openTelegramShopCategory(actor", start);
  const lang = webhook.indexOf("if (isNew)", start);
  assert.ok(order > 0 && order < shop && shop < lang);
  const shopModule = read("src/lib/telegram-shop.ts");
  assert.match(shopModule, /export async function openTelegramShopCategory/);
  assert.match(shopModule, /SHOP_KINDS as readonly string\[\]\)\.includes\(kind\)/);
});

test("un lien Telegram visible pour chaque rayon : menu, /codes, pages de rayon", () => {
  const navbar = read("src/components/navbar.tsx");
  assert.match(navbar, /source="nav-dropdown"/);
  assert.match(navbar, /source="nav-mobile"/);
  assert.match(navbar, /source="navbar-store"/);
  assert.match(read("src/app/(site)/layout.tsx"), /<Navbar telegramBot=\{process\.env\.TELEGRAM_BOT_USERNAME\} \/>/);

  const store = read("src/components/digital-store-view.tsx");
  assert.match(store, /<TelegramShopStrip bot=\{telegramBot\} ar=\{ar\} kind=\{kind\}/);
  assert.match(store, /<TelegramShopPanel bot=\{telegramBot\}/);
  assert.match(read("src/app/(site)/codes/page.tsx"), /telegramBot=\{process\.env\.TELEGRAM_BOT_USERNAME\}/);

  const category = read("src/app/(site)/codes/category/[kind]/page.tsx");
  assert.match(category, /<TelegramShopStrip bot=\{telegramBot\} ar=\{ar\} kind=\{category\.kind\}/);
  assert.match(category, /<TelegramShopPanel bot=\{telegramBot\} ar=\{ar\} kind=\{category\.kind\}/);

  const cta = read("src/components/telegram-shop-cta.tsx");
  assert.match(cta, /rel="noopener noreferrer"/);
  assert.match(cta, /trackEvent\(\{ name: "telegram_click"/);
  assert.match(read("src/lib/analytics.ts"), /"telegram_click"/);
  // Le nom du bot reste une configuration serveur.
  for (const path of ["src/components/telegram-shop-cta.tsx", "src/components/navbar.tsx", "src/lib/telegram-links.ts"]) {
    assert.doesNotMatch(read(path), /NEXT_PUBLIC_/);
  }
});
