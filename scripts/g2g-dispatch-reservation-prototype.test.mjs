import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {reserveDispatchPrototype, RESERVE_DISPATCH_SQL} from "../src/lib/g2g-dispatch-reservation-prototype.ts";

const input = {orderId:"order-fake",deliveryId:"delivery-fake",supplierOrderId:"supplier-fake",quantity:1,expiresAt:new Date("2030-01-01T00:00:00Z")};

test("réservation prototype : paramètres liés, résultat du claim et échéance serveur", async () => {
  let calls = 0;
  const db = {async query(sql, params) {
    calls++;
    assert.equal(sql, RESERVE_DISPATCH_SQL);
    assert.deepEqual(params,[input.orderId,input.deliveryId,input.supplierOrderId,1,input.expiresAt]);
    return {rows: calls === 1 ? [{order_id:input.orderId}] : []};
  }};
  assert.equal(await reserveDispatchPrototype(db,input),"reserved");
  assert.equal(await reserveDispatchPrototype(db,input),"not_reserved");
  assert.match(RESERVE_DISPATCH_SQL,/ON CONFLICT \(order_id, delivery_id\) DO NOTHING/);
  assert.match(RESERVE_DISPATCH_SQL,/clock_timestamp\(\)/);
});

test("paramètres invalides ou erreur de base : aucun succès inventé", async () => {
  let calls = 0;
  const db = {async query() { calls++; throw new Error("database unavailable"); }};
  for (const patch of [{orderId:""},{deliveryId:"a\n"},{supplierOrderId:" fake "},{quantity:0},{quantity:101},{quantity:1.2},{expiresAt:new Date(NaN)}]) {
    await assert.rejects(reserveDispatchPrototype(db,{...input,...patch}));
  }
  assert.equal(calls,0);
  await assert.rejects(reserveDispatchPrototype(db,input),/database unavailable/);
  assert.equal(calls,1);
});

test("prototype non raccordé et intention sans code ni bail", () => {
  const sql = readFileSync("docs/g2g-dispatch-reservation-prototype.sql","utf8");
  assert.match(sql,/PRIMARY KEY \(order_id, delivery_id\)/);
  assert.doesNotMatch(sql,/gift_code|codes\s+text|lease_until/i);
  for (const path of ["src/lib/g2g-delivery.ts","src/lib/g2g-purchase.ts","src/db/index.ts"]) assert.doesNotMatch(readFileSync(path,"utf8"),/g2g-dispatch-reservation-prototype|g2g_dispatch_reservation_prototype/);
});
