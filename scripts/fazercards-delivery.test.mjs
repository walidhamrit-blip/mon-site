#!/usr/bin/env node
/**
 * Lecture d'une commande FazerCards et décision de livraison.
 *
 * Ces tests sont nés d'un incident réel : commande `ord-2492479`
 * (Beyond: Two Souls, clé Steam) livrée par le fournisseur au statut
 * `completed`, mais classée « livraison manuelle requise » parce que
 * l'extraction ne connaissait pas la forme `payload.keys`.
 *
 * Ils importent le module TypeScript réel (Node 22 retire les types) : on
 * teste le comportement, pas la forme du code.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyFazercardsDelivery,
  describeFazercardsPayload,
  extractFazercardsCodes,
  extractFazercardsCodesFromOrder,
  redactFazercardsPayload,
} from "../src/lib/fazercards-extract.ts";

/** Réponse réelle du fournisseur pour la commande ord-2492479. */
const GAME_KEY_PAYLOAD = {
  keys: ["9M0TD-WNNPW-6D0D4"],
  game: "Beyond: Two Souls",
  platform: "steam",
  region: "GLOBAL",
  price_usd: "1.7214",
};

test("une clé de jeu est extraite de payload.keys (incident ord-2492479)", () => {
  const codes = extractFazercardsCodes(GAME_KEY_PAYLOAD);
  assert.equal(codes.length, 1);
  assert.equal(codes[0].cardNumber, "9M0TD-WNNPW-6D0D4");
  assert.equal(codes[0].pinCode, null);
});

test("les autres formes connues du fournisseur restent lues", () => {
  const shapes = [
    { codes: [{ cardNumber: "AAA-BBB-CCC" }] },
    { codes: [{ code: "AAA-BBB-CCC" }] },
    { codes: ["AAA-BBB-CCC"] },
    { keys: [{ key: "AAA-BBB-CCC" }] },
    { keys: [{ keyCode: "AAA-BBB-CCC" }] },
    { cards: [{ serial: "AAA-BBB-CCC" }] },
    { cardNumber: "AAA-BBB-CCC" },
    { code: "AAA-BBB-CCC" },
    { serial_number: "AAA-BBB-CCC" },
    { result: { items: [{ code: "AAA-BBB-CCC" }] } },
  ];
  for (const payload of shapes) {
    const codes = extractFazercardsCodes(payload);
    assert.equal(codes.length, 1, `forme non lue : ${JSON.stringify(payload)}`);
    assert.equal(codes[0].cardNumber, "AAA-BBB-CCC");
  }
});

test("un PIN et un lien d'activation restent associés au code", () => {
  const codes = extractFazercardsCodes({
    codes: [
      {
        cardNumber: "6120200345149064",
        pinCode: "EFSDCEAFSD",
        redemptionUrl: "https://example.test/activer",
      },
    ],
  });
  assert.equal(codes[0].pinCode, "EFSDCEAFSD");
  assert.equal(codes[0].redemptionUrl, "https://example.test/activer");
});

test("le doublon n'est pas produit deux fois", () => {
  const codes = extractFazercardsCodes({
    keys: ["9M0TD-WNNPW-6D0D4"],
    codes: [{ cardNumber: "9M0TD-WNNPW-6D0D4" }],
  });
  assert.equal(codes.length, 1);
});

test("les valeurs de statut ou de devise ne sont jamais prises pour un code", () => {
  const codes = extractFazercardsCodes({
    status: "completed",
    currency: "USD",
    id: "ord-2492479",
    kind: "gift_card",
  });
  assert.deepEqual(codes, []);
});

test("une réponse vide ou illisible ne lève pas", () => {
  for (const payload of [null, undefined, "texte", 42, [], {}]) {
    assert.deepEqual(extractFazercardsCodes(payload), []);
  }
});

test("une recharge terminée sans code est un SUCCÈS, pas un échec", () => {
  // payload vide : c'est la forme normale d'un top-up (crédit sur le compte
  // du joueur). L'ancien code y voyait « aucun code → livraison manuelle ».
  assert.equal(
    classifyFazercardsDelivery({
      kind: "game_topup",
      status: "completed",
      codes: [],
    }),
    "topup_completed",
  );
});

test("une carte terminée sans code reste une anomalie à traiter", () => {
  for (const kind of ["gift_card", "software_key"]) {
    assert.equal(
      classifyFazercardsDelivery({ kind, status: "completed", codes: [] }),
      "processing",
    );
  }
});

