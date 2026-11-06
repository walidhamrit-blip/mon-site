#!/usr/bin/env node
/**
 * Séparation de la clé de chiffrement des codes — garde-fous de l'étape 5.
 *
 * Ce que ces tests protègent :
 *   1. le FORMAT des charges déjà en base (des charges de référence,
 *      chiffrées par l'implémentation d'avant la séparation, doivent rester
 *      déchiffrables) ;
 *   2. le TROUSSEAU (nouvelle clé d'abord, anciennes en lecture seule) : définir
 *      DIGITAL_CODES_SECRET ne doit jamais rendre un code illisible ;
 *   3. le sens du CHIFFREMENT (toujours la clé courante, jamais une ancienne) ;
 *   4. les garde-fous du script de migration (`npm run codes:rotate`) ;
 *   5. le câblage des diagnostics (santé + doctor) qui signalent une clé de
 *      session encore utilisée.
 */

import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "digital-keys-"));
after(() => rmSync(outDir, { recursive: true, force: true }));

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
  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}

const codes = await compile("lib/digital-codes.ts", "digital-codes");
const tokens = await compile("lib/delivery-tokens.ts", "delivery-tokens");

/* ─────────────────────── environnement contrôlé ─────────────────────────── */

const ENV_KEYS = [
  "DIGITAL_CODES_SECRET",
  "DIGITAL_CODES_SECRET_PREVIOUS",
  "DIGITAL_CODES_DROP_LEGACY_FALLBACK",
  "SESSION_SECRET",
];

const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
after(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

/** Fixe l'environnement de chiffrement pour un test (les autres variables sont vidées). */
function env(values = {}) {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) process.env[key] = value;
  }
}

/*
 * Charges de référence produites par l'implémentation d'AVANT la séparation,
 * avec DIGITAL_CODES_SECRET = FIXTURE_SECRET. Elles garantissent que le
 * découpage en modules (`encryptEnvelope`) n'a pas changé le format sur le
 * disque : `iv.tag.chiffré`, base64url, Aes-256-GCM.
 */
const FIXTURE_SECRET = "fixture-secret-0123456789";
const CODES_FIXTURE =
  "VoDtdx42g5dHWPym.fgvl-2xTueRheMv1KHAQ0Q.Je1BCdG7g4Bs6CffF54vz8TALUIG8BUVZJsmj9oI9Qke-_XW6hFuQXbF9VkHOUcDVjH6rgqTHY9fHVAMUq_WQ4meJQDXZajdg5n_MJEa73dvow";
const TOKEN_FIXTURE =
  "yFIuVKGd1-4bl08B.rmL_77Rpn5YGA8KnskO8eA.IdoREdl2gzFihfHZTg7c_BWbc-hBvAf50FGd9cw";
const PHONE_FIXTURE = "BgEQlNbZP6ZFaqLa.LEscXQRgwfpMT24uIVe7iw.MOHUeb6sJ_8Ddg";
const FIXTURE_CODES = [
  { cardNumber: "4111111111111111", pin: "1234" },
  { cardNumber: "5555444433332222" },
];

/* ─────────────────── 1. le format stocké ne change pas ──────────────────── */

test("les charges chiffrées avant la séparation restent lisibles", () => {
  env({ DIGITAL_CODES_SECRET: FIXTURE_SECRET });

  assert.deepEqual(
    codes.decryptDigitalCodes(CODES_FIXTURE, codes.digitalCodesKeyRing()),
    FIXTURE_CODES,
  );
  assert.equal(tokens.decryptDeliveryToken(TOKEN_FIXTURE), "jeton-de-livraison-0123456789");
  assert.equal(
    codes.decryptEnvelopeWithKey(PHONE_FIXTURE, codes.deriveCodesKey(FIXTURE_SECRET)),
    "0912345678",
  );
});

test("une charge altérée n'est jamais déchiffrée", () => {
  env({ DIGITAL_CODES_SECRET: FIXTURE_SECRET });
  const [iv, tag, data] = CODES_FIXTURE.split(".");
  const tampered = [iv, tag, `${data.slice(0, -2)}${data.endsWith("AA") ? "BB" : "AA"}`].join(".");
  assert.deepEqual(codes.decryptDigitalCodes(tampered, codes.digitalCodesKeyRing()), []);
  assert.deepEqual(codes.decryptDigitalCodes("a.b.c", codes.digitalCodesKeyRing()), []);
  assert.deepEqual(codes.decryptDigitalCodes(null, codes.digitalCodesKeyRing()), []);
});

