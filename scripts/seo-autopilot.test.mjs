import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

import {
  buildDeterministicAutopilotOverride,
  parseAutopilotDataModule,
  renderAutopilotMarkdownSection,
  runAutopilotOptimization,
  selectAutopilotCandidates,
  serializeAutopilotDataModule,
  validateGeneratedOverride,
} from "./gsc-auto-optimize.mjs";
import { buildLocalizedUrlBatch, mapChangedFilesToPaths } from "./seo-index-ping.mjs";

const outDir = mkdtempSync(join(tmpdir(), "seo-autopilot-"));
after(() => rmSync(outDir, { recursive: true, force: true }));

const outfile = join(outDir, "autopilot.mjs");
await build({
  stdin: {
    contents: `
      export * from "./src/lib/seo-autopilot";
      export { SEO_AUTOPILOT_STATE } from "./src/lib/seo-autopilot-data";
      export { siteConfig } from "./src/lib/config";
      export { pageMetadata } from "./src/lib/seo";
    `,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  plugins: [
    {
      name: "alias",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (args) => ({
          path: resolve("src", args.path.slice(2) + ".ts"),
        }));
      },
    },
  ],
});

const lib = await import(pathToFileURL(outfile).href);

test("SEO_AUTOPILOT_STATE protège les 6 pages optimisées aujourd'hui sous le verrou anti-yo-yo 18j", () => {
  const nowMs = Date.parse("2026-11-26T08:30:00.000Z");
  for (const path of [
    "/pricing",
    "/contact",
    "/abonnements",
    "/demos/al-manhaj-company",
    "/demos/toy-store-tripoly",
    "/demos/pizzeria-forno-tripoli",
  ]) {
    const lock = lib.isUnderAntiYoYoCooldown(path, lib.SEO_AUTOPILOT_STATE, nowMs);
    assert.equal(lock.locked, true, `${path} doit être verrouillé`);
    assert.ok(lock.daysRemaining >= 17, `${path} garde >=17j de stabilisation`);
  }

  // Après 19 jours, le verrou s'ouvre automatiquement
  const laterMs = Date.parse("2026-12-15T08:30:00.000Z");
  const unlocked = lib.isUnderAntiYoYoCooldown("/pricing", lib.SEO_AUTOPILOT_STATE, laterMs);
  assert.equal(unlocked.locked, false);
});

test("isAutopilotEligiblePath exclut l'admin, le paiement et les anciens slugs redirigés en 308", () => {
  assert.equal(lib.isAutopilotEligiblePath("/admin/search-console"), false);
  assert.equal(lib.isAutopilotEligiblePath("/pay/cancel"), false);
  assert.equal(lib.isAutopilotEligiblePath("/livraison/ABC123"), false);
  assert.equal(lib.isAutopilotEligiblePath("/codes/spotify-premium"), false);
  assert.equal(lib.isAutopilotEligiblePath("/codes/playstation-store"), false);
  assert.equal(lib.isAutopilotEligiblePath("/codes/fzr-giftcard-spotify-us"), true);
  assert.equal(lib.isAutopilotEligiblePath("/sectors/stationery"), true);
  assert.equal(lib.isAutopilotEligiblePath("/demos/myphone-tripoli"), true);
});

test("buildDeterministicAutopilotOverride produit des titres <=60 et descriptions <=155 valides sur toutes les familles d'URL", () => {
  const samples = [
    { page: "https://exemple.com/demos/myphone-tripoli", query: "(toutes requêtes cumulées)", reason: "quick_win_page2" },
    { page: "https://exemple.com/sectors/stationery", query: "مواقع قرطاسية", reason: "low_ctr_page1" },
    { page: "https://exemple.com/services/fix-optimize", query: "seo audit", reason: "low_ctr_page1" },
    { page: "https://exemple.com/compare/shopify", query: "shopify vs custom", reason: "quick_win_page2" },
    { page: "https://exemple.com/blog/usdt-guide", query: "دفع USDT", reason: "quick_win_page2" },
    { page: "https://exemple.com/codes/fzr-giftcard-steam-us", query: "steam card", reason: "quick_win_page2" },
    { page: "https://exemple.com/creation-sites", query: "تصميم مواقع", reason: "low_ctr_page1" },
  ];

  for (const sample of samples) {
    const ov = buildDeterministicAutopilotOverride(sample, "2026-11-25T14:00:00.000Z");
    const genCheck = validateGeneratedOverride(ov);
    assert.equal(genCheck.valid, true, `${sample.page}: ${genCheck.errors.join(", ")}`);
    const tsCheck = lib.validateAutopilotOverride(ov);
    assert.equal(tsCheck.valid, true, `${sample.page} TS: ${tsCheck.errors.join(", ")}`);
  }
});

