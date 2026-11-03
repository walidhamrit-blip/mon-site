import { NextRequest, NextResponse } from "next/server";
import {
  LOCALE_DEFAULT_SIGNAL,
  LOCALE_HEADER,
  LOCALE_QUERY_PARAM,
  isLocalizablePath,
  localeFromQuery,
} from "@/lib/locale";

/**
 * Proxy de sécurité (convention Next.js 16, ex-« middleware ») : applique
 * les en-têtes de sécurité à toutes
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg"
  ) {
    return NextResponse.next();
  }

  // La langue SEO vient de l'URL, jamais d'un en-tête fourni par le client.
  // On nettoie donc l'en-tête interne avant de le recalculer pour le layout.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(LOCALE_HEADER);
  const publicPage = isLocalizablePath(pathname);
  const rawLang = request.nextUrl.searchParams.getAll(LOCALE_QUERY_PARAM);
  const urlLocale = publicPage && rawLang.length === 1 ? localeFromQuery(rawLang[0]) : null;

  // Toutes les pages publiques reçoivent un signal interne : langue explicite
  // ou défaut. Cela permet au layout de distinguer le public de /admin et
  // d'épingler la langue par défaut sans laisser localStorage la remplacer.
  if (publicPage) requestHeaders.set(LOCALE_HEADER, urlLocale ?? LOCALE_DEFAULT_SIGNAL);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Le contenu varie avec la langue transmise en interne (et la query publique).
  response.headers.append("Vary", LOCALE_HEADER);
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
  // Toutes les routes internes de Next (`_next/static`, `_next/image` mais
  // aussi le flux HMR `_next/hmr`) sont exclues : les en-têtes de sécurité
  // sont déjà posés par `headers()` dans next.config.ts, et intercepter le
  // WebSocket du HMR en développement casse le runtime client (hydratation).
  matcher: [
    "/((?!_next/).*)",
  ],
};
