#!/usr/bin/env node
/**
 * Tests du blog / guides (`src/lib/blog.ts` + `src/lib/blog-articles.ts`).
 *
 * Vérifie la qualité éditoriale minimale (titres, descriptions, réponse
 * directe, FAQ, dates), les données structurées BlogPosting / CollectionPage,
 * le maillage interne et l'intégration dans les flux IA (`llms.txt`,
 * `llms-full.txt`). Aucun appel réseau.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "blog-"));

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
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
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
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const {
  articlePath,
  findArticle,
  sortArticles,
  relatedArticles,
  articleWordCount,
  articleJsonLd,
  articleFaqJsonLd,
  blogCollectionJsonLd,
  formatArticleDate,
} = await compileModule("lib/blog.ts", "blog.mjs");

const { blogArticles } = await compileModule("lib/blog-articles.ts", "articles.mjs");
const { siteConfig } = await compileModule("lib/config.ts", "config.mjs");
const { buildLlmsTxt, buildLlmsFullTxt } = await compileModule(
  "lib/llms-txt.ts",
  "llms.mjs",
);
const {
  demos: defaultDemos,
  faqs: defaultFaqs,
  testimonials: defaultTestimonials,
  heroContent: defaultHero,
  servicesRibbonContent: defaultRibbon,
  defaultWhyUs,
  defaultProcess,
  defaultSectionHeadings,
  defaultHomeLayout,
  defaultAppsPage,
  defaultProductsPage,
} = await compileModule("lib/content.ts", "content.mjs");

/** Contenu par défaut assemblé comme le fait `getSiteDataCached()` sans base. */
const content = {
  demos: defaultDemos,
  faqs: defaultFaqs,
  testimonials: defaultTestimonials,
  hero: defaultHero,
  ribbon: defaultRibbon,
  whyUs: defaultWhyUs,
  process: defaultProcess,
  headings: defaultSectionHeadings,
  layout: defaultHomeLayout,
  appsPage: defaultAppsPage,
  productsPage: defaultProductsPage,
};

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

test("au moins 5 guides, slugs uniques et URL canoniques cohérentes", () => {
  assert.ok(blogArticles.length >= 5);
  const slugs = blogArticles.map((article) => article.slug);
  assert.equal(new Set(slugs).size, slugs.length, "slugs dupliqués");
  for (const slug of slugs) {
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `slug invalide : ${slug}`);
    assert.equal(articlePath(slug), `/blog/${slug}`);
  }
  assert.equal(findArticle(blogArticles, "inconnu"), null);
});

test("qualité éditoriale : titres, descriptions, réponse directe bilingue", () => {
  for (const article of blogArticles) {
    assert.ok(article.titleAr.length >= 25, `${article.slug}: titleAr trop court`);
    assert.ok(article.titleAr.length <= 80, `${article.slug}: titleAr > 80 car.`);
    assert.ok(article.titleEn.length >= 20, `${article.slug}: titleEn trop court`);
    assert.ok(
      article.descriptionAr.length >= 80 && article.descriptionAr.length <= 180,
      `${article.slug}: descriptionAr hors fourchette (${article.descriptionAr.length})`,
    );
    assert.ok(
      article.descriptionEn.length >= 80 && article.descriptionEn.length <= 180,
      `${article.slug}: descriptionEn hors fourchette (${article.descriptionEn.length})`,
    );
    assert.ok(article.answerAr.length >= 140, `${article.slug}: réponse AR trop courte`);
    assert.ok(article.answerEn.length >= 120, `${article.slug}: réponse EN trop courte`);
    assert.ok(article.readingMinutes >= 3 && article.readingMinutes <= 20);
    assert.ok(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug));
    assert.ok(article.keywordsAr.length >= 3 && article.keywordsEn.length >= 3);
    assert.ok(article.keyFacts.length >= 3, `${article.slug}: faits clés insuffisants`);
    assert.ok(article.authorAr && article.authorEn);
  }
});

test("dates valides et cohérentes (updatedAt ≥ publishedAt)", () => {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  for (const article of blogArticles) {
    assert.match(article.publishedAt, iso);
    assert.match(article.updatedAt, iso);
    assert.ok(article.updatedAt >= article.publishedAt, `${article.slug}: dates incohérentes`);
    assert.ok(!Number.isNaN(Date.parse(article.publishedAt)));
  }
});

test("sections : ancres uniques, contenu AR et EN dans chaque section", () => {
  for (const article of blogArticles) {
    assert.ok(article.sections.length >= 4, `${article.slug}: moins de 4 sections`);
    const ids = article.sections.map((section) => section.id);
    assert.equal(new Set(ids).size, ids.length, `${article.slug}: ancres dupliquées`);
    for (const section of article.sections) {
      assert.match(section.id, /^[a-z0-9-]+$/);
      assert.ok(section.headingAr.length > 5 && section.headingEn.length > 5);
      assert.ok(section.paragraphsAr.length >= 1, `${article.slug}#${section.id}: pas de texte AR`);
      assert.ok(section.paragraphsEn.length >= 1, `${article.slug}#${section.id}: pas de texte EN`);
      assert.equal(
        section.paragraphsAr.length,
        section.paragraphsEn.length,
        `${article.slug}#${section.id}: paragraphes AR/EN déséquilibrés`,
      );
      if (section.bulletsAr) {
        assert.equal(
          section.bulletsAr.length,
          section.bulletsEn?.length,
          `${article.slug}#${section.id}: puces AR/EN déséquilibrées`,
        );
      }
    }
  }
});

