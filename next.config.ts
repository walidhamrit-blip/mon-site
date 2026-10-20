import type { NextConfig } from "next";

/**
 * En-têtes de sécurité — appliqués à toutes les réponses servies par
 * Next.js (HTML, routes API, assets statiques servis par le CDN Vercel
 * reçoivent ces en-têtes par défaut ; les fichiers `public/` ne les
 * reçoivent pas, c'est attendu : ce sont des images/favicon inoffensifs).
 *
 * - `Strict-Transport-Security` (HSTS) : force HTTPS pendant 1 an, preload
 *   activable côté HSTS Preload List submission.
 * - `X-Content-Type-Options: nosniff` : bloque le MIME sniffing.
 * - `X-Frame-Options: DENY` : interdit l'embarquement en <iframe> — bloque
 *   totalement le clickjacking (CSP frame-ancestors renforce ce point).
 * - `Referrer-Policy: strict-origin-when-cross-origin` : limite la fuite
 *   d'URL complètes vers les sites externes (utile contre la fuite SEO).
 * - `Permissions-Policy` : ferme les API navigateur puissantes non
 *   utilisées (caméra, micro, géoloc, paiement, USB, MIDI, VR…) ; garde
 *   l'autoplay et l'API plein-écrin utiles au site.
 * - `Content-Security-Policy` :
 *   - `default-src 'self'` : tout fermé par défaut ;
 *   - `script-src` : autorise le code inline (`'unsafe-inline'`) car
 *     Next.js injecte des <script> inline pour l'hydratation et la mise
 *     en place du thème avant le 1er render (cf. `themeBootScript`) ;
 *     on utilise en complément un `nonce` côté serveur (cf. middleware)
 *     pour durcir dans un second temps, mais on garde l'inline pour
 *     rester compatible avec le mode clair/sombre sans clignotement ;
 *   - `style-src` autorise Google Fonts (`fonts.googleapis.com`) + inline
 *     (Tailwind v4 émet du CSS critique inline) ;
 *   - `font-src` autorise `fonts.gstatic.com` (fichiers .woff2 signés) ;
 *   - `img-src` autorise toutes les sources `next/image` configurées
 *     (`images.unsplash.com`, `images.pexels.com`, `i.pravatar.cc`,
 *     `*.vercel.app`, `data:` et `blob:` pour les aperçus) ;
 *   - `connect-src` autorise les appels API paiement/LLM ;
 *   - `frame-src` autorise la passerelle crypto (`nowpayments.io`) ;
 *   - `frame-ancestors 'none'` : défense en profondeur contre
 *     le clickjacking ;
 *   - `base-uri 'self'` et `form-action 'self'` : limite les vecteurs
 *     d'injection via <base> ou formulaires externes.
 * - `Cross-Origin-*` : cloisonne les origines pour les embeddings.
 */
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "autoplay=(self)",
      "camera=()",
      "display-capture=()",
      "encrypted-media=(self)",
      "fullscreen=(self)",
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
    value: [
      "default-src 'self'",
      // Scripts : 'unsafe-inline' conservé pour les scripts d'hydratation
      // et de boot de thème émis par Next.js. Les bundles Next.js sont
      // chargés depuis 'self'.
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
      // Styles : 'unsafe-inline' requis par Tailwind v4 (CSS critique
      // inline) ; Google Fonts fourni les .css externes.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Images : `next/image` autorise un large panel d'hôtes distants
      // (Unsplash, Pexels, démos Pics*); `data:` pour les placeholders
      // inline, `blob:` pour les aperçus locaux générés côté client.
      "img-src 'self' data: blob: https://images.unsplash.com https://images.pexels.com https://i.pravatar.cc https://*.vercel.app https://*.public.blob.vercel-storage.com",
      // Fetch / XHR : endpoints API + passerelle crypto.
      "connect-src 'self' https://api.nowpayments.io https://api-sandbox.nowpayments.io https://api.openai.com https://*.openai.azure.com https://openrouter.ai https://api.indexnow.org https://www.google-analytics.com https://*.ingest.sentry.io",
      "frame-src 'self' https://nowpayments.io https://*.nowpayments.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "media-src 'self'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.e2b.app"],
  // `poweredByHeader: false` retire l'en-tête `X-Powered-By: Next.js`
  // qui ne révèle aucun secret mais confirme la pile technique (utile
  // à masquer pour ne pas faciliter le ciblage de CVE framework).
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
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
    ],
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
      // Les variants /ar et /en déclarés en hreflang n'existent pas comme
      // routes (la langue est gérée côté client) : on évite les 404 SEO.
      { source: "/ar", destination: "/", permanent: false },
      { source: "/en", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
