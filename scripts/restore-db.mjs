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
import { Transform } from "node:stream";
import { maskConnection, parseRestoreArgs, stripUnsupportedSettings } from "./lib/db-backup.mjs";

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
  let buffer = "";
  const compatibility = new Transform({
    transform(chunk, _encoding, callback) {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      callback(null, stripUnsupportedSettings(`${lines.join("\n")}\n`));
    },
    flush(callback) {
      callback(null, buffer ? stripUnsupportedSettings(buffer) : undefined);
    },
  });

  await new Promise((resolveRun, rejectRun) => {
    child.on("error", rejectRun);
    child.on("close", (code) =>
      code === 0 ? resolveRun() : rejectRun(new Error(`psql a échoué (code ${code})`)),
    );
    createReadStream(absolute).pipe(createGunzip()).pipe(compatibility).pipe(child.stdin);
  });
  console.log("Restauration terminée.");
}

main().catch((error) => {
  console.error(`Échec : ${error.message}`);
  process.exitCode = 1;
});
