/**
 * Deux univers sous une marque mère (« endorsed brand ») :
 *
 * - `store`  : Nukhba Store — cartes cadeaux, clés de jeux, recharges.
 *              Public B2C, achat rapide, identité gaming (palette du visiteur).
 * - `studio` : Nukhba Studio — création de sites et d'applications.
 *              Public B2B, décision réfléchie, identité sobre (encre + or).
 * - `hub`    : la marque Nukhba elle-même (accueil, contact, pages légales,
 *              paiement). Identité sobre, oriente vers les deux univers.
 *
 * Les URL ne changent pas (aucun risque SEO) : l'univers est déduit du chemin.
 * C'est la seule source de vérité pour la navigation, le pied de page, le
 * style (`data-universe` sur `.public-shell`) et les données structurées.
 * Voir docs/architecture-deux-univers.md.
 */

export type Universe = "store" | "studio" | "hub";

/** Préfixes de chemin propres à chaque univers (les autres pages sont `hub`). */
export const universePrefixes: Record<Exclude<Universe, "hub">, readonly string[]> = {
  store: ["/codes"],
  studio: [
    "/creation-sites",
    "/demos",
    "/pricing",
    "/services",
    "/sectors",
    "/abonnements",
    "/audit",
    "/badge",
    "/livraison",
    "/apps",
    "/products",
    "/compare",
    "/blog",
  ],
};

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Déduit l'univers d'un chemin public (`/en/...` est traité comme sa version arabe). */
export function universeForPath(pathname: string | null | undefined): Universe {
  let path = (pathname ?? "/").split(/[?#]/)[0] || "/";
  if (path === "/en" || path.startsWith("/en/")) path = path.slice(3) || "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (universePrefixes.store.some((prefix) => matchesPrefix(path, prefix))) return "store";
  if (universePrefixes.studio.some((prefix) => matchesPrefix(path, prefix))) return "studio";
  return "hub";
}

export interface UniverseLink {
  href: string;
  ar: string;
  en: string;
}

export interface UniverseBrand {
  /** Nom de la sous-marque affiché à côté du logo. */
  nameAr: string;
  nameEn: string;
  /** Mention sous le nom (`{city}` est remplacé par la ville du marché). */
  taglineAr: string;
  taglineEn: string;
  /** Destination du logo : l'accueil de l'univers. */
  home: string;
}

export const universeBrands: Record<Universe, UniverseBrand> = {
  hub: {
    nameAr: "نخبة",
    nameEn: "Nukhba",
    taglineAr: "{city} · خدمات رقمية",
    taglineEn: "{city} · Digital services",
    home: "/",
  },
  store: {
    nameAr: "متجر نخبة",
    nameEn: "Nukhba Store",
    taglineAr: "بطاقات · مفاتيح ألعاب · شحن",
    taglineEn: "Cards · game keys · top-ups",
    home: "/codes",
  },
  studio: {
    nameAr: "استوديو نخبة",
    nameEn: "Nukhba Studio",
    taglineAr: "{city} · مواقع وتطبيقات",
    taglineEn: "{city} · Websites & apps",
    home: "/creation-sites",
  },
};

/** Menus propres aux deux univers (le `hub` garde `primaryNavigation`). */
export const universeNavigation: Record<Exclude<Universe, "hub">, readonly UniverseLink[]> = {
  store: [
    { href: "/codes", ar: "المتجر", en: "Store" },
    { href: "/codes/category/gift_card", ar: "بطاقات هدايا", en: "Gift cards" },
    { href: "/codes/category/software_key", ar: "مفاتيح ألعاب وبرامج", en: "Game & software keys" },
    { href: "/codes/category/game_topup", ar: "شحن الألعاب", en: "Top-ups" },
    { href: "/codes/category/subscription_code", ar: "اشتراكات", en: "Subscriptions" },
  ],
  studio: [
    { href: "/creation-sites", ar: "إنشاء المواقع", en: "Website creation" },
    { href: "/demos", ar: "النماذج", en: "Examples" },
    { href: "/pricing", ar: "الأسعار", en: "Pricing" },
    { href: "/services", ar: "الخدمات", en: "Services" },
    { href: "/contact", ar: "تواصل معنا", en: "Contact" },
  ],
};

/** Action principale de l'en-tête : une seule, adaptée à l'intention du visiteur. */
export const universePrimaryAction: Record<Universe, UniverseLink> = {
  hub: { href: "/creation-sites#lead-form", ar: "طلب عرض", en: "Get quote" },
  studio: { href: "/creation-sites#lead-form", ar: "طلب عرض", en: "Get quote" },
  store: { href: "/codes/commande", ar: "تتبع طلبي", en: "Track my order" },
};

/** Barre de marque : l'endossement « un service Nukhba », visible partout. */
export const universeSwitcher: readonly (UniverseLink & { universe: Universe })[] = [
  { universe: "hub", href: "/", ar: "نخبة", en: "Nukhba" },
  { universe: "store", href: "/codes", ar: "المتجر الرقمي", en: "Digital store" },
  { universe: "studio", href: "/creation-sites", ar: "إنشاء المواقع", en: "Websites & apps" },
];

/** Univers qui suivent la palette gaming choisie par le visiteur. */
export function universeUsesVisitorPalette(universe: Universe): boolean {
  return universe === "store";
}

/** Données structurées « agence » (ProfessionalService, catalogue d'offres) : hors boutique. */
export function universeShowsAgencySchema(universe: Universe): boolean {
  return universe !== "store";
}
