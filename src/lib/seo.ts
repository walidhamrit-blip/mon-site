import type { Metadata } from "next";
import type { Demo, Faq } from "@/lib/site-types";

/**
 * Central SEO + structured-data (JSON-LD) helpers.
 *
 * Tout le référencement du site passe par ici : métadonnées Next.js
 * (title/description/canonical/Open Graph/Twitter) et schémas schema.org
 * utilisés par Google Search et les moteurs IA (ChatGPT, Perplexity,
 * Google AI Overviews…). Les builders acceptent la configuration vivante
 * lue depuis la base (/admin → Réglages) avec repli sur les défauts code.
 */

type SiteConfig = {
  name: string;
  nameAr: string;
  url: string;
  domain: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  addressEn: string;
  social: {
    instagram: string;
    facebook: string;
    whatsapp: string;
    tiktok: string;
  };
  pricing: {
    plans: ReadonlyArray<{
      id: string;
      name: string;
      nameEn: string;
      description: string;
      descriptionEn: string;
      priceUsd?: number | null;
    }>;
  };
};

const ORG_ID = "#organization";
const WEBSITE_ID = "#website";
const BUSINESS_ID = "#business";

/** URL absolue canonique d'un chemin interne. */
export function absoluteUrl(config: Pick<SiteConfig, "url">, path = "/"): string {
  const base = config.url.replace(/\/+$/, "");
  if (!path.startsWith("/")) path = `/${path}`;
  return `${base}${path === "/" ? "/" : path.replace(/\/+$/, "")}`;
}

/** Schéma Organization — entité marque référencée par les autres nœuds. */
export function organizationJsonLd(config: SiteConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl(config, ORG_ID),
    name: `${config.nameAr} — ${config.name}`,
    alternateName: "Nukhba Premium Web Agency",
    url: absoluteUrl(config, "/"),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(config, "/icon.svg"),
      width: 64,
      height: 64,
    },
    image: absoluteUrl(config, "/og.jpg"),
    email: config.email,
    telephone: config.phone,
    description:
      "وكالة تصميم وتطوير مواقع في طرابلس — ليبيا: مواقع واجهة، متاجر إلكترونية، أنظمة حجز، تحسين SEO وتسليم في 7 أيام.",
    inLanguage: ["ar-LY", "en"],
    sameAs: [config.social.instagram, config.social.facebook, config.social.tiktok].filter(
      (u) => u && /^https?:\/\//.test(u),
    ),
  };
}

/** Schéma WebSite — présence web, langues, éditeur. */
export function websiteJsonLd(config: SiteConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl(config, WEBSITE_ID),
    name: `${config.nameAr} ${config.name}`,
    url: absoluteUrl(config, "/"),
    inLanguage: ["ar-LY", "en"],
    publisher: { "@id": absoluteUrl(config, ORG_ID) },
    // Pas de SearchAction : le site n'expose pas de recherche publique par
    // URL (la recherche des démos est purement côté client). Déclarer une
    // SearchAction sans {search_term_string} dans l'URL serait invalide.
  };
}

/**
 * Schéma ProfessionalService (sous-type de LocalBusiness) — riche pour le
 * SEO local (Tripoli) et les réponses IA : horaires, contact, avis, réseaux.
 */
export function localBusinessJsonLd(config: SiteConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": absoluteUrl(config, BUSINESS_ID),
    name: `${config.nameAr} — ${config.name} Premium Web Agency`,
    alternateName: "Nukhba Web Agency Tripoli",
    url: absoluteUrl(config, "/"),
    logo: absoluteUrl(config, "/icon.svg"),
    image: absoluteUrl(config, "/og.jpg"),
    telephone: config.phone,
    email: config.email,
    priceRange: "$$",
    currenciesAccepted: "USD, LYD",
    address: {
      "@type": "PostalAddress",
      streetAddress: config.address,
      addressLocality: "Tripoli",
      addressRegion: "Tripoli",
      addressCountry: "LY",
    },
    areaServed: [
      { "@type": "City", name: "Tripoli" },
      { "@type": "Country", name: "Libya" },
    ],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        // Samedi → jeudi (fermeture le vendredi), cf. config.hours.
        dayOfWeek: [
          "Saturday",
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
        ],
        opens: "09:00",
        closes: "18:00",
      },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: config.phone,
      email: config.email,
      availableLanguage: ["Arabic", "English", "French"],
      areaServed: "LY",
    },
    sameAs: [config.social.instagram, config.social.facebook, config.social.tiktok].filter(
      (u) => u && /^https?:\/\//.test(u),
    ),
    // Note visible sur le site (section témoignages : « 4.9/5 — 86 avis »).
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      bestRating: "5",
      worstRating: "1",
      reviewCount: "86",
    },
    parentOrganization: { "@id": absoluteUrl(config, ORG_ID) },
  };
}

