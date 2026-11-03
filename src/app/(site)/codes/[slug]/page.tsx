import Link from "next/link";
import { categoryHref, getDigitalCategory } from "@/lib/digital-categories";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  digitalCatalogStatus,
  getDigitalCatalog,
  getDigitalProductBySlug,
} from "@/lib/digital-store";
import { productPageFallback } from "@/lib/digital-fallback";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  digitalProductJsonLd,
  pageMetadata,
  siteLocale,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { StoreUnavailableProduct } from "@/components/store-status-notice";
import { DigitalProductDetails } from "./digital-product-details";
import { getSiteDataCached } from "@/lib/store";
import { resolveMarket } from "@/lib/market";
import { lowestPriceUsd } from "@/lib/digital-types";
import {
  productFaqs,
  productSeoDescription,
  productSeoKeywords,
  productSeoName,
  productSeoTitle,
} from "@/lib/digital-seo";

/**
 * Aucune page produit n'est pré-générée à la construction.
 *
 * Le catalogue vient désormais du FOURNISSEUR (FazerCards) : il change sans
 * déploiement, et un build ne doit pas dépendre d'une API tierce. Les fiches
 * sont donc rendues à la demande puis mises en cache par ISR (60 s).
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

/**
 * Filet de sécurité : les fiches sont pré-générées au build, et l'admin peut
 * modifier statut / prix / montants à tout moment. Sans fenêtre de
 * revalidation, une fiche reste figée sur l'état du dernier déploiement
 * (statut « bientôt disponible », aucun bouton d'achat) jusqu'au build
 * suivant. On rafraîchit donc au plus tard une minute après un changement.
 */
export const revalidate = 60;

/** Même raison que la liste : aucune synchronisation pendant le rendu. */
export const maxDuration = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { config } = await getSiteDataCached();
  // Les métadonnées suivent la langue principale du site (/admin → Réglages) :
  // une fiche produit ne doit pas s'annoncer en arabe dans la version
  // anglaise (elle est indexée sur le mot-clé de la plateforme).
  const locale = siteLocale(config);
  const product = await getDigitalProductBySlug(slug);
  if (!product) {
    return pageMetadata(config, {
      path: `/codes/${slug}`,
      title:
        locale === "ar" ? "منتج غير متاح" : "Product not available",
      description:
        locale === "ar"
          ? "هذا المنتج غير متاح حالياً."
          : "This product is not available right now.",
      noindex: true,
    });
  }

  return pageMetadata(config, {
    path: `/codes/${product.slug}`,
    title: productSeoTitle(product, locale),
    // Description unique par fiche (type + région + prix de départ) : la
    // description fournisseur était identique sur toutes les URLs.
    description: productSeoDescription(product, locale),
    image: product.image ? product.image : false,
    keywords: productSeoKeywords(product),
  });
}

export default async function DigitalProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { config } = await getSiteDataCached();
  const product = await getDigitalProductBySlug(slug);
  if (!product) {
    // A05 : panne déclarée (base + fournisseur down) → JAMAIS de 404, qui
    // ferait désindexer une fiche encore existante. On rend une page
    // « temporairement indisponible » (200 + noindex, voir generateMetadata).
    if (productPageFallback(digitalCatalogStatus().degraded) === "unavailable") {
      return (
        <StoreUnavailableProduct
          ar={siteLocale(config) === "ar"}
          phone={config.phone}
        />
      );
    }
    notFound();
  }

  const market = resolveMarket(config.market);
  const locale = siteLocale(config);
  const ar = locale === "ar";
  const canonical = absoluteUrl(config, `/codes/${product.slug}`);
  // Nom nettoyé (« Game Top-Up — PUBG Mobile (Auto) » → « PUBG Mobile ») :
  // c'est lui qui sert de H1, de nom de produit structuré et de texte de
  // maillage. Les qualificatifs opérationnels du fournisseur n'ont pas leur
  // place dans un titre indexé. La région est conservée quand la fiche est
  // régionale (A01) : « Free Fire (MENA) » ≠ « Free Fire (EU) ».
  const category = getDigitalCategory(product.kind);
  const localeTitle = productSeoName(product, locale);
  const faqs = productFaqs(product, locale);

  // Fiches proches : même nature ou même plateforme. Elles créent un
  // maillage interne crawlable (le client, lui, reste sur son univers).
  const catalog = await getDigitalCatalog({ publicOnly: true });
  const related = catalog
    .filter(
      (candidate) =>
        candidate.id !== product.id &&
        (candidate.platform === product.platform || candidate.kind === product.kind),
    )
    .slice(0, 4)
    .map((candidate) => ({
      slug: candidate.slug,
      title: productSeoName(candidate, locale),
      titleAr: productSeoName(candidate, "ar"),
      titleEn: productSeoName(candidate, "en"),
      platform: candidate.platform,
      image: candidate.image,
      fromUsd: lowestPriceUsd(candidate),
    }));

  // A10 : une offre par montant vendu par notre boutique, jamais un
  // AggregateOffer de variantes. Le générateur centralisé exclut les prix
  // invalides et n'ouvre pas d'offre pour une fiche en liste d'attente.
  const productSchema = digitalProductJsonLd(config, product, locale);

  // FAQ propre à la fiche, strictement identique au bloc visible.
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${canonical}#faq`,
    inLanguage: ar ? market.locale : "en",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: ar ? "الرئيسية" : "Home", path: "/" },
            {
              name: ar
                ? "الأكواد وبطاقات الهدايا"
                : "Digital codes & gift cards",
              path: "/codes",
            },
            ...(category ? [{ name: ar ? category.ar : category.en, path: categoryHref(category.kind) }] : []),
            { name: localeTitle, path: `/codes/${product.slug}` },
          ]),
          productSchema,
          faqSchema,
        ]}
      />
      {category && <nav aria-label={ar ? "فئة المنتج" : "Product category"} className="site-container px-4 pt-4 sm:px-6 lg:px-8"><Link href={categoryHref(category.kind)} className="text-sm underline">{ar ? category.ar : category.en}</Link></nav>}
      <DigitalProductDetails product={product} displayName={localeTitle} related={related} />
    </>
  );
}
