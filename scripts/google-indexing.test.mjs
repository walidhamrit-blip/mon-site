#!/usr/bin/env node
/**
 * Tests de la soumission Search Console (`src/lib/google-indexing.ts`).
 *
 * Aucun appel réseau : le JWT est signé avec une paire RSA générée à la
 * volée puis vérifié avec la clé publique, comme le ferait Google.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateKeyPairSync, verify } from "node:crypto";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "google-indexing-"));

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
  normalizePrivateKey,
  readGoogleServiceAccount,
  buildServiceAccountAssertion,
  searchConsoleProperty,
  sitemapUrlFor,
  googleIndexingAllowed,
  notifyGoogleSitemap,
} = await compileModule("lib/google-indexing.ts", "google-indexing.mjs");

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

test("normalizePrivateKey accepte les \\n littéraux et les guillemets", () => {
  const raw = '"-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----"';
  assert.equal(
    normalizePrivateKey(raw),
    "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----",
  );
});

test("readGoogleServiceAccount renvoie null si incomplet", () => {
  assert.equal(readGoogleServiceAccount({}), null);
  assert.equal(
    readGoogleServiceAccount({ GOOGLE_INDEXING_CLIENT_EMAIL: "a@b.c" }),
    null,
  );
  const account = readGoogleServiceAccount({
    GOOGLE_INDEXING_CLIENT_EMAIL: " robot@projet.iam.gserviceaccount.com ",
    GOOGLE_INDEXING_PRIVATE_KEY: privateKey,
  });
  assert.equal(account.clientEmail, "robot@projet.iam.gserviceaccount.com");
  assert.match(account.privateKey, /BEGIN PRIVATE KEY/);
});

test("searchConsoleProperty gère URL, domaine et propriété sc-domain", () => {
  assert.equal(
    searchConsoleProperty("https://nokhba.net.ly"),
    "https://nokhba.net.ly/",
  );
  assert.equal(
    searchConsoleProperty("https://nokhba.net.ly/", "nokhba.net.ly"),
    "https://nokhba.net.ly/",
  );
  assert.equal(
    searchConsoleProperty("https://nokhba.net.ly/", "sc-domain:Nokhba.net.ly/"),
    "sc-domain:nokhba.net.ly",
  );
  assert.equal(
    sitemapUrlFor("https://nokhba.net.ly/"),
    "https://nokhba.net.ly/sitemap.xml",
  );
});

test("le JWT est signé en RS256 et vérifiable avec la clé publique", () => {
  const now = 1_800_000_000_000;
  const assertion = buildServiceAccountAssertion(
    { clientEmail: "robot@projet.iam.gserviceaccount.com", privateKey },
    { now },
  );
  const [encodedHeader, encodedPayload, encodedSignature] = assertion.split(".");
  assert.ok(encodedHeader && encodedPayload && encodedSignature);

  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString());
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
  assert.equal(header.alg, "RS256");
  assert.equal(header.typ, "JWT");
  assert.equal(payload.iss, "robot@projet.iam.gserviceaccount.com");
  assert.equal(payload.aud, "https://oauth2.googleapis.com/token");
  assert.equal(payload.scope, "https://www.googleapis.com/auth/webmasters");
  assert.equal(payload.iat, Math.floor(now / 1000));
  assert.equal(payload.exp - payload.iat, 3600);

  const valid = verify(
    "sha256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    Buffer.from(encodedSignature, "base64url"),
  );
  assert.equal(valid, true);
});

test("googleIndexingAllowed : production, override et refus par défaut", () => {
  assert.equal(googleIndexingAllowed({ VERCEL_ENV: "production" }), true);
  assert.equal(
    googleIndexingAllowed({ GOOGLE_INDEXING_ALLOW_NON_PRODUCTION: "true" }),
    true,
  );
  assert.equal(googleIndexingAllowed({ VERCEL_ENV: "preview" }), false);
});

test("sans configuration, la soumission est ignorée sans appel réseau", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  const previousEmail = process.env.GOOGLE_INDEXING_CLIENT_EMAIL;
  const previousKey = process.env.GOOGLE_INDEXING_PRIVATE_KEY;
  delete process.env.GOOGLE_INDEXING_CLIENT_EMAIL;
  delete process.env.GOOGLE_INDEXING_PRIVATE_KEY;
  try {
    const result = await notifyGoogleSitemap("https://nokhba.net.ly");
    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "not-configured");
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousEmail !== undefined) {
      process.env.GOOGLE_INDEXING_CLIENT_EMAIL = previousEmail;
    }
    if (previousKey !== undefined) {
      process.env.GOOGLE_INDEXING_PRIVATE_KEY = previousKey;
    }
  }
});
