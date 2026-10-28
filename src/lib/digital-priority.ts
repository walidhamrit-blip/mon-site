/**
 * Priorisation marchande de la vitrine `/codes`.
 *
 * Le fournisseur renvoie son catalogue dans un ordre qui n'a rien de
 * commercial (les clés de jeux arrivent avant les cartes PlayStation, les
 * petites recharges avant PUBG). Or la vitrine s'adresse à des acheteurs qui
 * paient en USDT depuis la Libye et le Golfe : ce sont les recharges des jeux
 * qui tournent réellement dans la région et les cartes des grandes boutiques
 * qui se vendent, dans des zones où la carte bancaire internationale est
 * rare et où l'on achète justement parce qu'on paie en crypto.
 *
 * Deux axes, donc :
 *
 *  1. **la demande** — un poids par famille de produit (PUBG, Free Fire,
 *     PlayStation, Steam…), volontairement éditorial et facile à ajuster ;
 *  2. **la zone** — `CRYPTO_REGIONS` classe les zones de la plus utile à la
 *     moins utile pour un acheteur qui paie en USDT : le global d'abord
 *     (valable partout), puis le Golfe et le Maghreb, puis les grands marchés
 *     occidentaux, puis le reste.
 *
 * Module PUR (aucun import Node/Next) : il est utilisé par la page, par le
 * composant client et par les tests `node --test`. Le classement doit être
 * identique côté serveur et côté navigateur, sinon React signale une erreur
 * d'hydratation.
 */

/** Ce dont la priorisation a besoin, structurellement (aucun import). */
export interface Demandable {
  slug?: string | null;
  kind?: string | null;
  platform?: string | null;
  titleEn?: string | null;
  titleAr?: string | null;
  regions?: string[] | null;
  denominations?: { region?: string | null }[] | null;
}

/**
 * Zones classées pour un acheteur qui paie en USDT.
 *
 * - `GLOBAL` : utilisable partout, sans contrainte de compte — le choix sûr ;
 * - `MENA`, `SA`, `AE`, `KW`, `QA`, `OM`, `BH`, `LB` : le Golfe et le Levant,
 *   où la carte bancaire internationale est peu accessible et où la crypto
 *   est le moyen de paiement courant ;
 * - `EG`, `TR` : gros marchés gaming de la région, très demandés ;
 * - `US`, `UK`, `EU`, `CA` : les zones « valeur sûre » les plus demandées
 *   quand le client a un compte occidental ;
 * - le reste du catalogue n'apporte aucun bonus.
 */
export const CRYPTO_REGIONS = [
  "GLOBAL",
  "MENA",
  "SA",
  "AE",
  "KW",
  "QA",
  "OM",
  "BH",
  "LB",
  "EG",
  "TR",
  "LY",
  "US",
  "UK",
  "EU",
  "CA",
] as const;

/** Poids de demande par mot-clé (le mot-clé le plus long gagne). */
const DEMAND_KEYWORDS: { key: string; score: number }[] = [
  /* --- Recharges de jeux : le volume de la région MENA --- */
  { key: "pubg mobile", score: 100 },
  { key: "free fire", score: 96 },
  { key: "mobile legends", score: 92 },
  { key: "valorant", score: 78 },
  { key: "genshin impact", score: 74 },
  { key: "call of duty mobile", score: 68 },
  { key: "8 ball pool", score: 62 },
  { key: "clash of clans", score: 56 },
  { key: "clash royale", score: 50 },
  { key: "asphalt 9", score: 46 },
  { key: "delta force", score: 44 },
  { key: "arena breakout", score: 40 },
  { key: "apex legends mobile", score: 36 },
  { key: "destiny rising", score: 32 },
  { key: "blood strike", score: 30 },
  { key: "azur lane", score: 28 },
  { key: "bigo live", score: 26 },
  { key: "chamet", score: 20 },

  /* --- Cartes cadeaux des grandes boutiques --- */
  { key: "playstation", score: 100 },
  { key: "steam wallet", score: 98 },
  { key: "google play", score: 90 },
  { key: "xbox", score: 86 },
  { key: "amazon", score: 82 },
  { key: "roblox", score: 78 },
  { key: "itunes", score: 72 },
  { key: "apple", score: 70 },
  { key: "netflix", score: 62 },
  { key: "spotify", score: 56 },
  { key: "airbnb", score: 46 },
  { key: "nvidia", score: 40 },
  { key: "airalo", score: 32 },
  { key: "a cash", score: 30 },

  /* --- Clés de jeux PC les plus demandées --- */
  { key: "ea sports fc", score: 90 },
  { key: "fifa", score: 88 },
  { key: "grand theft auto", score: 84 },
  { key: "call of duty", score: 80 },
  { key: "minecraft", score: 76 },
  { key: "red dead redemption", score: 68 },
  { key: "cyberpunk 2077", score: 62 },
  { key: "elden ring", score: 60 },
  { key: "baldurs gate", score: 56 },
  { key: "hogwarts legacy", score: 52 },
  { key: "the witcher", score: 50 },
  { key: "god of war", score: 48 },
  { key: "forza horizon", score: 46 },
  { key: "rust", score: 40 },
];

