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
    [21.5, 26.5, 32, 53],
  );
  assert.equal(rows[0].label, "$20");
  assert.equal(rows[0].cost, 20);
  // Après arrondi au demi supérieur, la marge obtenue dépasse la cible (4 %).
  assert.ok(rows[0].netMarginPercent >= 4);
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
  assert.equal(byLabel["$25"].priceUsd, 26.5);
  assert.equal(byLabel["$25"].available, true);
  assert.equal(byLabel["$20"].priceUsd, 21.5);
  assert.equal(byLabel["$30"].priceUsd, 32);
  assert.equal(byLabel["$50"].priceUsd, 53);

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

test("carte non-USD : le prix part du coût USD Reloadly, pas de la face locale", () => {
  // Steam Turquie : face 500 TRY, coût réel 15,20 $ (correspondance publiée).
  const steamTr = {
    ...steamUs,
    productId: 99901,
    productName: "Steam TRY",
    countryCode: "TR",
    currencyCode: "TRY",
    fixedDenominations: [100, 500],
    senderFeePercentage: 0,
    discountPercentage: 0,
    senderCurrencyCode: "USD",
    recipientToSenderMap: { "100": 3.1, "500": 15.2 },
  };
  const rows = sync.buildDenominations(steamTr, 4, 1);
  assert.equal(rows.length, 2);
  // 500 TRY ne vaut pas 500 $ : le prix reste de l'ordre de 16 $.
  assert.equal(rows[1].cost, 15.2);
  assert.equal(rows[1].priceUsd, 16);
  assert.ok(rows[1].priceUsd < 20);
  assert.equal(rows[1].faceCurrency, "TRY");
  assert.equal(rows[1].faceValue, "500 TRY");
  assert.equal(rows[1].supplierCostUsd, 15.2);
  // Le bug historique (face prise pour des dollars) est impossible.
  assert.notEqual(rows[1].priceUsd, 526.5);
});

test("carte non-USD sans coût publié : aucun prix inventé", () => {
  // Robux : la face est un NOMBRE DE PIÈCES, pas de l'argent. C'est le bug
  // « 80 Robux à 83,50 $ ». Sans coût USD, on ne propose rien.
  const robux = {
    ...steamUs,
    productId: 99902,
    productName: "Robux",
    currencyCode: "USD",
    fixedDenominations: [80, 400],
    senderFeePercentage: 0,
    discountPercentage: 0,
    senderCurrencyCode: "USD",
  };
  // Face USD + frais/remise connus → formule historique conservée.
  const usdRows = sync.buildDenominations(robux, 4, 1);
  assert.equal(usdRows.length, 2);

  const unknown = {
    ...robux,
    currencyCode: "TRY",
    senderCurrencyCode: "USD",
    recipientToSenderMap: {},
    fixedSenderDenominations: [],
    recipientToSenderRate: null,
  };
  assert.equal(sync.buildDenominations(unknown, 4, 1).length, 0);
  assert.equal(sync.supplierCostUsd(unknown, 500), null);
});

test("coût USD : correspondance > index > taux > formule USD", () => {
  const tr = {
    ...steamUs,
    currencyCode: "TRY",
    senderCurrencyCode: "USD",
    recipientToSenderMap: { "500": 15.2 },
    fixedSenderDenominations: [3.1, 15.9],
    recipientToSenderRate: 0.0304,
  };
  assert.equal(sync.supplierCostUsd(tr, 500), 15.2);
  // Pas de correspondance : l'index de la face sert de repli.
  assert.equal(sync.supplierCostUsd(tr, 100, 0), 3.1);
  // Ni l'un ni l'autre : le taux Reloadly.
  const rateOnly = { ...tr, recipientToSenderMap: {}, fixedSenderDenominations: [] };
  assert.equal(sync.supplierCostUsd(rateOnly, 500), 15.2);
  // Compte marchand non-USD : on ne devine pas une conversion.
  const nonUsdAccount = { ...tr, senderCurrencyCode: "EUR" };
  assert.equal(sync.supplierCostUsd(nonUsdAccount, 500), null);
  // Fiche en dollars : formule historique, frais et remise appliqués.
  const usd = { ...steamUs, senderFeePercentage: 5, discountPercentage: 2 };
  assert.equal(sync.supplierCostUsd(usd, 20), 20.58);
});

test("fiche non-USD : devise et coût mémorisés à l'application", () => {
  const tr = {
    ...steamUs,
    productId: 99901,
    countryCode: "TR",
    currencyCode: "TRY",
    fixedDenominations: [500],
    senderCurrencyCode: "USD",
    recipientToSenderMap: { "500": 15.2 },
  };
  const proposal = sync.buildProposal({ product: tr, fiche: null, marginPercent: 4, paymentFeePercent: 1 });
  const product = sync.applyProposalToProduct(proposal, null);
  const created = product.denominations[0];
  assert.equal(created.faceCurrency, "TRY");
  assert.equal(created.supplierCostUsd, 15.2);
  assert.equal(created.reloadlyUnitPrice, 500);
  assert.equal(created.priceUsd, 16);
});
