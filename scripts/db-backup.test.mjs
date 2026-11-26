#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dumpFileName,
  maskConnection,
  parseBackupArgs,
  parseRestoreArgs,
} from "./lib/db-backup.mjs";

test("le nom de sauvegarde est daté et sans caractère interdit", () => {
  const name = dumpFileName(new Date("2026-11-20T19:30:00.000Z"));
  assert.equal(name, "db-2026-11-20T19-30-00-000Z.sql.gz");
  assert.doesNotMatch(name, /[:\\/]/);
});

test("la chaîne de connexion est masquée avant affichage", () => {
  const masked = maskConnection("postgresql://user:secret@db.example.com:5432/app");
  assert.match(masked, /user/);
  assert.match(masked, /db\.example\.com/);
  assert.doesNotMatch(masked, /secret/);
  assert.equal(maskConnection(""), "(absente)");
  assert.equal(maskConnection("pas une url"), "(illisible)");
});

test("les arguments refusent les valeurs vides", () => {
  assert.deepEqual(parseBackupArgs([]), { outDir: "backups" });
  assert.deepEqual(parseBackupArgs(["--out", "/tmp/x"]), { outDir: "/tmp/x" });
  assert.throws(() => parseBackupArgs(["--out"]), /dossier/);
});

test("la restauration exige un fichier .sql.gz et reste en simulation par défaut", () => {
  assert.deepEqual(parseRestoreArgs(["--file", "db.sql.gz"]), {
    file: "db.sql.gz",
    confirm: false,
  });
  assert.deepEqual(parseRestoreArgs(["--file", "db.sql.gz", "--confirm"]), {
    file: "db.sql.gz",
    confirm: true,
  });
  assert.throws(() => parseRestoreArgs([]), /fichier/);
  assert.throws(() => parseRestoreArgs(["--file", "sauvegarde.sql"]), /\.sql\.gz/);
});
