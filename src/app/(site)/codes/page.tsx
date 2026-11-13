import { DigitalStoreView } from "@/components/digital-store-view";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { localizedAbsoluteUrl } from "@/lib/locale";
import { storeCategories } from "@/lib/site-hierarchy";
import type { Metadata } from "next";
import { digitalCatalogStatus, getDigitalCatalog } from "@/lib/digital-store";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  pageMetadata,
  siteLocale,
  storeJsonLd,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { sortByDemand } from "@/lib/digital-priority";
import {
  getPublicCatalogCached,
  getSiteDataCachedShared as getSiteDataCached,
} from "@/lib/catalog-cache";
import { resolveMarket } from "@/lib/market";
import { storeFaqs } from "@/lib/digital-seo";
import { lowestPriceUsd } from "@/lib/digital-types";
import { TrustpilotBadge } from "@/components/trustpilot-badge";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  // Les métadonnées suivent la langue principale du site (/admin → Réglages).
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    locale,
    path: "/codes",
    title:
      locale === "ar"
        ? "أكواد ألعاب وبرامج وبطاقات هدايا — Steam وPlayStation"
        : "Game Keys, Gift Cards & Digital Codes — Steam, PSN, Xbox",
    description:
      locale === "ar"
        ? "متجر رقمي لأكواد الألعاب والبرامج وبطاقات Steam وPlayStation وXbox وRoblox وGoogle Play وAmazon وشحن الألعاب — أسعار بالدولار وتسليم على بريدك."
        : "Digital store for game keys and software, Steam, PlayStation, Xbox, Roblox, Google Play and Amazon gift cards, and in-game top-ups. USD pricing, region details and email delivery.",
    keywords: [
      "بطاقات هدايا ألعاب",
      "أكواد Steam",
      "بطاقة PlayStation",
      "شحن Robux",
      "بطاقة هدايا إلكترونية",
      "digital gift cards",
      "Steam wallet code",
      "PlayStation gift card",
      "Roblox Robux top-up",
      "gaming gift cards worldwide",
    ],
  });
}

/**
 * La vitrine est rendue **à chaque requête**, jamais pré-générée au build.
 *
 * Panne constatée en production : à l'étape de build, `getLiveCatalog()`
 * renvoie volontairement `null` (un build ne doit pas dépendre du fournisseur).
 * La page était donc pré-rendue avec le catalogue de repli — **10 fiches** au
 * lieu des 280 du fournisseur — et restait servie telle quelle tant qu'une
 * synchronisation n'avait pas déclenché `revalidatePath`. Après chaque
 * déploiement, la boutique affichait donc un catalogue vide de 90 % pendant
 * plusieurs minutes (parfois des heures, si le rafraîchissement échouait).
 *
 * Le rendu par requête supprime la cause : la page lit toujours la copie du
 * fournisseur (`noSync`, donc aucun appel réseau au moment du rendu) et ne
 * peut plus figer un repli. Le coût est maîtrisé — la copie est en cache
 * mémoire/base et la grille reste un rendu serveur de quelques centaines de
 * cartes.
 */
export const dynamic = "force-dynamic";

/**
 * Le catalogue est lu depuis la copie persistée (aucune synchro pendant le
 * rendu) : cette borne n'est qu'un filet de sécurité.
 */
export const maxDuration = 60;

