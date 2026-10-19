import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { generateSeoCopy, type SeoDemoInput } from "@/lib/ai/seo-generator";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  title: z.string().min(2).max(300),
  titleEn: z.string().min(2).max(300),
  description: z.string().min(2).max(1000),
  descriptionEn: z.string().min(2).max(1000),
  sectorAr: z.string().min(1).max(200),
  sectorEn: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  await requireAdmin();
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 }); }
  const parsed = inputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données de la réalisation invalides.", details: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const demo: SeoDemoInput = parsed.data;
    const { copy, engine } = await generateSeoCopy(demo);
    return NextResponse.json({ copy, engine });
  } catch (error) {
    console.error("[ai-seo]", error);
    return NextResponse.json({ error: "Génération impossible pour le moment." }, { status: 502 });
  }
}
