#!/usr/bin/env node
/**
 * Vérifier qu'une livraison de code a réellement eu lieu — `npm run delivery:check`
 *
 *   npm run delivery:check -- DGC-XXXXXXXXXXXX     # une commande précise
 *   npm run delivery:check -- --audit             # les 7 derniers jours
 *   npm run delivery:check -- --audit --days=30
 *   npm run delivery:check -- DGC-… --json         # sortie machine
 *
 * Lit `DATABASE_URL` dans l'environnement, sinon `.env.local` puis `.env`.
 * ⚠️  Le script interroge la base pointée par cette variable : vérifiez la
 * ligne « Base » affichée (prod ou preview) avant de conclure quoi que ce soit.
 *
 * Codes de sortie : 0 = livré (ou audit sans incident), 1 = non livré /
 * incident, 2 = erreur de configuration ou base injoignable.
 *
 * Aucun secret n'est affiché : ni code, ni adresse e-mail complète, ni
 * chaîne de connexion (seulement l'hôte).
 */

import { existsSync } from "node:fs";
import dotenv from "dotenv";
import pg from "pg";
import { deliveryVerdict, maskEmail } from "./delivery-check-core.mjs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) dotenv.config({ path: file, quiet: true });
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const audit = args.includes("--audit");
const daysArg = args.find((arg) => arg.startsWith("--days="));
const days = Math.min(365, Math.max(1, Number(daysArg?.split("=")[1] ?? 7) || 7));
const refArg = args.find((arg) => !arg.startsWith("--"));

const ICONS = { ok: "✅", warn: "⚠️ ", fail: "❌" };

function fail(message, hint = "") {
  if (json) {
    console.log(JSON.stringify({ ok: false, error: message, hint }, null, 2));
  } else {
    console.error(`\n❌ ${message}`);
    if (hint) console.error(`   ${hint}`);
  }
  process.exit(2);
}

function frDate(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().replace("T", " ").slice(0, 16).replace(/-/g, "/") + " UTC";
}

function line(label, value) {
  console.log(`  ${label.padEnd(13)} ${value}`);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  fail(
    "DATABASE_URL absente.",
    "Ajoutez la chaîne PostgreSQL de production dans .env.local (jamais dans Git).",
  );
}
if (!audit && !refArg) {
  fail(
    "Référence manquante.",
    "Usage : npm run delivery:check -- DGC-XXXXXXXXXXXX (ou --audit pour un bilan).",
  );
}

let host = "hôte inconnu";
try {
  host = new URL(databaseUrl).host;
} catch {
  fail("DATABASE_URL illisible (ce n'est pas une URL postgresql://…).");
}

const client = new pg.Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10_000,
  ssl: /sslmode=disable/i.test(databaseUrl) ? false : undefined,
});

const ORDER_QUERY = `
  select
    d.ref,
    d.status,
    d.kind,
    d.fulfillment,
    d.product_title,
    d.denomination_label,
    d.quantity,
    d.total_usd,
    d.recipient_email,
    d.created_at,
    d.delivered_at,
    d.email_sent_at,
    d.email_provider_id,
    d.email_last_error,
    d.attempts,
    d.last_error,
    d.reloadly_transaction_id,
    d.reloadly_status,
    (d.codes_cipher is not null) as codes_stored,
    p.ref           as payment_ref,
    p.status        as payment_status,
    p.payment_method,
    p.created_at    as payment_created_at,
    pc.status       as phone_card_status,
    pc.reviewed_at  as phone_card_reviewed_at,
    pc.review_note  as phone_card_note
  from digital_orders d
  left join lateral (
    select ref, status, payment_method, created_at
    from orders
    where digital_order_id = d.id
    order by created_at desc
    limit 1
  ) p on true
  left join phone_card_payments pc on pc.order_ref = d.ref
  where upper(d.ref) = $1
  limit 1
`;

function rowToOrder(row) {
  return {
    status: row.status,
    kind: row.kind,
    hasCodesCipher: row.codes_stored,
    quantity: row.quantity,
    deliveredAt: row.delivered_at,
    emailSentAt: row.email_sent_at,
    emailLastError: row.email_last_error,
    paymentMethod: row.payment_method,
    phoneCardStatus: row.phone_card_status,
  };
}

