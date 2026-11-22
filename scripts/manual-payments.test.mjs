#!/usr/bin/env node
/**
 * Garde-fous des paiements manuels sans passerelle :
 * Skrill, Neteller, Airtm, D17, Volet (AdvCash), WebMoney et Kashy.
 *
 * Règle centrale : rien n'est encaissé ni livré automatiquement. Le client
 * déclare son virement (compte expéditeur + identifiant de transaction),
 * l'administrateur vérifie à la main, et seulement alors le code est livré.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { manualPaymentsClosedAt } from "../src/lib/manual-payment-hours.ts";
import {
  MANUAL_PAYMENT_CURRENCIES,
  MANUAL_PAYMENT_METHODS,
  MANUAL_PAYMENT_METHOD_CURRENCIES,
  MANUAL_PAYMENT_METHOD_DEFAULT_CURRENCY,
  availableManualPaymentMethods,
  calculateManualPaymentQuote,
  formatManualPaymentAmount,
  isCryptoManualPaymentMethod,
  isDirectCryptoWalletMethod,
  manualPaymentDeliveryRoute,
  resolveManualPaymentGate,
  manualPaymentMethodReady,
  manualPaymentPublicNotice,
  manualPaymentQuoteMatches,
  normalizeManualPaymentMethod,
  normalizeManualPaymentQrImage,
  normalizeManualPaymentsConfig,
  validateManualPaymentInput,
} from "../src/lib/manual-payment-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

// `manual-payment-public.ts` importe via l'alias `@/` : on le bundle comme le
// fait Next.js plutôt que d'exécuter l'alias tel quel sous node.
mkdirSync(join(root, ".scratch"), { recursive: true });
const bundleDir = mkdtempSync(join(root, ".scratch/manual-payments-"));
process.on("exit", () => rmSync(bundleDir, { recursive: true, force: true }));
const aliasPlugin = {
  name: "alias",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => ({
      // esbuild ne résout pas les extensions TS ici : on les ajoute.
      path: join(root, "src", `${args.path.slice(2)}.ts`),
    }));
  },
};
const publicOut = join(bundleDir, "public.mjs");
await build({
  entryPoints: [join(root, "src/lib/manual-payment-public.ts")],
  outfile: publicOut,
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  plugins: [aliasPlugin],
  logLevel: "silent",
});
const validationOut = join(bundleDir, "validation.mjs");
await build({
  entryPoints: [join(root, "src/lib/validation.ts")],
  outfile: validationOut,
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  plugins: [aliasPlugin],
  logLevel: "silent",
});
const { publicManualPaymentOptions } = await import(pathToFileURL(publicOut).href);
const { manualPaymentsConfigSchema } = await import(pathToFileURL(validationOut).href);
const read = (path) => readFileSync(new URL(path, `file://${root}`), "utf8");

/** Retire commentaires et espaces pour tester du code, pas des commentaires. */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const SKRILL = {
  enabled: true,
  account: "agence@example.com",
  beneficiary: "Agence",
  currency: "USD",
  rate: null,
  feePercent: 0,
  instructions: "",
};

