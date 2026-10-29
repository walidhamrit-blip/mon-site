import type { MetadataRoute } from "next";
import { getSiteDataCached } from "@/lib/store";
import { siteConfig } from "@/lib/config";
import { dirOf } from "@/lib/locale";
import { siteLocale } from "@/lib/seo";

/**
 * Web App Manifest — installabilité PWA et identification de l'application
 * dans les résultats mobiles / suggestions des moteurs.
 *
 * La langue et le sens de lecture suivent la langue principale du site
 * (arabe par défaut, réglable dans /admin → Réglages) : une PWA installée en
 * arabe s'ouvre en RTL, pas en anglais.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // Langue de référence : `siteLocale()` applique la priorité voulue
  // (`primaryLocale` explicite, sinon langue du marché) — le champ
  // `defaultLocale` n'est plus qu'un repli historique.
  let defaultLocale: "ar" | "en" = siteConfig.appearance.defaultLocale;
  try {
    const { config } = await getSiteDataCached();
    defaultLocale = siteLocale(config);
  } catch {
    /* base indisponible : on garde la langue principale codée en dur */
  }
  const ar = defaultLocale === "ar";

  return {
    // Le positionnement du manifeste doit être celui du site réel :
    // agence web **et** boutique d'codes numériques (le manifeste est la
    // première fiche que Google lit pour une PWA).
    name: ar
      ? "نخبة Nukhba — تصميم مواقع ومتجر أكواد رقمية"
      : "Nukhba نخبة — Web Design & Digital Store",
    short_name: "Nukhba نخبة",
    description: ar
      ? "تصميم مواقع ومتاجر إلكترونية بالدولار مع متجر أكواد ألعاب وبرامج وبطاقات هدايا — تسليم في 7 أيام."
      : "Websites and online stores priced in USD, plus a digital store for game keys, software and gift cards — delivered in 7 days.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: defaultLocale,
    dir: dirOf(defaultLocale),
    orientation: "portrait-primary",
    background_color: "#08080A",
    theme_color: "#C6A664",
    categories: ["business", "design", "shopping"],
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
