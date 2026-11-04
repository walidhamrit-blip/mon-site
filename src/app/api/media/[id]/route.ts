import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { mediaAssets } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Sert une image importée. Son UUID ne change jamais : cache long immutable. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return new Response("Image introuvable", { status: 404 });
  }

  try {
    await ensureSchema();
    const [asset] = await db
      .select({
        mimeType: mediaAssets.mimeType,
        data: mediaAssets.data,
        sizeBytes: mediaAssets.sizeBytes,
      })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);

    if (!asset) return new Response("Image introuvable", { status: 404 });
    const bytes = Buffer.from(asset.data, "base64");
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.sizeBytes || bytes.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "[media] lecture impossible :",
      error instanceof Error ? error.message : error,
    );
    return new Response("Image temporairement indisponible", { status: 503 });
  }
}
