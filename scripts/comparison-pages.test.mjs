#!/usr/bin/env node
/**
 * Tests du moteur de pages comparatives (/compare et /compare/[slug]) —
 * `node:test`.
 *
 * Vérifie que le SEO comparatif reste programmable ET sain :
 *   - chaque comparaison a un contenu éditorial complet (titres, réponses,
 *     points, critères, FAQ) dans les fourchettes Google ;
 *   - les titres et descriptions sont uniques (pas de cannibalisation) ;
 *   - les schémas JSON-LD sont valides (Service + Offer, ItemList, FAQPage,
 *     CollectionPage) et cohérents avec les données ;
 *   - le maillage interne (comparaisons liées, services liés) est résolvable ;
 *   - les jetons de marché {city} / {cityEn} sont résolus partout.
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
const outDir = mkdtempSync(join(tmpdir(), "comparison-pages-"));

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

const { siteConfig } = await compileModule("lib/config.ts", "config.mjs");
const {
  comparisons,
  comparisonIds,
  comparisonCriteriaJsonLd,
  comparisonFaqJsonLd,
  comparisonServiceJsonLd,
  comparisonsCollectionJsonLd,
  comparisonsHubFaqs,
  comparisonText,
  comparePath,
  getComparison,
  relatedComparisons,
} = await compileModule("lib/comparisons.ts", "comparisons.mjs");

/** Résolution des jetons de marché, comme le fait `pageMetadata`. */
const resolveTokens = (text) =>
  text
    .replaceAll("{city}", "طرابلس")
    .replaceAll("{country}", "ليبيا")
    .replaceAll("{cityEn}", "Tripoli")
    .replaceAll("{countryEn}", "Libya");

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

test("le catalogue contient plusieurs comparaisons, indexées et slugifiées", () => {
  assert.ok(comparisonIds.length >= 4, "au moins 4 comparaisons attendues");
  assert.equal(comparisonIds.length, Object.keys(comparisons).length);
  for (const id of comparisonIds) {
    assert.match(id, /^[a-z0-9-]+$/, `slug invalide : ${id}`);
    assert.equal(comparisons[id].id, id, `identifiant incohérent : ${id}`);
    assert.equal(comparePath(id), `/compare/${id}`);
    assert.ok(getComparison(id), `comparaison introuvable : ${id}`);
  }
  assert.equal(getComparison("inconnue"), null);
});

test("chaque comparaison a un contenu éditorial complet et calibré SEO", () => {
  for (const id of comparisonIds) {
    const comparison = comparisons[id];

    // Titre : 20 à 80 caractères (fenêtre d'affichage Google).
    const titleAr = resolveTokens(comparison.titleAr);
    const titleEn = resolveTokens(comparison.titleEn);
    assert.ok(titleAr.length >= 20, `${id}: titleAr trop court`);
    assert.ok(titleAr.length <= 80, `${id}: titleAr > 80 car.`);
    assert.ok(titleEn.length >= 20, `${id}: titleEn trop court`);
    assert.ok(titleEn.length <= 80, `${id}: titleEn > 80 car.`);

    // Description : 50 à 180 caractères.
    const descriptionAr = resolveTokens(comparison.descriptionAr);
    const descriptionEn = resolveTokens(comparison.descriptionEn);
    assert.ok(descriptionAr.length >= 50, `${id}: descriptionAr trop courte`);
    assert.ok(descriptionAr.length <= 180, `${id}: descriptionAr > 180 car.`);
    assert.ok(descriptionEn.length >= 50, `${id}: descriptionEn trop courte`);
    assert.ok(descriptionEn.length <= 180, `${id}: descriptionEn > 180 car.`);

    // Réponse directe (answer-first) : la phrase reprise par Google/les LLM.
    assert.ok(comparison.answerAr.length >= 120, `${id}: answerAr trop courte`);
    assert.ok(comparison.answerEn.length >= 100, `${id}: answerEn trop courte`);
    assert.ok(comparison.h1Ar.length > 8, `${id}: h1Ar trop court`);
    assert.ok(comparison.subtitleAr.length > 20, `${id}: subtitleAr trop court`);

    // « L'annonce » : deux listes équilibrées (✗ / ✓).
    assert.ok(comparison.themPoints.length >= 4, `${id}: trop peu de points rouges`);
    assert.ok(comparison.usPoints.length >= 4, `${id}: trop peu de points verts`);
    for (const point of [...comparison.themPoints, ...comparison.usPoints]) {
      assert.ok(point.textAr.length > 5, `${id}: point ar vide`);
      assert.ok(point.textEn.length > 5, `${id}: point en vide`);
    }

    // Tableau comparatif.
    assert.ok(comparison.criteria.length >= 4, `${id}: trop peu de critères`);
    for (const criterion of comparison.criteria) {
      assert.ok(criterion.usAr.length > 3, `${id}: critère sans verdict نخبة`);
      assert.ok(criterion.usEn.length > 3, `${id}: critère sans verdict نخبة (EN)`);
      assert.ok(["us", "them", "tie"].includes(criterion.winner));
      assert.ok(criterion.labelAr.length > 2 && criterion.labelEn.length > 2);
    }

    // Honnêteté éditoriale : les deux côtés doivent avoir un cas d'usage.
    assert.ok(comparison.chooseThemAr.length >= 2, `${id}: cas d'usage alternatif manquant`);
    assert.ok(comparison.chooseUsAr.length >= 2, `${id}: cas d'usage نخبة manquant`);

    // FAQ.
    assert.ok(comparison.faqs.length >= 3, `${id}: au moins 3 FAQ attendues`);
    for (const faq of comparison.faqs) {
      assert.ok(faq.qAr && faq.qEn && faq.aAr && faq.aEn, `${id}: FAQ incomplète`);
      assert.ok(faq.aAr.length >= 60, `${id}: réponse FAQ trop courte`);
      assert.ok(faq.aEn.length >= 60, `${id}: FAQ answer too short`);
    }

    // Mots-clés (AR + EN) et libellé d'appel à l'action.
    assert.ok(comparison.keywordsAr.length >= 3, `${id}: mots-clés AR manquants`);
    assert.ok(comparison.keywordsEn.length >= 3, `${id}: mots-clés EN manquants`);
    assert.ok(comparison.ctaAr.length > 5 && comparison.ctaEn.length > 5);
  }
});

