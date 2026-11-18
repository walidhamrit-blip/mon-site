#!/usr/bin/env node
/**
 * Audit des dépendances de production, avec exceptions explicites.
 *
 * `npm audit --omit=dev` ne distingue pas le code exécuté à l'exécution du
 * code exécuté au build. Sentry embarque un plugin de bundler (Rollup) dont
 * dépend `picomatch`, affecté par un ReDoS sans correctif publié. Ce paquet
 * n'est ni déployé ni appelé au runtime : il sert uniquement à construire les
 * source maps. Le laisser bloquer chaque PR rendrait la CI inutilisable.
 *
 * Ce script échoue donc sur tout avis high/critical NON listé ci-dessous,
 * et refuse une exception expirée. Toute nouvelle exception doit être
 * justifiée, datée et retirée dès qu'un correctif existe.
 *
 * Usage : node scripts/audit-prod.mjs
 */
import { execFileSync } from "node:child_process";

const EXCEPTIONS = new Map([
  [
    "GHSA-fc5q-39xc-vjpf",
    {
      package: "picomatch",
      reason:
        "ReDoS dans picomatch (<= 4.0.7), dépendance de build de " +
        "@sentry/bundler-plugins. Aucun correctif publié ; code jamais " +
        "déployé ni exécuté à l'exécution.",
      expires: "2027-01-31",
    },
  ],
]);

/** Exécute npm audit et renvoie le rapport JSON, même en sortie non nulle. */
function runAudit() {
  try {
    return execFileSync("npm", ["audit", "--omit=dev", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    if (typeof error.stdout === "string" && error.stdout.trim()) {
      return error.stdout;
    }
    throw error;
  }
}

/** Extrait les avis (objets `via`), dédupliqués par identifiant. */
function advisories(report) {
  const found = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via !== "object" || !via.url) continue;
      const id = String(via.url).split("/").pop();
      if (!id) continue;
      found.set(id, {
        id,
        name: via.name ?? vulnerability.name,
        severity: via.severity ?? vulnerability.severity,
        title: via.title ?? "(sans titre)",
        url: via.url,
      });
    }
  }
  return [...found.values()];
}

function main() {
  const raw = runAudit();
  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error("Audit impossible : sortie npm illisible.");
    process.exit(1);
  }

  const counts = report.metadata?.vulnerabilities ?? {};
  const high = (counts.high ?? 0) + (counts.critical ?? 0);
  const list = advisories(report);
  const today = new Date().toISOString().slice(0, 10);
  const blocking = [];

  for (const advisory of list) {
    if (!["high", "critical"].includes(advisory.severity)) continue;
    const exception = EXCEPTIONS.get(advisory.id);
    if (!exception) {
      blocking.push(advisory);
      continue;
    }
    if (exception.expires < today) {
      console.error(
        `Exception expirée le ${exception.expires} : ${advisory.id} ` +
          `(${advisory.name}). Retirer l'exception ou corriger la dépendance.`,
      );
      blocking.push(advisory);
      continue;
    }
    console.log(
      `Exception acceptée : ${advisory.id} (${advisory.name}) — ` +
        `${exception.reason} (expire le ${exception.expires}).`,
    );
  }

  if (blocking.length > 0) {
    console.error(
      `\n${blocking.length} avis high/critical non accepté(s) :`,
    );
    for (const advisory of blocking) {
      console.error(`- ${advisory.severity} ${advisory.name} : ${advisory.title}`);
      console.error(`  ${advisory.url}`);
    }
    process.exit(1);
  }

  if (high > 0) {
    console.log(
      `\n${high} avis high/critical, tous couverts par une exception datée.`,
    );
  } else {
    console.log("Aucune vulnérabilité high/critical en production.");
  }
}

main();
