import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDigitalProductBySlug } from "@/lib/digital-store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata, siteLocale } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { DigitalProductDetails } from "./digital-product-details";
import { getSiteDataCached } from "@/lib/store";
import { resolveMarket } from "@/lib/market";
import { lowestPriceUsd } from "@/lib/digital-types";

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

  const title = locale === "ar" ? product.titleAr : product.titleEn;
  const description = locale === "ar" ? product.descriptionAr : product.descriptionEn;
  // Le nom de la plateforme n'est rappelé que s'il n'est pas déjà dans le
  // titre : « Game Top-Up — 8 Ball Pool | 8 Ball Pool » ferait double emploi
  // et ferait dépasser la longueur conseillée pour un titre.
  const platform =
    product.platform && !title.toLowerCase().includes(product.platform.toLowerCase())
      ? ` — ${product.platform}`
      : "";

  return pageMetadata(config, {
    path: `/codes/${product.slug}`,
    title: `${title}${platform}`,
    description,
    image: product.image ? product.image : false,
    keywords: [
      title,
      locale === "ar" ? product.titleEn : product.titleAr,
      product.platform,
      locale === "ar" ? "بطاقة هدايا" : "gift card",
      locale === "ar" ? "كود رقمي" : "digital code",
      `${product.platform} gift card`,
      "digital code",
    ],
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
  if (!product) notFound();

  const market = resolveMarket(config.market);
  const locale = siteLocale(config);
  const fromUsd = lowestPriceUsd(product);
  const canonical = absoluteUrl(config, `/codes/${product.slug}`);
  const localeTitle = locale === "ar" ? product.titleAr : product.titleEn;
  const localeDescription =
    locale === "ar" ? product.descriptionAr : product.descriptionEn;

  // Schéma Product : la fiche est publiée et décrit précisément le produit.
  // `availability` suit le statut : une fiche « coming soon » reste
  // indexable (elle prépare l'ouverture) mais n'est pas proposée en stock.
  const availability =
    product.status === "available"
      ? "https://schema.org/InStock"
      : "https://schema.org/PreOrder";

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonical}#product`,
    name: localeTitle,
    alternateName: locale === "ar" ? product.titleEn : product.titleAr,
    description: localeDescription,
    url: canonical,
    inLanguage: [market.locale, "en"],
    brand: {
      "@type": "Brand",
      name: product.platform || "Nukhba",
    },
    category: product.kind,
    ...(fromUsd != null
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: String(fromUsd),
            highPrice: String(
              Math.max(
                ...product.denominations
                  .filter((denomination) => denomination.available)
                  .map((denomination) => denomination.priceUsd),
                fromUsd,
              ),
            ),
            offerCount: product.denominations.filter((d) => d.available).length,
            availability,
            url: canonical,
            seller: { "@id": absoluteUrl(config, "#organization") },
          },
        }
      : {}),
  };

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            {
              name: locale === "ar" ? "الرئيسية" : "Home",
              path: "/",
            },
            {
              name:
                locale === "ar"
                  ? "الأكواد وبطاقات الهدايا"
                  : "Digital codes & gift cards",
              path: "/codes",
            },
            { name: localeTitle, path: `/codes/${product.slug}` },
          ]),
          productSchema,
        ]}
      />
      <DigitalProductDetails product={product} />
    </>
  );
}
