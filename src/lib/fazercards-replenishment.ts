import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { settings } from "@/db/schema";
import {
  DEFAULT_REPLENISHMENT_SETTINGS,
  validReplenishmentSettings,
  type ReplenishmentSettings,
} from "@/lib/fazercards-replenishment-core";

const KEY = "fazercards:replenishment-settings";

export async function readReplenishmentSettings(): Promise<ReplenishmentSettings> {
  await ensureSchema();
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, KEY)).limit(1);
  if (!row) return DEFAULT_REPLENISHMENT_SETTINGS;
  if (!validReplenishmentSettings(row.value)) throw new Error("Règle de recharge enregistrée invalide.");
  return row.value;
}

export async function saveReplenishmentSettings(value: ReplenishmentSettings): Promise<void> {
  if (!validReplenishmentSettings(value)) throw new Error("Règle de recharge invalide.");
  await ensureSchema();
  await db.insert(settings).values({ key: KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}
