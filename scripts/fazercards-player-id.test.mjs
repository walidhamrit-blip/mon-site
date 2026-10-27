#!/usr/bin/env node
/**
 * Vérification de l'identifiant joueur avant l'achat.
 *
 * Incident réel : un client a payé une recharge **AFK Journey** en saisissant
 * l'identifiant de son compte **8 Ball Pool**. Le formulaire acceptait la
 * valeur, l'achat est parti chez le fournisseur, et une recharge livrée est
 * irréversible. Ces tests verrouillent la protection ajoutée.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hasPlayerIdField } from "../src/lib/fazercards-player-id-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(new URL(path, `file://${root}`), "utf8");
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

test("les champs d'identifiant de compte sont reconnus", () => {
  for (const key of ["user_id", "player_id", "account_id", "uid", "userId", "accountId"]) {
    assert.equal(hasPlayerIdField([{ key }]), true, key);
  }
  // Un identifiant de SERVEUR n'est pas un identifiant de compte : une
  // recherche de sous-chaîne sur « id » le confondait avec `user_id`.
  for (const key of ["server_id", "zone_id", "region_id", "order_id"]) {
    assert.equal(hasPlayerIdField([{ key }]), false, key);
  }
  assert.equal(hasPlayerIdField([]), false);
  // Un jeu qui demande l'ID + le serveur reste bien détecté comme vérifiable.
  assert.equal(hasPlayerIdField([{ key: "user_id" }, { key: "server_id" }]), true);
});

test("la caisse vérifie l'identifiant AVANT de créer la facture", () => {
  const flat = code(read("src/lib/fazercards-orders.ts"));
  const checkout = flat.slice(flat.indexOf("export async function createFazercardsCheckout"));
  const checkAt = checkout.indexOf("checkFazercardsPlayerId");
  const refAt = checkout.indexOf('newOrderReference("DGC")');
  assert.ok(checkAt > 0, "vérification absente de la caisse");
  assert.ok(refAt > 0, "création de commande introuvable");
  assert.ok(checkAt < refAt, "la vérification doit précéder la création de la facture");
  assert.match(checkout, /invalid_player_id/);
  assert.match(checkout, /aucun montant n'a été débité/);
});

test("la livraison revérifie l'identifiant et n'achète pas si invalide", () => {
  const flat = code(read("src/lib/fazercards-orders.ts"));
  const delivery = flat.slice(flat.indexOf("export async function deliverPaidFazercardsOrder"));
  const verifyAt = delivery.indexOf("checkFazercardsPlayerId");
  const purchaseAt = delivery.indexOf("placeFazercardsOrder(loaded)");
  assert.ok(verifyAt > 0, "seconde vérification absente");
  assert.ok(purchaseAt > 0, "achat fournisseur introuvable");
  assert.ok(verifyAt < purchaseAt, "la vérification doit précéder l'achat");
  // Un identifiant invalide passe la main à un humain, sans achat.
  assert.match(delivery, /Achat NON effectué/);
});

test("la route de vérification est publique mais limitée", () => {
  const flat = code(read("src/app/api/fazercards/validate-id/route.ts"));
  assert.match(flat, /enforceSameOrigin\(request\)/);
  assert.match(flat, /checkRateLimit\(LIMIT, request\)/);
  assert.match(flat, /checked: check\.checked/);
  // Aucune donnée financière ne doit sortir par cette route.
  assert.doesNotMatch(flat, /balance/i);
});

test("le tunnel bloque le paiement sur un identifiant inexistant", () => {
  const flat = code(read("src/components/digital-buy-dialog.tsx"));
  assert.match(flat, /fetch\("\/api\/fazercards\/validate-id"/);
  assert.match(flat, /idCheck\.state === "invalid"/);
  assert.match(flat, /not found in this game/);
  // …et rappelle le nom du jeu pour éviter le mauvais identifiant.
  assert.match(flat, /must be your account in \$\{product\.platform\} specifically/);
});
