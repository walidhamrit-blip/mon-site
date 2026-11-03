import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/localized-link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DigitalCategoryNavigation } from "@/components/digital-category-navigation";
import { JsonLd } from "@/components/json-ld";
import { StoreUnavailableNotice } from "@/components/store-status-notice";
import { categoryHref, categoryProducts, CATEGORY_PAGE_SIZE, getDigitalCategory, parseCategoryPage } from "@/lib/digital-categories";
import { productSeoName } from "@/lib/digital-seo";
import { digitalCatalogStatus, getDigitalCatalog } from "@/lib/digital-store";
import { lowestPriceUsd } from "@/lib/digital-types";
import { breadcrumbJsonLd, pageMetadata, siteLocale } from "@/lib/seo";
import { localizedAbsoluteUrl, localeFromSearchParams, type LocalePageProps, type RouteSearchParams } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Props = {
  params: Promise<{ kind: string }>;
  searchParams: LocalePageProps["searchParams"];
};

// Metadata and HTML use the same catalogue snapshot during a request.
const loadCategory = cache(async (kind: string, params: RouteSearchParams) => {
  const category = getDigitalCategory(kind);
  const page = parseCategoryPage(params.page);
  if (!category || page === null) notFound();
  const { config } = await getSiteDataCached();
  const catalog = await getDigitalCatalog({ publicOnly: true });
  const degraded = digitalCatalogStatus().degraded;
  const listing = categoryProducts(degraded ? [] : catalog, category.kind, page);
  // A database outage must not turn previously valid paginated URLs into 404s.
  if (!degraded && page > listing.pageCount) notFound();
  const locale = localeFromSearchParams(params, siteLocale(config));
  const ar = locale === "ar";
  const name = ar ? category.ar : category.en;
  const suffix = page > 1 ? (ar ? ` — الصفحة ${page}` : ` — Page ${page}`) : "";
  const description = ar ? category.descriptionAr : category.descriptionEn;
  return { category, page, config, degraded, listing, ar, locale, name, suffix, description };
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { kind } = await params;
  const query = await searchParams;
  const { category, page, config, degraded, locale, name, suffix, description } = await loadCategory(kind, query);
  return pageMetadata(config, {
    locale,
    path: categoryHref(category.kind, page),
    title: `${name}${suffix}`,
    description: `${page > 1 ? (locale === "ar" ? `الصفحة ${page}. ` : `Page ${page}. `) : ""}${description}`,
    noindex: degraded,
  });
}

export default async function DigitalCategoryPage({ params, searchParams }: Props) {
  const { kind } = await params;
  const query = await searchParams;
  const { category, page, config, degraded, listing, ar, locale, name, suffix, description } = await loadCategory(kind, query);
  const path = categoryHref(category.kind, page);
  return (
    <>
      <JsonLd data={[
        breadcrumbJsonLd(config, [
          { name: ar ? "الرئيسية" : "Home", path: "/" },
          { name: ar ? "الأكواد" : "Digital codes", path: "/codes" },
          { name: `${name}${suffix}`, path },
        ], locale),
        {
          "@context": "https://schema.org", "@type": "CollectionPage",
          "@id": `${localizedAbsoluteUrl(config.url, path, locale, siteLocale(config))}#collection`, url: localizedAbsoluteUrl(config.url, path, locale, siteLocale(config)),
          name: `${name}${suffix}`, description, inLanguage: ar ? "ar" : "en",
          ...(!degraded ? { mainEntity: {
            "@type": "ItemList", numberOfItems: listing.products.length,
            itemListElement: listing.products.map((product, index) => ({
              "@type": "ListItem", position: (page - 1) * CATEGORY_PAGE_SIZE + index + 1,
              name: productSeoName(product, ar ? "ar" : "en"),
              url: localizedAbsoluteUrl(config.url, `/codes/${product.slug}`, locale, siteLocale(config)),
            })),
          } } : {}),
        },
      ]} />
      <header className="site-container px-4 pt-8 sm:px-6 lg:px-8">
        <Link href="/codes" className="text-sm underline">{ar ? "كل الأكواد" : "All digital codes"}</Link>
        <h1 className="mt-4 text-3xl font-black">{name}{suffix}</h1>
        <p className="mt-4 max-w-3xl leading-7 text-[var(--muted-foreground)]">{description}</p>
      </header>
      <DigitalCategoryNavigation ar={ar} current={category.kind} />
      {degraded ? <StoreUnavailableNotice ar={ar} phone={config.phone} /> : (
        <section className="site-container px-4 pb-10 sm:px-6 lg:px-8" aria-label={name}>
          <p className="mb-4">{ar ? `${listing.total} منتجاً` : `${listing.total} products`}</p>
          {listing.products.length === 0 ? (
            <p>{ar ? "لا توجد منتجات في هذه الفئة حالياً. تصفح الفئات الأخرى لمعرفة المتاح." : "No products in this category right now. Browse the other categories for available products."}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {listing.products.map((product) => {
                const price = lowestPriceUsd(product);
                return <li key={product.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                  <h2 className="text-lg font-bold"><Link href={`/codes/${product.slug}`} className="underline-offset-4 hover:underline">{productSeoName(product, ar ? "ar" : "en")}</Link></h2>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">{product.platform} · {product.regions.join(" / ")}</p>
                  {price != null && <p className="mt-3 font-bold">{ar ? "تبدأ من" : "From"} ${price.toFixed(2)}</p>}
                </li>;
              })}
            </ul>
          )}
          {listing.pageCount > 1 && (
            <nav aria-label={ar ? "صفحات الفئة" : "Category pagination"} className="mt-8 flex flex-wrap items-center gap-2">
              {page > 1 && <Link rel="prev" href={categoryHref(category.kind, page - 1)} className="rounded border p-3">{ar ? "السابق" : "Previous"}</Link>}
              {Array.from({ length: listing.pageCount }, (_, index) => index + 1).map((number) => (
                <Link key={number} href={categoryHref(category.kind, number)} aria-current={page === number ? "page" : undefined} aria-label={ar ? `الصفحة ${number}` : `Page ${number}`} className={`rounded border p-3 ${page === number ? "font-black underline" : ""}`}>{number}</Link>
              ))}
              {page < listing.pageCount && <Link rel="next" href={categoryHref(category.kind, page + 1)} className="rounded border p-3">{ar ? "التالي" : "Next"}</Link>}
            </nav>
          )}
        </section>
      )}
    </>
  );
}
