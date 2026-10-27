import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import type { Demo } from "@/lib/site-types";
import type { ServiceLandingContent, ServiceLike } from "@/lib/services";
import type { SectorSeo } from "@/lib/sectors";

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
              Web Agency — Worldwide
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
          <span style={{ opacity: 0.85 }}>Live Demo — Customizable</span>
          <span dir="ltr" style={{ color: "#D4B978", fontWeight: 700 }}>
            {domain}
          </span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}

/** Carte de partage d'une page service (/services/[service]). */
export async function buildServiceOgImage(
  service: ServiceLike,
  landing: ServiceLandingContent,
  config: OgConfig,
) {
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
            "radial-gradient(circle at 85% 12%, rgba(198,166,100,0.24), transparent 45%), linear-gradient(135deg, #0C0C0F 0%, #17131D 100%)",
          color: "#F5F3EE",
          fontFamily: "Cairo",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "#C6A664",
                color: "#0C0C0F",
                fontSize: "34px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ن
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "28px", fontWeight: 700 }}>
                {config.nameAr} {config.name}
              </span>
              <span style={{ fontSize: "18px", opacity: 0.6, marginTop: "2px" }}>
                Digital Services — Worldwide
              </span>
            </div>
          </div>
          <div
            dir="ltr"
            style={{
              display: "flex",
              border: "1px solid rgba(198,166,100,0.55)",
              background: "rgba(198,166,100,0.12)",
              color: "#D4B978",
              borderRadius: "999px",
              padding: "10px 22px",
              fontSize: "20px",
              fontWeight: 700,
            }}
          >
            from ${service.priceFromUsd}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              alignSelf: "flex-start",
              display: "flex",
              borderRadius: "999px",
              background: "rgba(245,243,238,0.10)",
              border: "1px solid rgba(245,243,238,0.16)",
              padding: "8px 20px",
              fontSize: "18px",
              opacity: 0.85,
            }}
          >
            {landing.deliveryAr}
          </div>
          <div
            style={{
              fontSize: "50px",
              fontWeight: 700,
              lineHeight: 1.28,
              maxWidth: "1040px",
            }}
          >
            {clamp(landing.h1Ar, 64)}
          </div>
          <div
            dir="ltr"
            style={{
              alignSelf: "flex-start",
              fontSize: "22px",
              opacity: 0.62,
              maxWidth: "1040px",
              textAlign: "left",
            }}
          >
            {clamp(service.titleEn, 95)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(245,243,238,0.14)",
            paddingTop: "22px",
            fontSize: "20px",
          }}
        >
          <span style={{ opacity: 0.85 }}>خدمة سريعة بأسعار معلنة — Open service</span>
          <span dir="ltr" style={{ color: "#D4B978", fontWeight: 700 }}>
            {domain}
          </span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}

/** Carte de partage d'une page secteur (/sectors/[sector]). */
export async function buildSectorOgImage(
  sector: SectorSeo,
  config: OgConfig,
  demoCount: number,
) {
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
            "radial-gradient(circle at 12% 88%, rgba(198,166,100,0.20), transparent 42%), linear-gradient(140deg, #0B0B0E 0%, #1A1512 100%)",
          color: "#F5F3EE",
          fontFamily: "Cairo",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: "#C6A664",
              color: "#0C0C0F",
              fontSize: "34px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ن
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "28px", fontWeight: 700 }}>
              {config.nameAr} {config.name}
            </span>
            <span style={{ fontSize: "18px", opacity: 0.6, marginTop: "2px" }}>
              Web Agency — Worldwide
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              alignSelf: "flex-start",
              display: "flex",
              border: "1px solid rgba(198,166,100,0.55)",
              background: "rgba(198,166,100,0.12)",
              color: "#D4B978",
              borderRadius: "999px",
              padding: "9px 22px",
              fontSize: "20px",
              fontWeight: 700,
            }}
          >
            {sector.labelAr} · {sector.labelEn}
          </div>
          <div
            style={{
              fontSize: "50px",
              fontWeight: 700,
              lineHeight: 1.28,
              maxWidth: "1040px",
            }}
          >
            {clamp(sector.h1Ar, 62)}
          </div>
          <div
            dir="ltr"
            style={{
              alignSelf: "flex-start",
              fontSize: "22px",
              opacity: 0.62,
              maxWidth: "1040px",
              textAlign: "left",
            }}
          >
            {clamp(sector.titleEn, 100)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(245,243,238,0.14)",
            paddingTop: "22px",
            fontSize: "20px",
          }}
        >
          <span style={{ opacity: 0.85 }}>
            {demoCount} مشروع حي · Live showcases
          </span>
          <span dir="ltr" style={{ color: "#D4B978", fontWeight: 700 }}>
            {domain}
          </span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}

