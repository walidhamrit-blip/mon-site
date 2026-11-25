#!/usr/bin/env node
/**
 * Restauration d'une sauvegarde `leads` produite par scripts/backup-leads.mjs.
 *
 *   node scripts/restore-leads.mjs --file backups/leads-….json              # simulation
 *   node scripts/restore-leads.mjs --file backups/leads-….json --confirm    # écriture
 *
 * Par défaut, rien n'est écrit : le script affiche seulement ce qu'il ferait.
 * Les identifiants déjà présents sont ignorés (aucun écrasement silencieux).
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { LEAD_COLUMNS, rowsToInsert, validateBackup } from "./lib/leads-backup.mjs";

export function parseRestoreArgs(argv) {
  const index = argv.indexOf("--file");
  const file = index === -1 ? null : argv[index + 1];
  if (!file || file.startsWith("--")) throw new Error("--file attend un fichier de sauvegarde");
  return { file, confirm: argv.includes("--confirm") };
}

export function buildInsertSql() {
  const columns = LEAD_COLUMNS.join(", ");
  const values = LEAD_COLUMNS.map((_, i) => `$${i + 1}`).join(", ");
  return `INSERT INTO leads (${columns}) VALUES (${values}) ON CONFLICT (id) DO NOTHING`;
}

async function main() {
  const { file, confirm } = parseRestoreArgs(process.argv.slice(2));
  const backup = validateBackup(JSON.parse(await readFile(resolve(file), "utf8")));
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL est requis pour restaurer");

  const pool = new pg.Pool({ connectionString });
  try {
    const ids = backup.rows.map((row) => row.id);
    const { rows: existing } = await pool.query(
      "SELECT id FROM leads WHERE id = ANY($1::int[])",
      [ids],
    );
    const plan = rowsToInsert(existing.map((row) => row.id), backup.rows);
    console.log(`Sauvegarde : ${resolve(file)} (${backup.count} lignes, ${backup.generatedAt})`);
    console.log(`Déjà en base : ${existing.length} · à insérer : ${plan.length}`);

    if (!confirm) {
      console.log("Simulation : aucune écriture. Relancer avec --confirm pour restaurer.");
      return;
    }
    if (plan.length === 0) {
      console.log("Rien à restaurer.");
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const sql = buildInsertSql();
      for (const row of plan) {
        await client.query(sql, LEAD_COLUMNS.map((column) => row[column] ?? null));
      }
      await client.query(
        `SELECT setval(pg_get_serial_sequence('leads', 'id'),
                       GREATEST(COALESCE((SELECT MAX(id) FROM leads), 1), 1))`,
      );
      await client.query("COMMIT");
      console.log(`Restauré : ${plan.length} ligne(s).`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(`Échec : ${error.message}`);
    process.exitCode = 1;
  });
}
