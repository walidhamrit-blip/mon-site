import test from "node:test";
import assert from "node:assert/strict";
import { cryptoPaymentSnapshot, isCryptoOverpayment } from "../src/lib/payment-amounts.ts";
import { validatePaidAmount } from "../src/lib/nowpayments.ts";

const event = { price_amount: 1.5, price_currency: "usd", pay_amount: "1.5005021", actually_paid: "5.99", pay_currency: "usdtbsc" };

test("l'incident : le paiement reste valide mais l'excédent est signalé", () => {
  assert.equal(validatePaidAmount({ amountUsd: "1.50", currency: "usd" }, event).ok, true);
  const snapshot = cryptoPaymentSnapshot(event);
  assert.deepEqual(snapshot, { expected: "1.5005021", actual: "5.99", currency: "USDTBSC" });
  assert.equal(isCryptoOverpayment(snapshot), true);
});

test("égalité, sous-paiement et petites unités sans erreur flottante", () => {
  for (const [expected, actual, overpaid] of [
    ["1.5000", "1.5", false], ["5", "4.99", false], ["0.00000001", "0.00000002", true],
    ["100000000000000000.00000001", "100000000000000000.00000002", true],
    ["1e-7", "0.0000001", false], ["1e-7", "0.00000011", true], ["10", "2", false],
  ]) assert.equal(isCryptoOverpayment({ expected, actual, currency: "BTC" }), overpaid, `${expected} ${actual}`);
});

test("champs absents, invalides ou devise absente ne constituent pas une preuve de trop-payé", () => {
  for (const patch of [
    { actually_paid: undefined }, { pay_amount: undefined }, { pay_currency: "" },
    { pay_amount: 0 }, { actually_paid: -1 }, { actually_paid: "NaN" }, { pay_currency: "<svg>" },
  ]) assert.equal(cryptoPaymentSnapshot({ ...event, ...patch }), null);
});
