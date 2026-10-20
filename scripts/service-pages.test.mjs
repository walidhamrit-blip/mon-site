#!/usr/bin/env node
/**
 * Tests des pages services (/services et /services/[service]) — `node:test`.
 *
 * Vérifie le socle éditorial des 6 services à la carte et les schémas
 * générés (Service + Offer, FAQPage, CollectionPage + ItemList), briques du
 * référencement local et des réponses IA (GEO).
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
const outDir = mkdtempSync(join(tmpdir(), "service-pages-"));

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
  resolveServiceLanding,
  servicesHubFaqs,
  serviceJsonLd,
  serviceFaqJsonLd,
  servicesCollectionJsonLd,
  findService,
  servicePath,
} = await compileModule("lib/services.ts", "services.mjs");

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

test("chaque service de la config possède un contenu éditorial complet", () => {
  assert.ok(siteConfig.standaloneServices.length >= 6);
  for (const service of siteConfig.standaloneServices) {
    const landing = resolveServiceLanding(service);

    assert.ok(landing.titleAr.length > 20, `${service.id}: titleAr trop court`);
    assert.ok(landing.titleAr.length <= 80, `${service.id}: titleAr > 80 car.`);
    assert.ok(landing.descriptionAr.length >= 50, `${service.id}: description trop courte`);
    assert.ok(landing.descriptionAr.length <= 180, `${service.id}: description > 180 car.`);
    assert.ok(landing.answerAr.length > 120, `${service.id}: réponse directe trop courte`);
    assert.ok(landing.answerEn.length > 100, `${service.id}: English answer too short`);
    assert.ok(landing.deliverablesAr.length >= 4, `${service.id}: trop peu de livrables`);
    assert.ok(landing.deliverablesEn.length >= 4, `${service.id}: too few deliverables`);
    assert.ok(landing.faqs.length >= 3, `${service.id}: au moins 3 FAQ attendues`);
    assert.ok(landing.deliveryAr.length > 0);

    for (const faq of landing.faqs) {
      assert.ok(faq.qAr && faq.qEn && faq.aAr && faq.aEn, `${service.id}: FAQ incomplète`);
      assert.ok(faq.aAr.length >= 60, `${service.id}: réponse FAQ trop courte`);
    }
  }
});

test("findService résout par identifiant et renvoie null sinon", () => {
  const service = findService(siteConfig.standaloneServices, "restyle");
  assert.ok(service);
  assert.equal(service.titleEn, "Restyle an Old Website");
  assert.equal(findService(siteConfig.standaloneServices, "inconnu"), null);
  assert.equal(servicePath("restyle"), "/services/restyle");
});

test("repli générique pour un service ajouté depuis /admin", () => {
  const custom = {
    id: "audit-mensuel",
    titleAr: "تدقيق شهري",
    titleEn: "Monthly audit",
    descAr: "مراقبة شهرية لموقعك.",
    descEn: "Monthly website monitoring.",
    priceFromUsd: 25,
    priceFromLyd: 150,
    featuresAr: ["تقرير شهري", "مراقبة SEO"],
    featuresEn: ["Monthly report", "SEO monitoring"],
  };
  const landing = resolveServiceLanding(custom);
  assert.equal(landing.h1Ar, custom.titleAr);
  assert.match(landing.answerAr, /25/);
  assert.match(landing.answerEn, /\$25/);
  assert.ok(landing.faqs.length > 0);
});

test("serviceJsonLd expose Service + Offer + zone desservie + fournisseur", () => {
  const service = siteConfig.standaloneServices[0];
  const landing = resolveServiceLanding(service);
  const schema = serviceJsonLd(siteConfig, service, landing);

  assert.equal(schema["@type"], "Service");
  assert.equal(schema.url, `${siteConfig.url}/services/${service.id}`);
  assert.equal(schema.offers["@type"], "Offer");
  assert.equal(schema.offers.price, String(service.priceFromUsd));
  assert.equal(schema.offers.priceCurrency, "USD");
  assert.equal(schema.provider["@id"], `${siteConfig.url}/#organization`);
  assert.equal(schema.areaServed.length, 2);
  assert.equal(schema.areaServed[0].name, "Tripoli");
  assert.equal(schema.areaServed[1].name, "Libya");
  assert.equal(schema.availableLanguage.length, 2);
});

test("FAQPage du hub et des services : questions bilingues valides", () => {
  assert.ok(servicesHubFaqs.length >= 4);
  const faqSchema = serviceFaqJsonLd({
    faqs: servicesHubFaqs,
  });
  assert.equal(faqSchema["@type"], "FAQPage");
  assert.equal(faqSchema.mainEntity.length, servicesHubFaqs.length);
  for (const question of faqSchema.mainEntity) {
    assert.equal(question["@type"], "Question");
    assert.ok(question.name.length > 0);
    assert.ok(question.acceptedAnswer.text.includes(" — "));
  }
});

test("CollectionPage du hub liste tous les services avec URL et description", () => {
  const schema = servicesCollectionJsonLd(siteConfig, siteConfig.standaloneServices);
  assert.equal(schema["@type"], "CollectionPage");
  assert.equal(schema.url, `${siteConfig.url}/services`);
  assert.equal(schema.mainEntity["@type"], "ItemList");
  assert.equal(
    schema.mainEntity.numberOfItems,
    siteConfig.standaloneServices.length,
  );
  assert.equal(
    schema.mainEntity.itemListElement.length,
    siteConfig.standaloneServices.length,
  );
  schema.mainEntity.itemListElement.forEach((item, index) => {
    assert.equal(item.position, index + 1);
    assert.equal(
      item.url,
      `${siteConfig.url}/services/${siteConfig.standaloneServices[index].id}`,
    );
    assert.ok(item.description.length > 10);
  });
});
