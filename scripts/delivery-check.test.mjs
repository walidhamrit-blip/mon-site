import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deliveryVerdict,
  expectedCodes,
  maskEmail,
  normalizeStatus,
  offPlatformLabel,
} from "./delivery-check-core.mjs";

const base = {
  status: "delivered",
  kind: "gift_card",
  hasCodesCipher: true,
  quantity: 1,
  deliveredAt: "2026-11-07T12:00:00.000Z",
  emailSentAt: "2026-11-07T12:00:05.000Z",
  emailLastError: null,
};

test("livrée avec code + e-mail accepté → ok", () => {
  const verdict = deliveryVerdict(base);
  assert.equal(verdict.level, "ok");
  assert.equal(verdict.code, "delivered");
});

test("livrée mais e-mail jamais parti → warn (pas ok)", () => {
  const verdict = deliveryVerdict({
    ...base,
    emailSentAt: null,
    emailLastError: "resend : domain not verified",
  });
  assert.equal(verdict.level, "warn");
  assert.equal(verdict.code, "delivered_no_email");
  assert.match(verdict.detail, /domain not verified/);
});

test("« Livré » sans code stocké → fail (faux positif du badge)", () => {
  const verdict = deliveryVerdict({ ...base, hasCodesCipher: false });
  assert.equal(verdict.level, "fail");
  assert.equal(verdict.code, "delivered_without_codes");
});

test("recharge de jeu livrée sans code → ok", () => {
  const verdict = deliveryVerdict({
    ...base,
    kind: "game_topup",
    hasCodesCipher: false,
  });
  assert.equal(verdict.level, "ok");
  assert.equal(verdict.code, "topup_delivered");
});

test("payée non livrée → fail", () => {
  for (const status of ["paid", "manual"]) {
    const verdict = deliveryVerdict({
      ...base,
      status,
      hasCodesCipher: false,
      deliveredAt: null,
      emailSentAt: null,
    });
    assert.equal(verdict.level, "fail");
    assert.equal(verdict.code, "paid_not_delivered");
  }
});

test("en attente de paiement → warn, échec → fail", () => {
  assert.equal(deliveryVerdict({ ...base, status: "pending" }).code, "awaiting_payment");
  assert.equal(deliveryVerdict({ ...base, status: "failed" }).level, "fail");
});

test("statut inconnu retombe sur pending", () => {
  assert.equal(normalizeStatus("PAID"), "paid");
  assert.equal(normalizeStatus("n-importe-quoi"), "pending");
  assert.equal(normalizeStatus(null), "pending");
  assert.equal(deliveryVerdict({ ...base, status: "weird" }).code, "awaiting_payment");
});

test("e-mail masqué, jamais en clair", () => {
  assert.equal(maskEmail("walid@example.com"), "w••••@example.com");
  assert.equal(maskEmail(""), "—");
  assert.equal(maskEmail("pas-un-email"), "•••");
});

test("codes attendus : quantité, sauf recharge de jeu", () => {
  assert.equal(expectedCodes({ kind: "gift_card", quantity: 2 }), 2);
  assert.equal(expectedCodes({ kind: "game_topup", quantity: 3 }), 0);
  assert.equal(expectedCodes({ kind: "gift_card", quantity: 0 }), 1);
});

test("carte téléphonique non vérifiée → livraison verrouillée (warn)", () => {
  const verdict = deliveryVerdict({
    ...base,
    status: "pending",
    paymentMethod: "phone_card",
    phoneCardStatus: "pending",
    hasCodesCipher: false,
    deliveredAt: null,
    emailSentAt: null,
  });
  assert.equal(verdict.level, "warn");
  assert.equal(verdict.code, "phone_card_unverified");
});

test("carte acceptée mais code non saisi → fail explicite", () => {
  const verdict = deliveryVerdict({
    ...base,
    status: "manual",
    paymentMethod: "phone_card",
    phoneCardStatus: "approved",
    hasCodesCipher: false,
    deliveredAt: null,
    emailSentAt: null,
  });
  assert.equal(verdict.level, "fail");
  assert.equal(verdict.code, "phone_card_approved_not_delivered");
  assert.ok(verdict.actions.some((action) => /Saisir les codes/i.test(action)));
});

test("carte refusée → fail, aucune livraison", () => {
  const verdict = deliveryVerdict({
    ...base,
    status: "failed",
    paymentMethod: "phone_card",
    phoneCardStatus: "rejected",
    hasCodesCipher: false,
    deliveredAt: null,
    emailSentAt: null,
  });
  assert.equal(verdict.level, "fail");
  assert.equal(verdict.code, "phone_card_rejected");
});

test("carte acceptée puis code livré → ok (pas de régression)", () => {
  const verdict = deliveryVerdict({
    ...base,
    paymentMethod: "phone_card",
    phoneCardStatus: "approved",
  });
  assert.equal(verdict.level, "ok");
  assert.equal(verdict.code, "delivered");
});

test("statut de carte inconnu ou absent → traité comme non vérifié", () => {
  assert.equal(
    deliveryVerdict({ ...base, status: "pending", paymentMethod: "phone_card", phoneCardStatus: null }).code,
    "phone_card_unverified",
  );
  assert.equal(
    deliveryVerdict({ ...base, status: "pending", paymentMethod: "phone_card", phoneCardStatus: "bizarre" }).code,
    "phone_card_unverified",
  );
});

test("livrée hors système (WhatsApp) sans code → ok, pas une incohérence", () => {
  const verdict = deliveryVerdict({
    ...base,
    hasCodesCipher: false,
    deliveryChannel: "whatsapp",
  });
  assert.equal(verdict.level, "ok");
  assert.equal(verdict.code, "off_platform_delivered");
  assert.match(verdict.headline, /WhatsApp/);
});

test("livrée hors système mais client non prévenu → warn", () => {
  const verdict = deliveryVerdict({
    ...base,
    hasCodesCipher: false,
    deliveryChannel: "phone",
    emailSentAt: null,
    emailLastError: "resend : 403",
  });
  assert.equal(verdict.level, "warn");
  assert.equal(verdict.code, "off_platform_no_email");
  assert.match(verdict.detail, /403/);
});

test("« Livré » sans code ET sans canal reste une incohérence", () => {
  const verdict = deliveryVerdict({ ...base, hasCodesCipher: false, deliveryChannel: null });
  assert.equal(verdict.level, "fail");
  assert.equal(verdict.code, "delivered_without_codes");
});

test("libellé de canal : inconnu ou absent ne casse pas l'affichage", () => {
  assert.equal(offPlatformLabel("WhatsApp"), "WhatsApp");
  assert.equal(offPlatformLabel("telegram"), "telegram");
  assert.equal(offPlatformLabel(null), "—");
});
