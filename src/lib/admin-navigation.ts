/** Public destinations shared by the admin shortcuts and dashboard. */
export const ADMIN_PUBLIC_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/codes", label: "Boutique" },
  { href: "/creation-sites", label: "Création de sites" },
  { href: "/contact", label: "Contact" },
] as const;

/** Only the most specific destination is active (catalogue != commandes). */
export function activeAdminHref(pathname: string, destinations: readonly string[]): string | undefined {
  return destinations
    .filter((href) => pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];
}
