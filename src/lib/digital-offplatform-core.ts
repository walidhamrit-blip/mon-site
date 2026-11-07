// Livraison d'un code HORS du système (WhatsApp, téléphone, e-mail direct).
//
// Cas réel : le gérant achète la carte chez le fournisseur et l'envoie au
// client par WhatsApp. Jusqu'ici la seule sortie possible était « livrer
// manuellement avec un code » (qui exige de ressaisir le code) ou « clôturer
// sans code » — réservé aux recharges de jeu. Résultat : la commande restait
// éternellement `manual`, la page de suivi affichait « code en cours de
// préparation » et le client ne recevait jamais d'e-mail de livraison.
//
// Ce module est PUR (aucune base, aucun réseau) : il normalise le canal,
// valide la note et construit les textes (e-mail client + mention publique).
// Il est testé seul dans `scripts/digital-offplatform.test.mjs`.

export const OFF_PLATFORM_CHANNELS = ["whatsapp", "phone", "email", "other"] as const;

export type OffPlatformChannel = (typeof OFF_PLATFORM_CHANNELS)[number];

export const OFF_PLATFORM_CHANNEL_LABELS: Record<OffPlatformChannel, string> = {
  whatsapp: "WhatsApp",
  phone: "Appel téléphonique",
  email: "E-mail direct",
  other: "Autre canal",
};

/** Longueur maximale de la note interne (jamais affichée au client). */
export const OFF_PLATFORM_NOTE_MAX = 300;

/** Canal normalisé ; `null` si la valeur est absente ou inconnue. */
export function normalizeOffPlatformChannel(value: unknown): OffPlatformChannel | null {
  const channel = String(value ?? "").trim().toLowerCase();
  return (OFF_PLATFORM_CHANNELS as readonly string[]).includes(channel)
    ? (channel as OffPlatformChannel)
    : null;
}

export type OffPlatformValidation =
  | { ok: true; channel: OffPlatformChannel; note: string | null }
  | { ok: false; error: string };

/**
 * Valide la saisie admin. Le canal est obligatoire (on doit pouvoir dire
 * « livré par WhatsApp »), la note est facultative et bornée : elle sert de
 * justificatif interne en cas de litige.
 */
export function validateOffPlatformDelivery(input: {
  channel?: unknown;
  note?: unknown;
}): OffPlatformValidation {
  const channel = normalizeOffPlatformChannel(input.channel);
  if (!channel) {
    return {
      ok: false,
      error: "Choisissez le canal utilisé pour transmettre le code (WhatsApp, téléphone, e-mail, autre).",
    };
  }
  const note = String(input.note ?? "").trim().slice(0, OFF_PLATFORM_NOTE_MAX);
  return { ok: true, channel, note: note || null };
}

function escape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface OffPlatformEmailInput {
  ref: string;
  productTitle: string;
  denominationLabel?: string | null;
  channel: OffPlatformChannel;
  /** Note INTERNE : jamais incluse dans l'e-mail au client. */
  note?: string | null;
  trackingUrl: string;
  siteName: string;
  siteUrl: string;
  supportEmail?: string | null;
  /** Date de livraison (déjà formatée, ex. « 07/11/2026 à 21:45 »). */
  deliveredAtLabel?: string | null;
}

/**
 * Contenu de l'e-mail « commande livrée hors système » : le code n'y figure
 * pas (il a été transmis par WhatsApp), mais le client reçoit une trace
 * écrite, la date, et son lien de suivi.
 */
