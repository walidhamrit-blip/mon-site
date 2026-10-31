"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  extractFazercardsGiftCardCategoryId,
  filterFazercardsGiftCardOffers,
  formatFazercardsUsd,
} from "@/lib/fazercards-giftcard-lookup-core";

interface Category {
  category_id: string;
  name: string;
}

interface Offer {
  card_id: string;
  name: string;
  price_usd: string;
  stock: number;
  min_order_quantity: number;
  max_order_quantity: number;
}

interface LookupResponse {
  ok?: boolean;
  message?: string;
  category?: Category;
  offers?: Offer[];
  categories?: Category[];
  hasMore?: boolean;
  nextCursor?: string | null;
  totalMatched?: number;
  scanned?: number;
}

/**
 * Recherche admin des `card_id` FazerCards — lecture seule, aucun achat.
 *
 * L'exploitant colle un lien du panneau revendeur (ou un `category_id`) :
 * les montants exacts s'affichent avec leur `card_id`, prix fournisseur,
 * stock et quantités autorisées. Une recherche par nom (« Free Fire »)
 * permet aussi de retrouver la catégorie quand le lien n'est pas sous la main.
 */
export function FazercardsCardIdFinder() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerFilter, setOfferFilter] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  const visibleOffers = useMemo(
    () => filterFazercardsGiftCardOffers(offers, offerFilter),
    [offers, offerFilter],
  );

  const request = async (params: URLSearchParams): Promise<LookupResponse> => {
    const res = await fetch(`/api/admin/fazercards/giftcards?${params.toString()}`, {
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as LookupResponse;
    if (!res.ok || !data.ok) {
      throw new Error(data.message ?? "Recherche FazerCards impossible.");
    }
    return data;
  };

  const openCategory = async (categoryId: string) => {
    setBusy(true);
    setError("");
    setCopied(null);
    try {
      const params = new URLSearchParams({ category_id: categoryId });
      const data = await request(params);
      setCategory(data.category ?? { category_id: categoryId, name: "" });
      setOffers(data.offers ?? []);
      setOfferFilter("");
    } catch (err) {
      setCategory(null);
      setOffers([]);
      setError(err instanceof Error ? err.message : "Serveur injoignable.");
    } finally {
      setBusy(false);
    }
  };

  const searchCategories = async (query: string, cursor?: string | null) => {
    setBusy(true);
    setError("");
    setCopied(null);
    try {
      const params = new URLSearchParams({ q: query });
      if (cursor) params.set("cursor", cursor);
      const data = await request(params);
      const found = data.categories ?? [];
      setCategories((previous) => (cursor ? [...previous, ...found] : found));
      setHasMore(Boolean(data.hasMore));
      setNextCursor(data.nextCursor ?? null);
      setLastQuery(query);
      if (!cursor) {
        setCategory(null);
        setOffers([]);
      }
      if (!cursor && found.length === 0) {
        setError("Aucune catégorie trouvée. Essayez « Free Fire » ou collez le lien FazerCards.");
      }
    } catch (err) {
      if (!cursor) {
        setCategories([]);
        setHasMore(false);
        setNextCursor(null);
      }
      setError(err instanceof Error ? err.message : "Serveur injoignable.");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const value = input.trim();
    if (!value) {
      setError("Collez un lien FazerCards, un category_id ou un nom à rechercher.");
      return;
    }
    const categoryId = extractFazercardsGiftCardCategoryId(value);
    if (categoryId) {
      void openCategory(categoryId);
      return;
    }
    void searchCategories(value);
  };

  const copyCardId = async (cardId: string) => {
    try {
      await navigator.clipboard.writeText(cardId);
      setCopied(cardId);
      window.setTimeout(() => setCopied((current) => (current === cardId ? null : current)), 1800);
    } catch {
      setError("Copie automatique impossible : sélectionnez le card_id puis copiez-le manuellement.");
    }
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-[15px] font-black text-stone-900">
            <Search className="h-4 w-4 text-[#B8923F]" />
            Trouver un card_id FazerCards
          </h2>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-stone-600">
            Colle le lien de la catégorie FazerCards (ou son <code>category_id</code>)
            pour afficher les montants exacts et leur <code>card_id</code>. Tu peux
            aussi chercher par nom, par exemple <strong>Free Fire</strong>.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          Lecture seule · aucun achat
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block min-w-[240px] flex-1">
          <span className="text-[10px] font-bold uppercase text-stone-400">
            Lien, category_id ou recherche
          </span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="https://reseller.fazercards.com/panel/giftcard/… ou Free Fire"
            className="h-9 w-full rounded-md border border-stone-300 px-2 text-[13px] outline-none focus:border-[#B8923F]"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-stone-900 px-3 text-[12px] font-bold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Rechercher
        </button>
      </div>

      {error && <p className="mt-2 text-[11.5px] text-orange-700">{error}</p>}

      {categories.length > 0 && !category && (
        <div className="mt-3 rounded-xl border border-stone-200">
          <div className="border-b border-stone-100 bg-stone-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-stone-500">
            Catégories trouvées
          </div>
          <ul className="divide-y divide-stone-100">
            {categories.map((item) => (
              <li key={item.category_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-bold text-stone-900">{item.name || "Sans nom"}</div>
                  <div className="truncate font-mono text-[11px] text-stone-500">{item.category_id}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void openCategory(item.category_id)}
                  disabled={busy}
                  className="shrink-0 rounded-md bg-[#C6A664] px-2.5 py-1.5 text-[11.5px] font-bold text-stone-900 hover:bg-[#B8923F] disabled:opacity-60"
                >
                  Voir les card_id
                </button>
              </li>
            ))}
          </ul>
          {hasMore && nextCursor && (
            <div className="border-t border-stone-100 px-3 py-2">
              <button
                type="button"
                onClick={() => void searchCategories(lastQuery, nextCursor)}
                disabled={busy}
                className="rounded-md border border-stone-300 px-2.5 py-1.5 text-[11.5px] font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
              >
                Charger plus de catégories
              </button>
            </div>
          )}
        </div>
      )}

      {category && (
        <div className="mt-3 rounded-xl border border-stone-200 bg-[#FAF9F6] p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[13px] font-black text-stone-900">
                {category.name || "Catégorie FazerCards"}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-stone-500">
                category_id : {category.category_id}
              </div>
            </div>
            <a
              href={`https://reseller.fazercards.com/panel/giftcard/${category.category_id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-stone-700 hover:bg-stone-50"
            >
              Ouvrir chez FazerCards
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          {offers.length > 0 && (
            <label className="mt-3 block">
              <span className="text-[10px] font-bold uppercase text-stone-400">
                Filtrer les montants
              </span>
              <input
                value={offerFilter}
                onChange={(event) => setOfferFilter(event.target.value)}
                placeholder="210, 21, Global…"
                className="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-[13px] outline-none focus:border-[#B8923F]"
              />
            </label>
          )}

          {offers.length === 0 ? (
            <p className="mt-3 text-[12px] text-stone-600">
              Aucun montant renvoyé pour cette catégorie. Vérifiez le lien ou la
              disponibilité fournisseur.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-stone-200 bg-white">
              <table className="w-full min-w-[720px] text-left text-[12px]">
                <thead className="bg-stone-50 text-[10.5px] uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-3 py-2 font-bold">card_id</th>
                    <th className="px-3 py-2 font-bold">Montant</th>
                    <th className="px-3 py-2 font-bold">Coût fournisseur</th>
                    <th className="px-3 py-2 font-bold">Stock</th>
                    <th className="px-3 py-2 font-bold">Qté min/max</th>
                    <th className="px-3 py-2 font-bold">Copier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {visibleOffers.map((offer) => (
                    <tr key={offer.card_id}>
                      <td className="px-3 py-2 font-mono text-[11.5px] text-stone-800">
                        {offer.card_id}
                      </td>
                      <td className="px-3 py-2 font-bold text-stone-900">{offer.name}</td>
                      <td className="px-3 py-2 text-stone-700">{formatFazercardsUsd(offer.price_usd)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            offer.stock > 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {offer.stock}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-stone-600">
                        {offer.min_order_quantity} / {offer.max_order_quantity}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void copyCardId(offer.card_id)}
                          className="inline-flex items-center gap-1 rounded-md border border-stone-300 px-2 py-1 text-[11.5px] font-bold text-stone-700 hover:bg-stone-50"
                        >
                          {copied === offer.card_id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              Copié
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              Copier
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {visibleOffers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-3 text-center text-stone-500">
                        Aucun montant ne correspond au filtre.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-[11.5px] leading-5 text-stone-600">
            Avant de relier ce <code>card_id</code> à G2G : vérifiez la région
            (Global), le format code et les restrictions. Ne choisissez pas une
            recharge par ID joueur si l’offre G2G doit livrer un code.
          </p>
        </div>
      )}
    </section>
  );
}