test("les moyens manuels demandés existent, avec leurs devises", () => {
  assert.deepEqual(
    [...MANUAL_PAYMENT_METHODS],
    [
      "skrill",
      "neteller",
      "airtm",
      "d17",
      "advcash",
      "webmoney",
      "kashy",
      "binance_pay",
      "okx_pay",
      "bybit_pay",
      "redotpay",
      "usdt_bep20",
      "usdt_trc20",
      "usdt_ton",
      "usdt_polygon",
      "usdt_sol",
    ],
  );
  assert.deepEqual([...MANUAL_PAYMENT_METHOD_CURRENCIES.advcash], ["USD"]);
  assert.deepEqual([...MANUAL_PAYMENT_METHOD_CURRENCIES.webmoney], ["WMZ", "LYD", "EUR", "TND"]);
  assert.deepEqual([...MANUAL_PAYMENT_METHOD_CURRENCIES.kashy], ["TND"]);
  assert.deepEqual([...MANUAL_PAYMENT_METHOD_CURRENCIES.binance_pay], ["USDT", "USD"]);
  assert.deepEqual([...MANUAL_PAYMENT_METHOD_CURRENCIES.okx_pay], ["USDT", "USD"]);
  assert.deepEqual([...MANUAL_PAYMENT_METHOD_CURRENCIES.bybit_pay], ["USDT", "USD"]);
  assert.deepEqual([...MANUAL_PAYMENT_METHOD_CURRENCIES.redotpay], ["USDT", "USD"]);
  assert.deepEqual([...MANUAL_PAYMENT_METHOD_CURRENCIES.usdt_bep20], ["USDT"]);
  assert.deepEqual([...MANUAL_PAYMENT_METHOD_CURRENCIES.usdt_trc20], ["USDT"]);
  assert.equal(MANUAL_PAYMENT_METHOD_DEFAULT_CURRENCY.webmoney, "WMZ");
  assert.equal(MANUAL_PAYMENT_METHOD_DEFAULT_CURRENCY.kashy, "TND");
  assert.equal(MANUAL_PAYMENT_METHOD_DEFAULT_CURRENCY.binance_pay, "USDT");
  assert.equal(MANUAL_PAYMENT_METHOD_DEFAULT_CURRENCY.redotpay, "USDT");
  assert.equal(MANUAL_PAYMENT_METHOD_DEFAULT_CURRENCY.usdt_bep20, "USDT");
  assert.deepEqual([...MANUAL_PAYMENT_CURRENCIES].sort(), ["EUR", "LYD", "TND", "USD", "USDT", "WMZ"]);
  assert.equal(normalizeManualPaymentMethod(" Skrill "), "skrill");
  assert.equal(normalizeManualPaymentMethod("D17"), "d17");
  assert.equal(normalizeManualPaymentMethod("binance_pay"), "binance_pay");
  assert.equal(normalizeManualPaymentMethod("USDT_BEP20"), "usdt_bep20");
  assert.equal(normalizeManualPaymentMethod("paypal"), null);
  assert.equal(normalizeManualPaymentMethod(null), null);
});

test("un moyen n'est utilisable que s'il est activé ET configuré", () => {
  assert.equal(manualPaymentMethodReady(SKRILL), true);
  assert.equal(manualPaymentMethodReady({ ...SKRILL, account: "   " }), false);
  // Hors USD, un taux positif est obligatoire : sinon le montant serait faux.
  assert.equal(
    manualPaymentMethodReady({ ...SKRILL, currency: "LYD", rate: null }),
    false,
  );
  assert.equal(manualPaymentMethodReady({ ...SKRILL, currency: "LYD", rate: 5.4 }), true);

  const config = normalizeManualPaymentsConfig({
    skrill: SKRILL,
    neteller: { ...SKRILL, enabled: false },
    airtm: { ...SKRILL, account: "" },
    d17: { ...SKRILL, currency: "TND", rate: 0 },
  });
  // `enabled` n'est vrai que si le réglage est coché ET complet.
  assert.equal(config.skrill.enabled, true);
  assert.equal(config.neteller.enabled, false);
  assert.equal(config.airtm.enabled, false);
  assert.equal(config.d17.enabled, false);
  assert.deepEqual(availableManualPaymentMethods(config), ["skrill"]);
});

