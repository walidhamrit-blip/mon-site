#!/usr/bin/env node
/**
 * Contrôle de disponibilité de la production — aucune dépendance externe.
 *
 * Appelé par `.github/workflows/surveillance.yml` toutes les 6 heures et
 * utilisable à la main :
 *   SITE_URL=https://nokhba.net.ly node scripts/uptime-check.mjs
 *
 * Trois contrôles HTTP + un contrôle TLS :
 *   1. /api/health  → 200 **et** `ok: true` (la base répond réellement) ;
 *   2. /            → 200 et marqueur de marque ;
 *   3. /codes       → 200 (cœur commercial) ;
 *   4. certificat   → échec sous 7 jours, avertissement sous 14 jours.
 *
 * Sortie : un rapport Markdown sur stdout, code 1 si au moins un échec.
 */
import { connect } from "node:tls";

import {
  evaluateHealth,
  evaluatePage,
  evaluateTls,
  overallStatus,
} from "./lib/uptime-checks.mjs";

const BASE = (process.env.SITE_URL ?? "https://nokhba.net.ly").replace(/\/$/, "");
const BASE_URL = new URL(BASE);
const TIMEOUT_MS = 15_000;

const results = [];

function record(name, verdict) {
  results.push({ name, ...verdict });
}

async function fetchText(path) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "Nukhba-Surveillance/1.0" },
  });
  const body = await response.text();
  return { status: response.status, body };
}

async function checkHttp(name, path, evaluate, extra = "") {
  try {
    const { status, body } = await fetchText(path);
    record(name + extra, evaluate(status, body));
  } catch (error) {
    record(name + extra, {
      status: "fail",
      message: `requête impossible : ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/** Vérifie l'expiration du certificat TLS du domaine. */
async function checkTls() {
  if (BASE_URL.protocol !== "https:") {
    record("TLS", { status: "ok", message: "ignoré (URL non HTTPS)" });
    return;
  }

  try {
    const validTo = await new Promise((resolve, reject) => {
      const socket = connect(
        {
          host: BASE_URL.hostname,
          port: Number(BASE_URL.port || 443),
          servername: BASE_URL.hostname,
          timeout: TIMEOUT_MS,
        },
        () => {
          const certificate = socket.getPeerCertificate();
          socket.end();
          resolve(certificate?.valid_to);
        },
      );
      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("délai TLS dépassé"));
      });
      socket.on("error", reject);
    });

    record("TLS", evaluateTls(String(validTo)));
  } catch (error) {
    record("TLS", {
      status: "fail",
      message: `connexion TLS impossible : ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

function label(status) {
  if (status === "ok") return "OK";
  if (status === "warn") return "ATTENTION";
  return "ÉCHEC";
}

async function main() {
  await checkHttp("Santé", "/api/health", evaluateHealth);
  await checkHttp("Accueil", "/", (status, body) =>
    evaluatePage(status, body, ["نخبة", "NUKHBA"]),
  );
  await checkHttp("Boutique", "/codes", (status, body) =>
    evaluatePage(status, body, ["<html", "NUKHBA", "نخبة"]),
  );
  await checkTls();

  const overall = overallStatus(results);
  const failures = results.filter((result) => result.status === "fail").length;
  const warnings = results.filter((result) => result.status === "warn").length;

  console.log(`# Contrôle de disponibilité — ${BASE_URL.hostname}`);
  console.log(`Date : ${new Date().toISOString()}`);
  console.log("");
  for (const result of results) {
    console.log(`- **${label(result.status)}** ${result.name} — ${result.message}`);
  }
  console.log("");
  console.log(
    `Résultat : ${overall === "ok" ? "OK" : overall === "warn" ? "AVERTISSEMENT" : "ÉCHEC"}` +
      ` (${results.length - failures - warnings}/${results.length} OK, ` +
      `${warnings} avertissement(s), ${failures} échec(s))`,
  );

  process.exitCode = overall === "fail" ? 1 : 0;
}

main().catch((error) => {
  console.error(`# Contrôle interrompu`);
  console.error(`Erreur inattendue : ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
