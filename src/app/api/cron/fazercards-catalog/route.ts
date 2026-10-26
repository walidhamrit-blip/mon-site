import { NextResponse } from "next/server";
import { getFazercardsCatalog } from "@/lib/fazercards-catalog";
import { fazercardsConfigured } from "@/lib/fazercards";

/**
 * Rafraîchissement du catalogue FazerCards (cron Vercel).
 *
 * Pourquoi une route dédiée : une synchronisation complète enchaîne un
 * appel HTTP par catégorie (~123 aujourd'hui). Dans le rendu d'une page,
 * cela dépasse le temps d'exécution d'une fonction serverless — la page
 * expirait et retombait silencieusement sur le catalogue historique, et les
 * fiches produit renvoyaient une erreur 500.
 *
 * Ici, l'exécution est longue mais bornée (`maxDuration`), et le résultat
 * est persisté en base : toutes les instances lisent ensuite la même copie
 * en une requête.
 *
 * Déclenchée par `vercel.json` (toutes les 10 minutes) et protégée par
 * `CRON_SECRET` si la variable est définie.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Une synchro complète peut prendre plusieurs dizaines de secondes. */
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  // Sans secret configuré, la route reste utilisable (Vercel cron envoie
  // son propre en-tête d'authentification) mais ne fait rien de sensible :
  // elle ne renvoie ni prix fournisseur ni secret.
  if (!secret) return true;
  const header = req.headers.get("authorization")?.trim();
  if (header === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!fazercardsConfigured()) {
    return NextResponse.json(
      { ok: false, error: "supplier_not_configured" },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  try {
    const catalog = await getFazercardsCatalog({ force: true });
    const durationMs = Date.now() - startedAt;
    console.info(
      `[fazercards][cron] ${catalog.products.length} produits synchronisés en ${durationMs} ms`,
    );
    return NextResponse.json({
      ok: true,
      products: catalog.products.length,
      fetchedAt: catalog.fetchedAt,
      durationMs,
      // Les erreurs par catégorie sont utiles au diagnostic mais restent
      // bornées : un fournisseur en panne ne doit pas produire une réponse
      // de plusieurs mégaoctets.
      errors: catalog.errors.slice(0, 10),
    });
  } catch (error) {
    console.error(
      "[fazercards][cron] synchronisation impossible :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "sync_failed" },
      { status: 502 },
    );
  }
}