/** Petit bonus de famille : les recharges et cartes font le chiffre. */
const KIND_BONUS: Record<string, number> = {
  game_topup: 10,
  gift_card: 8,
  software_key: 5,
  subscription_code: 4,
};

/** Bonus maximal d'une zone (la première zone de `CRYPTO_REGIONS`). */
const REGION_TOP_BONUS = 40;
/** Perte de bonus par rang de zone. */
const REGION_STEP = 2;

/** Normalise pour comparer : minuscules, sans accent, ponctuation → espace. */
export function normalizeDemandKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Rang d'une zone (0 = la plus adaptée), `-1` si elle n'est pas prioritaire. */
export function cryptoRegionRank(region: string | null | undefined): number {
  const value = (region ?? "").trim().toUpperCase();
  if (!value) return -1;
  const index = (CRYPTO_REGIONS as readonly string[]).indexOf(value);
  return index;
}

/** Vrai si la zone fait partie des zones servies en priorité (paiement USDT). */
export function isCryptoRegion(region: string | null | undefined): boolean {
  return cryptoRegionRank(region) >= 0;
}

/**
 * Meilleure zone d'une fiche : la mieux classée entre ses zones d'en-tête et
 * celles de ses montants. Une fiche sans zone (ou hors liste) vaut `-1`.
 */
export function bestCryptoRegionRank(product: Demandable): number {
  const zones = [
    ...(product.regions ?? []),
    ...((product.denominations ?? []).map((item) => item?.region) ?? []),
  ];
  let best = -1;
  for (const zone of zones) {
    const rank = cryptoRegionRank(zone);
    if (rank < 0) continue;
    if (best < 0 || rank < best) best = rank;
    // Rang 0 : inutile de continuer, c'est le maximum possible.
    if (best === 0) break;
  }
  return best;
}

/** Poids de demande d'un texte (plateforme + titre + slug). */
export function demandWeightFor(text: string): number {
  const haystack = normalizeDemandKey(text);
  if (!haystack) return 0;
  const padded = ` ${haystack} `;
  let best = 0;
  for (const { key, score } of DEMAND_KEYWORDS) {
    if (padded.includes(` ${key} `) && score > best) best = score;
  }
  return best;
}

/**
 * Score de demande d'une fiche (0 → ~150).
 *
 * Volontairement lisible : un poids de famille + un bonus de zone. Il n'est
 * pas question de « meilleures ventes » au sens statistique (les commandes
 * sont encore peu nombreuses) mais d'un ordre commercial assumé, réglable
 * ici en une ligne.
 */
export function digitalDemandScore(product: Demandable): number {
  const text = [product.platform, product.titleEn, product.titleAr, product.slug]
    .filter(Boolean)
    .join(" ")
    // Un slug sépare ses mots par des tirets : on les rend à la recherche.
    .replace(/-/g, " ");
  const weight = demandWeightFor(text);
  const kindBonus = KIND_BONUS[(product.kind ?? "").trim()] ?? 0;
  const rank = bestCryptoRegionRank(product);
  const regionBonus =
    rank < 0 ? 0 : Math.max(0, REGION_TOP_BONUS - rank * REGION_STEP);
  return weight + kindBonus + regionBonus;
}

/**
 * Marque d'une fiche : sa plateforme SANS la zone entre parenthèses.
 *
 * « PlayStation (SA) » et « PlayStation (AE) » sont le même produit dans deux
 * pays : ils forment un seul groupe, ce qui évite qu'une marque déclinée en
 * 41 pays occupe les 41 premières places de la vitrine.
 */
