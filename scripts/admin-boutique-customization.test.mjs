#!/usr/bin/env node
/**
 * Tests d'intégration des 3 fonctionnalités d'administration de la boutique :
 *   1. Modification complète des cartes cadeaux & produits digitaux (tous les champs) + surcharges ;
 *   2. Optimisation SEO & GEO bilingue (Google + moteurs IA) des fiches produits ;
 *   3. Plafond de commande maximale FazerCards (25 $ par défaut) modifiable dans /admin/settings.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "admin-boutique-test-"));

after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

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

const read = (rel) => readFileSync(join(root, rel), "utf8");

const overridesCore = await compileModule(
  "lib/digital-overrides-core.ts",
  "digital-overrides-core.mjs",
);
const seoGen = await compileModule(
  "lib/ai/digital-seo-generator.ts",
  "digital-seo-generator.mjs",
);
const digitalSeo = await compileModule("lib/digital-seo.ts", "digital-seo.mjs");
const fazercardsLib = await compileModule("lib/fazercards.ts", "fazercards.mjs");
const configLib = await compileModule("lib/config.ts", "config.mjs");
const validationLib = await compileModule("lib/validation.ts", "validation.mjs");

function sampleBaseGiftCard() {
  return {
    id: "fzr-giftcard-psn-us",
    slug: "fzr-giftcard-psn-us",
    kind: "gift_card",
    status: "available",
    platform: "PlayStation",
    color: "#003791",
    titleAr: "بطاقة هدايا — PlayStation (US)",
    titleEn: "Gift Card — PlayStation (US)",
    descriptionAr: "بطاقة هدايا PlayStation",
    descriptionEn: "PlayStation gift card",
    image: "/digital-products/playstation.svg",
    regions: ["US"],
    featuresAr: ["تسليم فوري"],
    featuresEn: ["Instant delivery"],
    deliveryNoteAr: "يُسلَّم الكود بعد تأكيد الدفع.",
    deliveryNoteEn: "Delivered after payment.",
    denominations: [
      {
        id: "card-10",
        label: "$10",
        faceValue: "10 USD",
        faceCurrency: "USD",
        region: "US",
        priceUsd: 10.9,
        supplierCostUsd: 9.8,
        supplierOfferId: "fzr-offer-10",
        available: true,
        maxQuantity: 5,
        fields: [],
      },
      {
        id: "card-25",
        label: "$25",
        faceValue: "25 USD",
        faceCurrency: "USD",
        region: "US",
        priceUsd: 26.5,
        supplierCostUsd: 24.5,
        supplierOfferId: "fzr-offer-25",
        available: true,
        maxQuantity: 3,
        fields: [],
      },
    ],
    sortOrder: 1,
    fulfillment: "auto",
    supplier: "fazercards",
    supplierCategoryId: "cat-psn-us",
  };
}

function sampleBaseTopup() {
  return {
    id: "fzr-topup-pubg",
    slug: "fzr-topup-pubg",
    kind: "game_topup",
    status: "available",
    platform: "PUBG Mobile",
    color: "#B45309",
    titleAr: "شحن لعبة — PUBG Mobile (Auto)",
    titleEn: "Game Top-Up — PUBG Mobile (Auto)",
    descriptionAr: "شحن PUBG",
    descriptionEn: "PUBG top-up",
    image: "",
    regions: ["GLOBAL"],
    featuresAr: [],
    featuresEn: [],
    deliveryNoteAr: "",
    deliveryNoteEn: "",
    denominations: [
      {
        id: "uc-60",
        label: "60 UC",
        faceValue: "60 UC",
        region: "GLOBAL",
        priceUsd: 1.5,
        supplierCostUsd: 0.92,
        supplierOfferId: "offer-uc-60",
        available: true,
        maxQuantity: 10,
        fields: [{ key: "player_id", label: "Player ID", type: "text" }],
      },
    ],
    sortOrder: 2,
    fulfillment: "auto",
    supplier: "fazercards",
    supplierCategoryId: "cat-pubg",
  };
}

/* ---------------- 1. Modification de tous les champs & surcharges ---------------- */

