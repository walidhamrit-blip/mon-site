"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BellRing, Check, Globe2, Search, Sparkles, Tag } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { Price } from "@/components/price";
import { whatsappLink } from "@/lib/utils";
import {
  DIGITAL_KIND_LABELS,
  regionLabel,
  type DigitalKind,
  type DigitalProduct,
} from "@/lib/digital-types";

/**
 * Vitrine du catalogue digital : codes logiciels, cartes cadeaux gaming,
 * recharges de monnaie de jeu et codes d'abonnement.
 *
 * Périmètre retenu : CATALOGUE. Les fiches sont publiées et détaillées,
 * mais l'achat n'est pas encore ouvert — le CTA appelle à la liste
 * d'attente (WhatsApp) au lieu d'un bouton « acheter ». Le passage à la
 * caisse se branchera plus tard sur les mêmes dénominations : rien ici n'est
 * un prototype jetable.
 */
export function DigitalCatalog({
  products,
}: {
  products: DigitalProduct[];
}) {
  const siteConfig = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("all");
  const [region, setRegion] = useState<string>("all");

  const kinds = useMemo(() => {
    const seen = new Set<DigitalKind>();
    for (const product of products) seen.add(product.kind);
    return Array.from(seen);
  }, [products]);

  const platforms = useMemo(() => {
    const seen = new Set<string>();
    for (const product of products) {
      if (product.platform) seen.add(product.platform);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const regions = useMemo(() => {
    const seen = new Set<string>();
    for (const product of products) {
      for (const item of product.regions) seen.add(item.toUpperCase());
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      if (kind !== "all" && product.kind !== kind) return false;
      if (platform !== "all" && product.platform !== platform) return false;
      if (
        region !== "all" &&
        !product.regions.some((item) => item.toUpperCase() === region)
      ) {
        return false;
      }
      if (!needle) return true;
      const haystack = [
        product.titleAr,
        product.titleEn,
        product.descriptionAr,
        product.descriptionEn,
        product.platform,
        ...product.featuresAr,
        ...product.featuresEn,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [products, query, kind, platform, region]);

  const waitlistMessage = (product: DigitalProduct) =>
    ar
      ? `مرحبا نخبة 👋 أرغب في شراء «${product.titleAr}» (${product.platform}). أرجو إشعارني عند فتح البيع.`
      : `Hello Nukhba 👋 I would like to buy "${product.titleEn}" (${product.platform}). Please notify me when sales open.`;

  const resetFilters = () => {
    setQuery("");
    setKind("all");
    setPlatform("all");
    setRegion("all");
  };

  const hasFilters =
    query.trim() !== "" || kind !== "all" || platform !== "all" || region !== "all";

  return (
    <div className="pt-6">
      {/* Barre de filtres */}
      <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="relative w-full lg:max-w-[320px]">
              <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-40" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  ar ? "ابحث عن بطاقة أو كود..." : "Search a card or a code..."
                }
                aria-label={ar ? "بحث في الكتالوج" : "Search the catalogue"}
                className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--card)] pe-4 ps-10 text-[13.5px] outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:ms-auto">
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                aria-label={ar ? "المنصة" : "Platform"}
                className="h-11 cursor-pointer rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[13px] font-semibold outline-none focus:border-[var(--accent)]"
              >
                <option value="all">{ar ? "كل المنصات" : "All platforms"}</option>
                {platforms.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                aria-label={ar ? "المنطقة" : "Region"}
                className="h-11 cursor-pointer rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[13px] font-semibold outline-none focus:border-[var(--accent)]"
              >
                <option value="all">{ar ? "كل المناطق" : "All regions"}</option>
                {regions.map((item) => (
                  <option key={item} value={item}>
                    {regionLabel(item, locale)}
                  </option>
                ))}
              </select>

              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-11 cursor-pointer rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[13px] font-semibold text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  {ar ? "مسح" : "Clear"}
                </button>
              )}
            </div>
          </div>

          {kinds.length > 1 && (
            <div className="scroll-x mt-4 flex gap-2 pb-1">
              <button
                type="button"
                onClick={() => setKind("all")}
                className={`chip shrink-0 cursor-pointer transition-colors ${
                  kind === "all"
                    ? "!border-[var(--primary)] !bg-[var(--primary)] !text-[var(--primary-foreground)]"
                    : "hover:border-[var(--accent)]"
                }`}
              >
                {ar ? "الكل" : "All"}
              </button>
              {kinds.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setKind(item)}
                  className={`chip shrink-0 cursor-pointer transition-colors ${
                    kind === item
                      ? "!border-[var(--primary)] !bg-[var(--primary)] !text-[var(--primary-foreground)]"
                      : "hover:border-[var(--accent)]"
                  }`}
                >
                  {ar ? DIGITAL_KIND_LABELS[item].ar : DIGITAL_KIND_LABELS[item].en}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Grille */}
      <section className="section">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <p className="mb-6 text-[13px] text-[var(--muted-foreground)]">
            {ar
              ? `${filtered.length} منتج في الكتالوج`
              : `${filtered.length} product${filtered.length === 1 ? "" : "s"} in the catalogue`}
          </p>

          {filtered.length === 0 ? (
            <div className="card-surface p-12 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-black">
                {ar ? "لا يوجد منتج مطابق" : "No matching product"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm opacity-65">
                {ar
                  ? "جرّب تعديل الفلاتر، أو تواصل معنا وسنجهّز طلبك يدوياً."
                  : "Try adjusting the filters, or contact us and we will prepare your order manually."}
              </p>
              <a
                href={whatsappLink(
                  siteConfig.whatsapp,
                  ar
                    ? "مرحبا نخبة 👋 أبحث عن كود أو بطاقة هدايا غير مدرجة في الكتالوج."
                    : "Hello Nukhba 👋 I'm looking for a code or gift card that isn't listed.",
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-black text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                <BellRing className="h-4 w-4" />
                {ar ? "اطلبه عبر واتساب" : "Request it on WhatsApp"}
              </a>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((product, index) => {
                const prices = product.denominations
                  .filter((denomination) => denomination.available)
                  .map((denomination) => denomination.priceUsd);
                const from = prices.length > 0 ? Math.min(...prices) : null;
                const features = ar ? product.featuresAr : product.featuresEn;

                return (
                  <motion.article
                    key={product.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.25) }}
                    className="card-surface card-interactive flex flex-col overflow-hidden"
                  >
                    <div
                      className="relative min-h-[190px] overflow-hidden px-6 py-5"
                      style={{
                        background: `radial-gradient(circle at 82% 28%, ${product.color}cc 0%, ${product.color}66 18%, transparent 48%), linear-gradient(135deg, #101827 0%, #182337 55%, ${product.color}55 100%)`,
                      }}
                    >
                      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-48 w-48 rounded-full border border-white/15 shadow-[0_0_60px_rgba(255,255,255,0.12)]" />
                      <div aria-hidden="true" className="pointer-events-none absolute bottom-3 right-5 rotate-[-8deg] text-5xl font-black tracking-[-0.08em] text-white/15">{product.platform.slice(0, 2).toUpperCase()}</div>
                      <div className="relative flex items-start justify-between gap-3">
                        <span className="grid h-12 w-12 place-items-center rounded-2xl text-[15px] font-black text-white shadow-[var(--shadow-sm)]" style={{ backgroundColor: product.color }}>
                          {product.platform.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="chip chip-accent">
                          <Tag className="h-3 w-3" />
                          {ar ? DIGITAL_KIND_LABELS[product.kind].ar : DIGITAL_KIND_LABELS[product.kind].en}
                        </span>
                      </div>

                      <h2 className="mt-4 text-[19px] font-black leading-snug tracking-[-0.02em]">
                        {ar ? product.titleAr : product.titleEn}
                      </h2>
                      <p className="mt-1.5 text-[12.5px] font-bold text-[var(--muted-foreground)]">
                        {product.platform}
                      </p>
                      <p className="mt-2.5 line-clamp-3 text-[13.5px] leading-7 text-[var(--muted-foreground)]">
                        {ar ? product.descriptionAr : product.descriptionEn}
                      </p>

                      {product.regions.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-1.5">
                          <Globe2 className="h-3.5 w-3.5 text-[var(--accent)]" />
                          {product.regions.slice(0, 4).map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--muted-foreground)]"
                            >
                              {regionLabel(item, locale)}
                            </span>
                          ))}
                          {product.regions.length > 4 && (
                            <span className="text-[10.5px] font-bold text-[var(--muted-foreground)]">
                              +{product.regions.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 px-6 pb-5">
                      {features.length > 0 && (
                        <ul className="grid gap-2">
                          {features.slice(0, 3).map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-xs leading-6">
                              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                                <Check className="h-3 w-3" />
                              </span>
                              <span className="opacity-85">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {product.denominations.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {product.denominations
                            .filter((denomination) => denomination.available)
                            .slice(0, 5)
                            .map((denomination) => (
                              <span
                                key={denomination.id}
                                className="rounded-lg bg-[var(--secondary)] px-2 py-1 text-[11px] font-bold"
                                dir="ltr"
                              >
                                {denomination.label}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-[var(--border)]/60 px-6 py-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-50">
                          {ar ? "ابتداءً من" : "From"}
                        </div>
                        {from != null ? (
                          <Price usd={from} className="text-[17px] font-black text-[var(--accent)]" />
                        ) : (
                          <span className="text-[13px] font-bold opacity-60">
                            {ar ? "قريباً" : "Soon"}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/codes/${product.slug}`}
                        className="inline-flex h-9 items-center rounded-full bg-[var(--primary)] px-4 text-[12.5px] font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
                      >
                        {ar ? "التفاصيل" : "Details"}
                      </Link>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
