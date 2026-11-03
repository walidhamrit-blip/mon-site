#!/usr/bin/env node
/**
 * Tests du bilinguisme AR/EN des pages principales — `node:test`.
 *
 * Le site sert une seule version par URL : la version anglaise ne doit
 * JAMAIS laisser fuir de l'arabe, et la version arabe doit rester
 * réellement en arabe. Ces tests verrouillent cet invariant sur les
 * jeux de libellés partagés (`src/lib/i18n.tsx`) et sur les composants
 * client des pages concernées.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "bilingual-pages-"));

const aliasPlugin = {
  name: "alias-at-src",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => {
      const base = join(srcRoot, args.path.slice(2));
      const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        join(base, "index.ts"),
        join(base, "index.tsx"),
      ];
      const found = candidates.find(
        (candidate) =>
          existsSync(candidate) &&
          readFileSync(candidate, "utf8").length > 0,
      );
      return { path: found ?? base };
    });
  },
};

async function compileModule(relPath, outName) {
  const outfile = join(outDir, outName);
  await build({
    entryPoints: [join(srcRoot, relPath)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    plugins: [aliasPlugin],
    jsx: "automatic",
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const AR = /[\u0600-\u06FF]/;

/** Jeux de libellés partagés : un objet `{ xxxAr, xxxEn }` par libellé. */
const LABEL_SETS = [
  ["compareLabels", "comparaisons"],
  ["servicesHubLabels", "hub des services"],
  ["serviceDetailLabels", "fiche service"],
  ["sectorsLabels", "hub des secteurs"],
  ["sectorDetailLabels", "fiche secteur"],
  ["pricingTableLabels", "tableau des prix"],
];

test("chaque jeu de libellés expose des paires Ar/En complètes", async () => {
  const i18n = await compileModule("lib/i18n.tsx", "i18n.mjs");
  for (const [name, label] of LABEL_SETS) {
    const set = i18n[name];
    assert.ok(set, `le jeu de libellés « ${name} » (${label}) est exporté`);
    const keys = Object.keys(set);
    assert.ok(keys.length > 0, `« ${name} » contient des libellés`);
    for (const key of keys) {
      assert.ok(
        key.endsWith("Ar") || key.endsWith("En"),
        `« ${name }.${key} » doit se terminer par Ar ou En`,
      );
      const twin = key.endsWith("Ar")
        ? `${key.slice(0, -2)}En`
        : `${key.slice(0, -2)}Ar`;
      assert.ok(
        Object.hasOwn(set, twin),
        `« ${name }.${key} » a besoin de son jumeau « ${twin} »`,
      );
      for (const k of [key, twin]) {
        const value = set[k];
        assert.equal(
          typeof value,
          "string",
          `« ${name }.${k} » doit être une chaîne`,
        );
        assert.ok(value.trim().length > 0, `« ${name }.${k} » ne peut pas être vide`);
      }
    }
  }
});