test("les surcharges admin modifient tous les champs et masquent les coûts internes côté public", () => {
  const base = sampleBaseGiftCard();
  const override = {
    ...base,
    slug: "playstation-store-usa",
    titleAr: "بطاقة ستور بلايستيشن أمريكي",
    titleEn: "PlayStation Store US Gift Card",
    descriptionAr: "وصف مخصص بالعربية",
    descriptionEn: "Custom English description",
    color: "#112233",
    image: "https://cdn.example.com/psn-us.png",
    regions: ["US", "CA"],
    featuresAr: ["ميزة 1", "ميزة 2"],
    featuresEn: ["Feature 1", "Feature 2"],
    deliveryNoteAr: "تسليم مخصص",
    deliveryNoteEn: "Custom delivery",
    sortOrder: -5,
    denominations: [
      {
        ...base.denominations[0],
        label: "10 $ PSN US",
        priceUsd: 11.49,
        maxQuantity: 8,
        noteAr: "حساب أمريكي فقط",
        noteEn: "US account only",
      },
    ],
    seo: {
      seoTitleAr: "بطاقة بلايستيشن أمريكي | نخبة",
      seoTitleEn: "PSN US Card | Nukhba",
      seoDescriptionAr: "اشترِ بطاقة PSN أمريكي بعملة USDT.",
      seoDescriptionEn: "Buy PSN US gift card with USDT.",
      h1Ar: "بطاقة PlayStation أمريكي",
      h1En: "PlayStation US Gift Card",
      imageAltAr: "صورة بطاقة بلايستيشن أمريكي",
      imageAltEn: "PlayStation US gift card visual",
      geoSummaryAr: "ملخص GEO عربي",
      geoSummaryEn: "English GEO summary",
      keywordsAr: ["بطاقة بلايستيشن"],
      keywordsEn: ["psn us card"],
      redeemStepsAr: ["الخطوة 1", "الخطوة 2"],
      redeemStepsEn: ["Step 1", "Step 2"],
      faqs: [
        {
          qAr: "سؤال؟",
          aAr: "جواب.",
          qEn: "Question?",
          aEn: "Answer.",
        },
      ],
    },
  };

  const state = overridesCore.normalizeDigitalOverridesState({
    overrides: { [base.id]: override },
    customProducts: [],
    deletedIds: [],
  });

  // Vue publique : champs modifiés appliqués, mais coûts fournisseur purgés.
  const publicCatalog = overridesCore.applyDigitalOverrides([base], state, {
    publicOnly: true,
    keepInternalFields: false,
  });
  assert.equal(publicCatalog.length, 1);
  const pub = publicCatalog[0];
  assert.equal(pub.slug, "playstation-store-usa");
  assert.equal(pub.titleAr, "بطاقة ستور بلايستيشن أمريكي");
  assert.equal(pub.titleEn, "PlayStation Store US Gift Card");
  assert.equal(pub.color, "#112233");
  assert.deepEqual(pub.regions, ["US", "CA"]);
  assert.equal(pub.denominations.length, 1);
  assert.equal(pub.denominations[0].priceUsd, 11.49);
  assert.equal(pub.denominations[0].maxQuantity, 8);
  assert.equal("supplierCostUsd" in pub.denominations[0], false);
  assert.equal("supplierOfferId" in pub.denominations[0], false);
  assert.equal("supplierCategoryId" in pub, false);

  // Les helpers SEO consomment bien tous les champs personnalisés.
  assert.equal(digitalSeo.productSeoName(pub, "ar"), "بطاقة PlayStation أمريكي");
  assert.equal(digitalSeo.productSeoName(pub, "en"), "PlayStation US Gift Card");
  assert.equal(digitalSeo.productSeoTitle(pub, "en"), "PSN US Card | Nukhba");
  assert.equal(digitalSeo.productSeoDescription(pub, "en"), "Buy PSN US gift card with USDT.");
  assert.equal(digitalSeo.productImageAlt(pub, "en"), "PlayStation US gift card visual");
  assert.equal(digitalSeo.productGeoSummary(pub, "en"), "English GEO summary");
  assert.deepEqual(digitalSeo.redeemSteps(pub, "en"), ["Step 1", "Step 2"]);
  assert.deepEqual(digitalSeo.productFaqs(pub, "en"), [{ q: "Question?", a: "Answer." }]);

  // Vue admin : conserve le coût fournisseur réel pour le calcul de marge.
  const adminCatalog = overridesCore.applyDigitalOverrides([base], state, {
    publicOnly: false,
    keepInternalFields: true,
  });
  assert.equal(adminCatalog[0].denominations[0].supplierCostUsd, 9.8);
  assert.equal(adminCatalog[0].supplierCategoryId, "cat-psn-us");
});

