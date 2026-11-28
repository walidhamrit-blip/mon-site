import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fazercardsMaxQuantity, requiresTopupQuantityReview } from "../src/lib/fazercards-quantity.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("une recharge directe est limitée à une offre même si le catalogue autorise davantage", () => {
  assert.equal(fazercardsMaxQuantity("game_topup", 10), 1);
  assert.equal(fazercardsMaxQuantity("gift_card", 10), 10);
  assert.equal(fazercardsMaxQuantity("software_key", 3), 3);
  assert.equal(requiresTopupQuantityReview("game_topup", 4), true);
  assert.equal(requiresTopupQuantityReview("game_topup", 1), false);
  assert.equal(requiresTopupQuantityReview("gift_card", 4), false);
});

test("la validation intervient avant la facturation et la revue avant l'achat fournisseur", () => {
  const orders = read("src/lib/fazercards-orders.ts");
  const checkout = orders.slice(orders.indexOf("const quantity = Number(input.quantity"), orders.indexOf("const unitPriceUsd", orders.indexOf("const quantity = Number(input.quantity")));
  assert.match(checkout, /fazercardsMaxQuantity\(product.kind, denomination.maxOrderQuantity\)/);
  assert.match(checkout, /quantity > maxQuantity/);
  const delivery = orders.slice(orders.indexOf("export async function deliverPaidFazercardsOrder"));
  assert.ok(delivery.indexOf("requiresTopupQuantityReview(loaded.kind, loaded.quantity)") < delivery.indexOf("placeFazercardsOrder(loaded)"));
  assert.match(delivery, /return flagManual\(loaded, "Recharge multiple historique/);
  const ui = read("src/components/digital-buy-dialog.tsx");
  assert.match(ui, /!singleTopup && paymentMethod === "nowpayments"/);
  assert.match(ui, /!singleTopup && <div className="flex items-center gap-2">/);
});
