import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import { enforceSameOrigin } from "@/lib/csrf";
import { boutiqueProductSchema } from "@/lib/validation";
import {
  optimizeDigitalProductSeoGeo,
  templateDigitalSeoGeo,
} from "@/lib/ai/digital-seo-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const singlePayloadSchema = z.object({
  mode: z.literal("single").default("single"),
  product: boutiqueProductSchema,
  rewriteEditorial: z.boolean().default(true),
});

const batchPayloadSchema = z.object({
  mode: z.literal("batch"),
  products: z.array(boutiqueProductSchema).min(1).max(100),
  rewriteEditorial: z.boolean().default(true),
});

export async function POST(request: Request) {
  if (!enforceSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Origine non autorisée." },
      { status: 403 },
    );
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, error: "Session administrateur requise." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Corps JSON invalide." },
      { status: 400 },
    );
  }

  if (
    body &&
    typeof body === "object" &&
    (body as { mode?: unknown }).mode === "batch"
  ) {
    const parsedBatch = batchPayloadSchema.safeParse(body);
    if (!parsedBatch.success) {
      const issue = parsedBatch.error.issues[0];
      return NextResponse.json(
        {
          ok: false,
          error: `Données invalides (${issue?.path.join(".") || "batch"} : ${issue?.message || "erreur"}).`,
        },
        { status: 422 },
      );
    }

    const { products, rewriteEditorial } = parsedBatch.data;
    // Optimisation rapide : pour les gros lots (> 5 fiches), on utilise le
    // moteur déterministe instantané afin d'éviter tout dépassement de délai ;
    // pour un petit lot (≤ 5), on interroge OpenAI si configuré.
    if (products.length <= 5 && process.env.OPENAI_API_KEY?.trim()) {
      const optimized = await Promise.all(
        products.map((p) => optimizeDigitalProductSeoGeo(p, { rewriteEditorial })),
      );
      return NextResponse.json({
        ok: true,
        source: optimized.some((r) => r.source === "openai") ? "openai" : "template",
        products: optimized.map((r) => r.product),
      });
    }

    const optimized = products.map((p) =>
      templateDigitalSeoGeo(p, { rewriteEditorial }),
    );
    return NextResponse.json({
      ok: true,
      source: "template",
      products: optimized,
    });
  }

  const parsedSingle = singlePayloadSchema.safeParse(body);
  if (!parsedSingle.success) {
    const issue = parsedSingle.error.issues[0];
    return NextResponse.json(
      {
        ok: false,
        error: `Fiche invalide (${issue?.path.join(".") || "product"} : ${issue?.message || "erreur"}).`,
      },
      { status: 422 },
    );
  }

  const result = await optimizeDigitalProductSeoGeo(parsedSingle.data.product, {
    rewriteEditorial: parsedSingle.data.rewriteEditorial,
  });

  return NextResponse.json({
    ok: true,
    source: result.source,
    model: result.model,
    product: result.product,
  });
}
