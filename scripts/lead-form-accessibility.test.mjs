import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/sections/cta-form.tsx", "utf8");

test("lead form errors are localized and not raw Zod English strings", () => {
  assert.doesNotMatch(source, /min\(2, "Required"\)/);
  assert.doesNotMatch(source, /errors\.\w+\.message<\/p>/);
  for (const key of ["businessMin", "sectorRequired", "needRequired", "budgetRequired", "deadlineRequired", "nameMin", "phoneMin", "emailInvalid"]) {
    assert.ok(source.includes(key), key);
  }
  assert.match(source, /fieldError\(errors\.business\.message\)/);
  assert.match(source, /أدخل اسم النشاط/);
  assert.match(source, /Enter the business name/);
});

test("lead form labels are associated and invalid fields are described", () => {
  for (const field of ["business", "sector", "need", "budget", "deadline", "name", "phone", "email", "message"]) {
    assert.match(source, new RegExp(`htmlFor="lead-${field}"`), field);
    assert.match(source, new RegExp(`id="lead-${field}"`), field);
  }
  for (const field of ["business", "sector", "need", "budget", "deadline", "name", "phone", "email"]) {
    assert.match(source, new RegExp(`aria-invalid=\\{!!errors\\.${field}\\}`), field);
    assert.match(source, new RegExp(`aria-describedby=\\{errors\\.${field} \\? "lead-${field}-error" : undefined\\}`), field);
    assert.match(source, new RegExp(`id="lead-${field}-error" role="alert"`), field);
  }
});

test("lead form default budget matches an existing option and focus moves to first invalid field", () => {
  const defaults = source.match(/defaultValues: \{([^}]+)\}/);
  assert.ok(defaults);
  const budget = defaults[1].match(/budget: "([^"]+)"/);
  assert.ok(budget);
  assert.match(source, new RegExp(`<option value="${budget[1]}">`));
  assert.match(source, /trigger\(fieldsByStep\[step\], \{ shouldFocus: true \}\)/);
});
