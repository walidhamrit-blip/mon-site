import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { assertLegacySupplierActive } from "../src/lib/retired-supplier.ts";

const read = (path) => readFileSync(path, "utf8");
mkdirSync(".scratch", { recursive: true });
const dir = mkdtempSync(join(process.cwd(), ".scratch/retired-supplier-"));
after(() => rmSync(dir, { recursive: true, force: true }));
const outfile = join(dir, "orders.cjs");
await build({
  entryPoints: ["src/lib/digital-orders.ts"], outfile, bundle: true,
  platform: "node", format: "cjs", packages: "external", jsx: "automatic",
  plugins: [{ name: "no-database", setup(builder) {
    builder.onResolve({ filter: /^@\/db$/ }, () => ({ path: "db", namespace: "test-db" }));
    builder.onLoad({ filter: /.*/, namespace: "test-db" }, () => ({ loader: "js", contents: `
      export async function ensureSchema() {}
      export const db = { select() { return { from() { return { where() { return { async limit() { return globalThis.__retiredRows || []; } }; } }; } }; } };
    ` }));
  } }],
});
const orders = createRequire(import.meta.url)(outfile);

test("retirement is permanent and does not depend on credentials", () => {
  assert.throws(assertLegacySupplierActive, /fournisseur a été retiré/);
});

test("legacy checkout is rejected before any IO or payment", async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("Unexpected network"); };
  try {
    await assert.rejects(orders.createDigitalCheckout({}, new Request("https://example.com")), (error) => error.code === "supplier_retired" && error.status === 410);
    assert.equal(requests, 0);
  } finally { globalThis.fetch = original; }
});

test("a forced retry of a legacy order cannot purchase or change supplier", async () => {
  globalThis.__retiredRows = [{ id: 1, ref: "ARCHIVE-1", productSlug: "legacy-card", productId: "old", status: "paid" }];
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("Unexpected network"); };
  try {
    const result = await orders.deliverPaidDigitalOrder("ARCHIVE-1", { force: true });
    assert.equal(result.outcome, "manual");
    assert.match(result.message, /fournisseur a été retiré/);
    assert.equal(requests, 0);
    globalThis.__retiredRows[0].status = "delivered";
    assert.equal((await orders.deliverPaidDigitalOrder("ARCHIVE-1")).outcome, "already_delivered");
  } finally { globalThis.fetch = original; delete globalThis.__retiredRows; }
});

test("retired admin APIs preserve authentication and return Gone without integrations", () => {
  for (const path of ["reloadly/products", "digital/sync", "digital/recalc"]) {
    const source = read(`src/app/api/admin/${path}/route.ts`);
    assert.match(source, /await isAdminAuthenticated\(\)/);
    assert.match(source, /status: 401/);
    assert.match(source, /status: 410/);
    assert.doesNotMatch(source, /fetch\(|from "@\/lib\/(reloadly|digital-sync|digital-audit)"/);
  }
});

test("active admin and health no longer load legacy integration panels", () => {
  for (const path of ["src/app/admin/(panel)/digital/page.tsx", "src/app/admin/(panel)/digital/orders/page.tsx", "src/app/admin/(panel)/system-health.tsx", "src/app/api/health/route.ts"]) {
    assert.doesNotMatch(read(path), /ReloadlySync|reloadlyMode|checkReloadlyCredentials|environmentMismatch/);
  }
  assert.doesNotMatch(read("scripts/check-setup.mjs"), /auth\.reloadly|RELOADLY_CLIENT_ID|reloadlyBase/);
  const resume = read("src/lib/digital-resume.ts");
  assert.match(resume, /return false; \/\/ Fournisseur historique retiré/);
  assert.doesNotMatch(resume, /import.*reloadly/);
});
