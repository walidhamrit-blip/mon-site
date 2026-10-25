#!/usr/bin/env node
/**
 * Diagnostic d'envoi des e-mails.
 *
 * Incident réel : une commande livrée affichait « E-mail codes : envoyé »
 * alors que le client ne recevait rien — Resend accepte le message, puis
 * l'échec (domaine non vérifié, SPF/DKIM absents, spam) est invisible.
 * Ces tests verrouillent la sonde : fournisseur actif, expéditeur réel, et
 * refus explicite des adresses invalides (aucun appel réseau).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "mail-"));

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

const mailer = await compile("lib/mailer.ts", "mailer");

test.after(() => rmSync(outDir, { recursive: true, force: true }));

const MAIL_ENV = ["RESEND_API_KEY", "SMTP_HOST", "EMAIL_FROM", "EMAIL_DOMAIN", "SITE_URL"];

async function withEnv(patch, fn) {
  const previous = {};
  for (const key of MAIL_ENV) previous[key] = process.env[key];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("aucun fournisseur : la sonde le dit au lieu d'échouer en silence", async () => {
  await withEnv({ RESEND_API_KEY: undefined, SMTP_HOST: undefined, EMAIL_FROM: undefined }, () => {
    const diagnostics = mailer.mailDiagnostics();
    assert.equal(diagnostics.provider, "none");
    assert.equal(diagnostics.configured, false);
  });
});

test("Resend configuré : expéditeur par défaut sur le domaine du site", async () => {
  await withEnv(
    {
      RESEND_API_KEY: "re_test",
      SMTP_HOST: undefined,
      EMAIL_FROM: undefined,
      EMAIL_DOMAIN: "nokhba.net.ly",
    },
    () => {
      const diagnostics = mailer.mailDiagnostics();
      assert.equal(diagnostics.provider, "resend");
      assert.equal(diagnostics.configured, true);
      assert.match(diagnostics.from, /no-reply@nokhba\.net\.ly/);
      assert.equal(diagnostics.fromExplicit, false);
    },
  );
});

test("EMAIL_FROM explicite : c'est lui qui expédie, et la sonde le signale", async () => {
  await withEnv(
    { RESEND_API_KEY: "re_test", EMAIL_FROM: "Nukhba <codes@nokhba.net.ly>" },
    () => {
      const diagnostics = mailer.mailDiagnostics();
      assert.equal(diagnostics.from, "Nukhba <codes@nokhba.net.ly>");
      assert.equal(diagnostics.fromExplicit, true);
    },
  );
});

test("adresse invalide : refus immédiat, sans appel réseau", async () => {
  await withEnv({ RESEND_API_KEY: "re_test" }, async () => {
    for (const bad of ["", "   ", "pas-une-adresse", "a@b"]) {
      const result = await mailer.sendTestEmail(bad);
      assert.equal(result.ok, false, `« ${bad} » doit être refusé`);
      assert.match(result.error, /invalide|destination/);
    }
  });
});

test("la commande mémorise l'identifiant du message et le motif d'échec", () => {
  const source = readFileSync(join(srcRoot, "lib/digital-orders.ts"), "utf8");
  assert.match(source, /emailProviderId/);
  assert.match(source, /emailLastError/);
  // Les trois chemins d'envoi (auto, manuel, renvoi) passent par le même suivi.
  const calls = source.match(/recordEmailOutcome\(/g) ?? [];
  assert.ok(calls.length >= 3, `suivi e-mail attendu sur 3 chemins, trouvé ${calls.length}`);
  const schema = readFileSync(join(srcRoot, "db/schema.ts"), "utf8");
  assert.match(schema, /email_provider_id/);
  assert.match(schema, /email_last_error/);
  const ddl = readFileSync(join(srcRoot, "db/index.ts"), "utf8");
  assert.match(ddl, /ADD COLUMN IF NOT EXISTS email_provider_id/);
  assert.match(ddl, /ADD COLUMN IF NOT EXISTS email_last_error/);
});