export function offPlatformEmailContent(input: OffPlatformEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const channelLabel = OFF_PLATFORM_CHANNEL_LABELS[input.channel];
  const product = [input.productTitle, input.denominationLabel]
    .filter((part) => Boolean(part && String(part).trim()))
    .join(" — ");
  const deliveredAt = input.deliveredAtLabel?.trim() || "";
  const subject = `✅ Commande livrée — ${input.productTitle} — ${input.ref}`;

  const text = [
    "Bonjour,",
    "",
    `Votre commande ${input.ref} est livrée.`,
    `Produit : ${product}`,
    deliveredAt ? `Livrée le : ${deliveredAt}` : "",
    `Le code vous a été transmis par ${channelLabel}.`,
    "",
    "Conservez cet e-mail : il vaut preuve de livraison.",
    `Suivi de commande : ${input.trackingUrl}`,
    input.supportEmail ? `Une question ? ${input.supportEmail}` : "",
    "",
    `${input.siteName} — ${input.siteUrl}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1e">
      <div style="font-size:13px;letter-spacing:.12em;color:#C6A664;font-weight:700">${escape(
        input.siteName.toUpperCase(),
      )} — BOUTIQUE DIGITALE</div>
      <h1 style="font-size:22px;font-weight:900;margin:8px 0 4px">Votre commande est livrée ✅</h1>
      <p style="color:#666;font-size:14px;margin:0 0 18px">${escape(product)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700;width:140px">Commande</td><td style="padding:6px 10px">${escape(
          input.ref,
        )}</td></tr>
        <tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700">Transmis par</td><td style="padding:6px 10px">${escape(
          channelLabel,
        )}</td></tr>
        ${
          deliveredAt
            ? `<tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700">Livrée le</td><td style="padding:6px 10px">${escape(
                deliveredAt,
              )}</td></tr>`
            : ""
        }
      </table>
      <p style="color:#666;font-size:13px;margin-top:16px">
        Le code n'est pas répété ici : il vous a été transmis par ${escape(
          channelLabel,
        )}. Conservez cet e-mail, il vaut preuve de livraison.
      </p>
      <p style="font-size:13px;margin-top:16px">
        <a href="${escape(input.trackingUrl)}" style="color:#8A6D2F;font-weight:700">Suivre ma commande</a>
      </p>
      ${
        input.supportEmail
          ? `<p style="color:#666;font-size:13px">Une question ? Écrivez à <a href="mailto:${escape(
              input.supportEmail,
            )}" style="color:#8A6D2F">${escape(input.supportEmail)}</a>.</p>`
          : ""
      }
      <p style="color:#999;font-size:12px;margin-top:24px">${escape(input.siteName)} — ${escape(
        input.siteUrl,
      )}</p>
    </div>`;

  return { subject, text, html };
}

/** Libellés localisés, réservés à la mention publique. */
const NOTICE_CHANNEL_LABELS: Record<"fr" | "en" | "ar", Record<OffPlatformChannel, string>> = {
  fr: OFF_PLATFORM_CHANNEL_LABELS,
  en: {
    whatsapp: "WhatsApp",
    phone: "phone call",
    email: "email",
    other: "another channel",
  },
  ar: {
    whatsapp: "واتساب",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    other: "قناة أخرى",
  },
};

/**
 * Mention affichée sur `/codes/commande` quand la commande est livrée mais
 * qu'aucun code n'est stocké : le client doit comprendre où il a reçu son
 * code, au lieu de voir une page « Livré » sans contenu.
 */
export function offPlatformNotice(
  channel: unknown,
  deliveredAt: Date | string | null | undefined,
  locale: string,
): string | null {
  const normalized = normalizeOffPlatformChannel(channel);
  if (!normalized) return null;
  const raw = String(locale ?? "").slice(0, 2).toLowerCase();
  const lang = raw === "en" || raw === "ar" ? raw : "fr";
  const label = NOTICE_CHANNEL_LABELS[lang][normalized];

  if (lang === "ar") {
    return `تم تسليم طلبك عبر ${label}. احتفظ بالرسالة التي وصلك فيها الكود.`;
  }
  if (lang === "en") {
    return `Delivered via ${label}. Keep the message in which you received the code.`;
  }
  const date = deliveredAt ? ` le ${new Date(deliveredAt).toLocaleDateString("fr-FR")}` : "";
  return `Commande livrée via ${label}${date}. Conservez le message dans lequel vous avez reçu le code.`;
}
