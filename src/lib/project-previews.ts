import type { Demo } from "@/lib/site-types";
import { findPreviewEntry, previewSrc } from "@/lib/preview-manifest";

/**
 * Aperçus légers du carrousel d'accueil.
 *
 * Source principale : `public/previews/manifest.json`, mis à jour
 * automatiquement par `scripts/capture-previews.mjs` (captures desktop/mobile
 * des démos en production). Le tableau ci-dessous ne sert plus que de repli
 * pour d'anciens visuels qui ne figurent pas encore dans le manifeste.
 *
 * L'association se fait sur l'URL exacte du projet (hors slash terminal) :
 * changer l'URL dans l'administration ne rattache jamais une ancienne capture
 * sans rapport au nouveau site.
 */
const legacyPreviews: Record<string, { desktop: string; mobile: string; screenshot: boolean }> = {
  "https://al-manhaj-company.vercel.app": {
    desktop: "/previews/al-manhaj-company-desktop.webp",
    mobile: "/previews/al-manhaj-company-mobile.webp",
    screenshot: true,
  },
  "https://hala-dun.vercel.app": {
    desktop: "/previews/hala-perfumes-desktop.webp",
    mobile: "/previews/hala-perfumes-mobile.webp",
    screenshot: true,
  },
  "https://m-et-outillage-modele-3.vercel.app": {
    desktop: "/previews/tripo-teck-visual.webp",
    mobile: "/previews/tripo-teck-visual.webp",
    screenshot: false,
  },
  // MyPhone : visuels du projet (photos produits), pas des captures d'écran —
  // l'interface les étiquette « Project visual / صورة من المشروع ».
  "https://smartphine-demo.vercel.app": {
    desktop: "/previews/myphone-visual-desktop.webp",
    mobile: "/previews/myphone-visual-mobile.webp",
    screenshot: false,
  },
};

export function getProjectPreview(demo: Demo, mode: "desktop" | "mobile") {
  const entry = findPreviewEntry(demo.previewUrl);
  const fromManifest = previewSrc(entry, mode);
  if (fromManifest) {
    return { src: fromManifest, screenshot: entry?.screenshot ?? false };
  }

  const key = demo.previewUrl.trim().replace(/\/+$/, "");
  const legacy = legacyPreviews[key];
  return { src: legacy?.[mode] || demo.image, screenshot: legacy?.screenshot ?? false };
}
