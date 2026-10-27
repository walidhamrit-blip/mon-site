#!/usr/bin/env node
/**
 * Plateforme affichée sur les fiches de recharge.
 *
 * Ces tests verrouillent deux choses :
 *  - la famille de plateforme est déduite du nom de la catégorie quand elle y
 *    figure, et jamais inventée sinon (on retombe sur le nom du jeu) ;
 *  - seuls les champs qui désignent vraiment un compte de joueur sont
 *    présentés comme « identifiant demandé » (`server_id` n'en est pas un).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectGamePlatform,
  gamePlatformSummary,
  isPlayerAccountKey,
} from "../src/lib/digital-platform-core.ts";
import { hasPlayerIdField } from "../src/lib/fazercards-player-id-core.ts";

test("la famille de plateforme est déduite du nom de la catégorie", () => {
  assert.equal(detectGamePlatform("Free Fire (Mobile)")?.key, "mobile");
  assert.equal(detectGamePlatform("PUBG Mobile")?.key, "mobile");
  assert.equal(detectGamePlatform("Valorant PC")?.key, "pc");
  assert.equal(detectGamePlatform("Fortnite (PlayStation)")?.key, "playstation");
  assert.equal(detectGamePlatform("EA Sports FC — Xbox")?.key, "xbox");
  assert.equal(detectGamePlatform("Zelda (Nintendo Switch)")?.key, "nintendo");
});

test("aucune détection quand le nom ne dit rien : on garde le nom du jeu", () => {
  assert.equal(detectGamePlatform("AFK Journey"), null);
  const summary = gamePlatformSummary({ name: "AFK Journey", platform: "AFK Journey" });
  assert.equal(summary.platform.detected, false);
  assert.equal(summary.platform.fr, "AFK Journey");
});

test("le résumé donne la plateforme du jeu, pas celle de la boutique", () => {
  const summary = gamePlatformSummary({
    name: "Free Fire",
    platform: "Free Fire (Mobile)",
    fields: [{ key: "user_id", label: "Player ID" }],
  });
  assert.equal(summary.platform.detected, true);
  assert.equal(summary.platform.fr, "Mobile");
  assert.equal(summary.platform.en, "Mobile");
  assert.equal(summary.platform.ar, "الهاتف المحمول");
});

test("seuls les champs de compte sont présentés comme identifiant demandé", () => {
  const summary = gamePlatformSummary({
    name: "Ace Racer",
    fields: [
      { key: "user_id", label: "Player ID" },
      { key: "server_id", label: "Server" },
      { key: "zone_id", label: "Zone" },
    ],
  });
  assert.deepEqual(summary.accountFields, ["Player ID"]);
});

test("un champ sans libellé retombe sur sa clé, les doublons disparaissent", () => {
  const summary = gamePlatformSummary({
    name: "Age of Magic",
    fields: [
      { key: "user_id", label: "" },
      { key: "user_id", label: "" },
    ],
  });
  assert.deepEqual(summary.accountFields, ["user_id"]);
});

test("la classification des clés reste identique à celle de la caisse", () => {
  const keys = [
    "user_id",
    "userId",
    "player_id",
    "account_id",
    "uid",
    "id",
    "server_id",
    "zone_id",
    "region_id",
    "order_id",
    "product_id",
    "member_id",
    "game_uid",
    "some_user_id",
    "",
  ];
  for (const key of keys) {
    assert.equal(
      isPlayerAccountKey(key),
      hasPlayerIdField([{ key }]),
      `divergence sur la clé « ${key} »`,
    );
  }
});

test("entrées vides : aucun plantage", () => {
  const summary = gamePlatformSummary({ name: "", platform: null, fields: null });
  assert.equal(summary.platform.fr, "—");
  assert.deepEqual(summary.accountFields, []);
});
