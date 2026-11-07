// Liens profonds vers une commande de code dans /admin/digital/orders.
//
// Pourquoi ce module : la zone « Cartes téléphoniques à vérifier » et le
// tableau des commandes sont deux composants distincts. Un gérant qui vient
// d'accepter une carte doit pouvoir ouvrir SA commande sans chercher dans la
// page — et il cliquait naturellement sur la ligne de la zone des cartes, qui
// n'est qu'un récapitulatif statique.
//
// Le lien passe par le fragment d'URL (`#commande-DGC-…`), complété par un
// événement DOM `nukhba:open-digital-order`. Le fragment rend le lien
// partageable et survit au rechargement ; l'événement couvre le cas où le
// fragment est déjà celui demandé (aucun `hashchange` n'est alors émis).
//
// Module pur : testé dans `scripts/admin-order-link.test.mjs`.

export const ORDER_ANCHOR_PREFIX = "commande-";

/** Événement écouté par le tableau des commandes (détail : { ref, offPlatform }). */
export const OPEN_ORDER_EVENT = "nukhba:open-digital-order";

export interface OrderLinkTarget {
  ref: string;
  /** Ouvrir directement le formulaire « livré hors système ». */
  offPlatform?: boolean;
}

/** Identifiant DOM d'une ligne de commande (sans `#`). */
export function orderAnchor(ref: string): string {
  return `${ORDER_ANCHOR_PREFIX}${String(ref ?? "").trim().toUpperCase()}`;
}

/**
 * Fragment d'URL vers une commande : `#commande-DGC-…` ou
 * `#commande-DGC-…?hors=1` pour ouvrir le formulaire hors système.
 */
export function orderHash(ref: string, options: { offPlatform?: boolean } = {}): string {
  const anchor = orderAnchor(ref);
  return options.offPlatform ? `#${anchor}?hors=1` : `#${anchor}`;
}

/**
 * Décode un fragment d'URL. `null` si ce n'est pas un lien de commande ou si
 * la référence n'a pas une forme plausible (protège des fragments arbitraires).
 */
export function parseOrderHash(hash: string): OrderLinkTarget | null {
  const raw = String(hash ?? "").replace(/^#/, "").trim();
  if (!raw.startsWith(ORDER_ANCHOR_PREFIX)) return null;

  const [refPart, queryPart = ""] = raw.slice(ORDER_ANCHOR_PREFIX.length).split("?");
  let ref = "";
  try {
    ref = decodeURIComponent(refPart).trim().toUpperCase();
  } catch {
    return null;
  }
  if (!/^[A-Z0-9][A-Z0-9-]{2,79}$/.test(ref)) return null;

  return { ref, offPlatform: new URLSearchParams(queryPart).get("hors") === "1" };
}
