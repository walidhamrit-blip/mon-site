import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { db, ensureSchema } from "@/db";
import { mediaAssets } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { enforceSameOrigin } from "@/lib/csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = 4.5 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

/**
 * Importe une photo depuis le panneau admin, la normalise en WebP puis la
 * stocke dans PostgreSQL. Aucun fichier n'est écrit sur le disque serverless.
 * L'image n'apparaît sur le site qu'après enregistrement du réglage associé.
 */
export async function POST(request: Request) {
  if (!enforceSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Origine de la requête refusée." },
      { status: 403 },
    );
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { ok: false, error: "Session administrateur expirée. Reconnectez-vous." },
      { status: 401 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Photo trop volumineuse (4 Mo maximum)." },
      { status: 413 },
    );
  }

  let file: File;
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (!(candidate instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Sélectionnez une photo à importer." },
        { status: 400 },
      );
    }
    file = candidate;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Le fichier n’a pas pu être lu." },
      { status: 400 },
    );
  }

  if (!ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: "Format accepté : JPG, PNG, WebP ou AVIF." },
      { status: 415 },
    );
  }
  if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Photo trop volumineuse (4 Mo maximum)." },
      { status: 413 },
    );
  }

  try {
    const source = Buffer.from(await file.arrayBuffer());
    const image = sharp(source, { limitInputPixels: 40_000_000 }).rotate();
    let output = await image
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    // Les images très détaillées sont recompressées une fois plutôt que de
    // remplir inutilement la base avec des visuels trop lourds pour le web.
    if (output.byteLength > MAX_OUTPUT_BYTES) {
      output = await sharp(source, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 70 })
        .toBuffer();
    }
    if (output.byteLength > MAX_OUTPUT_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Cette photo reste trop lourde après optimisation. Réduisez ses dimensions puis réessayez." },
        { status: 422 },
      );
    }

    await ensureSchema();
    const id = randomUUID();
    await db.insert(mediaAssets).values({
      id,
      mimeType: "image/webp",
      data: output.toString("base64"),
      sizeBytes: output.byteLength,
      originalName: file.name.slice(0, 240) || null,
    });

    return NextResponse.json({
      ok: true,
      url: `/api/media/${id}`,
      size: output.byteLength,
      message: "Photo importée et optimisée. Enregistrez pour la publier.",
    });
  } catch (error) {
    console.error(
      "[admin][media] import impossible :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "Import impossible. Vérifiez la photo et la connexion à la base, puis réessayez." },
      { status: 500 },
    );
  }
}
