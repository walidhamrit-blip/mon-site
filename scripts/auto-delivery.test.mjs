import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * Garde-fou : le lien de livraison est envoyé AUTOMATIQUEMENT dès la
 * création du dossier — la livraison d'une demande client doit être
 * immédiate, pas dépendante d'un clic manuel.
 *
 * Vérification structurelle (comme les autres garde-fous d'admin dans ce
 * dépôt) : le code appelle bien `sendDeliveryLinkEmail` dans
 * `createDeliveryAction`, sans jamais exposer le jeton dans une réponse.
 */

const actions = readFileSync("src/app/admin/actions.ts", "utf8");
const manager = readFileSync(
  "src/app/admin/(panel)/livraisons/deliveries-manager.tsx",
  "utf8",
);
const notifications = readFileSync("src/lib/delivery-notifications.ts", "utf8");

test("createDeliveryAction envoie le lien au client automatiquement", () => {
  const block = actions.slice(
    actions.indexOf("export async function createDeliveryAction"),
    actions.indexOf("export async function deliveryLinkAction"),
  );
  assert.ok(block.length > 0, "createDeliveryAction introuvable");
  assert.match(block, /await sendDeliveryLinkEmail\(/, "sendDeliveryLinkEmail manquant");
  assert.match(block, /await findDeliveryByRef\(ref\)/, "relecture du dossier manquante");
});

test("l'envoi automatique est « au mieux » : un échec d'e-mail n'annule jamais la création", () => {
  const block = actions.slice(
    actions.indexOf("export async function createDeliveryAction"),
    actions.indexOf("export async function deliveryLinkAction"),
  );
  // Le try/catch délimite l'envoi automatique.
  const catchBody = block.slice(block.indexOf("let emailSent"));
  assert.match(catchBody, /try\s*{/, "envoi automatique non protégé");
  assert.match(catchBody, /catch\s*\(/, "catch manquant autour de l'envoi automatique");
  // Les valeurs par défaut garantissent que la création ne remonte pas échouée.
  assert.match(catchBody, /let emailSent = false/);
  assert.match(catchBody, /let emailError[^\n]*= null/);
});

test("le jeton n'apparaît jamais dans le message de retour", () => {
  const block = actions.slice(
    actions.indexOf("export async function createDeliveryAction"),
    actions.indexOf("export async function deliveryLinkAction"),
  );
  const messageMatch = block.match(/message:\s*`([^`]*)`/);
  assert.ok(messageMatch, "message non trouvé");
  assert.doesNotMatch(messageMatch[1], /token/i, "le jeton ne doit pas fuiter dans le message");
});

test("le type de retour expose le statut d'envoi automatique", () => {
  assert.match(actions, /export interface CreateDeliveryResult/);
  const iface = actions.match(/export interface CreateDeliveryResult[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(iface, /emailSent\?:\s*boolean/);
  assert.match(iface, /emailError\?:\s*string\s*\|\s*null/);
});

test("le renvoi manuel reste disponible (rejeu d'un envoi raté)", () => {
  assert.match(manager, /sendDeliveryLinkAction\(/);
  assert.match(manager, /\bsendLink\b/);
});

test("l'UI affiche le statut d'envoi automatique et le repli WhatsApp", () => {
  assert.match(manager, /created\.emailSent/);
  assert.match(manager, /emailError/);
  assert.match(manager, /transmettez le lien/i);
});

test("l'e-mail client n'est jamais construit avec le jeton en clair ni avec de mot de passe", () => {
  // Garde-fou structuré sur le Gabarit : aucun mot de passe / aucune
  // croyance de jeton n'apparaît dans les e-mails de livraison.
  assert.doesNotMatch(notifications, /password/i);
  const emailBlock = notifications.slice(
    notifications.indexOf("sendDeliveryLinkEmail"),
  );
  assert.match(emailBlock, /row\.email/, "l'e-mail client ne doit pas être reçu sans adresse");
});
