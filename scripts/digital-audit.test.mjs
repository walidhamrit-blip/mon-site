#!/usr/bin/env node
/**
 * Audit du catalogue : signalement des PERTES.
 *
 * Incident réel : des produits en vente (Spotify 30 USD à 29,50 $, Robux
 * 80 → 83,50 $) n'apparaissaient pas dans l'audit, parce que toute fiche
 * sans marge / sans produit Reloadly / en livraison manuelle était écartée
 * avant le contrôle de perte.
 *
 * Ces tests verrouillent : le contrôle de perte hors réseau (valeur faciale),
 * l'absence d'exclusion des fiches incomplètes, la gravité des messages, et
 * la synthèse affichée en tête de l'admin.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "audit-"));

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

const core = await compile("lib/digital-order-core.ts", "core");
const audit = core; // `faceValueLosses` vit dans le noyau pur (testable sans DB)

test.after(() => rmSync(outDir, { recursive: true, force: true }));

const read = (path) => readFileSync(`${root}/${path}`, "utf8");
const flat = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/\s+/g, " ");

function denomination(overrides = {}) {
  return {
    id: "d1",
    label: "$30",
    faceValue: "30 USD",
    region: "US",
    priceUsd: 29.5,
    available: true,
    ...overrides,
  };
}

test("contrôle hors réseau : prix sous la valeur faciale = perte", () => {
  const losses = audit.faceValueLosses([
    { id: "spotify-us", titleEn: "Spotify US", denominations: [denomination()] },
  ]);
  assert.equal(losses.length, 1);
  assert.equal(losses[0].price, 29.5);
  assert.equal(losses[0].face, 30);

  // Prix égal ou supérieur à la face : pas de perte.
  assert.equal(
    audit.faceValueLosses([
      { id: "x", titleEn: "X", denominations: [denomination({ priceUsd: 30 })] },
    ]).length,
    0,
  );
  assert.equal(
    audit.faceValueLosses([
      { id: "x", titleEn: "X", denominations: [denomination({ priceUsd: 33 })] },
    ]).length,
    0,
  );

  // Un montant désactivé n'est pas vendu : pas d'alerte.
  assert.equal(
    audit.faceValueLosses([
      { id: "x", titleEn: "X", denominations: [denomination({ available: false })] },
    ]).length,
    0,
  );

  // Valeur faciale illisible : on ne devine rien.
  assert.equal(
    audit.faceValueLosses([
      { id: "x", titleEn: "X", denominations: [denomination({ faceValue: "", reloadlyUnitPrice: null, label: "Robux" })] },
    ]).length,
    0,
  );
});

test("aucune fiche n'est exclue du contrôle de perte", () => {
  const source = flat(read("src/lib/digital-audit.ts"));
  // Les exclusions qui masquaient les pertes ont disparu.
  assert.equal(/reason: "Aucune marge nette définie sur la fiche\."/.test(source), false);
  assert.equal(/reason: "Aucun produit Reloadly relié\."/.test(source), false);
  assert.equal(/reason: "Livraison manuelle : aucun coût fournisseur à appliquer\."/.test(source), false);
  // L'absence de marge / de produit devient une note sur la ligne.
  assert.match(source, /Aucune marge nette définie : prix recalculé impossible/);
  assert.match(source, /Aucun produit Reloadly relié : coût estimé sur la valeur faciale/);
  assert.match(source, /Livraison manuelle : coût estimé sur la valeur faciale/);
  // Seule une fiche sans aucun montant est écartée.
  assert.match(source, /reason: "Aucun montant dans la fiche\."/);
});

test("la perte est signalée avec sa gravité, son coût et la source du coût", () => {
  const source = flat(read("src/lib/digital-audit.ts"));
  assert.match(source, /severity: "loss"/);
  assert.match(source, /VENTE À PERTE : prix/);
  assert.match(source, /perte de \$\{/);
  assert.match(source, /frais Reloadly inclus/);
  assert.match(source, /valeur faciale, frais non connus/);
  // Une devise non USD est signalée (cas Robux à 83,50 $ pour 80 Robux).
  assert.match(source, /les prix doivent être convertis en USD/);
  // Les montants désactivés ne déclenchent pas de fausse alerte de perte.
  assert.match(source, /const loss = denomination\.available &&/);
});

test("synthèse : pertes comptées en tête d'audit", () => {
  const source = flat(read("src/lib/digital-audit.ts"));
  assert.match(source, /summary: \{/);
  assert.match(source, /fichesWithLoss/);
  assert.match(source, /belowFace/);
  const ui = flat(read("src/app/admin/(panel)/digital/catalog-audit.tsx"));
  assert.match(ui, /Ventes à perte/);
  assert.match(ui, /Afficher seulement les anomalies/);
  assert.match(ui, /row\.loss \|\|/);
});

test("alerte immédiate sur la page admin (sans appel Reloadly)", () => {
  const page = flat(read("src/app/admin/(panel)/digital/page.tsx"));
  assert.match(page, /faceValueLosses\(products\)/);
  assert.match(page, /vendus sous leur valeur faciale/);
});

test("arrondi conservé : recalcul vers le haut au pas de 0,50", () => {
  assert.equal(core.roundPriceUp(22.27), 22.5);
  assert.equal(core.roundPriceUp(22), 22);
  const price = core.computeSalePrice({ faceValue: 20, marginPercent: 4, paymentFeePercent: 1 });
  assert.equal(price.price, 21.5);
});

test("le recalcul reste fait côté serveur", () => {
  const actions = flat(read("src/app/admin/actions.ts"));
  assert.match(actions, /await applyCatalogRecalc\(safeFee, ficheIds\)/);
  const ui = flat(read("src/app/admin/(panel)/digital/catalog-audit.tsx"));
  assert.equal(/applyCatalogRecalcAction\([^)]*newPrice/.test(ui), false);
  const route = flat(read("src/app/api/admin/digital/recalc/route.ts"));
  assert.match(route, /isAdminAuthenticated/);
});