/* ──────────────── 2. le trousseau protège les données en base ───────────── */

test("sans aucun secret, rien n'est chiffré et rien n'est lisible", () => {
  env({});
  assert.equal(codes.digitalCodesKey(), null);
  assert.deepEqual(codes.digitalCodesKeyRing(), []);
  assert.equal(codes.digitalCodesKeySource(), "none");
  assert.deepEqual(codes.decryptDigitalCodes(CODES_FIXTURE, codes.digitalCodesKeyRing()), []);
  assert.equal(tokens.encryptDeliveryToken("x"), null);
});

test("historiquement, la clé de session chiffre et déchiffre", () => {
  env({ SESSION_SECRET: "session-A" });
  assert.equal(codes.digitalCodesKeySource(), "session");
  const key = codes.digitalCodesKey();
  const cipher = codes.encryptDigitalCodes(FIXTURE_CODES, key);
  assert.deepEqual(codes.decryptDigitalCodes(cipher, codes.digitalCodesKeyRing()), FIXTURE_CODES);
});

test("définir DIGITAL_CODES_SECRET ne rend pas les anciens codes illisibles", () => {
  env({ SESSION_SECRET: "session-A" });
  const legacyCipher = codes.encryptDigitalCodes(FIXTURE_CODES, codes.digitalCodesKey());

  // Bascule : la clé dédiée devient la clé courante, la session reste en repli.
  env({ DIGITAL_CODES_SECRET: "dedicated-B", SESSION_SECRET: "session-A" });
  assert.equal(codes.digitalCodesKeySource(), "dedicated");
  assert.equal(codes.digitalCodesKeyRing().length, 2);
  assert.deepEqual(
    codes.decryptDigitalCodes(legacyCipher, codes.digitalCodesKeyRing()),
    FIXTURE_CODES,
  );

  // La clé historique est bien la SECONDE : c'est ce que le script de
  // migration utilise pour savoir quelles lignes ré-chiffrer.
  const [, legacyKey] = codes.digitalCodesKeyRing();
  assert.notEqual(codes.decryptDigitalCodesWithKey(legacyCipher, legacyKey), null);
  assert.equal(codes.decryptDigitalCodesWithKey(legacyCipher, codes.digitalCodesKey()), null);
});

test("le chiffrement utilise toujours la clé courante, jamais une ancienne", () => {
  env({ DIGITAL_CODES_SECRET: "dedicated-B", SESSION_SECRET: "session-A" });
  const cipher = codes.encryptDigitalCodes(FIXTURE_CODES, codes.digitalCodesKey());

  assert.deepEqual(
    codes.decryptDigitalCodesWithKey(cipher, codes.deriveCodesKey("dedicated-B")),
    FIXTURE_CODES,
  );
  assert.equal(codes.decryptDigitalCodesWithKey(cipher, codes.deriveCodesKey("session-A")), null);
});

test("une ancienne clé dédiée survit à une rotation via ..._PREVIOUS", () => {
  env({ DIGITAL_CODES_SECRET: "old-dedicated" });
  const cipher = codes.encryptDigitalCodes(FIXTURE_CODES, codes.digitalCodesKey());

  env({
    DIGITAL_CODES_SECRET: "new-dedicated",
    DIGITAL_CODES_SECRET_PREVIOUS: "old-dedicated, encore-plus-ancienne",
    // Même avec le repli de session coupé, une rotation explicite reste lisible.
    DIGITAL_CODES_DROP_LEGACY_FALLBACK: "true",
    SESSION_SECRET: "session-A",
  });
  const ring = codes.digitalCodesKeyRing();
  assert.equal(ring.length, 3);
  // Ordre garanti : clé courante, puis ..._PREVIOUS dans l'ordre déclaré.
  assert.ok(ring[0].equals(codes.deriveCodesKey("new-dedicated")));
  assert.ok(ring[1].equals(codes.deriveCodesKey("old-dedicated")));
  assert.ok(ring[2].equals(codes.deriveCodesKey("encore-plus-ancienne")));
  assert.deepEqual(codes.decryptDigitalCodes(cipher, ring), FIXTURE_CODES);
});

