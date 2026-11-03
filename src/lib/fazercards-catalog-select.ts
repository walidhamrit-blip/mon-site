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
 *     b) le plafond de catégories prenait les N premières marques
 *        prioritaires DANS L'ORDRE : si PlayStation + Steam + Xbox + Roblox
 *        cumulaient seules plus de `cap` variantes régionales (une par
 *        pays), « google play » (5ᵉ marque) n'avait plus aucun slot.
 *     → matching normalisé + MIN_SLOTS_PER_BRAND garantis par marque.
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
 * Nombre minimal de catégories DÉTAILLÉES par marque prioritaire, avant
 * qu'une marque ne reçoive des slots supplémentaires.
 *
 * Sans ce minimum, un plafond atteint par les premières marques (une variante
 * régionale par pays suffit) privait les suivantes — Google Play comprise —
 * de toute synchronisation.
 */
export const MIN_SLOTS_PER_BRAND = 3;

/**
 * Choisit les catégories à détailler :
 *   1. un minimum garanti de `MIN_SLOTS_PER_BRAND` catégories PAR MARQUE
 *      prioritaire, dans l'ordre des marques ;
 *   2. les slots restants répartis en round-robin entre les prioritaires ;
 *   3. une FENÊTRE GLISSANTE sur le reste (rotation), pour couvrir
 *      progressivement tout le catalogue sans dépasser le budget d'appels.
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
  // Regroupe les prioritaires par marque (l'ordre de la liste est conservé) ;
  // le reste garde son ordre pour la fenêtre glissante.
  const byBrand = new Map<number, T[]>();
  const rest: T[] = [];
  for (const item of items) {
    const priority = brandPriority(nameOf(item));
    if (priority < PRIORITY_BRANDS.length) {
      const list = byBrand.get(priority) ?? [];
      list.push(item);
      byBrand.set(priority, list);
    } else {
      rest.push(item);
    }
  }
  const brands = Array.from(byBrand.keys()).sort((a, b) => a - b);

  const selected: T[] = [];

  // 1. Minimum garanti par marque prioritaire, dans l'ordre des marques.
  for (const brand of brands) {
    if (selected.length >= cap) break;
    const list = byBrand.get(brand) ?? [];
    selected.push(...list.slice(0, Math.min(MIN_SLOTS_PER_BRAND, cap - selected.length)));
  }

  // 2. Slots restants : round-robin entre les marques prioritaires, pour
  //    qu'aucune marque ne monopole le plafond avec ses variantes régionales.
  if (selected.length < cap) {
    const leftovers = new Map<number, T[]>();
    for (const brand of brands) {
      const list = byBrand.get(brand) ?? [];
      leftovers.set(brand, list.slice(Math.min(MIN_SLOTS_PER_BRAND, list.length)));
    }
    let progressed = true;
    while (selected.length < cap && progressed) {
      progressed = false;
      for (const brand of brands) {
        if (selected.length >= cap) break;
        const queue = leftovers.get(brand) ?? [];
        const next = queue.shift();
        if (next !== undefined) {
          selected.push(next);
          progressed = true;
        }
      }
    }
  }

  // 3. Fenêtre glissante sur le reste (rotation reprise au passage suivant).
  const remaining = cap - selected.length;
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
