import type { Metadata } from "next";
import { HomeSections } from "@/components/sections/home-sections";
import { getSiteDataCached } from "@/lib/store";
import {
  defaultMetaDescription,
  faqJsonLd,
  howToJsonLd,
  pageMetadata,
  siteLocale,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { getDigitalCatalog } from "@/lib/digital-store";
import { sortByDemand } from "@/lib/digital-priority";
import { lowestPriceUsd } from "@/lib/digital-types";
import { DigitalShowcase } from "@/components/sections/digital-showcase";
import { productDisplayName } from "@/lib/digital-seo";

/**
 * Le bandeau boutique lit le catalogue vivant : rafraîchissement horaire,
 * sans dégrader la mise en cache de la page d'accueil.
 */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  // La page d'accueil est la porte d'entrée du marché : son titre suit la
  // langue de référence (arabe pour la Libye) et reste sous 60 caractères.
  const locale = siteLocale(config);
  return pageMetadata(config, {
    path: "/",
    title:
      locale === "ar"
        ? "تصميم مواقع ومتاجر إلكترونية في {city} — تسليم في 7 أيام"
        : "Web Design & Online Stores in {cityEn} — Delivered in 7 Days",
    description: defaultMetaDescription(config, locale),
    keywords: [
      "web design agency",
      "website design USD",
      "e-commerce website",
      "pay for a website with USDT",
      "تصميم مواقع",
      "تصميم مواقع {city}",
      "شركة تصميم مواقع {country}",
      "متجر إلكتروني {country}",
      "تصميم متجر إلكتروني {city}",
      "تحسين SEO {country}",
      "وكالة ويب {city}",
      "web design {cityEn}",
      "web design {countryEn}",
      "e-commerce {countryEn}",
      "Nukhba web agency",
      "web design agency worldwide",
    ],
  });
}

export default async function HomePage() {
  const { config, content } = await getSiteDataCached();
  const locale = siteLocale(config);
  // Vitrine de la boutique : les six produits les plus demandés, ordonnés
  // côté serveur. Le maillage vers /codes et les fiches est ainsi présent
  // dans le HTML initial de la page d'accueil.
  const catalog = sortByDemand(await getDigitalCatalog({ publicOnly: true }));
  const showcase = catalog.slice(0, 6).map((product) => ({
    slug: product.slug,
    // Nom nettoyé (« Game Top-Up — PUBG Mobile (Auto) » → « PUBG Mobile »).
    title: productDisplayName(product, locale),
    platform: product.platform,
    kind: product.kind,
    fromUsd: lowestPriceUsd(product),
  }));
  const isSectionEnabled = (id: string) =>
    content.layout.entries.some(
      (e) => e.kind === "builtin" && e.builtinId === id && e.enabled,
    );

  const schemas: Record<string, unknown>[] = [];
  if (isSectionEnabled("faq") && content.faqs.length > 0) {
    schemas.push(faqJsonLd(content.faqs));
  }
  if (isSectionEnabled("process") && content.process.length > 0) {
    schemas.push(howToJsonLd(config, content.process));
  }

  return (
    <>
      {schemas.length > 0 && <JsonLd data={schemas} />}
      <HomeSections />
      <DigitalShowcase locale={locale} products={showcase} total={catalog.length} />
    </>
  );
}
