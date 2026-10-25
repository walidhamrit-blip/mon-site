#!/usr/bin/env node
/**
 * Tests de la vente à la commande (Reloadly + noyau digital).
 *
 * Aucun appel réseau : on teste les décisions pures — environnement visé,
 * normalisation des produits/commandes/codes, classement des statuts,
 * devis serveur (prix jamais fourni par le client), chiffrement des codes,
 * saisie manuelle et masquage d'e-mail.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "reloadly-"));

const aliasPlugin = {
  name: "alias-at-src",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => {
      const base = join(srcRoot, args.path.slice(2));
      const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
      const found = candidates.find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
      );
      return { path: found ?? base };
    });
  },
};

async function compile(entry, name) {
  const outfile = join(outDir, `${name}.mjs`);
  await build({
    entryPoints: [join(srcRoot, entry)],
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

const reloadly = await compile("lib/reloadly.ts", "reloadly");
const core = await compile("lib/digital-order-core.ts", "digital-core");
const codes = await compile("lib/digital-codes.ts", "digital-codes");
const types = await compile("lib/digital-types.ts", "digital-types");

test.after(() => rmSync(outDir, { recursive: true, force: true }));

/* ------------------------------ Environnement ------------------------------ */

async function withEnv(patch, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(patch)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    // `await` : sans lui, l'environnement serait restauré avant la fin des
    // appels asynchrones (le test interrogerait la vraie API Reloadly).
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("sandbox par défaut — aucun argent réel sans opt-in explicite", () => {
  withEnv({ RELOADLY_SANDBOX: undefined }, () => {
    assert.equal(reloadly.reloadlyMode(), "sandbox");
    assert.equal(reloadly.reloadlyGiftCardsBase(), "https://giftcards-sandbox.reloadly.com");
    assert.equal(reloadly.reloadlyAudience(), reloadly.reloadlyGiftCardsBase());
  });
});

test("RELOADLY_SANDBOX=false bascule les URLs en live", () => {
  withEnv({ RELOADLY_SANDBOX: "false" }, () => {
    assert.equal(reloadly.reloadlyMode(), "live");
    assert.equal(reloadly.reloadlyGiftCardsBase(), "https://giftcards.reloadly.com");
  });
});

test("valeurs inattendues de RELOADLY_SANDBOX restent en sandbox", () => {
  for (const value of ["true", "1", "yes", "maybe", ""]) {
    withEnv({ RELOADLY_SANDBOX: value }, () => {
      assert.equal(reloadly.reloadlyMode(), "sandbox", `valeur ${JSON.stringify(value)}`);
    });
  }
});

test("identifiants assainis (guillemets et espaces d'un copier-coller)", () => {
  withEnv(
    { RELOADLY_CLIENT_ID: ' "abc123" ', RELOADLY_CLIENT_SECRET: "' secret '" },
    () => {
      assert.equal(reloadly.reloadlyClientId(), "abc123");
      assert.equal(reloadly.reloadlyClientSecret(), "secret");
      assert.equal(reloadly.reloadlyConfigured(), true);
    },
  );
});

test("sans identifiants, l'intégration est déclarée non configurée", () => {
  withEnv({ RELOADLY_CLIENT_ID: undefined, RELOADLY_CLIENT_SECRET: undefined }, () => {
    assert.equal(reloadly.reloadlyConfigured(), false);
  });
});

test("plafond d'achat automatique : défaut 300 $, surchargeable", () => {
  withEnv({ RELOADLY_MAX_ORDER_USD: undefined }, () => {
    assert.equal(reloadly.reloadlyMaxOrderUsd(), 300);
  });
  withEnv({ RELOADLY_MAX_ORDER_USD: "45.5" }, () => {
    assert.equal(reloadly.reloadlyMaxOrderUsd(), 45.5);
  });
  withEnv({ RELOADLY_MAX_ORDER_USD: "-3" }, () => {
    assert.equal(reloadly.reloadlyMaxOrderUsd(), 300);
  });
});

test("surcharge RELOADLY_API_BASE (tests d'intégration)", () => {
  withEnv({ RELOADLY_API_BASE: "http://localhost:4010/" }, () => {
    assert.equal(reloadly.reloadlyGiftCardsBase(), "http://localhost:4010");
    assert.equal(reloadly.reloadlyAudience(), "http://localhost:4010");
  });
});

/* -------------------------------- Statuts --------------------------------- */

test("statuts Reloadly classés en succès / attente / échec", () => {
  assert.equal(reloadly.giftCardStatusKind("SUCCESSFUL"), "success");
  assert.equal(reloadly.giftCardStatusKind("successful"), "success");
  assert.equal(reloadly.giftCardStatusKind("PENDING"), "pending");
  assert.equal(reloadly.giftCardStatusKind(" PROCESSING "), "pending");
  assert.equal(reloadly.giftCardStatusKind("FAILED"), "failed");
  assert.equal(reloadly.giftCardStatusKind("REFUNDED"), "failed");
  assert.equal(reloadly.giftCardStatusKind(""), "unknown");
  assert.equal(reloadly.giftCardStatusKind(null), "unknown");
});

test("message d'erreur Reloadly extrait du JSON, sans secret", () => {
  const error = new reloadly.ReloadlyError(
    "Reloadly POST /orders → 400",
    400,
    JSON.stringify({ message: "Product not available", errorCode: "PRODUCT_NOT_FOUND" }),
  );
  assert.equal(
    reloadly.reloadlyErrorMessage(error),
    "Product not available (PRODUCT_NOT_FOUND)",
  );
  assert.equal(
    reloadly.reloadlyErrorMessage(new reloadly.ReloadlyError("réseau", null)),
    "réseau",
  );
});

/* ------------------------------- Normalisation ---------------------------- */

test("produit Reloadly normalisé (dénominations fixes, pays, marque)", () => {
  const product = reloadly.normalizeGiftCardProduct({
    productId: 42,
    productName: "Steam 50 US",
    countryCode: "us",
    recipientCurrencyCode: "usd",
    denominationType: "FIXED",
    fixedRecipientDenominations: [10, "25", null, 0, 50],
    senderFeePercentage: 1.5,
    discountPercentage: 2,
    logoUrls: ["https://cdn/x.jpg", 5],
    brand: { brandName: "Steam" },
    country: { isoName: "US", name: "United States" },
    redeemInstruction: { concise: "Redeem on Steam" },
    status: "ACTIVE",
    global: true,
  });
  assert.equal(product.productId, 42);
  assert.equal(product.countryCode, "US");
  assert.equal(product.currencyCode, "USD");
  assert.deepEqual(product.fixedDenominations, [10, 25, 50]);
  assert.equal(product.brandName, "Steam");
  assert.deepEqual(product.logoUrls, ["https://cdn/x.jpg"]);
  assert.equal(product.redeemInstruction, "Redeem on Steam");
  assert.equal(product.global, true);
});

test("produit à montant libre : bornes min/max lues (y compris la faute historique)", () => {
  const ranged = reloadly.normalizeGiftCardProduct({
    productId: 7,
    denominationType: "RANGE",
    minRecipientDenomination: 5,
    maxrecipientDenomination: 100,
    fixedRecipientDenominations: [],
  });
  assert.equal(ranged.denominationType, "RANGE");
  assert.equal(ranged.minDenomination, 5);
  assert.equal(ranged.maxDenomination, 100);
  assert.deepEqual(ranged.fixedDenominations, []);
});

test("codes v2 normalisés (cardNumber/pinCode/redemptionUrl)", () => {
  const list = reloadly.normalizeGiftCardCodes([
    {
      cardNumber: " 6120200345149064 ",
      pinCode: "EFSDCEAFSD",
      redemptionUrl: "https://activate.example/x",
    },
    { cardNumber: "", pinCode: "X" },
    { card_number: 12345, pin_code: " ", redemption_url: "" },
  ]);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], {
    cardNumber: "6120200345149064",
    pinCode: "EFSDCEAFSD",
    redemptionUrl: "https://activate.example/x",
  });
  assert.deepEqual(list[1], { cardNumber: "12345", pinCode: null, redemptionUrl: null });
});

