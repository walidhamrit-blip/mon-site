#!/usr/bin/env node
/**
 * Ré-chiffrement des données sensibles avec la clé courante — `npm run codes:rotate`
 *
 * Contexte : les codes livrés (cartes cadeaux, recharges téléphoniques) et les
 * jetons de validation des livraisons sont chiffrés en AES-256-GCM. La clé est
 * dérivée d'un secret d'environnement : DIGITAL_CODES_SECRET s'il est défini,
 * sinon SESSION_SECRET (mode historique).
 *
 * Le jour où l'on définit DIGITAL_CODES_SECRET, les lignes déjà en base restent
 * chiffrées par la clé de session. Elles restent LISIBLES (l'application essaie
 * tout le trousseau), mais elles ne sont plus protégées de la rotation de
 * session : renouveler SESSION_SECRET les rendrait illisibles.
 *
 * Ce script ré-chiffre ces lignes avec la clé courante :
 *
 *   node scripts/reencrypt-digital-codes.mjs            # simulation (défaut)
 *   node scripts/reencrypt-digital-codes.mjs --apply    # écrit en base
 *
 * Il couvre les trois colonnes chiffrées avec ce secret :
 *   - digital_orders.codes_cipher          (JSON des codes livrés)
 *   - phone_card_payments.code_cipher      (+ code_fingerprint recalculée)
 *   - site_deliveries.tracking_token_cipher (jeton de validation)
 *
 * Procédure de rotation sans coupure :
 *   1. ajouter DIGITAL_CODES_SECRET (64 caractères aléatoires) sur Vercel ;
 *   2. redéployer — les nouveaux codes sont chiffrés avec la clé dédiée ;
 *   3. `npm run codes:rotate` (simulation), puis `--apply` ;
 *   4. vérifier `npm run codes:rotate` : « 0 ligne à migrer » ;
 *   5. définir DIGITAL_CODES_DROP_LEGACY_FALLBACK=true, redéployer.
 *
 * Rotation suivante : l'ancienne valeur passe dans DIGITAL_CODES_SECRET_PREVIOUS
 * (liste séparée par des virgules) le temps de la migration, puis est retirée.
 *
 * Aucun secret ni code en clair n'est affiché : seules des références de
 * commande et des compteurs.
 */

import { existsSync } from "node:fs";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { Buffer } from "node:buffer";
import dotenv from "dotenv";
import pg from "pg";

// Mêmes règles que l'application : .env.local prioritaire, variables déjà
// exportées dans le shell prioritaires sur les deux.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) dotenv.config({ path: file, quiet: true });
}

/*
 * Primitives dupliquées volontairement depuis src/lib/digital-codes.ts :
 * ce script doit tourner sans chargeur TypeScript. L'égalité des deux
 * implémentations est vérifiée par scripts/digital-codes-keyring.test.mjs
 * (dérivation + charges de référence chiffrées par l'application).
 */
const CODES_KEY_PREFIX = "nukhba-digital-codes:";
const TOKEN_KEY_PREFIX = "nukhba-delivery-token:";
const PHONE_CARD_FINGERPRINT_PREFIX = "nukhba-phone-card:";

const BATCH = 200;

const apply = process.argv.includes("--apply");
const help = process.argv.includes("--help") || process.argv.includes("-h");

function derive(prefix, secret) {
  return createHash("sha256").update(`${prefix}${secret}`).digest();
}

