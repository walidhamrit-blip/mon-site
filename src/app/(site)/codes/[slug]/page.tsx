import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDigitalCatalog, getDigitalProductBySlug } from "@/lib/digital-store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata, siteLocale } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { DigitalProductDetails } from "./digital-product-details";
import { getSiteDataCached } from "@/lib/store";
import { resolveMarket } from "@/lib/market";
import { DIGITAL_KIND_LABELS, lowestPriceUsd } from "@/lib/digital-types";
import {
  productDisplayName,
  productFaqs,
  productSeoDescription,
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
    keywords: [
      locale === "ar" ? product.titleAr : product.titleEn,
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
  const ar = locale === "ar";
  const fromUsd = lowestPriceUsd(product);
  const canonical = absoluteUrl(config, `/codes/${product.slug}`);
  // Nom nettoyé (« Game Top-Up — PUBG Mobile (Auto) » → « PUBG Mobile ») :
  // c'est lui qui sert de H1, de nom de produit structuré et de texte de
  // maillage. Les qualificatifs opérationnels du fournisseur n'ont pas leur
  // place dans un titre indexé.
  const localeTitle = productDisplayName(product, locale);
  const localeDescription = ar ? product.descriptionAr : product.descriptionEn;
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
      title: productDisplayName(candidate, locale),
      platform: candidate.platform,
      image: candidate.image,
      fromUsd: lowestPriceUsd(candidate),
    }));

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
    alternateName: ar ? product.titleEn : product.titleAr,
    description: localeDescription,
    url: canonical,
    // `image` manquait : sans visuel, Google n'affiche pas de vignette dans
    // les résultats produit et le balisage est incomplet.
    image: product.image
      ? [
          product.image.startsWith("http")
            ? product.image
            : absoluteUrl(config, product.image),
        ]
      : [absoluteUrl(config, "/og.jpg")],
    sku: product.id,
    inLanguage: ar ? market.locale : "en",
    // Marque : la plateforme quand elle est identifiable (« Steam »,
    // « PlayStation »). Les fiches de recharge portent souvent une
    // plateforme technique (« Mobile », « PC ») qui n'est pas une marque —
    // dans ce cas on retombe sur le nom du produit.
    brand: {
      "@type": "Brand",
      name: /^(mobile|pc|console|web|android|ios)$/i.test(product.platform || "")
        ? localeTitle
        : product.platform || localeTitle,
    },
    category: ar
      ? DIGITAL_KIND_LABELS[product.kind].ar
      : DIGITAL_KIND_LABELS[product.kind].en,
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
            itemCondition: "https://schema.org/NewCondition",
            seller: { "@id": absoluteUrl(config, "#organization") },
            // Politique de retour : obligatoire pour prétendre à
            // l'expérience « fiches marchand » de Google. Les codes
            // numériques ne sont pas remboursables après livraison — on le
            // déclare au lieu de laisser Google le deviner.
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              applicableCountry: market.countryCode || "LY",
              returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
              merchantReturnLink: absoluteUrl(config, "/remboursement"),
            },
          },
        }
      : {}),
  };

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
            { name: localeTitle, path: `/codes/${product.slug}` },
          ]),
          productSchema,
          faqSchema,
        ]}
      />
      <DigitalProductDetails product={product} displayName={localeTitle} related={related} />
    </>
  );
}