test("codes : objet unique accepté, réponse vide → []", () => {
  const single = reloadly.normalizeGiftCardCodes({
    cardNumber: "999",
    pinCode: null,
    redemptionUrl: null,
  });
  assert.deepEqual(single, [{ cardNumber: "999", pinCode: null, redemptionUrl: null }]);
  assert.deepEqual(reloadly.normalizeGiftCardCodes(null), []);
});

/* ---------------------------------- Devis --------------------------------- */

const product = {
  id: "steam-50",
  slug: "steam-50",
  kind: "gift_card",
  status: "available",
  platform: "Steam",
  color: "#000000",
  titleAr: "ستيم",
  titleEn: "Steam",
  descriptionAr: "",
  descriptionEn: "",
  image: "",
  regions: ["US"],
  featuresAr: [],
  featuresEn: [],
  deliveryNoteAr: "",
  deliveryNoteEn: "",
  sortOrder: 0,
  fulfillment: "auto",
  reloadlyProductId: 42,
  reloadlyCountryCode: "US",
  denominations: [
    {
      id: "d50",
      label: "50 $",
      faceValue: "50 USD",
      region: "US",
      priceUsd: 56.5,
      available: true,
      reloadlyUnitPrice: 50,
    },
    {
      id: "d10",
      label: "10 $",
      faceValue: "10 USD",
      region: "US",
      priceUsd: 12,
      available: true,
    },
    {
      id: "d25",
      label: "25 $",
      faceValue: "25 USD",
      region: "US",
      priceUsd: 28,
      available: false,
    },
  ],
};