test("les nouveaux moyens sont normalisés et configurés séparément", () => {
  const defaults = normalizeManualPaymentsConfig(undefined);
  assert.equal(defaults.advcash.currency, "USD");
  assert.equal(defaults.webmoney.currency, "WMZ");
  assert.equal(defaults.webmoney.enabled, false);
  assert.equal(defaults.kashy.currency, "TND");
  assert.equal(defaults.kashy.enabled, false);

  const configured = normalizeManualPaymentsConfig({
    advcash: { ...SKRILL, currency: "TND", rate: 3.2, enabled: true },
    webmoney: { ...SKRILL, currency: "EUR", rate: 0.92, enabled: true },
    kashy: { ...SKRILL, currency: "TND", rate: 3.1, enabled: true },
  });
  // AdvCash est forcé en USD ; Kashy reste exclusivement en TND.
  assert.equal(configured.advcash.currency, "USD");
  assert.equal(configured.advcash.enabled, true);
  assert.equal(configured.webmoney.currency, "EUR");
  assert.equal(configured.webmoney.enabled, true);
  assert.equal(configured.kashy.currency, "TND");
  assert.equal(configured.kashy.enabled, true);

  const incomplete = normalizeManualPaymentsConfig({
    kashy: { ...SKRILL, currency: "TND", rate: null, enabled: true },
  });
  assert.equal(incomplete.kashy.enabled, false);

  // WMZ n’est pas l’USD : le moyen reste fermé tant que le taux n’est pas saisi.
  const legacyUsd = normalizeManualPaymentsConfig({
    webmoney: { ...SKRILL, currency: "USD", rate: null, enabled: true },
  });
  assert.equal(legacyUsd.webmoney.currency, "WMZ");
  assert.equal(legacyUsd.webmoney.enabled, false);
  assert.equal(
    manualPaymentMethodReady({ ...SKRILL, currency: "WMZ", rate: null }),
    false,
  );
  assert.equal(
    manualPaymentMethodReady({ ...SKRILL, currency: "WMZ", rate: 0.995 }),
    true,
  );

  // Crypto Pay ID & USDT direct : devise USDT 1:1 par défaut, prête sans taux manuel.
  assert.equal(defaults.binance_pay.currency, "USDT");
  assert.equal(defaults.binance_pay.enabled, false);
  assert.equal(defaults.usdt_bep20.currency, "USDT");
  assert.equal(
    manualPaymentMethodReady({ ...SKRILL, account: "123456789", currency: "USDT", rate: null }),
    true,
  );
  const cryptoConfigured = normalizeManualPaymentsConfig({
    binance_pay: { ...SKRILL, account: "987654321", currency: "USDT", rate: null, enabled: true },
    usdt_bep20: { ...SKRILL, account: "0xAbCdEf123456", currency: "EUR", rate: 0.92, enabled: true },
    redotpay: { ...SKRILL, account: "RD-100200", currency: "USDT", feePercent: 1, enabled: true },
  });
  assert.equal(cryptoConfigured.binance_pay.enabled, true);
  assert.equal(cryptoConfigured.binance_pay.currency, "USDT");
  // USDT BEP20 reste forcé en USDT même si une autre devise a été soumise.
  assert.equal(cryptoConfigured.usdt_bep20.currency, "USDT");
  assert.equal(cryptoConfigured.usdt_bep20.enabled, true);
  assert.equal(cryptoConfigured.redotpay.enabled, true);
});

test("le schéma Zod accepte un objet partiel historique et les nouvelles devises USDT", () => {
  const legacyParsed = manualPaymentsConfigSchema.safeParse({
    skrill: SKRILL,
  });
  assert.equal(legacyParsed.success, true);
  if (legacyParsed.success) {
    assert.equal(legacyParsed.data.skrill.enabled, true);
    assert.equal(legacyParsed.data.binance_pay.enabled, false);
    assert.equal(legacyParsed.data.binance_pay.currency, "USDT");
    assert.equal(legacyParsed.data.usdt_bep20.currency, "USDT");
    assert.equal(legacyParsed.data.binance_pay.qrImage, "");
  }

  const validQr = manualPaymentsConfigSchema.safeParse({
    binance_pay: {
      ...SKRILL,
      account: "123456789",
      currency: "USDT",
      qrImage: "/api/media/qr-binance.png",
    },
  });
  assert.equal(validQr.success, true);

  const unsafeQr = manualPaymentsConfigSchema.safeParse({
    binance_pay: {
      ...SKRILL,
      account: "123456789",
      currency: "USDT",
      qrImage: "javascript:alert(1)",
    },
  });
  assert.equal(unsafeQr.success, false);
});

