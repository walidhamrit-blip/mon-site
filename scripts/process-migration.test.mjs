import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PROCESS_STEP_06_MARKER,
  PROCESS_STEP_06_NUM,
  findProcessStep,
  migrateProcessHeading,
  normalizeStepNum,
  withProcessStep06,
} from "../src/lib/process-migration.ts";

const STEP_06 = {
  num: "06",
  titleAr: "التسليم والضمان",
  titleEn: "Handover & Warranty",
  descAr: "رابط تسليم واحد…",
  descEn: "One handover link…",
  durationAr: "يوم واحد",
  durationEn: "1 day",
};

const LEGACY_STORED = [
  { num: "01", titleAr: "", titleEn: "Discovery Call", descAr: "", descEn: "", durationAr: "", durationEn: "" },
  { num: "05", titleAr: "", titleEn: "Launch & Train", descAr: "", descEn: "", durationAr: "", durationEn: "" },
];

const DEFAULTS = [...LEGACY_STORED, STEP_06];

/* --------------------------- Fonctions pures --------------------------- */

test("the step number is recognized whatever the zero padding", () => {
  assert.equal(normalizeStepNum("06"), "6");
  assert.equal(normalizeStepNum("6"), "6");
  assert.equal(normalizeStepNum(" 06 "), "6");
  assert.equal(normalizeStepNum(undefined), "");
});

test("step 06 is appended to a stored list saved before the feature", () => {
  const result = withProcessStep06(LEGACY_STORED, DEFAULTS);
  assert.equal(result.added, true);
  assert.equal(result.steps.length, 3);
  assert.equal(result.steps.at(-1).num, PROCESS_STEP_06_NUM);
  // Le tableau reçu n'est jamais modifié : l'appelant décide de l'écriture.
  assert.equal(LEGACY_STORED.length, 2);
});

test("nothing is added twice, whatever the padding used by the admin", () => {
  const already = withProcessStep06([...LEGACY_STORED, { ...STEP_06, num: "6" }], DEFAULTS);
  assert.equal(already.added, false);
  const exact = withProcessStep06([...LEGACY_STORED, STEP_06], DEFAULTS);
  assert.equal(exact.added, false);
  assert.equal(exact.steps.length, 3);
});

test("without a default step 06, the stored list is left untouched", () => {
  const result = withProcessStep06(LEGACY_STORED, LEGACY_STORED);
  assert.equal(result.added, false);
  assert.deepEqual(result.steps, LEGACY_STORED);
});

test("findProcessStep ignores a malformed list", () => {
  assert.equal(findProcessStep(DEFAULTS, "06")?.titleEn, "Handover & Warranty");
  assert.equal(findProcessStep([], "06"), undefined);
});

test("only the former default subtitle is rewritten — never a custom one", () => {
  const legacy = migrateProcessHeading({
    titleAr: "من الفكرة إلى الإطلاق",
    titleEn: "From idea to launch",
    subtitleAr: "5 خطوات واضحة — تعرف أين نحن كل يوم",
    subtitleEn: "5 clear steps — you know where we are every day",
  });
  assert.equal(legacy.changed, true);
  assert.match(legacy.heading.subtitleAr, /^6 خطوات واضحة/);
  assert.match(legacy.heading.subtitleEn, /^6 clear steps/);
  // Le titre reste celui de l'administrateur.
  assert.equal(legacy.heading.titleEn, "From idea to launch");

  const custom = migrateProcessHeading({
    titleAr: "t",
    titleEn: "t",
    subtitleAr: "ست خطوات نحو موقعك",
    subtitleEn: "Six steps to your website",
  });
  assert.equal(custom.changed, false);
  assert.equal(custom.heading, null);

  const empty = migrateProcessHeading(undefined);
  assert.equal(empty.changed, false);
});

/* ------------------------------ Câblage ------------------------------- */

test("the store applies the migration once, without blocking the render", () => {
  const source = readFileSync("src/lib/store.ts", "utf8");
  assert.match(source, /from "@\/lib\/process-migration"/);
  assert.match(source, /withProcessStep06\(storedProcess, defaultProcess\)/);
  assert.match(source, /migrateProcessHeading\(headings\.process\)/);
  // Marqueur : une étape supprimée volontairement ne réapparaît pas.
  assert.match(source, /!map\.has\(PROCESS_STEP_06_MARKER\)/);
  assert.match(source, /upsertSetting\(PROCESS_STEP_06_MARKER,/);
  // L'écriture ne bloque jamais le rendu et redevient tentable en cas d'échec.
  assert.match(source, /void persistProcessStep06\(\{/);
  assert.match(source, /processStep06Migration = null; \/\/ autorise une nouvelle tentative/);
});

test("the marker key is namespaced with the other content keys", () => {
  assert.equal(PROCESS_STEP_06_MARKER, "content_process_step06_migrated");
});