/**
 * Schéma FAQPage — contenu identique à la section FAQ visible (obligation
 * Google : le Q/R doit être présent dans la page). L'arabe est la langue
 * servie par défaut au HTML, c'est donc lui qui est structuré.
 */
export function faqJsonLd(faqs: ReadonlyArray<Faq>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "ar-LY",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.qAr,
      acceptedAnswer: { "@type": "Answer", text: f.aAr },
    })),
  };
}

/** Catalogue d'offres (formules tarifaires) avec prix USD machine-lisible. */
export function offerCatalogJsonLd(config: SiteConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "باقات تصميم وتطوير المواقع — Nukhba pricing plans",
    url: absoluteUrl(config, "/pricing"),
    itemListElement: config.pricing.plans
      .filter((p) => typeof p.priceUsd === "number")
      .map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        alternateName: plan.nameEn,
        description: plan.description,
        url: absoluteUrl(config, "/pricing"),
        priceCurrency: "USD",
        price: String(plan.priceUsd),
        availability: "https://schema.org/InStock",
        seller: { "@id": absoluteUrl(config, ORG_ID) },
      })),
  };
}

/** Fil d'Ariane structuré pour les pages internes. */
export function breadcrumbJsonLd(
  config: Pick<SiteConfig, "url">,
  items: ReadonlyArray<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(config, item.path),
    })),
  };
}

/** Schéma d'une réalisation du portfolio (page /demos/[slug]). */
export function demoJsonLd(config: SiteConfig, demo: Demo) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${absoluteUrl(config, `/demos/${demo.slug}`)}#work`,
    name: demo.title,
    alternateName: demo.titleEn,
    description: demo.description,
    genre: demo.sectorAr,
    image: demo.image,
    url: absoluteUrl(config, `/demos/${demo.slug}`),
    inLanguage: ["ar-LY", "en"],
    datePublished: "2025-01-01",
    author: { "@id": absoluteUrl(config, ORG_ID) },
    publisher: { "@id": absoluteUrl(config, ORG_ID) },
    keywords: [demo.sectorAr, demo.sectorEn, "تصميم مواقع", "web design Tripoli"],
  };
}

export interface PageSeoOptions {
  /** Chemin interne, ex "/contact". */
  path: string;
  /** Titre court de la page (le suffixe de marque est ajouté par le template). */
  title: string;
  description: string;
  /** Image OG/Twitter absolue ou racine ("/og.jpg"). Défaut : /og.jpg. */
  image?: string;
  noindex?: boolean;
  /** Mots-clés supplémentaires (AR/EN/FR). */
  keywords?: string[];
}

/**
 * Construit les métadonnées Next.js complètes d'une page : canonical,
 * Open Graph (ar_LY + alternate en_US), Twitter Card et robots.
 */
export function pageMetadata(config: SiteConfig, opts: PageSeoOptions): Metadata {
  const canonical = absoluteUrl(config, opts.path);
  const image = opts.image
    ? opts.image.startsWith("http")
      ? opts.image
      : absoluteUrl(config, opts.image)
    : absoluteUrl(config, "/og.jpg");

  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords,
    alternates: { canonical },
    robots: opts.noindex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: canonical,
      siteName: `${config.nameAr} ${config.name}`,
      locale: "ar_LY",
      alternateLocale: ["en_US"],
      type: "website",
      images: [{ url: image, width: 1376, height: 768, alt: opts.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [image],
    },
  };
}
