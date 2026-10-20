import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware de sécurité : applique les en-têtes de sécurité à toutes
 * les réponses, y compris celles servies depuis `public/` (ex.
 * `/live-demos/tulin-magazin/index.html`, manifest, robots, sitemap…).
 *
 * - `X-Frame-Options: SAMEORIGIN` uniquement en production Vercel :
 *   protège contre le clickjacking externe tout en autorisant nos démos
 *   internes (`/live-demos/...`) embarquées dans `<iframe>`, et sans
 *   bloquer l'aperçu temps réel hors production (Vercel Preview / Arena).
 * - `Permissions-Policy` : conserve `autoplay=(self)` et `fullscreen=*`
 *   pour la visionneuse interactive plein écran.
 */
function buildPermissionPolicy(): string {
  return [
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
  ].join(", ");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg"
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (process.env.VERCEL_ENV === "production") {
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
  }
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", buildPermissionPolicy());
  response.headers.set("X-Security-Middleware", "nukhba");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image).*)",
  ],
};
