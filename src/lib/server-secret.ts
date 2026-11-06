// Secret serveur-à-serveur — logique PURE, sans dépendance Next.
//
// Utilisé par `/api/health` (diagnostic complet) et réutilisable par toute
// route de service qui doit accepter un appelant automatisé (cron, script de
// supervision) sans session navigateur.
//
// Isolé dans son propre module pour deux raisons :
//  - il est testable par `node --test` (aucun import Next) ;
//  - la comparaison est à temps constant, ce qui mérite d'être centralisé
//    plutôt que recopié dans chaque route.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Vrai si la requête présente `CRON_SECRET` — en-tête `Authorization: Bearer`
 * ou paramètre `?key=` (pratique pour ouvrir le diagnostic au navigateur).
 *
 * Sans secret configuré, aucune voie serveur-à-serveur n'est ouverte : seul
 * un administrateur authentifié obtient alors les informations détaillées.
 */
export function hasServerSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = req.headers.get("authorization")?.trim() ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";

  let queryKey = "";
  try {
    queryKey = new URL(req.url).searchParams.get("key")?.trim() ?? "";
  } catch {
    /* requête sans URL absolue : on ignore le paramètre */
  }

  return (
    (bearer.length > 0 && timingSafeEqual(bearer, secret)) ||
    (queryKey.length > 0 && timingSafeEqual(queryKey, secret))
  );
}
