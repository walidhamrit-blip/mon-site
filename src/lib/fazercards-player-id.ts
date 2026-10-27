/**
 * Vérification de l'identifiant joueur AVANT l'achat.
 *
 * ⚠️ Pourquoi ce module existe.
 *
 * Un client a payé une recharge AFK Journey en saisissant l'identifiant de son
 * compte **8 Ball Pool**. Rien ne l'a arrêté : le champ « Account ID » accepte
 * n'importe quelle suite de chiffres, et l'achat part chez le fournisseur. Si
 * cet identifiant existe dans AFK Journey, le crédit part chez un inconnu. Une
 * recharge de jeu est IRRÉVERSIBLE.
 *
 * FazerCards expose `POST /topups/validate-id` : pour les jeux qui le
 * supportent, il renvoie le **pseudo du joueur** et refuse un identifiant
 * inexistant. C'est la seule protection réelle — on l'appelle donc :
 *  - à la caisse (avant de créer la facture : le client ne paie pas pour rien) ;
 *  - une seconde fois avant l'achat (le compte peut avoir été renommé ou
 *    supprimé entre le paiement et la livraison).
 *
 * ⚠️ Tous les jeux ne sont pas couverts (la liste est dynamique et dépend du
 * fournisseur). Quand la vérification n'est pas disponible, on ne bloque
 * JAMAIS la vente : on se contente d'avertir le client dans le tunnel.
 */
import { hasPlayerIdField } from "@/lib/fazercards-player-id-core";
import {
  fazercardsConfigured,
  fazercardsValidateId,
  fazercardsValidateIdList,
  isFazercardsError,
  fazercardsErrorMessage,
} from "@/lib/fazercards";

/** Durée de validité de la liste des jeux vérifiables (30 minutes). */
const SUPPORTED_TTL_MS = 30 * 60 * 1000;

let supportedCache: { ids: Set<string>; fetchedAt: number } | null = null;

/**
 * Identifiants de catégories pour lesquels le fournisseur sait valider un
 * joueur. `null` = information indisponible (fournisseur muet) : dans ce cas
 * on n'empêche rien, on n'affiche simplement pas de confirmation.
 */
export async function supportedValidateIdCategories(): Promise<Set<string> | null> {
  if (!fazercardsConfigured()) return null;
  if (supportedCache && Date.now() - supportedCache.fetchedAt < SUPPORTED_TTL_MS) {
    return supportedCache.ids;
  }
  try {
    const list = await fazercardsValidateIdList();
    const ids = new Set(list.items.map((item) => item.category_id));
    supportedCache = { ids, fetchedAt: Date.now() };
    return ids;
  } catch (error) {
    console.warn(
      "[fazercards][validate-id] liste indisponible :",
      isFazercardsError(error) ? fazercardsErrorMessage(error) : error,
    );
    return supportedCache?.ids ?? null;
  }
}

export interface PlayerIdCheck {
  /** Vrai si le fournisseur a réellement pu vérifier l'identifiant. */
  checked: boolean;
  /** Pertinent seulement si `checked` : l'identifiant existe-t-il ? */
  valid: boolean;
  /** Pseudo renvoyé par le fournisseur (à confirmer par le client). */
  playerName?: string;
  region?: string;
  /** Raison d'une vérification impossible (information, pas un refus). */
  reason?: string;
}

/**
 * Vérifie un identifiant joueur auprès du fournisseur.
 *
 * Ne lève jamais : une panne du fournisseur pendant la vérification ne doit
 * pas empêcher de vendre. Elle est signalée par `checked: false`.
 */
export async function checkFazercardsPlayerId(input: {
  categoryId: string;
  fields: Record<string, string | number>;
}): Promise<PlayerIdCheck> {
  if (!fazercardsConfigured()) {
    return { checked: false, valid: false, reason: "fournisseur non configuré" };
  }
  if (Object.keys(input.fields).length === 0) {
    return { checked: false, valid: false, reason: "aucun champ acheteur" };
  }

  const supported = await supportedValidateIdCategories();
  if (supported === null) {
    return { checked: false, valid: false, reason: "liste des jeux vérifiables indisponible" };
  }
  if (!supported.has(input.categoryId)) {
    return {
      checked: false,
      valid: false,
      reason: "ce jeu ne permet pas la vérification d'identifiant",
    };
  }

  try {
    const result = await fazercardsValidateId({
      category_id: input.categoryId,
      fields: input.fields,
    });
    return {
      checked: true,
      valid: result.valid === true,
      ...(result.player_name ? { playerName: result.player_name } : {}),
      ...(result.region ? { region: result.region } : {}),
    };
  } catch (error) {
    return {
      checked: false,
      valid: false,
      reason: isFazercardsError(error) ? fazercardsErrorMessage(error) : "vérification impossible",
    };
  }
}

export { hasPlayerIdField };

/** Remet la liste en cache à zéro (tests / après un changement de compte). */
export function resetPlayerIdCache(): void {
  supportedCache = null;
}
