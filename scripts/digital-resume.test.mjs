// Tests du noyau PUR de reprise automatique des commandes de codes.
//
// On vérifie les garde-fous, pas l'exécution : le module testé ne touche ni
// à la base ni au réseau, il décide seulement « reprendre / ignorer /
// abandonner ».
import test from "node:test";
import assert from "node:assert/strict";
import {
  decideDigitalResume,
  RESUME_MAX_ATTEMPTS,
} from "../src/lib/digital-resume-core.ts";

const core = { decideDigitalResume, RESUME_MAX_ATTEMPTS };
const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

function input(overrides = {}) {
  return {
    status: "paid",
    paymentStatus: "paid",
    attempts: 1,
    createdAt: new Date(NOW - 2 * HOUR),
    updatedAt: new Date(NOW - 30 * MIN),
    now: NOW,
    ...overrides,
  };
}

test("une commande payée et inactive depuis 30 min est reprise", () => {
  assert.deepEqual(core.decideDigitalResume(input()), { action: "deliver" });
});

test("une commande dont le paiement n'est pas confirmé n'est jamais reprise", () => {
  for (const paymentStatus of ["pending", "waiting", "confirmed", "failed", null]) {
    const decision = core.decideDigitalResume(input({ paymentStatus }));
    assert.equal(decision.action, "skip");
    assert.match(decision.reason, /paiement/);
  }
});

test("une commande en attente de paiement (pending) avec paiement confirmé est reprise", () => {
  // Cas réel : l'IPN n'a jamais été reçu, la commande est restée `pending`.
  const decision = core.decideDigitalResume(
    input({ status: "pending", attempts: 0, createdAt: new Date(NOW - 3 * HOUR) }),
  );
  assert.equal(decision.action, "deliver");
});

test("les statuts terminaux ou humains ne sont pas repris", () => {
  for (const status of ["delivered", "manual", "failed"]) {
    const decision = core.decideDigitalResume(input({ status }));
    assert.equal(decision.action, "skip");
    assert.match(decision.reason, new RegExp(status));
  }
});

test("le délai de grâce protège les commandes qui viennent de bouger", () => {
  const decision = core.decideDigitalResume(
    input({ updatedAt: new Date(NOW - 2 * MIN) }),
  );
  assert.equal(decision.action, "skip");
  assert.match(decision.reason, /grâce/);
});

test("au plafond de tentatives, la commande passe en livraison manuelle", () => {
  const decision = core.decideDigitalResume(
    input({ attempts: core.RESUME_MAX_ATTEMPTS }),
  );
  assert.equal(decision.action, "give_up");
  assert.match(decision.reason, /manuelle/);
});

test("une commande trop ancienne est confiée à un humain", () => {
  const decision = core.decideDigitalResume(
    input({
      createdAt: new Date(NOW - 20 * 24 * HOUR),
      updatedAt: new Date(NOW - 20 * 24 * HOUR),
      attempts: 2,
    }),
  );
  assert.equal(decision.action, "give_up");
  assert.match(decision.reason, /20 jours/);
});

test("les valeurs manquantes ou illisibles ne plantent pas", () => {
  const decision = core.decideDigitalResume({
    status: "paid",
    paymentStatus: "paid",
    attempts: null,
    createdAt: null,
    updatedAt: "pas une date",
    now: NOW,
  });
  // Date inconnue : on ne peut pas dater le délai de grâce → on ne touche
  // pas à la commande, l'admin garde la main.
  assert.equal(decision.action, "skip");
});
