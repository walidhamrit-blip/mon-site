#!/usr/bin/env node
/** Read-only commercial-content smoke test of a running build. No checkout or payments.
 * node scripts/audit-website-content.mjs [http://localhost:3000]
 * Digital stock/product pages are excluded: they need the live database/supplier.
 */
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3000";
const sitemap = await fetch(`${base}/sitemap.xml`).then(r => {
  assert.equal(r.status, 200, "sitemap"); return r.text();
});
const paths = new Set(["/", "/pricing", "/creation-sites", "/abonnements", "/conditions", "/remboursement"]);
for (const match of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)) {
  const url = new URL(match[1].replaceAll("&amp;", "&"));
  if (!/^\/(?:codes|admin|api)(?:\/|$)/.test(url.pathname)) paths.add(url.pathname);
}
const tasks = [...paths].flatMap(path => ["ar", "en"].map(lang => ({path, lang})));
for (const path of ["/llms.txt", "/llms-full.txt"]) tasks.push({path, lang: "en"});
const failures = [];
let passed = 0;
const forbidden = /delivered in 7 days|7-day delivery|Your site ready in 7 days|تسليم في 7 أيام|goes live in 7 to 14 days|saves about two months|never store (?:your )?(?:wallet|payment) data|Includes 1 year ultra-fast hosting|We reply in 2 hours|we reply within 2 hours|نرد في أقل من ساعتين|Open now · fast reply|bank transfer on request/i;
async function worker() {
  while (tasks.length) {
    const {path, lang} = tasks.shift();
    const target = `${path}?lang=${lang}`;
    try {
      const res = await fetch(base + target, {signal: AbortSignal.timeout(30000)});
      assert.equal(res.status, 200, `${target}: HTTP status`);
      const html = await res.text();
      // Inspect visible/semantic content, not the RSC serialization of imported modules.
      const text = html.replace(/<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/g, "")
        .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
      assert.doesNotMatch(text, forbidden, target);
      if (["/pricing", "/creation-sites"].includes(path)) {
        assert.match(text, /35/, `${target}: base price`);
        assert.match(text, /10/, `${target}: optional modules`);
        assert.match(text, /Vercel/, `${target}: deployment limits`);
      }
      if (path === "/abonnements" && lang === "en") {
        assert.match(text, /Optional maintenance/);
        assert.match(text, /existing website/);
        assert.doesNotMatch(text, /Full store or booking system with dashboard|5-page showcase site|Up to 10 pages/);
      }
      if (path.startsWith("/sectors/") && lang === "en") {
        assert.match(text, /not everything included in the base price/);
      }
      if (path === "/contact" || path === "/llms.txt" || path === "/llms-full.txt") {
        assert.match(text, lang === "ar" ? /22:00/ : /10:00 PM/, `${target}: closing at 22:00`);
      }
      if (path === "/llms-full.txt") {
        assert.match(text, /One offer at \$35/);
        assert.match(text, /never charged twice/);
      }
      passed++;
    } catch (error) { failures.push(`${target}: ${error.message}`); }
  }
}
await Promise.all(Array.from({length: 4}, worker));
console.log(`${passed} checks passed across ${paths.size} website routes in AR/EN + 2 AI indexes; ${failures.length} failed.`);
for (const failure of failures) console.error(failure);
if (failures.length) process.exitCode = 1;
