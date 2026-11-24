import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateKeyPairSync, sign as rsaSign } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function bundleTs(entryPath) {
  const built = buildSync({
    entryPoints: [path.resolve(repoRoot, entryPath)],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    alias: { "@": path.resolve(repoRoot, "src") },
  });
  const code = built.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

const core = await bundleTs("src/lib/paygate-core.ts");
const validation = await bundleTs("src/lib/validation.ts");

const SAMPLE_MERCHANT_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const SAMPLE_DEPOSIT_WALLET = "0x111122223333444455556666777788889999aAaA";
const SAMPLE_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("Validation du portefeuille EVM : accepte un wallet personnel 0x et rejette les contrats USDC/USDT", () => {
  assert.equal(core.isValidPayGateWallet(SAMPLE_MERCHANT_WALLET), true);
  assert.equal(core.isValidPayGateWallet("  " + SAMPLE_MERCHANT_WALLET + "  "), true);

  // Contrats officiels USDC / USDT sur Polygon & Ethereum -> doivent être refusés !
  assert.equal(
    core.isValidPayGateWallet("0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"),
    false,
  );
  assert.equal(
    core.isValidPayGateWallet("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"),
    false,
  );
  assert.equal(
    core.isValidPayGateWallet("0x0000000000000000000000000000000000000000"),
    false,
  );

  // Formats invalides (Tron T..., trop court, non-hex)
  assert.equal(core.isValidPayGateWallet("TXYZ123456789012345678901234567890"), false);
  assert.equal(core.isValidPayGateWallet("0x1234"), false);
  assert.equal(core.isValidPayGateWallet(""), false);
});

test("normalizePayGateConfig & publicPayGateOption : fermé sans wallet valide et n'expose jamais le wallet 0x côté public", () => {
  const closed = core.normalizePayGateConfig({ enabled: true, usdcPolygonWallet: "" });
  assert.equal(closed.enabled, false);
  assert.equal(core.publicPayGateOption(closed), null);

  const contractAttempt = core.normalizePayGateConfig({
    enabled: true,
    usdcPolygonWallet: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  });
  assert.equal(contractAttempt.enabled, false);
  assert.equal(contractAttempt.usdcPolygonWallet, "");

  const active = core.normalizePayGateConfig({
    enabled: true,
    usdcPolygonWallet: SAMPLE_MERCHANT_WALLET,
    minOrderUsd: 15,
    feePercent: 5,
    minReceivedRatio: 0.82,
  });
  assert.equal(active.enabled, true);
  assert.equal(active.usdcPolygonWallet, SAMPLE_MERCHANT_WALLET);

  const pub = core.publicPayGateOption(active);
  assert.deepEqual(pub, {
    enabled: true,
    minOrderUsd: 15,
    feePercent: 5,
  });
  assert.equal("usdcPolygonWallet" in pub, false);
});

test("calculatePayGateCardQuote : calcule majoration carte et seuil minimal stablecoin", () => {
  const quote = core.calculatePayGateCardQuote(20, {
    feePercent: 5,
    minReceivedRatio: 0.8,
  });
  assert.deepEqual(quote, {
    baseUsd: 20,
    feePercent: 5,
    feeUsd: 1,
    billedUsd: 21,
    minAcceptableUsd: 16,
  });
});

test("buildPayGateCheckoutUrl & payGateKeepEncoded : ne double-encode jamais address_in et injecte domain= sur sous-domaine personnalisé", () => {
  const preEncodedAddress = "enc_addr%2Bslash%2Ftest%3D%3D";
  const url = core.buildPayGateCheckoutUrl({
    addressIn: preEncodedAddress,
    amountUsd: 21.5,
    customerEmail: "client+test@example.com",
    currency: "USD",
    checkoutDomain: "pay.nokhba.net.ly",
    accentColor: "#C6A664",
  });

  assert.ok(url.startsWith("https://pay.nokhba.net.ly/pay.php?"));
  assert.ok(url.includes("domain=pay.nokhba.net.ly"), "doit passer domain= pour le white-label");
  assert.ok(url.includes(`address=${preEncodedAddress}`), "address_in ne doit pas être ré-encodé en %25");
  assert.ok(!url.includes("%252B"));
  assert.ok(url.includes("amount=21.5"));
  assert.ok(url.includes("email=client%2Btest%40example.com"));
  assert.ok(url.includes("currency=USD"));
  assert.ok(url.includes("theme=%23C6A664"));

  const singleProviderUrl = core.buildPayGateCheckoutUrl({
    addressIn: preEncodedAddress,
    amountUsd: 15,
    customerEmail: "buyer@example.com",
    provider: "wert",
  });
  assert.ok(singleProviderUrl.startsWith("https://checkout.paygate.sbs/process-payment.php?"));
  assert.ok(singleProviderUrl.includes("provider=wert"));
});

test("signPayGateOrderToken & verifyPayGateOrderToken : HMAC constant-time insensible à la casse de ref", () => {
  const token = core.signPayGateOrderToken("dgc-abc123", SAMPLE_SECRET);
  assert.equal(core.verifyPayGateOrderToken("DGC-ABC123", token, SAMPLE_SECRET), true);
  assert.equal(core.verifyPayGateOrderToken("DGC-OTHER", token, SAMPLE_SECRET), false);
  assert.equal(core.verifyPayGateOrderToken("DGC-ABC123", token.slice(0, -1) + "0", SAMPLE_SECRET), false);
});

test("verifyPayGateCallbackSignature : valide une signature RSA-SHA256 authentique et bloque toute altération", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const callbackUrl = core.buildPayGateCallbackUrl(
    "https://nokhba.net.ly",
    "DGC-TEST99",
    SAMPLE_SECRET,
  );
  const baseQuery = core.extractRawQuery(callbackUrl);
  const fullRawQuery =
    `${baseQuery}&value_coin=20.00&coin=polygon_usdc&txid_in=0xabc123&txid_out=0xdef456` +
    `&address_in=${SAMPLE_DEPOSIT_WALLET}&value_forwarded_coin=19.80`;

  const signedPayload = `https://nokhba.net.ly/api/payments/paygate/callback?${fullRawQuery}`;
  const signature = rsaSign("sha256", Buffer.from(signedPayload, "utf8"), privateKey).toString(
    "base64",
  );

  const ok = core.verifyPayGateCallbackSignature({
    registeredCallbackUrl: callbackUrl,
    rawQuery: fullRawQuery,
    signature,
    keyId: "test-v1",
    customKeys: { "test-v1": publicKey },
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.reason, "");

  // Altération d'un centime sur value_coin -> rejet immédiat !
  const tampered = core.verifyPayGateCallbackSignature({
    registeredCallbackUrl: callbackUrl,
    rawQuery: fullRawQuery.replace("value_coin=20.00", "value_coin=200.00"),
    signature,
    keyId: "test-v1",
    customKeys: { "test-v1": publicKey },
  });
  assert.equal(tampered.valid, false);
  assert.equal(tampered.reason, "signature_mismatch");

  // Clé publique officielle v1 bien chargeable par OpenSSL/Node
  const withOfficialKey = core.verifyPayGateCallbackSignature({
    registeredCallbackUrl: callbackUrl,
    rawQuery: fullRawQuery,
    signature,
    keyId: "v1",
  });
  assert.equal(withOfficialKey.valid, false);
  assert.equal(withOfficialKey.reason, "signature_mismatch");
});

test("parsePayGateCallbackQuery & validatePayGateSettlement : anti-spoofing, pending, sous-paiement et payout marchand", () => {
  // Même si un attaquant injectait value_coin=9999 en début de query, la dernière
  // valeur ajoutée par PayGate.to écrase la précédente.
  const spoofedQuery =
    `order=dgc-01&token=tok&value_coin=9999&value_coin=19.85&coin=polygon_usdc` +
    `&txid_in=0x123&txid_out=0x456&address_in=${SAMPLE_DEPOSIT_WALLET}` +
    `&value_forwarded_coin=19.65&address_out=${encodeURIComponent(
      JSON.stringify({ [SAMPLE_MERCHANT_WALLET]: 0.99 }),
    )}`;

  const parsed = core.parsePayGateCallbackQuery(spoofedQuery);
  assert.equal(parsed.valueCoin, "19.85");

  const paidDecision = core.validatePayGateSettlement({
    callback: parsed,
    expectedPolygonAddressIn: SAMPLE_DEPOSIT_WALLET,
    expectedMerchantWallet: SAMPLE_MERCHANT_WALLET,
    minAcceptableUsd: 16,
  });
  assert.equal(paidDecision.status, "paid");
  assert.equal(paidDecision.receivedUsd, 19.85);
  assert.equal(paidDecision.merchantPayoutCoin, "19.4535");

  // Transaction encore pending -> ne rien livrer
  const pendingParsed = core.parsePayGateCallbackQuery(`${spoofedQuery}&pending=1`);
  const pendingDecision = core.validatePayGateSettlement({
    callback: pendingParsed,
    expectedPolygonAddressIn: SAMPLE_DEPOSIT_WALLET,
    expectedMerchantWallet: SAMPLE_MERCHANT_WALLET,
    minAcceptableUsd: 16,
  });
  assert.equal(pendingDecision.status, "pending");

  // Sous-paiement -> underpaid
  const underpaidParsed = core.parsePayGateCallbackQuery(
    spoofedQuery.replace("value_coin=19.85", "value_coin=10.50"),
  );
  const underpaidDecision = core.validatePayGateSettlement({
    callback: underpaidParsed,
    expectedPolygonAddressIn: SAMPLE_DEPOSIT_WALLET,
    expectedMerchantWallet: SAMPLE_MERCHANT_WALLET,
    minAcceptableUsd: 16,
  });
  assert.equal(underpaidDecision.status, "underpaid");

  // Mauvaise adresse de dépôt -> rejected
  const wrongAddressDecision = core.validatePayGateSettlement({
    callback: parsed,
    expectedPolygonAddressIn: "0x9999999999999999999999999999999999999999",
    expectedMerchantWallet: SAMPLE_MERCHANT_WALLET,
    minAcceptableUsd: 16,
  });
  assert.equal(wrongAddressDecision.status, "rejected");
});

test("Compatibilité Zod : payGateConfigSchema rejette l'activation sans wallet ou avec contrat USDC, et possède un .default()", () => {
  const defaulted = validation.payGateConfigSchema.parse(undefined);
  assert.equal(defaulted.enabled, false);
  assert.equal(defaulted.minOrderUsd, 15);

  const missingWallet = validation.payGateConfigSchema.safeParse({
    enabled: true,
    usdcPolygonWallet: "",
  });
  assert.equal(missingWallet.success, false);

  const usdcContract = validation.payGateConfigSchema.safeParse({
    enabled: true,
    usdcPolygonWallet: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  });
  assert.equal(usdcContract.success, false);

  const valid = validation.payGateConfigSchema.safeParse({
    enabled: true,
    usdcPolygonWallet: SAMPLE_MERCHANT_WALLET,
    minOrderUsd: 15,
    feePercent: 5,
    minReceivedRatio: 0.8,
  });
  assert.equal(valid.success, true);

  // custom_domain refuse les domaines partagés *.paygate.* (qui déclenchent les antivirus)
  const badCustomDomain = validation.payGateConfigSchema.safeParse({
    enabled: true,
    usdcPolygonWallet: SAMPLE_MERCHANT_WALLET,
    cloakMode: "custom_domain",
    checkoutDomain: "checkout.paygate.to",
  });
  assert.equal(badCustomDomain.success, false);

  const goodCustomDomain = validation.payGateConfigSchema.safeParse({
    enabled: true,
    usdcPolygonWallet: SAMPLE_MERCHANT_WALLET,
    cloakMode: "custom_domain",
    checkoutDomain: "pay.nokhba.net.ly",
  });
  assert.equal(goodCustomDomain.success, true);
});

test("Anti-blocage antivirus : séparation de domaine des jetons, URL first-party sans paygate.*, et extraction de redirection", () => {
  assert.equal(core.isPayGateSharedDomain("checkout.paygate.to"), true);
  assert.equal(core.isPayGateSharedDomain("https://checkout.paygate.sbs/pay.php"), true);
  assert.equal(core.isPayGateSharedDomain("pay.nokhba.net.ly"), false);
  assert.equal(core.isPayGateSharedDomain("widget.wert.io"), false);

  // Si custom_domain est choisi mais sans vrai sous-domaine, repli automatique sur "self"
  assert.equal(
    core.resolveEffectiveCloakMode({
      cloakMode: "custom_domain",
      checkoutDomain: "checkout.paygate.sbs",
    }),
    "self",
  );
  assert.equal(
    core.resolveEffectiveCloakMode({
      cloakMode: "custom_domain",
      checkoutDomain: "pay.nokhba.net.ly",
    }),
    "custom_domain",
  );

  // Séparation stricte des jetons : un jeton d'interface /pay/card ne valide JAMAIS le webhook !
  const uiToken = core.signPayGateCheckoutToken("DGC-SAFE01", SAMPLE_SECRET);
  assert.equal(core.verifyPayGateCheckoutToken("dgc-safe01", uiToken, SAMPLE_SECRET), true);
  assert.equal(core.verifyPayGateOrderToken("DGC-SAFE01", uiToken, SAMPLE_SECRET), false);

  const firstPartyUrl = core.buildFirstPartyPayGateUrl({
    baseOrigin: "https://nokhba.net.ly/",
    orderRef: "DGC-SAFE01",
    checkoutToken: uiToken,
    locale: "ar",
  });
  assert.equal(
    firstPartyUrl,
    `https://nokhba.net.ly/pay/card/DGC-SAFE01?k=${uiToken}&lang=ar`,
  );
  assert.doesNotMatch(firstPartyUrl, /paygate/i);

  // Extraction d'URL processeur externe vs saut interne paygate vs schémas dangereux
  assert.deepEqual(
    core.extractProcessorRedirectUrl({
      status: 302,
      locationHeader: "https://widget.wert.io/default/widget/?commodity=USDC",
    }),
    {
      kind: "external_processor",
      url: "https://widget.wert.io/default/widget/?commodity=USDC",
    },
  );
  assert.deepEqual(
    core.extractProcessorRedirectUrl({
      status: 302,
      locationHeader: "https://checkout.paygate.to/step2.php?id=123",
    }),
    {
      kind: "paygate_hop",
      url: "https://checkout.paygate.to/step2.php?id=123",
    },
  );
  assert.deepEqual(
    core.extractProcessorRedirectUrl({
      status: 200,
      htmlBody: `<script>window.location.replace("https://buy.moonpay.com/?apiKey=pk_live&currencyCode=usdc_polygon");</script>`,
    }),
    {
      kind: "external_processor",
      url: "https://buy.moonpay.com/?apiKey=pk_live&currencyCode=usdc_polygon",
    },
  );
  assert.deepEqual(
    core.extractProcessorRedirectUrl({
      status: 200,
      htmlBody: `<meta http-equiv="refresh" content="0;url=javascript:alert(1)">`,
    }),
    { kind: "none" },
  );

  // Générateur Cloudflare Worker : contient le sous-domaine personnalisé et PGTO-IPCountry
  const workerCode = core.generatePayGateCloudflareWorker({
    customCheckoutDomain: "pay.nokhba.net.ly",
    fallbackUrl: "https://nokhba.net.ly",
  });
  assert.match(workerCode, /"pay\.nokhba\.net\.ly"/);
  assert.match(workerCode, /PGTO-IPCountry/);
});

test("UX Caisse : le clic sur Carte bancaire ne modifie jamais la quantité en silence et demande confirmation sous le minimum (15 $)", () => {
  const dialogSrc = fs.readFileSync(
    path.resolve(repoRoot, "src/components/digital-buy-dialog.tsx"),
    "utf8",
  );
  // Le clic sur l'onglet paygate ne doit PAS appeler setQuantity automatiquement
  assert.match(
    dialogSrc,
    /setPaymentMethod\("paygate"\);\s*setError\(""\);/,
  );
  // Un encart de confirmation explicite informe le client du seuil (ex. 15 $) avant de modifier la quantité
  assert.match(dialogSrc, /Confirmation required — Card payment can only be processed from \$/);
  assert.match(dialogSrc, /تأكيد مطلوب — الدفع بالبطاقة البنكية لا يُنفّذ إلا ابتداءً من/);
  assert.match(dialogSrc, /setQuantity\(minCardQuantity\)/);
});