test("QR code crypto : détection des méthodes, assainissement d'image et câblage UI", () => {
  assert.equal(isCryptoManualPaymentMethod("binance_pay"), true);
  assert.equal(isCryptoManualPaymentMethod("usdt_trc20"), true);
  assert.equal(isCryptoManualPaymentMethod("skrill"), false);
  assert.equal(isDirectCryptoWalletMethod("usdt_bep20"), true);
  assert.equal(isDirectCryptoWalletMethod("binance_pay"), false);

  assert.equal(normalizeManualPaymentQrImage("/api/media/qr.png"), "/api/media/qr.png");
  assert.equal(normalizeManualPaymentQrImage("https://cdn.example.com/qr.png"), "https://cdn.example.com/qr.png");
  assert.equal(normalizeManualPaymentQrImage("javascript:alert(1)"), "");
  assert.equal(normalizeManualPaymentQrImage("http://insecure.example.com/qr.png"), "");
  assert.equal(normalizeManualPaymentQrImage("//evil.example.com/qr.png"), "");

  const options = publicManualPaymentOptions({
    binance_pay: {
      ...SKRILL,
      account: "99887766",
      currency: "USDT",
      qrImage: "/api/media/binance-qr.png",
      enabled: true,
    },
    usdt_trc20: {
      ...SKRILL,
      account: "TXyz123456",
      currency: "USDT",
      qrImage: "javascript:alert(1)",
      enabled: true,
    },
  });
  const binance = options.find((item) => item.method === "binance_pay");
  const trc20 = options.find((item) => item.method === "usdt_trc20");
  assert.equal(binance?.qrImage, "/api/media/binance-qr.png");
  assert.equal(trc20?.qrImage, undefined);

  const formCode = code(read("src/components/manual-payment-form.tsx"));
  assert.match(formCode, /CryptoQrCode/);
  assert.match(formCode, /isCryptoManualPaymentMethod/);
  const qrComponent = code(read("src/components/crypto-qr-code.tsx"));
  assert.match(qrComponent, /QRCode\.create/);
  assert.match(qrComponent, /buildQrSvgData/);
  const settingsCode = code(read("src/app/admin/(panel)/settings/manual-payments-settings.tsx"));
  assert.match(settingsCode, /\/api\/admin\/media/);
  assert.match(settingsCode, /qrImage/);
});

test("le montant à envoyer est calculé depuis le réglage, jamais codé en dur", () => {
  const usd = calculateManualPaymentQuote(100, "skrill", SKRILL);
  assert.equal(usd?.payAmount, 100);
  assert.equal(usd?.payCurrency, "USD");

  const usdt = calculateManualPaymentQuote(25, "binance_pay", {
    ...SKRILL,
    account: "987654321",
    currency: "USDT",
    rate: null,
    feePercent: 0,
  });
  assert.equal(usdt?.payCurrency, "USDT");
  assert.equal(usdt?.payRate, 1);
  assert.equal(usdt?.payAmount, 25);

  const usdtWithFee = calculateManualPaymentQuote(100, "usdt_trc20", {
    ...SKRILL,
    account: "TXyz123456",
    currency: "USDT",
    rate: null,
    feePercent: 1,
  });
  assert.equal(usdtWithFee?.payCurrency, "USDT");
  assert.equal(usdtWithFee?.payAmount, 101);

  // 1 USD = 5,4 LYD + 8 % → 100 USD = 583,20 LYD (pas « 1 USD = 1 USD »).
  const lyd = calculateManualPaymentQuote(100, "d17", {
    ...SKRILL,
    currency: "LYD",
    rate: 5.4,
    feePercent: 8,
  });
  assert.equal(lyd?.payCurrency, "LYD");
  assert.equal(lyd?.payAmount, 583.2);

  const eur = calculateManualPaymentQuote(39.99, "neteller", {
    ...SKRILL,
    currency: "EUR",
    rate: 0.92,
    feePercent: 0,
  });
  assert.equal(eur?.payAmount, 36.79);

  // Un moyen fermé n'a jamais de devis.
  assert.equal(
    calculateManualPaymentQuote(100, "skrill", { ...SKRILL, enabled: false }),
    null,
  );
  assert.equal(
    calculateManualPaymentQuote(100, "skrill", { ...SKRILL, currency: "LYD", rate: null }),
    null,
  );
});

test("un devis modifié entre l'affichage et l'envoi est détecté", () => {
  const expected = calculateManualPaymentQuote(100, "airtm", {
    ...SKRILL,
    currency: "LYD",
    rate: 5.4,
    feePercent: 10,
  });
  assert.ok(expected);
  assert.equal(manualPaymentQuoteMatches({ ...expected }, expected), true);
  // Taux changé côté admin (5,4 → 6,1) : le client doit redonner son accord.
  assert.equal(manualPaymentQuoteMatches({ ...expected, payRate: 6.1 }, expected), false);
  // Montant différent : refus.
  assert.equal(manualPaymentQuoteMatches({ ...expected, payAmount: 1 }, expected), false);
  // Méthode différente : refus.
  assert.equal(manualPaymentQuoteMatches({ ...expected, method: "d17" }, expected), false);
  assert.equal(manualPaymentQuoteMatches(null, expected), false);
});

