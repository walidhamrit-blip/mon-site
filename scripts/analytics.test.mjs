#!/usr/bin/env node
/**
 * Garde-fou de la mesure du funnel.
 *
 * La mesure ne doit jamais envoyer de donnée personnelle, ni casser un
 * parcours. Ces tests lisent les sources (pas de rendu React).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

/** Retire les commentaires : on teste le code, pas la prose. */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const analytics = "src/lib/analytics.ts";

test("l'enveloppe ne transporte que des propriétés non personnelles", () => {
  const source = code(read(analytics));
  assert.match(source, /const PROP_KEYS = new Set\(\["path", "id", "source", "kind"\]\)/);
  assert.doesNotMatch(
    source,
    /(email|phone|telephone|customerName|orderId|reference)/i,
    "aucune propriété personnelle ou de commande autorisée",
  );
  assert.match(source, /typeof window === "undefined"/, "aucun envoi côté serveur");
  assert.match(source, /try \{[\s\S]*track\(/, "une erreur de mesure ne casse pas le clic");
});

test("les six événements du plan sont déclarés", () => {
  const source = read(analytics);
  for (const event of [
    "gateway_click",
    "service_view",
    "whatsapp_click",
    "lead_submit",
    "checkout_start",
    "audit_request",
  ]) {
    assert.match(source, new RegExp(`"${event}"`), `${event} manquant`);
  }
});

test("chaque point d'entrée émet son événement", () => {
  const expectations = [
    ["src/components/sections/home-gateway.tsx", /gateway_click/],
    ["src/components/service-detail-view.tsx", /service_view/],
    ["src/components/whatsapp-enquiry.tsx", /whatsapp_click/],
    ["src/components/sections/cta-form.tsx", /lead_submit/],
    ["src/components/digital-buy-dialog.tsx", /checkout_start/],
    ["src/components/checkout-dialog.tsx", /checkout_start/],
  ];
  for (const [path, pattern] of expectations) {
    assert.match(read(path), pattern, `${path} n'émet pas l'événement attendu`);
  }
});

test("les points WhatsApp sont distingués par une source", () => {
  assert.match(read("src/components/whatsapp-enquiry.tsx"), /source = "page"/);
  for (const [path, source] of [
    ["src/components/whatsapp-float.tsx", "float"],
    ["src/components/footer.tsx", "footer"],
    ["src/components/navbar.tsx", "navbar-desktop"],
  ]) {
    assert.match(read(path), new RegExp(`source="${source}"`), `${path} sans source`);
  }
});
