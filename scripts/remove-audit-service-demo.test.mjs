import assert from "node:assert/strict";
import { test } from "node:test";
import { REMOVE_SLUGS, removeSlugs } from "./lib/audit-demo-prune.mjs";

test("le retrait cible le slug d'audit du service audit", () => {
  assert.deepEqual(REMOVE_SLUGS, ["audit-de-site"]);
});

test("retire les fiches ciblees sans toucher aux autres", () => {
  const demos = [
    { slug: "myphone-tripoli", title: "MyPhone" },
    { slug: "audit-de-site", title: "Audit 46 points" },
    { slug: "tulin-magazin", title: "Tulin Magazin" },
  ];
  const { kept, removed } = removeSlugs(demos);
  assert.deepEqual(
    kept.map((d) => d.slug),
    ["myphone-tripoli", "tulin-magazin"],
  );
  assert.deepEqual(removed, [{ slug: "audit-de-site", title: "Audit 46 points" }]);
});

test("une fiche sans slug est conservée telle quelle (pas de suppression)", () => {
  const demos = [{ title: "Sans slug" }, { slug: "audit-de-site", title: "Audit" }];
  const { kept, removed } = removeSlugs(demos);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].title, "Sans slug");
  assert.equal(removed.length, 1);
});

test("les slugs sont comparés après trim", () => {
  const demos = [{ slug: "  audit-de-site  ", title: "Audit" }];
  const { kept, removed } = removeSlugs(demos);
  assert.equal(kept.length, 0);
  assert.equal(removed[0].slug, "audit-de-site");
});

test("titre manquant ou non-chaîne : l'entrée est retirée, le titre est une chaîne vide", () => {
  const demos = [{ slug: "audit-de-site" }, { slug: "audit-de-site", title: 42 }];
  const { kept, removed } = removeSlugs(demos);
  assert.equal(kept.length, 0);
  assert.equal(removed.length, 2);
  assert.equal(removed[0].title, "");
  assert.equal(removed[1].title, "");
});

test("liste non-tableau : rien à faire", () => {
  assert.deepEqual(removeSlugs(null), { kept: [], removed: [] });
  assert.deepEqual(removeSlugs("nope"), { kept: [], removed: [] });
  assert.deepEqual(removeSlugs(undefined), { kept: [], removed: [] });
});

test("idempotent : relancer sur la liste filtrée ne retire plus rien", () => {
  const demos = [
    { slug: "myphone-tripoli", title: "A" },
    { slug: "audit-de-site", title: "Audit" },
  ];
  const { kept } = removeSlugs(demos);
  const again = removeSlugs(kept);
  assert.equal(again.kept.length, 1);
  assert.equal(again.removed.length, 0);
});
