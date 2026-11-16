import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { g2gOfferMappings, type G2gOfferMapping } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  g2gConfigStatus,
  g2gConfigured,
  g2gErrorMessage,
  g2gGetStore,
  g2gProbeStore,
  type G2gProbeResult,
} from "@/lib/g2g";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Champs renvoyés au navigateur : aucune valeur de secret, jamais. */
function publicMapping(row: G2gOfferMapping) {
  return {
    id: row.id,
    offerId: row.offerId,
    title: row.title,
    supplierKind: row.supplierKind,
    categoryId: row.categoryId,
    supplierSkuId: row.supplierSkuId,
    saleCurrency: row.saleCurrency,
    minMarginPercent: row.minMarginPercent,
    maxCostUsd: row.maxCostUsd,
    enabled: row.enabled,
    note: row.note,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
  };
}

/**
 * Diagnostic du pilote G2G (admin uniquement).
 *
 * - `config` : quels secrets sont présents côté serveur (booléens seulement) ;
 * - `store`  : résultat du premier appel réel `GET /v2/store` (lecture seule) ;
 * - `mappings` : correspondances offres ↔ SKU FazerCards ;
 * - `suggestedWebhookUrl` : URL à copier dans G2G → API Integration → Webhook.
 *
 * Aucun achat, aucune modification d'offre, aucune clé renvoyée.
 */
export async function GET(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return noStoreJson({ ok: false, error: "unauthorized" }, 401);
  }

  const config = g2gConfigStatus();
  let origin = "";
  try {
    origin = new URL(req.url).origin;
  } catch {
    origin = "";
  }
  const suggestedWebhookUrl = origin ? `${origin}/api/webhooks/g2g` : "";

  let store: {
    userId: string;
    accountStatus: string;
    sellerStatus: string;
    sellingCurrencies: string[];
  } | null = null;
  let storeError: string | null = null;
  if (g2gConfigured()) {
    try {
      const response = await g2gGetStore();
      const payload = (response.payload ?? {}) as unknown as Record<string, unknown>;
      const rawCurrencies: unknown = payload.selling_currencies;
      const currencies = Array.isArray(rawCurrencies)
        ? rawCurrencies
            .map((entry: unknown) => {
              if (typeof entry === "string") return entry;
              if (entry && typeof entry === "object" && "currency" in entry) {
                return String((entry as { currency?: unknown }).currency ?? "");
              }
              return "";
            })
            .filter(Boolean)
        : [];
      store = {
        userId: String(payload.user_id ?? ""),
        accountStatus: String(payload.account_status ?? ""),
        sellerStatus: String(payload.seller_status ?? ""),
        sellingCurrencies: currencies,
      };
    } catch (error) {
      storeError = g2gErrorMessage(error);
    }
  } else {
    storeError = "Clé API, Secret Key ou User ID absent : aucun appel G2G effectué.";
  }

  // `?probe=1` : sonde GET /v2/store avec plusieurs jeux d'en-têtes.
  // Lecture seule — aucune offre n'est touchée. Sert à identifier quel
  // en-tête G2G refuse quand la documentation et les implémentations
  // publiques divergent.
  let probe: G2gProbeResult[] | null = null;
  if (new URL(req.url).searchParams.get("probe") === "1" && g2gConfigured()) {
    try {
      probe = await g2gProbeStore();
    } catch (error) {
      storeError = g2gErrorMessage(error);
    }
  }

  let mappings: ReturnType<typeof publicMapping>[] = [];
  let dbError: string | null = null;
  try {
    await ensureSchema();
    const rows = await db
      .select()
      .from(g2gOfferMappings)
      .orderBy(desc(g2gOfferMappings.createdAt));
    mappings = rows.map(publicMapping);
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
  }

  return noStoreJson({
    ok: true,
    config,
    store,
    storeError,
    probe,
    mappings,
    dbError,
    suggestedWebhookUrl,
    /**
     * Quel code tourne réellement en production — indispensable pour savoir
     * si un correctif est déployé avant de conclure qu'il ne fonctionne pas.
     */
    deploy: {
      sha: (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "").slice(0, 7),
      env: process.env.VERCEL_ENV ?? "",
      region: process.env.VERCEL_REGION ?? "",
    },
    /** Tant que cette phase n'est pas terminée, aucun achat n'est câblé. */
    autoDeliveryEnabled: false,
  });
}

