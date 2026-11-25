/** Logique pure de la sauvegarde de la table `leads` (testable sans base). */
import { createHash } from "node:crypto";

export const BACKUP_VERSION = 1;
export const LEADS_TABLE = "leads";

/** Colonnes exportées, dans l'ordre d'insertion au moment d'une restauration. */
export const LEAD_COLUMNS = [
  "id",
  "created_at",
  "name",
  "business",
  "phone",
  "email",
  "sector",
  "need",
  "budget",
  "deadline",
  "message",
  "utm",
  "locale",
  "status",
  "notes",
];

export function backupFileName(date = new Date()) {
  return `leads-${date.toISOString().replace(/[:.]/g, "-")}.json`;
}

export function buildBackup(rows, date = new Date()) {
  if (!Array.isArray(rows)) throw new TypeError("rows doit être un tableau");
  return {
    version: BACKUP_VERSION,
    table: LEADS_TABLE,
    generatedAt: date.toISOString(),
    count: rows.length,
    rows,
  };
}

export function serializeBackup(backup) {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function checksum(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function validateBackup(value) {
  if (!value || typeof value !== "object") throw new Error("sauvegarde illisible : objet attendu");
  if (value.version !== BACKUP_VERSION) {
    throw new Error(`version de sauvegarde inconnue : ${value.version}`);
  }
  if (value.table !== LEADS_TABLE) {
    throw new Error(`table inattendue : ${value.table} (attendu : ${LEADS_TABLE})`);
  }
  if (!Array.isArray(value.rows)) throw new Error("sauvegarde illisible : rows manquant");
  if (value.count !== value.rows.length) {
    throw new Error(`compte incohérent : count=${value.count}, rows=${value.rows.length}`);
  }
  const seen = new Set();
  for (const row of value.rows) {
    if (!row || typeof row !== "object") throw new Error("ligne invalide dans la sauvegarde");
    if (!Number.isInteger(row.id) || row.id <= 0) throw new Error("ligne sans identifiant valide");
    if (seen.has(row.id)) throw new Error(`identifiant dupliqué dans la sauvegarde : ${row.id}`);
    seen.add(row.id);
    for (const column of ["name", "phone", "business"]) {
      if (typeof row[column] !== "string" || row[column].trim() === "") {
        throw new Error(`ligne ${row.id} : colonne « ${column} » vide`);
      }
    }
  }
  return value;
}

/** Lignes absentes de la base cible, triées par identifiant. */
export function rowsToInsert(existingIds, rows) {
  const existing = new Set(existingIds);
  return [...rows].filter((row) => !existing.has(row.id)).sort((a, b) => a.id - b.id);
}