async function checkOne(ref) {
  const wanted = ref.trim().toUpperCase();
  const { rows } = await client.query(ORDER_QUERY, [wanted]);

  if (rows.length === 0) {
    // Distinguer « pas une commande de code » de « référence mal tapée ».
    const other = await client
      .query(
        "select ref, kind, status from orders where upper(ref) = $1 limit 1",
        [wanted],
      )
      .catch(() => ({ rows: [] }));

    if (json) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            ref: wanted,
            error: "not_found",
            hint: other.rows[0]
              ? `Cette référence existe dans « orders » (kind=${other.rows[0].kind}) mais pas dans digital_orders : ce n'est pas une commande de code.`
              : "Aucune commande de code avec cette référence dans la base interrogée.",
          },
          null,
          2,
        ),
      );
    } else {
      console.log(`\n❌ ${wanted} — commande de code introuvable dans la base interrogée.`);
      console.log(`   Base : ${host}`);
      if (other.rows[0]) {
        console.log(
          `   La référence existe dans « orders » (kind=${other.rows[0].kind}, statut=${other.rows[0].status}) :`,
        );
        console.log("   ce n'est pas une commande de code (site, abonnement, réservation…).");
      } else {
        console.log("   Vérifiez la référence (copiée depuis l'e-mail ?), et la base :");
        console.log("   .env.local pointe peut-être une Preview, pas la production.");
      }
    }
    process.exit(1);
  }

  const row = rows[0];
  const verdict = deliveryVerdict(rowToOrder(row));

  if (json) {
    console.log(
      JSON.stringify(
        {
          ok: verdict.level !== "fail",
          level: verdict.level,
          code: verdict.code,
          headline: verdict.headline,
          detail: verdict.detail,
          actions: verdict.actions,
          order: {
            ref: row.ref,
            status: row.status,
            kind: row.kind,
            fulfillment: row.fulfillment,
            productTitle: row.product_title,
            denominationLabel: row.denomination_label,
            quantity: row.quantity,
            totalUsd: row.total_usd,
            recipientEmail: maskEmail(row.recipient_email),
            createdAt: frDate(row.created_at),
            deliveredAt: frDate(row.delivered_at),
            emailSentAt: frDate(row.email_sent_at),
            emailProviderId: row.email_provider_id,
            emailLastError: row.email_last_error,
            attempts: row.attempts,
            lastError: row.last_error,
            codesStored: row.codes_stored,
            supplierTransactionId: row.reloadly_transaction_id,
            supplierStatus: row.reloadly_status,
            paymentRef: row.payment_ref,
            paymentStatus: row.payment_status,
            paymentMethod: row.payment_method,
            phoneCardStatus: row.phone_card_status,
            phoneCardReviewedAt: frDate(row.phone_card_reviewed_at),
            phoneCardNote: row.phone_card_note,
          },
          databaseHost: host,
        },
        null,
        2,
      ),
    );
    process.exit(verdict.level === "fail" ? 1 : 0);
  }

  console.log(`\n${ICONS[verdict.level]} ${row.ref} — ${verdict.headline}`);
  console.log("");
  line("Base", host);
  line("Produit", `${row.product_title}${row.denomination_label ? ` — ${row.denomination_label}` : ""}${row.quantity > 1 ? ` × ${row.quantity}` : ""}`);
  line("Montant", `${row.total_usd} USD`);
  line("Client", maskEmail(row.recipient_email));
  line("Créée le", frDate(row.created_at));
  line(
    "Paiement",
    row.payment_ref
      ? `${row.payment_ref} · ${row.payment_status ?? "?"} · ${row.payment_method ?? "?"}`
      : "aucune ligne « orders » liée",
  );
  if (row.payment_method === "phone_card") {
    const reviewLabel =
      {
        pending: "à vérifier (livraison verrouillée)",
        approved: "acceptée par l'admin",
        rejected: "refusée",
      }[row.phone_card_status] ?? "aucune ligne de vérification";
    line(
      "Carte tél.",
      `${reviewLabel}${row.phone_card_reviewed_at ? ` le ${frDate(row.phone_card_reviewed_at)}` : ""}`,
    );
  }
  line("Commande", `${row.status} · ${row.fulfillment}`);
  line("Codes en base", row.codes_stored ? "oui (chiffrés)" : "non");
  line("Livrée le", frDate(row.delivered_at));
  line(
    "E-mail",
    row.email_sent_at
      ? `accepté le ${frDate(row.email_sent_at)}${row.email_provider_id ? ` · message ${row.email_provider_id}` : ""}`
      : "jamais accepté par le fournisseur",
  );
  line("Tentatives", String(row.attempts ?? 0));
  if (row.reloadly_transaction_id || row.reloadly_status) {
    line(
      "Fournisseur",
      `${row.reloadly_status ?? "?"} · ${row.reloadly_transaction_id ?? "sans identifiant"}`,
    );
  }
  if (row.last_error) line("Motif", String(row.last_error).slice(0, 200));
  if (row.email_last_error) line("Erreur e-mail", String(row.email_last_error).slice(0, 200));

  console.log(`\n  ${verdict.detail}`);
  if (verdict.actions.length > 0) {
    console.log("\n  À faire :");
    for (const action of verdict.actions) console.log(`   • ${action}`);
  }
  console.log("");

  process.exit(verdict.level === "fail" ? 1 : 0);
}