test("FAQ : au moins 3 questions, réponses bilingues substantielles", () => {
  for (const article of blogArticles) {
    assert.ok(article.faqs.length >= 3, `${article.slug}: FAQ trop courte`);
    for (const faq of article.faqs) {
      assert.ok(faq.qAr && faq.qEn && faq.aAr && faq.aEn);
      assert.ok(faq.aAr.length >= 70, `${article.slug}: réponse FAQ AR trop courte`);
      assert.ok(faq.aEn.length >= 60, `${article.slug}: réponse FAQ EN trop courte`);
    }
  }
});

test("maillage : services et secteurs référencés existent réellement", () => {
  const serviceIds = new Set(siteConfig.standaloneServices.map((service) => service.id));
  for (const article of blogArticles) {
    assert.ok(
      (article.relatedServices ?? []).length >= 1,
      `${article.slug}: aucun service lié`,
    );
    for (const id of article.relatedServices ?? []) {
      assert.ok(serviceIds.has(id), `${article.slug}: service inconnu « ${id} »`);
    }
    const sectorIds = new Set(content.demos.map((demo) => demo.sector));
    for (const id of article.relatedSectors ?? []) {
      assert.ok(sectorIds.has(id), `${article.slug}: secteur inconnu « ${id} »`);
    }
  }
});

test("formatArticleDate est déterministe en AR et EN", () => {
  assert.equal(formatArticleDate("2026-10-20", "ar"), "20 أكتوبر 2026");
  assert.equal(formatArticleDate("2026-10-20", "en"), "20 October 2026");
  assert.equal(formatArticleDate("2026-01-05", "en"), "5 January 2026");
});

test("BlogPosting expose dates, auteur, éditeur, speakable et wordCount", () => {
  const article = blogArticles[0];
  const schema = articleJsonLd(siteConfig, article);
  assert.equal(schema["@type"], "BlogPosting");
  assert.equal(schema.url, `${siteConfig.url}/blog/${article.slug}`);
  assert.equal(schema.datePublished, article.publishedAt);
  assert.equal(schema.dateModified, article.updatedAt);
  assert.equal(schema.author["@id"], `${siteConfig.url}/#organization`);
  assert.equal(schema.publisher["@id"], `${siteConfig.url}/#organization`);
  assert.equal(schema.isPartOf["@id"], `${siteConfig.url}/#website`);
  assert.equal(schema.mainEntityOfPage["@type"], "WebPage");
  assert.equal(schema.speakable["@type"], "SpeakableSpecification");
  assert.deepEqual(schema.speakable.cssSelector, ["h1", "#article-answer"]);
  assert.ok(Array.isArray(schema.image) && schema.image.length > 0);
  assert.equal(schema.wordCount, articleWordCount(article));
  assert.ok(schema.wordCount > 400, "un guide doit contenir un contenu substantiel");
  assert.equal(schema.timeRequired, `PT${article.readingMinutes}M`);
});

test("FAQPage de l'article reprend toutes les questions bilingues", () => {
  const article = blogArticles[1];
  const schema = articleFaqJsonLd(article);
  assert.equal(schema["@type"], "FAQPage");
  assert.equal(schema.mainEntity.length, article.faqs.length);
  for (const question of schema.mainEntity) {
    assert.equal(question["@type"], "Question");
    assert.ok(question.name.length > 5);
    assert.ok(question.acceptedAnswer.text.includes(" — "));
  }
});

test("CollectionPage du hub : ordre antéchronologique et ItemList complet", () => {
  const schema = blogCollectionJsonLd(siteConfig, blogArticles);
  assert.equal(schema["@type"], "CollectionPage");
  assert.equal(schema.url, `${siteConfig.url}/blog`);
  assert.equal(schema.numberOfItems, blogArticles.length);
  assert.equal(schema.mainEntity.numberOfItems, blogArticles.length);
  const sorted = sortArticles(blogArticles);
  schema.mainEntity.itemListElement.forEach((item, index) => {
    assert.equal(item.position, index + 1);
    assert.equal(item.url, `${siteConfig.url}/blog/${sorted[index].slug}`);
  });
});

test("relatedArticles exclut l'article courant et respecte la limite", () => {
  const current = blogArticles[0];
  const related = relatedArticles(blogArticles, current, 3);
  assert.equal(related.length, Math.min(3, blogArticles.length - 1));
  assert.ok(related.every((article) => article.slug !== current.slug));
  assert.equal(new Set(related.map((article) => article.slug)).size, related.length);
});

test("les guides sont synchronisés dans /llms.txt et /llms-full.txt", () => {
  const data = { config: siteConfig, content };
  const llms = buildLlmsTxt(data);
  const llmsFull = buildLlmsFullTxt(data);
  assert.ok(llms.includes("/blog"));
  assert.ok(llmsFull.includes("7e. Blog & Editorial Guides"));
  for (const article of blogArticles) {
    const path = `/blog/${article.slug}`;
    assert.ok(llms.includes(path), `llms.txt doit contenir ${path}`);
    assert.ok(llmsFull.includes(path), `llms-full.txt doit contenir ${path}`);
    assert.ok(
      llmsFull.includes(article.answerEn.slice(0, 60)),
      `llms-full.txt doit publier la réponse directe de ${article.slug}`,
    );
  }
});
