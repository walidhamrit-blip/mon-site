"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSiteConfig, useSiteContent } from "@/components/site-provider";
import { collectAllDemos } from "@/lib/site-types";
import { useI18n } from "@/lib/i18n";
import {
  demoImageAlt,
  formatLyd,
  lydLabel,
  resolveDemoClassification,
  type DemoClassification,
} from "@/lib/classification";
import { formatMainPrice } from "@/lib/installments";
import { freeCustomizationLabel } from "@/lib/promotion";
import {
  ArrowUpRight,
  ExternalLink,
  Search,
  Sparkles,
  X,
} from "lucide-react";

function isRealUrl(url?: string): boolean {
  return Boolean(url && url !== "#" && /^https?:\/\//i.test(url.trim()));
}

interface Entry {
  demo: ReturnType<typeof collectAllDemos>[number];
  classification: DemoClassification | null;
}

interface Group {
  tier: number;
  name: string;
  nameEn: string;
  priceUsd: number | null;
  priceLyd: number;
  entries: Entry[];
}

/**
 * Galerie classée par CATÉGORIE TARIFAIRE (et non par secteur) :
 * une section par formule, avec son prix, puis les sites de la catégorie.
 * Sous chaque site : son prix et la mention « personnalisation gratuite ».
 * Le filtre par secteur a été retiré pour garder une lecture simple ;
 * seule la recherche reste disponible.
 */
export function DemosClient() {
  const siteContent = useSiteContent();
  const demos = collectAllDemos(siteContent);
  const config = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<number | "all">("all");

  const entries = useMemo<Entry[]>(
    () =>
      demos.map((demo) => ({
        demo,
        classification: resolveDemoClassification(demo, config.pricing.plans),
      })),
    [demos, config.pricing.plans],
  );

  const groups = useMemo<Group[]>(() => {
    const byTier = new Map<number, Entry[]>();
    for (const entry of entries) {
      const t = entry.classification?.tier ?? 1;
      byTier.set(t, [...(byTier.get(t) ?? []), entry]);
    }
    return config.pricing.plans
      .map((plan, index) => {
        const t = index + 1;
        return {
          tier: t,
          name: plan.name,
          nameEn: plan.nameEn,
          priceUsd:
            typeof plan.priceUsd === "number" && plan.priceUsd > 0
              ? plan.priceUsd
              : null,
          priceLyd: plan.price,
          entries: byTier.get(t) ?? [],
        };
      })
      .filter((group) => group.entries.length > 0)
      .sort((a, b) => a.tier - b.tier);
  }, [entries, config.pricing.plans]);

  const query = q.trim().toLowerCase();
  const matches = (entry: Entry) =>
    !query ||
    (ar ? entry.demo.title : entry.demo.titleEn).toLowerCase().includes(query) ||
    (ar ? entry.demo.sectorAr : entry.demo.sectorEn).toLowerCase().includes(query) ||
    (ar ? entry.demo.description : entry.demo.descriptionEn)
      .toLowerCase()
      .includes(query);

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter(
        (entry) => (tier === "all" || group.tier === tier) && matches(entry),
      ),
    }))
    .filter((group) => group.entries.length > 0);

  const totalVisible = visibleGroups.reduce((sum, g) => sum + g.entries.length, 0);

  return (
    <div className="pt-[96px]">
      {/* En-tête compact : un titre, une phrase, une recherche. */}
      <section className="pb-6 border-b border-[var(--border)]">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div>
              <h1 className="text-[32px] lg:text-[44px] font-black tracking-tight leading-none">
                {ar ? "مواقعنا حسب الفئة السعرية" : "Our sites by price category"}
              </h1>
              <p className="mt-2.5 text-sm sm:text-base opacity-60 max-w-[58ch]">
                {ar
                  ? "كل موقع مصنّف حسب فئته مع سعره — والتخصيص الكامل على هويتك مجاني في كل الفئات."
                  : "Every site is sorted by its price category, with its price — full customization to your brand is free in every category."}
              </p>
            </div>

            <div className="relative w-full lg:w-[280px] shrink-0">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label={ar ? "بحث عن موقع" : "Search a site"}
                placeholder={ar ? "ابحث عن موقع أو قطاع…" : "Search a site or sector…"}
                className="h-11 w-full ps-9 pe-9 rounded-full border border-[var(--border)] bg-[var(--card)] text-sm outline-none focus:border-[var(--accent)]"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label={ar ? "مسح البحث" : "Clear search"}
                  className="absolute end-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full opacity-60 hover:opacity-100 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Accès direct aux catégories (avec leur prix). */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTier("all")}
              aria-pressed={tier === "all"}
              className={`h-9 px-4 rounded-full text-xs sm:text-sm font-bold border transition-colors cursor-pointer ${
                tier === "all"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                  : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)]/60"
              }`}
            >
              {ar ? "كل الفئات" : "All categories"}
            </button>
            {groups.map((group) => {
              const active = tier === group.tier;
              return (
                <button
                  key={group.tier}
                  type="button"
                  onClick={() => setTier(group.tier)}
                  aria-pressed={active}
                  className={`h-9 px-4 rounded-full text-xs sm:text-sm font-bold border transition-colors cursor-pointer ${
                    active
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-[var(--accent)]"
                      : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)]/60"
                  }`}
                >
                  {ar ? group.name : group.nameEn}
                  {group.priceUsd != null && (
                    <span className="ms-1.5 opacity-70" dir="ltr">
                      {formatMainPrice(
                        group.priceUsd,
                        ar ? config.pricing.currency : config.pricing.currencyEn,
                      )}
                    </span>
                  )}
                </button>
              );
            })}
            <span className="ms-auto text-xs opacity-50">
              {ar ? `${totalVisible} موقع` : `${totalVisible} sites`}
            </span>
          </div>
        </div>
      </section>

      {/* Une section par catégorie tarifaire. */}
      <div className="site-container px-4 sm:px-6 lg:px-8 pb-16">
        {visibleGroups.map((group, index) => (
          <section
            key={group.tier}
            aria-labelledby={`tier-${group.tier}`}
            className={index === 0 ? "pt-8" : "pt-10"}
          >
            <div className="flex flex-wrap items-end justify-between gap-3 pb-4 mb-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-sm font-black">
                  {group.tier}
                </span>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-45">
                    {ar ? `الفئة ${group.tier}` : `Category ${group.tier}`}
                  </div>
                  <h2
                    id={`tier-${group.tier}`}
                    className="text-xl sm:text-[26px] font-black tracking-tight leading-tight"
                  >
                    {ar ? group.name : group.nameEn}
                  </h2>
                </div>
              </div>

              <div className="text-end">
                {group.priceUsd != null && (
                  <div
                    className="text-xl sm:text-2xl font-black text-[var(--accent)] leading-none"
                    dir="ltr"
                  >
                    {formatMainPrice(
                      group.priceUsd,
                      ar ? config.pricing.currency : config.pricing.currencyEn,
                    )}
                  </div>
                )}
                <div className="mt-1 text-[11px] opacity-55" dir="ltr">
                  ≈ {formatLyd(group.priceLyd)} {lydLabel(locale)}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {group.entries.map(({ demo, classification }) => {
                const live = isRealUrl(demo.previewUrl);
                return (
                  <article
                    key={demo.slug}
                    className="group flex flex-col overflow-hidden rounded-[20px] bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/45 hover:shadow-lg transition-all"
                  >
                    <Link
                      href={`/demos/${demo.slug}`}
                      className="relative block aspect-[16/10] overflow-hidden"
                    >
                      <Image
                        src={demo.image}
                        alt={demoImageAlt(demo, locale)}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        loading="lazy"
                        decoding="async"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                      <span className="absolute top-2.5 start-2.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-black">
                        {ar ? demo.sectorAr : demo.sectorEn}
                      </span>
                      {live && (
                        <span className="absolute top-2.5 end-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-black text-white shadow">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          {ar ? "حي" : "LIVE"}
                        </span>
                      )}
                    </Link>

                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="text-[16px] font-black leading-snug">
                        <Link href={`/demos/${demo.slug}`} className="hover:underline">
                          {ar ? demo.title : demo.titleEn}
                        </Link>
                      </h3>

                      {/* Prix directement sous le nom du site. */}
                      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        {classification?.priceUsd != null ? (
                          <>
                            <span
                              className="text-lg font-black text-[var(--accent)] leading-none"
                              dir="ltr"
                            >
                              {formatMainPrice(
                                classification.priceUsd,
                                ar
                                  ? config.pricing.currency
                                  : config.pricing.currencyEn,
                              )}
                            </span>
                            <span className="text-[11px] opacity-55" dir="ltr">
                              ≈ {formatLyd(classification.priceLyd)}{" "}
                              {lydLabel(locale)}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm font-bold opacity-70">
                            {ar ? "سعر حسب الطلب" : "Price on request"}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="h-3.5 w-3.5 shrink-0" />
                        {freeCustomizationLabel(locale)}
                      </div>

                      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-[var(--border)]/70">
                        <Link
                          href={`/demos/${demo.slug}`}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--primary)] px-3 text-xs font-bold text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
                        >
                          {ar ? "معاينة الموقع" : "View site"}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                        {live && (
                          <a
                            href={demo.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={ar ? "فتح الموقع الكامل" : "Open full site"}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-xs font-bold hover:border-[var(--accent)] transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {ar ? "زيارة" : "Visit"}
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {visibleGroups.length === 0 && (
          <div className="py-16 text-center opacity-60">
            {ar ? "لا توجد نتائج — جرّب كلمة أخرى" : "No results — try another search"}
          </div>
        )}
      </div>
    </div>
  );
}
