// Lecture opérationnelle du paiement manuel — serveur uniquement.
// Volontairement sans cache et sans repli « activé » : si la base ne répond
// pas, aucune nouvelle carte ne doit être acceptée pendant une indisponibilité.

import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { settings } from "@/db/schema";
import { normalizePhoneCardPaymentsEnabled } from "@/lib/phone-card-core";
import { SETTINGS_KEYS } from "@/lib/store";

export type PhoneCardAvailability = "enabled" | "disabled" | "unavailable";

/** Lit la clé dédiée à chaque contrôle, indépendamment des caches de pages. */
export async function readPhoneCardAvailability(): Promise<PhoneCardAvailability> {
  try {
    await ensureSchema();
    const rows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, SETTINGS_KEYS.phoneCardPaymentsEnabled))
      .limit(1);
    return normalizePhoneCardPaymentsEnabled(rows[0]?.value) ? "enabled" : "disabled";
  } catch (error) {
    console.error(
      "[phone-card] disponibilité illisible :",
      error instanceof Error ? error.message : error,
    );
    return "unavailable";
  }
}