async function runAudit() {
  const { rows } = await client.query(
    `select d.ref, d.status, d.kind, d.product_title, d.total_usd, d.created_at,
            d.delivered_at, d.email_sent_at, d.email_last_error, d.attempts,
            d.quantity, d.codes_cipher is not null as codes_stored,
            p.payment_method, pc.status as phone_card_status
       from digital_orders d
       left join lateral (
         select payment_method from orders
          where digital_order_id = d.id
          order by created_at desc limit 1
       ) p on true
       left join phone_card_payments pc on pc.order_ref = d.ref
      where d.created_at > now() - make_interval(days => $1)
      order by d.created_at desc
      limit 1000`,
    [days],
  );

  const entries = rows.map((row) => ({
    ref: row.ref,
    createdAt: frDate(row.created_at),
    productTitle: row.product_title,
    totalUsd: row.total_usd,
    verdict: deliveryVerdict(rowToOrder(row)),
  }));

  const counts = { ok: 0, warn: 0, fail: 0 };
  for (const entry of entries) counts[entry.verdict.level] += 1;
  const problems = entries.filter((entry) => entry.verdict.level !== "ok");

  if (json) {
    console.log(
      JSON.stringify(
        {
          ok: problems.length === 0,
          days,
          databaseHost: host,
          counts,
          problems,
        },
        null,
        2,
      ),
    );
    process.exit(counts.fail > 0 ? 1 : 0);
  }

  console.log(`\nBilan des livraisons de codes — ${days} derniers jours`);
  console.log(`Base : ${host}`);
  console.log(
    `\n  ${entries.length} commande(s) · ✅ ${counts.ok} livrée(s) · ⚠️  ${counts.warn} à surveiller · ❌ ${counts.fail} en échec`,
  );

  if (problems.length === 0) {
    console.log("\n  Aucune commande en attente ou en échec sur la période.\n");
    process.exit(0);
  }

  console.log("");
  for (const entry of problems) {
    console.log(
      `  ${ICONS[entry.verdict.level]} ${entry.ref}  ${entry.verdict.headline}`,
    );
    console.log(
      `     ${entry.productTitle} — ${entry.totalUsd} USD — créée le ${entry.createdAt}`,
    );
  }
  console.log("\n  Détail d'une commande : npm run delivery:check -- <REF>\n");
  process.exit(counts.fail > 0 ? 1 : 0);
}

try {
  await client.connect();
  await client.query("select 1");
  if (audit) {
    await runAudit();
  } else {
    await checkOne(refArg);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(`Base injoignable ou requête refusée : ${message}`, `Hôte : ${host}`);
} finally {
  await client.end().catch(() => null);
}
