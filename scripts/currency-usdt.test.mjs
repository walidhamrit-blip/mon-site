#!/usr/bin/env node
/**
 * Affichage des prix en USDT.
 *
 * Le site facture en USD (ce que NOWPayments encaisse) mais AFFICHE en
 * USDT : 1 USD = 1 USDT, donc aucune conversion, aucun taux de marché à
 * suivre, et le visiteur voit exactement l'unité qu'il paie. Aucun appel
 * réseau ici : uniquement le catalogue de devises et son formatage.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "currency-"));

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

const currency = await compile("lib/currency.ts", "currency");

test.after(() => rmSync(outDir, { recursive: true, force: true }));

test("USDT : unité affichée après le montant, à parité avec le dollar", () => {
  assert.equal(currency.formatMoney(59.5, "USDT"), "59.50 USDT");
  assert.equal(currency.formatMoney(16, "USDT"), "16.00 USDT");
  // Parité stricte : aucun taux de marché, donc aucun prix faux possible.
  assert.equal(currency.convertFromBase(59.5, "USDT"), 59.5);
  assert.equal(currency.currencyRate("USDT"), 1);
});

test("USDT est la devise d'affichage par défaut", () => {
  assert.equal(currency.DEFAULT_DISPLAY_CURRENCY, "USDT");
  assert.equal(currency.enabledCurrencies()[0], "USDT");
  // La devise de FACTURATION ne change pas : c'est toujours le dollar.
  assert.equal(currency.BASE_CURRENCY, "USD");
});

test("les monnaies locales restent proposées, converties correctement", () => {
  const rates = { EUR: 0.92, LYD: 4.83 };
  const euros = currency.convertFromBase(100, "EUR", rates);
  assert.equal(Math.round(euros * 100) / 100, 92);
  assert.equal(currency.formatMoney(euros, "EUR"), "€92.00");
  // Un taux absent retombe sur 1 : on n'affiche jamais un prix converti faux.
  assert.equal(currency.convertFromBase(100, "EUR", {}), 100);
  assert.equal(currency.normalizeCurrency("xyz"), "USD");
});

test("le prix affiché est bien CONVERTI avant formatage", () => {
  // Bug corrigé : le provider formatait le montant USD avec le symbole de la
  // devise choisie, sans convertir (« €59.50 » pour 59,50 $).
  const provider = readFileSync(join(srcRoot, "components/currency-provider.tsx"), "utf8");
  assert.match(provider, /formatMoney\(convertFromBase\(amountUsd, currency, rates \?\? undefined\), currency\)/);
  assert.match(provider, /formatCompact: \(amountUsd: number\) =>\s*\n?\s*formatMoneyCompact\(convertFromBase/);
  assert.match(provider, /DEFAULT_DISPLAY_CURRENCY/);
});

test("aucune mention « facturé en » quand l'unité vaut déjà le dollar", () => {
  const price = readFileSync(join(srcRoot, "components/price.tsx"), "utf8");
  assert.match(price, /currencyRate\(currency, rates\) === 1/);
});
