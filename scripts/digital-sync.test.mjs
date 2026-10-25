#!/usr/bin/env node
/**
 * Révision du catalogue depuis Reloadly (noyau pur).
 *
 * Aucun appel réseau : on teste le rapprochement produit ↔ fiche, le calcul
 * des prix depuis la marge nette, et la fusion des montants (ajout des
 * manquants, désactivation des refusés, conservation des identifiants).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "sync-"));

const aliasPlugin = {
  name: "alias-at-src",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => {
      const base = join(srcRoot, args.path.slice(2));
      const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
      const found = candidates.find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
      );
      return { path: found ?? base };
    });
  },
};

async function compile(entry, name) {
  const outfile = join(outDir, `${name}.mjs`);
  await build({
    entryPoints: [join(srcRoot, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    plugins: [aliasPlugin],
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const sync = await compile("lib/digital-sync-core.ts", "sync-core");

test.after(() => rmSync(outDir, { recursive: true, force: true }));

const steamUs = {
  productId: 11828,
  productName: "Steam US",
  brandName: "Steam",
  countryCode: "US",
  currencyCode: "USD",
  denominationType: "FIXED",
  fixedDenominations: [20, 25, 30, 50],
  minDenomination: null,
  maxDenomination: null,
  senderFeePercentage: 0,
  discountPercentage: 0,
  status: "ACTIVE",
};

function fiche(overrides = {}) {
  return {
    id: "steam-wallet",
    slug: "steam-wallet",
    kind: "gift_card",
    status: "available",
    platform: "Steam",
    color: "#1B2838",
    titleAr: "بطاقة محفظة Steam",
    titleEn: "Steam Wallet Code",
    descriptionAr: "",
    descriptionEn: "",
    image: "",
    regions: ["global", "US"],
    featuresAr: [],
    featuresEn: [],
    deliveryNoteAr: "",
    deliveryNoteEn: "",
    denominations: [],
    sortOrder: 10,
    fulfillment: "manual",
    reloadlyProductId: null,
    reloadlyCountryCode: "",
    ...overrides,
  };
}

test("rapprochement : par identifiant produit, puis marque + pays", () => {
  const byId = sync.matchFiche(steamUs, [fiche({ reloadlyProductId: 11828, platform: "Xbox" })]);
  assert.equal(byId?.id, "steam-wallet");

  const byCountry = sync.matchFiche(steamUs, [fiche({ reloadlyCountryCode: "US" })]);
  assert.equal(byCountry?.id, "steam-wallet");

  // Jamais de rapprochement entre deux marques différentes.
  assert.equal(sync.matchFiche(steamUs, [fiche({ platform: "PlayStation", reloadlyCountryCode: "US" })]), null);
});

test("montants : une entrée par valeur faciale, prix calculés depuis la marge", () => {
  const rows = sync.buildDenominations(steamUs, 4, 1);
  assert.deepEqual(
    rows.map((row) => row.reloadlyUnitPrice),
    [20, 25, 30, 50],
  );
  assert.deepEqual(
    rows.map((row) => row.priceUsd),
    [21.05, 26.32, 31.58, 52.63],
  );
  assert.equal(rows[0].label, "$20");
  assert.equal(rows[0].cost, 20);
  assert.equal(rows[0].netMarginPercent, 4);
  // Tous les montants sont nouveaux quand la fiche est vide.
  assert.ok(rows.every((row) => row.action === "added"));
});

test("montants refusés par Reloadly : signalés, jamais supprimés", () => {
  const existing = [
    { id: "d5", label: "$5", faceValue: "5 USD", region: "global", priceUsd: 5.4, available: true, reloadlyUnitPrice: 5 },
    { id: "d25", label: "$25", faceValue: "25 USD", region: "global", priceUsd: 25.9, available: true, reloadlyUnitPrice: 25 },
    { id: "d100", label: "$100", faceValue: "100 USD", region: "global", priceUsd: 100.4, available: true, reloadlyUnitPrice: 100 },
  ];
  assert.deepEqual(sync.staleLabels(steamUs, existing), ["$5", "$100"]);

  const proposal = sync.buildProposal({
    product: steamUs,
    fiche: fiche({ denominations: existing, reloadlyProductId: 11828 }),
    marginPercent: 4,
    paymentFeePercent: 1,
  });
  const next = sync.applyProposalToProduct(proposal, fiche({ denominations: existing, reloadlyProductId: 11828 }));

  // Rien n'est supprimé : 3 anciens conservés (2 désactivés, 1 mis à jour)
  // + 3 montants acceptés ajoutés (20, 30, 50).
  assert.equal(next.denominations.length, 6);
  const byLabel = Object.fromEntries(next.denominations.map((item) => [item.label, item]));
  assert.equal(byLabel["$5"].available, false);
  assert.equal(byLabel["$100"].available, false);
  assert.match(byLabel["$5"].noteEn, /n'est pas accepté par Reloadly/);
  // L'identifiant du montant conservé ne change pas (historique des commandes).
  assert.equal(byLabel["$25"].id, "d25");
  assert.equal(byLabel["$25"].priceUsd, 26.32);
  assert.equal(byLabel["$25"].available, true);
  assert.equal(byLabel["$20"].priceUsd, 21.05);
  assert.equal(byLabel["$30"].priceUsd, 31.58);
  assert.equal(byLabel["$50"].priceUsd, 52.63);

  // La fiche est reliée au produit et passe en livraison automatique.
  assert.equal(next.reloadlyProductId, 11828);
  assert.equal(next.reloadlyCountryCode, "US");
  assert.equal(next.fulfillment, "auto");
  assert.equal(next.marginPercent, 4);
});

test("création : fiche complète, montants triés, statut prudent", () => {
  const proposal = sync.buildProposal({
    product: steamUs,
    fiche: null,
    marginPercent: 8,
    paymentFeePercent: 1,
  });
  assert.equal(proposal.action, "create");
  assert.equal(proposal.key, "steam-us");
  assert.match(proposal.notes.join(" "), /bientôt disponible/);

  const created = sync.applyProposalToProduct(proposal, null);
  assert.equal(created.status, "coming_soon");
  assert.equal(created.platform, "Steam");
  assert.deepEqual(created.regions, ["US"]);
  assert.deepEqual(
    created.denominations.map((item) => item.reloadlyUnitPrice),
    [20, 25, 30, 50],
  );
  assert.ok(created.denominations.every((item) => item.available));
});

test("nature de la fiche déduite du produit", () => {
  assert.equal(sync.kindForProduct(steamUs), "gift_card");
  assert.equal(sync.kindForProduct({ ...steamUs, brandName: "Roblox", productName: "Robux" }), "game_topup");
  assert.equal(sync.kindForProduct({ ...steamUs, brandName: "NVIDIA", productName: "GeForce Now" }), "software_key");
});

test("prix libres (RANGE) : aucun montant inventé", () => {
  const proposal = sync.buildProposal({
    product: { ...steamUs, denominationType: "RANGE", fixedDenominations: [], minDenomination: 10, maxDenomination: 100 },
    fiche: null,
    marginPercent: 6,
    paymentFeePercent: 1,
  });
  assert.equal(proposal.denominations.length, 0);
  assert.match(proposal.notes.join(" "), /prix libre/);
});
