#!/usr/bin/env node
/**
 * Sauvegarde de la table `leads` dans un fichier JSON local.
 *
 *   DATABASE_URL=… npm run backup:leads            # écrit dans backups/
 *   DATABASE_URL=… node scripts/backup-leads.mjs --out /tmp/sauvegardes
 *
 * Le fichier contient des données personnelles : il est ignoré par Git et
 * écrit avec des permissions 600. Ne jamais le committer ni le partager.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import pg from "pg";
import {
  backupFileName,
  buildBackup,
  checksum,
  serializeBackup,
} from "./lib/leads-backup.mjs";

export function parseOutArg(argv) {
  const index = argv.indexOf("--out");
  if (index === -1) return "backups";
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error("--out attend un dossier");
  return value;
}

export function requireDatabaseUrl(env = process.env) {
  const url = env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL est requis pour sauvegarder les leads");
  return url;
}

async function main() {
  const outDir = resolve(parseOutArg(process.argv.slice(2)));
  const connectionString = requireDatabaseUrl();
  const pool = new pg.Pool({ connectionString });
  try {
    const { rows } = await pool.query(
      `SELECT id, created_at, name, business, phone, email, sector, need, budget,
              deadline, message, utm, locale, status, notes
         FROM leads
        ORDER BY id`,
    );
    const backup = buildBackup(rows);
    const text = serializeBackup(backup);
    await mkdir(outDir, { recursive: true });
    const file = join(outDir, backupFileName());
    await writeFile(file, text, { mode: 0o600 });
    console.log(`Sauvegarde : ${file}`);
    console.log(`Lignes : ${backup.count}`);
    console.log(`Empreinte SHA-256 : ${checksum(text)}`);
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