function encryptEnvelope(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function decryptEnvelopeWithKey(payload, key) {
  const parts = String(payload ?? "").split(".");
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, data] = parts.map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Secrets candidats, dans l'ordre de lecture de l'application. */
function candidateSecrets() {
  const dedicated = (process.env.DIGITAL_CODES_SECRET ?? "").trim();
  const session = (process.env.SESSION_SECRET ?? "").trim();
  const previous = (process.env.DIGITAL_CODES_SECRET_PREVIOUS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const dropLegacy = (process.env.DIGITAL_CODES_DROP_LEGACY_FALLBACK ?? "").trim() === "true";

  if (dedicated) {
    const list = [dedicated, ...previous];
    // Le repli de session reste actif tant que la migration n'est pas finie :
    // c'est justement ce que ce script termine.
    if (!dropLegacy && session) list.push(session);
    return list;
  }
  if (session) return [session, ...previous];
  return [];
}

function buildRing(prefix, secrets) {
  const seen = new Set();
  const ring = [];
  for (const secret of secrets) {
    const key = derive(prefix, secret);
    const id = key.toString("hex");
    if (seen.has(id)) continue;
    seen.add(id);
    ring.push(key);
  }
  return ring;
}

/**
 * Déchiffre une charge avec le trousseau ; renvoie la clé qui a réussi.
 * `kind: "codes"` exige en plus un JSON de tableau (sinon la charge est illisible).
 */
function openWithRing(payload, ring, kind) {
  for (let index = 0; index < ring.length; index += 1) {
    const plaintext = decryptEnvelopeWithKey(payload, ring[index]);
    if (plaintext === null) continue;
    if (kind === "codes") {
      try {
        if (!Array.isArray(JSON.parse(plaintext))) continue;
      } catch {
        continue;
      }
    }
    return { plaintext, keyIndex: index };
  }
  return null;
}

const TARGETS = [
  {
    name: "digital_orders.codes_cipher",
    kind: "codes",
    prefix: CODES_KEY_PREFIX,
    select: `select id, ref, codes_cipher as cipher
               from digital_orders
              where codes_cipher is not null and codes_cipher <> '' and id > $1
              order by id
              limit $2`,
    label: (row) => row.ref,
  },
  {
    name: "phone_card_payments.code_cipher",
    kind: "text",
    prefix: CODES_KEY_PREFIX,
    select: `select id, order_ref as ref, code_cipher as cipher
               from phone_card_payments
              where code_cipher is not null and code_cipher <> '' and id > $1
              order by id
              limit $2`,
    label: (row) => row.ref,
  },
  {
    name: "site_deliveries.tracking_token_cipher",
    kind: "text",
    prefix: TOKEN_KEY_PREFIX,
    select: `select id, ref, tracking_token_cipher as cipher
               from site_deliveries
              where tracking_token_cipher is not null and tracking_token_cipher <> '' and id > $1
              order by id
              limit $2`,
    label: (row) => row.ref,
  },
];

const WRITE = {
  "digital_orders.codes_cipher": (client, row, cipher) =>
    client.query("update digital_orders set codes_cipher = $1 where id = $2", [cipher, row.id]),
  // L'empreinte HMAC dépend de la clé : elle est recalculée avec la clé
  // courante pour que la détection de doublon continue de fonctionner. Une
  // collision signifie que le même code a été soumis deux fois : on le signale
  // sans écraser (la colonne est unique).
  "phone_card_payments.code_cipher": (client, row, cipher, plaintext, key) =>
    client.query(
      "update phone_card_payments set code_cipher = $1, code_fingerprint = $2 where id = $3",
      [
        cipher,
        createHmac("sha256", key)
          .update(`${PHONE_CARD_FINGERPRINT_PREFIX}${plaintext}`)
          .digest("hex"),
        row.id,
      ],
    ),
  "site_deliveries.tracking_token_cipher": (client, row, cipher) =>
    client.query("update site_deliveries set tracking_token_cipher = $1 where id = $2", [cipher, row.id]),
};

if (help) {
  console.log(
    [
      "Ré-chiffre les données sensibles avec la clé courante.",
      "",
      "  node scripts/reencrypt-digital-codes.mjs           simulation (défaut)",
      "  node scripts/reencrypt-digital-codes.mjs --apply   écrit en base",
      "",
      "Variables lues : DATABASE_URL, DIGITAL_CODES_SECRET (ou SESSION_SECRET),",
      "DIGITAL_CODES_SECRET_PREVIOUS, DIGITAL_CODES_DROP_LEGACY_FALLBACK.",
    ].join("\n"),
  );
  process.exit(0);
}

const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
if (!databaseUrl) {
  console.error(
    "DATABASE_URL absente : renseignez-la dans .env.local (ou l'environnement) avant de lancer la migration.",
  );
  process.exit(1);
}

const secrets = candidateSecrets();
if (secrets.length === 0) {
  console.error(
    "Aucun secret de chiffrement : définissez DIGITAL_CODES_SECRET, sinon rien ne peut être relu ni ré-écrit.",
  );
  process.exit(1);
}

if (!(process.env.DIGITAL_CODES_SECRET ?? "").trim()) {
  console.log(
    "DIGITAL_CODES_SECRET n'est pas défini : la clé courante est la clé de session, il n'y a rien à migrer.\n" +
      "Définissez d'abord DIGITAL_CODES_SECRET (puis redéployez), enfin relancez ce script.",
  );
  process.exit(0);
}

const rings = {
  [CODES_KEY_PREFIX]: buildRing(CODES_KEY_PREFIX, secrets),
  [TOKEN_KEY_PREFIX]: buildRing(TOKEN_KEY_PREFIX, secrets),
};

for (const [prefix, ring] of Object.entries(rings)) {
  if (ring.length === 1) {
    console.log(
      `${prefix === CODES_KEY_PREFIX ? "Codes / recharges" : "Jetons de livraison"} : une seule clé en jeu, aucune lecture historique possible.`,
    );
  }
}

console.log(
  `\n${apply ? "MIGRATION (écriture en base)" : "SIMULATION (aucune écriture — ajoutez --apply pour migrer)"}\n` +
    `Clés candidates : ${secrets.length} · lots de ${BATCH} lignes\n`,
);

// Même convention que `npm run doctor` : SSL par défaut, sauf demande explicite
// (`sslmode=disable`, utile pour une base locale).
const client = new pg.Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 15_000,
  ssl: /sslmode=disable/i.test(databaseUrl) ? false : undefined,
});

