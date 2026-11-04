import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("header language, currency, theme, mode and menu controls use 44px touch targets", () => {
  const navbar = read("src/components/navbar.tsx");
  assert.match(navbar, /grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-\[var\(--secondary\)\]/);
  assert.match(navbar, /grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-\[var\(--primary\)\]/);
  assert.match(read("src/components/locale-switcher.tsx"), /inline-flex h-11 cursor-pointer/);
  assert.match(read("src/components/currency-switcher.tsx"), /inline-flex h-11 cursor-pointer/);
  assert.match(read("src/components/theme-switcher.tsx"), /grid h-11 w-11 cursor-pointer/);
  assert.match(read("src/app/globals.css"), /\.public-header \.primary-menu a \{ min-height: 44px;/);
});

test("chatbot close, restart, input and send controls are at least 44px", () => {
  const chatbot = read("src/components/site-chatbot.tsx");
  const headerControls = [...chatbot.matchAll(/className="grid h-11 w-11 place-items-center rounded-full opacity-70/g)];
  assert.equal(headerControls.length, 2);
  assert.match(chatbot, /className="h-11 min-w-0 flex-1 rounded-full/);
  assert.match(chatbot, /grid h-11 w-11 shrink-0 place-items-center rounded-full bg-\[var\(--accent\)\]/);
});

test("store filters, sort and product details keep readable labels and 44px targets", () => {
  const catalog = read("src/components/digital-catalog.tsx");
  assert.match(catalog, /inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1\.5 rounded-full border/);
  assert.match(catalog, /flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg/);
  assert.match(catalog, /h-11 cursor-pointer appearance-none rounded-full border border-\[var\(--border\)\]/);
  assert.match(catalog, /text-\[12px\] font-bold uppercase tracking-wide/);
  assert.match(catalog, /inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1 rounded-full bg-\[var\(--primary\)\]/);
});
