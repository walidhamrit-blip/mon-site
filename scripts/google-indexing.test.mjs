#!/usr/bin/env node
/**
 * Tests de l'intégration Google Search Console (`src/lib/google-indexing.ts`).
 *
 * Aucun appel réseau : le JWT est signé avec une paire RSA générée à la
 * volée puis vérifié avec la clé publique, et les appels HTTP Google APIs
 * sont simulés localement.
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
  isPreviewOrLocalOrigin,
  googleIndexingAllowed,
  getSearchConsoleConfigStatus,
  notifyGoogleSitemap,
  fetchGoogleSitemapStatus,
  fetchSearchConsoleSnapshot,
  parseSearchConsoleCsv,
  classifySearchConsoleOpportunities,
  resetGoogleTokenCache,
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

test("isPreviewOrLocalOrigin bloque localhost, vercel.app et e2b.app", () => {
  assert.equal(isPreviewOrLocalOrigin("http://localhost:3000"), true);
  assert.equal(isPreviewOrLocalOrigin("https://mon-site-amber-nine.vercel.app"), true);
  assert.equal(isPreviewOrLocalOrigin("https://3000-sandbox.e2b.app"), true);
  assert.equal(isPreviewOrLocalOrigin("https://nokhba.net.ly"), false);
});

test("getSearchConsoleConfigStatus n'expose jamais la clé privée", () => {
  const status = getSearchConsoleConfigStatus("https://nokhba.net.ly", {
    GOOGLE_INDEXING_CLIENT_EMAIL: "bot@test.iam.gserviceaccount.com",
    GOOGLE_INDEXING_PRIVATE_KEY: privateKey,
    GOOGLE_INDEXING_SITE_URL: "sc-domain:nokhba.net.ly",
    VERCEL_ENV: "production",
  });
  assert.equal(status.configured, true);
  assert.equal(status.clientEmail, "bot@test.iam.gserviceaccount.com");
  assert.equal(status.privateKeyConfigured, true);
  assert.equal(status.property, "sc-domain:nokhba.net.ly");
  assert.equal("privateKey" in status, false);
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

test("notifyGoogleSitemap refuse les domaines preview même avec allowManualAdmin", async () => {
  const previousEmail = process.env.GOOGLE_INDEXING_CLIENT_EMAIL;
  const previousKey = process.env.GOOGLE_INDEXING_PRIVATE_KEY;
  process.env.GOOGLE_INDEXING_CLIENT_EMAIL = "robot@projet.iam.gserviceaccount.com";
  process.env.GOOGLE_INDEXING_PRIVATE_KEY = privateKey;
  try {
    const result = await notifyGoogleSitemap("https://preview-test.vercel.app", {
      allowManualAdmin: true,
    });
    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "preview-or-local-origin");
  } finally {
    if (previousEmail === undefined) delete process.env.GOOGLE_INDEXING_CLIENT_EMAIL;
    else process.env.GOOGLE_INDEXING_CLIENT_EMAIL = previousEmail;
    if (previousKey === undefined) delete process.env.GOOGLE_INDEXING_PRIVATE_KEY;
    else process.env.GOOGLE_INDEXING_PRIVATE_KEY = previousKey;
  }
});

test("parseSearchConsoleCsv et classifySearchConsoleOpportunities extraient Page 2 et faible CTR", () => {
  const csv = [
    "\uFEFFRequêtes les plus fréquentes,Page,Clics,Impressions,CTR,Position",
    '"acheter carte steam, libye",https://nokhba.net.ly/codes/steam,3,180,1.67%,12.3',
    "pubg uc libya,https://nokhba.net.ly/codes/pubg,1,240,0.42%,4.2",
    "nukhba studio,https://nokhba.net.ly/,45,90,50%,1.1",
  ].join("\n");

  const rows = parseSearchConsoleCsv(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].query, "acheter carte steam, libye");
  assert.equal(rows[0].impressions, 180);
  assert.ok(Math.abs(rows[0].ctr - 0.0167) < 0.0005);

  const { quickWins, lowCtrPageOne } = classifySearchConsoleOpportunities(rows);
  assert.equal(quickWins.length, 1);
  assert.equal(quickWins[0].query, "acheter carte steam, libye");
  assert.equal(quickWins[0].kind, "page2_quick_win");

  assert.equal(lowCtrPageOne.length, 1);
  assert.equal(lowCtrPageOne[0].query, "pubg uc libya");
  assert.equal(lowCtrPageOne[0].kind, "page1_low_ctr");
});

test("fetchSearchConsoleSnapshot agrège KPIs 28j, deltas, sitemap et Quick Wins", async () => {
  resetGoogleTokenCache();
  const originalFetch = globalThis.fetch;
  const previousEmail = process.env.GOOGLE_INDEXING_CLIENT_EMAIL;
  const previousKey = process.env.GOOGLE_INDEXING_PRIVATE_KEY;
  const previousSite = process.env.GOOGLE_INDEXING_SITE_URL;

  process.env.GOOGLE_INDEXING_CLIENT_EMAIL = "robot@projet.iam.gserviceaccount.com";
  process.env.GOOGLE_INDEXING_PRIVATE_KEY = privateKey;
  process.env.GOOGLE_INDEXING_SITE_URL = "sc-domain:nokhba.net.ly";

  let analyticsCallIndex = 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      return new Response(
        JSON.stringify({ access_token: "mock-token-123", expires_in: 3600 }),
        { status: 200 },
      );
    }
    if (u.includes("/sitemaps/")) {
      return new Response(
        JSON.stringify({
          lastSubmitted: "2026-11-20T08:00:00Z",
          lastDownloaded: "2026-11-24T06:00:00Z",
          warnings: "0",
          errors: "0",
          contents: [{ type: "web", submitted: "155", indexed: "142" }],
        }),
        { status: 200 },
      );
    }
    if (u.includes("/searchAnalytics/query")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (Array.isArray(body.dimensions) && body.dimensions.length === 0) {
        analyticsCallIndex += 1;
        const payload =
          analyticsCallIndex === 1
            ? { rows: [{ clicks: 150, impressions: 3000, ctr: 0.05, position: 11.2 }] }
            : { rows: [{ clicks: 100, impressions: 2500, ctr: 0.04, position: 13.0 }] };
        return new Response(JSON.stringify(payload), { status: 200 });
      }
      if (body.dimensions?.[0] === "page") {
        return new Response(
          JSON.stringify({
            rows: [
              {
                keys: ["https://nokhba.net.ly/codes"],
                clicks: 80,
                impressions: 1200,
                ctr: 0.066,
                position: 6.4,
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          rows: [
            {
              keys: ["gift cards libya usdt", "https://nokhba.net.ly/codes"],
              clicks: 2,
              impressions: 160,
              ctr: 0.0125,
              position: 11.8,
            },
            {
              keys: ["design site web tripoli", "https://nokhba.net.ly/creation-sites"],
              clicks: 2,
              impressions: 210,
              ctr: 0.0095,
              position: 5.1,
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response("Not Found", { status: 404 });
  };

  try {
    const snap = await fetchSearchConsoleSnapshot("https://nokhba.net.ly", {
      days: 28,
      nowMs: Date.parse("2026-11-24T12:00:00Z"),
    });
    assert.equal(snap.status, "ok");
    assert.equal(snap.summary.current.clicks, 150);
    assert.equal(snap.summary.previous.clicks, 100);
    assert.equal(snap.summary.deltas.clicksPct, 50);
    assert.equal(snap.summary.deltas.positionDiff, -1.8);
    assert.equal(snap.sitemap.status, "ok");
    assert.equal(snap.sitemap.submittedUrls, 155);
    assert.equal(snap.sitemap.indexedUrls, 142);
    assert.equal(snap.quickWins.length, 1);
    assert.equal(snap.quickWins[0].query, "gift cards libya usdt");
    assert.equal(snap.lowCtrPageOne.length, 1);
    assert.equal(snap.lowCtrPageOne[0].query, "design site web tripoli");

    const smOnly = await fetchGoogleSitemapStatus("https://nokhba.net.ly");
    assert.equal(smOnly.status, "ok");
    assert.equal(smOnly.submittedUrls, 155);
  } finally {
    globalThis.fetch = originalFetch;
    resetGoogleTokenCache();
    if (previousEmail === undefined) delete process.env.GOOGLE_INDEXING_CLIENT_EMAIL;
    else process.env.GOOGLE_INDEXING_CLIENT_EMAIL = previousEmail;
    if (previousKey === undefined) delete process.env.GOOGLE_INDEXING_PRIVATE_KEY;
    else process.env.GOOGLE_INDEXING_PRIVATE_KEY = previousKey;
    if (previousSite === undefined) delete process.env.GOOGLE_INDEXING_SITE_URL;
    else process.env.GOOGLE_INDEXING_SITE_URL = previousSite;
  }
});