test("un statut d'échec fournisseur prime sur le type de produit", () => {
  for (const status of ["cancelled", "canceled", "failed", "refunded", "rejected"]) {
    for (const kind of ["game_topup", "gift_card", "software_key"]) {
      assert.equal(
        classifyFazercardsDelivery({ kind, status, codes: [] }),
        "failed",
        `${kind}/${status}`,
      );
    }
  }
});

test("des codes présents valent livraison, quel que soit le libellé du statut", () => {
  assert.equal(
    classifyFazercardsDelivery({
      kind: "software_key",
      status: "completed",
      codes: [{ cardNumber: "9M0TD-WNNPW-6D0D4", pinCode: null, redemptionUrl: null }],
    }),
    "codes",
  );
});

test("un statut encore en cours reste en attente", () => {
  for (const status of ["processing", "created", "pending", "paid"]) {
    assert.equal(
      classifyFazercardsDelivery({ kind: "game_topup", status, codes: [] }),
      "processing",
    );
  }
});

test("la journalisation masque les codes mais garde la structure", () => {
  const redacted = redactFazercardsPayload(GAME_KEY_PAYLOAD);
  assert.deepEqual(Object.keys(redacted).sort(), Object.keys(GAME_KEY_PAYLOAD).sort());
  assert.equal(
    JSON.stringify(redacted).includes("9M0TD-WNNPW-6D0D4"),
    false,
    "la clé ne doit jamais apparaître dans les logs",
  );
  assert.match(String(redacted.keys[0]), /masqué/);
  // Les champs non sensibles restent lisibles pour le diagnostic.
  assert.equal(redacted.game, "Beyond: Two Souls");
  assert.equal(redacted.platform, "steam");
});

test("la journalisation masque aussi un PIN", () => {
  const redacted = redactFazercardsPayload({
    codes: [{ cardNumber: "6120200345149064", pinCode: "EFSDCEAFSD" }],
  });
  const text = JSON.stringify(redacted);
  assert.equal(text.includes("6120200345149064"), false);
  assert.equal(text.includes("EFSDCEAFSD"), false);
});

/* --------- Incident du 29/10/2026 : carte cadeau « completed » sans code -------- */

test("une carte cadeau est lue même si le code n'est pas dans payload", () => {
  // Forme plausible d'une réponse `GET /orders/:id` non documentée :
  // le code est au niveau de la commande, à côté du payload.
  const order = {
    id: "ord-2540591",
    kind: "gift_card",
    status: "completed",
    created_at: "2026-10-29T01:20:00Z",
    card_code: "PSUS-2USD-4K7Q-9WX2",
    payload: { card_id: "2_usd", quantity: 1 },
  };
  const codes = extractFazercardsCodesFromOrder(order);
  assert.equal(codes.length, 1);
  assert.equal(codes[0].cardNumber, "PSUS-2USD-4K7Q-9WX2");
});

test("une commande complète est analysée quand payload est vide", () => {
  const order = {
    id: "ord-1",
    status: "completed",
    payload: {},
    vouchers: [{ serial: "VCH-1234-5678" }],
  };
  const codes = extractFazercardsCodesFromOrder(order);
  assert.equal(codes.length, 1);
  assert.equal(codes[0].cardNumber, "VCH-1234-5678");
});

test("un identifiant technique n'est jamais pris pour un code", () => {
  // `order_id`, `key_id`, `code_status`… contiennent « id »/« code » mais ne
  // sont pas des codes livrés : les envoyer au client serait grave.
  const order = {
    id: "ord-2540591",
    status: "completed",
    order_id: "ord-2540591",
    key_id: "3141592653589793",
    code_status: "pending_1234",
    payload: { category_id: "giftcard_playstation_us" },
  };
  assert.deepEqual(extractFazercardsCodesFromOrder(order), []);
});

test("un code générique doit ressembler à un code (chiffre ou tiret)", () => {
  const order = { status: "completed", redemption_code: "merci beaucoup" };
  assert.deepEqual(extractFazercardsCodesFromOrder(order), []);
});

test("la structure d'une réponse se décrit sans révéler les valeurs", () => {
  const lines = describeFazercardsPayload({
    id: "ord-2540591",
    status: "completed",
    payload: { card_code: "PSUS-2USD-4K7Q-9WX2" },
  });
  const flat = lines.join(" | ");
  assert.match(flat, /payload\.card_code/);
  assert.doesNotMatch(flat, /PSUS-2USD/);
});
