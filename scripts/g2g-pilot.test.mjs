import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PILOT_CANDIDATE_OFFER_ID,
  automaticDeliveryVerified,
  isRetiredG2gOffer,
  isSyntheticDelivery,
  pilotOfferId,
  pilotQuantityAllowed,
} from "../src/lib/g2g-pilot.ts";

const id = PILOT_CANDIDATE_OFFER_ID;
const retiredId = "G1795076410074VF";

test("seule l'offre explicitement configurée peut être activée à une unité", () => {
  assert.equal(id, "G1795521210943KM");
  assert.equal(pilotOfferId(` ${id.toLowerCase()} `), id);
  assert.equal(pilotOfferId(""), null);
  assert.equal(pilotOfferId("invalid"), null);
  assert.equal(pilotQuantityAllowed(id, 1, id), true);
  assert.equal(pilotQuantityAllowed(id, 1, undefined), false);
  assert.equal(pilotQuantityAllowed("G1793906316865GE", 1, id), false);
  assert.equal(pilotQuantityAllowed(id, 2, id), false);
  assert.equal(pilotQuantityAllowed(id, 0.5, id), false);
  assert.equal(pilotQuantityAllowed(id, -1, id), false);
  assert.equal(pilotQuantityAllowed("G1793906316865GE", 0, undefined), true);
});

test("l'ancienne offre retirée G1795076410074VF est définitivement bloquée à l'ouverture mais fermable à 0", () => {
  assert.equal(isRetiredG2gOffer(retiredId), true);
  assert.equal(isRetiredG2gOffer(` ${retiredId.toLowerCase()} `), true);
  assert.equal(isRetiredG2gOffer(id), false);
  assert.equal(pilotOfferId(retiredId), null);
  assert.equal(pilotQuantityAllowed(retiredId, 1, retiredId), false);
  assert.equal(pilotQuantityAllowed(retiredId, 1, id), false);
  assert.equal(pilotQuantityAllowed(retiredId, 0, undefined), true);
});

test("la livraison reste bloquée même lorsque le pilote est configuré", () => {
  assert.equal(automaticDeliveryVerified(), false);
  assert.equal(pilotQuantityAllowed(id, 1, id), true);
  assert.equal(pilotQuantityAllowed(id, 1, id) && automaticDeliveryVerified(), false);
});

test("les identifiants des événements de diagnostic bloquent l'achat", () => {
  assert.equal(isSyntheticDelivery("TESTD123456", "real"), true);
  assert.equal(isSyntheticDelivery("real", "TEST-ORDER-123456"), true);
  assert.equal(isSyntheticDelivery("real", "real"), false);
});
