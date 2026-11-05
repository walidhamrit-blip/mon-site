/**
 * Réputation & avis — module PUR (aucune I/O, aucun import Next).
 *
 * Deux usages :
 *   1. **liens publics** vers les profils d'avis (Trustpilot, Google,
 *      Scamadviser) saisis dans `/admin → Réglages → Avis & mentions` ;
 *   2. **demandes d'avis** après livraison (e-mails) — mêmes liens.
 *
 * Règle de fond : **aucune note n'est inventée ici**. Le module ne connaît
 * ni moyenne ni nombre d'avis ; il ne fait que valider et exposer des URL de
 * profils réels. Toute note affichée sur le site doit venir d'une plateforme
 * tierce (widget/API), jamais d'un chiffre saisi à la main. Voir
 * `docs/avis-clients-trustpilot-scamadviser-2026-11-05.md`.
 *
 * La validation d'URL n'est pas cosmétique : un champ administrable qui
 * finirait dans un `href` public (et dans des e-mails) doit être restreint
 * aux domaines des plateformes. Une faute de frappe (`trustpilot.co`,
 * `trustpilot.com.exemple.net`) enverrait sinon nos clients ailleurs.
 */

import type { LegalConfigData, TrustConfigData } from "@/lib/site-types";

export type ReviewPlatform = "trustpilot" | "google" | "scamadviser";

export interface ReviewLink {
  platform: ReviewPlatform;
  /** URL validée (https, domaine de la plateforme). */
  url: string;
  /**
   * `profile` = fiche publique (le visiteur lit les avis existants),
   * `write` = formulaire d'avis direct (`/evaluate/…`, lien Google « laisser
   * un avis »). La distinction n'est pas cosmétique : elle décide du libellé
   * et du lien envoyé dans les e-mails d'invitation.
   */
  kind: "profile" | "write";
  labelAr: string;
  labelEn: string;
}

/**
 * Domaines acceptés, par plateforme.
 *
 * - Trustpilot est servi par sous-domaine de langue (`fr.`, `uk.`, `www.`) :
 *   on accepte un sous-domaine de 2 à 5 lettres, jamais deux niveaux.
 * - Scamadviser expose `www.` et `app.`.
 * - Google : domaines `google.<tld>`, plus les raccourcis de fiche
 *   (`g.page`, `maps.app.goo.gl`).
 */
const PLATFORM_HOSTS: Record<ReviewPlatform, RegExp> = {
  trustpilot: /^(?:[a-z]{2,5}\.)?trustpilot\.com$/,
  scamadviser: /^(?:www\.|app\.)?scamadviser\.com$/,
  google:
    /^(?:(?:www\.|maps\.)?google\.[a-z]{2,4}(?:\.[a-z]{2})?|g\.page|maps\.app\.goo\.gl)$/,
};

const PLATFORM_ORDER: ReviewPlatform[] = ["trustpilot", "google", "scamadviser"];

const LABELS: Record<ReviewPlatform, { ar: string; en: string }> = {
  trustpilot: {
    ar: "اقرأ واكتب تقييماً على Trustpilot",
    en: "Read & write a review on Trustpilot",
  },
  google: {
    ar: "تقييمات Google",
    en: "Google reviews",
  },
  scamadviser: {
    ar: "ملفنا على Scamadviser",
    en: "Our Scamadviser profile",
  },
};

/** Libellés des liens qui ouvrent directement le formulaire d'avis. */
const WRITE_LABELS: Record<ReviewPlatform, { ar: string; en: string }> = {
  trustpilot: {
    ar: "اكتب تقييماً على Trustpilot",
    en: "Write a Trustpilot review",
  },
  google: {
    ar: "اكتب تقييماً على Google",
    en: "Write a Google review",
  },
  scamadviser: {
    ar: "اكتب تقييماً على Scamadviser",
    en: "Write a Scamadviser review",
  },
};

