#!/usr/bin/env node
/** Read-only interaction smoke test. Run against a local build; no contact sent.
 * GUIDE_BASE_URL=http://localhost:3000 CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node scripts/website-guide-browser.mjs
 * Without an executable override, uses Playwright's installed Chromium.
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const base = process.env.GUIDE_BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
const page = await context.newPage();
const errors = [];
const writes = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url()); });
await context.route(/^https?:\/\//, route => new URL(route.request().url()).host === new URL(base).host ? route.continue() : route.abort());
const guide = page.locator("#website-guide");
const summary = guide.locator("aside");
async function amount(expected) {
  await page.waitForFunction(value => document.querySelector('#website-guide aside [aria-live="polite"]')?.textContent.includes(value), `${expected}.00`);
}
try {
  await page.goto(`${base}/pricing?lang=en`, { waitUntil: "networkidle" });
  await amount(35);
  await guide.getByRole("radio").nth(1).check();
  await guide.locator("#guide-extra-languages").selectOption("1");
  await amount(55);
  assert.match(await summary.innerText(), /Indicative starting estimate/);
  await guide.getByRole("checkbox", { name: /^Online store/ }).check();
  await amount(45);
  assert.match(await summary.innerText(), /not the project total/);
  assert.match(await summary.innerText(), /Scoped with module quote/);
  await guide.getByRole("checkbox", { name: /^Booking management/ }).check();
  await amount(45);
  await guide.locator("#guide-custom-note").fill("Need a custom size selector & filtering");
  const contact = summary.getByRole("link", { name: "Contact us directly with my choices" });
  const url = new URL(await contact.getAttribute("href"));
  assert.equal(url.hostname, "wa.me");
  const text = url.searchParams.get("text");
  assert.match(text, /\$45 USD \+ unpriced options/);
  assert.match(text, /custom size selector & filtering/);
  assert.match(text, /Booking management/);
  assert.match(text, /Online store/);
  await summary.getByRole("button", { name: "Copy request summary" }).click();
  await summary.locator('[role="status"]').filter({ hasText: /paste|unavailable/ }).waitFor();
  await summary.getByText("Preview the message you will send", { exact: true }).click();
  assert.equal(await summary.locator("textarea[readonly]").inputValue(), text);
  await summary.getByRole("button", { name: "Reset", exact: true }).click();
  await amount(35);
  assert.equal(await guide.locator("#guide-extra-languages").inputValue(), "0");
  assert.equal(await guide.locator("#guide-custom-note").inputValue(), "");
  assert.equal(await guide.getByRole("checkbox").evaluateAll(inputs => inputs.some(input => input.checked)), false);
  mkdirSync(".scratch", { recursive: true });
  await guide.evaluate(el => el.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: ".scratch/website-guide-desktop.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/pricing`, { waitUntil: "networkidle" });
  assert.equal(await guide.getAttribute("dir"), "rtl");
  await guide.getByRole("radio").nth(1).check();
  await guide.locator("#guide-extra-languages").selectOption("2");
  await amount(65);
  // Native checkboxes remain keyboard-operable in RTL.
  await guide.getByRole("checkbox").nth(2).focus();
  await page.keyboard.press("Space");
  await amount(55);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, "mobile has no horizontal overflow");
  await guide.evaluate(el => el.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: ".scratch/website-guide-mobile.png" });
  await page.goto(`${base}/creation-sites?lang=en`, { waitUntil: "networkidle" });
  assert.equal(await guide.count(), 1);
  await page.getByRole("navigation", { name: "Your project journey" }).getByRole("link", { name: "1. Choice guide" }).click();
  await page.waitForURL(/#website-guide$/);
  await page.goto(`${base}/demos?lang=en`, { waitUntil: "networkidle" });
  const entry = page.getByRole("link", { name: "Help me choose functions & estimate my budget" });
  assert.match(await entry.getAttribute("href"), /\/pricing\?lang=en#website-guide/);
  assert.deepEqual(writes, [], "guide must not submit contact or payment requests");
  assert.deepEqual(errors, [], "no client runtime errors");
  console.log("PASS: desktop EN + mobile RTL, live estimates, no double charge, custom contact summary, copy/fallback, reset, keyboard, navigation and no writes.");
} finally { await browser.close(); }
