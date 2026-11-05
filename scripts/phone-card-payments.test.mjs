#!/usr/bin/env node
/** Garde-fous du paiement manuel par carte de recharge téléphonique. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  normalizePhoneCardCode,
  normalizePhoneCardReviewStatus,
  phoneCardDeliveryAllowed,
  phoneCardPublicNotice,
  validatePhoneCardInput,
} from "../src/lib/phone-card-core.ts";
import {
  calculatePhoneCardLydQuote,
  parseFulusCurrentRate,
  phoneCardQuoteMatches,
} from "../src/lib/phone-card-pricing-core.ts";

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
    assert.match(phoneCardPublicNotice("approved", locale), locale === "ar" ? /يدوي/ : /manually/i);
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
  assert.match(storage, /createCipheriv\("aes-256-gcm"/);
  assert.match(storage, /createHmac\("sha256"/);
  assert.match(storage, /eq\(phoneCardPayments\.status, "pending"\)/);
  assert.match(storage, /status: "manual"/);
  assert.match(storage, /fulfillment: "manual"/);
});

test("aucune livraison automatique ou manuelle n'est possible avant acceptation", () => {
  const delivery = code(read("src/lib/digital-orders.ts"));
  const automatic = delivery.slice(delivery.indexOf("export async function deliverPaidDigitalOrder"));
  assert.ok(automatic.indexOf("phoneCardDeliveryGate") < automatic.indexOf("digitalOrderSupplier"));
  assert.match(automatic, /phoneGate\.status === "approved"/);
  assert.match(automatic, /outcome: "manual"/);
  const manual = delivery.slice(delivery.indexOf("export async function deliverDigitalOrderManually"));
  assert.match(manual, /phoneGate\.isPhoneCard && phoneGate\.status !== "approved"/);
  assert.match(manual, /Livraison verrouillée/);
  const supplier = code(read("src/lib/fazercards-orders.ts"));
  const direct = supplier.slice(supplier.indexOf("export async function deliverPaidFazercardsOrder"));
  assert.ok(direct.indexOf("phoneCardDeliveryGate") < direct.indexOf("placeFazercardsOrder"));
  assert.match(direct, /aucun achat fournisseur déclenché/);
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
