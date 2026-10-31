import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  fazercardsConfigured,
  fazercardsErrorMessage,
  fazercardsGiftCardCards,
  fazercardsGiftCards,
  isFazercardsError,
} from "@/lib/fazercards";
import {
  extractFazercardsGiftCardCategoryId,
  filterFazercardsGiftCardCategories,
  type FazercardsGiftCardCategoryLite,
} from "@/lib/fazercards-giftcard-lookup-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Recherche admin bornée : quelques pages de catégories au maximum. */
export const maxDuration = 30;

const CATEGORY_PAGE_LIMIT = 100;
const MAX_CATEGORY_PAGES = 5;
const MAX_CATEGORY_RESULTS = 100;

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Recherche en lecture seule des cartes cadeaux FazerCards — réservé admin.
 *
 * - `?category_id=<uuid|lien>` : liste les montants (`card_id`) de la catégorie.
 * - `?q=<texte>` : cherche des catégories par nom (pagination bornée).
 *
 * Aucun achat, aucune commande, aucune clé API ni donnée de compte renvoyée.
 */
export async function GET(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return noStoreJson({ ok: false, error: "unauthorized" }, 401);
  }

  if (!fazercardsConfigured()) {
    return noStoreJson(
      {
        ok: false,
        error: "not_configured",
        message:
          "FAZERCARDS_API_KEY absente : ajoutez-la côté serveur puis redéployez.",
      },
      503,
    );
  }

  const url = new URL(req.url);
  const rawCategory =
    url.searchParams.get("category_id") ?? url.searchParams.get("category") ?? "";
  const categoryId = extractFazercardsGiftCardCategoryId(rawCategory);

  if (rawCategory.trim() && !categoryId) {
    return noStoreJson(
      {
        ok: false,
        error: "invalid_category",
        message:
          "Identifiant de catégorie invalide : collez un UUID ou un lien FazerCards contenant cet UUID.",
      },
      400,
    );
  }

  try {
    if (categoryId) {
      const cards = await fazercardsGiftCardCards(categoryId);
      // Ne renvoyer que les champs utiles à l'admin : aucun champ fournisseur
      // inattendu ne doit sortir tel quel vers le navigateur.
      const offers = (cards.offers ?? []).map((offer) => ({
        card_id: offer.card_id,
        name: offer.name,
        price_usd: offer.price_usd,
        stock: offer.stock,
        min_order_quantity: offer.min_order_quantity,
        max_order_quantity: offer.max_order_quantity,
      }));
      return noStoreJson({
        ok: true,
        category: {
          category_id: cards.category_id || categoryId,
          name: cards.name || "",
        },
        offers,
      });
    }

    const query = (url.searchParams.get("q") ?? "").trim();
    let cursor = url.searchParams.get("cursor");
    const categories: FazercardsGiftCardCategoryLite[] = [];
    let scanned = 0;
    let hasMore = false;
    let nextCursor: string | null = null;

    for (let page = 0; page < MAX_CATEGORY_PAGES; page += 1) {
      const list = await fazercardsGiftCards(CATEGORY_PAGE_LIMIT, cursor);
      const items = list.items ?? [];
      scanned += items.length;
      categories.push(...items);
      nextCursor = list.meta?.next_cursor ?? null;
      hasMore = Boolean(list.meta?.has_more && nextCursor);
      if (!hasMore) break;
      cursor = nextCursor;
    }

    const matched = filterFazercardsGiftCardCategories(categories, query);
    return noStoreJson({
      ok: true,
      categories: matched.slice(0, MAX_CATEGORY_RESULTS),
      totalMatched: matched.length,
      scanned,
      hasMore,
      nextCursor: hasMore ? nextCursor : null,
    });
  } catch (error) {
    console.error(
      "[admin][fazercards][giftcards] recherche impossible :",
      error instanceof Error ? error.message : error,
    );
    return noStoreJson(
      {
        ok: false,
        error: "supplier_error",
        message: fazercardsErrorMessage(error),
        status: isFazercardsError(error) ? error.status : null,
      },
      502,
    );
  }
}
