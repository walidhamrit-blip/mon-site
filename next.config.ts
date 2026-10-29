import type { NextConfig } from "next";

const isVercelProduction = process.env.VERCEL_ENV === "production";

/**
 * En-têtes de sécurité — appliqués à toutes les réponses servies par
 * Next.js :
 *
 * - `Strict-Transport-Security` (HSTS) : force HTTPS pendant 1 an.
 * - `X-Content-Type-Options: nosniff` : bloque le MIME sniffing.
 * - `X-Frame-Options: SAMEORIGIN` (production) : interdit l'embarquement
 *   en <iframe> par des sites tiers (anti-clickjacking) tout en autorisant
 *   nos propres démos embarquées en même origine (`/live-demos/...`).
 *   Omis hors production pour permettre l'aperçu temps réel (Vercel Preview
 *   Toolbar / Arena Live Preview).
 * - `Referrer-Policy: strict-origin-when-cross-origin` : limite la fuite
 *   d'URL complètes vers les sites externes.
 * - `Permissions-Policy` : ferme les API navigateur sensibles non utilisées
 *   (caméra, micro, géoloc, USB, MIDI, VR…) et conserve `autoplay=(self)`
 *   ainsi que `fullscreen=*` pour les aperçus interactifs plein écran.
 * - `Content-Security-Policy` :
 *   - `default-src 'self'` ;
 *   - `script-src` : `'self' 'unsafe-inline'` (hydratation Next.js + script
 *     de thème sans clignotement `themeBootScript`) + Vercel scripts / GTM ;
 *   - `style-src` : `'self' 'unsafe-inline'` (Tailwind v4) ;
 *   - `font-src` : `'self' data:` — les polices sont auto-hébergées
 *     (`public/fonts`), plus aucune requête vers Google Fonts ;
 *   - `img-src` : `'self' data: blob: https:` (toutes les miniatures de
 *     projets, y compris celles ajoutées dynamiquement depuis `/admin`) ;
 *   - `frame-src` : `'self' https:` — INDISPENSABLE pour afficher en direct
 *     tous les sites clients réels dans la galerie interactive (`DemosGallery`,
 *     `IdentityStudio`, `FullscreenLiveViewer`, `/demos/[slug]`), y compris
 *     `demo-cabinet-medecin.vercel.app`, tous les `*.vercel.app`, les
 *     domaines clients personnalisés ajoutés depuis `/admin`, et NOWPayments ;
 *   - `frame-ancestors` : `'self'` en production (anti-clickjacking tout en
 *     autorisant `/live-demos/*`), élargi hors production pour les aperçus.
 */
// En développement, React compile son JSX à la volée avec `eval()` : sans
// `'unsafe-eval'` la CSP bloque le runtime, l'hydratation échoue et les
// composants animés restent invisibles (opacité initiale 0 de Framer Motion).
// On l'autorise donc uniquement hors production — la CSP déployée reste stricte.
const isDev = process.env.NODE_ENV !== "production";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://www.googletagmanager.com"
    : "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.nowpayments.io https://api-sandbox.nowpayments.io https://api.openai.com https://*.openai.azure.com https://openrouter.ai https://api.indexnow.org https://www.google-analytics.com https://*.ingest.sentry.io",
  "frame-src 'self' https:",
  isVercelProduction
    ? "frame-ancestors 'self'"
    : "frame-ancestors 'self' https: http:",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isVercelProduction ? ["upgrade-insecure-requests"] : []),
];

const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  ...(isVercelProduction
    ? [{ key: "X-Frame-Options", value: "SAMEORIGIN" }]
    : []),
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "autoplay=(self)",
      "camera=()",
      "display-capture=()",
      "encrypted-media=(self)",
      "fullscreen=*",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "picture-in-picture=(self)",
      "publickey-credentials-get=()",
      "screen-wake-lock=()",
      "sync-xhr=()",
      "usb=()",
      "xr-spatial-tracking=()",
    ].join(", "),
  },
  {
    key: "Content-Security-Policy",
    value: CSP_DIRECTIVES.join("; "),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
];