test("runAutopilotOptimization ignore les URL verrouillées ou redirigées et n'optimise que les nouvelles opportunités", async () => {
  const nowMs = Date.parse("2026-11-26T08:30:00.000Z");
  const report = {
    status: "ok",
    lowCtrPage1: [
      // Verrouillée (optimisée le 25/11) → doit être ignorée
      { page: "https://exemple.com/pricing", query: "(all)", position: 7.3, impressions: 47, clicks: 0, ctr: 0 },
      // Nouvelle opportunité Page 1 CTR < 3.5 % avec >= 15 impressions → doit être auto-optimisée !
      { page: "https://exemple.com/sectors/stationery", query: "(all)", position: 7.8, impressions: 22, clicks: 0, ctr: 0 },
    ],
    quickWins: [
      // Ancien slug redirigé 308 → doit être ignoré
      { page: "https://exemple.com/codes/playstation-store", query: "(all)", position: 18.4, impressions: 15, clicks: 0, ctr: 0 },
      // Nouvelle opportunité Page 2 >= 8 impressions → doit être auto-optimisée !
      { page: "https://exemple.com/demos/myphone-tripoli", query: "معرض هواتف", position: 14.2, impressions: 12, clicks: 0, ctr: 0 },
    ],
  };

  const res = await runAutopilotOptimization({
    report,
    state: lib.SEO_AUTOPILOT_STATE,
    nowMs,
    maxUrls: 2,
    useOpenAi: false,
  });

  assert.equal(res.changed, true);
  assert.deepEqual(
    res.optimizedToday.map((x) => x.path),
    ["/sectors/stationery", "/demos/myphone-tripoli"],
  );
  assert.ok(res.skippedCooldown.some((s) => s.path === "/pricing"));

  // Round-trip de sérialisation du module TypeScript
  const serialized = serializeAutopilotDataModule(res.nextState);
  const reparsed = parseAutopilotDataModule(serialized);
  assert.deepEqual(reparsed, res.nextState);
  assert.match(renderAutopilotMarkdownSection(res), /\/sectors\/stationery/);
});

test("pageMetadata applique automatiquement une surcharge valide et rejette toute promesse interdite", () => {
  const bad = {
    titleAr: "موقع تسليم في 7 أيام",
    descriptionAr: "موقع جاهز مع تسليم في 7 أيام ونرد في أقل من ساعتين لجميع العملاء في كل مكان حول العالم.",
    titleEn: "Website delivered in 7 days",
    descriptionEn: "Get your custom website delivered in 7 days and we reply in 2 hours with guaranteed ranking.",
    updatedAt: "2026-11-25T14:00:00.000Z",
  };
  assert.equal(lib.validateAutopilotOverride(bad).valid, false);

  const validSample = buildDeterministicAutopilotOverride(
    { page: "/sectors/stationery", query: "مواقع قرطاسية", reason: "low_ctr_page1" },
    "2026-11-25T14:00:00.000Z",
  );
  const customState = {
    cooldownDays: 18,
    history: {},
    overrides: { "/sectors/stationery": validSample },
  };
  const resolvedAr = lib.resolveAutopilotOverride("/sectors/stationery", "ar", customState);
  assert.ok(resolvedAr);
  assert.match(resolvedAr.title, /مواقع قرطاسية/);
});

test("seo-index-ping détecte les routes modifiées et construit le lot AR + EN + sitemap + llms.txt", () => {
  const mapped = mapChangedFilesToPaths(
    ["src/app/(site)/pricing/page.tsx", "src/lib/seo-autopilot-data.ts"],
    { overrides: { "/sectors/stationery": {} } },
  );
  assert.equal(mapped.seoTouched, true);
  assert.ok(mapped.paths.includes("/pricing"));
  assert.ok(mapped.paths.includes("/sectors/stationery"));

  const batch = buildLocalizedUrlBatch("https://exemple.com", ["/pricing"]);
  assert.ok(batch.includes("https://exemple.com/pricing"));
  assert.ok(batch.includes("https://exemple.com/pricing?lang=en"));
  assert.ok(batch.includes("https://exemple.com/sitemap.xml"));
  assert.ok(batch.includes("https://exemple.com/llms.txt"));

  const wfPing = readFileSync(".github/workflows/seo-index-ping.yml", "utf8");
  assert.match(wfPing, /seo-index-ping\.mjs/);
  const wfGsc = readFileSync(".github/workflows/gsc-monitor.yml", "utf8");
  assert.match(wfGsc, /gsc-auto-optimize\.mjs/);
});
