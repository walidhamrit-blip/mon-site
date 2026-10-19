#!/usr/bin/env node
/**
 * Diagnostic de mise en service — `npm run doctor`
 *
 * Vérifie, avant déploiement, tout ce qui est nécessaire pour que le site
 * quitte le mode « dégradé » (réglages non persistés, réservations
 * impossibles) :
 *   1. PostgreSQL   — connexion réelle + tables attendues ;
 *   2. Admin        — mot de passe et secret de session ;
 *   3. NOWPayments  — clé réellement acceptée (GET /currencies) ;
 *   4. E-mails      — facultatif.
 *
 * Aucun secret n'est affiché : seuls des booléens, codes HTTP et messages
 * d'erreur sont imprimés.
 */

import { existsSync } from "node:fs";
import dotenv from "dotenv";
import pg from "pg";

// .env.local est prioritaire sur .env ; les variables déjà exportées dans le
// shell restent prioritaires sur les deux (comportement de dotenv).
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) dotenv.config({ path: file, quiet: true });
}

const results = [];
const ok = (label, detail = "") => results.push({ level: "ok", label, detail });
const warn = (label, detail = "") =>
  results.push({ level: "warn", label, detail });
const fail = (label, detail = "") =>
  results.push({ level: "fail", label, detail });

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 58 - title.length))}`);
}

/* ───────────────────────────── 1. PostgreSQL ───────────────────────────── */

section("PostgreSQL (réglages, demandes, paiements)");
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  fail(
    "DATABASE_URL absente",
    "Créez une base PostgreSQL (Neon, Supabase ou Vercel Postgres), puis ajoutez sa chaîne de connexion dans .env.local / les variables Vercel.",
  );
} else {
  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10_000,
    ssl: /sslmode=disable/i.test(databaseUrl) ? false : undefined,
  });
  try {
    await client.connect();
    await client.query("select 1");
    ok("Connexion PostgreSQL", new URL(databaseUrl).host);

    const { rows } = await client.query(
      `select tablename from pg_tables
        where schemaname = 'public'
          and tablename = any($1::text[])`,
      [["leads", "settings", "orders"]],
    );
    const existing = new Set(rows.map((row) => row.tablename));
    const missing = ["leads", "settings", "orders"].filter(
      (t) => !existing.has(t),
    );
    if (missing.length === 0) {
      ok("Tables présentes", "leads, settings, orders");
    } else {
      warn(
        `Tables manquantes : ${missing.join(", ")}`,
        "Elles sont créées automatiquement au premier chargement du site (ensureSchema). Ouvrez /admin une fois, puis relancez ce diagnostic.",
      );
    }
  } catch (error) {
    fail(
      "Base injoignable",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    await client.end().catch(() => {});
  }
}

/* ──────────────────────────────── 2. Admin ─────────────────────────────── */

section("Panneau d'administration");
const adminPassword = process.env.ADMIN_PASSWORD?.trim();
const sessionSecret = process.env.SESSION_SECRET?.trim();

if (!adminPassword) {
  fail(
    "ADMIN_PASSWORD absente",
    "Sans elle, /admin/login reste fermé. Choisissez un mot de passe long et aléatoire.",
  );
} else if (adminPassword.length < 10) {
  warn("ADMIN_PASSWORD courte", "10 caractères minimum recommandés.");
} else {
  ok("ADMIN_PASSWORD définie");
}

if (!sessionSecret) {
  warn(
    "SESSION_SECRET absente",
    "La session sera signée avec ADMIN_PASSWORD. Recommandé : `openssl rand -hex 32`.",
  );
} else if (sessionSecret === adminPassword) {
  warn(
    "SESSION_SECRET identique à ADMIN_PASSWORD",
    "Utilisez deux secrets distincts.",
  );
} else {
  ok("SESSION_SECRET défini");
}

/* ───────────────────────────── 3. NOWPayments ──────────────────────────── */

section("NOWPayments (acompte 1 $ et paiements)");
const sandbox =
  (process.env.NOWPAYMENTS_SANDBOX ?? "")
    .replace(/["'\s]/g, "")
    .toLowerCase() === "true" ||
  (process.env.NOWPAYMENTS_SANDBOX ?? "").trim() === "1";
const apiKey = (process.env.NOWPAYMENTS_API_KEY ?? "").replace(/["'\s]/g, "");
const apiBase = (
  process.env.NOWPAYMENTS_API_BASE?.trim() ||
  (sandbox
    ? "https://api-sandbox.nowpayments.io/v1"
    : "https://api.nowpayments.io/v1")
).replace(/\/+$/, "");

if (!apiKey) {
  fail(
    "NOWPAYMENTS_API_KEY absente",
    "Sans clé, /api/payments/reserve répond `gateway_not_configured` (503). Créez un compte NOWPayments puis Settings → API keys.",
  );
} else {
  try {
    const response = await fetch(`${apiBase}/currencies`, {
      method: "GET",
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      ok(
        "Clé API acceptée",
        sandbox ? "environnement sandbox" : "environnement production",
      );
    } else {
      const body = (await response.text().catch(() => "")).slice(0, 200);
      fail(
        `Clé API refusée (HTTP ${response.status})`,
        `${body || "réponse vide"} — vérifiez que la clé correspond à l'environnement (sandbox ↔ NOWPAYMENTS_SANDBOX=true) et qu'il s'agit bien de la clé API, pas du secret IPN.`,
      );
    }
  } catch (error) {
    fail(
      "Passerelle NOWPayments injoignable",
      error instanceof Error ? error.message : String(error),
    );
  }

  if (!process.env.NOWPAYMENTS_IPN_SECRET?.trim()) {
    warn(
      "NOWPAYMENTS_IPN_SECRET absente",
      "Le secret IPN retombe sur la clé API. Recommandé : Settings → IPN → copier le secret.",
    );
  } else {
    ok("NOWPAYMENTS_IPN_SECRET défini");
  }

  const siteUrl = process.env.SITE_URL?.trim();
  if (!siteUrl) {
    warn(
      "SITE_URL absente",
      "Les retours succès/annulation et l'IPN utiliseront l'URL par défaut du site. Renseignez le domaine public.",
    );
  } else {
    ok("SITE_URL défini", siteUrl.replace(/\/+$/, ""));
  }

  if (sandbox) {
    warn(
      "Mode sandbox actif",
      "Les paiements sont des tests. Pour encaisser réellement : clé de production + NOWPAYMENTS_SANDBOX vide/false.",
    );
  }
}

