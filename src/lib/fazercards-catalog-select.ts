/**
 * Sélection des catégories FazerCards à détailler à chaque synchronisation.
 *
 * Module PUR (aucun import, aucune I/O) pour pouvoir être testé directement
 * par `node --test` (Node ≥ 22.18 lit le TypeScript à syntaxe effaçable).
 *
 * Deux pannes constatées en production et corrigées ici :
 *
 *  1. 28/10/2026 — la synchro ne détaillait que les N premières catégories
 *     (ordre alphabétique de l'API) : les cartes s'arrêtaient à « Apex
 *     Legends Mobile », ni PlayStation ni Steam ni Google Play n'existaient
 *     dans la boutique. → pagination complète + marques prioritaires.
 *
 *  2. 03/11/2026 — « google play » existait bien chez le fournisseur (stock
 *     OK, prix OK) mais n'apparaissait jamais sur /codes. Deux causes :
 *     a) `brandPriority` exigeait la sous-chaîne exacte « google play » avec
 *        l'espace : une catégorie nommée « GooglePlay » ou « Google-Play »
 *        n'était PAS reconnue prioritaire et n'était atteinte que par la
 *        fenêtre glissante (qui peut ne jamais l'atteindre) ;
 *     b) le plafond s'appliquait d'abord aux marques prioritaires : non
 *        seulement les marques tardives (Google Play 5ᵉ) pouvaient manquer
 *        de slots, mais même AU SEIN d'une marque prioritaire, seules les
 *        premières variantes étaient retenues — « Google Play (US) », classée
 *        en dernier par l'ordre alphabétique de l'API, n'était JAMAIS
 *        synchronisée (constaté le 03/11/2026).
 *     → matching normalisé + TOUTES les catégories prioritaires sont
 *       sélectionnées à chaque synchro ; le plafond ne borne plus que la
 *       fenêtre glissante sur le reste du catalogue.
 */

/**
 * Marques mises en tête de synchro, dans cet ordre.
 *
 * Ce sont celles que les clients cherchent : elles doivent TOUJOURS être
 * synchronisées, quel que soit le plafond de catégories.
 */
export const PRIORITY_BRANDS = [
  "playstation",
  "steam",
  "xbox",
  "roblox",
  "google play",
  "itunes",
  "apple",
  "nintendo",
  "amazon",
  "netflix",
  "spotify",
  "epic games",
  "fortnite",
  "free fire",
  "pubg",
  "mobile legends",
  "razer gold",
  "battlenet",
  "blizzard",
  "riot",
  "valorant",
  "minecraft",
  "discord",
  "paysafecard",
  "binance",
  "uber",
] as const;

/**
 * Normalise un texte pour la comparaison de marques : casse, accents et
 * séparateurs supprimés. « Google Play (US) », « GooglePlay » et
 * « google-play » donnent tous « googleplayus » / « googleplay ».
 */
export function normalizeBrandText(value: string): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Rang de priorité d'une catégorie (0 = à synchroniser en premier). */
export function brandPriority(name: string): number {
  const haystack = normalizeBrandText(name);
  for (let index = 0; index < PRIORITY_BRANDS.length; index += 1) {
    const brand = normalizeBrandText(PRIORITY_BRANDS[index]);
    if (brand && haystack.includes(brand)) return index;
  }
  return PRIORITY_BRANDS.length;
}

/**
 * Choisit les catégories à détailler :
 *   1. TOUTES les catégories des marques prioritaires, triées par marque
 *      (l'ordre de la liste API est conservé dans chaque marque) — le
 *      plafond ne s'applique JAMAIS aux prioritaires, sinon les variantes
 *      régionales classées en dernier (« Google Play (US) » en ordre
 *      alphabétique) ne seraient jamais synchronisées ;
 *   2. puis une FENÊTRE GLISSANTE sur le reste, bornée par `cap`, pour
 *      couvrir progressivement tout le catalogue sans dépasser le budget
 *      d'appels.
 *
 * @param offset position de départ dans le reste (reprise au passage suivant)
 * @returns les catégories retenues et la position suivante
 */
export function selectCategories<T>(
  items: T[],
  nameOf: (item: T) => string,
  cap: number,
  offset: number,
): { selected: T[]; nextOffset: number } {
  const priority: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (brandPriority(nameOf(item)) < PRIORITY_BRANDS.length) priority.push(item);
    else rest.push(item);
  }
  // Tri stable par marque : chaque marque prioritaire est entièrement
  // retenue, dans l'ordre des marques prioritaires.
  priority.sort((a, b) => brandPriority(nameOf(a)) - brandPriority(nameOf(b)));

  const selected: T[] = [...priority];

  // Fenêtre glissante sur le reste, dans la limite restante du plafond.
  const remaining = Math.max(0, cap - selected.length);
  if (rest.length === 0 || remaining <= 0) {
    return { selected, nextOffset: 0 };
  }
  const start = Math.max(0, Math.floor(offset)) % rest.length;
  const taken: T[] = [];
  for (let index = 0; index < Math.min(remaining, rest.length); index += 1) {
    taken.push(rest[(start + index) % rest.length]);
  }
  return {
    selected: [...selected, ...taken],
    nextOffset: (start + taken.length) % rest.length,
  };
}
