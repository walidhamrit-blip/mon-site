/**
 * Politique réseaux de paiement.
 *
 * ⚠️ Le choix de la pièce se fait sur la page hébergée de NOWPayments (notre
 * facture ne fixe pas `pay_currency`). La liste RÉELLEMENT proposée est donc
 * réglée dans le dashboard NOWPayments → Coin settings. Ce module ne
 * remplace pas ce réglage : il le documente, l'affiche au client et permet
 * de DÉTECTER un paiement arrivé sur une chaîne coûteuse.
 *
 * Pourquoi une liste blanche : les frais de réseau sont FIXES. Sur un article
 * à 1,20 $, un transfert ERC-20 ou Bitcoin peut manger toute la marge (voire
 * la dépasser), alors que BEP-20, Solana, TON ou Aptos coûtent quelques
 * centimes.
 */

export interface PaymentNetwork {
  /** Identifiant interne, stable. */
  id: string;
  /** Libellé public (nom de la chaîne). */
  label: string;
  /** Fragments reconnus dans le ticker NOWPayments (`pay_currency`). */
  matches: readonly string[];
}

/**
 * Chaînes à frais minimes : ce sont les SEULES à laisser activées.
 * Ordre = ordre d'affichage (les plus fiables d'abord).
 */
export const LOW_COST_NETWORKS: readonly PaymentNetwork[] = [
  { id: "bep20", label: "BNB Smart Chain (BEP-20)", matches: ["bsc", "bep20"] },
  { id: "solana", label: "Solana", matches: ["sol"] },
  { id: "ton", label: "TON", matches: ["ton"] },
  { id: "polygon", label: "Polygon", matches: ["matic", "polygon", "pol"] },
  { id: "arbitrum", label: "Arbitrum", matches: ["arb"] },
  { id: "avalanche", label: "Avalanche (C-Chain)", matches: ["avax"] },
  { id: "aptos", label: "Aptos", matches: ["apt"] },
];

/**
 * Chaînes à écarter : le frais fixe dépasse la marge des petits articles.
 * À désactiver dans les Coin settings de NOWPayments.
 */
export const HIGH_COST_NETWORKS: readonly PaymentNetwork[] = [
  { id: "erc20", label: "Ethereum (ERC-20)", matches: ["erc20", "ethereum"] },
  { id: "trc20", label: "Tron (TRC-20)", matches: ["trc20", "tron", "trx"] },
  { id: "bitcoin", label: "Bitcoin", matches: ["btc", "bitcoin"] },
  { id: "ethereum", label: "Ethereum (natif)", matches: ["eth"] },
];

function normalized(ticker: string | null | undefined): string {
  return (ticker ?? "").trim().toLowerCase();
}

function findNetwork(
  networks: readonly PaymentNetwork[],
  ticker: string | null | undefined,
): PaymentNetwork | null {
  const value = normalized(ticker);
  if (!value) return null;
  // `usdttrc20`, `usdtbsc`, `usdtsol`… : le réseau est dans le suffixe.
  return (
    networks.find((network) =>
      network.matches.some((fragment) => value.includes(fragment)),
    ) ?? null
  );
}

/**
 * Vrai si le moyen de paiement utilisé est sur une chaîne coûteuse.
 *
 * Les chaînes coûteuses sont testées EN PREMIER : `usdterc20` contient
 * « eth » ? Non — mais l'ordre évite qu'un fragment court ne capture un
 * ticker qui appartient à une autre famille.
 */
export function isHighCostNetwork(ticker: string | null | undefined): boolean {
  return findNetwork(HIGH_COST_NETWORKS, ticker) !== null;
}

/** Vrai si le moyen de paiement est sur une chaîne de la liste blanche. */
export function isLowCostNetwork(ticker: string | null | undefined): boolean {
  if (isHighCostNetwork(ticker)) return false;
  return findNetwork(LOW_COST_NETWORKS, ticker) !== null;
}

/** Libellé lisible d'un ticker de paiement (repli : le ticker en majuscules). */
export function paymentNetworkLabel(ticker: string | null | undefined): string {
  const network =
    findNetwork(HIGH_COST_NETWORKS, ticker) ?? findNetwork(LOW_COST_NETWORKS, ticker);
  if (network) return network.label;
  const value = normalized(ticker);
  return value ? value.toUpperCase() : "—";
}

/** Liste des réseaux recommandés, prête à afficher au client. */
export function recommendedNetworksLabel(): string {
  return LOW_COST_NETWORKS.map((network) => network.label).join(" · ");
}
