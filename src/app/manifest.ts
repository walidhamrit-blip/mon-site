import type { MetadataRoute } from "next";

/**
 * Web App Manifest — installabilité PWA et identification de l'application
 * dans les résultats mobiles / suggestions des moteurs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "نخبة — وكالة تصميم مواقع طرابلس | Nukhba Web Agency Tripoli",
    short_name: "نخبة Nukhba",
    description:
      "وكالة تصميم وتطوير مواقع ومتاجر إلكترونية في طرابلس — تسليم في 7 أيام.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "ar",
    dir: "rtl",
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