test("la caisse FazerCards applique les prix/statuts modifiés tout en gardant le coût fournisseur réel", () => {
  const rawFzr = {
    id: "fzr-giftcard-psn-us",
    slug: "fzr-giftcard-psn-us",
    categoryId: "cat-psn-us",
    kind: "gift_card",
    platform: "PlayStation",
    titleAr: "بطاقة PlayStation",
    titleEn: "PlayStation Card",
    descriptionAr: "desc",
    descriptionEn: "desc",
    image: "",
    regions: ["US"],
    denominations: [
      {
        id: "card-10",
        label: "$10",
        faceValue: "10 USD",
        region: "US",
        priceUsd: 10.9,
        supplierCostUsd: 9.8,
        supplierOfferId: "fzr-offer-10",
        available: true,
        maxOrderQuantity: 5,
        fields: [],
      },
    ],
  };

  const base = sampleBaseGiftCard();
  const state = overridesCore.normalizeDigitalOverridesState({
    overrides: {
      [base.id]: {
        ...base,
        slug: "psn-us-custom",
        denominations: [
          {
            ...base.denominations[0],
            priceUsd: 12.25,
            maxQuantity: 4,
          },
        ],
      },
    },
  });

  // Résolution par id d'origine ET par nouveau slug personnalisé.
  const byId = overridesCore.resolveFazercardsCheckoutProduct(
    [rawFzr],
    state,
    "fzr-giftcard-psn-us",
  );
  const byCustomSlug = overridesCore.resolveFazercardsCheckoutProduct(
    [rawFzr],
    state,
    "psn-us-custom",
  );
  assert.ok(byId);
  assert.ok(byCustomSlug);
  assert.equal(byId.categoryId, "cat-psn-us");
  assert.equal(byId.denominations[0].priceUsd, 12.25);
  assert.equal(byId.denominations[0].supplierCostUsd, 9.8);
  assert.equal(byId.denominations[0].maxOrderQuantity, 4);

  // Une fiche passée en brouillon est refusée à la caisse.
  const draftState = overridesCore.normalizeDigitalOverridesState({
    overrides: {
      [base.id]: { ...base, status: "draft" },
    },
  });
  assert.equal(
    overridesCore.resolveFazercardsCheckoutProduct(
      [rawFzr],
      draftState,
      "fzr-giftcard-psn-us",
    ),
    null,
  );
});

/* ---------------- 2. Bouton et moteur d'optimisation SEO & GEO ---------------- */

