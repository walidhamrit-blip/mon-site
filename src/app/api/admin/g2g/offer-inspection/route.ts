import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { g2gConfigured, g2gGetOffer } from "@/lib/g2g";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Diagnostic strictement en lecture seule : ne modifie ni offre ni mapping. */
export async function GET(req: Request) {
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!(await isAdminAuthenticated())) return reply({ ok: false, error: "unauthorized" }, 401);
  const offerId = new URL(req.url).searchParams.get("offer_id")?.trim().toUpperCase() ?? "";
  if (!/^G[0-9A-Z]{8,64}$/.test(offerId)) return reply({ ok: false, error: "invalid_offer_id" }, 400);
  if (!g2gConfigured()) return reply({ ok: false, error: "g2g_not_configured" }, 503);
  try {
    const response = await g2gGetOffer(offerId);
    const p = response.payload;
    if (!p || p.offer_id !== offerId) return reply({ ok: false, error: "offer_unreadable" }, 502);
    const text = (v: unknown) => typeof v === "string" ? v.slice(0, 200) : null;
    const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
    return reply({ ok: true, offer: {
      offerId: p.offer_id, title: text(p.title), status: text(p.status), currency: text(p.currency),
      unitPrice: number(p.unit_price), apiQty: number(p.api_qty), availableQty: number(p.available_qty),
      minimumQty: number(p.min_qty), codeLabel: text(p.code_label),
      deliveryTypes: Array.isArray(p.delivery_type) ? p.delivery_type.filter((v): v is string => typeof v === "string").map(v => v.slice(0, 80)).slice(0, 10) : null,
    } });
  } catch {
    // Aucune réponse fournisseur brute ou secret ne remonte au navigateur.
    return reply({ ok: false, error: "offer_read_failed" }, 502);
  }
}
