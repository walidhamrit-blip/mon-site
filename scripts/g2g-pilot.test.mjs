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
  assert.equal(pilotQuantityAllowed("G1793906316865GE", 1, "G1793906316865GE"), false);
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

test("la livraison reste bloquée par défaut et n'ouvre que G1795521210943KM avec G2G_AUTO_DELIVERY=1", () => {
  assert.equal(automaticDeliveryVerified(), false);
  assert.equal(automaticDeliveryVerified(id, ""), false);
  assert.equal(automaticDeliveryVerified(id, "0"), false);
  assert.equal(automaticDeliveryVerified("G1793906316865GE", "1"), false);
  assert.equal(automaticDeliveryVerified(retiredId, "1"), false);
  assert.equal(automaticDeliveryVerified(id, "1"), true);
  assert.equal(pilotQuantityAllowed(id, 1, id) && automaticDeliveryVerified(id, ""), false);
  assert.equal(pilotQuantityAllowed(id, 1, id) && automaticDeliveryVerified(id, "1"), true);
});

test("les identifiants des événements de diagnostic bloquent l'achat", () => {
  assert.equal(isSyntheticDelivery("TESTD123456", "real"), true);
  assert.equal(isSyntheticDelivery("real", "TEST-ORDER-123456"), true);
  assert.equal(isSyntheticDelivery("real", "real"), false);
});
