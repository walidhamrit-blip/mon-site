import { db } from "@/db";
import { sql } from "drizzle-orm";
import { siteConfig } from "@/lib/config";
import {
  nowPaymentsApiBase,
  nowPaymentsApiKey,
  nowPaymentsFiatCurrency,
  nowPaymentsIpnSecret,
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

  // ── Passerelle NOWPayments (atteignable ? — GET /status est public) ──
  const apiBase = nowPaymentsApiBase();
  let reachable: boolean | null = null;
  let gatewayError: string | null = null;
  try {
    const response = await fetch(`${apiBase}/status`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    reachable = response.ok;
    if (!response.ok) gatewayError = `HTTP ${response.status}`;
  } catch (error) {
    reachable = false;
    gatewayError = errorMessage(error);
  }

  const nowpayments = {
    apiKeyConfigured: nowPaymentsApiKey().length > 0,
    ipnSecretConfigured: Boolean(nowPaymentsIpnSecret()),
    sandbox: process.env.NOWPAYMENTS_SANDBOX === "true",
    apiBase,
    currency: nowPaymentsFiatCurrency(),
    reachable,
    error: gatewayError,
  };

  const ok = database.connected && nowpayments.apiKeyConfigured && reachable !== false;

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
