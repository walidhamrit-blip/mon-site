import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware de sécurité : applique les en-têtes de sécurité à toutes
 * les réponses, y compris celles servies depuis `public/` (assets
 * statiques, manifest, robots, sitemap…) qui n'héritent pas des en-têtes
 * configurés dans `next.config.ts` quand le CDN les sert directement.
 *
 * - `Strict-Transport-Security` : force HTTPS pendant 1 an (les sous-
 *   domaines sont inclus). Vercel sert déjà en HTTPS, mais l'en-tête est
 *   nécessaire pour que les navigateurs appliquent HSTS sur les futures
 *   visites.
 * - `X-Content-Type-Options: nosniff` : bloque le MIME sniffing (utile
 *   notamment pour les manifestes, robots.txt et svg).
 * - `Referrer-Policy` : politique stricte pour éviter les fuites d'URL
 *   internes vers des sites externes.
 * - `Permissions-Policy` : ferme les API navigateur puissantes non
 *   utilisées (cf. next.config.ts pour la liste complète).
 *
 * La CSP est appliquée dans `next.config.ts` — le middleware ne peut pas
 * générer de nonce par requête de manière fiable dans tous les modes de
 * rendu (le HTML est parfois servi depuis le cache CDN).
 */
const HEADER_KEYS = [
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
] as const;

function buildPermissionPolicy(): string {
  return [
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
  ].join(", ");
}

export function middleware(request: NextRequest) {
  // On ne touche pas aux routes internes Next (`_next/…`) ni aux fichiers
  // spéciaux servis par le runtime : pas d'en-têtes ajoutés sur les
  // bundles pour économiser la bande passante (ils sont déjà sous CDN).
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg"
  ) {
    return NextResponse.next();
  }

  // Réponse « pass-through » : on ne modifie pas le contenu, on ajoute
  // juste les en-têtes. `headers` est mutable sur NextResponse.next().
  const response = NextResponse.next();
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", buildPermissionPolicy());
  // Marque la requête pour permettre un audit ultérieur (et pour ne pas
  // appliquer deux fois les en-têtes côté route handlers).
  response.headers.set("X-Security-Middleware", "nukhba");
  return response;
}

/**
 * Cible tous les chemins sauf les bundles internes et les fichiers
 * statiques servis directement par le CDN (les en-têtes y sont
 * normalement ajoutés par Vercel au niveau edge ; pas grave si on les
 // ajoute aussi ici, c'est idempotent).
 */
export const config = {
  matcher: [
    /*
     * Match tous les chemins sauf ceux qui commencent par :
     * - api (les routes API ajoutent leurs propres en-têtes si besoin)
     * - _next/static (assets statiques)
     * - _next/image (optimisation d'images)
     * - favicon.ico, robots.txt, sitemap.xml, fichiers avec extension
     *   servie par le CDN (le middleware s'exécute quand même, mais
     *   l'ajout d'en-têtes est inoffensif)
     */
    "/((?!_next/static|_next/image).*)",
  ],
};