test("devis : total recalculé côté serveur (prix × quantité)", () => {
  const result = core.quoteDigitalOrder(product, "d50", "3");
  assert.equal(result.ok, true);
  assert.equal(result.quote.unitPriceUsd, 56.5);
  assert.equal(result.quote.totalUsd, 169.5);
  assert.equal(result.quote.quantity, 3);
  assert.equal(result.quote.reloadlyUnitPrice, 50);
});

test("devis : valeur Reloadly déduite de la valeur faciale quand elle manque", () => {
  const result = core.quoteDigitalOrder(product, "d10", 1);
  assert.equal(result.ok, true);
  assert.equal(result.quote.reloadlyUnitPrice, 10);
});

test("devis : quantité bornée (0, 11, non entier)", () => {
  for (const quantity of [0, 11, -2, 2.5, "abc"]) {
    const result = core.quoteDigitalOrder(product, "d50", quantity);
    assert.equal(result.ok, false, `quantité ${quantity}`);
    assert.equal(result.error, "invalid_quantity");
  }
});

test("devis : montant inconnu ou indisponible refusé", () => {
  assert.equal(core.quoteDigitalOrder(product, "inconnu", 1).error, "denomination_not_found");
  assert.equal(core.quoteDigitalOrder(product, "d25", 1).error, "denomination_not_sellable");
});

test("devis : fiche non publiée refusée", () => {
  const draft = { ...product, status: "coming_soon" };
  assert.equal(core.quoteDigitalOrder(draft, "d50", 1).error, "product_not_sellable");
  assert.equal(core.quoteDigitalOrder(null, "d50", 1).error, "product_not_found");
});

test("devis : prix nul refusé", () => {
  const broken = {
    ...product,
    denominations: [{ ...product.denominations[0], priceUsd: 0 }],
  };
  assert.equal(core.quoteDigitalOrder(broken, "d50", 1).error, "invalid_price");
});

/* ------------------------------ Types métier ------------------------------ */

test("livraison effective : auto seulement avec un produit Reloadly relié", () => {
  assert.equal(types.effectiveFulfillment(product), "auto");
  assert.equal(
    types.effectiveFulfillment({ ...product, reloadlyProductId: null }),
    "manual",
  );
  assert.equal(types.effectiveFulfillment({ ...product, fulfillment: "manual" }), "manual");
});

test("fiche vendable : publiée + au moins un montant disponible", () => {
  assert.equal(types.isSellable(product), true);
  assert.equal(types.isSellable({ ...product, status: "coming_soon" }), false);
  assert.equal(
    types.isSellable({
      ...product,
      denominations: product.denominations.map((item) => ({ ...item, available: false })),
    }),
    false,
  );
});

test("valeur faciale Reloadly : champ dédié prioritaire, sinon premier nombre", () => {
  assert.equal(types.denominationUnitPrice(product.denominations[0]), 50);
  assert.equal(types.denominationUnitPrice(product.denominations[1]), 10);
  assert.equal(
    types.denominationUnitPrice({
      ...product.denominations[1],
      faceValue: "500 Robux",
    }),
    500,
  );
  assert.equal(
    types.denominationUnitPrice({ ...product.denominations[1], faceValue: "aucun" }),
    null,
  );
});

/* ------------------------------- Chiffrement ------------------------------ */

test("chiffrement des codes : aller-retour, rien en clair dans le stockage", () => {
  withEnv({ DIGITAL_CODES_SECRET: "secret-de-test", SESSION_SECRET: undefined }, () => {
    const key = codes.digitalCodesKey();
    assert.ok(key);
    const list = [
      { cardNumber: "6120200345149064", pinCode: "EFSDCEAFSD", redemptionUrl: "https://x" },
      { cardNumber: "1111222233334444", pinCode: null, redemptionUrl: null },
    ];
    const cipher = codes.encryptDigitalCodes(list, key);
    assert.equal(cipher.includes("6120200345149064"), false);
    assert.deepEqual(codes.decryptDigitalCodes(cipher, key), list);
  });
});

