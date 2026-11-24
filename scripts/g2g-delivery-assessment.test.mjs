import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessSupplierGiftCard, assessG2gDeliveryStatus } from "../src/lib/g2g-delivery-assessment.ts";

const supplier = order => ({ok: true, order: {id: "ord-fake", ...order}});
test("prototype fournisseur : seul completed, id exact et codes fictifs cohérents passent", () => {
  assert.equal(assessSupplierGiftCard(supplier({status:"created", code:"FAKE"}), "ord-fake", 1).kind, "waiting");
  assert.equal(assessSupplierGiftCard(supplier({status:"processing"}), "ord-fake", 1).kind, "waiting");
  assert.deepEqual(assessSupplierGiftCard(supplier({status:"completed", code:"FAKE"}), "ord-fake", 1), {kind:"ready", codes:["FAKE"]});
  assert.equal(assessSupplierGiftCard(supplier({status:"completed", codes:["FAKE1","FAKE2"]}), "ord-fake", 2).kind, "ready");
  for (const [v, id, qty] of [
    [supplier({status:"refund",code:"FAKE"}), "ord-fake", 1],
    [supplier({status:"completed",code:"FAKE"}), "other", 1],
    [supplier({status:"completed",code:"FAKE",codes:["FAKE"]}), "ord-fake", 1],
    [supplier({status:"completed",codes:["FAKE","FAKE"]}), "ord-fake", 2],
    [supplier({status:"completed",code:" FAKE"}), "ord-fake", 1],
    [supplier({status:"completed",code:"FAKE\n"}), "ord-fake", 1],
    [supplier({status:"completed",code:{value:"FAKE"}}), "ord-fake", 1],
    [supplier({status:"completed",codes:[]}), "ord-fake", 1],
    [supplier({status:"completed",code:"FAKE"}), "ord-fake", 2],
    [{ok:false, order:{id:"ord-fake",status:"completed",code:"FAKE"}}, "ord-fake", 1],
  ]) assert.equal(assessSupplierGiftCard(v,id,qty).kind, "manual_review");
});

test("un accusé G2G n'est pas une confirmation : identifiants, quantités et statut vérifiés", () => {
  const status = (state, delivered = 0) => ({code:"20000001",payload:{order_id:"fake-order",delivery_summary:{delivery_id:"fake-delivery",requested_qty:1,delivered_qty:delivered,delivery_status:state}}});
  const verdict = v => assessG2gDeliveryStatus(v,"fake-order","fake-delivery",1);
  assert.equal(verdict({code:"20000001",payload:{delivery_id:"fake-delivery"}}), "manual_review");
  assert.equal(verdict(status("pending")), "waiting");
  assert.equal(verdict(status("in_progress")), "waiting");
  assert.equal(verdict(status("delivered",1)), "confirmed");
  for (const value of [status("delivered",0),status("partial_delivered",1),status("unfulfilled"),status("expired"),status("in_progress",1), {...status("delivered",1),code:"error"}]) assert.equal(verdict(value), "manual_review");
  assert.equal(assessG2gDeliveryStatus(status("delivered",1),"other","fake-delivery",1), "manual_review");
  assert.equal(assessG2gDeliveryStatus(status("delivered",1),"fake-order","other",1), "manual_review");
});

test("le prototype ne déverrouille pas l'achat, la livraison ni le stock", () => {
  const pilot = readFileSync("src/lib/g2g-pilot.ts", "utf8");
  const delivery = readFileSync("src/lib/g2g-delivery.ts", "utf8");
  assert.match(pilot, /automaticDeliveryVerified\(\): boolean\s*\{\s*return false/);
  assert.doesNotMatch(delivery, /g2g-delivery-assessment|g2gDeliverCodes\(/);
});

test("diagnostic d'offre : authentifié, lecture seule et champs sélectionnés", async () => {
  const { build } = await import("esbuild");
  const { mkdirSync, mkdtempSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  mkdirSync(".scratch", { recursive: true });
  const dir = mkdtempSync(join(process.cwd(), ".scratch", "g2g-inspect-"));
  const stubs = {
    "next/server": `export const NextResponse = {json(body, options) { return {body, ...options}; }};`,
    "@/lib/auth": `export async function isAdminAuthenticated() { return globalThis.__g2gInspect.auth; }`,
    "@/lib/g2g": `export function g2gConfigured() { return globalThis.__g2gInspect.configured; } export async function g2gGetOffer(id) { globalThis.__g2gInspect.calls.push(id); if (globalThis.__g2gInspect.fail) throw Error('private'); return {payload: globalThis.__g2gInspect.payload}; }`,
  };
  const plugin = {name:"inspection-stubs",setup(b) {
    b.onResolve({filter:/^(next\/server|@\/lib\/auth|@\/lib\/g2g)$/}, args => ({path:args.path,namespace:"stub"}));
    b.onLoad({filter:/.*/,namespace:"stub"}, args => ({contents:stubs[args.path],loader:"js"}));
  }};
  try {
    const file = join(dir,"route.mjs");
    await build({entryPoints:["src/app/api/admin/g2g/offer-inspection/route.ts"],outfile:file,bundle:true,platform:"node",format:"esm",plugins:[plugin],logLevel:"silent"});
    const route = await import(pathToFileURL(file).href);
    const id = "G1795521210943KM";
    globalThis.__g2gInspect = {auth:false,configured:true,calls:[],payload:{offer_id:id, code_label:"Code", api_qty:0, available_qty:0, unit_price:1, min_qty:1, currency:"USD", delivery_type:["instant_inventory"], secret:"never-return", code:"never-return"}};
    const request = (offer = id) => new Request(`https://example.test/api/admin/g2g/offer-inspection?offer_id=${encodeURIComponent(offer)}`);
    assert.equal((await route.GET(request())).status,401);
    assert.equal(globalThis.__g2gInspect.calls.length,0);
    globalThis.__g2gInspect.auth = true;
    assert.equal((await route.GET(request("../../invalid"))).status,400);
    assert.equal(globalThis.__g2gInspect.calls.length,0);
    const response = await route.GET(request());
    assert.equal(response.status,200);
    assert.equal(response.headers["Cache-Control"],"no-store");
    assert.equal(response.body.offer.codeLabel,"Code");
    assert.equal(response.body.offer.apiQty,0);
    assert.doesNotMatch(JSON.stringify(response.body),/never-return/);
    assert.deepEqual(globalThis.__g2gInspect.calls,[id]);
    globalThis.__g2gInspect.payload.offer_id="G9999999999999XX";
    assert.equal((await route.GET(request())).status,502);
    globalThis.__g2gInspect.fail=true;
    assert.doesNotMatch(JSON.stringify((await route.GET(request())).body),/private/);
    assert.equal(typeof route.POST,"undefined");
  } finally { delete globalThis.__g2gInspect; rmSync(dir,{recursive:true,force:true}); }
});