test("aucun jeton de marché ni caractère parasite ne subsiste", () => {
  for (const id of comparisonIds) {
    const comparison = comparisons[id];
    // Les titres et descriptions portent volontairement les jetons de marché
    // ({city}…), résolus à l'affichage par `pageMetadata`. Les champs
    // affichés tels quels ne doivent, eux, contenir aucun jeton.
    const fields = [
      comparison.h1Ar,
      comparison.h1En,
      comparison.subtitleAr,
      comparison.subtitleEn,
      comparison.answerAr,
      comparison.answerEn,
      comparison.usPriceLabelAr,
      comparison.usPriceLabelEn,
      comparison.usPriceNoteAr,
      comparison.usPriceNoteEn,
      comparison.themPriceAr,
      comparison.themPriceEn,
      ...comparison.themPoints.map((point) => point.textAr),
      ...comparison.usPoints.map((point) => point.textAr),
      ...comparison.criteria.flatMap((criterion) => [
        criterion.labelAr,
        criterion.usAr,
        criterion.themAr ?? "",
      ]),
      ...comparison.faqs.flatMap((faq) => [faq.qAr, faq.aAr]),
    ];
    for (const field of fields) {
      assert.ok(
        !field.includes("{city") && !field.includes("{country"),
        `${id}: jeton de marché non résolu dans « ${field.slice(0, 40)} »`,
      );
      // Aucun caractère hors alphabet latin / arabe (garde-fou anti-texte
      // corrompu : le moteur ne doit publier que du texte propre).
      const stray = [...field].filter((char) => {
        const code = char.codePointAt(0);
        const arabic =
          (code >= 0x0600 && code <= 0x06ff) ||
          (code >= 0x0750 && code <= 0x077f) ||
          (code >= 0xfb50 && code <= 0xfdff) ||
          (code >= 0xfe70 && code <= 0xfeff);
        return !arabic && !/[A-Za-z0-9 .,;:!?'"()\-+/×%…€$£¥—–«»“”&=#@_~^]/.test(char);
      });
      assert.equal(stray.length, 0, `${id}: caractère inattendu « ${stray.join("")} »`);
    }
  }
});

test("titres et descriptions sont uniques (pas de cannibalisation)", () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const id of comparisonIds) {
    const comparison = comparisons[id];
    const title = resolveTokens(comparison.titleAr);
    const description = resolveTokens(comparison.descriptionAr);
    assert.ok(!titles.has(title), `titre dupliqué : ${title}`);
    assert.ok(!descriptions.has(description), `description dupliquée : ${id}`);
    titles.add(title);
    descriptions.add(description);
  }
});