test("chiffrement : falsification ou mauvaise clé → aucun code", () => {
  withEnv({ DIGITAL_CODES_SECRET: "secret-de-test" }, () => {
    const key = codes.digitalCodesKey();
    const cipher = codes.encryptDigitalCodes(
      [{ cardNumber: "9999", pinCode: "1", redemptionUrl: null }],
      key,
    );
    const tampered = `${cipher.slice(0, -2)}AA`;
    assert.deepEqual(codes.decryptDigitalCodes(tampered, key), []);
    // Une clé différente (autre secret) ne déchiffre pas.
    withEnv({ DIGITAL_CODES_SECRET: "autre-secret" }, () => {
      assert.deepEqual(codes.decryptDigitalCodes(cipher, codes.digitalCodesKey()), []);
    });
  });
});

test("chiffrement : sans secret, aucune clé (achat refusé en amont)", () => {
  withEnv({ DIGITAL_CODES_SECRET: undefined, SESSION_SECRET: undefined }, () => {
    assert.equal(codes.digitalCodesKey(), null);
    assert.deepEqual(codes.decryptDigitalCodes("a.b.c", null), []);
  });
});

test("chiffrement : SESSION_SECRET sert de repli", () => {
  withEnv({ DIGITAL_CODES_SECRET: undefined, SESSION_SECRET: "session-secret" }, () => {
    assert.ok(codes.digitalCodesKey());
  });
});

/* ------------------------------ Saisie manuelle ---------------------------- */

test("saisie manuelle : numéro | PIN | URL, une carte par ligne", () => {
  const list = core.parseManualCodes(`
    6120200345149064 | EFSDCEAFSD | https://activate.example/a
    6120200345149065\t998877
    6120200345149066
  `);
  assert.equal(list.length, 3);
  assert.deepEqual(list[0], {
    cardNumber: "6120200345149064",
    pinCode: "EFSDCEAFSD",
    redemptionUrl: "https://activate.example/a",
  });
  assert.deepEqual(list[1], {
    cardNumber: "6120200345149065",
    pinCode: "998877",
    redemptionUrl: null,
  });
  assert.deepEqual(list[2], {
    cardNumber: "6120200345149066",
    pinCode: null,
    redemptionUrl: null,
  });
});

test("saisie manuelle : entrée vide → aucun code", () => {
  assert.deepEqual(core.parseManualCodes("   \n\n"), []);
});

/* --------------------------------- Masquage -------------------------------- */

test("e-mail masqué pour l'affichage public", () => {
  assert.equal(core.maskEmail("walid@example.com"), "w****@example.com");
  assert.equal(core.maskEmail("a@b.co"), "a**@b.co");
  assert.equal(core.maskEmail("invalide"), "—");
});

test("statut inconnu normalisé en « pending »", () => {
  assert.equal(core.normalizeDigitalStatus("delivered"), "delivered");
  assert.equal(core.normalizeDigitalStatus("N_IMPORTE_QUOI"), "pending");
  assert.equal(core.normalizeDigitalStatus(null), "pending");
});

/* ------------------------- Contrat HTTP (serveur simulé) ------------------------- */

import { createServer } from "node:http";

/**
 * Serveur Reloadly simulé : vérifie le contrat réel (OAuth client_credentials,
 * Bearer, chemins, en-têtes Accept, corps de commande) sans toucher au réseau
 * ni dépenser un centime.
 */
