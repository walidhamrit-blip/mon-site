#!/usr/bin/env node
/** Garde-fous du paiement manuel par carte de recharge téléphonique. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  normalizePhoneCardCode,
  normalizePhoneCardReviewStatus,
  phoneCardAutoDeliveryMessage,
  phoneCardDeliveryAllowed,
  phoneCardDeliveryRoute,
  phoneCardPublicNotice,
  validatePhoneCardInput,
} from "../src/lib/phone-card-core.ts";
import {
  calculatePhoneCardLydQuote,
  parseFulusCurrentRate,
  phoneCardQuoteMatches,
} from "../src/lib/phone-card-pricing-core.ts";
import {
  buildPhoneCardCommunityConsensus,
  parseArabicCashDollarRate,
  parseTelegramCommunityObservations,
} from "../src/lib/phone-card-community-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(new URL(path, `file://${root}`), "utf8");
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

test("les codes sont normalisés sans changer leurs chiffres", () => {
  assert.equal(normalizePhoneCardCode(" 1234-5678 9012 "), "123456789012");
  assert.equal(normalizePhoneCardCode(null), "");
});

test("Libyana et Al Madar sont acceptés avec une valeur LYD positive", () => {
  for (const operator of ["libyana", "al_madar"]) {
    const result = validatePhoneCardInput({ operator, code: "1234 5678 90", valueLyd: "50" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.code, "1234567890");
      assert.equal(result.value.valueLyd, "50.00");
    }
  }
});

test("les entrées invalides sont refusées avant toute commande", () => {
  for (const input of [
    undefined,
    { operator: "autre", code: "12345678", valueLyd: 50 },
    { operator: "libyana", code: "ABC12345", valueLyd: 50 },
    { operator: "libyana", code: "123", valueLyd: 50 },
    { operator: "libyana", code: "12345678", valueLyd: 0 },
    { operator: "libyana", code: "12345678", valueLyd: "nope" },
  ]) {
    assert.equal(validatePhoneCardInput(input).ok, false);
  }
});

test("seule une revue approved déverrouille la livraison", () => {
  assert.equal(phoneCardDeliveryAllowed("approved"), true);
  for (const status of ["pending", "rejected", "paid", null, undefined]) {
    assert.equal(phoneCardDeliveryAllowed(status), false);
  }
  assert.equal(normalizePhoneCardReviewStatus("inconnu"), "pending");
});

test("les messages publics expliquent la revue sans contenir de secret", () => {
  for (const locale of ["ar", "en"]) {
    assert.match(phoneCardPublicNotice("pending", locale), locale === "ar" ? /التحقق|نتحقق/ : /verify/i);
    // Après acceptation, le client lit que le code arrive — plus de promesse
    // de « préparation manuelle » depuis l'automatisation.
    assert.match(
      phoneCardPublicNotice("approved", locale),
      locale === "ar" ? /بالبريد الإلكتروني/ : /emailed to you/i,
    );
    assert.match(phoneCardPublicNotice("rejected", locale), locale === "ar" ? /تواصل/ : /Contact/i);
  }
});

test("la caisse conserve la crypto par défaut et propose la carte sans facture NOWPayments", () => {
  const route = code(read("src/app/api/fazercards/checkout/route.ts"));
  assert.match(route, /paymentMethod: z\.enum\(\["nowpayments", "phone_card"\]\)\.default\("nowpayments"\)/);
  assert.match(route, /phoneCard: z\.object/);
  assert.match(route, /enforceSameOrigin\(req\)/);
  assert.match(route, /checkRateLimit\(CHECKOUT_LIMIT, req\)/);

  const checkout = code(read("src/lib/fazercards-orders.ts"));
  const phoneBranch = checkout.indexOf("if (preparedPhoneCard) {");
  const invoice = checkout.indexOf("let invoice:");
  assert.ok(phoneBranch > 0 && invoice > phoneBranch, "la branche carte doit précéder la facture crypto");
  assert.match(checkout, /fulfillment: usesPhoneCard \? "manual" : "auto"/);
  assert.match(checkout, /paymentMethod: usesPhoneCard \? "phone_card" : "nowpayments"/);
  assert.match(checkout, /phone_card_already_used/);
  assert.match(checkout, /!usesPhoneCard && totalUsd < minOrderUsd/);
});

test("le code est chiffré, empreinté et unique dans la base", () => {
  const schema = read("src/db/schema.ts");
  assert.match(schema, /codeCipher: text\("code_cipher"\)\.notNull\(\)/);
  assert.match(schema, /codeFingerprint: text\("code_fingerprint"\)\.notNull\(\)\.unique\(\)/);
  const storage = read("src/lib/phone-card-payments.ts");
  // Chiffrement : enveloppe AES-256-GCM partagée (src/lib/digital-codes.ts),
  // pour que les recharges et les codes cadeaux utilisent exactement le même
  // format et le même trousseau de clés.
  assert.match(storage, /encryptEnvelope\(validated\.value\.code, key\)/);
  assert.match(storage, /decryptEnvelopeWithKey\(payload, key\)/);
  const envelope = read("src/lib/digital-codes.ts");
  assert.match(envelope, /createCipheriv\("aes-256-gcm", key, iv\)/);
  assert.match(envelope, /createDecipheriv\("aes-256-gcm", key, iv\)/);
  assert.match(storage, /createHmac\("sha256"/);
  assert.match(storage, /eq\(phoneCardPayments\.status, "pending"\)/);
  assert.match(storage, /status: "manual"/);
  assert.match(storage, /fulfillment: "manual"/);
});

test("aucune livraison automatique n'est possible avant acceptation", () => {
  const delivery = code(read("src/lib/digital-orders.ts"));
  const automatic = delivery.slice(delivery.indexOf("export async function deliverPaidDigitalOrder"));
  // La garde est lue AVANT tout choix de fournisseur : on ne peut pas router
  // une carte non vérifiée vers un chemin d'achat.
  assert.ok(automatic.indexOf("phoneCardDeliveryGate") < automatic.indexOf("digitalOrderSupplier"));
  assert.match(automatic, /phoneCardDeliveryRoute\(\{/);
  assert.match(automatic, /autoDeliver: options\.phoneCardApproved === true/);
  assert.match(automatic, /if \(phoneRoute === "manual"\)/);
  assert.match(automatic, /outcome: "manual"/);

  const manual = delivery.slice(delivery.indexOf("export async function deliverDigitalOrderManually"));
  assert.match(manual, /phoneGate\.isPhoneCard && phoneGate\.status !== "approved"/);
  assert.match(manual, /Livraison verrouillée/);

  const supplier = code(read("src/lib/fazercards-orders.ts"));
  const direct = supplier.slice(supplier.indexOf("export async function deliverPaidFazercardsOrder"));
  assert.ok(direct.indexOf("phoneCardDeliveryGate") < direct.indexOf("placeFazercardsOrder"));
  assert.match(direct, /phoneCardDeliveryRoute\(\{/);
  assert.match(direct, /aucun achat fournisseur déclenché/);
});

test("l'achat automatique après acceptation reste réservé à l'admin", () => {
  // Le seul point d'entrée autorisé à acheter pour une carte téléphonique
  // vérifie l'acceptation puis passe le drapeau explicitement.
  const delivery = code(read("src/lib/digital-orders.ts"));
  const entry = delivery.slice(delivery.indexOf("export async function deliverApprovedPhoneCardOrder"));
  assert.match(entry, /gate\.status !== "approved"/);
  assert.match(entry, /deliverPaidDigitalOrder\(orderRef, \{ phoneCardApproved: true \}\)/);

  // Ni la reprise automatique (cron), ni l'IPN, ni le polling client ne
  // doivent pouvoir déclencher un achat : aucun de ces fichiers ne passe le
  // drapeau.
  for (const path of [
    "src/lib/digital-resume.ts",
    "src/app/api/payments/ipn/route.ts",
    "src/app/api/payments/order/[ref]/route.ts",
  ]) {
    const source = code(read(path));
    assert.doesNotMatch(source, /phoneCardApproved/, `${path} ne doit jamais acheter pour une carte`);
  }

  // L'action admin, elle, le passe — et seulement après `requireAdmin()`.
  const actions = read("src/app/admin/actions.ts");
  const review = actions.slice(actions.indexOf("export async function reviewPhoneCardPaymentAction"));
  assert.match(review, /await requireAdmin\(\)/);
  assert.ok(
    review.indexOf("await requireAdmin()") < review.indexOf("deliverApprovedPhoneCardOrder"),
    "la livraison automatique vient après le contrôle de session",
  );
  assert.match(review, /autoDeliver/);
});

test("route de livraison : la carte non acceptée ne déclenche jamais d'achat", () => {
  assert.equal(phoneCardDeliveryRoute({ isPhoneCard: true, status: "pending" }), "blocked");
  assert.equal(phoneCardDeliveryRoute({ isPhoneCard: true, status: "rejected" }), "blocked");
  assert.equal(phoneCardDeliveryRoute({ isPhoneCard: true, status: "approved" }), "manual");
  assert.equal(
    phoneCardDeliveryRoute({ isPhoneCard: true, status: "approved", autoDeliver: true }),
    "supplier",
  );
  // Un drapeau d'achat sur une carte non acceptée ne change rien.
  assert.equal(
    phoneCardDeliveryRoute({ isPhoneCard: true, status: "pending", autoDeliver: true }),
    "blocked",
  );
  assert.equal(phoneCardDeliveryRoute({ isPhoneCard: false, status: "pending" }), "supplier");
});

test("message après acceptation : toujours actionnable, jamais muet", () => {
  const ref = "DGC-TEST";
  assert.match(phoneCardAutoDeliveryMessage("delivered", ref), /livré automatiquement/);
  assert.match(phoneCardAutoDeliveryMessage("already_delivered", ref), /aucun second achat/);
  assert.match(phoneCardAutoDeliveryMessage("awaiting_codes", ref), /relancez la livraison/);
  const manual = phoneCardAutoDeliveryMessage("manual", ref, "Fiche en livraison manuelle.");
  assert.match(manual, /Saisissez le code cadeau/);
  assert.match(manual, /Fiche en livraison manuelle/);
  assert.match(phoneCardAutoDeliveryMessage("failed", ref, "refusé"), /Livrez le code à la main/);
  assert.match(phoneCardAutoDeliveryMessage("not_found", ref), /Aucune commande/);
});

test("le code secret reste dans l'admin et jamais dans le suivi ou les e-mails", () => {
  const publicOrder = read("src/lib/digital-orders.ts");
  const publicShape = publicOrder.slice(
    publicOrder.indexOf("export interface PublicDigitalOrder"),
    publicOrder.indexOf("function publicNotice"),
  );
  assert.doesNotMatch(publicShape, /codeCipher|cardCode|rechargeCode/);
  const emails = read("src/lib/digital-emails.ts");
  const notice = emails.slice(emails.indexOf("export async function sendPhoneCardReviewNotice"));
  assert.match(notice, /Le code n'est volontairement pas inclus/);
  const adminPage = read("src/app/admin/(panel)/digital/orders/page.tsx");
  assert.match(adminPage, /listPhoneCardPayments/);
  assert.match(adminPage, /PhoneCardPaymentsTable/);
});

test("l'action de revue exige une session admin et un motif de refus", () => {
  const actions = read("src/app/admin/actions.ts");
  const action = actions.slice(actions.indexOf("export async function reviewPhoneCardPaymentAction"));
  assert.match(action, /await requireAdmin\(\)/);
  const review = read("src/lib/phone-card-payments.ts");
  assert.match(review, /decision === "rejected" && !note/);
});

const quoteMetadata = {
  source: "manual",
  rateUpdatedAt: "2026-11-05T20:00:00.000Z",
  fetchedAt: "2026-11-05T20:01:00.000Z",
  stale: false,
};

test("la formule LYD applique le taux parallèle puis exactement 20 %", () => {
  const five = calculatePhoneCardLydQuote(5, 9.84, quoteMetadata);
  const ten = calculatePhoneCardLydQuote(10, 9.84, quoteMetadata);
  assert.equal(five?.totalLyd, 59.04);
  assert.equal(ten?.totalLyd, 118.08);
  assert.equal(five?.markupPercent, 20);
  assert.equal(five?.amountUsdt, 5);
  assert.equal(five?.rateLyd, 9.84);
  // La quantité est déjà comprise dans le total USDT recalculé par le serveur.
  assert.equal(calculatePhoneCardLydQuote(15, 9.84, quoteMetadata)?.totalLyd, 177.12);
});

test("un montant ou un taux invalide ne produit jamais de devis", () => {
  for (const [amount, rate] of [[0, 9.84], [-5, 9.84], [5, 0], [5, -9.84], [5, "nope"]]) {
    assert.equal(calculatePhoneCardLydQuote(amount, rate, quoteMetadata), null);
  }
});

test("la réponse documentée de Fulus est lue avec son horodatage", () => {
  assert.deepEqual(
    parseFulusCurrentRate({
      data: { currency: "USD", rate: 9.84, timestamp: "2026-11-05T20:00:00Z" },
    }),
    { rateLyd: 9.84, rateUpdatedAt: "2026-11-05T20:00:00Z" },
  );
  assert.equal(parseFulusCurrentRate({ data: { currency: "EUR", rate: 11.2 } }), null);
  assert.equal(parseFulusCurrentRate({ data: { currency: "USD", rate: -1 } }), null);
});

function telegramPost(channel, id, publishedAt, text, views = "3.2K") {
  return `<div class="tgme_widget_message js-widget_message" data-post="${channel}/${id}">
    <div class="tgme_widget_message_text js-message_text" dir="auto">${text}</div>
    <span class="tgme_widget_message_views">${views}</span>
    <a href="https://t.me/${channel}/${id}"><time datetime="${publishedAt}">12:00</time></a>
  </div>`;
}

const COMMUNITY_NOW = Date.parse("2026-11-05T20:00:00.000Z");

function communityFixtures() {
  return [
    ...parseTelegramCommunityObservations(
      telegramPost(
        "dollar_ly",
        1523,
        "2026-11-05T11:21:04+00:00",
        "إغلاق يوم الخميس - 2026/11/05 || 6:20<br>دولار 💵 = 9.920 دينار<br>يورو 💶 = 11.10 دينار",
        "2.43K",
      ),
      "dollar_ly",
      COMMUNITY_NOW,
    ),
    ...parseTelegramCommunityObservations(
      telegramPost(
        "lydollar",
        21456,
        "2026-11-05T05:25:00+00:00",
        "(اليوم الخميس)2026/11/05{اخر تحديث}<br>💵 الدولار=9.86دينار<br>💳 الصك=10.07 دينار",
        "3.67K",
      ),
      "lydollar",
      COMMUNITY_NOW,
    ),
    ...parseTelegramCommunityObservations(
      telegramPost(
        "suqalmushir",
        1557,
        "2026-11-04T15:47:00+00:00",
        "{اليوم الاربعاء}2026/11/4(اخر تحديث)<br>دولار =9.88<br>دولار بشيك =10.04<br>دولار بشيك حوالة تركيا =10.18",
        "2.17K",
      ),
      "suqalmushir",
      COMMUNITY_NOW,
    ),
  ];
}

test("Telegram lit le dollar en espèces, les chiffres arabes et les vues sans retenir les chèques", () => {
  const fixtures = communityFixtures();
  assert.equal(fixtures.length, 3);
  assert.deepEqual(fixtures.map((item) => item.rateLyd).sort(), [9.86, 9.88, 9.92]);
  assert.equal(fixtures.find((item) => item.channel === "dollar_ly")?.views, 2430);
  assert.equal(fixtures.find((item) => item.channel === "dollar_ly")?.url, "https://t.me/dollar_ly/1523");
  assert.equal(parseArabicCashDollarRate("💵 الدولار=٩٫٩٢ دينار"), 9.92);
  assert.equal(parseArabicCashDollarRate("دولار =9.88<br>دولار بشيك =10.04"), 9.88);
  assert.equal(parseArabicCashDollarRate("دولار بشيك =10.04"), null);
});

test("Telegram exclut la Banque centrale et les dates arabes contradictoires", () => {
  const official = telegramPost(
    "lydollar",
    21454,
    "2026-11-05T04:27:00+00:00",
    "اليوم الخميس 05 - 11 - 2026<br>سعر الدولار بمصرف ليبيا المركزي لهذا اليوم:<br>سعر البيع: 6.418 دينار",
  );
  assert.equal(parseTelegramCommunityObservations(official, "lydollar", COMMUNITY_NOW).length, 0);

  const valid = telegramPost(
    "lydollar",
    21456,
    "2026-11-05T05:25:00+00:00",
    "(اليوم الخميس)2026/11/05<br>💵 الدولار=9.86دينار",
  );
  const wrongDate = telegramPost(
    "lydollar",
    21460,
    "2026-11-05T12:06:00+00:00",
    "(اليوم الخميس)2026/11/04<br>💵 الدولار=9.92دينار",
  );
  const parsed = parseTelegramCommunityObservations(valid + wrongDate, "lydollar", COMMUNITY_NOW);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].url, "https://t.me/lydollar/21456");
  assert.equal(parsed[0].rateLyd, 9.86);
});

test("Telegram refuse les publications trop anciennes ou futures", () => {
  const html = telegramPost(
    "dollar_ly",
    1523,
    "2026-11-05T11:21:04+00:00",
    "2026/11/05<br>دولار = 9.92 دينار",
  );
  assert.equal(parseTelegramCommunityObservations(html, "dollar_ly", COMMUNITY_NOW).length, 1);
  assert.equal(
    parseTelegramCommunityObservations(html, "dollar_ly", Date.parse("2026-11-08T00:00:00Z")).length,
    0,
  );
  assert.equal(
    parseTelegramCommunityObservations(html, "dollar_ly", Date.parse("2026-11-04T00:00:00Z")).length,
    0,
  );
});

test("la médiane communautaire exige deux canaux proches et fige leurs liens", () => {
  const fixtures = communityFixtures();
  const consensus = buildPhoneCardCommunityConsensus(fixtures);
  assert.ok(consensus);
  assert.equal(consensus.rateLyd, 9.88);
  assert.equal(consensus.references.length, 3);
  assert.equal(consensus.rateUpdatedAt, "2026-11-05T11:21:04.000Z");
  assert.equal(consensus.references[0].url, "https://t.me/dollar_ly/1523");

  const two = buildPhoneCardCommunityConsensus(fixtures.filter((item) => item.channel !== "suqalmushir"));
  assert.equal(two?.rateLyd, 9.89);
  assert.equal(buildPhoneCardCommunityConsensus(fixtures.slice(0, 1)), null);

  const outlier = fixtures.map((item) => item.channel === "suqalmushir" ? { ...item, rateLyd: 10.4 } : item);
  assert.equal(buildPhoneCardCommunityConsensus(outlier), null);
});

test("le checkout exige l'accord et refuse tout devis différent du calcul serveur", () => {
  const expected = calculatePhoneCardLydQuote(5, 9.84, quoteMetadata);
  assert.ok(expected);
  assert.equal(phoneCardQuoteMatches({ ...expected, fetchedAt: "nouvelle-lecture" }, expected), true);
  assert.equal(phoneCardQuoteMatches({ ...expected, rateLyd: 9.85 }, expected), false);
  assert.equal(phoneCardQuoteMatches({ ...expected, totalLyd: 1 }, expected), false);
  assert.equal(phoneCardQuoteMatches(null, expected), false);

  const checkout = code(read("src/lib/fazercards-orders.ts"));
  assert.match(checkout, /quoteAccepted !== true/);
  assert.match(checkout, /getPhoneCardLydQuote\(totalUsd\)/);
  assert.match(checkout, /phoneCardQuoteMatches\(input\.phoneCard\?\.quote, acceptedPhoneCardQuote\)/);
  assert.match(checkout, /phone_card_quote_changed/);
  const schema = read("src/db/schema.ts");
  assert.match(schema, /quoteRateLyd: text\("quote_rate_lyd"\)/);
  assert.match(schema, /quoteTotalLyd: text\("quote_total_lyd"\)/);
  assert.match(schema, /quoteReferences: jsonb\("quote_references"\)/);
  const checkoutRoute = read("src/app/api/fazercards/checkout/route.ts");
  assert.match(checkoutRoute, /z\.enum\(\["community", "fulus", "manual"\]\)/);
});

test("un taux modifié est rechargé et l'information client reste cohérente", () => {
  const dialog = code(read("src/components/digital-buy-dialog.tsx"));
  assert.match(dialog, /data\.error === "phone_card_quote_changed"/);
  assert.match(dialog, /setAcceptedPhoneQuoteKey\(""\)/);
  assert.match(dialog, /setPhoneQuoteRefresh/);
  assert.match(dialog, /phoneQuote\.totalLyd\.toFixed\(2\)/);

  const terms = read("src/app/(site)/conditions/conditions-client.tsx");
  assert.match(terms, /parallel-market USD\/LYD rate × 120%/);
  const assistant = read("src/lib/site-assistant.ts");
  assert.match(assistant, /Never invent a live rate/);
});
