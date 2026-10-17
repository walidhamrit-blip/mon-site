import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE = "nukhba_admin_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

function getSecret(): string | null {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || null;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sign(payload: string): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("SESSION_SECRET ou ADMIN_PASSWORD manquant");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64url(new Uint8Array(sig));
}

/** Crée un jeton de session signé : `<exp>.<signature HMAC-SHA256>` */
export async function createSessionToken(): Promise<string> {
  const exp = String(Date.now() + SESSION_MS);
  const payload = `v1.${exp}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [version, expStr, sig] = parts;
    if (version !== "v1") return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;
    const expected = await sign(`v1.${expStr}`);
    return timingSafeEqual(expected, sig);
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const store = await cookies();
    const token = store.get(ADMIN_COOKIE)?.value;
    if (!token) return false;
    return await verifySessionToken(token);
  } catch {
    return false;
  }
}

/** Redirige vers la connexion si l'administrateur n'est pas authentifié. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
}

/** Vérifie le mot de passe de connexion de façon constante en temps. */
export function checkPassword(input: string): "ok" | "invalid" | "unconfigured" {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return "unconfigured";
  return timingSafeEqual(password, input) ? "ok" : "invalid";
}
