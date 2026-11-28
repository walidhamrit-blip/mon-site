/** Alertes internes sur les factures digitales encore en attente en base.
 * Une attente n'est pas une preuve d'échec ni d'absence d'encaissement.
 */
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders } from "@/db/schema";
import { notifyTelegramAdmin, telegramConfig } from "@/lib/telegram";
import { siteBaseUrl } from "@/lib/site-url";

const DELAY_MS = 30 * 60_000;
const MAX_AGE_MS = 24 * 60 * 60_000;
const CLAIM_MS = 5 * 60_000;

export async function alertPendingDigitalPayments({ dryRun = false }: { dryRun?: boolean } = {}) {
  if (!telegramConfig().token || !telegramConfig().adminChatId) return { sent: 0, candidates: 0, configured: false };
  await ensureSchema();
  const now = new Date();
  const oldest = new Date(now.getTime() - MAX_AGE_MS);
  const cutoff = new Date(now.getTime() - DELAY_MS);
  const leaseExpired = new Date(now.getTime() - CLAIM_MS);
  const eligible = and(
    eq(orders.kind, "digital"), eq(orders.paymentMethod, "nowpayments"), eq(orders.status, "pending"),
    gte(orders.createdAt, oldest), lte(orders.createdAt, cutoff), isNull(orders.pendingAlertSentAt),
    or(isNull(orders.pendingAlertClaimedAt), lte(orders.pendingAlertClaimedAt, leaseExpired)),
  );
  const candidates = await db.select({ id: orders.id, ref: orders.ref }).from(orders).where(eligible).orderBy(orders.createdAt).limit(10);
  if (dryRun) return { sent: 0, candidates: candidates.length, configured: true };
  let sent = 0;
  for (const candidate of candidates) {
    const [claim] = await db.update(orders).set({ pendingAlertClaimedAt: now })
      .where(and(eq(orders.id, candidate.id), eligible)).returning({ id: orders.id, ref: orders.ref });
    if (!claim) continue;
    // Relecture juste avant notification ; le statut peut changer à tout instant.
    const [current] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, claim.id)).limit(1);
    if (current?.status !== "pending") continue;
    const text = `⏳ Commande ${claim.ref} toujours en attente dans le site depuis au moins 30 minutes. Ce statut ne prouve ni un échec ni l'absence de paiement : vérifiez NOWPayments avant toute action.`;
    const result = await notifyTelegramAdmin(text, [[{ text: "Voir la commande", url: `${siteBaseUrl().replace(/\/+$/, "")}/admin/orders?q=${encodeURIComponent(claim.ref)}` }]], { timeoutMs: 4000 });
    if (result.ok) {
      await db.update(orders).set({ pendingAlertSentAt: new Date(), pendingAlertClaimedAt: null }).where(and(eq(orders.id, claim.id), eq(orders.pendingAlertClaimedAt, now)));
      sent++;
    } else {
      await db.update(orders).set({ pendingAlertClaimedAt: null }).where(and(eq(orders.id, claim.id), eq(orders.pendingAlertClaimedAt, now)));
      console.warn(`[payments] alerte en attente non envoyée ${claim.ref}: ${result.error}`);
    }
  }
  return { sent, candidates: candidates.length, configured: true };
}