export default async function CodesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const initialKind = storeCategories.find((category) => category.kind === kind)?.kind ?? "all";
  const { config } = await getSiteDataCached();
  /**
   * Ordre commercial dès le serveur : les fiches les plus demandées (recharges
   * des jeux de la région, cartes des grandes boutiques, zones payables en
   * USDT) arrivent en tête du HTML, donc aussi en tête du plan de page et du
   * JSON-LD. Le composant client recalcule le même ordre (module partagé) quand
   * le visiteur change de tri.
   */
  /**
   * Catalogue lu depuis le cache de DONNÉES partagé (`unstable_cache`, tag
   * `digital-catalog`, TTL 60 s) : une instance froide ne relit plus Neon ni
   * ne reconstruit les ~280 fiches à chaque visite — c'est le TTFB qui
   * baisse, et le quota de calcul Neon avec lui.
   *
   * La fraîcheur du STOCK, elle, n'est pas déléguée au cache : elle est
   * vérifiée en base au moment du panier (`createDigitalCheckout` →
   * `checkSupplierUnitPrice`), et le prix est recalculé côté serveur.
   */
  const snapshot = await getPublicCatalogCached();
  const products = sortByDemand(snapshot.products);
  /**
   * Panne de la base : le catalogue affiché n'est plus le vrai (repli sur les
   * fiches de démonstration) et aucune commande ne pourrait être enregistrée.
   * On le DIT au visiteur, et on ne présente pas le repli comme le catalogue.
   *
   * L'état est relevé AU MOMENT de la lecture et voyage avec les données :
   * `digitalCatalogStatus()` garde aussi la valeur observée ici, pour que le
   * reste de la page (JSON-LD) juge sur le même instant.
   */
  const status = digitalCatalogStatus();
  const degraded = snapshot.degraded || status.degraded;
  const market = resolveMarket(config.market);
  const locale = await pageLocale(config, searchParams);
  const ar = locale === "ar";
  const faqs = storeFaqs(locale);


  /*
   * Pendant une panne de base, on n'émet NI l'ItemList NI les offres du
   * Store : le catalogue affiché n'est alors qu'un repli de démonstration,
   * et l'annoncer à Google reviendrait à lui apprendre que la boutique
   * vend 8 produits (constat de production du 29/10/2026).
   */
  const itemList = degraded
    ? null
    : {
        "@type": "ItemList",
        numberOfItems: products.length,
        itemListElement: products.map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: localizedAbsoluteUrl(config.url, `/codes/${product.slug}`, locale, siteLocale(config)),
          name: ar ? product.titleAr : product.titleEn,
          ...(product.image
            ? {
                image: product.image.startsWith("http")
                  ? product.image
                  : absoluteUrl(config, product.image),
              }
            : {}),
        })),
      };

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${localizedAbsoluteUrl(config.url, "/codes", locale, siteLocale(config))}#collection`,
    name: ar
      ? "بطاقات الهدايا وأكواد الألعاب والبرامج — نخبة"
      : "Gift cards, game keys and software codes — Nukhba",
    url: localizedAbsoluteUrl(config.url, "/codes", locale, siteLocale(config)),
    inLanguage: ar ? market.locale : "en",
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    description: ar
      ? "كتالوج أكواد الألعاب والبرامج وبطاقات هدايا الألعاب وشحن العملات داخل الألعاب: Steam وPlayStation وXbox وRoblox وGoogle Play وAmazon — أسعار بالدولار وتسليم إلكتروني."
      : "Catalogue of game keys, software codes, gaming gift cards and in-game currency top-ups: Steam, PlayStation, Xbox, Roblox, Google Play and Amazon — USD pricing with electronic delivery.",
    ...(itemList ? { mainEntity: itemList } : {}),
  };

  // Entité Store + catalogue d'offres : Google comprend qu'il s'agit d'une
  // boutique et non d'une simple page de services.
  const storeSchema = storeJsonLd(
    config,
    degraded
      ? []
      : products.map((product) => ({
          name: ar ? product.titleAr : product.titleEn,
          url: localizedAbsoluteUrl(config.url, `/codes/${product.slug}`, locale, siteLocale(config)),
          image: product.image
            ? product.image.startsWith("http")
              ? product.image
              : absoluteUrl(config, product.image)
            : null,
          priceUsd: lowestPriceUsd(product),
        })),
  );

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${localizedAbsoluteUrl(config.url, "/codes", locale, siteLocale(config))}#faq`,
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
              name: ar ? "الأكواد وبطاقات الهدايا" : "Codes & gift cards",
              path: "/codes",
            },
          ], locale),
          collectionSchema,
          storeSchema,
          faqSchema,
        ]}
      />

      <DigitalStoreView
        products={products}
        degraded={degraded}
        initialKind={initialKind}
        trustBadge={<TrustpilotBadge config={config} locale={locale} height="24px" />}
      />
    </>
  );
}
