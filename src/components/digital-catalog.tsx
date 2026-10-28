"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Gamepad2,
  Gift,
  Globe2,
  KeyRound,
  Layers,
  LayoutGrid,
  LifeBuoy,
  Package,
  Search,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { Price } from "@/components/price";
import { RegionalAlert } from "@/components/regional-alert";
import { whatsappLink } from "@/lib/utils";
import {
  DIGITAL_KIND_LABELS,
  denominationLabel,
  lowestPriceUsd,
  regionLabel,
  type DigitalKind,
  type DigitalProduct,
} from "@/lib/digital-types";
import { productVisual, productVisualFit } from "@/lib/game-covers";

/* ------------------------------- Constantes ------------------------------- */

/** Ordre d'affichage des familles dans le rail (comme une boutique). */
const FAMILY_ORDER: DigitalKind[] = [
  "software_key",
  "gift_card",
  "game_topup",
  "subscription_code",
];

/** Icône de chaque famille (rail + pastille des cartes). */
const FAMILY_ICONS: Record<DigitalKind, typeof KeyRound> = {
  software_key: KeyRound,
  gift_card: Gift,
  game_topup: Zap,
  subscription_code: Sparkles,
};

/** Tranches de prix (en USD, devise de facturation) et leurs libellés. */
const PRICE_RANGES = [
  { id: "all", min: 0, max: Infinity, ar: "كل الأسعار", en: "Any price" },
  { id: "u10", min: 0, max: 10, ar: "أقل من 10 $", en: "Under $10" },
  { id: "10-30", min: 10, max: 30, ar: "10 – 30 $", en: "$10 – $30" },
  { id: "30-100", min: 30, max: 100, ar: "30 – 100 $", en: "$30 – $100" },
  { id: "100+", min: 100, max: Infinity, ar: "أكثر من 100 $", en: "$100 & up" },
] as const;

type PriceRangeId = (typeof PRICE_RANGES)[number]["id"];

/** Libellé d'une tranche de prix dans la langue active. */
function priceRangeLabel(id: PriceRangeId, ar: boolean): string {
  const range = PRICE_RANGES.find((item) => item.id === id) ?? PRICE_RANGES[0];
  return ar ? range.ar : range.en;
}
type SortId = "featured" | "price-asc" | "price-desc" | "name";

/** Prix d'entrée d'une fiche (0 si aucun montant : la fiche passe en dernier). */
function entryPrice(product: DigitalProduct): number {
  return lowestPriceUsd(product) ?? Number.POSITIVE_INFINITY;
}

/** Initiales d'une fiche pour le visuel de repli (« 7 Days to Die » → 7D). */
function initialsOf(product: DigitalProduct): string {
  const source = (product.titleEn || product.platform || product.slug)
    .replace(/^.*?—\s*/, "")
    .trim();
  const words = source.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 0) return "••";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/* -------------------------------- Composant ------------------------------- */

/**
 * Vitrine du catalogue digital — organisation reprise de la boutique
 * FazerCards :
 *
 *  1. une **barre de filtres horizontale** collante (recherche, familles,
 *     tri) toujours visible pendant le défilement ;
 *  2. un **rail vertical** de facettes (familles, plateformes, régions,
 *     prix) placé à GAUCHE en anglais et à DROITE en arabe — il est écrit
 *     en propriétés logiques (`start`/`end`), donc le sens du document
 *     décide seul de son côté ;
 *  3. une **grille de 4 cartes par ligne** en grand écran, chaque carte
 *     affichant la jaquette du jeu, son titre, sa plateforme et sa région.
 *
 * Les familles couvrent déjà les codes de logiciels (`software_key`) : quand
 * le fournisseur en publiera, ils apparaîtront dans « Codes logiciels » sans
 * toucher au code de cette page.
 */
