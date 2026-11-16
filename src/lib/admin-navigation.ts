/** Public destinations shared by the admin shortcuts and dashboard. */
export const ADMIN_PUBLIC_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/codes", label: "Boutique" },
  { href: "/creation-sites", label: "Création de sites" },
  { href: "/contact", label: "Contact" },
] as const;

/** Only the most specific destination is active (catalogue != commandes). */
export function activeAdminHref(pathname: string, destinations: readonly string[]): string | undefined {
  const clean = (href: string) => href.split("?")[0].split("#")[0];
  const hasQuery = (href: string) => href !== clean(href);
  return destinations
    .filter((href) => {
      const path = clean(href);
      return pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`));
    })
    // À longueur de chemin égale, préfère l’entrée simple (ex. /admin/settings)
    // à une entrée avec query (ex. /admin/settings?tab=…).
    .sort((a, b) => clean(b).length - clean(a).length || Number(hasQuery(a)) - Number(hasQuery(b)))[0];
}
