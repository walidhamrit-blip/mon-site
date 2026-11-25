"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { LocalizedLink as Link } from "@/components/localized-link";
import { Price } from "@/components/price";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "./site-provider";
import { EditorialVisual } from "./editorial-visual";
import { DigitalCatalog } from "./digital-catalog";
import { StoreUnavailableNotice } from "./store-status-notice";
import { storeCategories } from "@/lib/site-hierarchy";
import { storeFaqs } from "@/lib/digital-seo";
import { lowestPriceUsd, type DigitalKind, type DigitalProduct } from "@/lib/digital-types";
import {
  applyCatalogFiltersToUrl,
  parseCatalogFilters,
  validPlatformsFromProducts,
  validRegionsFromProducts,
  type CatalogFilters,
  type PriceRangeId,
  type SortId,
} from "@/lib/catalog-filters";

/** Délai avant que la recherche tapée apparaisse dans l'adresse. */
const QUERY_URL_DELAY_MS = 300;

/** All visible shop copy follows the live locale, including maintenance. */
export function DigitalStoreView({ products, degraded, initialFilters, trustBadge }: {
  products: DigitalProduct[];
  degraded: boolean;
  initialFilters: CatalogFilters;
  /** Badge Trustpilot rendu côté serveur (absent tant qu'il n'y a pas d'avis). */
  trustBadge?: ReactNode;
}) {
  const config = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const faqs = storeFaqs(locale);
  // Une seule source de vérité pour les filtres : l'adresse de la page
  // (`?kind=&platform=&region=&price=&sort=&q=`). Les pastilles, le rail, la
  // barre de filtres et la nav SEO partagent cet état ; le serveur l'a déjà
  // lu dans la requête, le client le relit à chaque `popstate`.
  const [kind, setKind] = useState<DigitalKind | "all">(initialFilters.kind);
  const [platform, setPlatform] = useState(initialFilters.platform);
  const [region, setRegion] = useState(initialFilters.region);
  const [price, setPrice] = useState<PriceRangeId>(initialFilters.price);
  const [sort, setSort] = useState<SortId>(initialFilters.sort);
  const [query, setQuery] = useState(initialFilters.q);
  const [syncedInitialFilters, setSyncedInitialFilters] = useState(initialFilters);
  if (syncedInitialFilters !== initialFilters) {
    setSyncedInitialFilters(initialFilters);
    setKind(initialFilters.kind);
    setPlatform(initialFilters.platform);
    setRegion(initialFilters.region);
    setPrice(initialFilters.price);
    setSort(initialFilters.sort);
    setQuery(initialFilters.q);
  }
  const validPlatforms = useMemo(() => validPlatformsFromProducts(products), [products]);
  const validRegions = useMemo(() => validRegionsFromProducts(products), [products]);

  const queryTimer = useRef<number | null>(null);
  const cancelQueryTimer = useCallback(() => {
    if (queryTimer.current != null) {
      window.clearTimeout(queryTimer.current);
      queryTimer.current = null;
    }
  }, []);
  useEffect(() => cancelQueryTimer, [cancelQueryTimer]);

  const writeUrl = useCallback((next: CatalogFilters, mode: "push" | "replace") => {
    const url = applyCatalogFiltersToUrl(new URL(window.location.href), next);
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  // Changement discret (pastille, facette, tri) : une entrée d'historique,
  // pour que le bouton retour restaure l'état précédent. La recherche en
  // cours est incluse telle quelle et son minuteur est annulé.
  const selectKind = useCallback((next: DigitalKind | "all") => {
    setKind(next);
    cancelQueryTimer();
    writeUrl({ kind: next, platform, region, price, sort, q: query }, "push");
  }, [platform, region, price, sort, query, cancelQueryTimer, writeUrl]);
  const selectPlatform = useCallback((next: string) => {
    setPlatform(next);
    cancelQueryTimer();
    writeUrl({ kind, platform: next, region, price, sort, q: query }, "push");
  }, [kind, region, price, sort, query, cancelQueryTimer, writeUrl]);
  const selectRegion = useCallback((next: string) => {
    setRegion(next);
    cancelQueryTimer();
    writeUrl({ kind, platform, region: next, price, sort, q: query }, "push");
  }, [kind, platform, price, sort, query, cancelQueryTimer, writeUrl]);
  const selectPrice = useCallback((next: PriceRangeId) => {
    setPrice(next);
    cancelQueryTimer();
    writeUrl({ kind, platform, region, price: next, sort, q: query }, "push");
  }, [kind, platform, region, sort, query, cancelQueryTimer, writeUrl]);
  const selectSort = useCallback((next: SortId) => {
    setSort(next);
    cancelQueryTimer();
    writeUrl({ kind, platform, region, price, sort: next, q: query }, "push");
  }, [kind, platform, region, price, query, cancelQueryTimer, writeUrl]);

  // Recherche : l'état suit la frappe immédiatement, l'adresse suit après
  // ~300 ms sans créer d'entrée d'historique (sinon chaque lettre serait un
  // pas en arrière).
  const selectQuery = useCallback((next: string) => {
    setQuery(next);
    cancelQueryTimer();
    queryTimer.current = window.setTimeout(() => {
      queryTimer.current = null;
      writeUrl({ kind, platform, region, price, sort, q: next }, "replace");
    }, QUERY_URL_DELAY_MS);
  }, [kind, platform, region, price, sort, cancelQueryTimer, writeUrl]);

  const resetFilters = useCallback(() => {
    setKind("all");
    setPlatform("all");
    setRegion("all");
    setPrice("all");
    setQuery("");
    cancelQueryTimer();
    writeUrl({ kind: "all", platform: "all", region: "all", price: "all", sort, q: "" }, "push");
  }, [sort, cancelQueryTimer, writeUrl]);

  useEffect(() => {
    const onPopState = () => {
      cancelQueryTimer();
      const parsed = parseCatalogFilters(new URL(window.location.href).searchParams, {
        platforms: validPlatforms,
        regions: validRegions,
      });
      setKind(parsed.kind);
      setPlatform(parsed.platform);
      setRegion(parsed.region);
      setPrice(parsed.price);
      setSort(parsed.sort);
      setQuery(parsed.q);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [validPlatforms, validRegions, cancelQueryTimer]);
  const prices = products.map(lowestPriceUsd).filter((price): price is number => price != null);
  const cheapest = prices.length ? Math.min(...prices) : null;
  return <>
      {/*
        En-tête de rayon — volontairement compact : la vitrine s'organise
        comme celle du fournisseur (barre de filtres collante + rail de
        facettes + grille), donc le contenu marchand doit commencer dans le
        premier écran. Le titre et l'accroche restent complets pour le SEO.
      */}
      <section className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--secondary)]/30">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 start-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full opacity-20 blur-3xl rtl:translate-x-1/2"
          style={{ background: "var(--accent)" }}
        />
        <div className="site-container relative px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 pb-5 pt-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-[52rem]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-[11px] font-black shadow-[var(--shadow-xs)]">
                <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
                <span className="text-[var(--accent)]">
                  {ar
                    ? "متجر رقمي عالمي — تسليم فوري"
                    : "Worldwide digital store"}
                </span>
              </div>

              <h1 className="mt-3 max-w-[28ch] text-[clamp(1.6rem,1.1rem+2vw,2.5rem)] font-black leading-[1.08] tracking-[-0.03em] text-balance">
                {ar ? "أكواد ألعاب وبرامج وبطاقات هدايا" : "Game keys, gift cards & digital codes"}
                <span className="text-[var(--accent)]"> {ar ? "— بأسعار واضحة" : "— made simple"}</span>
              </h1>

              <p className="mt-2.5 max-w-[68ch] text-[14px] leading-7 text-[var(--muted-foreground)]">
                {ar
                  ? "بطاقات هدايا Steam وPlayStation وXbox وNintendo وRoblox وGoogle Play وAmazon، أكواد ألعاب وبرامج (Minecraft، Red Dead Redemption 2) وشحن العملات داخل الألعاب. تحقّق من منطقة كل بطاقة قبل الطلب — التسليم الرقمي يصلك على بريدك الإلكتروني بعد تأكيد الدفع."
                  : "Steam, PlayStation, Xbox, Nintendo, Roblox, Google Play and Amazon gift cards, game keys and software (Minecraft, Red Dead Redemption 2), plus in-game top-ups. Check each card’s region before ordering — digital delivery is sent to your email after payment confirmation."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
              <span className="chip chip-accent">
                {degraded
                  ? ar
                    ? "صيانة مؤقتة"
                    : "Temporary maintenance"
                  : ar
                    ? `${products.length} منتجاً`
                    : `${products.length} products`}
              </span>
              {trustBadge}
              <span className="chip">
                {ar ? "تسليم رقمي فوري" : "Digital delivery"}
              </span>
              {/*
                Pendant une panne, le prix « à partir de » proviendrait des
                fiches de démonstration : on n'annonce pas un tarif pour des
                produits qui ne peuvent pas être commandés.
              */}
              {!degraded && (
                <span className="chip">
                  {/* Prix « à partir de » dans la devise choisie par le visiteur. */}
                  {cheapest != null ? (
                    <>
                      {ar ? "تبدأ من" : "From"} <Price usd={cheapest} />
                    </>
                  ) : ar ? (
                    "أسعار بالدولار"
                  ) : (
                    "USD pricing"
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="site-container px-4 py-6 sm:px-6 lg:px-8"><EditorialVisual kind="store" /></div>
      {degraded && (
        <StoreUnavailableNotice ar={ar} phone={config.phone} />
      )}

      {/*
        Pendant une panne de base, la grille n'est pas affichée : elle
        contiendrait les fiches de démonstration, présentées comme le
        catalogue réel — c'est exactement ce qui a trompé les visiteurs (et
        le sitemap) le 29/10/2026.
      */}
      <nav aria-label={ar ? "فئات المتجر" : "Store categories"} className="site-container flex flex-wrap gap-2 px-4 py-6 sm:px-6 lg:px-8">
        {storeCategories.map((category) => <Link key={category.kind} href={category.kind === "all" ? "/codes" : `/codes?kind=${category.kind}`} onClick={(event) => {
          // Ctrl/Cmd/Maj + clic ou clic du milieu : ouverture normale dans un
          // nouvel onglet. Seul le clic simple filtre sur place.
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          selectKind(category.kind);
        }} aria-current={kind === category.kind ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-bold transition-colors ${kind === category.kind ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]" : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]"}`}>{ar ? category.ar : category.en}</Link>)}
      </nav>
      {!degraded && (
        <DigitalCatalog
          products={products}
          kind={kind}
          onKindChange={selectKind}
          query={query}
          onQueryChange={selectQuery}
          platform={platform}
          onPlatformChange={selectPlatform}
          region={region}
          onRegionChange={selectRegion}
          priceRange={price}
          onPriceRangeChange={selectPrice}
          sort={sort}
          onSortChange={selectSort}
          onResetFilters={resetFilters}
        />
      )}

      {/*
        Contenu de rayon : ces sections répondent aux questions réellement
        posées avant l'achat (région, livraison, authenticité, paiement).
        Elles rendent `/codes` utile pour l'internaute ET pour Google — un
        simple mur de cartes sans texte se classe mal sur les requêtes
        « acheter une carte Steam en Libye ».
      */}
      <section className="section-tight border-t border-[var(--border)]">
        <div className="site-container grid gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:px-8">
          <div>
            <h2 className="text-2xl font-black">
              {ar ? "كيف يعمل الشراء والتسليم؟" : "How buying and delivery work"}
            </h2>
            <ol className="mt-5 space-y-4">
              {(ar
                ? [
                    "اختر المنتج ثم المبلغ والمنطقة المناسبة لحسابك.",
                    "ادفع بالدولار أو USDT عبر NOWPayments — دون حساب على المتجر.",
                    "يصلك الكود على بريدك الإلكتروني بعد تأكيد الدفع مباشرة.",
                    "استخدم الكود في المتجر أو اللعبة الرسمية، واحتفظ برسالة الطلب.",
                  ]
                : [
                    "Choose the product, amount and the region that matches your account.",
                    "Pay in USD or USDT via NOWPayments — no store account needed.",
                    "Your code arrives by email right after payment confirmation.",
                    "Redeem it in the official store or game, and keep the order email.",
                  ]
              ).map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-[14px] leading-7">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[12px] font-black text-[var(--accent)]">
                    {index + 1}
                  </span>
                  <span className="opacity-85">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4 text-[13px] leading-6 text-[var(--muted-foreground)]">
              {ar
                ? "الأكواد تُشترى من الموزّع الرسمي عند الطلب. الأسعار بالدولار الأمريكي، و1 دولار = 1 USDT. البطاقات الإقليمية لا تُسترجع بعد التسليم — تحقّق من منطقة حسابك أولاً."
                : "Codes are purchased from the official distributor on demand. Prices are in USD, with 1 USD = 1 USDT. Region-locked cards cannot be refunded after delivery — check your account region first."}
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black">
              {ar ? "أسئلة شائعة قبل الشراء" : "Questions before you buy"}
            </h2>
            <div className="mt-5 divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
              {faqs.map((faq) => (
                <details key={faq.q} className="group p-4">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[14px] font-black leading-6 marker:hidden [&::-webkit-details-marker]:hidden">
                    {faq.q}
                    {/* Repère visuel « dépliable » (le marqueur natif est masqué). */}
                    <ChevronDown aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 opacity-60 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-[13px] leading-7 text-[var(--muted-foreground)]">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
            <p className="mt-4 text-[12.5px] leading-6 text-[var(--muted-foreground)]">
              {ar ? "لم تجد إجابتك؟ " : "Still unsure? "}
              <Link href="/contact" className="font-bold text-[var(--accent)] underline-offset-4 hover:underline">
                {ar ? "تواصل معنا على واتساب" : "Talk to us on WhatsApp"}
              </Link>
            </p>
          </div>
        </div>
      </section>
  </>;
}