export function DigitalCatalog({ products }: { products: DigitalProduct[] }) {
  const siteConfig = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<DigitalKind | "all">("all");
  const [platform, setPlatform] = useState("all");
  const [region, setRegion] = useState("all");
  const [priceRange, setPriceRange] = useState<PriceRangeId>("all");
  const [sort, setSort] = useState<SortId>("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* ----------------------------- Facettes ----------------------------- */

  const families = useMemo(() => {
    const counts = new Map<DigitalKind, number>();
    for (const product of products) {
      counts.set(product.kind, (counts.get(product.kind) ?? 0) + 1);
    }
    return FAMILY_ORDER.filter((item) => counts.has(item)).map((item) => ({
      kind: item,
      count: counts.get(item) ?? 0,
    }));
  }, [products]);

  const platforms = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      const value = (product.platform ?? "").trim();
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
  }, [products]);

  const regions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      const seen = new Set(
        [...product.regions, ...product.denominations.map((item) => item.region)]
          .map((item) => (item ?? "").trim().toUpperCase())
          .filter(Boolean),
      );
      for (const value of seen) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
  }, [products]);

  const priceCounts = useMemo(() => {
    const counts = new Map<PriceRangeId, number>();
    for (const range of PRICE_RANGES) counts.set(range.id, 0);
    for (const product of products) {
      const price = lowestPriceUsd(product);
      if (price == null) continue;
      for (const range of PRICE_RANGES) {
        if (range.id === "all") {
          counts.set("all", (counts.get("all") ?? 0) + 1);
        } else if (price >= range.min && price < range.max) {
          counts.set(range.id, (counts.get(range.id) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [products]);

  /* ----------------------------- Filtrage ----------------------------- */

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const range = PRICE_RANGES.find((item) => item.id === priceRange) ?? PRICE_RANGES[0];

    const rows = products.filter((product) => {
      if (kind !== "all" && product.kind !== kind) return false;
      if (platform !== "all" && product.platform !== platform) return false;
      if (region !== "all") {
        const zones = [...product.regions, ...product.denominations.map((item) => item.region)]
          .map((item) => (item ?? "").toUpperCase());
        if (!zones.includes(region)) return false;
      }
      if (range.id !== "all") {
        const price = lowestPriceUsd(product);
        if (price == null || price < range.min || price >= range.max) return false;
      }
      if (!needle) return true;
      const haystack = [
        product.titleAr,
        product.titleEn,
        product.descriptionAr,
        product.descriptionEn,
        product.platform,
        product.slug,
        ...product.featuresAr,
        ...product.featuresEn,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    if (sort === "price-asc") {
      rows.sort((a, b) => entryPrice(a) - entryPrice(b));
    } else if (sort === "price-desc") {
      rows.sort((a, b) => entryPrice(b) - entryPrice(a));
    } else if (sort === "name") {
      rows.sort((a, b) =>
        (ar ? a.titleAr : a.titleEn).localeCompare(ar ? b.titleAr : b.titleEn),
      );
    }
    return rows;
  }, [products, query, kind, platform, region, priceRange, sort, ar]);

  const activeFilters =
    (kind !== "all" ? 1 : 0) +
    (platform !== "all" ? 1 : 0) +
    (region !== "all" ? 1 : 0) +
    (priceRange !== "all" ? 1 : 0) +
    (query.trim() ? 1 : 0);

  const resetFilters = () => {
    setQuery("");
    setKind("all");
    setPlatform("all");
    setRegion("all");
    setPriceRange("all");
  };

  const requestMessage = ar
    ? "مرحبا نخبة 👋 أبحث عن كود أو بطاقة هدايا غير مدرجة في الكتالوج."
    : "Hello Nukhba 👋 I'm looking for a code or gift card that isn't listed.";

  /* ------------------------------- Rendu ------------------------------- */

  const railSections = (
    <>
      {/* Familles */}
      <div className="border-b border-[var(--border)]/70 px-4 py-4">
        <p className="mb-2.5 text-[10.5px] font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          {ar ? "الأقسام" : "Sections"}
        </p>
        <ul className="space-y-0.5">
          <li>
            <RailButton
              active={kind === "all"}
              onClick={() => setKind("all")}
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
              label={ar ? "كل المنتجات" : "All products"}
              count={products.length}
            />
          </li>
          {families.map(({ kind: family, count }) => {
            const Icon = FAMILY_ICONS[family];
            return (
              <li key={family}>
                <RailButton
                  active={kind === family}
                  onClick={() => setKind(kind === family ? "all" : family)}
                  icon={<Icon className="h-3.5 w-3.5" />}
                  label={
                    ar ? DIGITAL_KIND_LABELS[family].ar : DIGITAL_KIND_LABELS[family].en
                  }
                  count={count}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {/* Plateformes */}
      {platforms.length > 1 && (
        <div className="border-b border-[var(--border)]/70 px-4 py-4">
          <p className="mb-2.5 text-[10.5px] font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            {ar ? "المنصات" : "Platforms"}
          </p>
          <ul className="space-y-0.5 lg:max-h-[13rem] lg:overflow-y-auto lg:pe-1">
            <li>
              <RailButton
                active={platform === "all"}
                onClick={() => setPlatform("all")}
                icon={<Gamepad2 className="h-3.5 w-3.5" />}
                label={ar ? "كل المنصات" : "All platforms"}
                count={products.length}
              />
            </li>
            {platforms.map((item) => (
              <li key={item.value}>
                <RailButton
                  active={platform === item.value}
                  onClick={() =>
                    setPlatform(platform === item.value ? "all" : item.value)
                  }
                  icon={<Gamepad2 className="h-3.5 w-3.5" />}
                  label={item.value}
                  count={item.count}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Régions */}
      {regions.length > 1 && (
        <div className="border-b border-[var(--border)]/70 px-4 py-4">
          <p className="mb-2.5 text-[10.5px] font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            {ar ? "المناطق" : "Regions"}
          </p>
          <ul className="space-y-0.5 lg:max-h-[13rem] lg:overflow-y-auto lg:pe-1">
            <li>
              <RailButton
                active={region === "all"}
                onClick={() => setRegion("all")}
                icon={<Globe2 className="h-3.5 w-3.5" />}
                label={ar ? "كل المناطق" : "All regions"}
                count={products.length}
              />
            </li>
            {regions.map((item) => (
              <li key={item.value}>
                <RailButton
                  active={region === item.value}
                  onClick={() => setRegion(region === item.value ? "all" : item.value)}
                  icon={<Globe2 className="h-3.5 w-3.5" />}
                  label={regionLabel(item.value, locale)}
                  count={item.count}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prix */}
      <div className="border-b border-[var(--border)]/70 px-4 py-4">
        <p className="mb-2.5 text-[10.5px] font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          {ar ? "السعر" : "Price"}
        </p>
        <ul className="space-y-0.5">
          {PRICE_RANGES.map((range) => (
            <li key={range.id}>
              <RailButton
                active={priceRange === range.id}
                onClick={() => setPriceRange(range.id)}
                icon={<Wallet className="h-3.5 w-3.5" />}
                label={priceRangeLabel(range.id, ar)}
                count={priceCounts.get(range.id) ?? 0}
              />
            </li>
          ))}
        </ul>
      </div>

      {/* Carte d'aide */}
      <div className="px-4 py-4">
        <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--secondary)]/50 p-3.5">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-black">
            <LifeBuoy className="h-3.5 w-3.5 text-[var(--accent)]" />
            {ar ? "لعبة غير موجودة؟" : "Game not listed?"}
          </p>
          <p className="mt-1.5 text-[11.5px] leading-5 text-[var(--muted-foreground)]">
            {ar
              ? "نوفّر أكواد معظم الألعاب عند الطلب — أرسل اسم اللعبة والمنطقة."
              : "We source most games on request — send us the game and the region."}
          </p>
          <a
            href={whatsappLink(siteConfig.whatsapp, requestMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 text-[11.5px] font-black text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            {ar ? "اطلبها عبر واتساب" : "Request on WhatsApp"}
          </a>
        </div>
      </div>
    </>
  );

  return (
    <div>
      {/* ───────────────── Barre de filtres (collante) ───────────────── */}
      <div className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/92 backdrop-blur-md">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 py-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-40" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  ar ? "ابحث عن لعبة أو كود أو بطاقة…" : "Search a game, a code, a card…"
                }
                aria-label={ar ? "بحث في الكتالوج" : "Search the catalogue"}
                className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--card)] pe-10 ps-10 text-[13.5px] outline-none transition-colors focus:border-[var(--accent)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={ar ? "مسح البحث" : "Clear search"}
                  className="absolute end-3 top-1/2 grid h-5 w-5 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Tri */}
            <div className="relative hidden sm:block">
              <ArrowUpDown className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortId)}
                aria-label={ar ? "ترتيب" : "Sort"}
                className="h-11 cursor-pointer appearance-none rounded-full border border-[var(--border)] bg-[var(--card)] pe-8 ps-9 text-[12.5px] font-bold outline-none transition-colors focus:border-[var(--accent)]"
              >
                <option value="featured">{ar ? "المميّزة" : "Featured"}</option>
                <option value="price-asc">{ar ? "السعر: الأقل أولاً" : "Price: low to high"}</option>
                <option value="price-desc">{ar ? "السعر: الأعلى أولاً" : "Price: high to low"}</option>
                <option value="name">{ar ? "الاسم (أ-ي)" : "Name (A–Z)"}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" />
            </div>

            {/* Filtres (mobile) */}
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[12.5px] font-bold lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {ar ? "فلترة" : "Filters"}
              {activeFilters > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1 text-[10.5px] font-black text-[var(--accent-foreground)]">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>

          {/* Familles en pastilles (défilement horizontal sur mobile) */}
          {families.length > 0 && (
            <div className="scroll-x -mx-4 flex gap-2 px-4 pb-3 sm:mx-0 sm:px-0">
              <FamilyChip
                active={kind === "all"}
                onClick={() => setKind("all")}
                label={ar ? "كل المنتجات" : "All products"}
                count={products.length}
              />
              {families.map(({ kind: family, count }) => {
                const Icon = FAMILY_ICONS[family];
                return (
                  <FamilyChip
                    key={family}
                    active={kind === family}
                    onClick={() => setKind(kind === family ? "all" : family)}
                    icon={<Icon className="h-3.5 w-3.5" />}
                    label={
                      ar ? DIGITAL_KIND_LABELS[family].ar : DIGITAL_KIND_LABELS[family].en
                    }
                    count={count}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────── Rail + grille ────────────────────── */}
      <div className="site-container px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start lg:gap-7">
          {/* Rail vertical : premier dans le DOM → gauche en LTR, droite en RTL */}
          <aside
            className={`${
              filtersOpen ? "block" : "hidden"
            } mb-5 lg:sticky lg:top-[5.25rem] lg:mb-0 lg:block`}
          >
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-xs)]">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)]/70 px-4 py-3">
                <p className="inline-flex items-center gap-1.5 text-[12.5px] font-black">
                  <Store className="h-4 w-4 text-[var(--accent)]" />
                  {ar ? "تصفية النتائج" : "Filter the store"}
                </p>
                {activeFilters > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="cursor-pointer text-[11px] font-bold text-[var(--accent)] hover:underline"
                  >
                    {ar ? "إعادة تعيين" : "Reset"}
                  </button>
                )}
              </div>
              <div className="max-h-[60vh] overflow-y-auto lg:max-h-[calc(100vh-13rem)]">
                {railSections}
              </div>
            </div>
          </aside>

          {/* Résultats */}
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-[12.5px] font-bold text-[var(--muted-foreground)]">
                {ar
                  ? `${filtered.length} منتج من ${products.length}`
                  : `${filtered.length} of ${products.length} products`}
              </p>

              {/* Filtres actifs, retirables un par un */}
              {kind !== "all" && (
                <ActiveChip
                  label={
                    ar ? DIGITAL_KIND_LABELS[kind].ar : DIGITAL_KIND_LABELS[kind].en
                  }
                  onRemove={() => setKind("all")}
                />
              )}
              {platform !== "all" && (
                <ActiveChip label={platform} onRemove={() => setPlatform("all")} />
              )}
              {region !== "all" && (
                <ActiveChip
                  label={regionLabel(region, locale)}
                  onRemove={() => setRegion("all")}
                />
              )}
              {priceRange !== "all" && (
                <ActiveChip
                  label={priceRangeLabel(priceRange, ar)}
                  onRemove={() => setPriceRange("all")}
                />
              )}
              {activeFilters > 1 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="cursor-pointer text-[11.5px] font-bold text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
                >
                  {ar ? "مسح الكل" : "Clear all"}
                </button>
              )}

              {/* Tri (mobile) */}
              <div className="relative ms-auto sm:hidden">
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortId)}
                  aria-label={ar ? "ترتيب" : "Sort"}
                  className="h-9 cursor-pointer rounded-full border border-[var(--border)] bg-[var(--card)] px-3 text-[12px] font-bold outline-none"
                >
                  <option value="featured">{ar ? "المميّزة" : "Featured"}</option>
                  <option value="price-asc">{ar ? "الأقل سعراً" : "Price ↑"}</option>
                  <option value="price-desc">{ar ? "الأعلى سعراً" : "Price ↓"}</option>
                  <option value="name">{ar ? "الاسم" : "Name"}</option>
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="card-surface p-10 text-center sm:p-14">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
                  <Package className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-black">
                  {ar ? "لا يوجد منتج مطابق" : "No matching product"}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
                  {ar
                    ? "جرّب تعديل الفلاتر، أو اطلب اللعبة مباشرة وسنجهّزها لك."
                    : "Try adjusting the filters, or ask us and we will source it for you."}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] px-5 text-sm font-bold transition-colors hover:border-[var(--accent)]"
                  >
                    {ar ? "مسح الفلاتر" : "Clear filters"}
                  </button>
                  <a
                    href={whatsappLink(siteConfig.whatsapp, requestMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-black text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
                  >
                    {ar ? "اطلبها عبر واتساب" : "Request it on WhatsApp"}
                  </a>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((product, index) => {
                  const visual = productVisual(product);
                  const visualFit = productVisualFit(product);
                  const from = lowestPriceUsd(product);
                  const KindIcon = FAMILY_ICONS[product.kind] ?? Tag;
                  const primaryRegion = product.regions[0] ?? "GLOBAL";
                  const denominations = product.denominations
                    .filter((denomination) => denomination.available)
                    .slice(0, 4);

                  return (
                    <motion.article
                      key={product.id}
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-30px" }}
                      transition={{
                        duration: 0.32,
                        delay: Math.min(index * 0.035, 0.21),
                      }}
                      className="group flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-xs)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_55%,var(--border))] hover:shadow-[var(--shadow-md)]"
                    >
                      {/* Jaquette */}
                      <Link
                        href={`/codes/${product.slug}`}
                        className="relative block aspect-[2/3] overflow-hidden bg-[#0b1220]"
                        aria-label={ar ? product.titleAr : product.titleEn}
                      >
                        {visual ? (
                          visualFit === "contain" ? (
                            /* Visuel de marque enregistré en admin (souvent
                               16:9) : contenu sur son propre fond flou, pour
                               ne jamais rogner le logo. */
                            <>
                              <Image
                                src={visual}
                                alt=""
                                aria-hidden="true"
                                fill
                                sizes="(max-width: 640px) 50vw, 22vw"
                                quality={75}
                                className="scale-110 object-cover opacity-55 blur-xl"
                              />
                              <div
                                aria-hidden="true"
                                className="absolute inset-0 bg-black/25"
                              />
                              <Image
                                src={visual}
                                alt={
                                  ar
                                    ? `صورة ${product.titleAr}`
                                    : `${product.titleEn} product visual`
                                }
                                fill
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 22vw"
                                quality={88}
                                priority={index < 4}
                                className="object-contain p-2.5 transition-transform duration-500 ease-out group-hover:scale-[1.045]"
                              />
                            </>
                          ) : (
                            <Image
                              src={visual}
                              alt={
                                ar
                                  ? `غلاف ${product.titleAr}`
                                  : `${product.titleEn} cover art`
                              }
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 22vw"
                              quality={88}
                              priority={index < 4}
                              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.045]"
                            />
                          )
                        ) : (
                          <FallbackArt
                            product={product}
                            initials={initialsOf(product)}
                            name={ar ? product.titleAr : product.titleEn}
                          />
                        )}

                        {/* Voile bas : lisibilité des étiquettes */}
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent_0%,rgba(3,7,18,0.72)_100%)]"
                        />

                        <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/55 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur-md">
                          <KindIcon className="h-2.5 w-2.5" />
                          {ar
                            ? DIGITAL_KIND_LABELS[product.kind].ar
                            : DIGITAL_KIND_LABELS[product.kind].en}
                        </span>

                        <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-center gap-1">
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/25 bg-white/12 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                            <Gamepad2 className="h-2.5 w-2.5" />
                            {product.platform || "—"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/25 bg-white/12 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                            <Globe2 className="h-2.5 w-2.5" />
                            {regionLabel(primaryRegion, locale)}
                          </span>
                        </div>
                      </Link>

                      {/* Contenu */}
                      <div className="flex flex-1 flex-col p-3">
                        <h3 className="line-clamp-2 text-[13px] font-black leading-[1.35] tracking-[-0.01em]">
                          {ar ? product.titleAr : product.titleEn}
                        </h3>

                        {denominations.length > 0 && (
                          <p className="mt-1 line-clamp-1 text-[10.5px] font-semibold text-[var(--muted-foreground)]" dir="ltr">
                            {denominations
                              .map((denomination) =>
                                denominationLabel(denomination, locale),
                              )
                              .join(" · ")}
                          </p>
                        )}

                        {/* Carte strictement régionale : l'avertissement doit
                            être visible AVANT le clic sur la fiche. */}
                        <RegionalAlert regions={product.regions} compact className="mt-2" />

                        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                          <div className="min-w-0">
                            <div className="text-[9.5px] font-bold uppercase tracking-wider opacity-50">
                              {ar ? "ابتداءً من" : "From"}
                            </div>
                            {from != null ? (
                              <Price
                                usd={from}
                                className="block truncate text-[14px] font-black text-[var(--accent)]"
                              />
                            ) : (
                              <span className="text-[11.5px] font-bold opacity-60">
                                {ar ? "قريباً" : "Soon"}
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/codes/${product.slug}`}
                            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-[var(--primary)] px-3 text-[11px] font-black text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
                          >
                            {ar ? "التفاصيل" : "Details"}
                          </Link>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}

            {/* Bandeau de réassurance, comme le bas de rayon d'une boutique */}
            <div className="mt-7 grid gap-2.5 sm:grid-cols-3">
              {[
                {
                  icon: <Zap className="h-4 w-4" />,
                  title: ar ? "تسليم إلكتروني فوري" : "Instant digital delivery",
                  text: ar ? "الكود إلى بريدك بعد تأكيد الدفع." : "Your code lands in your inbox after payment.",
                },
                {
                  icon: <Layers className="h-4 w-4" />,
                  title: ar ? "أكواد أصلية" : "Genuine codes",
                  text: ar ? "من موزّع رسمي، دون وسيط." : "Sourced from the official distributor.",
                },
                {
                  icon: <Check className="h-4 w-4" />,
                  title: ar ? "دفع بالعملات الرقمية" : "Crypto payment",
                  text: ar ? "USDT وغيرها من الشبكات." : "USDT and other low-fee networks.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--secondary)]/40 px-3.5 py-3"
                >
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-black">{item.title}</span>
                    <span className="block text-[11px] leading-4 text-[var(--muted-foreground)]">
                      {item.text}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Sous-composants ---------------------------- */

/** Ligne de facette du rail : libellé + compteur, état actif accentué. */
function RailButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-[7px] text-start text-[12.5px] transition-colors ${
        active
          ? "bg-[var(--accent)]/14 font-black text-[var(--foreground)]"
          : "font-semibold text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
      }`}
    >
      <span className={active ? "text-[var(--accent)]" : "opacity-55"}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
          active
            ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
            : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/** Pastille de famille de la barre de filtres. */
function FamilyChip({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] transition-colors ${
        active
          ? "border-[var(--primary)] bg-[var(--primary)] font-black text-[var(--primary-foreground)]"
          : "border-[var(--border)] bg-[var(--card)] font-semibold hover:border-[var(--accent)]"
      }`}
    >
      {icon}
      {label}
      <span
        className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
          active
            ? "bg-white/20"
            : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/** Filtre actif retirable (ligne de résultats). */
function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/12 px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]/20"
    >
      {label}
      <X className="h-3 w-3 opacity-60" />
    </button>
  );
}

/**
 * Visuel de repli d'une fiche sans jaquette : dégradé construit autour de la
 * couleur de la fiche + initiales du jeu. Aucun cadre gris, aucune image
 * distante en échec — la carte reste identifiable même hors correspondance.
 */
function FallbackArt({
  product,
  initials,
  name,
}: {
  product: DigitalProduct;
  initials: string;
  name: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      style={{
        background: `radial-gradient(115% 85% at 20% 0%, ${product.color}f2 0%, ${product.color}77 34%, #0a1120 76%)`,
      }}
    >
      {/* Trame discrète : donne une texture « produit » plutôt qu'un aplat. */}
      <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)] [background-size:24px_24px]" />
      {/* Halo lumineux derrière le monogramme. */}
      <div
        className="absolute left-1/2 top-[38%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{ background: `${product.color}aa` }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 pb-8">
        <span className="grid h-16 w-16 place-items-center rounded-[1.15rem] border border-white/25 bg-white/12 text-[22px] font-black tracking-tight text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.85)] backdrop-blur-sm">
          {initials}
        </span>
        <span className="line-clamp-2 text-center text-[12.5px] font-black leading-tight text-white/85 [text-shadow:0_1px_10px_rgba(0,0,0,0.65)]">
          {name}
        </span>
      </div>
    </div>
  );
}
