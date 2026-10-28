import type { MetadataRoute } from "next";
import { getSiteDataCached } from "@/lib/store";
import { siteConfig } from "@/lib/config";
import { dirOf } from "@/lib/locale";

/**
 * Web App Manifest — installabilité PWA et identification de l'application
 * dans les résultats mobiles / suggestions des moteurs.
 *
 * La langue et le sens de lecture suivent la langue principale du site
 * (arabe par défaut, réglable dans /admin → Réglages) : une PWA installée en
 * arabe s'ouvre en RTL, pas en anglais.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let configured: string = siteConfig.appearance.defaultLocale;
  try {
    const { config } = await getSiteDataCached();
    configured = String(config.appearance?.defaultLocale ?? configured);
  } catch {
    /* base indisponible : on garde la langue principale codée en dur */
  }
  const defaultLocale: "ar" | "en" = configured === "en" ? "en" : "ar";
  const ar = defaultLocale === "ar";

  return {
    name: ar ? "نخبة Nukhba — وكالة مواقع فاخرة عالمياً" : "Nukhba نخبة — Premium Web Agency Worldwide",
    short_name: "Nukhba نخبة",
    description: ar
      ? "وكالة تصميم مواقع ومتاجر إلكترونية فاخرة — تسليم في 7 أيام، دفع بالعملات الرقمية."
      : "Premium web design & e-commerce agency for clients worldwide — delivered in 7 days.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: defaultLocale,
    dir: dirOf(defaultLocale),
    orientation: "portrait-primary",
    background_color: "#08080A",
    theme_color: "#C6A664",
    categories: ["business", "design", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      // PNG générés depuis icon.svg : requis par Chrome/Android pour
      // l'installabilité PWA complète (le SVG seul ne suffit pas).
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