test("couper le repli de session rend la clé de session inopérante", () => {
  env({ SESSION_SECRET: "session-A" });
  const legacyCipher = codes.encryptDigitalCodes(FIXTURE_CODES, codes.digitalCodesKey());

  env({
    DIGITAL_CODES_SECRET: "dedicated-B",
    SESSION_SECRET: "session-A",
    DIGITAL_CODES_DROP_LEGACY_FALLBACK: "true",
  });
  assert.equal(codes.digitalCodesKeyRing().length, 1);
  assert.deepEqual(codes.decryptDigitalCodes(legacyCipher, codes.digitalCodesKeyRing()), []);
});

test("les secrets vides ou en double ne créent pas de clés fantômes", () => {
  env({
    DIGITAL_CODES_SECRET: "dedicated-B",
    DIGITAL_CODES_SECRET_PREVIOUS: " , dedicated-B , ",
    SESSION_SECRET: "   ",
  });
  assert.equal(codes.digitalCodesKeyRing().length, 1);
});

test("l'API de déchiffrement accepte encore une clé seule", () => {
  env({ DIGITAL_CODES_SECRET: FIXTURE_SECRET });
  const key = codes.deriveCodesKey(FIXTURE_SECRET);
  assert.deepEqual(codes.decryptDigitalCodes(CODES_FIXTURE, key), FIXTURE_CODES);
  assert.deepEqual(codes.decryptDigitalCodes(CODES_FIXTURE, null), []);
});

/* ────────────── 3. jetons de livraison : même trousseau, autre domaine ──── */

test("jetons de livraison : trousseau aligné sur celui des codes", () => {
  env({ SESSION_SECRET: "session-A" });
  const legacyToken = tokens.encryptDeliveryToken("jeton-de-livraison-0123456789");

  env({ DIGITAL_CODES_SECRET: "dedicated-B", SESSION_SECRET: "session-A" });
  assert.equal(tokens.decryptDeliveryToken(legacyToken), "jeton-de-livraison-0123456789");

  env({
    DIGITAL_CODES_SECRET: "dedicated-B",
    SESSION_SECRET: "session-A",
    DIGITAL_CODES_DROP_LEGACY_FALLBACK: "true",
  });
  assert.equal(tokens.decryptDeliveryToken(legacyToken), null);
});

test("les domaines de dérivation codes / jetons restent distincts", () => {
  const codesKey = codes.deriveCodesKey("meme-secret");
  const tokenKey = tokens.deriveDeliveryTokenKey("meme-secret");
  assert.notEqual(codesKey.toString("hex"), tokenKey.toString("hex"));
});

/* ───────────── 4. script de migration `npm run codes:rotate` ────────────── */

const rotateScript = join(root, "scripts", "reencrypt-digital-codes.mjs");
const rotateSource = readFileSync(rotateScript, "utf8");

test("le script de migration existe et est branché dans package.json", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts["codes:rotate"], "node scripts/reencrypt-digital-codes.mjs");
  assert.match(pkg.scripts["test:crypto"], /digital-codes-keyring\.test\.mjs/);
});