try {
  await client.connect();
} catch (error) {
  console.error(
    `Base injoignable : ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

// Une base qui a déjà servi n'a pas forcément les tables : message explicite
// plutôt qu'une erreur SQL brute (les tables sont créées par l'application).
const { rows: existing } = await client.query(
  `select tablename from pg_tables where schemaname = 'public'`,
);
const present = new Set(existing.map((row) => row.tablename));
const missing = ["digital_orders", "phone_card_payments", "site_deliveries"].filter(
  (table) => !present.has(table),
);
if (missing.length > 0) {
  console.log(
    `Tables absentes (${missing.join(", ")}) : rien à migrer dans cette base.\n` +
      "Ouvrez le site une fois (`ensureSchema`) puis relancez si vous attendiez des données.",
  );
}

let totalMigrated = 0;
let totalCurrent = 0;
let totalFailures = 0;

try {
  await client.query("begin");
  for (const target of TARGETS) {
    if (!present.has(target.name.split(".")[0])) continue;
    const ring = rings[target.prefix];
    const write = WRITE[target.name];
    const currentKey = ring[0];
    let lastId = 0;
    let migrated = 0;
    let current = 0;
    let read = 0;
    const unreadable = [];
    const failures = [];

    for (;;) {
      const { rows } = await client.query(target.select, [lastId, BATCH]);
      if (rows.length === 0) break;
      for (const row of rows) {
        lastId = row.id;
        read += 1;
        const opened = openWithRing(row.cipher, ring, target.kind);
        if (!opened) {
          unreadable.push(target.label(row));
          continue;
        }
        if (opened.keyIndex === 0) {
          current += 1;
          continue;
        }
        if (apply) {
          const cipher = encryptEnvelope(opened.plaintext, currentKey);
          try {
            await write(client, row, cipher, opened.plaintext, currentKey);
          } catch (error) {
            failures.push(`${target.label(row)} : ${error.message}`);
            continue;
          }
        }
        migrated += 1;
      }
      if (rows.length < BATCH) break;
    }

    totalMigrated += migrated;
    totalCurrent += current;
    totalFailures += failures.length + unreadable.length;

    const parts = [`${read} ligne(s) lue(s)`, `${current} déjà sur la clé courante`];
    parts.push(
      apply ? `${migrated} ré-chiffrée(s)` : `${migrated} à ré-chiffrer`,
    );
    console.log(`— ${target.name} : ${parts.join(", ")}`);
    if (unreadable.length > 0) {
      console.log(
        `  ⚠ ${unreadable.length} ligne(s) illisible(s) avec les clés configurées : ${unreadable
          .slice(0, 10)
          .join(", ")}${unreadable.length > 10 ? "…" : ""}`,
      );
      console.log(
        "    → un secret a probablement été retiré : remettez-le dans DIGITAL_CODES_SECRET_PREVIOUS.",
      );
    }
    if (failures.length > 0) {
      console.log(`  ⚠ ${failures.length} écriture(s) refusée(s) : ${failures.slice(0, 10).join(" | ")}`);
      console.log(
        "    → collision d'empreinte = même code de recharge saisi deux fois : à traiter à la main.",
      );
    }
  }

  if (apply) {
    await client.query("commit");
  } else {
    await client.query("rollback");
  }
} catch (error) {
  try {
    await client.query("rollback");
  } catch {
    /* la connexion est peut-être déjà perdue */
  }
  console.error(`\nÉchec : ${error instanceof Error ? error.message : String(error)}`);
  await client.end();
  process.exit(1);
}

await client.end();

if (totalFailures > 0) {
  console.log(`\n${totalFailures} anomalie(s) à traiter : rien d'autre n'est cassé, mais relisez les avertissements.`);
  process.exit(1);
}

if (totalMigrated === 0) {
  console.log(
    "\nAucune ligne à migrer : toutes les données sont déjà chiffrées avec la clé courante.\n" +
      "Vous pouvez définir DIGITAL_CODES_DROP_LEGACY_FALLBACK=true, puis redéployer.",
  );
} else if (!apply) {
  console.log(
    `\n${totalMigrated} ligne(s) à migrer. Relancez avec --apply pour les ré-chiffrer (transaction unique).`,
  );
} else {
  console.log(
    `\n${totalMigrated} ligne(s) ré-chiffrée(s) avec la clé courante.\n` +
      "Relancez la simulation : elle doit annoncer 0 ligne à migrer. Ensuite seulement, définissez\n" +
      "DIGITAL_CODES_DROP_LEGACY_FALLBACK=true et redéployez.",
  );
}
