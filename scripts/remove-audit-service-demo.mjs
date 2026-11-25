#!/usr/bin/env node
/**
 * Retirer le service « audit » des « exemples de modèles de sites » — `npm run demos:prune-audit`
 *
 * Contexte : le service audit est une offre à part entière (page /audit,
 * service `fix-optimize` dans /services, page « تدقيق موقع » en arabe). Il
 * n'est PAS un modèle de site : il ne doit pas apparaître dans la galerie
 * « Exemples & réalisations » (/demos, /demos/[slug], sitemap, llms.txt).
 *
 * Le service audit a été ajouté un jour comme fiche démo par erreur
 * (slug `audit-de-site`). Cette fiche vit dans la base (`settings.content_demos`),
 * pas dans le code — le dépôt est propre. Ce script retire précisément cette
 * fiche, sans toucher aux autres entrées, de façon idempotente.
 *
 *   node scripts/remove-audit-service-demo.mjs          # simulation (défaut)
 *   node scripts/remove-audit-service-demo.mjs --apply  # écrit en base
 *
 * Dépendance unique : `pg` (même règle que scripts/check-delivery.mjs).
 * Lit `DATABASE_URL` dans l'environnement, sinon `.env.local` puis `.env`.
 * ⚠️  Le script interroge la base pointée par cette variable : vérifiez la
 * ligne « Base » affichée avant d'écrire.
 *
 * Règles :
 *  - simulation par défaut : aucune écriture, seulement un bilan ;
 *  - idempotent : relancer après `--apply` est sans effet ;
 *  - aucune valeur secrète n'est affichée (slugs et titres publics uniquement) ;
 *  - les caches de pages publiques sont invalidés par l'application quand
 *    l'admin enregistre un changement ; ce script écrit directement en base,
 *    donc après `--apply` relancez la validation des pages (ou redéployez)
 *    — sinon le site affiche l'ancienne liste le temps du TTL.
 *
 * Codes de sortie : 0 = OK (rien ou nettoyé) · 2 = configuration manquante,
 * base injoignable ou erreur.
 */

import { existsSync, readFileSync } from "node:fs";
import pg from "pg";
import { REMOVE_SLUGS, removeSlugs } from "./lib/audit-demo-prune.mjs";

/** Lecture minimale de `.env.local` / `.env`. */
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

for (const file of [".env.local", ".env"]) loadEnvFile(file);

const apply = process.argv.includes("--apply");
const help = process.argv.includes("--help") || process.argv.includes("-h");

const REMOVE = REMOVE_SLUGS;
const KEY = "content_demos";

function fail(message, hint = "") {
  console.error(`\n❌ ${message}`);
  if (hint) console.error(`   ${hint}`);
  process.exit(2);
}

if (help) {
  console.log(`Usage: node scripts/remove-audit-service-demo.mjs [--apply]

Affiche la liste des fiches « audit-de-site » à retirer des « modèles de sites »
(settings.content_demos). Avec --apply, écrit la liste réécrite en base.
Aucune écriture sans --apply.`);
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  fail(
    "DATABASE_URL absente.",
    "Ajoutez la chaîne PostgreSQL de production dans .env.local (jamais dans Git).",
  );
}

let host = "hôte inconnu";
try {
  host = new URL(databaseUrl).host;
} catch {
  fail("DATABASE_URL illisible (ce n'est pas une URL postgresql://…).");
}

const client = new pg.Client({ connectionString: databaseUrl });

async function main() {
  try {
    await client.connect();
  } catch (error) {
    fail("Base injoignable.", error instanceof Error ? error.message : String(error));
  }

  try {
    const { rows } = await client.query("SELECT value FROM settings WHERE key = $1", [KEY]);

    console.log(`Base : ${host}  (clé : ${KEY})`);

    if (rows.length === 0) {
      console.log(
        "\n✅ Aucune surcharge en base — le site sert les démos codées par défaut.\n" +
          "   Elles ne contiennent pas « " +
          REMOVE.join(" », « ") +
          " » (audit absent). Rien à faire.",
      );
      return;
    }

    let demos;
    try {
      demos = JSON.parse(JSON.stringify(rows[0].value));
    } catch {
      demos = null;
    }
    if (!Array.isArray(demos)) {
      fail(
        `La clé « ${KEY} » ne contient pas une liste de fiches.`,
        "Inspectez la base avant de toucher quoi que ce soit.",
      );
    }

    const before = demos.length;
    const { kept, removed } = removeSlugs(demos, REMOVE);

    console.log(`\nAvant : ${before} fiche(s)`);
    for (const r of removed) {
      console.log(`  ⛔ à retirer : « ${r.slug} »${r.title ? ` (${r.title})` : ""}`);
    }
    console.log(`Après : ${kept.length} fiche(s)`);

    if (removed.length === 0) {
      console.log("\n✅ Rien à retirer — la galerie contient déjà uniquement des modèles de sites.");
      return;
    }

    if (!apply) {
      console.log(
        `\nℹ️  Simulation — aucune écriture. Relancez avec --apply pour retirer ${removed.length} fiche(s).`,
      );
      return;
    }

    // Réécriture : la liste complète, sans les fiches retirées — upsert idempotent.
    await client.query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [KEY, JSON.stringify(kept)],
    );

    console.log(`\n✅ Enregistré — ${removed.length} fiche(s) retirée(s), ${kept.length} restante(s).`);
    console.log(
      "⚠️  Les pages publiques peuvent encore afficher l'ancienne liste le temps du TTL :\n" +
        "   relancez la validation des pages (ou redéployez) pour voir le changement immédiatement.",
    );
  } catch (error) {
    fail("Erreur pendant le retrait.", error instanceof Error ? error.message : String(error));
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
});
