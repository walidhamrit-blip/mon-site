import type { MetadataRoute } from "next";

/**
 * Web App Manifest — installabilité PWA et identification de l'application
 * dans les résultats mobiles / suggestions des moteurs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Manifeste = première fiche que Google lit pour une PWA. Le
    // positionnement doit être celui du site réel (agence + boutique
    // d'codes), et la langue celle du marché (arabe pour la Libye).
    name: "نخبة Nukhba — تصميم مواقع ومتجر أكواد رقمية",
    short_name: "نخبة Nukhba",
    description:
      "تصميم مواقع ومتاجر إلكترونية بالدولار مع متجر أكواد ألعاب وبرامج وبطاقات هدايا — تسليم في 7 أيام.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "ar",
    dir: "rtl",
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
