#!/usr/bin/env node
/**
 * Vérification locale d'une paire de clés G2G OpenAPI v2.
 *
 *   npm run g2g:check                  → appel réel GET /v2/store (lecture seule)
 *   npm run g2g:check -- --sign-only     → contrôle de la config, sans réseau
 *   npm run g2g:check -- --preflight     → les 6 variables sont-elles prêtes ?
 *
 * `--preflight` sert de checklist AVANT un déploiement Vercel : il indique
 * uniquement quelles variables manquent (jamais leur valeur) et sort en
 * erreur s'il en manque une. Il ne remplace pas la vérification dans
 * l'interface Vercel (les variables de Production y sont injectées au
 * prochain déploiement, pas dans .env.local).
 *
 * Les secrets sont lus dans .env.local puis .env (jamais affichés).
 * Ce script ne crée aucune offre, n'achète aucun code et ne modifie rien.
 */
import { createHmac } from "node:crypto";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const clean = (value) => (value ?? "").trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
const apiKey = clean(process.env.G2G_API_KEY);
const secretKey = clean(process.env.G2G_SECRET_KEY);
const userId = clean(process.env.G2G_USER_ID);
const webhookToken = clean(process.env.G2G_WEBHOOK_SECRET_TOKEN);
const webhookUrl = clean(process.env.G2G_WEBHOOK_URL);
const base = (clean(process.env.G2G_API_BASE) || "https://open-api.g2g.com").replace(/\/+$/, "");
const path = "/v2/store";

const checklist = [
  ["G2G_API_KEY", apiKey, "g2g.com → API Integration → Generate key (clé publique)"],
  ["G2G_SECRET_KEY", secretKey, "affichée une seule fois à la génération"],
  ["G2G_USER_ID", userId, "Seller ID 1003177397"],
  ["G2G_WEBHOOK_SECRET_TOKEN", webhookToken, "fenêtre Callback URL → Generate random secret token"],
  ["G2G_WEBHOOK_URL", webhookUrl, "Callback URL exact déclaré chez G2G, en https"],
  ["G2G_API_BASE", base, "https://open-api.g2g.com (défaut, facultatif)"],
];

console.log("G2G OpenAPI v2 — vérification de la clé");
console.log("---------------------------------------");
console.log(`G2G_API_KEY     : ${apiKey ? "présente" : "ABSENTE"}`);
console.log(`G2G_SECRET_KEY  : ${secretKey ? "présente" : "ABSENTE"}`);
console.log(`G2G_USER_ID     : ${userId ? "présent" : "ABSENT"}`);
console.log(`Base API        : ${base}`);
console.log(`Webhook token   : ${webhookToken ? "présent" : "ABSENT (étape 3)"}`);
console.log(`Webhook URL     : ${webhookUrl ? "présente" : "ABSENTE (étape 3)"}`);

if (process.argv.includes("--preflight")) {
  console.log("\nChecklist AVANT déploiement Vercel");
  console.log("----------------------------------");
  for (const [name, value, hint] of checklist) {
    console.log(`${value ? "✅" : "❌"} ${name.padEnd(28)} ${value ? "prêt" : `manquant — ${hint}`}`);
  }
  let urlLooksRight = false;
  try {
    const parsed = new URL(webhookUrl);
    urlLooksRight =
      parsed.protocol === "https:" && parsed.pathname === "/api/webhooks/g2g";
  } catch {
    urlLooksRight = false;
  }
  if (webhookUrl && !urlLooksRight) {
    console.log("⚠️  G2G_WEBHOOK_URL doit être en https et se terminer par /api/webhooks/g2g.");
  }
  const required = checklist.slice(0, 5).every(([, value]) => Boolean(value));
  if (!required || (webhookUrl && !urlLooksRight)) {
    console.error("\n❌ Pas encore prêt : complète les variables manquantes puis redéploie.");
    process.exitCode = 1;
  } else {
    console.log("\n✅ Les 5 variables obligatoires sont prêtes. Tu peux redéployer.");
    console.log("   Rappel : garde api_qty = 0 sur toutes les offres G2G (phase 1).");
  }
} else if (!apiKey || !secretKey || !userId) {
  console.error("\n❌ Configuration incomplète. Renseignez les 3 variables dans .env.local.");
  console.error("   Obtention : g2g.com → Avatar → API Integration → Generate key.");
  console.error("   ⚠️ La Secret Key n'est affichée qu'une seule fois par G2G.");
  process.exitCode = 1;
} else if (process.argv.includes("--sign-only")) {
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", secretKey)
    .update(path + apiKey + userId + timestamp, "utf8")
    .digest("hex");
  console.log(`\n✅ Signature calculée sur ${path} (${signature.length} caractères hex).`);
  console.log("   Aucun appel réseau effectué (--sign-only).");
} else {
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", secretKey)
    .update(path + apiKey + userId + timestamp, "utf8")
    .digest("hex");

  try {
    const response = await fetch(`${base}${path}`, {
      headers: {
        "g2g-api-key": apiKey,
        "g2g-userid": userId,
        "g2g-timestamp": timestamp,
        "g2g-signature": signature,
        Accept: "application/json",
        // ⚠️ Obligatoire MÊME sur un GET sans corps : G2G répond sinon
        // « Invalid Header 'Content-Type' ».
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    const raw = await response.text();
    let body = {};
    try {
      body = JSON.parse(raw);
    } catch {
      /* corps non JSON : on affiche uniquement le statut */
    }
    console.log(`\nHTTP ${response.status}`);
    if (body?.payload) {
      console.log(`User ID          : ${body.payload.user_id ?? "—"}`);
      console.log(`Compte           : ${body.payload.account_status ?? "—"}`);
      console.log(`Statut vendeur   : ${body.payload.seller_status ?? "—"}`);
      console.log(`Devises de vente : ${JSON.stringify(body.payload.selling_currencies ?? [])}`);
    }
    if (response.ok && body?.code === "20000001") {
      console.log("\n✅ Clé valide : la signature HMAC et le Seller ID sont acceptés par G2G.");
      console.log("   Étape suivante : déclarer le webhook et remplir le mapping dans /admin/digital.");
    } else {
      console.log(`\n❌ Réponse G2G : code=${body?.code ?? "?"} message=${body?.message ?? "(vide)"}`);
      console.log("   Signature invalide → vérifier Secret Key, API Key, User ID et l'horloge du serveur.");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`\n❌ G2G injoignable : ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