interface MappingInput {
  offerId?: unknown;
  title?: unknown;
  supplierKind?: unknown;
  categoryId?: unknown;
  supplierSkuId?: unknown;
  saleCurrency?: unknown;
  minMarginPercent?: unknown;
  maxCostUsd?: unknown;
  enabled?: unknown;
  note?: unknown;
}

function cleanText(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Crée / met à jour une correspondance. Refuse d'activer un mapping incomplet. */
export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return noStoreJson({ ok: false, error: "unauthorized" }, 401);
  }

  let input: MappingInput;
  try {
    input = (await req.json()) as MappingInput;
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  const offerId = cleanText(input.offerId, 64).toUpperCase();
  if (!/^G[0-9A-Z]{8,}$/.test(offerId)) {
    return noStoreJson(
      {
        ok: false,
        error: "invalid_offer_id",
        message: "offer_id G2G attendu (ex. G1793906316865GE).",
      },
      400,
    );
  }

  const supplierKind = cleanText(input.supplierKind, 32) || "gift_card";
  if (supplierKind !== "gift_card" && supplierKind !== "game_key") {
    return noStoreJson(
      { ok: false, error: "invalid_kind", message: "gift_card ou game_key uniquement." },
      400,
    );
  }

  const categoryId = cleanText(input.categoryId, 120);
  const supplierSkuId = cleanText(input.supplierSkuId, 120);
  const saleCurrency = (cleanText(input.saleCurrency, 3) || "USD").toUpperCase();
  const minMarginPercent = Number(input.minMarginPercent ?? 12);
  const maxCostUsd = Number(input.maxCostUsd ?? 25);
  const enabled = input.enabled === true;

  if (!/^[A-Z]{3}$/.test(saleCurrency)) {
    return noStoreJson({ ok: false, error: "invalid_currency" }, 400);
  }
  if (
    !Number.isInteger(minMarginPercent) || minMarginPercent < 0 || minMarginPercent > 90 ||
    !Number.isFinite(maxCostUsd) || maxCostUsd <= 0 || maxCostUsd > 1000
  ) {
    return noStoreJson({ ok: false, error: "invalid_limits" }, 400);
  }
  // Fail-closed : une offre activée sans SKU exact ne peut pas être livrée.
  if (enabled && (!categoryId || !supplierSkuId)) {
    return noStoreJson(
      {
        ok: false,
        error: "incomplete_mapping",
        message: "Renseignez category_id et card_id/key_id avant d'activer l'offre.",
      },
      400,
    );
  }
  if (enabled && saleCurrency !== "USD") {
    return noStoreJson(
      {
        ok: false,
        error: "currency_not_supported",
        message: "L'automatisation exige une offre libellée en USD (pas de conversion implicite).",
      },
      400,
    );
  }

  const values = {
    offerId,
    title: cleanText(input.title, 160),
    supplierKind,
    categoryId,
    supplierSkuId,
    saleCurrency,
    minMarginPercent,
    maxCostUsd: String(maxCostUsd),
    enabled,
    note: cleanText(input.note, 500),
    updatedAt: new Date(),
  };

  try {
    await ensureSchema();
    const rows = await db
      .insert(g2gOfferMappings)
      .values(values)
      .onConflictDoUpdate({
        target: g2gOfferMappings.offerId,
        set: values,
      })
      .returning();
    return noStoreJson({ ok: true, mapping: publicMapping(rows[0]) });
  } catch (error) {
    console.error("[admin][g2g] enregistrement impossible :", error instanceof Error ? error.message : error);
    return noStoreJson(
      { ok: false, error: "db_error", message: "Base de données indisponible." },
      502,
    );
  }
}

/** Supprime une correspondance (ne touche jamais à l'offre chez G2G). */
export async function DELETE(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return noStoreJson({ ok: false, error: "unauthorized" }, 401);
  }
  const offerId = new URL(req.url).searchParams.get("offer_id")?.trim().toUpperCase() ?? "";
  if (!/^G[0-9A-Z]{8,}$/.test(offerId)) {
    return noStoreJson({ ok: false, error: "invalid_offer_id" }, 400);
  }
  try {
    await ensureSchema();
    await db.delete(g2gOfferMappings).where(eq(g2gOfferMappings.offerId, offerId));
    return noStoreJson({ ok: true });
  } catch (error) {
    console.error("[admin][g2g] suppression impossible :", error instanceof Error ? error.message : error);
    return noStoreJson({ ok: false, error: "db_error" }, 502);
  }
}