async function startMockReloadly() {
  const calls = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      calls.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body ? JSON.parse(body) : null,
      });
      const json = (status, payload) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      };

      if (req.url === "/oauth/token") {
        return json(200, {
          access_token: "jeton-de-test",
          expires_in: 3600,
          token_type: "Bearer",
        });
      }
      if (req.url === "/accounts/balance") {
        if (req.headers.authorization !== "Bearer jeton-de-test") {
          return json(401, { message: "Invalid token" });
        }
        return json(200, {
          balance: 1234.5,
          currencyCode: "USD",
          currencyName: "US Dollar",
          updatedAt: "2026-10-24 10:00:00",
        });
      }
      if (req.url === "/products/42" && req.method === "GET") {
        return json(200, {
          productId: 42,
          productName: "Steam 50 US",
          countryCode: "US",
          recipientCurrencyCode: "USD",
          denominationType: "FIXED",
          fixedRecipientDenominations: [50],
          brand: { brandName: "Steam" },
          country: { isoName: "US" },
          status: "ACTIVE",
        });
      }
      if (req.url === "/orders" && req.method === "POST") {
        const payload = JSON.parse(body || "{}");
        if (payload.customIdentifier === "DGC-DEJA-VU") {
          return json(400, {
            message: "customIdentifier already used",
            errorCode: "DUPLICATE_IDENTIFIER",
          });
        }
        return json(200, {
          transactionId: 98765,
          status: "SUCCESSFUL",
          customIdentifier: payload.customIdentifier,
          recipientEmail: payload.recipientEmail,
          product: {
            productId: payload.productId,
            productName: "Steam 50 US",
            quantity: payload.quantity,
            unitPrice: payload.unitPrice,
            totalPrice: payload.unitPrice * payload.quantity,
            currencyCode: "USD",
          },
          transactionCreatedTime: "2026-10-24 10:00:00",
        });
      }
      if (req.url === "/orders/transactions/98765/cards") {
        return json(200, [
          {
            cardNumber: "6120200345149064",
            pinCode: "EFSDCEAFSD",
            redemptionUrl: "https://activate.example/x",
          },
        ]);
      }
      return json(404, { message: "Not found" });
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { server, calls, base: `http://127.0.0.1:${port}` };
}

test("contrat Reloadly : OAuth, solde, achat idempotent et récupération des codes", async () => {
  const mock = await startMockReloadly();
  try {
    await withEnv(
      {
        RELOADLY_API_BASE: mock.base,
        RELOADLY_AUTH_URL: `${mock.base}/oauth/token`,
        RELOADLY_CLIENT_ID: "client-test",
        RELOADLY_CLIENT_SECRET: "secret-test",
        RELOADLY_SANDBOX: undefined,
      },
      async () => {
        reloadly.resetReloadlyTokenCache();

        const balance = await reloadly.reloadlyBalance();
        assert.equal(balance.balance, 1234.5);
        assert.equal(balance.currencyCode, "USD");

        const authCall = mock.calls.find((call) => call.url === "/oauth/token");
        assert.equal(authCall.method, "POST");
        assert.deepEqual(authCall.body, {
          client_id: "client-test",
          client_secret: "secret-test",
          grant_type: "client_credentials",
          audience: mock.base,
        });

        const purchase = await reloadly.createGiftCardOrder({
          productId: 42,
          quantity: 2,
          unitPrice: 50,
          customIdentifier: "DGC-A1B2C3",
          senderName: "Nukhba",
          recipientEmail: "client@example.com",
        });
        assert.equal(purchase.kind, "success");
        assert.equal(purchase.transactionId, "98765");
        assert.equal(purchase.totalPrice, 100);

        const orderCall = mock.calls.find((call) => call.url === "/orders");
        assert.equal(orderCall.headers.authorization, "Bearer jeton-de-test");
        assert.equal(orderCall.headers.accept, reloadly.GIFTCARDS_ACCEPT_V1);
        assert.equal(orderCall.body.unitPrice, 50);
        assert.equal(orderCall.body.quantity, 2);
        assert.equal(orderCall.body.customIdentifier, "DGC-A1B2C3");
        assert.equal(orderCall.body.preOrder, false);

        const codes = await reloadly.getGiftCardCodes("98765");
        const cardsCall = mock.calls.find((call) =>
          call.url.startsWith("/orders/transactions/98765/cards"),
        );
        assert.equal(cardsCall.headers.accept, reloadly.GIFTCARDS_ACCEPT_V2);
        assert.deepEqual(codes, [
          {
            cardNumber: "6120200345149064",
            pinCode: "EFSDCEAFSD",
            redemptionUrl: "https://activate.example/x",
          },
        ]);

        // Le jeton est mutualisé : un seul POST /oauth/token pour 4 appels.
        assert.equal(mock.calls.filter((call) => call.url === "/oauth/token").length, 1);
      },
    );
  } finally {
    await new Promise((resolve) => mock.server.close(resolve));
  }
});