/** Carte de partage d'un guide du blog (/blog/[slug]). */
export async function buildArticleOgImage(
  article: {
    titleAr: string;
    titleEn: string;
    categoryAr: string;
    categoryEn: string;
    readingMinutes: number;
  },
  config: OgConfig,
) {
  const fonts = await loadFonts();
  const domain = new URL(config.url).host;

  return new ImageResponse(
    (
      <div
        dir="ltr"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background:
            "radial-gradient(circle at 78% 18%, rgba(198,166,100,0.20), transparent 46%), linear-gradient(160deg, #0B0B0F 0%, #151016 100%)",
          color: "#F5F3EE",
          fontFamily: "Cairo",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: "58px",
                height: "58px",
                borderRadius: "50%",
                background: "#C6A664",
                color: "#0C0C0F",
                fontSize: "32px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ن
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "26px", fontWeight: 700 }}>
                {config.name} {config.nameAr} — Blog
              </span>
              <span style={{ fontSize: "17px", opacity: 0.6, marginTop: "2px" }}>
                Practical guides for businesses worldwide
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              border: "1px solid rgba(198,166,100,0.5)",
              background: "rgba(198,166,100,0.12)",
              color: "#D4B978",
              borderRadius: "999px",
              padding: "9px 20px",
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            {article.categoryEn}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              fontSize: "48px",
              fontWeight: 700,
              lineHeight: 1.3,
              maxWidth: "1050px",
            }}
          >
            {clamp(article.titleEn, 90)}
          </div>
          <div
            dir="ltr"
            style={{
              alignSelf: "flex-start",
              fontSize: "21px",
              opacity: 0.6,
              maxWidth: "1050px",
              textAlign: "left",
            }}
          >
            {clamp(article.titleAr, 78)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(245,243,238,0.14)",
            paddingTop: "22px",
            fontSize: "19px",
          }}
        >
          <span style={{ opacity: 0.8 }}>
            Guide · {article.readingMinutes} min read · Nukhba Guides
          </span>
          <span dir="ltr" style={{ color: "#D4B978", fontWeight: 700 }}>
            {domain}
          </span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}

/**
 * Coche (✓) et croix (✗) dessinées en SVG inline.
 *
 * Les glyphes Unicode ✓ / ✗ sont absents de la police Cairo livrée avec le
 * site : rendus en texte, ils s'affichaient en carrés vides. On les dessine
 * donc en tracés SVG — Satori les supporte nativement.
 */
function checkMark(size: number) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6L9 17l-5-5"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function crossMark(size: number) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Carte de partage d'une page comparative (/compare/[slug]).
 *
 * C'est l'« annonce » du site rendue en code : deux colonnes — l'alternative
 * à gauche sur fond rouge avec ses points faibles (✗), نخبة à droite sur fond
 * vert avec ses avantages (✓) — exactement le format de l'affiche de
 * comparaison, mais générée automatiquement à partir des données de
 * `src/lib/comparisons.ts`. Aucune retouche graphique à faire : ajouter une
 * comparaison produit une nouvelle carte.
 */
export async function buildComparisonOgImage(
  comparison: {
    competitorEn: string;
    themPriceLabel: string;
    themPoints: ReadonlyArray<{ textEn: string }>;
    usPriceLabelEn: string;
    usPoints: ReadonlyArray<{ textEn: string }>;
    h1En: string;
  },
  config: OgConfig,
) {
  const fonts = await loadFonts();
  const domain = new URL(config.url).host;
  const RED = "#C1272D";
  const GREEN = "#0E9F6E";

  const panel = (
    background: string,
    positive: boolean,
    price: string,
    caption: string,
    points: ReadonlyArray<{ textEn: string }>,
  ) => (
    <div
      style={{
        width: "50%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "46px 44px",
        background,
        color: "#FFFFFF",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.22)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {positive ? checkMark(22) : crossMark(22)}
        </div>
        <span style={{ fontSize: "26px", fontWeight: 700, opacity: 0.95 }}>
          {caption}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          dir="ltr"
          style={{ fontSize: "58px", fontWeight: 700, lineHeight: 1.05 }}
        >
          {price}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {points.slice(0, 4).map((point, index) => (
          <div
            key={index}
            style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}
          >
            <div
              style={{
                width: "20px",
                height: "22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.95,
              }}
            >
              {positive ? checkMark(18) : crossMark(18)}
            </div>
            <span
              style={{ fontSize: "20px", lineHeight: 1.35, opacity: 0.95 }}
            >
              {clamp(point.textEn, 52)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        dir="ltr"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0C0C0F",
          color: "#F5F3EE",
          fontFamily: "Cairo",
        }}
      >
        {/* Bandeau supérieur : marque + promesse */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "26px 44px",
            background: "#0C0C0F",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "#C6A664",
                color: "#0C0C0F",
                fontSize: "24px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              N
            </div>
            <span style={{ fontSize: "24px", fontWeight: 700 }}>
              {config.name} — {config.nameAr}
            </span>
          </div>
          <span style={{ fontSize: "22px", opacity: 0.7 }}>
            {clamp(comparison.h1En, 58)}
          </span>
        </div>

        {/* L'affiche : deux colonnes */}
        <div style={{ display: "flex", flex: 1 }}>
          {panel(
            RED,
            false,
            comparison.themPriceLabel,
            comparison.competitorEn,
            comparison.themPoints,
          )}
          {panel(
            GREEN,
            true,
            comparison.usPriceLabelEn,
            `${config.name} — Premium Web Agency`,
            comparison.usPoints,
          )}
        </div>

        {/* Pied : domaine */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 44px",
            background: "#0C0C0F",
            fontSize: "20px",
            opacity: 0.75,
          }}
        >
          <span>One-time price · owned asset · 7-day delivery</span>
          <span style={{ color: "#D4B978", fontWeight: 700 }}>{domain}</span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