test("maillage interne : comparaisons et services liés existent", () => {
  for (const id of comparisonIds) {
    const comparison = comparisons[id];
    assert.ok(comparison.related.length >= 1, `${id}: aucune comparaison liée`);
    for (const relatedId of comparison.related) {
      assert.ok(comparisons[relatedId], `${id}: comparaison liée inconnue ${relatedId}`);
      assert.notEqual(relatedId, id, `${id}: auto-référence`);
    }
    const linked = relatedComparisons(id);
    assert.equal(linked.length, comparison.related.length);

    assert.ok(comparison.relatedServices.length >= 2, `${id}: services liés manquants`);
    for (const serviceId of comparison.relatedServices) {
      assert.ok(
        siteConfig.standaloneServices.some((service) => service.id === serviceId),
        `${id}: service lié inconnu ${serviceId}`,
      );
    }
  }
});

test("comparisonServiceJsonLd expose Service + Offer cohérent", () => {
  for (const id of comparisonIds) {
    const comparison = comparisons[id];
    const price = siteConfig.pricing.plans[0].priceUsd;
    const schema = comparisonServiceJsonLd(siteConfig, comparison, price);

    assert.equal(schema["@type"], "Service");
    assert.equal(schema.url, `${siteConfig.url}/compare/${id}`);
    assert.equal(schema.offers["@type"], "Offer");
    assert.equal(schema.offers.price, String(price));
    assert.equal(schema.offers.priceCurrency, "USD");
    assert.equal(schema.provider["@id"], `${siteConfig.url}/#organization`);
    assert.ok(schema.areaServed.length >= 2);
    assert.equal(schema.serviceOutput["@type"], "ItemList");
    assert.equal(
      schema.serviceOutput.itemListElement.length,
      comparison.criteria.length,
    );
  }
});

test("comparisonCriteriaJsonLd liste tous les critères", () => {
  for (const id of comparisonIds) {
    const comparison = comparisons[id];
    const schema = comparisonCriteriaJsonLd(siteConfig, comparison);
    assert.equal(schema["@type"], "ItemList");
    assert.equal(schema.numberOfItems, comparison.criteria.length);
    schema.itemListElement.forEach((item, index) => {
      assert.equal(item.position, index + 1);
      assert.equal(item.name, comparison.criteria[index].labelAr);
      assert.ok(item.description.includes(comparison.criteria[index].usAr));
    });
  }
});

test("comparisonFaqJsonLd : FAQPage bilingue valide", () => {
  for (const id of comparisonIds) {
    const comparison = comparisons[id];
    const schema = comparisonFaqJsonLd(comparison);
    assert.equal(schema["@type"], "FAQPage");
    assert.equal(schema.mainEntity.length, comparison.faqs.length);
    for (const question of schema.mainEntity) {
      assert.equal(question["@type"], "Question");
      assert.ok(question.name.length > 0);
      assert.ok(question.acceptedAnswer.text.includes(" — "));
    }
  }
  assert.ok(comparisonsHubFaqs.length >= 4);
});

test("comparisonsCollectionJsonLd expose le hub avec toutes les pages", () => {
  const items = comparisonIds.map((id) => comparisons[id]);
  const schema = comparisonsCollectionJsonLd(siteConfig, items);
  assert.equal(schema["@type"], "CollectionPage");
  assert.equal(schema.url, `${siteConfig.url}/compare`);
  assert.equal(schema.mainEntity["@type"], "ItemList");
  assert.equal(schema.mainEntity.numberOfItems, items.length);
  schema.mainEntity.itemListElement.forEach((item, index) => {
    assert.equal(item.position, index + 1);
    assert.equal(item.url, `${siteConfig.url}/compare/${items[index].id}`);
    assert.ok(item.description.length > 40);
  });
});

test("aucun jeton de marché ne fuit dans les schémas ni dans le texte affiché", () => {
  for (const id of comparisonIds) {
    const comparison = comparisons[id];

    // Les schémas sont lus par les moteurs : un jeton brut y serait publié.
    const service = comparisonServiceJsonLd(siteConfig, comparison, 300);
    assert.ok(
      !service.offers.description.includes("{city"),
      `${id}: jeton de marché dans l'Offer`,
    );

    const collection = comparisonsCollectionJsonLd(siteConfig, [comparison]);
    assert.ok(
      !collection.mainEntity.itemListElement[0].description.includes("{city"),
      `${id}: jeton de marché dans l'ItemList du hub`,
    );

    // Le texte affiché (hub, llms.txt) passe par `comparisonText`.
    const resolved = comparisonText(comparison.descriptionAr, siteConfig.market, "ar");
    assert.ok(!resolved.includes("{city"), `${id}: jeton non résolu`);
    assert.ok(resolved.length > 40, `${id}: description vide après résolution`);
  }
});
