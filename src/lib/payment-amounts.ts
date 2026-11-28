/** Montants crypto d'un même paiement NOWPayments (pas le versement net marchand). */
export interface CryptoPaymentSnapshot {
  expected: string;
  actual: string;
  currency: string;
}

function amount(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (text.length > 120 || !/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? text : null;
}

/** Ne jamais comparer le montant fiat, ni des données venant de deux paiements différents. */
export function cryptoPaymentSnapshot(payload: {
  pay_amount?: unknown;
  actually_paid?: unknown;
  pay_currency?: unknown;
}): CryptoPaymentSnapshot | null {
  const expected = amount(payload.pay_amount);
  const actual = amount(payload.actually_paid);
  const currency = typeof payload.pay_currency === "string" ? payload.pay_currency.trim() : "";
  if (expected === null || Number(expected) <= 0 || actual === null || !/^[a-z0-9_-]{1,40}$/i.test(currency)) return null;
  return { expected, actual, currency: currency.toUpperCase() };
}

/** Compare les décimales sans perdre les plus petites unités aux grandes valeurs. */
function decimalParts(text: string): { digits: string; magnitude: number } {
  const [mantissa, exponent = "0"] = text.toLowerCase().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const raw = whole + fraction;
  const digits = raw.replace(/^0+/, "");
  return { digits, magnitude: digits.length + Number(exponent) - fraction.length };
}

/** Compare deux montants décimaux non négatifs, ou retourne null s'ils sont invalides. */
export function compareCryptoAmounts(left: unknown, right: unknown): number | null {
  const leftText = amount(left);
  const rightText = amount(right);
  if (leftText === null || rightText === null) return null;
  const a = decimalParts(leftText);
  const b = decimalParts(rightText);
  if (!a.digits || !b.digits) return a.digits ? 1 : b.digits ? -1 : 0;
  if (a.magnitude !== b.magnitude) return a.magnitude > b.magnitude ? 1 : -1;
  const length = Math.max(a.digits.length, b.digits.length);
  const lhs = a.digits.padEnd(length, "0");
  const rhs = b.digits.padEnd(length, "0");
  return lhs === rhs ? 0 : lhs > rhs ? 1 : -1;
}

/** Tous les excédents sont signalés, même faibles : aucune conversion en USD. */
export function isCryptoOverpayment(snapshot: CryptoPaymentSnapshot | null): boolean {
  return snapshot !== null && compareCryptoAmounts(snapshot.actual, snapshot.expected) === 1;
}
