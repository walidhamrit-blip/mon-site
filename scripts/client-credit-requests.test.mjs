#!/usr/bin/env node
/**
 * Demandes d'utilisation d'un solde par le client (option B).
 *
 * Règle : le client peut DEMANDER, jamais débiter. L'argent ne bouge qu'après
 * validation admin, et par un mouvement — pas par une écriture du solde.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CREDIT_REQUEST_LABELS,
  CREDIT_REQUEST_STATUSES,
  creditRequestBlock,
  normalizeCreditRequestStatus,
} from "../src/lib/client-credits-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(new URL(path, `file://${root}`), "utf8");
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

test("le bouton « utiliser mon solde » n'apparaît que dans les cas utiles", () => {
  assert.equal(creditRequestBlock({ balanceLyd: "12.04" }), "none");
  assert.equal(creditRequestBlock({ balanceLyd: "0.00" }), "no_balance");
  assert.equal(creditRequestBlock({ balanceLyd: "12.04", hasPendingRequest: true }), "already_pending");
  assert.equal(creditRequestBlock({ balanceLyd: "12.04", alreadyUsed: true }), "already_used");
  assert.equal(creditRequestBlock({ balanceLyd: "12.04", orderStatus: "delivered" }), "order_closed");
  assert.equal(creditRequestBlock({ balanceLyd: "12.04", orderStatus: "FAILED" }), "order_closed");
  assert.equal(creditRequestBlock({ balanceLyd: "12.04", hasIdentity: false }), "no_identity");
  // Une valeur illisible ne propose jamais un montant inventé.
  assert.equal(creditRequestBlock({ balanceLyd: "n'importe quoi" }), "no_balance");
  // Une commande encore en préparation reste ouverte à la demande.
  assert.equal(creditRequestBlock({ balanceLyd: "12.04", orderStatus: "manual" }), "none");
});

test("statuts de demande normalisés et libellés complets", () => {
  assert.deepEqual([...CREDIT_REQUEST_STATUSES], ["pending", "approved", "rejected"]);
  assert.equal(normalizeCreditRequestStatus("APPROVED"), "approved");
  assert.equal(normalizeCreditRequestStatus(" rejected "), "rejected");
  assert.equal(normalizeCreditRequestStatus("bizarre"), "pending");
  assert.equal(normalizeCreditRequestStatus(null), "pending");
  for (const status of CREDIT_REQUEST_STATUSES) {
    assert.ok(CREDIT_REQUEST_LABELS[status].length > 3, `libellé manquant pour ${status}`);
  }
});

test("la demande du client ne débite jamais le solde", () => {
  const lib = code(read("src/lib/client-credit-requests.ts"));
  const request = lib.slice(
    lib.indexOf("export async function requestCreditUse"),
    lib.indexOf("export async function creditRequestNotice"),
  );
  // Aucun mouvement, aucune écriture du solde dans le chemin de la demande.
  assert.doesNotMatch(request, /addCreditMovement/);
  assert.doesNotMatch(request, /clientCredits\s*\)\s*\.set|update\(clientCredits\)/);
  assert.match(request, /status: "pending"/);

  // Seule la validation admin applique le débit, par un mouvement « use ».
  const approve = lib.slice(
    lib.indexOf("export async function approveCreditRequest"),
    lib.indexOf("export async function rejectCreditRequest"),
  );
  assert.match(approve, /addCreditMovement\(/);
  assert.match(approve, /kind: "use"/);
  assert.match(approve, /orderRef: request\.orderRef/);

  // Le refus ne touche à rien.
  const reject = lib.slice(lib.indexOf("export async function rejectCreditRequest"));
  assert.doesNotMatch(reject, /addCreditMovement/);
  assert.match(reject, /status: "rejected"/);
});

test("le montant vient de la base, jamais du navigateur", () => {
  const route = code(read("src/app/api/digital/orders/[ref]/credit/route.ts"));
  // Le corps envoyé par le client ne peut porter qu'une note libre.
  assert.match(route, /z\.object\(\{\s*note:/);
  assert.doesNotMatch(route, /amountLyd|balanceLyd\s*:/);
  // Jeton obligatoire, et 404 (jamais 403) quand il manque ou ne correspond pas.
  assert.match(route, /trackingTokenFromRequest\(req\)/);
  assert.match(route, /status: 404/);
  // POST protégé comme la caisse : même origine + limitation de débit.
  assert.match(route, /enforceSameOrigin\(req\)/);
  assert.match(route, /checkRateLimit\(REQUEST_LIMIT, req\)/);
});

test("le suivi ne montre que le solde du propriétaire du lien", () => {
  const lib = code(read("src/lib/client-credit-requests.ts"));
  const view = lib.slice(
    lib.indexOf("export async function getClientCreditView"),
    lib.indexOf("export async function requestCreditUse"),
  );
  assert.match(view, /trackingAccess\(row\.hash, trackingToken\) === "denied"/);
  assert.match(view, /return null/);
  // L'identité du client est lue sur la commande, pas reçue du client.
  assert.match(lib, /normalizeClientKey\(\{\s*email: found\.digital\.recipientEmail/);
});

test("l'interface client n'expose ni autre client ni montant calculé côté navigateur", () => {
  const ui = read("src/app/(site)/codes/commande/digital-order-status.tsx");
  assert.match(ui, /\/credit`/);
  assert.match(ui, /x-order-tracking-token/);
  assert.match(ui, /Use my balance|استخدام رصيدي/);
  // Le montant affiché vient du serveur (`balanceLyd`) : pas de saisie libre.
  assert.doesNotMatch(ui, /name="amount"/);
});

test("l'admin valide depuis les soldes, avec session et trace", () => {
  const actions = read("src/app/admin/actions.ts");
  const approve = actions.slice(
    actions.indexOf("export async function approveCreditRequestAction"),
    actions.indexOf("export async function rejectCreditRequestAction"),
  );
  assert.match(approve, /await requireAdmin\(\)/);
  assert.match(approve, /approveCreditRequest\(Number\(requestId\), note\)/);
  assert.match(approve, /revalidatePath\("\/admin\/soldes"\)/);
  const reject = actions.slice(actions.indexOf("export async function rejectCreditRequestAction"));
  assert.match(reject, /await requireAdmin\(\)/);

  const page = read("src/app/admin/(panel)/soldes/page.tsx");
  assert.match(page, /listCreditRequests\(/);
  assert.match(page, /requests=\{requests\}/);
  const manager = read("src/app/admin/(panel)/soldes/client-credits-manager.tsx");
  assert.match(manager, /Valider l/);
  assert.match(manager, /Refuser/);
});

test("la table des demandes est créée sans migration manuelle", () => {
  const schema = read("src/db/schema.ts");
  assert.match(schema, /pgTable\("client_credit_requests"/);
  const ddl = read("src/db/index.ts");
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS client_credit_requests/);
  // Un seul en-attente par commande, et pas de double validation.
  assert.match(
    ddl,
    /CREATE UNIQUE INDEX IF NOT EXISTS client_credit_requests_order_status_idx ON client_credit_requests \(order_ref, status\)/,
  );
});

test("l'e-mail admin prévient sans rien débiter", () => {
  const emails = read("src/lib/digital-emails.ts");
  const notice = emails.slice(emails.indexOf("export async function sendCreditUseRequestNotice"));
  assert.match(notice, /Aucun montant n'a été débité|Rien n'a été débité/);
  assert.match(notice, /\/admin\/soldes/);
  const route = read("src/app/api/digital/orders/[ref]/credit/route.ts");
  assert.match(route, /sendCreditUseRequestNotice\(/);
});