test("contrat Reloadly : refus 400 remonté avec son motif et son code", async () => {
  const mock = await startMockReloadly();
  try {
    await withEnv(
      {
        RELOADLY_API_BASE: mock.base,
        RELOADLY_AUTH_URL: `${mock.base}/oauth/token`,
        RELOADLY_CLIENT_ID: "client-test",
        RELOADLY_CLIENT_SECRET: "secret-test",
      },
      async () => {
        reloadly.resetReloadlyTokenCache();
        let caught = null;
        try {
          await reloadly.createGiftCardOrder({
            productId: 42,
            quantity: 1,
            unitPrice: 50,
            customIdentifier: "DGC-DEJA-VU",
            senderName: "Nukhba",
          });
        } catch (error) {
          caught = error;
        }
        assert.ok(caught, "une erreur Reloadly est attendue");
        assert.equal(caught.status, 400);
        assert.match(reloadly.reloadlyErrorMessage(caught), /customIdentifier already used/);
        assert.match(reloadly.reloadlyErrorMessage(caught), /DUPLICATE_IDENTIFIER/);
      },
    );
  } finally {
    await new Promise((resolve) => mock.server.close(resolve));
  }
});

test("contrat Reloadly : identifiants refusés → erreur explicite, pas de fuite", async () => {
  const mock = await startMockReloadly();
  mock.server.removeAllListeners("request");
  mock.server.on("request", (req, res) => {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "access_denied", error_description: "Unauthorized" }));
  });
  try {
    await withEnv(
      {
        RELOADLY_API_BASE: mock.base,
        RELOADLY_AUTH_URL: `${mock.base}/oauth/token`,
        RELOADLY_CLIENT_ID: "mauvais",
        RELOADLY_CLIENT_SECRET: "mauvais",
      },
      async () => {
        reloadly.resetReloadlyTokenCache();
        const check = await reloadly.checkReloadlyCredentials();
        assert.equal(check.configured, true);
        assert.equal(check.valid, false);
        assert.match(check.error, /refusé les identifiants/);
        assert.equal(JSON.stringify(check).includes("mauvais"), false);
      },
    );
  } finally {
    await new Promise((resolve) => mock.server.close(resolve));
  }
});

/* ------------- Relance d'une commande payée avant configuration ------------- */

test("relance : le montant est retrouvé même si l'admin a réécrit les lignes", () => {
  const denominations = [
    { id: "41", label: "$5", faceValue: "5 USD", region: "US" },
    { id: "42", label: "$10", faceValue: "10 USD", region: "US" },
  ];
  const sameId = core.pickOrderDenomination(denominations, {
    denominationId: "42",
    denominationLabel: "$5",
    region: "US",
  });
  assert.equal(sameId.id, "42");
  // Identifiant de ligne périmé (les dénominations sont réécrites à chaque
  // enregistrement) → repli sur libellé + région, jamais sur un autre montant.
  const byLabel = core.pickOrderDenomination(denominations, {
    denominationId: "999",
    denominationLabel: "$10",
    region: "US",
  });
  assert.equal(byLabel.id, "42");
  // Région changée entre-temps (global → US) → repli sur le libellé seul.
  const byLabelOnly = core.pickOrderDenomination(denominations, {
    denominationId: "999",
    denominationLabel: "$5",
    region: "global",
  });
  assert.equal(byLabelOnly.id, "41");
  // Aucun montant correspondant : on n'invente rien.
  assert.equal(
    core.pickOrderDenomination(denominations, {
      denominationId: "999",
      denominationLabel: "$25",
      region: "US",
    }),
    undefined,
  );
});