/* ─────────────────────────────── 4. E-mails ────────────────────────────── */

section("E-mails de confirmation (facultatif)");
if (process.env.RESEND_API_KEY?.trim()) {
  ok("Resend configuré");
} else if (process.env.SMTP_HOST?.trim()) {
  ok("SMTP configuré", process.env.SMTP_HOST.trim());
} else {
  warn(
    "Aucun fournisseur d'e-mail",
    "Les demandes restent enregistrées, mais aucune confirmation n'est envoyée. Ajoutez RESEND_API_KEY ou SMTP_HOST.",
  );
}

/* ──────────────────────────────── Résumé ───────────────────────────────── */

const failures = results.filter((r) => r.level === "fail");
const warnings = results.filter((r) => r.level === "warn");

console.log("\n── Résumé " + "─".repeat(49));
for (const { level, label, detail } of results) {
  const mark = level === "ok" ? "✓" : level === "warn" ? "!" : "✗";
  console.log(`${mark} ${label}`);
  if (detail) console.log(`   ${detail}`);
}

console.log(
  `\n${failures.length} bloquant(s), ${warnings.length} avertissement(s).`,
);
if (failures.length === 0) {
  console.log(
    "Tout est prêt. Vérifiez aussi /api/health après déploiement (ok:true).",
  );
} else {
  console.log(
    "Corrigez les points ✗ ci-dessus, puis relancez `npm run doctor`.",
  );
}

process.exitCode = failures.length > 0 ? 1 : 0;
