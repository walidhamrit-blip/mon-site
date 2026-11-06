import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/session-token";

// La signature et la vérification du jeton vivent dans
// `src/lib/session-token.ts` (aucune dépendance Next → testable par
// `node --test`). Ré-export : les appelants existants ne changent pas.
export {
  createSessionToken,
  verifySessionToken,
  checkPassword,
  sessionSecret,
} from "@/lib/session-token";

export const ADMIN_COOKIE = "nukhba_admin_session";

/**
 * En production, le cookie de session est préfixé `__Host-` (cf. actions.ts) :
 * ce préfixe empêche un sous-domaine compromis d'écraser le cookie de
 * l'admin et impose `Path=/` + `Secure`. En développement local (HTTP),
 * le préfixe `__Host-` casserait l'authentification, donc on lit les
 * deux noms.
 */
function cookieCandidates(): string[] {
  return [`__Host-${ADMIN_COOKIE}`, ADMIN_COOKIE];
}

export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const store = await cookies();
    for (const name of cookieCandidates()) {
      const token = store.get(name)?.value;
      if (!token) continue;
      if (await verifySessionToken(token)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Redirige vers la connexion si l'administrateur n'est pas authentifié. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
}
