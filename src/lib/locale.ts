/**
 * Langues du site — module partagé serveur + client.
 *
 * L'arabe est la **langue principale** du site (réglage `/admin → Réglages`),
 * l'anglais reste disponible en un clic. Il n'y a pas d'URL `/ar` ni `/en` :
 * le HTML est rendu dans la langue principale, puis le choix explicite du
 * visiteur (mémorisé sur son appareil) est appliqué côté client.
 *
 * Ce fichier ne contient volontairement aucun composant React : il est
 * importable depuis le layout serveur (script inline de démarrage) comme
 * depuis le provider client (`src/lib/i18n.tsx`).
 */

export type Locale = "ar" | "en";

export const LOCALES: ReadonlyArray<{ id: Locale; label: string; short: string }> = [
  { id: "ar", label: "العربية", short: "ع" },
  { id: "en", label: "English", short: "EN" },
];

/**
 * Clé de mémorisation du **choix explicite** du visiteur (bouton de langue).
 * Les anciennes clés (`nukhba-locale`) étaient écrites à chaque visite, y
 * compris pour la simple langue par défaut de l'admin : elles ne prouvent pas
 * un choix et ne sont donc plus lues (elles sont nettoyées au démarrage).
 */
export const LOCALE_STORAGE_KEY = "nukhba-locale-choice";

export function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "en";
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * Script inline exécuté avant le premier rendu : applique la langue choisie
 * par le visiteur (ou la langue principale du site) sur `<html lang/dir>`,
 * afin qu'aucune page ne s'affiche un instant dans le mauvais sens de lecture.
 * Le HTML serveur est déjà rendu en arabe (RTL) par défaut : ce script ne
 * change donc rien pour la majorité des visiteurs.
 */
export function localeBootScript(defaultLocale: Locale): string {
  return `(function(){try{
var d=document.documentElement;
localStorage.removeItem("nukhba-locale");
var l=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});
var def=${JSON.stringify(isLocale(defaultLocale) ? defaultLocale : "ar")};
if(l!=="ar"&&l!=="en")l=def;
d.lang=l;
d.dir=l==="ar"?"rtl":"ltr";
if(l==="ar"){d.classList.add("rtl")}else{d.classList.remove("rtl")}
}catch(e){}})();`;
}
