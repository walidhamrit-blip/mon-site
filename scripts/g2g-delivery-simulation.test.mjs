// Simulation isolée : aucun réseau, base de données ou appel de production.
// La réservation en mémoire modélise une opération atomique, elle ne prouve
// ni la concurrence PostgreSQL ni la durabilité d'une intention d'envoi.
import { test } from "node:test";
import assert from "node:assert/strict";
import { assessSupplierGiftCard } from "../src/lib/g2g-delivery-assessment.ts";
import { planDelivery } from "../src/lib/g2g-delivery-plan.ts";

const supplier = status => ({ok:true, order:{id:"supplier-fake", status, ...(status === "completed" ? {code:"FAKE-CODE"} : {})}});
const remote = (status = "pending", qty = 0) => ({code:"20000001",payload:{order_id:"order-fake",delivery_summary:{delivery_id:"delivery-fake",requested_qty:1,delivered_qty:qty,delivery_status:status}}});

function fixture() {
  let state = "not_sent", sends = 0, supplierResult = supplier("completed"), remoteResult = remote();
  const context = () => ({supplierResponse:supplierResult, g2gResponse:remoteResult, supplierOrderId:"supplier-fake", orderId:"order-fake", deliveryId:"delivery-fake", quantity:1, dispatchState:state, now:1000, expiresAt:3000});
  return {
    setSupplier(value) { supplierResult = value; },
    setRemote(value) { remoteResult = value; },
    get state() { return state; },
    get sends() { return sends; },
    // Le claim est atomique dans ce modèle local uniquement. Son échec ne donne
    // jamais le droit de transmettre. Un crash après claim laisse dispatching.
    async worker({crashAfterClaim = false, sendResult = "ack", beforeSend = () => true} = {}) {
      const input = context();
      const plan = planDelivery(input);
      if (plan !== "reserve_dispatch") return plan;
      await Promise.resolve(); // deux workers peuvent voir le même plan initial
      if (state !== "not_sent") return "claim_lost";
      state = "dispatching";
      if (crashAfterClaim) return "crashed";
      // Une nouvelle vérification externe serait obligatoire en production.
      if (!beforeSend()) { state = "unknown"; return "manual_review"; }
      const assessment = assessSupplierGiftCard(input.supplierResponse, input.supplierOrderId, input.quantity);
      if (assessment.kind !== "ready") { state = "unknown"; return "manual_review"; }
      // Faux transport : vérifie le contrat local sans sauvegarder le code.
      assert.deepEqual(assessment.codes, ["FAKE-CODE"]);
      sends++;
      if (sendResult === "timeout" || sendResult === "crash") { state = "unknown"; return sendResult; }
      state = "acknowledged";
      return "acknowledged"; // un accusé ne suffit pas pour confirmer
    },
    resume() { return planDelivery(context()); },
  };
}

test("simulation : attente fournisseur, un envoi fictif puis confirmation G2G", async () => {
  const f = fixture();
  f.setSupplier(supplier("processing"));
  assert.equal(await f.worker(), "wait_supplier");
  assert.equal(f.sends, 0);
  f.setSupplier(supplier("completed"));
  assert.equal(await f.worker(), "acknowledged");
  assert.equal(f.resume(), "check_delivery");
  f.setRemote(remote("delivered", 1));
  assert.equal(f.resume(), "confirmed");
  assert.equal(f.sends, 1);
});

test("simulation : deux traitements concurrents et webhook répété ne produisent qu'un envoi", async () => {
  const f = fixture();
  const results = await Promise.all([f.worker(), f.worker()]);
  assert.deepEqual(results.sort(), ["acknowledged", "claim_lost"]);
  assert.equal(await f.worker(), "check_delivery");
  assert.equal(f.sends, 1);
});

test("simulation : crash avant envoi, timeout ou crash après envoi ne relancent pas le POST", async () => {
  for (const options of [{crashAfterClaim:true},{sendResult:"timeout"},{sendResult:"crash"}]) {
    const f = fixture();
    await f.worker(options);
    const count = f.sends;
    assert.equal(await f.worker(), "check_delivery");
    assert.equal(f.sends, count);
    f.setRemote(remote("delivered", 1));
    assert.equal(f.resume(), "confirmed");
  }
});

test("simulation : annulation ou expiration avant envoi et réponses ambiguës bloquent", async () => {
  const f = fixture();
  assert.equal(await f.worker({beforeSend:() => false}), "manual_review");
  assert.equal(f.sends, 0);
  f.setRemote(remote("expired"));
  assert.equal(f.resume(), "manual_review");
  assert.equal(await f.worker(), "manual_review");
  const g = fixture();
  g.setSupplier({ok:true,order:{id:"supplier-fake",status:"completed",codes:["FAKE-CODE"]}});
  assert.equal(await g.worker(), "manual_review");
  assert.equal(g.sends, 0);
  g.setSupplier(supplier("completed"));
  g.setRemote(remote("partial_delivered", 0));
  assert.equal(await g.worker(), "manual_review");
  assert.equal(g.sends, 0);
});
