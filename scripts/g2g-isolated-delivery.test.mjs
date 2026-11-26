import {test} from "node:test";
import assert from "node:assert/strict";
import {runIsolatedDelivery} from "./g2g-isolated-delivery.mjs";

const input = {orderId:"fake-order",deliveryId:"fake-delivery",supplierOrderId:"fake-supplier",quantity:1,expiresAt:3000,dispatchState:"not_sent"};
const status = (state = "pending", count = 0) => ({code:"20000001",payload:{order_id:input.orderId,delivery_summary:{delivery_id:input.deliveryId,requested_qty:1,delivered_qty:count,delivery_status:state}}});
const supplier = (state = "completed") => ({ok:true,order:{id:input.supplierOrderId,status:state,...(state === "completed" ? {code:"FAKE-CODE"} : {})}});
function lab() {
  let reserved = false, sends = 0, time = 1000, supplierValue = supplier(), remoteValue = status(), fresh = {active:true,delivery:status()}, failure = "";
  const events = [];
  const ports = {
    now:() => time,
    readDelivery:async () => {events.push("status"); if(failure === "status") throw Error(); return remoteValue;},
    readSupplier:async () => {events.push("supplier"); if(failure === "supplier") throw Error(); return supplierValue;},
    reserve:async () => {events.push("reserve"); if(failure === "reserve") return "uncertain"; if(reserved) return "not_reserved"; reserved = true; return "committed";},
    readFreshOrder:async () => {events.push("fresh"); if(failure === "fresh") throw Error(); return fresh;},
    sendFake:async ({codes}) => {events.push("send"); assert.deepEqual(codes,["FAKE-CODE"]); sends++; if(failure === "send") throw Error();},
  };
  return {ports,events,get sends(){return sends;},set time(v){time=v;},set supplier(v){supplierValue=v;},set remote(v){remoteValue=v;},set fresh(v){fresh=v;},set failure(v){failure=v;}};
}

test("parcours isolé : attente, réservation avant envoi, puis confirmation distante", async () => {
  const l=lab(); l.supplier=supplier("processing");
  assert.equal(await runIsolatedDelivery(input,l.ports),"wait_supplier"); assert.equal(l.sends,0);
  l.supplier=supplier(); l.events.length=0;
  assert.equal(await runIsolatedDelivery(input,l.ports),"check_delivery");
  assert.deepEqual(l.events,["status","supplier","reserve","fresh","send"]); assert.equal(l.sends,1);
  l.remote=status("delivered",1); l.events.length=0;
  assert.equal(await runIsolatedDelivery({...input,dispatchState:"acknowledged"},l.ports),"confirmed");
  assert.deepEqual(l.events,["status"]); assert.equal(l.sends,1);
});

test("deux traitements concurrents et répétition : un seul envoi fictif", async () => {
  const l=lab(); const results=await Promise.all([runIsolatedDelivery(input,l.ports),runIsolatedDelivery(input,l.ports)]);
  assert.deepEqual(results.sort(),["check_delivery","manual_review"]); assert.equal(l.sends,1);
  assert.equal(await runIsolatedDelivery(input,l.ports),"manual_review"); assert.equal(l.sends,1);
});

test("timeout d'envoi ou interruption après réservation : pas de réémission", async () => {
  for(const failure of ["send","fresh"]) {
    const l=lab(); l.failure=failure;
    assert.equal(await runIsolatedDelivery(input,l.ports),failure === "send" ? "unknown" : "manual_review");
    const before=l.sends; l.failure="";
    assert.equal(await runIsolatedDelivery(input,l.ports),"manual_review"); assert.equal(l.sends,before);
    assert.equal(await runIsolatedDelivery({...input,dispatchState:"unknown"},l.ports),"check_delivery"); assert.equal(l.sends,before);
  }
});

test("erreurs et données ambiguës bloquent la transmission", async () => {
  for(const setup of [l=>l.failure="status",l=>l.failure="supplier",l=>l.failure="reserve",l=>l.fresh={active:false,delivery:status()},l=>l.fresh={active:true,delivery:status("expired")},l=>l.time=3000,l=>l.supplier={ok:true,order:{id:"fake-supplier",status:"completed",codes:["FAKE-CODE"]}}]) {
    const l=lab(); setup(l); assert.equal(await runIsolatedDelivery(input,l.ports),"manual_review"); assert.equal(l.sends,0);
  }
});

test("expiration après commit et état distant partiel bloquent l'envoi ou la confirmation", async () => {
  const l=lab(); l.ports.readFreshOrder=async () => {l.time=3000; return {active:true,delivery:status()};};
  assert.equal(await runIsolatedDelivery(input,l.ports),"manual_review"); assert.equal(l.sends,0);
  l.remote=status("partial_delivered",0);
  assert.equal(await runIsolatedDelivery({...input,dispatchState:"unknown"},l.ports),"manual_review");
});
