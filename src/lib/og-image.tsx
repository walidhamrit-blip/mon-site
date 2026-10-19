import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import type { Demo } from "@/lib/site-types";

/**
 * Génération des images Open Graph / Twitter (1200×630) à la volée avec
 * next/og (Satori). Aucun travail de design manuel : chaque fiche réalisation
 * reçoit une image de partage brandée, rendue côté serveur en Node.js.
 *
 * Cairo est vendu dans src/lib/fonts en TTF : Satori n'accepte pas le WOFF2
 * et exige une police couvrant l'arabe. Lecture par fs (et non import) pour
 * éviter tout traitement de module .ttf par le bundler.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;

let fontsCache: { name: string; data: Buffer; weight: 400 | 700 }[] | null = null;

async function loadFonts() {
  if (fontsCache) return fontsCache;
  const [regular, bold] = await Promise.all([
    readFile(new URL("./fonts/Cairo_400Regular.ttf", import.meta.url)),
    readFile(new URL("./fonts/Cairo_700Bold.ttf", import.meta.url)),
  ]);
  fontsCache = [
    { name: "Cairo", data: regular, weight: 400 },
    { name: "Cairo", data: bold, weight: 700 },
  ];
  return fontsCache;
}

/** Tronque sans couper un mot, avec ellipse (Satori ne gère pas line-clamp). */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

type OgConfig = { url: string; name: string; nameAr: string };

/** Carte de partage d'une réalisation (/demos/[slug]). */
export async function buildDemoOgImage(demo: Demo, config: OgConfig) {
  const fonts = await loadFonts();
  const domain = new URL(config.url).host;

  return new ImageResponse(
    (
      <div
        dir="rtl"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background:
            "radial-gradient(circle at 85% 10%, rgba(198,166,100,0.22), transparent 45%), linear-gradient(135deg, #0C0C0F 0%, #16131C 100%)",
          color: "#F5F3EE",
          fontFamily: "Cairo",
          position: "relative",
        }}
      >
        {/* En-tête : marque */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "#C6A664",
              color: "#0C0C0F",
              fontSize: "38px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ن
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "32px", fontWeight: 700 }}>
              {config.nameAr} {config.name}
            </span>
            <span style={{ fontSize: "20px", opacity: 0.65, marginTop: "2px" }}>
              وكالة تصميم مواقع — طرابلس، ليبيا
            </span>
          </div>
        </div>

        {/* Corps : secteur + titre bilingue */}
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div
            style={{
              alignSelf: "flex-start",
              display: "flex",
              border: "1px solid rgba(198,166,100,0.55)",
              background: "rgba(198,166,100,0.12)",
              color: "#D4B978",
              borderRadius: "999px",
              padding: "10px 24px",
              fontSize: "22px",
              fontWeight: 700,
            }}
          >
            {demo.sectorAr}
          </div>
          <div
            style={{
              fontSize: "54px",
              fontWeight: 700,
              lineHeight: 1.25,
              maxWidth: "1050px",
            }}
          >
            {clamp(demo.title, 62)}
          </div>
          <div
            dir="ltr"
            style={{
              alignSelf: "flex-start",
              fontSize: "24px",
              opacity: 0.65,
              maxWidth: "1050px",
              textAlign: "left",
            }}
          >
            {clamp(demo.titleEn, 95)}
          </div>
        </div>

        {/* Pied : domaine + mention */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(245,243,238,0.14)",
            paddingTop: "24px",
            fontSize: "22px",
          }}
        >
          <span style={{ opacity: 0.85 }}>معرض حي قابل للتخصيص — Live Demo</span>
          <span dir="ltr" style={{ color: "#D4B978", fontWeight: 700 }}>
            {domain}
          </span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
