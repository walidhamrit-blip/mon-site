// Soldes dus aux clients — logique PURE (aucune base, aucun réseau).
//
// Cas réel : un client règle avec une carte de recharge de **30,00 LYD** une
// commande dont le devis accepté est de **17,96 LYD**. L'écart (12,04 LYD) est
// un solde dû au client, utilisable sur une commande ultérieure ou
// remboursable. Rien dans le site ne le suivait : le gérant devait s'en
// souvenir, donc l'argent dû finissait par être perdu ou contesté.
//
// Ce module définit les règles de calcul et de formatage ; l'accès à la base
// vit dans `src/lib/client-credits.ts`, l'écran dans `/admin/soldes`.
// Testé par `scripts/client-credits.test.mjs`.

export const CREDIT_MOVEMENT_KINDS = ["overpayment", "use", "refund", "adjustment"] as const;

export type CreditMovementKind = (typeof CREDIT_MOVEMENT_KINDS)[number];

/** Libellés admin : le sens du mouvement doit être lisible d'un coup d'œil. */
export const CREDIT_MOVEMENT_LABELS: Record<CreditMovementKind, string> = {
  overpayment: "Trop-perçu encaissé",
  use: "Utilisé sur une commande",
  refund: "Remboursé au client",
  adjustment: "Ajustement manuel",
};

/** Sens du mouvement sur le solde (+ crédit, − débit). */
export const CREDIT_MOVEMENT_SIGNS: Record<CreditMovementKind, 1 | -1> = {
  overpayment: 1,
  use: -1,
  refund: -1,
  adjustment: 1,
};

export function normalizeMovementKind(value: unknown): CreditMovementKind | null {
  const kind = String(value ?? "").trim().toLowerCase();
  return (CREDIT_MOVEMENT_KINDS as readonly string[]).includes(kind)
    ? (kind as CreditMovementKind)
    : null;
}

/** Montant LYD → nombre à 2 décimales ; `null` si la valeur n'est pas un nombre. */
export function parseLyd(value: unknown): number | null {
  const raw = typeof value === "number" ? value : Number(String(value ?? "").replace(",", ".").trim());
  if (!Number.isFinite(raw)) return null;
  return Math.round(raw * 100) / 100;
}

/** Nombre → texte « 12.04 » (stockage stable, pas d'arrondi flottant). */
export function formatLyd(value: number | string | null | undefined): string {
  const parsed = parseLyd(value);
  if (parsed === null) return "0.00";
  return parsed.toFixed(2);
}

/** Affichage humain : « 12,04 LYD ». */
export function displayLyd(value: number | string | null | undefined): string {
  return `${formatLyd(value).replace(".", ",")} LYD`;
}

/** Valeur réellement absente (`null`, `undefined`, chaîne vide ou espaces). */
function isBlankAmount(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  return typeof value === "string" && value.trim() === "";
}

/**
 * Trop-perçu d'une carte téléphonique : valeur de la carte moins le devis dû.
 *
 * - carte 30,00 / devis 17,96 → **12,04** (crédit dû au client) ;
 * - carte 15,00 / devis 17,96 → **0** (le client doit encore de l'argent) ;
 * - valeur ou devis illisible → `null` (on ne devine pas un montant d'argent).
 */
export function overpaymentLyd(
  cardValueLyd: unknown,
  quoteTotalLyd: unknown,
): number | null {
  // Une valeur absente n'est pas un zéro : sans devis connu, on ne peut pas
  // affirmer que la carte entière est due au client.
  if (isBlankAmount(cardValueLyd) || isBlankAmount(quoteTotalLyd)) return null;
  const card = parseLyd(cardValueLyd);
  const quote = parseLyd(quoteTotalLyd);
  if (card === null || quote === null || card <= 0) return null;
  const difference = Math.round((card - quote) * 100) / 100;
  return difference > 0 ? difference : 0;
}

export interface MovementInput {
  balanceLyd: unknown;
  kind: unknown;
  amountLyd: unknown;
}

export type MovementResult =
  | { ok: true; kind: CreditMovementKind; amount: string; signedAmount: string; balanceAfter: string }
  | { ok: false; error: string };

/**
 * Applique un mouvement à un solde.
 *
 * Règles :
 *  - le montant saisi est toujours POSITIF (le sens vient du type) ;
 *  - un débit (`use`, `refund`) ne peut pas dépasser le solde disponible ;
 *  - un ajustement peut corriger dans les deux sens (montant négatif accepté) ;
 *  - le solde résultant ne peut pas devenir négatif.
 */
export function applyMovement(input: MovementInput): MovementResult {
  const kind = normalizeMovementKind(input.kind);
  if (!kind) return { ok: false, error: "Type de mouvement inconnu." };

  const balance = parseLyd(input.balanceLyd) ?? 0;
  const raw = parseLyd(input.amountLyd);
  if (raw === null) return { ok: false, error: "Montant illisible." };

  const sign = CREDIT_MOVEMENT_SIGNS[kind];
  const amount = kind === "adjustment" ? raw : Math.abs(raw);
  if (amount === 0) return { ok: false, error: "Le montant doit être différent de zéro." };

  const delta = sign * amount;
  const balanceAfter = Math.round((balance + delta) * 100) / 100;

  if (balanceAfter < 0) {
    return {
      ok: false,
      error: `Solde insuffisant : le client doit ${displayLyd(balance)} au maximum pour ce mouvement.`,
    };
  }

  return {
    ok: true,
    kind,
    amount: formatLyd(Math.abs(amount)),
    signedAmount: `${delta >= 0 ? "+" : "-"}${formatLyd(Math.abs(amount))}`,
    balanceAfter: formatLyd(balanceAfter),
  };
}

/**
 * Clé d'identité d'un client : e-mail normalisé en priorité, sinon téléphone
 * réduit aux chiffres. `null` si rien d'exploitable — on ne crée pas de solde
 * anonyme, impossible à rapprocher d'une personne.
 */
export function normalizeClientKey(input: {
  email?: unknown;
  phone?: unknown;
}): { key: string; email: string | null; phone: string | null } | null {
  const emailRaw = String(input.email ?? "").trim().toLowerCase();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailRaw) ? emailRaw : null;

  const phoneRaw = String(input.phone ?? "").trim();
  const digits = phoneRaw.replace(/\D/g, "");
  const phone = digits.length >= 6 ? (phoneRaw.startsWith("+") ? `+${digits}` : digits) : null;

  const key = email ? `email:${email}` : phone ? `phone:${phone}` : null;
  if (!key) return null;
  return { key, email, phone };
}

/** Résumé lisible d'un solde pour l'admin (jamais « -0,00 »). */
export function balanceLabel(balanceLyd: unknown): string {
  const balance = parseLyd(balanceLyd) ?? 0;
  if (balance === 0) return "0,00 LYD";
  return `${formatLyd(balance).replace(".", ",")} LYD`;
}
