import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { preparePilotDeliveryRequest } from "../src/lib/g2g-delivery-request-prototype.ts";

const fixture = () => ({offerId:"G1795521210943KM",orderId:"fake-order",deliveryId:"fake-delivery",supplierOrderId:"fake-supplier",referenceId:"fake-stable-reference",quantity:1,now:1000,expiresAt:2000,supplierResponse:{ok:true,order:{id:"fake-supplier",status:"completed",code:"FAKE-CODE"}},deliveryResponse:{code:"20000001",payload:{order_id:"fake-order",delivery_summary:{delivery_id:"fake-delivery",requested_qty:1,delivered_qty:0,delivery_status:"pending"}}}});

test("prototype : prépare uniquement le format unitaire prévu, avec référence fournie", () => {
  const value=preparePilotDeliveryRequest(fixture());
  assert.deepEqual(value,{kind:"prepared",request:{orderId:"fake-order",deliveryId:"fake-delivery",codes:[{content:"FAKE-CODE",reference_id:"fake-stable-reference"}]}});
});

test("en attente ou réponse fournisseur ambiguë ne produit aucune charge", () => {
  const f=fixture(); f.supplierResponse.order.status="processing";
  assert.deepEqual(preparePilotDeliveryRequest(f),{kind:"waiting"});
  for(const order of [{id:"fake-supplier",status:"completed",codes:["FAKE-CODE"]},{id:"other",status:"completed",code:"FAKE-CODE"},{id:"fake-supplier",status:"completed",code:"FAKE-CODE",codes:["FAKE-CODE"]}]) {
    const x=fixture(); x.supplierResponse.order=order;
    assert.deepEqual(preparePilotDeliveryRequest(x),{kind:"manual_review"});
  }
});

test("mauvaise offre, quantité, échéance, identifiants ou statut ne préparent rien", () => {
  for (const patch of [{offerId:"G1795076410074VF"},{quantity:2},{expiresAt:1000},{now:NaN},{referenceId:""},{referenceId:"bad id"},{orderId:"fake\norder"},{deliveryId:"x".repeat(129)}]) {
    assert.deepEqual(preparePilotDeliveryRequest({...fixture(),...patch}),{kind:"manual_review"});
  }
  for (const [state,count] of [["delivered",1],["expired",0],["partial_delivered",0]]) {
    const f=fixture(); f.deliveryResponse.payload.delivery_summary.delivery_status=state; f.deliveryResponse.payload.delivery_summary.delivered_qty=count;
    assert.deepEqual(preparePilotDeliveryRequest(f),{kind:"manual_review"});
  }
});

test("brique isolée et garde de production maintenue", () => {
  const source=readFileSync("src/lib/g2g-delivery-request-prototype.ts","utf8");
  assert.doesNotMatch(source,/\bfetch\s*\(|g2gDeliverCodes\s*\(/);
  assert.doesNotMatch(readFileSync("src/lib/g2g-delivery.ts","utf8"),/g2g-delivery-request-prototype/);
  assert.match(readFileSync("src/lib/g2g-pilot.ts","utf8"),/automaticDeliveryVerified\(\): boolean\s*\{\s*return false/);
});
