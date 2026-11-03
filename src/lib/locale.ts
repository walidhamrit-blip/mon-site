/**
 * Langues du site — module partagé serveur + client.
 *
 * L'arabe reste la langue par défaut et est servi en RTL dès le HTML initial.
 * Chaque page publique possède aussi une URL anglaise stable (`?lang=en`).
 * La langue fait donc partie de l'URL, pas seulement de l'état du navigateur :
 * elle est partageable, indexable et rendue côté serveur.
 *
 * Ce fichier ne contient aucun composant React : il est importable depuis le
 * layout serveur, le proxy et le provider client (`src/lib/i18n.tsx`).
 */

export type Locale = "ar" | "en";

/** Valeur Next.js de `searchParams` (un paramètre peut être répété). */
export type RouteSearchParams = Record<string, string | string[] | undefined>;
export type LocalePageProps = { searchParams: Promise<RouteSearchParams> };

export const LOCALES: ReadonlyArray<{ id: Locale; label: string; short: string }> = [
  { id: "ar", label: "العربية", short: "ع" },
  { id: "en", label: "English", short: "EN" },
];

export const LOCALE_QUERY_PARAM = "lang";
/** En-tête INTERNE, posé par le proxy après nettoyage de la requête entrante. */
export const LOCALE_HEADER = "x-nukhba-locale";
/** Valeur interne indiquant une page publique sans langue explicite. */
export const LOCALE_DEFAULT_SIGNAL = "default";

/**
 * Clé du choix explicite du visiteur. Elle ne pilote plus le contenu d'une URL
 * localisée : l'URL gagne toujours. Elle est conservée pour les préférences
 * d'affichage et la compatibilité avec les appareils déjà passés par le site.
 */
export const LOCALE_STORAGE_KEY = "nukhba-locale-choice";

export function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "en";
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Seules les valeurs exacttes `ar` / `en` sont acceptées (pas de variantes). */
export function localeFromQuery(value: unknown): Locale | null {
  return isLocale(value) ? value : null;
}

export function localeFromSearchParams(
  params: RouteSearchParams | null | undefined,
  fallback: Locale = "ar",
): Locale {
  return localeFromQuery(params?.[LOCALE_QUERY_PARAM]) ?? fallback;
}

/** Les pages privées, API et ressources statiques ne portent pas de langue SEO. */
export function isLocalizablePath(pathname: string): boolean {
  return (
    pathname.startsWith("/") &&
    !pathname.startsWith("//") &&
    !/^\/(?:admin|api|live-demos|_next)(?:\/|$)/.test(pathname) &&
    !/\.[a-z0-9]+$/i.test(pathname)
  );
}

/**
 * URL relative d'une page dans la langue demandée.
 * - langue par défaut = chemin historique propre (aucune query de langue) ;
 * - autre langue = même chemin + `lang=ar` ou `lang=en`, avant l'ancre ;
 * - les autres paramètres (facettes, suivi, UTM…) et les ancres sont conservés.
 */
export function localizedPath(path: string, locale: Locale, defaultLocale: Locale = "ar"): string {
  if (!path.startsWith("/") || path.startsWith("//") || !isLocalizablePath(path.split(/[?#]/)[0])) {
    return path;
  }
  const hashAt = path.indexOf("#");
  const hash = hashAt >= 0 ? path.slice(hashAt) : "";
  const beforeHash = hashAt >= 0 ? path.slice(0, hashAt) : path;
  const queryAt = beforeHash.indexOf("?");
  const pathname = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const params = new URLSearchParams(queryAt >= 0 ? beforeHash.slice(queryAt + 1) : "");
  params.delete(LOCALE_QUERY_PARAM);
  if (locale !== defaultLocale) params.set(LOCALE_QUERY_PARAM, locale);
  const query = params.toString();
  return `${pathname || "/"}${query ? `?${query}` : ""}${hash}`;
}

/** Variante absolue pour canonical, hreflang, Open Graph et JSON-LD. */
export function localizedAbsoluteUrl(baseUrl: string, path: string, locale: Locale, defaultLocale: Locale = "ar"): string {
  const base = baseUrl.replace(/\/+$/, "");
  const localized = localizedPath(path, locale, defaultLocale);
  return `${base}${localized === "/" ? "/" : localized.replace(/\/+$/, "")}`;
}

/**
 * Cluster hreflang réciproque et auto-référent. `x-default` renvoie à la
 * langue par défaut (chemin propre). Les deux versions existent réellement
 * et sont rendues côté serveur ; aucune ne pointe vers une redirection.
 */
export function languageAlternates(baseUrl: string, path: string, defaultLocale: Locale = "ar") {
  return {
    ar: localizedAbsoluteUrl(baseUrl, path, "ar", defaultLocale),
    en: localizedAbsoluteUrl(baseUrl, path, "en", defaultLocale),
    "x-default": localizedAbsoluteUrl(baseUrl, path, defaultLocale, defaultLocale),
  };
}

/** Mémorise un choix explicite sans jamais l'appliquer à la place de l'URL. */
export function rememberLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* Navigation privée / stockage indisponible : l'URL reste suffisante. */
  }
}

/**
 * Script de démarrage conservé pour compatibilité. Une URL localisée ne doit
 * JAMAIS être réécrite depuis localStorage avant/après hydratation.
 */
export function localeBootScript(defaultLocale: Locale, urlLocale?: Locale | null): string {
  return `(function(){try{
var d=document.documentElement;
localStorage.removeItem("nukhba-locale");
var forced=${JSON.stringify(urlLocale && isLocale(urlLocale) ? urlLocale : null)};
var l=forced;
if(!l){l=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});}
var def=${JSON.stringify(isLocale(defaultLocale) ? defaultLocale : "ar")};
if(l!=="ar"&&l!=="en")l=def;
d.lang=l;d.dir=l==="ar"?"rtl":"ltr";
if(l==="ar"){d.classList.add("rtl")}else{d.classList.remove("rtl")}
}catch(e){}})();`;
}