export function brandKeyFor(product: Demandable): string {
  const withoutZone = (product.platform ?? "").replace(/\([^)]*\)/g, " ");
  const fromPlatform = normalizeDemandKey(withoutZone);
  if (fromPlatform) return fromPlatform;
  // Repli : le titre, sans le préfixe de famille (« Game Key — … »).
  const withoutKind = (product.titleEn ?? product.titleAr ?? "").replace(/^[^—:]*[—:]\s*/u, "");
  return normalizeDemandKey(withoutKind) || normalizeDemandKey(product.slug ?? "");
}

/** Comparateur total : score, puis titre, puis slug (jamais d'égalité). */
function compareByDemand(a: Demandable, b: Demandable): number {
  const delta = digitalDemandScore(b) - digitalDemandScore(a);
  if (delta !== 0) return delta;
  const titleA = (a.titleEn ?? a.titleAr ?? a.slug ?? "").toLowerCase();
  const titleB = (b.titleEn ?? b.titleAr ?? b.slug ?? "").toLowerCase();
  if (titleA !== titleB) return titleA < titleB ? -1 : 1;
  // Comparaison ASCII volontaire : `localeCompare` dépend de l'ICU du runtime
  // (serveur Node vs navigateur) et ferait diverger l'ordre → hydratation KO.
  const slugA = a.slug ?? "";
  const slugB = b.slug ?? "";
  if (slugA === slugB) return 0;
  return slugA < slugB ? -1 : 1;
}

/**
 * Copie triée de `products`, de la fiche la plus demandée à la moins
 * demandée — **en alternant les marques**.
 *
 * Un tri strict par score plaçait « PlayStation (SA) », « PlayStation (AE) »,
 * « PlayStation (KW) »… sur les huit premières cartes : juste arithmétiquement,
 * illisible en vitrine. On regroupe donc par marque, on classe les marques
 * entre elles, puis on prend une fiche par marque à chaque tour. La première
 * ligne de la grille montre ainsi quatre produits différents, et la zone la
 * mieux adaptée à la crypto reste devant à l'intérieur de chaque marque.
 *
 * Tri TOTAL (score, puis titre, puis slug) : deux appels donnent exactement le
 * même ordre côté serveur et côté navigateur.
 */
export function sortByDemand<T extends Demandable>(products: readonly T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const product of products) {
    const key = brandKeyFor(product);
    const bucket = groups.get(key);
    if (bucket) bucket.push(product);
    else groups.set(key, [product]);
  }

  const ordered = [...groups.values()]
    .map((rows) => [...rows].sort(compareByDemand))
    .sort((a, b) => compareByDemand(a[0], b[0]));

  // Tourniquet : un élément par marque à chaque passage.
  const result: T[] = [];
  const longest = ordered.reduce((max, rows) => Math.max(max, rows.length), 0);
  for (let round = 0; round < longest; round += 1) {
    for (const rows of ordered) {
      const item = rows[round];
      if (item) result.push(item);
    }
  }
  return result;
}

/**
 * Slugs des `count` fiches les plus demandées — sert à poser l'étiquette
 * « demandée » sur les premières cartes sans recalculer le classement.
 */
export function topDemandSlugs(products: readonly Demandable[], count = 8): string[] {
  return sortByDemand(products)
    .slice(0, Math.max(0, count))
    .map((product) => product.slug ?? "")
    .filter(Boolean);
}

/**
 * Zones triées pour le rail : les zones adaptées à la crypto d'abord (dans
 * l'ordre de `CRYPTO_REGIONS`), puis les autres, à volume décroissant.
 */
export function sortRegionsForRail<T extends { value: string; count: number }>(
  regions: readonly T[],
): T[] {
  return [...regions].sort((a, b) => {
    const rankA = cryptoRegionRank(a.value);
    const rankB = cryptoRegionRank(b.value);
    if (rankA >= 0 && rankB >= 0 && rankA !== rankB) return rankA - rankB;
    if (rankA >= 0 && rankB < 0) return -1;
    if (rankA < 0 && rankB >= 0) return 1;
    if (b.count !== a.count) return b.count - a.count;
    if (a.value === b.value) return 0;
    return a.value < b.value ? -1 : 1;
  });
}