test("aucun libellé anglais ne contient de l'arabe", async () => {
  const i18n = await compileModule("lib/i18n.tsx", "i18n.mjs");
  const offenders = [];
  for (const [name] of LABEL_SETS) {
    for (const [key, value] of Object.entries(i18n[name])) {
      if (!key.endsWith("En")) continue;
      if (AR.test(value)) offenders.push(`${name}.${key} → ${value}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `des libellés « En » contiennent de l'arabe :\n${offenders.join("\n")}`,
  );
});

test("chaque libellé arabe contient bien de l'arabe", async () => {
  const i18n = await compileModule("lib/i18n.tsx", "i18n.mjs");
  const offenders = [];
  for (const [name] of LABEL_SETS) {
    for (const [key, value] of Object.entries(i18n[name])) {
      if (!key.endsWith("Ar")) continue;
      if (!AR.test(value)) offenders.push(`${name}.${key} → ${value}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `des libellés « Ar » ne contiennent pas d'arabe :\n${offenders.join("\n")}`,
  );
});

test("les gabarits remplacent leurs jetons {…}", async () => {
  const tpl = await compileModule("lib/text-template.tsx", "text-template.mjs");
  assert.equal(
    tpl.fillTemplate("ماذا يشمل موقع {label} من نخبة؟", { label: "عيادات" }),
    "ماذا يشمل موقع عيادات من نخبة؟",
  );
  assert.equal(
    tpl.fillTemplate("What a {label} website includes", { label: "clinic" }),
    "What a clinic website includes",
  );
  assert.equal(
    tpl.fillTemplate("{a} puis {b}", { a: "1", b: "2" }),
    "1 puis 2",
  );
});

test("les pages bilingues s'appuient sur un gabarit partagé", () => {
  // Un seul helper de gabarit : plus de copie locale qui diverge.
  const shared = readFileSync(join(srcRoot, "lib/text-template.tsx"), "utf8");
  assert.match(shared, /export function renderTemplate/);
  assert.match(shared, /export function fillTemplate/);

  const views = [
    "components/services-hub-view.tsx",
    "components/service-detail-view.tsx",
    "components/sectors-hub-view.tsx",
    "components/sector-detail-view.tsx",
    "components/comparison-view.tsx",
  ];
  for (const view of views) {
    const source = readFileSync(join(srcRoot, view), "utf8");
    assert.ok(
      !/const renderTemplate\s*=/.test(source),
      `${view} ne doit plus redéfinir renderTemplate`,
    );
  }
});

test("les vues client des pages bilingues existent", () => {
  const views = [
    "components/services-hub-view.tsx",
    "components/service-detail-view.tsx",
    "components/sectors-hub-view.tsx",
    "components/sector-detail-view.tsx",
    "components/comparison-hub-view.tsx",
    "components/comparison-view.tsx",
  ];
  for (const view of views) {
    assert.ok(existsSync(join(srcRoot, view)), `${view} est présent`);
  }
});

test("les coquilles serveur des pages bilingues restent côté serveur", () => {
  const pages = [
    "app/(site)/services/[service]/page.tsx",
    "app/(site)/sectors/page.tsx",
    "app/(site)/sectors/[sector]/page.tsx",
  ];
  for (const page of pages) {
    const source = readFileSync(join(srcRoot, page), "utf8");
    assert.ok(
      !/^"use client"/m.test(source),
      `${page} ne doit pas être un composant client`,
    );
    assert.match(
      source,
      /generateMetadata|siteLocale/,
      `${page} expose des métadonnées locales`,
    );
  }
});

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

// ── A08 : routes anglaises réelles, URL autoritaire ────────────────────────
test("A08 : localizedPath conserve le chemin, les paramètres et les ancres", async () => {
  const { localizedPath, languageAlternates } = await compileModule("lib/locale.ts", "locale.mjs");
  assert.equal(localizedPath("/pricing", "ar"), "/pricing");
  assert.equal(localizedPath("/pricing", "en"), "/pricing?lang=en");
  assert.equal(localizedPath("/codes?kind=gift_card#buy", "en"), "/codes?kind=gift_card&lang=en#buy");
  assert.equal(localizedPath("/codes?lang=en&kind=gift_card", "ar"), "/codes?kind=gift_card");
  assert.equal(localizedPath("/codes?lang=ar", "en"), "/codes?lang=en");
  assert.equal(localizedPath("/#lead-form", "en"), "/?lang=en#lead-form");
  assert.equal(localizedPath("https://example.com/x", "en"), "https://example.com/x");
  assert.equal(localizedPath("/admin/orders", "en"), "/admin/orders");
  assert.equal(localizedPath("/api/lead", "en"), "/api/lead");
  assert.equal(localizedPath("/live-demos/x/index.html", "en"), "/live-demos/x/index.html");

  const alternates = languageAlternates("https://nokhba.net.ly/", "/services/restyle");
  assert.deepEqual(alternates, {
    ar: "https://nokhba.net.ly/services/restyle",
    en: "https://nokhba.net.ly/services/restyle?lang=en",
    "x-default": "https://nokhba.net.ly/services/restyle",
  });
});

test("A08 : la langue par défaut admin reste l'URL propre, l'autre langue porte ?lang", async () => {
  const { localizedPath, languageAlternates } = await compileModule("lib/locale.ts", "locale.mjs");
  assert.equal(localizedPath("/pricing", "en", "en"), "/pricing");
  assert.equal(localizedPath("/pricing", "ar", "en"), "/pricing?lang=ar");
  assert.deepEqual(languageAlternates("https://example.com", "/pricing", "en"), {
    ar: "https://example.com/pricing?lang=ar",
    en: "https://example.com/pricing",
    "x-default": "https://example.com/pricing",
  });
});

test("A08 : le script de démarrage ne remplace jamais la langue de l'URL", async () => {
  const { localeBootScript } = await compileModule("lib/locale.ts", "locale.mjs");
  const forced = localeBootScript("ar", "en");
  assert.match(forced, /var forced="en"/);
  assert.match(forced, /var l=forced/);
  const fallback = localeBootScript("ar", null);
  assert.match(fallback, /var forced=null/);
});

test("A08 : le sélecteur produit de vrais href localisés, pas un simple état client", () => {
  const source = readFileSync(join(srcRoot, "components/locale-switcher.tsx"), "utf8");
  assert.match(source, /<Link/);
  assert.match(source, /href=\{localizedPath\(currentPath, item\.id, defaultLocale\)\}/);
  assert.match(source, /hrefLang=\{item\.id\}/);
  assert.match(source, /router\.replace\(localizedPath\(currentPath, item\.id, defaultLocale\)/);
  assert.doesNotMatch(source, /setLocale\(item\.id/);
});

test("A08 : les liens internes publics conservent la langue via LocalizedLink", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx") && entry.name !== "localized-link.tsx" && entry.name !== "locale-switcher.tsx") {
        const source = readFileSync(full, "utf8");
        if (/import Link from "next\/link"/.test(source)) offenders.push(full);
      }
    }
  };
  walk(join(srcRoot, "components"));
  walk(join(srcRoot, "app/(site)"));
  assert.deepEqual(offenders, [], `liens non localisés : ${offenders.join(", ")}`);
});

test("A08 : chaque page publique indexable lit la langue de l'URL côté serveur", () => {
  const pages = [
    "app/(site)/page.tsx",
    "app/(site)/creation-sites/page.tsx",
    "app/(site)/codes/page.tsx",
    "app/(site)/codes/[slug]/page.tsx",
    "app/(site)/demos/page.tsx",
    "app/(site)/demos/[slug]/page.tsx",
    "app/(site)/services/page.tsx",
    "app/(site)/services/[service]/page.tsx",
    "app/(site)/pricing/page.tsx",
    "app/(site)/sectors/page.tsx",
    "app/(site)/sectors/[sector]/page.tsx",
    "app/(site)/blog/page.tsx",
    "app/(site)/blog/[slug]/page.tsx",
    "app/(site)/compare/page.tsx",
    "app/(site)/compare/[slug]/page.tsx",
    "app/(site)/products/page.tsx",
    "app/(site)/apps/page.tsx",
    "app/(site)/abonnements/page.tsx",
    "app/(site)/contact/page.tsx",
    "app/(site)/badge/page.tsx",
    "app/(site)/remboursement/page.tsx",
    "app/(site)/conditions/page.tsx",
  ];
  for (const page of pages) {
    const source = readFileSync(join(srcRoot, page), "utf8");
    assert.match(source, /generateMetadata\(\{ searchParams \}|searchParams,\n/, `${page} reçoit searchParams`);
    assert.match(source, /pageLocale\(config, searchParams\)/, `${page} résout la langue depuis l'URL`);
    assert.match(source, /pageMetadata\(config, \{\n\s*locale,/, `${page} transmet la langue aux métadonnées`);
  }
});
