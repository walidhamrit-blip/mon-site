// Journalisation du verdict RÉEL du fournisseur d'e-mail pour les codes
// livrés (boutique digitale).
//
// Un « envoyé » sans identifiant de message ni motif d'échec est
// indiagnosticable : c'est exactement ce qui rendait invisible un e-mail
// accepté mais jamais remis (domaine non vérifié, SPF/DKIM absents, spam).
// Le verdict est donc écrit sur la commande, quelle que soit l'origine de
// la livraison (Reloadly ou FazerCards).

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { digitalOrders } from "@/db/schema";

export interface DigitalEmailResult {
  ok: boolean;
  provider?: string;
  id?: string;
  error?: string;
}

/**
 * Enregistre le résultat de l'envoi de l'e-mail des codes.
 * N'échoue jamais : une erreur d'écriture ne doit pas faire perdre la
 * livraison (les codes restent consultables par le client et l'admin).
 */
export async function recordDigitalEmailOutcome(
  orderId: number,
  result: DigitalEmailResult,
): Promise<void> {
  const patch = result.ok
    ? {
        emailSentAt: new Date(),
        emailProviderId: result.id ?? null,
        emailLastError: null,
      }
    : {
        emailLastError: `${result.provider ?? "mail"} : ${result.error ?? "échec inconnu"}`.slice(
          0,
          500,
        ),
      };
  try {
    await db.update(digitalOrders).set(patch).where(eq(digitalOrders.id, orderId));
  } catch (error) {
    console.warn(
      "[digital] suivi e-mail non enregistré :",
      error instanceof Error ? error.message : error,
    );
  }
  if (!result.ok) {
    console.warn("[digital] e-mail codes non envoyé :", result.error);
  }
}
