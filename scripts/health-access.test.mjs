#!/usr/bin/env node
/**
 * Accès à la sonde `/api/health`.
 *
 * La route est publique par nécessité (un moniteur de disponibilité et le
 * lien de secours du dialogue de paiement la lisent). Mais son diagnostic
 * complet révèle la configuration et déclenche des appels facturés chez
 * NOWPayments et FazerCards : il doit être réservé à l'admin ou à un appelant
 * muni de `CRON_SECRET`.
 *
 * Exécution : npm run test:health
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const { hasServerSecret } = await import("../src/lib/server-secret.ts");

const SECRET = "secret-de-test-32-caracteres-minimum";
const request = (init = {}) => new Request("https://nokhba.net.ly/api/health", init);

test("secret serveur : Bearer valide accepté, autres valeurs refusées", () => {
  process.env.CRON_SECRET = SECRET;
  assert.equal(hasServerSecret(request({ headers: { authorization: `Bearer ${SECRET}` } })), true);
  assert.equal(hasServerSecret(request({ headers: { authorization: `bearer ${SECRET}` } })), true);
  assert.equal(hasServerSecret(request({ headers: { authorization: "Bearer mauvais-secret" } })), false);
  assert.equal(hasServerSecret(request({ headers: { authorization: SECRET } })), false);
  assert.equal(hasServerSecret(request()), false);
});

test("secret serveur : paramètre ?key= accepté", () => {
  process.env.CRON_SECRET = SECRET;
  assert.equal(
    hasServerSecret(new Request(`https://nokhba.net.ly/api/health?key=${SECRET}`)),
    true,
  );
  assert.equal(
    hasServerSecret(new Request("https://nokhba.net.ly/api/health?key=faux")),
    false,
  );
});

test("secret serveur : sans CRON_SECRET, aucune voie serveur-à-serveur", () => {
  const saved = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  assert.equal(hasServerSecret(request({ headers: { authorization: `Bearer ${SECRET}` } })), false);
  assert.equal(hasServerSecret(new Request(`https://nokhba.net.ly/api/health?key=${SECRET}`)), false);
  if (saved !== undefined) process.env.CRON_SECRET = saved;
});

test("la route publique ne déclenche aucun appel fournisseur", () => {
  const source = readFileSync(`${root}/src/app/api/health/route.ts`, "utf8");
  const gate = source.indexOf("healthAccess(req)");
  const publicReturn = source.indexOf('mode: "public"');
  // Formes d'APPEL (l'import, lui, est forcément en tête de fichier).
  const paidCall = source.indexOf("checkNowPaymentsApiKey()");
  const providerCall = source.indexOf("checkFazercardsCredentials({ timeoutMs");

  assert.ok(gate > 0, "la route doit appeler healthAccess()");
  assert.ok(publicReturn > gate, "le retour public doit suivre la porte d'accès");
  assert.ok(
    paidCall > publicReturn && providerCall > publicReturn,
    "les sondes NOWPayments / FazerCards doivent rester APRÈS le retour public, " +
      "sinon un visiteur non authentifié déclenche des appels facturés",
  );
});