test("livraison : la configuration de livraison est relue depuis la fiche", () => {
  const source = readFileSync(join(srcRoot, "lib/digital-orders.ts"), "utf8");
  const delivery = source.slice(source.indexOf("export async function deliverPaidDigitalOrder"));
  assert.match(
    delivery,
    /const order = await resyncFulfillmentConfig\(/,
    "deliverPaidDigitalOrder doit relire la fiche avant de décider",
  );
  // Le prix payé ne doit jamais être recalculé à la relance.
  const resync = source.slice(
    source.indexOf("async function resyncFulfillmentConfig"),
    source.indexOf("export async function deliverPaidDigitalOrder"),
  );
  assert.equal(
    /unitPriceUsd|totalUsd/.test(resync),
    false,
    "la resynchronisation ne touche jamais au prix payé",
  );
});

/* --------------------- Valeur faciale acceptée par Reloadly ------------------ */

test("valeur faciale : refus explicite quand le produit ne l'accepte pas", () => {
  const fixed = {
    denominationType: "FIXED",
    fixedDenominations: [10, 20, 50, 100],
    minDenomination: null,
    maxDenomination: null,
    currencyCode: "USD",
    productId: 11828,
  };
  assert.equal(core.checkSupplierUnitPrice(fixed, 10).ok, true);
  assert.equal(core.checkSupplierUnitPrice(fixed, 100).ok, true);

  const refused = core.checkSupplierUnitPrice(fixed, 5);
  assert.equal(refused.ok, false);
  // Message actionnable : valeur fautive, valeurs possibles, produit visé.
  assert.match(refused.message, /5 USD n'est pas une valeur acceptée/);
  assert.match(refused.message, /10, 20, 50, 100/);
  assert.match(refused.message, /#11828/);

  const range = {
    denominationType: "RANGE",
    fixedDenominations: [],
    minDenomination: 10,
    maxDenomination: 100,
    currencyCode: "EUR",
    productId: 7,
  };
  assert.equal(core.checkSupplierUnitPrice(range, 25).ok, true);
  assert.equal(core.checkSupplierUnitPrice(range, 10).ok, true);
  assert.match(core.checkSupplierUnitPrice(range, 5).message, /hors de la fourchette/);
  assert.match(core.checkSupplierUnitPrice(range, 150).message, /hors de la fourchette/);

  // Valeur absente : refus explicite, jamais un achat à l'aveugle.
  assert.equal(core.checkSupplierUnitPrice(fixed, 0).ok, false);

  // Données incomplètes chez le fournisseur : on ne bloque pas une vente.
  assert.equal(
    core.checkSupplierUnitPrice({
      denominationType: "FIXED",
      fixedDenominations: [],
      minDenomination: null,
      maxDenomination: null,
    }, 5).ok,
    true,
  );
  assert.equal(
    core.checkSupplierUnitPrice({
      denominationType: "INCONNU",
      fixedDenominations: [],
      minDenomination: null,
      maxDenomination: null,
    }, 5).ok,
    true,
  );
});

test("achat : le prix est contrôlé chez Reloadly AVANT la commande", () => {
  const source = readFileSync(join(srcRoot, "lib/digital-orders.ts"), "utf8");
  const delivery = source.slice(source.indexOf("export async function deliverPaidDigitalOrder"));
  assert.match(delivery, /const priceIssue = await supplierPriceIssue\(productId, unitPrice\)/);
  assert.ok(
    delivery.indexOf("supplierPriceIssue(productId, unitPrice)") <
      delivery.indexOf("createGiftCardOrder({"),
    "le contrôle doit précéder l'achat (aucun débit pour un prix refusé)",
  );

  // Et la caisse refuse la vente avant d'émettre la facture.
  const checkout = source.slice(
    source.indexOf("export async function createDigitalCheckout"),
    source.indexOf("export async function deliverPaidDigitalOrder"),
  );
  assert.match(checkout, /const issue = await supplierPriceIssue\(/);
  assert.ok(checkout.indexOf("supplierPriceIssue(") < checkout.indexOf("newOrderReference("));
});

/* --------------------- Prix de vente et marge nette ------------------------- */

test("marge nette : 4 % sur 20 $ donne 21,50 $ (arrondi au demi supérieur)", () => {
  const plain = core.computeSalePrice({ faceValue: 20, marginPercent: 4, paymentFeePercent: 1 });
  assert.equal(plain.ok, true);
  assert.equal(plain.cost, 20);
  // Brut = 20 / 0,95 = 21,0526 → arrondi 21,50 (jamais 20,80 = « +4 % sur la face »).
  assert.equal(plain.price, 21.5);
  assert.notEqual(plain.price, 20.8);
  // La marge affichée est celle RÉELLEMENT obtenue après arrondi (≥ cible).
  // 21,50 $ pour un coût de 20 $ → 1,285 $ net, soit ~6 % réellement obtenus.
  assert.ok(plain.netMarginPercent >= 4 && plain.netMarginPercent <= 8);
  assert.equal(plain.netProfitUsd, 1.29);
});

test("arrondi : toujours vers le haut, au pas de 0,50", () => {
  assert.equal(core.roundPriceUp(22.27), 22.5);
  assert.equal(core.roundPriceUp(22.0), 22.0);
  assert.equal(core.roundPriceUp(21.51), 22.0);
  assert.equal(core.roundPriceUp(22.5), 22.5); // pas de dérive flottante
  assert.equal(core.roundPriceUp(0.1), 0.5);
  assert.equal(core.roundPriceUp(0), 0);
  // Un prix arrondi ne descend jamais sous le coût.
  const cost = 21.6;
  assert.ok(core.roundPriceUp(cost) >= cost);
});

test("arrondi adaptatif : 0,10 sous 20, 0,50 au-dessus", () => {
  // Une petite carte locale ne doit pas gagner 12 % « par accident ».
  assert.equal(core.roundPriceUpAdaptive(4.02), 4.1);
  assert.equal(core.roundPriceUpAdaptive(19.61), 19.7);
  assert.equal(core.roundPriceUpAdaptive(20), 20);
  assert.equal(core.roundPriceUpAdaptive(21.05), 21.5);
  assert.equal(core.roundPriceUpAdaptive(0), 0);
  assert.equal(core.priceRoundStep(4), 0.1);
  assert.equal(core.priceRoundStep(19.99), 0.1);
  assert.equal(core.priceRoundStep(20), 0.5);
  assert.equal(core.priceRoundStep(59.5), 0.5);
  // Jamais vers le bas, quel que soit le pas.
  for (const value of [0.37, 4.02, 9.99, 19.99, 20.01, 123.456]) {
    assert.ok(core.roundPriceUpAdaptive(value) >= value);
  }
});

test("prix à partir d'un coût USD connu (cartes non-USD)", () => {
  // 500 TRY coûtent ~15,20 $ chez Reloadly : le prix part de LÀ, pas de 500.
  const try500 = core.computeSalePriceFromCost(15.2, 4, 1);
  assert.equal(try500.ok, true);
  assert.equal(try500.cost, 15.2);
  assert.equal(try500.price, 16);
  assert.ok(try500.price >= try500.cost);
  // Petit montant : pas adaptatif, la marge reste proche de la cible.
  const small = core.computeSalePriceFromCost(4, 20, 1);
  assert.equal(small.price, 5.1);
  // Coût inconnu : refus explicite, jamais un prix inventé.
  assert.equal(core.computeSalePriceFromCost(0, 4, 1).ok, false);
  assert.equal(core.computeSalePriceFromCost(null, 4, 1).ok, false);
});

test("marge nette : les frais Reloadly entrent dans le coût réel", () => {
  const withFees = core.computeSalePrice({
    faceValue: 20,
    senderFeePercent: 5,
    marginPercent: 4,
    paymentFeePercent: 1,
  });
  assert.equal(withFees.cost, 21);
  assert.equal(withFees.price, 22.5);
  // La remise du fournisseur diminue le coût.
  const withDiscount = core.computeSalePrice({
    faceValue: 20,
    discountPercent: 2,
    marginPercent: 0,
    paymentFeePercent: 0,
  });
  assert.equal(withDiscount.cost, 19.6);
  // Sous 20, l'arrondi passe au pas de 0,10 : 19,60 reste 19,60.
  assert.equal(withDiscount.price, 19.6);
});

test("marge nette : refus des valeurs incohérentes, jamais de prix nul", () => {
  assert.equal(core.computeSalePrice({ faceValue: null, marginPercent: 4 }).ok, false);
  assert.equal(core.computeSalePrice({ faceValue: 0, marginPercent: 4 }).ok, false);
  assert.equal(core.computeSalePrice({ faceValue: 20, marginPercent: 50 }).ok, false);
  assert.equal(core.computeSalePrice({ faceValue: 20, marginPercent: -1 }).ok, false);
  // Prix toujours au-dessus du coût pour une marge ≥ 0.
  const zero = core.computeSalePrice({ faceValue: 20, marginPercent: 0, paymentFeePercent: 1 });
  assert.ok(zero.price >= zero.cost);
});

test("marge nette : câblage admin (saisie → recalcul → garde-fou)", () => {
  const editor = readFileSync(join(srcRoot, "app/admin/(panel)/digital/digital-editor.tsx"), "utf8");
  assert.match(editor, /const setMargin = /);
  assert.match(editor, /computeSalePrice\(/);
  assert.match(editor, /Marge nette \(%\)/);

  const store = readFileSync(join(srcRoot, "lib/digital-store.ts"), "utf8");
  assert.match(store, /margin_percent|marginPercent/);
  assert.match(store, /export function paymentFeePercent/);

  // Garde-fou serveur : refus d'une vente à perte.
  const actions = readFileSync(join(srcRoot, "app/admin/actions.ts"), "utf8");
  assert.match(actions, /findLosses\(product, reloadlyProductId\)/);
  assert.match(actions, /Vente à perte refusée/);
  assert.match(actions, /paymentFeePercent/);

  const ddl = readFileSync(join(srcRoot, "db/index.ts"), "utf8");
  assert.match(ddl, /digital_products ADD COLUMN IF NOT EXISTS margin_percent/);
});
