// Tests des liens profonds vers une commande (/admin/digital/orders).
//
// Incident réel : après acceptation d'une carte téléphonique, la ligne de la
// zone « Cartes téléphoniques à vérifier » était cliquée en vain (récapitulatif
// statique) et la commande n'était jamais ouverte. Le lien profond doit donc
// être tolérant (majuscules, espaces, encodage) et refuser tout le reste.
import test from "node:test";
import assert from "node:assert/strict";
import {
  ORDER_ANCHOR_PREFIX,
  orderAnchor,
  orderHash,
  parseOrderHash,
} from "../src/lib/admin-order-link.ts";

const REF = "DGC-9B5E402D92954C26368D14E2";

test("ancre et fragment d'une commande", () => {
  assert.equal(ORDER_ANCHOR_PREFIX, "commande-");
  assert.equal(orderAnchor(REF), `commande-${REF}`);
  assert.equal(orderAnchor(` ${REF.toLowerCase()} `), `commande-${REF}`);
  assert.equal(orderHash(REF), `#commande-${REF}`);
  assert.equal(orderHash(REF, { offPlatform: true }), `#commande-${REF}?hors=1`);
});

test("décodage d'un fragment valide (avec ou sans dièse)", () => {
  assert.deepEqual(parseOrderHash(`#commande-${REF}`), { ref: REF, offPlatform: false });
  assert.deepEqual(parseOrderHash(`commande-${REF}`), { ref: REF, offPlatform: false });
});

test("le mode hors système se lit dans la requête", () => {
  assert.deepEqual(parseOrderHash(`#commande-${REF}?hors=1`), { ref: REF, offPlatform: true });
  assert.deepEqual(parseOrderHash(`#commande-${REF}?hors=0`), { ref: REF, offPlatform: false });
  assert.deepEqual(parseOrderHash(`#commande-${REF}?other=1`), { ref: REF, offPlatform: false });
});

test("référence normalisée : casse, espaces et encodage", () => {
  assert.deepEqual(parseOrderHash(`#commande-${REF.toLowerCase()}`), {
    ref: REF,
    offPlatform: false,
  });
  assert.deepEqual(parseOrderHash("#commande-%20dgc-a1b2c3%20"), {
    ref: "DGC-A1B2C3",
    offPlatform: false,
  });
});

test("tout ce qui n'est pas un lien de commande est ignoré", () => {
  for (const hash of [
    "",
    "#",
    "#autre-chose",
    "#commande-",
    "#commande-DG",
    "#commande-AB",
    "#commande-<script>",
    "#commande-@!$",
    "#commande-%E0%A4%A",
  ]) {
    assert.equal(parseOrderHash(hash), null, `fragment refusé attendu : ${hash}`);
  }
});

test("une référence courte mais plausible est acceptée (commandes historiques)", () => {
  // Les anciennes références n'ont pas toutes 24 caractères : on ne refuse
  // que ce qui n'a pas la forme d'une référence, pas ce qui est plus court.
  assert.deepEqual(parseOrderHash("#commande-DGC-9B5E"), {
    ref: "DGC-9B5E",
    offPlatform: false,
  });
});

test("l'aller-retour fragment → cible est stable", () => {
  for (const offPlatform of [false, true]) {
    const hash = orderHash(REF, { offPlatform });
    const parsed = parseOrderHash(hash);
    assert.ok(parsed);
    assert.equal(parsed.ref, REF);
    assert.equal(Boolean(parsed.offPlatform), offPlatform);
  }
});
