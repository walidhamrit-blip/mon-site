// Tests du noyau des soldes dus aux clients (aucune base, aucun réseau).
//
// Cas fondateur : carte de recharge de 30,00 LYD pour un devis accepté de
// 17,96 LYD → 12,04 LYD dus au client. Une erreur ici, c'est de l'argent
// perdu ou réclamé à tort : on teste donc les bornes, les arrondis et les
// refus (débit supérieur au solde, montant illisible, identité absente).
import test from "node:test";
import assert from "node:assert/strict";
import {
  CREDIT_MOVEMENT_LABELS,
  CREDIT_MOVEMENT_SIGNS,
  applyMovement,
  balanceLabel,
  displayLyd,
  formatLyd,
  normalizeClientKey,
  normalizeMovementKind,
  overpaymentLyd,
  parseLyd,
} from "../src/lib/client-credits-core.ts";

test("trop-perçu : la carte moins le devis, jamais négatif", () => {
  assert.equal(overpaymentLyd("30.00", "17.96"), 12.04);
  assert.equal(overpaymentLyd(30, 17.96), 12.04);
  assert.equal(overpaymentLyd("15.00", "17.96"), 0, "le client doit encore de l'argent");
  assert.equal(overpaymentLyd("17.96", "17.96"), 0);
  assert.equal(overpaymentLyd(" 30,00 ", "17,96"), 12.04, "virgule décimale acceptée");
  assert.equal(overpaymentLyd(null, "17.96"), null);
  assert.equal(overpaymentLyd("30.00", null), null);
  assert.equal(overpaymentLyd("abc", "17.96"), null);
  assert.equal(overpaymentLyd("0", "17.96"), null);
});

test("montants : arrondi au centime et formats stables", () => {
  assert.equal(parseLyd("12,04"), 12.04);
  assert.equal(parseLyd("12.044"), 12.04);
  assert.equal(parseLyd("12.045"), 12.05);
  assert.equal(parseLyd(""), 0);
  assert.equal(parseLyd("abc"), null);
  assert.equal(formatLyd(12.04), "12.04");
  assert.equal(formatLyd("12,04"), "12.04");
  assert.equal(formatLyd(null), "0.00");
  assert.equal(displayLyd(12.04), "12,04 LYD");
  assert.equal(balanceLabel("12.04"), "12,04 LYD");
  assert.equal(balanceLabel("0"), "0,00 LYD");
  assert.equal(balanceLabel("-0"), "0,00 LYD");
});

test("identité client : e-mail prioritaire, sinon téléphone normalisé", () => {
  assert.deepEqual(normalizeClientKey({ email: "  Nahla@Gmail.COM ", phone: "+218 91 234 5678" }), {
    key: "email:nahla@gmail.com",
    email: "nahla@gmail.com",
    phone: "+218912345678",
  });
  assert.deepEqual(normalizeClientKey({ email: "pas-un-email", phone: "091 234 5678" }), {
    key: "phone:0912345678",
    email: null,
    phone: "0912345678",
  });
  assert.deepEqual(normalizeClientKey({ email: "", phone: "+218912345678" }), {
    key: "phone:+218912345678",
    email: null,
    phone: "+218912345678",
  });
  assert.equal(normalizeClientKey({ email: "x@y", phone: "123" }), null);
  assert.equal(normalizeClientKey({}), null);
});

test("mouvements : sens, cumul et solde après", () => {
  const credit = applyMovement({ balanceLyd: "0.00", kind: "overpayment", amountLyd: "12.04" });
  assert.equal(credit.ok, true);
  assert.equal(credit.signedAmount, "+12.04");
  assert.equal(credit.balanceAfter, "12.04");

  const used = applyMovement({ balanceLyd: credit.balanceAfter, kind: "use", amountLyd: "12.04" });
  assert.equal(used.ok, true);
  assert.equal(used.signedAmount, "-12.04");
  assert.equal(used.balanceAfter, "0.00");

  const refund = applyMovement({ balanceLyd: "12.04", kind: "refund", amountLyd: "5" });
  assert.equal(refund.ok, true);
  assert.equal(refund.balanceAfter, "7.04");

  // Le sens vient du type : un montant négatif saisi pour un débit reste un débit.
  const reused = applyMovement({ balanceLyd: "7.04", kind: "use", amountLyd: "-3" });
  assert.equal(reused.ok, true);
  assert.equal(reused.balanceAfter, "4.04");
});

test("un débit ne peut jamais dépasser le solde", () => {
  for (const kind of ["use", "refund"]) {
    const result = applyMovement({ balanceLyd: "5.00", kind, amountLyd: "20" });
    assert.equal(result.ok, false);
    assert.match(result.error, /insuffisant/i);
  }
});

test("ajustement : correction dans les deux sens, solde jamais négatif", () => {
  const negative = applyMovement({ balanceLyd: "10.00", kind: "adjustment", amountLyd: "-4.50" });
  assert.equal(negative.ok, true);
  assert.equal(negative.balanceAfter, "5.50");

  const positive = applyMovement({ balanceLyd: "5.50", kind: "adjustment", amountLyd: "1" });
  assert.equal(positive.ok, true);
  assert.equal(positive.balanceAfter, "6.50");

  const refused = applyMovement({ balanceLyd: "5.50", kind: "adjustment", amountLyd: "-9" });
  assert.equal(refused.ok, false);
});

test("entrées invalides refusées explicitement", () => {
  assert.equal(applyMovement({ balanceLyd: "0", kind: "inconnu", amountLyd: "1" }).ok, false);
  assert.equal(applyMovement({ balanceLyd: "0", kind: "use", amountLyd: "0" }).ok, false);
  assert.equal(applyMovement({ balanceLyd: "0", kind: "use", amountLyd: "abc" }).ok, false);
  assert.equal(normalizeMovementKind("USE"), "use");
  assert.equal(normalizeMovementKind("overpayment"), "overpayment");
  assert.equal(normalizeMovementKind("n-importe"), null);
});

test("libellés et sens de chaque type de mouvement", () => {
  assert.deepEqual(Object.keys(CREDIT_MOVEMENT_LABELS).sort(), [
    "adjustment",
    "overpayment",
    "refund",
    "use",
  ]);
  assert.equal(CREDIT_MOVEMENT_SIGNS.overpayment, 1);
  assert.equal(CREDIT_MOVEMENT_SIGNS.adjustment, 1);
  assert.equal(CREDIT_MOVEMENT_SIGNS.use, -1);
  assert.equal(CREDIT_MOVEMENT_SIGNS.refund, -1);
});
