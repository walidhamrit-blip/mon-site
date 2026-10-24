import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders, subscriptions } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { enforceSameOrigin } from "@/lib/csrf";
import { createTrackingToken, trackingQuery } from "@/lib/order-tracking";

export const dynamic = "force-dynamic";

/**
 * Régénère le jeton de suivi d'une commande ou d'un abonnement et renvoie
 * le lien public complet. Réservé à l'administration : seul le hash
 * SHA-256 du jeton est en base, le jeton en clair n'est donc récupérable
 * qu'à sa création — ce endpoint est aussi la marche à suivre quand un
 * client perd son lien (nouvel appareil, e-mail égaré).
 *
 * L'ancien jeton est invalidé : tout lien précédent cesse de fonctionner.
 */
const schema = z.object({
  kind: z.enum(["order", "subscription"]),
  ref: z.string().min(3).max(80),
});

export async function POST(req: Request) {
  if (!enforceSameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const { kind, ref } = parsed.data;
  const wanted = ref.trim().toUpperCase();
  const token = createTrackingToken();

  try {
    await ensureSchema();

    if (kind === "subscription") {
      const [row] = await db
        .select({ id: subscriptions.id, ref: subscriptions.ref })
        .from(subscriptions)
        .where(eq(subscriptions.ref, wanted))
        .limit(1);
      if (!row) {
        return NextResponse.json(
          { ok: false, error: "not_found", message: "Abonnement introuvable." },
          { status: 404 },
        );
      }
      await db
        .update(subscriptions)
        .set({ trackingTokenHash: token.hash, updatedAt: new Date() })
        .where(eq(subscriptions.id, row.id));

      return NextResponse.json({
        ok: true,
        url: `/abonnements/suivi?${trackingQuery(row.ref, token.token)}`,
      });
    }

    const [order] = await db
      .select({
        id: orders.id,
        ref: orders.ref,
        groupRef: orders.groupRef,
      })
      .from(orders)
      .where(eq(orders.ref, wanted))
      .limit(1);
    if (!order) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: "Commande introuvable." },
        { status: 404 },
      );
    }

    // Les tranches d'un même plan partagent un même jeton : on le
    // régénère sur tout le groupe pour garder un lien cohérent.
    if (order.groupRef) {
      const siblings = await db
        .select({ ref: orders.ref })
        .from(orders)
        .where(eq(orders.groupRef, order.groupRef));
      const refs = siblings.map((row) => row.ref);
      if (refs.length > 0) {
        await db
          .update(orders)
          .set({ trackingTokenHash: token.hash, updatedAt: new Date() })
          .where(inArray(orders.ref, refs));
      }
    } else {
      await db
        .update(orders)
        .set({ trackingTokenHash: token.hash, updatedAt: new Date() })
        .where(eq(orders.id, order.id));
    }

    return NextResponse.json({
      ok: true,
      url: `/pay/success?${trackingQuery(order.ref, token.token)}`,
    });
  } catch (error) {
    console.error(
      "[admin] régénération de lien impossible :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
