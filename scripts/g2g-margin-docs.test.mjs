#!/usr/bin/env node
/**
 * Empêche la valeur de `G2G_FEE_PERCENT` de diverger entre le modèle
 * d'environnement, la doc du pilote et l'audit de marge.
 *
 * Pourquoi ce test existe : la commission est la seule variable qui peut
 * faire acheter à perte de façon automatique. Si un jour quelqu'un « aligne »
 * `.env.example` sur les 4,99 % de commission affichés par G2G, ou met 6 %
 * parce que c'est le meilleur canal de retrait, la marge calculée par le
 * moteur deviendrait fausse sans qu'aucun autre test ne bronche.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");

/**
 * Les quatre taux mesurés par l'audit, en % du prix de vente, avec le libellé
 * exact employé dans la documentation (accents compris).
 */
const MESURES = {
  pessimiste: { libelle: "Pessimiste", taux: 10.73 },
  realiste: { libelle: "Réaliste", taux: 10.23 },
  cible: { libelle: "Cible", taux: 6.05 },
  risque: { libelle: "Risque", taux: 14.98 },
};

test("l'audit référence les quatre scénarios de frais", () => {
  const doc = read("docs/audit-marges-g2g-2026-11-17.md");
  for (const { libelle, taux } of Object.values(MESURES)) {
    assert.ok(doc.includes(libelle), `scénario « ${libelle} » absent de l'audit`);
    assert.ok(
      doc.includes(taux.toFixed(2).replace(".", ",")),
      `taux ${taux} % du scénario « ${libelle} » absent de l'audit`,
    );
  }
});

test("la commission seule n'est jamais présentée comme le taux à déployer", () => {
  const doc = read("docs/audit-marges-g2g-2026-11-17.md");
  // Les 4,99 % de commission existent dans le barème, mais la doc doit dire
  // explicitement de ne pas les utiliser comme G2G_FEE_PERCENT.
  assert.match(doc, /Ne pas mettre 4,99/);
  assert.match(doc, /4,99 %/);
});

test("la valeur recommandée est la même partout", () => {
  const env = read(".env.example");
  const pilot = read("docs/g2g-pilot.md");
  const audit = read("docs/audit-marges-g2g-2026-11-17.md");

  for (const [nom, contenu] of [
    ["« .env.example »", env],
    ["« docs/g2g-pilot.md »", pilot],
    ["« l'audit »", audit],
  ]) {
    assert.match(contenu, /12/, `${nom} ne cite pas la valeur recommandée 12`);
  }
  assert.match(env, /VALEUR RECOMMANDÉE : 12/);
  assert.match(pilot, /Valeur recommandée : `12`/);
  assert.match(audit, /Valeur à déployer : `12`/);
});

test("le modèle d'environnement laisse la variable vide (aucun défaut optimiste)", () => {
  // Le code refuse de calculer une marge sans cette valeur. Mettre un défaut
  // ici reviendrait à autoriser un achat sur une commission supposée.
  assert.match(read(".env.example"), /^G2G_FEE_PERCENT=$/m);
});

test("l'audit nomme les produits à exclure et la raison Roblox", () => {
  const doc = read("docs/audit-marges-g2g-2026-11-17.md");
  assert.match(doc, /Robux/);
  assert.match(doc, /recharge manuelle|Manual Top Up/i);
  assert.match(doc, /Steam Wallet 100/);
});

test("le script d'audit reste exécutable sans réseau ni secret", () => {
  const script = read("scripts/g2g-margin-audit.mjs");
  assert.doesNotMatch(script, /\bfetch\s*\(/);
  assert.doesNotMatch(script, /process\.env/);
  assert.match(script, /docs\/data\/g2g-margin-audit-2026-11-17\.json/);
});
