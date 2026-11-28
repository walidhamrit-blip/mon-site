import { desc, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { telegramSupportRequests } from "@/db/schema";
import { sendTelegramMessage } from "@/lib/telegram";
import type { TelegramLocale } from "@/lib/telegram-core";

/** Les utilisateurs ne doivent pas envoyer de lien de suivi privé au support. */
export function redactTrackingTokens(text: string): string {
  return text.replace(/([?&](?:t|token)=)[A-Za-z0-9_-]+/gi, "$1[masqué]").slice(0, 1500);
}

export async function saveTelegramSupportRequest(input: {
  chatId: string; messageId: number; text: string; username: string | null;
  firstName: string | null; language: TelegramLocale;
}) {
  await ensureSchema();
  await db.insert(telegramSupportRequests).values({
    chatId: input.chatId, messageId: input.messageId, username: input.username,
    firstName: input.firstName, language: input.language, message: redactTrackingTokens(input.text),
  }).onConflictDoNothing();
}

export async function listTelegramSupportRequests() {
  await ensureSchema();
  return db.select().from(telegramSupportRequests).orderBy(desc(telegramSupportRequests.createdAt)).limit(50);
}

/** L'administrateur répond au chat enregistré, jamais à un identifiant fourni par le navigateur. */
export async function replyToTelegramSupport(id: number, text: string) {
  const message = text.trim();
  if (!Number.isSafeInteger(id) || id < 1 || !message || message.length > 1500) return { ok: false, error: "Réponse invalide (1 à 1500 caractères)." };
  await ensureSchema();
  const [request] = await db.select().from(telegramSupportRequests).where(eq(telegramSupportRequests.id, id)).limit(1);
  if (!request) return { ok: false, error: "Demande introuvable." };
  const result = await sendTelegramMessage(request.chatId, message);
  if (!result.ok) return { ok: false, error: result.error ?? "Envoi Telegram impossible." };
  try {
    await db.update(telegramSupportRequests).set({ reply: message, repliedAt: new Date() }).where(eq(telegramSupportRequests.id, id));
  } catch (error) {
    console.error("[telegram][support] réponse envoyée, journalisation impossible:", error instanceof Error ? error.message : error);
    return { ok: true, warning: "Réponse envoyée, mais non enregistrée dans le journal." };
  }
  return { ok: true };
}