test("la preuve exige le compte expéditeur ET l'identifiant de transaction", () => {
  const valid = validateManualPaymentInput({
    method: "skrill",
    senderName: "Ahmed",
    senderAccount: "ahmed@example.com",
    transactionRef: "SKR-998877",
    note: "envoi du 16/11",
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.method, "skrill");
    assert.equal(valid.value.transactionRef, "SKR-998877");
  }

  for (const input of [
    undefined,
    { method: "skrill", senderName: "Ahmed", senderAccount: "ahmed@example.com" },
    { method: "skrill", senderName: "Ahmed", transactionRef: "SKR-1" },
    { method: "skrill", senderAccount: "ahmed@example.com", transactionRef: "SKR-1" },
    { method: "skrill", senderName: "A", senderAccount: "ahmed@example.com", transactionRef: "SKR-1" },
    { method: "skrill", senderName: "Ahmed", senderAccount: "a", transactionRef: "SKR-1" },
    { method: "skrill", senderName: "Ahmed", senderAccount: "ahmed@example.com", transactionRef: "x" },
    { method: "paypal", senderName: "Ahmed", senderAccount: "ahmed@example.com", transactionRef: "SKR-1" },
  ]) {
    assert.equal(validateManualPaymentInput(input).ok, false);
  }
});

