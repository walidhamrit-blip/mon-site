/**
 * Livraison par bot Telegram : consentement explicite, code dans le chat,
 * notification idempotente.
 *
 * ┌─ Décision produit ────────────────────────────────────────────────────┐
 * │ Le code EST envoyé dans le chat Telegram, en plus de l'e-mail Zoho.   │
 * │ C'est le canal que le client choisit en cliquant « recevoir aussi le  │
 * │ code sur Telegram » : un canal qu'on lui propose ne doit pas être un  │
 * │ demi-canal. L'e-mail reste envoyé dans tous les cas (aucun client ne  │
 * │ dépend du chat).                                                     │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Garde-fous, puisque le message contient un secret :
 *  1. consentement EXPLICITE par commande (`telegram_order_watches`) — le
 *     simple fait de démarrer le bot n'abonne à rien ;
 *  2. format Telegram : les messages portant des codes sont envoyés SANS
 *     `parse_mode`, donc sans HTML — aucun balisage ne peut altérer le
 *     code, et un code contenant `<` ou `&` reste lisible ;
 *  3. idempotence par `notified_at` : un IPN rejoué, un redémarrage ou une
 *     relance admin ne renvoient pas un second code dans le chat ;
 *  4. envoi privé uniquement : l'abonnement n'est possible que depuis un
 *     chat privé, jamais depuis un groupe où d'autres liraient le code.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { digitalOrders, telegramOrderWatches } from "@/db/schema";
import { decryptDigitalCodes, digitalCodesKeyRing } from "@/lib/digital-codes";

import {
  findOrderForBot,
  sendTelegramMessage,
  telegramConfigured,
} from "@/lib/telegram";
import {
  escapeTelegramHtml,
  orderRefFromStartPayload,
  orderRefFromText,
  trackingUrlFor,
  type TelegramLocale,
} from "@/lib/telegram-core";

export type WatchResult =
  | { ok: true; ref: string; alreadyWatching: boolean }
  | { ok: false; error: "order_not_found" | "bot_unavailable" | "invalid_ref" | "not_digital" };

/**
 * Enregistre (ou retrouve) l'abonnement d'un chat à une commande.
 *
 * `ON CONFLICT DO NOTHING` + contrainte UNIQUE `(order_ref, chat_id)` : un
 * double clic, un double `/prevenir` ou un rejeu du webhook Telegram ne crée
 * jamais de doublon.
 */
export async function watchOrderFromTelegram(
  chatId: string,
  rawRef: string,
  language: TelegramLocale,
): Promise<WatchResult> {
  if (!telegramConfigured()) return { ok: false, error: "bot_unavailable" };

  const ref = orderRefFromText(rawRef) ?? orderRefFromStartPayload(rawRef);
  if (!ref) return { ok: false, error: "invalid_ref" };

  const order = await findOrderForBot(ref);
  if (!order) return { ok: false, error: "order_not_found" };
  if (order.kind !== "digital") return { ok: false, error: "not_digital" };

  await ensureSchema();
  const inserted = await db
    .insert(telegramOrderWatches)
    .values({ orderRef: ref, chatId, language })
    .onConflictDoNothing({
      target: [telegramOrderWatches.orderRef, telegramOrderWatches.chatId],
    })
    .returning({ id: telegramOrderWatches.id });

  return { ok: true, ref, alreadyWatching: inserted.length === 0 };
}

/**
 * Message de confirmation d'abonnement.
 *
 * Annonce clairement que le code ARRIVERA DANS CE CHAT : c'est ce que le
 * client a demandé en cliquant, et une promesse floue l'obligerait à
 * surveiller deux canaux.
 */
export function formatWatchConfirmation(
  ref: string,
  language: TelegramLocale,
  siteName: string,
): string {
  const lines =
    language === "ar"
      ? [
          `✅ تم تفعيل الإشعارات للطلب ${ref}.`,
          "",
          "سنرسل لك الكود هنا في تيليجرام بمجرد أن يصبح جاهزاً — ونرسله أيضاً إلى بريدك الإلكتروني.",
          "لا تشارك هذه المحادثة مع أحد.",
        ]
      : language === "fr"
        ? [
            `✅ Notifications activées pour la commande ${ref}.`,
            "",
            "Je vous envoie le code ici même dès qu'il est prêt — il part aussi sur votre e-mail.",
            "Ne partagez pas cette conversation.",
          ]
        : [
            `✅ Notifications enabled for order ${ref}.`,
            "",
            "I'll send the code right here as soon as it is ready — it also goes to your email.",
            "Do not share this conversation.",
          ];
  return [...lines, "", siteName].join("\n");
}

/**
 * Envoie les codes dans les chats abonnés à la commande.
 *
 * Idempotence : `notified_at` est posé par l'appel qui « gagne » l'UPDATE
 * conditionnel (`WHERE notified_at IS NULL`). Un second passage — relance
 * admin, IPN rejoué, reprise cron — ne renvoie donc jamais deux fois le
 * même code, même si Telegram répond lentement.
 *
 * Ne lève jamais : l'e-mail est déjà parti, Telegram est un canal en plus.
 */
