#!/usr/bin/env node
/**
 * Jetons d'accès — logique PURE.
 *
 * Deux secrets distincts décident qui voit quoi :
 *   - le jeton de suivi (`orders.tracking_token_hash`) ouvre le statut d'une
 *     commande et les codes livrés ;
 *   - le jeton de session ouvre /admin.
 * Aucun des deux n'était couvert par un test exécuté.
 *
 * Les assertions de session signent avec `node:crypto` : elles vérifient donc
 * l'interopérabilité HMAC-SHA256 avec l'implémentation Web Crypto du module,
 * pas seulement sa cohérence interne.
 *
 * Exécution : npm run test:core
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";


const {
  trackingAccess, verifyTrackingToken, hashTrackingToken, createTrackingToken, maskEmail,
} = await import("../src/lib/order-tracking.ts");
const {
  createSessionToken, verifySessionToken, checkPassword, sessionSecret,
} = await import("../src/lib/session-token.ts");

/* ===================== jetons de suivi ===================== */

test("suivi : commandes antérieures sans empreinte → accès « legacy »", () => {
  assert.equal(trackingAccess(null, undefined), "legacy");
  assert.equal(trackingAccess(undefined, "peu-importe"), "legacy");
  assert.equal(trackingAccess("", "peu-importe"), "legacy");
  assert.equal(trackingAccess("   ", "peu-importe"), "legacy");
});

test("suivi : bon jeton → granted, mauvais jeton → denied", () => {
  const { token, hash } = createTrackingToken();
  assert.equal(trackingAccess(hash, token), "granted");
  assert.equal(trackingAccess(hash, "mauvais-jeton-de-32-caracteres!!"), "denied");
  assert.equal(trackingAccess(hash, undefined), "denied");
  assert.equal(trackingAccess(hash, ""), "denied");
  assert.equal(trackingAccess(hash, "   "), "denied");
});

test("suivi : empreinte stockée en majuscules et jeton entouré d'espaces tolérés", () => {
  const { token, hash } = createTrackingToken();
  assert.equal(trackingAccess(hash.toUpperCase(), token), "granted");
  assert.equal(trackingAccess(hash, `  ${token}  `), "granted");
});

test("suivi : le jeton a 256 bits d'entropie et seul son SHA-256 est comparé", () => {
  const { token, hash } = createTrackingToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hashTrackingToken(token), hash);
  assert.notEqual(createTrackingToken().token, token);
});

test("suivi : une empreinte tronquée ou d'un autre jeton est refusée", () => {
  const a = createTrackingToken();
  const b = createTrackingToken();
  assert.equal(verifyTrackingToken(a.token, b.hash), false);
  assert.equal(verifyTrackingToken(a.token, a.hash.slice(0, 32)), false);
  assert.equal(verifyTrackingToken("", a.hash), false);
  assert.equal(verifyTrackingToken(null, null), false);
});

test("masquage d'e-mail : jamais l'adresse complète", () => {
  assert.equal(maskEmail("walid@nokhba.net.ly"), "w***@nokhba.net.ly");
  assert.equal(maskEmail("  a@b.c "), "a***@b.c");
  assert.equal(maskEmail("sans-arobase"), "***");
  assert.equal(maskEmail("@nokhba.net.ly"), "***");
  assert.equal(maskEmail("oups@"), "***");
  assert.equal(maskEmail(null), null);
  assert.equal(maskEmail(""), null);
});

/* ===================== jeton de session admin ===================== */

/** Signature indépendante : node:crypto, pas la Web Crypto du module. */
const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const forge = (exp, secret) => {
  const payload = `v1.${exp}`;
  return `${payload}.${b64url(createHmac("sha256", secret).update(payload).digest())}`;
};

const SECRET = "secret-de-session-de-test-0123456789";
process.env.SESSION_SECRET = SECRET;
delete process.env.ADMIN_PASSWORD;

test("session : un jeton fraîchement créé est valide 7 jours", async () => {
  const token = await createSessionToken();
  assert.match(token, /^v1\.\d+\.[A-Za-z0-9_-]{43}$/);
  assert.equal(await verifySessionToken(token), true);
});

test("session : signature HMAC-SHA256 interopérable avec node:crypto", async () => {
  const exp = Date.now() + 60_000;
  assert.equal(await verifySessionToken(forge(exp, SECRET)), true);
});

test("session : jeton expiré refusé", async () => {
  assert.equal(await verifySessionToken(forge(Date.now() - 1_000, SECRET)), false);
});

test("session : version, format et signature invalides refusés", async () => {
  const token = await createSessionToken();
  const [version, exp, sig] = token.split(".");
  assert.equal(await verifySessionToken(`v2.${exp}.${sig}`), false);
  assert.equal(await verifySessionToken(`${version}.${exp}`), false);
  assert.equal(await verifySessionToken(`${version}.pas-un-nombre.${sig}`), false);
  const flipped = `${version}.${exp}.${sig.slice(0, -1)}${sig.at(-1) === "A" ? "B" : "A"}`;
  assert.equal(await verifySessionToken(flipped), false);
  assert.equal(await verifySessionToken(""), false);
  assert.equal(await verifySessionToken("n-importe-quoi"), false);
});

test("session : jeton d'un autre secret refusé", async () => {
  assert.equal(await verifySessionToken(forge(Date.now() + 60_000, "un-autre-secret")), false);
});

test("session : SESSION_SECRET prime sur ADMIN_PASSWORD", async () => {
  process.env.ADMIN_PASSWORD = "mot-de-passe-admin";
  assert.equal(sessionSecret(), SECRET);
  assert.equal(await verifySessionToken(forge(Date.now() + 60_000, SECRET)), true);
  assert.equal(await verifySessionToken(forge(Date.now() + 60_000, "mot-de-passe-admin")), false);
  delete process.env.ADMIN_PASSWORD;
});

test("session : sans aucun secret, rien ne peut être signé ni accepté", async () => {
  const saved = process.env.SESSION_SECRET;
  delete process.env.SESSION_SECRET;
  await assert.rejects(createSessionToken());
  assert.equal(await verifySessionToken(forge(Date.now() + 60_000, "peu-importe")), false);
  process.env.SESSION_SECRET = saved;
});

test("mot de passe admin : ok / invalide / non configuré", () => {
  delete process.env.ADMIN_PASSWORD;
  assert.equal(checkPassword("x"), "unconfigured");
  process.env.ADMIN_PASSWORD = "mot-de-passe-long";
  assert.equal(checkPassword("mot-de-passe-long"), "ok");
  assert.equal(checkPassword("mauvais"), "invalid");
  assert.equal(checkPassword(""), "invalid");
  assert.equal(checkPassword("mot-de-passe-lon"), "invalid");
  delete process.env.ADMIN_PASSWORD;
});
