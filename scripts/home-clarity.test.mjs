import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("homepage explains the offer before the visual banner with a visible H1 and two clear CTAs", () => {
  const sections = read("src/components/sections/home-sections.tsx");
  const intro = read("src/components/sections/home-intro.tsx");
  const hero = read("src/components/sections/hero.tsx");
  const introIndex = sections.indexOf("<HomeIntro />");
  const heroIndex = sections.indexOf("<Hero />");
  assert.ok(introIndex > 0 && heroIndex > introIndex);
  assert.match(intro, /<h1/);
  assert.doesNotMatch(intro, /sr-only/);
  assert.match(intro, /href="\/codes"/);
  assert.match(intro, /href="\/creation-sites"/);
  assert.doesNotMatch(hero, /<h1/);
});

test("homepage banner is shorter so the offer and gateway appear sooner", () => {
  const globals = read("src/app/globals.css");
  const gaming = read("src/app/gaming.css");
  assert.match(globals, /height: clamp\(240px, 30vw, 520px\)/);
  assert.match(globals, /\.panoramic-hero \{ height: 240px; \}/);
  assert.match(gaming, /height: clamp\(260px, 32vw, 560px\)/);
  assert.match(gaming, /\.public-shell \.panoramic-hero \{ height: 260px; \}/);
});
