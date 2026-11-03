import { headers } from "next/headers";
import {
  LOCALE_DEFAULT_SIGNAL,
  LOCALE_HEADER,
  localeFromQuery,
  localeFromSearchParams,
  type Locale,
  type LocalePageProps,
} from "@/lib/locale";
import { siteLocale } from "@/lib/seo";

/**
 * Langue effective d'une page publique, lue dans `?lang=…`.
 * Sans paramètre valide, on conserve la langue de référence du site (arabe
 * par défaut, réglable dans /admin). Une URL anglaise force toujours `en`.
 */
export async function pageLocale(
  config: Parameters<typeof siteLocale>[0],
  searchParams: LocalePageProps["searchParams"],
): Promise<Locale> {
  return localeFromSearchParams(await searchParams, siteLocale(config));
}

/**
 * Le layout racine ne reçoit pas `searchParams`. Le proxy lui transmet la
 * langue déjà validée depuis l'URL via un en-tête interne nettoyé de toute
 * valeur envoyée par le client. Cela aligne `<html lang/dir>`, le provider
 * client et les métadonnées dès le premier HTML, sans composant client.
 */
export async function requestLocale(defaultLocale: Locale): Promise<{
  locale: Locale;
  urlLocale: Locale | null;
  isPublic: boolean;
}> {
  const signal = (await headers()).get(LOCALE_HEADER);
  const urlLocale = localeFromQuery(signal);
  const isPublic = signal === LOCALE_DEFAULT_SIGNAL || urlLocale !== null;
  return { locale: urlLocale ?? defaultLocale, urlLocale, isPublic };
}