test("l'optimiseur SEO/GEO respecte A01 (région), A02 (livraison) et les plafonds SERP", async () => {
  const prevKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    // Cas 1 : Carte cadeau régionale (US) → livraison e-mail + région dans H1/Title
    const cardRes = await seoGen.optimizeDigitalProductSeoGeo(sampleBaseGiftCard(), {
      rewriteEditorial: true,
    });
    assert.equal(cardRes.source, "template");
    const card = cardRes.product;
    assert.ok(card.seo);
    assert.ok(card.seo.seoTitleAr.length <= 60, `seoTitleAr trop long: ${card.seo.seoTitleAr}`);
    assert.ok(card.seo.seoTitleEn.length <= 60, `seoTitleEn trop long: ${card.seo.seoTitleEn}`);
    assert.ok(
      card.seo.seoDescriptionAr.length <= 155,
      `seoDescriptionAr trop long: ${card.seo.seoDescriptionAr}`,
    );
    assert.ok(
      card.seo.seoDescriptionEn.length <= 155,
      `seoDescriptionEn trop long: ${card.seo.seoDescriptionEn}`,
    );
    assert.match(card.seo.h1En, /United States/i);
    assert.match(card.seo.geoSummaryEn, /1 USD = 1 USDT/);
    assert.match(card.seo.geoSummaryEn, /email/i);
    assert.ok((card.seo.faqs?.length ?? 0) >= 4);

    // Cas 2 : Recharge de jeu (game_topup) → Player ID direct, JAMAIS de promesse de code par e-mail
    const topupRes = await seoGen.optimizeDigitalProductSeoGeo(sampleBaseTopup(), {
      rewriteEditorial: true,
    });
    const topup = topupRes.product;
    assert.match(topup.seo.geoSummaryEn, /Player ID/i);
    assert.match(topup.deliveryNoteEn, /Player ID/i);
    assert.doesNotMatch(topup.deliveryNoteEn, /emailed to you/i);
    assert.ok(topup.seo.seoTitleEn.length <= 60);
    assert.ok(topup.seo.seoDescriptionEn.length <= 155);

    // Cas 3 : rewriteEditorial = false préserve le titre/description personnalisés
    const customCard = {
      ...sampleBaseGiftCard(),
      titleEn: "My Handcrafted Title",
      descriptionEn: "My Handcrafted Description",
    };
    const preserved = await seoGen.optimizeDigitalProductSeoGeo(customCard, {
      rewriteEditorial: false,
    });
    assert.equal(preserved.product.titleEn, "My Handcrafted Title");
    assert.equal(preserved.product.descriptionEn, "My Handcrafted Description");
    assert.ok(preserved.product.seo?.seoTitleEn);
    assert.ok(preserved.product.seo?.geoSummaryEn);
  } finally {
    if (prevKey !== undefined) process.env.OPENAI_API_KEY = prevKey;
  }
});

/* ---------------- 3. Plafond de commande FazerCards (25 $ par défaut, modifiable) ---------------- */

test("le plafond de commande maximale FazerCards vaut 25 $ par défaut et est modifiable via les réglages", () => {
  const prevEnv = process.env.FAZERCARDS_MAX_ORDER_USD;
  delete process.env.FAZERCARDS_MAX_ORDER_USD;
  try {
    assert.equal(configLib.siteConfig.fazercards.maxOrderUsd, 25);
    assert.equal(fazercardsLib.DEFAULT_FAZERCARDS_MAX_ORDER_USD, 25);
    assert.equal(fazercardsLib.fazercardsMaxOrderUsd(), 25);

    // L'admin peut le baisser (ex. 15 $) ou le monter au-dessus de 25 $ / 50 $ (ex. 120 $).
    assert.equal(fazercardsLib.fazercardsMaxOrderUsd(15), 15);
    assert.equal(fazercardsLib.fazercardsMaxOrderUsd(40), 40);
    assert.equal(fazercardsLib.fazercardsMaxOrderUsd(120), 120);
    assert.ok(fazercardsLib.fazercardsDeliveryMaxOrderUsd(450) >= 450);

    // Validation Zod de siteConfig accepte la modification du plafond et rejette < 1.5 $.
    const validParsed = validationLib.siteConfigSchema.safeParse({
      ...configLib.siteConfig,
      fazercards: { maxOrderUsd: 75 },
    });
    assert.equal(validParsed.success, true);
    assert.equal(validParsed.data.fazercards.maxOrderUsd, 75);

    const invalidParsed = validationLib.siteConfigSchema.safeParse({
      ...configLib.siteConfig,
      fazercards: { maxOrderUsd: 0.5 },
    });
    assert.equal(invalidParsed.success, false);
  } finally {
    if (prevEnv !== undefined) process.env.FAZERCARDS_MAX_ORDER_USD = prevEnv;
  }
});

test("le panneau admin expose l'éditeur complet des produits, le bouton SEO/GEO et le réglage du plafond 25 $", () => {
  const nav = read("src/app/admin/(panel)/admin-nav.tsx");
  assert.match(nav, /\/admin\/digital\/products/);

  const manager = read(
    "src/app/admin/(panel)/digital/products/boutique-products-manager.tsx",
  );
  assert.match(manager, /Optimiser SEO & GEO/);
  assert.match(manager, /\/api\/admin\/ai\/digital-seo/);
  assert.match(manager, /saveBoutiqueProductAction/);

  const settingsForm = read("src/app/admin/(panel)/settings/settings-form.tsx");
  assert.match(settingsForm, /Boutique & FazerCards/);
  assert.match(settingsForm, /maxOrderUsd/);
});
