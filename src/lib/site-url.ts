import { siteConfig } from "@/lib/config";

/**
 * URL publique de base du site, côté serveur.
 *
 * Sert à construire les URLs de retour NOWPayments (succès, annulation,
 * IPN) — elles doivent pointer vers l'environnement réellement utilisé.
 *
 * Priorité :
 * 1. `SITE_URL` (variable privée) — URL publique canonique (production) ;
 * 2. `NEXT_PUBLIC_SITE_URL` ;
 * 3. l'origine de la requête courante (en-têtes proxy `x-forwarded-*`
 *    puis `Host`) — indispensable en aperçu / en local pour revenir sur
 *    la même instance après le paiement, au lieu d'être redirigé vers
 *    le domaine de production ;
 * 4. l'URL codée dans `src/lib/config.ts` (dernier recours).
 */
export function siteBaseUrl(req?: Request): string {
  const explicit =
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  if (req) {
    const origin = requestOrigin(req);
    if (origin) return origin;
  }

  return siteConfig.url.replace(/\/+$/, "");
}

/** Origine (schéma + hôte) déduite de la requête — null si indéterminable. */
function requestOrigin(req: Request): string | null {
  // 1) Origin explicite (envoyé par les fetch navigateur).
  const origin = req.headers.get("origin")?.trim();
  if (origin && /^https?:\/\//i.test(origin)) return origin.replace(/\/+$/, "");

  // 2) En-têtes de proxy (Vercel, aperçu e2b, nginx…) puis Host direct.
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.trim();
  if (!host || !/^[a-z0-9.:[\]()-]+$/i.test(host)) return null;

  const forwardedProto = req.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const proto =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : host.startsWith("localhost") || host.startsWith("127.") || host.startsWith("[::1]")
        ? "http"
        : "https";

  return `${proto}://${host}`.replace(/\/+$/, "");
}
