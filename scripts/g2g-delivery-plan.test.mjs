import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planDelivery } from "../src/lib/g2g-delivery-plan.ts";

const pending = {code:"20000001",payload:{order_id:"fake-order",delivery_summary:{delivery_id:"fake-delivery",requested_qty:1,delivered_qty:0,delivery_status:"pending"}}};
const done = {code:"20000001",payload:{order_id:"fake-order",delivery_summary:{delivery_id:"fake-delivery",requested_qty:1,delivered_qty:1,delivery_status:"delivered"}}};
const input = {supplierResponse:{ok:true,order:{id:"ord-fake",status:"completed",code:"FAKE-ONLY"}},g2gResponse:pending,supplierOrderId:"ord-fake",orderId:"fake-order",deliveryId:"fake-delivery",quantity:1,dispatchState:"not_sent",now:1000,expiresAt:3000};

test("un code prêt ne permet qu'une réservation, jamais un envoi", () => {
  assert.equal(planDelivery(input),"reserve_dispatch");
  assert.equal(planDelivery({...input,supplierResponse:{ok:true,order:{id:"ord-fake",status:"processing"}}}),"wait_supplier");
  for (const patch of [
    {expiresAt:0},{expiresAt:1000},{expiresAt:NaN},{now:NaN},
    {quantity:2},{supplierOrderId:"wrong"},{deliveryId:"wrong"},
    {g2gResponse:done},{supplierResponse:{ok:true,order:{id:"ord-fake",status:"refund",code:"FAKE"}}},
  ]) assert.equal(planDelivery({...input,...patch}),"manual_review");
});

test("après crash, timeout ou accusé, jamais de réémission : vérifier ou revue", () => {
  for (const dispatchState of ["dispatching","acknowledged","unknown"]) {
    assert.equal(planDelivery({...input,dispatchState}),"check_delivery");
    assert.equal(planDelivery({...input,dispatchState,g2gResponse:done}),"confirmed");
    assert.equal(planDelivery({...input,dispatchState,g2gResponse:{code:"20000001",payload:{delivery_id:"fake-delivery"}}}),"manual_review");
  }
  assert.equal(planDelivery({...input,dispatchState:"unknown",g2gResponse:{...pending,code:"bad"}}),"manual_review");
});

test("la planification ne renvoie ni ne journalise de code et reste hors de la file", () => {
  const file = readFileSync("src/lib/g2g-delivery-plan.ts","utf8");
  const queue = readFileSync("src/lib/g2g-delivery.ts","utf8");
  assert.doesNotMatch(file, /console\.|g2gDeliverCodes\(|fazercardsOrder\(/);
  assert.doesNotMatch(queue, /g2g-delivery-plan/);
  assert.equal(JSON.stringify(planDelivery(input)).includes("FAKE-ONLY"),false);
});

test("lecture de statut G2G : GET signé et chemins encodés, sans réseau réel", async () => {
  const { build } = await import("esbuild");
  const { mkdirSync, mkdtempSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  mkdirSync(".scratch",{recursive:true});
  const dir = mkdtempSync(join(process.cwd(),".scratch","g2g-status-"));
  const plugin = {name:"test-alias",setup(b) {
    b.onResolve({filter:/^@\/lib\/g2g-core$/}, () => ({path:join(process.cwd(),"src/lib/g2g-core.ts")}));
    b.onResolve({filter:/^@\/lib\/nowpayments$/}, () => ({path:"fake",namespace:"stub"}));
    b.onLoad({filter:/.*/,namespace:"stub"},() => ({contents:"export const sanitizeSecret = x => x ?? '';",loader:"js"}));
  }};
  const old = Object.fromEntries(["G2G_API_KEY","G2G_SECRET_KEY","G2G_USER_ID","G2G_API_BASE"].map(key => [key,process.env[key]]));
  const originalFetch=globalThis.fetch, calls=[];
  try {
    const file=join(dir,"g2g.mjs");
    await build({entryPoints:["src/lib/g2g.ts"],outfile:file,bundle:true,platform:"node",format:"esm",plugins:[plugin],logLevel:"silent"});
    const {g2gGetDeliveryStatus} = await import(pathToFileURL(file).href);
    process.env.G2G_API_KEY="fake-key"; process.env.G2G_SECRET_KEY="fake-secret"; process.env.G2G_USER_ID="fake-user"; process.env.G2G_API_BASE="https://fake.invalid";
    globalThis.fetch=async (url,options) => {calls.push({url,options}); return new Response(JSON.stringify({code:"20000001",payload:{delivery_summary:{delivery_status:"pending"}}}),{status:200});};
    const result=await g2gGetDeliveryStatus("order/1","delivery/1");
    assert.equal(result.payload.delivery_summary.delivery_status,"pending");
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,"https://fake.invalid/v2/orders/order%2F1/delivery/delivery%2F1");
    assert.equal(calls[0].options.method,"GET");
    assert.equal(calls[0].options.headers["Content-Type"],"application/json");
    assert.match(calls[0].options.headers["g2g-signature"],/^[0-9a-f]{64}$/);
    assert.equal(calls[0].options.body,undefined);
    await assert.rejects(g2gGetDeliveryStatus("", "x"));
    await assert.rejects(g2gGetDeliveryStatus("order\n", "x"));
    assert.equal(calls.length,1);
  } finally {
    globalThis.fetch=originalFetch;
    for (const [key,value] of Object.entries(old)) if (value === undefined) delete process.env[key]; else process.env[key]=value;
    rmSync(dir,{recursive:true,force:true});
  }
});
