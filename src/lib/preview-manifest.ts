import manifest from "../../public/previews/manifest.json";
import type { Demo } from "./site-types";

/**
 * Captures d'écran locales des démos (`public/previews`).
 *
 * Les images sont produites par `scripts/capture-previews.mjs` (Playwright +
 * WebP) puis référencées dans `public/previews/manifest.json`. Ce module est
 * l'unique point de lecture : il expose la capture à utiliser pour un projet,
 * avec repli sur les visuels historiques puis sur l'image du portfolio.
 *
 * Avantages par rapport à un tableau codé en dur :
 *   - le sitemap d'images, les données structurées et le carrousel lisent la
 *     même source, mise à jour automatiquement par le workflow ;
 *   - `?v=<hash>` invalide le cache navigateur quand la capture change, sans
 *     renommer les fichiers (historique Git stable) ;
 *   - une démo hors ligne conserve sa dernière capture connue au lieu de
 *     disparaître du site.
 */

export type PreviewVariant = "desktop" | "mobile";

export interface PreviewSize {
  width: number;
  height: number;
}

export interface PreviewEntry {
  slug: string;
  desktop: string;
  mobile: string;
  desktopSize?: PreviewSize;
  mobileSize?: PreviewSize;
  /** Empreinte courte du contenu : sert d'anti-cache (`?v=`). */
  hash?: string;
  capturedAt?: string;
  httpStatus?: number;
  /** Dernière vérification de disponibilité (même si le site est hors ligne). */
  lastCheckedAt?: string;
  lastError?: string;
  /** `ok` = capture valide, `down` = site injoignable (capture conservée). */
  status?: "ok" | "down";
  /** `true` = vraie capture d'écran, `false` = visuel fourni par le projet. */
  screenshot?: boolean;
  source?: "playwright" | "manual";
}

export interface PreviewManifest {
  version: number;
  generatedAt: string;
  viewports?: Record<PreviewVariant, PreviewSize>;
  projects: Record<string, PreviewEntry>;
}

export const previewManifest = manifest as PreviewManifest;

/** Normalise une URL de projet : sans slash final, sans fragment ni query. */
export function normalizePreviewUrl(url: string): string {
  const trimmed = String(url ?? "").trim();
  if (!trimmed || trimmed === "#") return "";
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.search = "";
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/[#?].*$/, "").replace(/\/+$/, "");
  }
}

/** Entrée de manifeste correspondant à l'URL d'aperçu d'une démo. */
export function findPreviewEntry(
  previewUrl: string,
  source: PreviewManifest = previewManifest,
): PreviewEntry | null {
  const key = normalizePreviewUrl(previewUrl);
  if (!key) return null;
  return source.projects?.[key] ?? null;
}

/** Chemin servi au navigateur, avec anti-cache quand une empreinte existe. */
export function previewSrc(entry: PreviewEntry | null, variant: PreviewVariant = "desktop"): string | null {
  if (!entry) return null;
  const path = variant === "mobile" ? entry.mobile : entry.desktop;
  if (!path) return null;
  if (!entry.hash) return path;
  return `${path}${path.includes("?") ? "&" : "?"}v=${entry.hash}`;
}

/**
 * Capture à afficher pour une démo. Priorité : manifeste (capture Playwright
 * ou visuel historique) → image du portfolio fournie par /admin.
 */
export function getDemoPreview(
  demo: Pick<Demo, "previewUrl" | "image">,
  variant: PreviewVariant = "desktop",
): { src: string; screenshot: boolean; capturedAt?: string; local: boolean } {
  const entry = findPreviewEntry(demo.previewUrl);
  const src = previewSrc(entry, variant);
  if (src) {
    return {
      src,
      screenshot: entry?.screenshot ?? false,
      capturedAt: entry?.capturedAt,
      local: true,
    };
  }
  return { src: demo.image, screenshot: false, local: false };
}

/**
 * Images locales d'une démo, sans anti-cache : utilisées par le sitemap
 * d'images (`<image:loc>` doit rester une URL canonique stable).
 */
export function getDemoPreviewImages(demo: Pick<Demo, "previewUrl">): string[] {
  const entry = findPreviewEntry(demo.previewUrl);
  if (!entry) return [];
  const paths = [entry.desktop, entry.mobile].filter(
    (path, index, all): path is string => Boolean(path) && all.indexOf(path) === index,
  );
  return paths;
}

/** Date de dernière capture d'une démo (sert à `dateModified` / sitemap). */
export function getDemoCapturedAt(demo: Pick<Demo, "previewUrl">): Date | null {
  const entry = findPreviewEntry(demo.previewUrl);
  if (!entry?.capturedAt) return null;
  const date = new Date(entry.capturedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}
