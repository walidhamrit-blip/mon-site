/** Aides pures pour la sauvegarde complète (testables sans base). */

export function dumpFileName(date = new Date()) {
  return `db-${date.toISOString().replace(/[:.]/g, "-")}.sql.gz`;
}

/** Masque le mot de passe d'une chaîne de connexion avant de l'afficher. */
export function maskConnection(url) {
  if (!url) return "(absente)";
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "(illisible)";
  }
}

export function parseBackupArgs(argv) {
  const index = argv.indexOf("--out");
  if (index === -1) return { outDir: "backups" };
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error("--out attend un dossier");
  return { outDir: value };
}

export function parseRestoreArgs(argv) {
  const index = argv.indexOf("--file");
  const file = index === -1 ? null : argv[index + 1];
  if (!file || file.startsWith("--")) throw new Error("--file attend un fichier .sql.gz");
  if (!file.endsWith(".sql.gz")) {
    throw new Error("seuls les fichiers .sql.gz produits par backup-db.mjs sont acceptés");
  }
  return { file, confirm: argv.includes("--confirm") };
}
