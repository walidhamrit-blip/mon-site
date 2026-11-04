import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("public header stays sticky and publishes its height for secondary sticky bars", () => {
  const navbar = read("src/components/navbar.tsx");
  assert.match(navbar, /public-header sticky top-0 z-50/);
  assert.match(navbar, /--public-header-height/);
  assert.match(navbar, /ResizeObserver/);
});

test("website creation keeps a sticky anchor nav and anchor targets clear the sticky bars", () => {
  const view = read("src/components/website-creation-view.tsx");
  const nav = read("src/components/creation-anchor-nav.tsx");
  const css = read("src/app/globals.css");
  assert.match(view, /<CreationAnchorNav \/>/);
  assert.match(nav, /sticky top-\[var\(--public-header-height/);
  for (const href of ["#pricing", "#demos", "#website-process", "#lead-form"]) {
    assert.ok(nav.includes(href), href);
  }
  assert.match(css, /#pricing,\s*#demos,\s*#website-process,\s*#lead-form/);
  assert.match(css, /scroll-margin-top: calc\(var\(--public-header-height/);
});

test("back-to-top is discreet, opposite the commercial floats, and hidden with the mobile menu", () => {
  const layout = read("src/app/(site)/layout.tsx");
  const widgets = read("src/components/floating-widgets.tsx");
  const component = read("src/components/back-to-top.tsx");
  const css = read("src/app/globals.css");
  assert.match(layout, /<FloatingWidgets \/>/);
  assert.match(widgets, /<BackToTop \/>/);
  assert.match(widgets, /role="complementary"/);
  assert.match(component, /back-to-top/);
  assert.match(component, /start-5/);
  assert.match(component, /window\.scrollY > 640/);
  assert.match(component, /prefers-reduced-motion/);
  assert.match(css, /html\[data-mobile-menu="open"\] \.back-to-top/);
});

test("store filter bar and rail sit below the sticky public header", () => {
  const catalog = read("src/components/digital-catalog.tsx");
  assert.match(catalog, /sticky top-\[var\(--public-header-height/);
  assert.match(catalog, /lg:top-\[calc\(var\(--public-header-height/);
});

test("visible link text is not overridden by a shorter accessible name", () => {
  const navbar = read("src/components/navbar.tsx");
  const catalog = read("src/components/digital-catalog.tsx");
  assert.doesNotMatch(navbar, /aria-label=\{siteConfig\.name\}/);
  assert.doesNotMatch(catalog, /aria-label=\{displayName\(product\)\}/);
});