export async function notifyTelegramOrderDelivered(
  ref: string,
  siteUrl: string,
  siteName: string,
): Promise<{ ok: boolean; notified: number }> {
  if (!telegramConfigured()) return { ok: false, notified: 0 };
  const normalized = (ref ?? "").trim().toUpperCase();
  if (!normalized) return { ok: false, notified: 0 };

  try {
    await ensureSchema();

    // Commande réellement livrée ? On n'envoie jamais un code pour une
    // commande qui ne l'est pas, ni un message « c'est prêt » à vide.
    const [order] = await db
      .select({
        status: digitalOrders.status,
        title: digitalOrders.productTitle,
        denomination: digitalOrders.denominationLabel,
        region: digitalOrders.region,
        quantity: digitalOrders.quantity,
        codesCipher: digitalOrders.codesCipher,
      })
      .from(digitalOrders)
      .where(eq(digitalOrders.ref, normalized))
      .limit(1);
    if (!order || order.status !== "delivered") return { ok: false, notified: 0 };

    // Réclamation atomique : seul le passage qui pose `notified_at` envoie.
    const claimed = await db
      .update(telegramOrderWatches)
      .set({ notifiedAt: new Date() })
      .where(
        and(
          eq(telegramOrderWatches.orderRef, normalized),
          isNull(telegramOrderWatches.notifiedAt),
        ),
      )
      .returning({
        id: telegramOrderWatches.id,
        chatId: telegramOrderWatches.chatId,
        language: telegramOrderWatches.language,
      });
    if (claimed.length === 0) return { ok: true, notified: 0 };

    // Déchiffrement APRÈS la réclamation : on ne paie le coût crypto que
    // s'il y a réellement quelqu'un à servir. Jamais journalisé.
    const codes = order.codesCipher
      ? decryptDigitalCodes(order.codesCipher, digitalCodesKeyRing())
      : [];
    const tracking = trackingUrlFor(siteUrl, normalized);

    let sent = 0;
    for (const watch of claimed) {
      const language: TelegramLocale = (
        ["ar", "en", "fr"] as const
      ).includes(watch.language as TelegramLocale)
        ? (watch.language as TelegramLocale)
        : "ar";
      // Texte BRUT (pas de parse_mode) : un code doit traverser Telegram
      // sans échappement ni interprétation de balises.
      const text = formatDeliveredMessage({
        ref: normalized,
        title: order.title,
        denomination: order.denomination,
        region: order.region,
        quantity: order.quantity,
        codes,
        tracking,
        siteName,
        language,
      });

      const result = await sendTelegramMessage(watch.chatId, text, {
        timeoutMs: 6_000,
        keyboard: [
          [{ text: language === "ar" ? "📦 صفحة المتابعة" : language === "fr" ? "📦 Page de suivi" : "📦 Tracking page", url: tracking }],
        ],
      });
      if (result.ok) sent += 1;
    }

    return { ok: true, notified: sent };
  } catch (error) {
    console.warn(
      "[telegram][livraison] notification impossible :",
      error instanceof Error ? error.message : error,
    );
    return { ok: false, notified: 0 };
  }
}

/**
 * Corps du message de livraison — exporté pour les tests (aucune dépendance
 * base/réseau). Texte brut : voir la note sur `parse_mode` ci-dessus.
 */
export function formatDeliveredMessage(input: {
  ref: string;
  title: string;
  denomination: string;
  region: string;
  quantity?: number;
  codes: { cardNumber: string; pinCode: string | null; redemptionUrl: string | null }[];
  tracking: string;
  siteName: string;
  language: TelegramLocale;
}): string {
  const { language, codes } = input;
  const header =
    language === "ar"
      ? "🎁 وصل طلبك"
      : language === "fr"
        ? "🎁 Votre commande est livrée"
        : "🎁 Your order is delivered";

  const codeBlocks = codes.map((code, index) =>
    [
      codes.length > 1 ? `${language === "ar" ? "كود" : language === "fr" ? "Code" : "Code"} ${index + 1}` : null,
      code.cardNumber,
      code.pinCode ? `PIN ${code.pinCode}` : null,
      code.redemptionUrl ?? null,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n"),
  );

  const emptyNotice =
    language === "ar"
      ? "تم التسليم عبر قناتنا المعتادة. تواصل معنا إن لم تجد الكود."
      : language === "fr"
        ? "Livraison effectuée par notre canal habituel. Écrivez-nous si vous ne trouvez pas le code."
        : "Delivered through our usual channel. Contact us if you cannot find the code.";

  const footer =
    language === "ar"
      ? [
          "نفس الأكواد في بريدك الإلكتروني. لا تشارك هذه الرسالة مع أحد.",
          `صفحة المتابعة: ${input.tracking}`,
          input.siteName,
        ]
      : language === "fr"
        ? [
            "Ces codes sont aussi dans votre e-mail. Ne partagez pas ce message.",
            `Page de suivi : ${input.tracking}`,
            input.siteName,
          ]
        : [
            "These codes are also in your email. Do not share this message.",
            `Tracking page: ${input.tracking}`,
            input.siteName,
          ];

  return [
    header,
    "",
    `${input.title} — ${input.denomination} × ${input.quantity ?? 1}`,
    `${language === "ar" ? "الطلب" : language === "fr" ? "Commande" : "Order"} ${input.ref}`,
    "",
    ...(codeBlocks.length > 0 ? [codeBlocks.join("\n\n")] : [emptyNotice]),
    "",
    ...footer,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Nombre de chats en attente pour une commande (diagnostic admin). */
export async function telegramWatchCount(ref: string): Promise<number> {
  try {
    await ensureSchema();
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(telegramOrderWatches)
      .where(eq(telegramOrderWatches.orderRef, (ref ?? "").trim().toUpperCase()));
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}
