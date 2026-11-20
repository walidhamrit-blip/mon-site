import { test } from "node:test";
import assert from "node:assert/strict";
import { pilotOfferId, pilotQuantityAllowed } from "../src/lib/g2g-pilot.ts";

const id = "G1795076410074VF";
test("seule l'offre explicitement configurée peut être activée à une unité", () => {
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
