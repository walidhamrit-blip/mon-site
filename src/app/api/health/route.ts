import { db } from "@/db";
import { sql } from "drizzle-orm";
import { siteConfig } from "@/lib/config";
import {
  checkNowPaymentsApiKey,
  nowPaymentsApiBase,
  nowPaymentsApiKey,
  nowPaymentsFiatCurrency,
  nowPaymentsIpnSecret,
  nowPaymentsSandbox,
} from "@/lib/nowpayments";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Sonde de diagnostic complète — publique, sans aucun secret
 * (booléens et messages d'erreur uniquement, jamais de clés).
 *
 * Utilisée pour localiser la cause d'un échec de création de paiement :
 *  - `database.connected:false` → `DATABASE_URL` absente ou base injoignable ;
 *  - `nowpayments.apiKeyConfigured:false` → `NOWPAYMENTS_API_KEY` absente
 *    de l'environnement qui sert cette route (Vercel : vérifier
 *    l'environnement « Production » puis redéployer) ;
 *  - `nowpayments.reachable:false` → sortie réseau vers NOWPayments bloquée ;
 *  - `nowpayments.apiKeyValid:false` → la clé est refusée par
 *    l'environnement visé (`apiKeyError` = corps exact du refus) : clé
 *    sandbox contre API production ou inversement (les deux environnements
 *    sont séparés), secret IPN collé à la place de la clé API, ou clé
 *    tronquée/régénérée. `apiKeyValid:true` = paiements réellement possibles ;
 *  - `vercel.env` / `vercel.commit` → quel déploiement sert la réponse.
 */
export async function GET() {
  const startedAt = Date.now();

  // ── Base de données ──
  const urlConfigured = Boolean(process.env.DATABASE_URL?.trim());
  let database: {
    urlConfigured: boolean;
    connected: boolean;
    latencyMs: number;
    error: string | null;
  };
  try {
    await db.execute(sql`select 1`);
    database = {
      urlConfigured,
      connected: true,
      latencyMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    database = {
      urlConfigured,
      connected: false,
      latencyMs: Date.now() - startedAt,
      error: errorMessage(error),
    };
  }

  // ── Passerelle NOWPayments ──
  // Deux sondes en parallèle : `GET /status` (public — dit seulement si la
  // passerelle répond) et `GET /currencies` avec la clé (dit si la clé est
  // acceptée par l'environnement visé). La première seule a déjà fait
  // croire à tort que « tout allait bien » alors que la clé était refusée.
  const apiBase = nowPaymentsApiBase();
  const [statusProbe, apiKeyCheck] = await Promise.all([
    (async () => {
      try {
        const response = await fetch(`${apiBase}/status`, {
          method: "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        return {
          reachable: response.ok,
          error: response.ok ? null : `HTTP ${response.status}`,
        };
      } catch (error) {
        return { reachable: false, error: errorMessage(error) };
      }
    })(),
    checkNowPaymentsApiKey(),
  ]);

  const nowpayments = {
    apiKeyConfigured: nowPaymentsApiKey().length > 0,
    apiKeyValid: apiKeyCheck.valid,
    apiKeyStatus: apiKeyCheck.status,
    apiKeyError: apiKeyCheck.error,
    ipnSecretConfigured: Boolean(nowPaymentsIpnSecret()),
    sandbox: nowPaymentsSandbox(),
    apiBase,
    currency: nowPaymentsFiatCurrency(),
    reachable: statusProbe.reachable,
    error: statusProbe.error,
  };

  // `ok` n'est vrai que si un paiement peut réellement être créé :
  // base connectée ET clé acceptée (pas seulement présente/joignable).
  const ok = database.connected && nowpayments.apiKeyValid === true;

  return Response.json(
    {
      ok,
      time: new Date().toISOString(),
      siteUrl: (process.env.SITE_URL?.trim() || siteConfig.url).replace(/\/+$/, ""),
      vercel: {
        env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        deploymentUrl: process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : null,
      },
      database,
      nowpayments,
    },
    { status: ok ? 200 : 500 },
  );
}
