/**
 * Migration du contenu enregistré — étape 06 « التسليم والضمان ».
 *
 * ⚠️ Pourquoi ce module existe.
 * `resolveStoredList()` respecte la liste enregistrée en base dès que la clé
 * existe : c'est voulu (une liste vidée par l'administrateur doit rester
 * vide). Conséquence : toute base dont la section « Processus » a été
 * sauvegardée AVANT l'étape 06 garde ses 5 étapes — et le sous-titre
 * « 5 خطوات » — alors que le code en annonce 6. La nouvelle promesse
 * (remise des clés + garantie) resterait invisible en production.
 *
 * Cette migration comble l'écart UNE SEULE FOIS :
 *   - elle n'ajoute l'étape 06 que si la liste ne la contient pas ;
 *   - elle ne remplace le sous-titre que s'il est exactement l'ancienne
 *     valeur par défaut (un texte personnalisé n'est jamais touché) ;
 *   - elle pose un marqueur (`content_process_step06_migrated`) : si
 *     l'administrateur supprime ensuite l'étape volontairement, elle ne
 *     réapparaît pas au prochain rendu.
 *
 * Module pur : aucune import de valeur, testable sans base de données
 * (`scripts/process-migration.test.mjs`).
 */

import type { ProcessStep, SectionHeading } from "./site-types";

/** Clé du marqueur : « cette base a déjà reçu l'étape 06 ». */
export const PROCESS_STEP_06_MARKER = "content_process_step06_migrated";

/** Numéro de l'étape ajoutée. */
export const PROCESS_STEP_06_NUM = "06";

const OLD_SUBTITLE_AR = "5 خطوات واضحة — تعرف أين نحن كل يوم";
const OLD_SUBTITLE_EN = "5 clear steps — you know where we are every day";
const NEW_SUBTITLE_AR = "6 خطوات واضحة — تعرف أين نحن كل يوم";
const NEW_SUBTITLE_EN = "6 clear steps — you know where we are every day";

/** `06`, `6`, ` 06 ` → `6` : un numéro saisi à la main ne doit pas tromper. */
export function normalizeStepNum(value: unknown): string {
  return String(value ?? "").trim().replace(/^0+(?=\d)/, "");
}

/** L'étape de ce numéro, si la liste la contient. */
export function findProcessStep(
  steps: readonly ProcessStep[],
  num: string,
): ProcessStep | undefined {
  const wanted = normalizeStepNum(num);
  return steps.find((step) => normalizeStepNum(step?.num) === wanted);
}

export interface ProcessStepFix {
  steps: ProcessStep[];
  /** Vrai si l'étape a été ajoutée (une écriture est nécessaire). */
  added: boolean;
}

/**
 * Ajoute l'étape 06 des valeurs par défaut à une liste enregistrée qui ne
 * l'a pas. Ne modifie jamais le tableau reçu.
 */
export function withProcessStep06(
  stored: readonly ProcessStep[],
  defaults: readonly ProcessStep[],
): ProcessStepFix {
  const list = Array.isArray(stored) ? [...stored] : [];
  const step = findProcessStep(defaults, PROCESS_STEP_06_NUM);
  if (!step) return { steps: list, added: false };
  if (findProcessStep(list, PROCESS_STEP_06_NUM)) return { steps: list, added: false };
  return { steps: [...list, { ...step }], added: true };
}

export interface ProcessHeadingFix {
  heading: SectionHeading | null;
  /** Vrai si le sous-titre a été mis à jour (une écriture est nécessaire). */
  changed: boolean;
}

/**
 * Remplace l'ancien sous-titre « 5 étapes » par « 6 étapes » — uniquement
 * s'il est strictement l'ancienne valeur par défaut.
 */
export function migrateProcessHeading(
  heading: SectionHeading | null | undefined,
): ProcessHeadingFix {
  if (!heading || typeof heading !== "object") return { heading: null, changed: false };
  const next: SectionHeading = { ...heading };
  let changed = false;
  if (next.subtitleAr?.trim() === OLD_SUBTITLE_AR) {
    next.subtitleAr = NEW_SUBTITLE_AR;
    changed = true;
  }
  if (next.subtitleEn?.trim() === OLD_SUBTITLE_EN) {
    next.subtitleEn = NEW_SUBTITLE_EN;
    changed = true;
  }
  return { heading: changed ? next : null, changed };
}