/**
 * Un lien Trustpilot `/evaluate/<domaine>` est un formulaire d'avis direct ;
 * `/review/<domaine>` est la fiche publique. On déduit le type de l'URL
 * plutôt que de demander à l'administrateur de le déclarer deux fois.
 */
function linkKind(platform: ReviewPlatform, url: string): "profile" | "write" {
  if (platform !== "trustpilot") return "write";
  return /\/evaluate(\/|$)/.test(new URL(url).pathname) ? "write" : "profile";
}

/**
 * Normalise une URL de profil. Renvoie `""` si elle n'est pas exploitable :
 * vide, non absolue, non https, avec identifiants, ou sur un autre domaine
 * que celui de la plateforme demandée.
 */
export function normalizeReviewUrl(platform: ReviewPlatform, raw: unknown): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || trimmed.length > 500) return "";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "";
  }
  if (parsed.protocol !== "https:") return "";
  if (parsed.username || parsed.password) return "";
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!PLATFORM_HOSTS[platform].test(host)) return "";
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin.toLowerCase()}${path}${parsed.search}`;
}

/** Liens de profils réellement configurés, dans un ordre stable. */
export function reviewLinks(trust: TrustConfigData | null | undefined): ReviewLink[] {
  if (!trust) return [];
  const sources: Record<ReviewPlatform, unknown> = {
    trustpilot: trust.trustpilotUrl,
    google: trust.googleReviewUrl,
    scamadviser: trust.scamadviserUrl,
  };
  const links: ReviewLink[] = [];
  for (const platform of PLATFORM_ORDER) {
    const url = normalizeReviewUrl(platform, sources[platform]);
    if (!url) continue;
    const kind = linkKind(platform, url);
    const labels = kind === "write" ? WRITE_LABELS[platform] : LABELS[platform];
    links.push({
      platform,
      url,
      kind,
      labelAr: labels.ar,
      labelEn: labels.en,
    });
  }
  return links;
}

/**
 * Liens à mettre dans une **demande d'avis** — uniquement là où le client
 * peut écrire tout de suite.
 *
 * Priorité au **formulaire direct** (`trustpilotReviewUrl` = `/evaluate/…`,
 * lien Google « laisser un avis ») : un clic de moins entre la livraison et
 * l'avis. À défaut, la fiche publique fait le travail (Trustpilot y affiche
 * un bouton « Écrire un avis »). Scamadviser est exclu : on y va pour
 * consulter une fiche, pas pour répondre à une invitation.
 */
export function reviewInviteLinks(trust: TrustConfigData | null | undefined): ReviewLink[] {
  if (!trust) return [];
  const links: ReviewLink[] = [];

  const direct = normalizeReviewUrl("trustpilot", trust.trustpilotReviewUrl);
  const profile = normalizeReviewUrl("trustpilot", trust.trustpilotUrl);
  const trustpilotUrl = direct || profile;
  if (trustpilotUrl) {
    const kind = linkKind("trustpilot", trustpilotUrl);
    const labels = kind === "write" ? WRITE_LABELS.trustpilot : LABELS.trustpilot;
    links.push({
      platform: "trustpilot",
      url: trustpilotUrl,
      kind,
      labelAr: labels.ar,
      labelEn: labels.en,
    });
  }

  const google = normalizeReviewUrl("google", trust.googleReviewUrl);
  if (google) {
    links.push({
      platform: "google",
      url: google,
      kind: "write",
      labelAr: WRITE_LABELS.google.ar,
      labelEn: WRITE_LABELS.google.en,
    });
  }

  return links;
}

/**
 * Une demande d'avis n'est envoyée que si l'administrateur l'a activée **et**
 * qu'au moins une plateforme où le client peut écrire est configurée
 * (Trustpilot ou Google). Proposer « laissez un avis » sans destination
 * serait un lien mort dans la boîte du client.
 */
export function reviewInvitesEnabled(trust: TrustConfigData | null | undefined): boolean {
  if (!trust || trust.reviewInvites !== true) return false;
  return reviewInviteLinks(trust).length > 0;
}

/* ------------------------------------------------------------------ */
/* Identité légale (page /mentions-legales)                            */
/* ------------------------------------------------------------------ */

export interface LegalSource {
  name: string;
  nameAr?: string;
  url?: string;
  email?: string;
  phone?: string;
  address?: string;
  addressEn?: string;
  legal?: LegalConfigData | null;
}

export interface LegalRow {
  labelAr: string;
  labelEn: string;
  value: string;
  /** Renseigné pour les valeurs cliquables (e-mail, site, hébergeur). */
  href?: string;
}

/**
 * Lignes factuelles de la page mentions légales.
 *
 * Rien n'est inventé : une ligne dont la valeur n'est pas renseignée est
 * **omise** (pas de « à compléter » public, pas de numéro de registre
 * fictif). Le nom de la marque sert de raison sociale par défaut, puisque
 * c'est le nom sous lequel le site est édité.
 */
export function legalRows(source: LegalSource): LegalRow[] {
  const legal = source.legal ?? null;
  const rows: LegalRow[] = [];
  const push = (labelAr: string, labelEn: string, value: string, href?: string) => {
    const clean = String(value ?? "").trim();
    if (!clean) return;
    rows.push({ labelAr, labelEn, value: clean, ...(href ? { href } : {}) });
  };

  push("الاسم التجاري", "Trading name", source.name);
  push("الاسم القانوني", "Legal name", legal?.companyName ?? "");
  push(
    "رقم السجل التجاري",
    "Commercial registration no.",
    [legal?.registrationNumber ?? "", legal?.registrationAuthority ?? ""]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" — "),
  );
  push(
    "العنوان",
    "Address",
    [source.address, source.addressEn].filter(Boolean).join(" / "),
  );
  push("الهاتف", "Phone", source.phone ?? "", source.phone ? `tel:${source.phone.replace(/[^+\d]/g, "")}` : undefined);
  push("البريد الإلكتروني", "E-mail", source.email ?? "", source.email ? `mailto:${source.email}` : undefined);
  push("الموقع", "Website", source.url ?? "", source.url ?? undefined);
  push("مسؤول النشر", "Publication manager", legal?.publisherName ?? "");
  push("الاستضافة", "Hosting", legal?.hostName ?? "", legal?.hostWebsite ?? undefined);

  return rows;
}

/* ------------------------------------------------------------------ */
/* Vérification de domaine Trustpilot                                  */
/* ------------------------------------------------------------------ */

/** Nom de la balise meta attendue par Trustpilot (valeur exacte). */
export const TRUSTPILOT_META_NAME = "trustpilot-one-time-domain-verification-id";

/**
 * Jeton de vérification de domaine Trustpilot, lu dans l'environnement.
 *
 * Pourquoi une balise meta plutôt qu'un enregistrement DNS ou un fichier ?
 * Parce que la vérification de domaine est l'étape qui bloque quand l'e-mail
 * de création de compte n'est pas sur le domaine — et que sur Vercel, changer
 * une variable d'environnement est plus simple (et plus traçable) que
 * déposer un fichier à la racine ou attendre une propagation DNS.
 *
 * Le jeton est validé avant émission : une valeur contenant des guillemets ou
 * des chevrons casserait le HTML de toutes les pages du site.
 */
export function trustpilotVerificationToken(raw?: string | null): string {
  const value = String(raw ?? process.env.TRUSTPILOT_VERIFICATION ?? "").trim();
  if (value.length < 8 || value.length > 200) return "";
  if (!/^[A-Za-z0-9._-]+$/.test(value)) return "";
  return value;
}

/** Balise `verification.other` de Next, prête à fusionner dans les metadata. */
export function trustpilotVerificationMeta(raw?: string | null): Record<string, string> {
  const token = trustpilotVerificationToken(raw);
  return token ? { [TRUSTPILOT_META_NAME]: token } : {};
}
