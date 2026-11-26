#!/usr/bin/env node
/**
 * Restauration d'une sauvegarde complète produite par scripts/backup-db.mjs.
 *
 *   node scripts/restore-db.mjs --file backups/db-….sql.gz            # simulation
 *   node scripts/restore-db.mjs --file backups/db-….sql.gz --confirm  # écriture
 *
 * La sauvegarde contient des DROP … IF EXISTS : la restauration remplace le
 * contenu de la base cible. Par défaut, rien n'est exécuté.
 */
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createGunzip } from "node:zlib";
import { createReadStream } from "node:fs";
import { maskConnection, parseRestoreArgs } from "./lib/db-backup.mjs";

async function main() {
  const { file, confirm } = parseRestoreArgs(process.argv.slice(2));
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL est requis pour restaurer");

  const absolute = resolve(file);
  const { size } = await stat(absolute).catch(() => {
    throw new Error(`fichier introuvable : ${absolute}`);
  });

  console.log(`Fichier : ${absolute} (${(size / 1024).toFixed(0)} Kio)`);
  console.log(`Cible : ${maskConnection(connectionString)}`);
  if (!confirm) {
    console.log("Simulation : aucune écriture. Relancer avec --confirm pour restaurer.");
    return;
  }

  const child = spawn(
    "psql",
    ["-v", "ON_ERROR_STOP=1", "--quiet", connectionString],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  await new Promise((resolveRun, rejectRun) => {
    child.on("error", rejectRun);
    child.on("close", (code) =>
      code === 0 ? resolveRun() : rejectRun(new Error(`psql a échoué (code ${code})`)),
    );
    createReadStream(absolute).pipe(createGunzip()).pipe(child.stdin);
  });
  console.log("Restauration terminée.");
}

main().catch((error) => {
  console.error(`Échec : ${error.message}`);
  process.exitCode = 1;
});
