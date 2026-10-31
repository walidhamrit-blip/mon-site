import type { Metadata } from "next";
import { HomeSections } from "@/components/sections/home-sections";
import { getSiteDataCached } from "@/lib/store";
import {
  pageMetadata,
  siteLocale,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { digitalCatalogStatus, getDigitalCatalog } from "@/lib/digital-store";
import { sortByDemand } from "@/lib/digital-priority";
import { lowestPriceUsd } from "@/lib/digital-types";
import { DigitalShowcase } from "@/components/sections/digital-showcase";
import { homeFaqs } from "@/lib/site-hierarchy";
import { StoreUnavailableNotice } from "@/components/store-status-notice";
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
        ? "نخبة — إنشاء مواقع وبطاقات وأكواد رقمية"
        : "Nukhba — Websites, Gift Cards & Digital Codes",
    description: locale === "ar" ? "خدمات إنشاء المواقع والمتاجر في {city}، وبطاقات الهدايا ومفاتيح الألعاب والبرامج وشحن الألعاب. اختر المتجر الرقمي أو ابدأ مشروع موقعك مع نخبة." : "Website and online store creation in {cityEn}, plus gift cards, game and software keys, and game top-ups. Shop digital products or start your website with Nukhba.",
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
  const { config } = await getSiteDataCached();
  const locale = siteLocale(config);
  // Vitrine de la boutique : les six produits les plus demandés, ordonnés
  // côté serveur. Le maillage vers /codes et les fiches est ainsi présent
  // dans le HTML initial de la page d'accueil.
  const catalog = sortByDemand(await getDigitalCatalog({ publicOnly: true }));
  const showcase = catalog.slice(0, 6).map((product) => ({
    slug: product.slug,
    image: product.image || undefined,
    // Nom nettoyé (« Game Top-Up — PUBG Mobile (Auto) » → « PUBG Mobile »).
    title: productDisplayName(product, locale),
    platform: product.platform,
    kind: product.kind,
    fromUsd: lowestPriceUsd(product),
  }));
  const degraded = digitalCatalogStatus().degraded;
  const ar = locale === "ar";
  const schemas = [{
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: homeFaqs.map((faq) => ({ "@type": "Question", name: ar ? faq.qAr : faq.qEn, acceptedAnswer: { "@type": "Answer", text: ar ? faq.aAr : faq.aEn } })),
  }];

  return (
    <>
      {schemas.length > 0 && <JsonLd data={schemas} />}
      <HomeSections storeShowcase={degraded ? <StoreUnavailableNotice ar={ar} phone={config.whatsapp} /> : <DigitalShowcase locale={locale} products={showcase} total={catalog.length} />} />
    </>
  );
}
