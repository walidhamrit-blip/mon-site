// Uniquement des doubles : la table durable est simulée en mémoire, pas PostgreSQL.
// Ce fichier n'importe ni transport réel, ni cron, ni secrets.
import {test} from "node:test";
import assert from "node:assert/strict";
import {reserveCommittedPrototype, RESERVE_DISPATCH_SQL} from "../src/lib/g2g-dispatch-reservation-prototype.ts";
import {assessG2gDeliveryStatus, assessSupplierGiftCard} from "../src/lib/g2g-delivery-assessment.ts";

const input = {orderId:"fake-order",deliveryId:"fake-delivery",supplierOrderId:"fake-supplier",quantity:1,expiresAt:new Date("2030-01-01T00:00:00Z")};
const supplier = {ok:true,order:{id:"fake-supplier",status:"completed",code:"FAKE-CODE"}};
const status = (value, delivered = 0) => ({code:"20000001",payload:{order_id:"fake-order",delivery_summary:{delivery_id:"fake-delivery",requested_qty:1,delivered_qty:delivered,delivery_status:value}}});

function fakeDatabase({commitError = false, queryError = false} = {}) {
  let stored = false, pending = false; const events = [];
  const client = {async query(sql, params) {
    events.push(sql === RESERVE_DISPATCH_SQL ? "INSERT" : sql);
    if (sql === "BEGIN") { pending = false; return {rows:[]}; }
    if (sql === "ROLLBACK") { pending = false; return {rows:[]}; }
    if (sql === "COMMIT") { if (pending) stored = true; pending = false; if (commitError) throw Error("lost commit reply"); return {rows:[]}; }
    if (queryError) throw Error("database error");
    assert.equal(sql,RESERVE_DISPATCH_SQL);
    assert.deepEqual(params,[input.orderId,input.deliveryId,input.supplierOrderId,input.quantity,input.expiresAt]);
    if (stored) return {rows:[]};
    pending = true; return {rows:[{order_id:input.orderId}]};
  }};
  return {client,events,get stored() {return stored;}};
}

async function worker(db, {crash = "none", supplierValue = supplier, freshStatus = status("pending"), now = 1000, expiry = 3000, send = async () => {}} = {}) {
  const assessment = assessSupplierGiftCard(supplierValue,input.supplierOrderId,input.quantity);
  if (assessment.kind !== "ready") return assessment.kind;
  const reservation = await reserveCommittedPrototype(db.client,input);
  if (reservation !== "committed") return reservation;
  if (crash === "after_commit") return "crashed";
  // Modèle : en production vérifier aussi l'annulation dans une lecture fiable.
  if (now >= expiry || assessG2gDeliveryStatus(freshStatus,input.orderId,input.deliveryId,input.quantity) !== "waiting") return "manual_review";
  try { await send(assessment.codes); } catch { return "uncertain_send"; }
  if (crash === "after_send") return "crashed";
  return "check_delivery";
}

test("commit simulé avant transport fictif ; accusé ne confirme pas", async () => {
  const db = fakeDatabase(); let sends = 0;
  const result = await worker(db,{send:async codes => {assert.deepEqual(db.events,["BEGIN","INSERT","COMMIT"]); assert.deepEqual(codes,["FAKE-CODE"]); sends++;}});
  assert.equal(result,"check_delivery"); assert.equal(sends,1);
  assert.equal(assessG2gDeliveryStatus(status("delivered",1),input.orderId,input.deliveryId,1),"confirmed");
});

test("après crash avant ou après envoi, reprise refuse de réserver à nouveau", async () => {
  for (const crash of ["after_commit","after_send"]) {
    const db = fakeDatabase(); let sends = 0;
    assert.equal(await worker(db,{crash,send:async () => {sends++;}}),"crashed");
    const previous = sends;
    assert.equal(await worker(db,{send:async () => {sends++;}}),"not_reserved");
    assert.equal(sends,previous);
  }
});

test("commit incertain, échec SQL et transport incertain ne déclenchent aucun second envoi", async () => {
  for (const mode of [{commitError:true},{queryError:true}]) {
    const db = fakeDatabase(mode); let sends = 0;
    assert.equal(await worker(db,{send:async () => {sends++;}}),"uncertain");
    assert.equal(sends,0); assert.equal(db.events.at(-1),"ROLLBACK");
  }
  const db = fakeDatabase(); let sends = 0;
  assert.equal(await worker(db,{send:async () => {sends++; throw Error("timeout");}}),"uncertain_send");
  assert.equal(await worker(db,{send:async () => {sends++;}}),"not_reserved");
  assert.equal(sends,1);
});

test("statut non livrable ou échéance dépassée bloquent le transport", async () => {
  for (const option of [{freshStatus:status("expired")},{freshStatus:status("unfulfilled")},{freshStatus:status("delivered",1)},{now:3000}]) {
    let sends=0; const db=fakeDatabase();
    assert.equal(await worker(db,{...option,send:async () => {sends++;}}),"manual_review");
    assert.equal(sends,0);
    assert.equal(await worker(db),"not_reserved");
  }
});
