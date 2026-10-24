import type { MetadataRoute } from "next";

/**
 * Web App Manifest — installabilité PWA et identification de l'application
 * dans les résultats mobiles / suggestions des moteurs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nukhba نخبة — Premium Web Agency Worldwide",
    short_name: "Nukhba نخبة",
    description:
      "Premium web design & e-commerce agency for clients worldwide — delivered in 7 days.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "en",
    dir: "ltr",
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
