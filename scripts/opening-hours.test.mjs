#!/usr/bin/env node
/**
 * A09 (audit SEO/GEO 2026-11-01) — horaires structurés dérivés de la config.
 *
 * Le JSON-LD openingHoursSpecification ne doit plus contenir d'horaires en
 * dur : il est parsé depuis `config.hoursEn` (texte éditable dans l'admin),
 * pour que schéma, texte AR et texte EN concordent toujours.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseOpeningHoursEn,
  openingHoursFromConfig,
  FALLBACK_OPENING_HOURS,
} from "../src/lib/opening-hours.ts";

test("parse la config actuelle : Sat - Thu, 9:00 AM - 11:00 PM", () => {
  const spec = parseOpeningHoursEn("Sat - Thu: 9:00 AM - 11:00 PM");
  assert.deepEqual(spec, {
    dayOfWeek: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
    opens: "09:00",
    closes: "23:00",
  });
});

test("plage qui boucle sur le dimanche (ex. Fri - Mon)", () => {
  const spec = parseOpeningHoursEn("Fri - Mon: 8:00 AM - 10:00 PM");
  assert.deepEqual(spec.dayOfWeek, ["Friday", "Saturday", "Sunday", "Monday"]);
  assert.equal(spec.opens, "08:00");
  assert.equal(spec.closes, "22:00");
});

test("format 24h accepté (« 09:00 - 18:00 »), midi/minuit gérés en 12h", () => {
  assert.equal(parseOpeningHoursEn("Mon - Fri: 09:00 - 18:00").closes, "18:00");
  assert.equal(parseOpeningHoursEn("Daily: 12:00 AM - 12:00 PM").opens, "00:00");
  assert.equal(parseOpeningHoursEn("Daily: 12:00 AM - 12:00 PM").closes, "12:00");
  assert.equal(parseOpeningHoursEn("Mon - Sun: 9 AM - 5 PM").opens, "09:00");
  assert.equal(parseOpeningHoursEn("Mon - Sun: 9 AM - 5 PM").closes, "17:00");
});

test("jours isolés et listes (Mon, Wed, Fri)", () => {
  const spec = parseOpeningHoursEn("Mon, Wed, Fri: 9:00 - 17:00");
  assert.deepEqual(spec.dayOfWeek, ["Monday", "Wednesday", "Friday"]);
});

test("texte illisible → null, et openingHoursFromConfig retombe sur le repli explicite", () => {
  assert.equal(parseOpeningHoursEn(""), null);
  assert.equal(parseOpeningHoursEn("sur rendez-vous uniquement"), null);
  assert.equal(parseOpeningHoursEn("Sat - Thu: 9h"), null); // une seule heure
  assert.deepEqual(openingHoursFromConfig("texte illisible"), FALLBACK_OPENING_HOURS);
  // …et la config réelle donne bien la spec parsée (pas le repli).
  const spec = openingHoursFromConfig("Sat - Thu: 9:00 AM - 11:00 PM");
  assert.equal(spec.closes, "23:00");
  assert.equal(spec.opens, "09:00");
  assert.equal(spec.dayOfWeek.length, 6);
});
