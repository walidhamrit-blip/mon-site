#!/usr/bin/env node
/**
 * Sauvegarde complète de la base (schéma + données) au format SQL compressé.
 *
 *   DATABASE_URL=… npm run backup:db
 *   DATABASE_URL=… node scripts/backup-db.mjs --out /tmp/sauvegardes
 *
 * Dépend de `pg_dump` (fourni avec le client PostgreSQL). Le fichier contient
 * des données personnelles : il est ignoré par Git et ne se partage pas.
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { dumpFileName, maskConnection, parseBackupArgs } from "./lib/db-backup.mjs";

function runDump(connectionString) {
  const child = spawn(
    "pg_dump",
    [
      "--no-owner",
      "--no-privileges",
      "--clean",
      "--if-exists",
      connectionString,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  return { child, stderr: () => stderr };
}

async function main() {
  const { outDir } = parseBackupArgs(process.argv.slice(2));
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL est requis pour sauvegarder la base");

  const directory = resolve(outDir);
  await mkdir(directory, { recursive: true });
  const file = join(directory, dumpFileName());
  const { child, stderr } = runDump(connectionString);
  let spawnError = null;
  child.on("error", (error) => {
    spawnError = error;
  });

  try {
    await pipeline(child.stdout, createGzip({ level: 9 }), createWriteStream(file, { mode: 0o600 }));
  } catch (error) {
    if (spawnError) throw new Error(`pg_dump est introuvable ou non exécutable : ${spawnError.message}`);
    throw error;
  }
  if (spawnError) throw new Error(`pg_dump est introuvable ou non exécutable : ${spawnError.message}`);
  const code = await new Promise((resolveCode) => child.on("close", resolveCode));
  if (code !== 0) {
    throw new Error(`pg_dump a échoué (code ${code}) : ${stderr().trim().split("\n").slice(-1)[0]}`);
  }
  const { size } = await stat(file);
  console.log(`Sauvegarde : ${file}`);
  console.log(`Taille : ${(size / 1024).toFixed(0)} Kio`);
  console.log(`Source : ${maskConnection(connectionString)}`);
}

main().catch((error) => {
  console.error(`Échec : ${error.message}`);
  process.exitCode = 1;
});