test("les caractères de contrôle sont retirés de la preuve", () => {
  const result = validateManualPaymentInput({
    method: "neteller",
    senderName: "Ah\u0000med\u0007",
    senderAccount: "ahmed@example.com\n",
    transactionRef: "NET\t12345",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    // Les caractères de contrôle deviennent des espaces (jamais des
    // suppressions silencieuses qui colleraient deux mots).
    assert.equal(result.value.senderName, "Ah med");
    assert.equal(result.value.senderAccount, "ahmed@example.com");
    assert.equal(result.value.transactionRef, "NET 12345");
  }
});

test("la livraison n'est autorisée qu'après acceptation admin", () => {
  // Un paiement manuel en attente ne va JAMAIS chez le fournisseur.
  assert.equal(
    manualPaymentDeliveryRoute({ isManual: true, status: "pending", autoDeliver: true }),
    "blocked",
  );
  assert.equal(
    manualPaymentDeliveryRoute({ isManual: true, status: "rejected", autoDeliver: true }),
    "blocked",
  );
  // Accepté sans consigne de livraison automatique : livraison manuelle.
  assert.equal(
    manualPaymentDeliveryRoute({ isManual: true, status: "approved", autoDeliver: false }),
    "manual",
  );
  // Accepté + admin a cliqué « accepter et livrer » : achat autorisé.
  assert.equal(
    manualPaymentDeliveryRoute({ isManual: true, status: "approved", autoDeliver: true }),
    "supplier",
  );
  // Une commande qui n'est pas un paiement manuel garde son chemin normal.
  assert.equal(
    manualPaymentDeliveryRoute({ isManual: false, status: "pending", autoDeliver: false }),
    "supplier",
  );
});

test("les messages publics ne promettent jamais une livraison", () => {
  const pending = manualPaymentPublicNotice("pending", "ar");
  const approved = manualPaymentPublicNotice("approved", "ar");
  const rejected = manualPaymentPublicNotice("rejected", "ar");
  for (const message of [pending, approved, rejected]) {
    assert.ok(message.length > 10);
    // Aucun secret : ni compte à créditer, ni identifiant de transaction.
    assert.doesNotMatch(message, /agence@example\.com|SKR-998877/);
  }
  assert.match(manualPaymentPublicNotice("pending", "en"), /verif|pending|received/i);
  assert.equal(formatManualPaymentAmount(583.2, "LYD"), "583.20 LYD");
});

test("la route d'options ne divulgue que les moyens réellement proposables", () => {
  const options = publicManualPaymentOptions({
    skrill: SKRILL,
    neteller: { ...SKRILL, enabled: false },
    airtm: { ...SKRILL, currency: "TND", rate: null },
    d17: { ...SKRILL, currency: "LYD", rate: 5.4, feePercent: 5, enabled: true },
    advcash: { ...SKRILL, account: "volet-id", enabled: true },
    webmoney: { ...SKRILL, account: "WMID-123", currency: "EUR", rate: 0.92, enabled: true },
    kashy: { ...SKRILL, account: "+21600000000", currency: "TND", rate: 3.1, enabled: true },
    binance_pay: { ...SKRILL, account: "99887766", currency: "USDT", rate: null, enabled: true },
    usdt_bep20: { ...SKRILL, account: "0x1234abcd", currency: "USDT", rate: null, enabled: true },
  });
  assert.deepEqual(
    options.map((option) => option.method),
    ["skrill", "d17", "advcash", "webmoney", "kashy", "binance_pay", "usdt_bep20"],
  );
  const binance = options.find((option) => option.method === "binance_pay");
  assert.equal(binance?.currency, "USDT");
  assert.equal(binance?.rate, 1);
  // Un compte fermé ne fuit pas dans le navigateur.
  assert.equal(JSON.stringify(options).includes("agence@example.com"), true);
  const d17 = options.find((option) => option.method === "d17");
  assert.equal(d17?.currency, "LYD");
  assert.equal(d17?.rate, 5.4);

  const closed = publicManualPaymentOptions({
    skrill: { ...SKRILL, enabled: false },
  });
  assert.deepEqual(closed, []);
});

test("la caisse des codes exige la preuve et n'appelle aucune passerelle", () => {
  const checkout = code(read("src/lib/fazercards-orders.ts"));
  assert.match(checkout, /manual_payment_method_unavailable/);
  assert.match(checkout, /manual_payment_quote_unconfirmed/);
  assert.match(checkout, /manual_payment_quote_changed/);
  assert.match(checkout, /manual_payment_already_used/);
  assert.match(checkout, /sendManualPaymentReviewNotice/);
  // Aucune facture NOWPayments sur le chemin manuel : la caisse renvoie un
  // lien de suivi au lieu d'un `invoice_url`.
  assert.match(checkout, /if \(usesManualPayment\)/);
  assert.match(checkout, /insertPreparedManualPayment/);

  const route = code(read("src/app/api/fazercards/checkout/route.ts"));
  assert.match(route, /manualPayment: parsed\.data\.manualPayment/);
  assert.match(route, /"manual"/);
});

test("les trois autres tunnels acceptent aussi le virement manuel", () => {
  const create = code(read("src/app/api/payments/create/route.ts"));
  assert.match(create, /attachManualPayment/);
  assert.match(create, /createFlexibleManualOrder/);
  // Une tranche ultérieure peut être réglée par virement.
  assert.match(create, /manualPayment\?: unknown/);

  const reserve = code(read("src/app/api/payments/reserve/route.ts"));
  assert.match(reserve, /prepareManualPaymentForSite/);
  assert.match(reserve, /manualPayment: z/);

  const subscribe = code(read("src/app/api/subscriptions/create/route.ts"));
  assert.match(subscribe, /createManualClientSubscription/);
  assert.match(read("src/lib/subscriptions.ts"), /approveManualSubscription/);
});

test("la livraison est verrouillée tant que le paiement n'est pas accepté", () => {
  const digital = code(read("src/lib/digital-orders.ts"));
  // Garde avant le chemin fournisseur : deux points d'entrée de livraison.
  assert.match(digital, /manualPaymentDeliveryGate\(loaded\.ref\)/);
  assert.match(digital, /manualPaymentDeliveryGate\(ref\)/);
  assert.match(digital, /manualPaymentDeliveryGate\(order\.ref\)/);
  assert.match(digital, /manualPaymentDeliveryRoute/);
  // Le statut public expose la vérification manuelle sans fuiter la preuve.
  assert.match(digital, /manualPaymentPublicNotice/);
  assert.doesNotMatch(digital, /manualPaymentStatus:.*senderAccount/);
});

test("l'acceptation marque la commande payée sans déclencher d'achat", () => {
  const layer = code(read("src/lib/manual-payments.ts"));
  // Jamais `paid` sur la commande digitale : ce statut laisserait le cron acheter.
  assert.match(layer, /status: "manual"/);
  assert.match(layer, /manual_payment_\$\{decision\}/);
  assert.match(layer, /status: decision, reviewedAt/);
  // Une preuve déjà traitée n'est jamais rejouée.
  assert.match(layer, /eq\(manualPayments\.status, "pending"\)/);
});

test("l'admin reçoit une file de vérification dédiée", () => {
  const actions = code(read("src/app/admin/manual-payments-actions.ts"));
  assert.match(actions, /requireAdmin\(\)/);
  assert.match(actions, /reviewManualPaymentAction/);
  // Refus sans motif interdit, comme pour la carte téléphonique.
  assert.match(code(read("src/lib/manual-payments.ts")), /Indiquez le motif du refus/);
  assert.match(actions, /sendManualPaymentApprovedEmail/);
  assert.match(actions, /approveManualSubscription/);

  const page = code(read("src/app/admin/(panel)/paiements-manuels/page.tsx"));
  assert.match(page, /listManualPayments/);
  const nav = read("src/app/admin/(panel)/admin-nav.tsx");
  assert.match(nav, /\/admin\/paiements-manuels/);
  assert.match(nav, /\/admin\/settings\?tab=manual-payments/);
  assert.match(nav, /Configurer les paiements/);
  // Garde anti-404 : le dossier doit correspondre exactement au lien de la
  // navigation (Next.js sert /admin/paiements-manuels depuis ce dossier).
  assert.ok(existsSync("src/app/admin/(panel)/paiements-manuels/page.tsx"));
  assert.ok(!existsSync("src/app/admin/(panel)/manual-payments/page.tsx"));
});

test("les moyens se règlent depuis l'admin, devise et taux compris", () => {
  const settings = code(read("src/app/admin/(panel)/settings/manual-payments-settings.tsx"));
  assert.match(settings, /MANUAL_PAYMENT_METHOD_CURRENCIES\[method\]/);
  assert.match(settings, /advcash/);
  assert.match(settings, /webmoney/);
  assert.match(settings, /kashy/);
  assert.match(settings, /MANUAL_PAYMENT_METHOD_CURRENCIES/);
  assert.match(settings, /feePercent/);
  assert.match(settings, /DecimalInput/);
  assert.match(settings, /decimals=\{2\}/);
  const settingsForm = read("src/app/admin/(panel)/settings/settings-form.tsx");
  const settingsCode = code(settingsForm);
  assert.match(settingsCode, /ManualPaymentsSettings/);
  assert.match(settingsCode, /id: "manualPayments", label: "Paiements manuels"/);
  assert.match(settingsCode, /tab === "manualPayments"/);
  const manualPage = code(read("src/app/admin/(panel)/paiements-manuels/page.tsx"));
  assert.match(manualPage, /\/admin\/settings\?tab=manual-payments/);
});

test("le tableau de bord pilote chaque paiement manuel séparément", () => {
  const overview = code(read("src/app/admin/(panel)/manual-payments-overview.tsx"));
  assert.match(overview, /MANUAL_PAYMENT_METHODS\.map/);
  assert.match(overview, /<PhoneCardPaymentsToggle/);
  assert.match(overview, /setManualPaymentMethodEnabled/);
  assert.match(overview, /role="switch"/);
  assert.match(overview, /Configurer les comptes/);

  const actions = code(read("src/app/admin/manual-payments-actions.ts"));
  assert.match(actions, /setManualPaymentMethodEnabled/);
  assert.match(actions, /manualPaymentMethodReady/);
  assert.match(actions, /normalizeManualPaymentsConfig/);
  assert.match(actions, /les reçus déjà déclarés restent traitables/i);
});

test("la preuve n'est jamais publiée dans une réponse publique", () => {
  const digital = code(read("src/lib/digital-orders.ts"));
  // Le statut public ne remonte que méthode + statut de vérification.
  assert.match(digital, /manualPaymentMethod: manualGate\.isManual \? manualGate\.method : null/);
  assert.doesNotMatch(digital, /senderAccount:/);
  const emails = code(read("src/lib/digital-emails.ts"));
  // L'e-mail client d'acceptation ne contient aucun identifiant de transaction.
  const approved = emails.slice(emails.indexOf("sendManualPaymentApprovedEmail"));
  assert.doesNotMatch(approved, /transactionRef/);
});

test("les pratiques commerciales sont décrites dans les conditions", () => {
  const conditions = read("src/app/(site)/conditions/conditions-client.tsx");
  assert.match(conditions, /Skrill|Neteller|Airtm|D17/);
});


test("un paiement manuel incomplet ou non approuvé bloque même si la commande est payée", () => {
  for (const reviewStatus of ["pending", "rejected", null, "invalid"]) {
    const gate = resolveManualPaymentGate({ orderExists: true, paymentMethod: "skrill", recordExists: true, recordMethod: "skrill", reviewStatus });
    assert.equal(manualPaymentDeliveryRoute({ ...gate, autoDeliver: true }), "blocked");
  }
  for (const data of [
    { orderExists: true, paymentMethod: "skrill", recordExists: false, recordMethod: null, reviewStatus: null },
    { orderExists: true, paymentMethod: "skrill", recordExists: true, recordMethod: "", reviewStatus: "approved" },
    { orderExists: true, paymentMethod: "skrill", recordExists: true, recordMethod: "neteller", reviewStatus: "approved" },
    { orderExists: false, paymentMethod: null, recordExists: false, recordMethod: null, reviewStatus: null },
    { orderExists: true, paymentMethod: "nowpayments", recordExists: true, recordMethod: "skrill", reviewStatus: "approved" },
  ]) assert.equal(manualPaymentDeliveryRoute({ ...resolveManualPaymentGate(data), autoDeliver: true }), "blocked");
  const approved = resolveManualPaymentGate({ orderExists: true, paymentMethod: "skrill", recordExists: true, recordMethod: "skrill", reviewStatus: "approved" });
  assert.equal(manualPaymentDeliveryRoute({ ...approved, autoDeliver: true }), "supplier");
  const crypto = resolveManualPaymentGate({ orderExists: true, paymentMethod: "nowpayments", recordExists: false, recordMethod: null, reviewStatus: null });
  assert.equal(manualPaymentDeliveryRoute({ ...crypto, autoDeliver: false }), "supplier");
});

test("FazerCards contrôle le paiement manuel avant de placer une commande", () => {
  const src = readFileSync(join(root, "src/lib/fazercards-orders.ts"), "utf8");
  const guard = src.indexOf("manualPaymentDeliveryGate(loaded.ref)");
  const purchase = src.indexOf("placeFazercardsOrder(loaded)");
  assert.ok(guard > 0 && guard < purchase);
  assert.match(src, /manualPaymentApproved: options.manualPaymentApproved === true|autoDeliver: options.manualPaymentApproved === true/);
});


test("fermeture quotidienne 00 h à 09 h, heure de Tripoli, avec bornes exactes", () => {
  for (const [stamp, closed] of [
    ["2026-11-20T21:59:59Z", false],
    ["2026-11-20T22:00:00Z", true],
    ["2026-11-21T06:59:59Z", true],
    ["2026-11-21T07:00:00Z", false],
    ["2026-06-01T22:00:00Z", true],
    ["2026-06-02T07:00:00Z", false],
  ]) assert.equal(manualPaymentsClosedAt(new Date(stamp)), closed, stamp);
  assert.equal(manualPaymentsClosedAt(new Date("invalid")), true);
});

test("la disponibilité générale est contrôlée côté serveur pour les tunnels et l'affichage", () => {
  const manual = readFileSync(join(root, "src/lib/manual-payments.ts"), "utf8");
  const shop = readFileSync(join(root, "src/lib/fazercards-orders.ts"), "utf8");
  const phone = readFileSync(join(root, "src/lib/phone-card-availability.ts"), "utf8");
  const options = readFileSync(join(root, "src/app/api/manual-payments/options/route.ts"), "utf8");
  assert.ok((manual.match(/await assertManualPaymentsAvailable\((?:locale)?\)/g) ?? []).length >= 2);
  assert.ok((shop.match(/await assertManualPaymentsAvailable\(locale\)/g) ?? []).length >= 2);
  assert.match(phone, /readManualPaymentsAvailability\(\)/);
  assert.match(options, /availability.status !== "enabled"/);
  assert.match(options, /options: \[\]/);
});
