import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyGiftCardSalesPolicy, MAX_DIGITAL_ORDER_USD } from "../src/lib/digital-sales-policy.ts";

test("cartes cadeaux : seuls les prix de vente strictement supérieurs à 100 sont mis en veille", () => {
  const original = { kind: "gift_card", denominations: [
    { id: "a", priceUsd: 100, available: true },
    { id: "b", priceUsd: 100.01, available: true },
    { id: "c", priceUsd: 10, available: false },
  ] };
  const result = applyGiftCardSalesPolicy(original);
  assert.deepEqual(result.denominations.map((d) => d.available), [true, false, false]);
  assert.equal(original.denominations[1].available, true);
  assert.equal(result.denominations[1].id, "b");
});

test("la veille des cartes ne touche pas les recharges et clés", () => {
  for (const kind of ["game_topup", "software_key", "subscription_code"]) {
    const product = { kind, denominations: [{ priceUsd: 101, available: true }] };
    assert.equal(applyGiftCardSalesPolicy(product), product);
  }
});

test("la politique est appliquée aux catalogues en cache et de repli, et la caisse est plafonnée", () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(read("src/lib/fazercards-catalog.ts"), /entry\.result\.products\.map\(applyGiftCardSalesPolicy\)/);
  assert.match(read("src/lib/digital-store.ts"), /\.map\(applyGiftCardSalesPolicy\)/);
  assert.equal(MAX_DIGITAL_ORDER_USD, 50);
  assert.match(read("src/lib/fazercards.ts"), /DEFAULT_FAZERCARDS_MAX_ORDER_USD = 25/);
  assert.match(
    read("src/lib/fazercards.ts"),
    /envNumber\("FAZERCARDS_MAX_ORDER_USD", DEFAULT_FAZERCARDS_MAX_ORDER_USD\)/,
  );
  assert.match(read("src/lib/fazercards-orders.ts"), /totalUsd > maxOrderUsd/);
  assert.match(read("src/lib/digital-order-core.ts"), /totalUsd > MAX_DIGITAL_ORDER_USD/);
  assert.match(read("src/lib/fazercards-orders.ts"), /const cap = fazercardsDeliveryMaxOrderUsd\(/);
});