const nextConfig: NextConfig = {
  // Hôtes autorisés à charger les ressources du serveur de développement.
  // `*.e2b.app` couvre l'aperçu Arena, `localhost`/`127.0.0.1` le poste local :
  // sans ces entrées, Next bloque `/_next/hmr` en cross-origin, le runtime
  // client ne démarre pas et les pages restent figées sans hydratation.
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1", "*.localhost"],
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "demo-cabinet-medecin.vercel.app" },
      { protocol: "https", hostname: "al-manhaj-company.vercel.app" },
      { protocol: "https", hostname: "m-et-outillage-modele-3.vercel.app" },
      { protocol: "https", hostname: "tulin-magazin.vercel.app" },
      { protocol: "https", hostname: "pizzeria-demo1.vercel.app" },
      { protocol: "https", hostname: "demo-meubles.vercel.app" },
      { protocol: "https", hostname: "hala-dun.vercel.app" },
      { protocol: "https", hostname: "demo-jouets.vercel.app" },
      { protocol: "https", hostname: "al-massa.vercel.app" },
      { protocol: "https", hostname: "al-bay.vercel.app" },
      { protocol: "https", hostname: "alssadaka-sanitary.vercel.app" },
      { protocol: "https", hostname: "smartphine-demo.vercel.app" },
      { protocol: "https", hostname: "**.vercel.app" },
      { protocol: "https", hostname: "**" },
    ],
    // Captures locales servies avec un hash anti-cache (`?v=…`) : autorise
    // l'optimisation Next (srcset retina) malgré la query string.
    localPatterns: [
      { pathname: "/previews/**" },
      { pathname: "/guide-crypto/**" },
      // Avatar Einstein du assistant flottant (src/components/site-chatbot.tsx).
      { pathname: "/chatbot/**" },
      // Visuels locaux des cartes cadeaux et codes du catalogue numérique.
      { pathname: "/digital-products/**" },
      // Jaquettes de jeux de la vitrine `/codes` (portrait 600×900).
      // Sans cette entrée, `next/image` refuse l'optimisation et la carte
      // renvoie une erreur 500 au lieu d'afficher la jaquette.
      { pathname: "/game-covers/**" },
    ],
    // Qualités utilisées par les visuels nets (bannière, guide crypto).
    qualities: [75, 88, 90],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async redirects() {
    return [
      // Les variants /ar et /en déclarés auparavant n'existent pas comme
      // routes (la langue est gérée côté client) : on évite les 404 SEO.
      { source: "/ar", destination: "/", permanent: false },
      { source: "/en", destination: "/", permanent: false },
      // Alias conviviaux vers les pages Applications & Produits numériques.
      // Permanents (301) : ces alias sont stables, la consolidation SEO est
      // donc souhaitable. Les /ar et /en ci-dessus restent temporaires —
      // de vraies routes localisées pourraient exister un jour.
      { source: "/applications", destination: "/apps", permanent: true },
      { source: "/nos-applications", destination: "/apps", permanent: true },
      { source: "/produits", destination: "/products", permanent: true },
      { source: "/nos-produits", destination: "/products", permanent: true },
      { source: "/logiciels", destination: "/products", permanent: true },
      // Slugs d'articles historiques en français → slugs anglais descriptifs.
      // Le site vise un public arabe/anglais : un slug français n'aide ni la
      // compréhension ni le partage. Redirections 301 pour ne perdre aucun
      // lien ni signal déjà acquis.
      {
        source: "/blog/prix-site-web-libye-2026",
        destination: "/blog/website-cost-libya-2026",
        permanent: true,
      },
      {
        source: "/blog/choisir-agence-web-tripoli",
        destination: "/blog/choose-web-agency-tripoli",
        permanent: true,
      },
      {
        source: "/blog/lancer-boutique-en-ligne-libye",
        destination: "/blog/launch-online-store-libya",
        permanent: true,
      },
      {
        source: "/blog/apparaitre-dans-chatgpt-google-ai-libye",
        destination: "/blog/get-cited-by-chatgpt-google-ai",
        permanent: true,
      },
      {
        source: "/blog/site-web-clinique-tripoli",
        destination: "/blog/clinic-website-booking-tripoli",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