test("le script de migration est en simulation par défaut", () => {
  assert.match(rotateSource, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(rotateSource, /process\.argv\.includes\("--help"\)/);
});

test("le script de migration couvre les trois colonnes chiffrées", () => {
  for (const column of ["codes_cipher", "code_cipher", "tracking_token_cipher"]) {
    assert.ok(rotateSource.includes(column), `colonne absente du script : ${column}`);
  }
  // L'empreinte HMAC des recharges dépend de la clé : elle doit être recalculée,
  // sinon la détection de doublon se dégrade après rotation.
  assert.match(rotateSource, /code_fingerprint/);
  assert.match(rotateSource, /nukhba-phone-card:/);
});

test("le script de migration réutilise les mêmes domaines de dérivation", () => {
  const appSource = readFileSync(join(srcRoot, "lib", "digital-codes.ts"), "utf8");
  const tokenSource = readFileSync(join(srcRoot, "lib", "delivery-tokens.ts"), "utf8");
  for (const prefix of ["nukhba-digital-codes:", "nukhba-delivery-token:"]) {
    assert.ok(rotateSource.includes(prefix), `préfixe absent du script : ${prefix}`);
    assert.ok(
      appSource.includes(prefix) || tokenSource.includes(prefix),
      `préfixe absent de l'application : ${prefix}`,
    );
  }
  // Dérivation identique : SHA-256 de « préfixe + secret ».
  assert.match(rotateSource, /createHash\("sha256"\)\s*\.update\(`\$\{prefix\}\$\{secret\}`\)/);
});

test("le script refuse de tourner sans database ni secret", () => {
  const run = (args, envPatch) =>
    spawnSync(process.execPath, [rotateScript, ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: "", DIGITAL_CODES_SECRET: "", SESSION_SECRET: "", ...envPatch },
      timeout: 20_000,
    });

  const noDatabase = run([], {});
  assert.equal(noDatabase.status, 1);
  assert.match(noDatabase.stderr, /DATABASE_URL/);

  const help = run(["--help"], {});
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--apply/);

  const withoutDedicatedKey = run([], {
    DATABASE_URL: "postgres://user:pass@127.0.0.1:1/none",
    SESSION_SECRET: "session-A",
  });
  assert.equal(withoutDedicatedKey.status, 0);
  assert.match(withoutDedicatedKey.stdout, /DIGITAL_CODES_SECRET n'est pas défini/);
});

/* ──────────────── 5. diagnostics : la dette est visible ─────────────────── */

const readSource = (relative) => readFileSync(join(root, relative), "utf8");

test("la sonde de santé signale une clé de session encore utilisée", () => {
  const health = readSource("src/app/api/health/route.ts");
  assert.match(health, /import \{ digitalCodesKeySource \} from "@\/lib\/digital-codes"/);
  assert.match(health, /codesKeySource === "session"/);
  assert.match(health, /npm run codes:rotate/);
  assert.match(health, /rotationPending/);
});

test("le doctor explique quoi faire (et renvoie vers codes:rotate)", () => {
  const doctor = readSource("scripts/check-setup.mjs");
  assert.match(doctor, /DIGITAL_CODES_DROP_LEGACY_FALLBACK/);
  assert.match(doctor, /codes:rotate/);
});

test("les points d'écriture et de lecture passent par le trousseau", () => {
  const phoneCards = readSource("src/lib/phone-card-payments.ts");
  // Écriture : chiffrement avec la clé courante (enveloppe partagée).
  assert.match(phoneCards, /const codeCipher = encryptEnvelope\(validated\.value\.code, key\)/);
  // Lecture : toutes les clés, pas seulement la courante.
  assert.match(phoneCards, /for \(const key of digitalCodesKeyRing\(\)\)/);

  const digitalOrders = readSource("src/lib/digital-orders.ts");
  // 4 lectures de codes : 3 appellent le trousseau sur place, la 4e (liste
  // admin) le calcule une fois pour toutes les lignes.
  const ringCalls =
    digitalOrders.match(/decryptDigitalCodes\([^)]*digitalCodesKeyRing\(\)\)/g) ?? [];
  assert.equal(ringCalls.length, 3, "chaque lecture de codes doit essayer tout le trousseau");
  assert.match(digitalOrders, /const keys = digitalCodesKeyRing\(\);/);
  assert.match(digitalOrders, /decryptDigitalCodes\(row\.codesCipher, keys\)/);
  // Aucune lecture ne doit se contenter de la clé courante.
  assert.doesNotMatch(digitalOrders, /decryptDigitalCodes\([^)]*digitalCodesKey\(\)/);
});

test("le script de migration est documenté pour l'exploitant", () => {
  const envExample = readSource(".env.example");
  for (const name of [
    "DIGITAL_CODES_SECRET",
    "DIGITAL_CODES_SECRET_PREVIOUS",
    "DIGITAL_CODES_DROP_LEGACY_FALLBACK",
  ]) {
    assert.ok(envExample.includes(name), `variable absente de .env.example : ${name}`);
  }
  assert.match(envExample, /codes:rotate/);
});
