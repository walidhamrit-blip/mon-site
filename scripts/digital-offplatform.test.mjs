// Tests de la livraison hors système (WhatsApp, téléphone, e-mail direct).
//
// Deux choses à protéger :
//   1. la validation admin (canal obligatoire, note bornée, note JAMAIS envoyée) ;
//   2. la cohérence des libellés entre le noyau TypeScript et le script de
//      vérification `scripts/check-delivery.mjs`, qui en duplique une copie
//      pour rester exécutable sans compilation.
import test from "node:test";
import assert from "node:assert/strict";
import {
  OFF_PLATFORM_CHANNELS,
  OFF_PLATFORM_CHANNEL_LABELS,
  OFF_PLATFORM_NOTE_MAX,
  normalizeOffPlatformChannel,
  offPlatformEmailContent,
  offPlatformNotice,
  validateOffPlatformDelivery,
} from "../src/lib/digital-offplatform-core.ts";
import { OFF_PLATFORM_LABELS } from "./delivery-check-core.mjs";

test("canaux acceptés, casse et espaces ignorés", () => {
  assert.deepEqual([...OFF_PLATFORM_CHANNELS], ["whatsapp", "phone", "email", "other"]);
  assert.equal(normalizeOffPlatformChannel("WhatsApp"), "whatsapp");
  assert.equal(normalizeOffPlatformChannel("  PHONE "), "phone");
  assert.equal(normalizeOffPlatformChannel("email"), "email");
  assert.equal(normalizeOffPlatformChannel(""), null);
  assert.equal(normalizeOffPlatformChannel(null), null);
  assert.equal(normalizeOffPlatformChannel("telegram"), null);
});

test("le canal est obligatoire : sans lui, on ne peut pas tracer la livraison", () => {
  const verdict = validateOffPlatformDelivery({ note: "envoyé" });
  assert.equal(verdict.ok, false);
  assert.match(verdict.error, /canal/i);
});

test("la note est nettoyée, bornée et facultative", () => {
  const trimmed = validateOffPlatformDelivery({ channel: "whatsapp", note: "  envoyé à 21:40  " });
  assert.deepEqual(trimmed, { ok: true, channel: "whatsapp", note: "envoyé à 21:40" });

  const empty = validateOffPlatformDelivery({ channel: "whatsapp", note: "   " });
  assert.deepEqual(empty, { ok: true, channel: "whatsapp", note: null });

  const long = validateOffPlatformDelivery({ channel: "other", note: "x".repeat(500) });
  assert.equal(long.ok, true);
  assert.equal(long.note.length, OFF_PLATFORM_NOTE_MAX);
});

test("l'e-mail au client ne contient jamais la note interne", () => {
  const content = offPlatformEmailContent({
    ref: "DGC-9B5E402D92954C26368D14E2",
    productTitle: "Xbox Gift Card",
    denominationLabel: "25 USD",
    channel: "whatsapp",
    note: "numéro de téléphone du client : 0912345678",
    trackingUrl: "https://nokhba.net.ly/codes/commande?ref=DGC-1&t=secret",
    siteName: "Nukhba",
    siteUrl: "https://nokhba.net.ly",
    supportEmail: "contact@nokhba.net.ly",
    deliveredAtLabel: "07/11/2026 à 21:45",
  });

  assert.match(content.subject, /DGC-9B5E402D92954C26368D14E2/);
  assert.match(content.text, /WhatsApp/);
  assert.match(content.text, /07\/11\/2026 à 21:45/);
  assert.ok(content.text.includes("https://nokhba.net.ly/codes/commande?ref=DGC-1&t=secret"));
  assert.ok(!content.text.includes("0912345678"), "la note interne ne doit pas fuiter");
  assert.ok(!content.html.includes("0912345678"), "la note interne ne doit pas fuiter");
});

test("l'e-mail échappe le HTML (titre produit hostile)", () => {
  const content = offPlatformEmailContent({
    ref: "DGC-X",
    productTitle: '<script>alert("x")</script>',
    channel: "phone",
    trackingUrl: "https://exemple.test/codes/commande?ref=DGC-X&t=y",
    siteName: "Nukhba",
    siteUrl: "https://exemple.test",
  });
  assert.ok(!content.html.includes("<script>"));
  assert.match(content.html, /&lt;script&gt;/);
});

test("la mention publique dit par quel canal le code est parti", () => {
  const fr = offPlatformNotice("whatsapp", "2026-11-07T21:45:00.000Z", "fr");
  assert.match(fr, /WhatsApp/);
  assert.match(fr, /07\/11\/2026/);

  assert.match(offPlatformNotice("phone", null, "en"), /phone call/i);
  assert.match(offPlatformNotice("email", null, "ar"), /البريد الإلكتروني/);
  assert.equal(offPlatformNotice(null, null, "fr"), null);
  assert.equal(offPlatformNotice("telegram", null, "fr"), null);
});

test("les libellés du script de vérification restent alignés sur le noyau", () => {
  assert.deepEqual({ ...OFF_PLATFORM_LABELS }, { ...OFF_PLATFORM_CHANNEL_LABELS });
});
