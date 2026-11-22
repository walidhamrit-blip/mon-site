import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { settings } from "@/db/schema";
import { manualPaymentsClosedAt } from "@/lib/manual-payment-hours";

export const MANUAL_PAYMENTS_MASTER_KEY = "manual_payments_master_enabled";
export type ManualPaymentsAvailability = {
  masterEnabled: boolean | null;
  status: "enabled" | "disabled" | "closed" | "unavailable";
};

/** Lecture fraîche et fail-closed ; l'absence de clé préserve les réglages existants. */
export async function readManualPaymentsAvailability(): Promise<ManualPaymentsAvailability> {
  try {
    await ensureSchema();
    const rows = await db.select({ value: settings.value }).from(settings)
      .where(eq(settings.key, MANUAL_PAYMENTS_MASTER_KEY)).limit(1);
    const raw = rows[0]?.value;
    if (rows.length && typeof raw !== "boolean") return { masterEnabled: null, status: "unavailable" };
    const masterEnabled = rows.length === 0 ? true : raw === true;
    if (!masterEnabled) return { masterEnabled, status: "disabled" };
    return { masterEnabled, status: manualPaymentsClosedAt(new Date()) ? "closed" : "enabled" };
  } catch (error) {
    console.error("[manual-payment] disponibilité générale illisible :", error instanceof Error ? error.message : error);
    return { masterEnabled: null, status: "unavailable" };
  }
}
