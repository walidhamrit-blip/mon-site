#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BACKUP_VERSION,
  backupFileName,
  buildBackup,
  checksum,
  rowsToInsert,
  serializeBackup,
  validateBackup,
} from "./lib/leads-backup.mjs";
import { parseOutArg } from "./backup-leads.mjs";
import { parseRestoreArgs } from "./restore-leads.mjs";

const row = (id) => ({ id, name: "Client", business: "Boutique", phone: "+218900000000" });

test("le nom de fichier est trié chronologiquement et sans caractère interdit", () => {
  const name = backupFileName(new Date("2026-11-20T19:30:00.000Z"));
  assert.equal(name, "leads-2026-11-20T19-30-00-000Z.json");
  assert.doesNotMatch(name, /[:\\/]/);
});

test("la sauvegarde est sérialisable et son empreinte est stable", () => {
  const backup = buildBackup([row(1), row(2)], new Date("2026-11-20T19:30:00.000Z"));
  assert.equal(backup.count, 2);
  const text = serializeBackup(backup);
  assert.equal(checksum(text), checksum(text));
  assert.deepEqual(validateBackup(JSON.parse(text)).rows.length, 2);
});

test("une sauvegarde incohérente est refusée", () => {
  assert.throws(() => validateBackup(null), /illisible/);
  assert.throws(() => validateBackup({ ...buildBackup([row(1)]), version: 99 }), /version/);
  assert.throws(() => validateBackup({ ...buildBackup([row(1)]), count: 3 }), /compte/);
  assert.throws(() => validateBackup({ ...buildBackup([{ ...row(1), phone: " " }]) }), /phone/);
  assert.throws(() => validateBackup(buildBackup([row(1), row(1)])), /dupliqué/);
});

test("seules les lignes absentes sont réinsérées, dans l'ordre des identifiants", () => {
  const rows = [row(3), row(1), row(2)];
  assert.deepEqual(rowsToInsert([2], rows).map((r) => r.id), [1, 3]);
  assert.equal(rowsToInsert([1, 2, 3], rows).length, 0);
});

test("les arguments sont validés avant tout accès à la base", () => {
  assert.equal(parseOutArg([]), "backups");
  assert.equal(parseOutArg(["--out", "/tmp/x"]), "/tmp/x");
  assert.throws(() => parseOutArg(["--out"]), /dossier/);
  assert.deepEqual(parseRestoreArgs(["--file", "b.json"]), { file: "b.json", confirm: false });
  assert.deepEqual(parseRestoreArgs(["--file", "b.json", "--confirm"]), {
    file: "b.json",
    confirm: true,
  });
  assert.throws(() => parseRestoreArgs([]), /fichier/);
  assert.equal(BACKUP_VERSION, 1);
});
