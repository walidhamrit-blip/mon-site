/**
 * Mesure du funnel — enveloppe typée autour de Vercel Web Analytics.
 *
 * Règles :
 *  - aucun événement n'est envoyé côté serveur (le module ne fait rien sans
 *    `window`) ;
 *  - les propriétés sont limitées à une liste blanche (`path`, `id`, `source`,
 *    `kind`) : jamais d'e-mail, de téléphone, de nom ni de référence de
 *    commande, même par erreur d'appel ;
 *  - une erreur de mesure ne casse jamais un clic : tout est encapsulé.
 */
import { track } from "@vercel/analytics";

/** Propriétés autorisées. Toute autre clé est ignorée à l'exécution. */
const PROP_KEYS = new Set(["path", "id", "source", "kind"]);
const MAX_VALUE_LENGTH = 64;

export type AnalyticsEvent =
  | { name: "gateway_click"; path: string }
  | { name: "service_view"; id: string }
  | { name: "whatsapp_click"; source: string }
  | { name: "lead_submit"; source: string }
  | { name: "checkout_start"; kind: string }
  | { name: "audit_request"; source: string };

function clean(value: string): string {
  return value
    // Ni saut de ligne, ni caractère de contrôle : une seule ligne lisible.
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, MAX_VALUE_LENGTH);
}

/**
 * Envoie un événement de funnel. Sans effet côté serveur, et silencieux en
 * cas d'échec : la mesure ne doit jamais dégrader le parcours.
 */
export function trackEvent(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;

  const { name, ...raw } = event;
  const properties: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!PROP_KEYS.has(key)) continue;
    if (typeof value !== "string") continue;
    properties[key] = clean(value);
  }

  try {
    track(name, properties);
  } catch {
    // Bloqueur de publicité, réseau coupé, Analytics désactivé : on continue.
  }
}
