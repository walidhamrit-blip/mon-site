import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  generateSeoCopy,
  generateSeoCopyBatch,
  type SeoDemoInput,
} from "@/lib/ai/seo-generator";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  title: z.string().min(2).max(300),
  titleEn: z.string().min(2).max(300),
  description: z.string().min(2).max(1000),
  descriptionEn: z.string().min(2).max(1000),
  sectorAr: z.string().min(1).max(200),
  sectorEn: z.string().min(1).max(200),
});

const batchSchema = z.object({
  demos: z.array(inputSchema).min(1).max(50),
});

export async function POST(request: Request) {
  await requireAdmin();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  // Mode lot (batch) : `{ demos: [...] }`
  if (
    typeof payload === "object" &&
    payload !== null &&
    "demos" in payload
  ) {
    const parsedBatch = batchSchema.safeParse(payload);
    if (!parsedBatch.success) {
      return NextResponse.json(
        {
          error: "Liste de réalisations invalide.",
          details: parsedBatch.error.flatten(),
        },
        { status: 422 },
      );
    }
    try {
      const { items, engine, warning } = await generateSeoCopyBatch(
        parsedBatch.data.demos,
      );
      return NextResponse.json({
        copies: items.map((item) => item.copy),
        engine,
        warning,
      });
    } catch (error) {
      console.error("[ai-seo:batch]", error);
      return NextResponse.json(
        { error: "Génération en lot impossible pour le moment." },
        { status: 502 },
      );
    }
  }

  // Mode unitaire : `{ title, titleEn, description, descriptionEn, sectorAr, sectorEn }`
  const parsed = inputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données de la réalisation invalides.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  try {
    const demo: SeoDemoInput = parsed.data;
    // Statut 200 conservé : `copy` est toujours exploitable (repli gabarit).
    // `engine: "error"` + `warning` indiquent à l'admin qu'une clé existe mais
    // que l'appel a échoué (clé refusée, quota, timeout…).
    const { copy, engine, warning } = await generateSeoCopy(demo);
    return NextResponse.json({ copy, engine, warning });
  } catch (error) {
    console.error("[ai-seo]", error);
    return NextResponse.json(
      { error: "Génération impossible pour le moment." },
      { status: 502 },
    );
  }
}
