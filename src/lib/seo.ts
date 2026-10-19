import type { Metadata } from "next";
import { resolveDemoClassification } from "@/lib/classification";
import type { Demo, Faq, ProcessStep, Testimonial } from "@/lib/site-types";

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
      price?: number;
      description: string;
      descriptionEn: string;
      priceUsd?: number | null;
    }>;
  };
  standaloneServices?: ReadonlyArray<{
    id: string;
    titleAr: string;
    titleEn: string;
    descAr: string;
    descEn: string;
    priceFromUsd: number;
    priceFromLyd: number;
  }>;
};

const ORG_ID = "#organization";
const WEBSITE_ID = "#website";
const BUSINESS_ID = "#business";

/**
 * Description meta par défaut du site (source unique, utilisée par le layout
 * racine et la page d'accueil). ~155 caractères arabe : assez riche en
 * mots-clés, dans la zone d'affichage des résultats Google.
 */
export const DEFAULT_META_DESCRIPTION =
  "وكالة نخبة لتصميم المواقع في طرابلس: مواقع واجهة، متاجر إلكترونية وأنظمة حجز — تسليم في 7 أيام، سرعة 90+، تحسين SEO لمحركات البحث والذكاء الاصطناعي، ودعم واتساب.";

/**
 * Tronque une description dynamique (ex. fiche réalisation venue de la base)
 * pour rester dans la fourchette d'affichage Google, sans couper un mot.
 */
export function metaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

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
 * SEO local (Tripoli) et les réponses IA : coordonnées GPS, horaires,
 * contact, avis individuels synchronisés depuis l'admin, réseaux et expertises.
 */
export function localBusinessJsonLd(
  config: SiteConfig,
  testimonials?: ReadonlyArray<Testimonial>,
) {
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
    paymentAccepted: "Cash, Bank Transfer, Cryptocurrency",
    address: {
      "@type": "PostalAddress",
      streetAddress: config.address,
      addressLocality: "Tripoli",
      addressRegion: "Tripoli",
      addressCountry: "LY",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 32.8872,
      longitude: 13.1913,
    },
    hasMap: "https://www.google.com/maps/search/?api=1&query=32.8872,13.1913",
    areaServed: [
      { "@type": "City", name: "Tripoli" },
      { "@type": "Country", name: "Libya" },
    ],
    knowsAbout: [
      "تصميم مواقع الإنترنت",
      "تطوير متاجر إلكترونية",
      "أنظمة الحجز والمواعيد",
      "تحسين محركات البحث SEO",
      "تحسين الظهور في الذكاء الاصطناعي GEO",
      "Web Design Tripoli Libya",
      "E-Commerce Development",
      "Next.js Web Development",
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
    ...(testimonials && testimonials.length > 0
      ? {
          review: testimonials.map((t) => ({
            "@type": "Review",
            author: {
              "@type": "Person",
              name: t.name,
              alternateName: t.nameEn,
              jobTitle: t.role,
            },
            reviewBody: `${t.text} (${t.textEn})`,
            reviewRating: {
              "@type": "Rating",
              ratingValue: String(t.rating),
              bestRating: "5",
              worstRating: "1",
            },
          })),
        }
      : {}),
    parentOrganization: { "@id": absoluteUrl(config, ORG_ID) },
  };
}

/**
 * Schéma FAQPage — contenu identique à la section FAQ visible (obligation
 * Google : le Q/R doit être présent dans la page). Ne doit être injecté que
 * sur les pages qui affichent réellement le composant <FAQ /> (/ et /pricing).
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

/**
 * Catalogue d'offres (formules tarifaires principales + services à la carte)
 * avec prix USD machine-lisibles. Synchronisé automatiquement depuis /admin.
 */
export function offerCatalogJsonLd(config: SiteConfig) {
  const planOffers = config.pricing.plans
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
    }));

  const serviceOffers = (config.standaloneServices ?? [])
    .filter((s) => typeof s.priceFromUsd === "number" && s.priceFromUsd > 0)
    .map((srv) => ({
      "@type": "Offer",
      name: srv.titleAr,
      alternateName: srv.titleEn,
      description: srv.descAr,
      url: `${absoluteUrl(config, "/")}#services`,
      priceCurrency: "USD",
      price: String(srv.priceFromUsd),
      availability: "https://schema.org/InStock",
      seller: { "@id": absoluteUrl(config, ORG_ID) },
    }));

  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "باقات وخدمات تصميم وتطوير المواقع — Nukhba pricing & services",
    url: absoluteUrl(config, "/pricing"),
    itemListElement: [...planOffers, ...serviceOffers],
  };
}

/**
 * Schéma HowTo — structure les étapes du processus de création de site
 * (content.process) pour les rich results et les moteurs de réponse IA.
 */
export function howToJsonLd(
  config: Pick<SiteConfig, "url">,
  steps: ReadonlyArray<ProcessStep>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${absoluteUrl(config, "/")}#howto`,
    name: "كيف نصمم ونطلق موقعك الاحترافي في 7 إلى 14 يوماً — How Nukhba builds your website",
    description:
      "5 خطوات واضحة من جلسة الاكتشاف والتصميم الحي إلى الإطلاق والتدريب.",
    inLanguage: ["ar-LY", "en"],
    totalTime: "P14D",
    step: steps.map((s, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: `${s.titleAr} — ${s.titleEn}`,
      text: `${s.descAr} (${s.durationAr}) — ${s.descEn} (${s.durationEn})`,
      url: `${absoluteUrl(config, "/")}#process`,
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
  const normalizedPlans = config.pricing.plans.map((p) => ({
    ...p,
    price: typeof p.price === "number" ? p.price : 0,
  }));
  const cls = resolveDemoClassification(demo, normalizedPlans);
  const canonicalUrl = absoluteUrl(config, `/demos/${demo.slug}`);
  const hasLivePreview =
    Boolean(demo.previewUrl) && /^https?:\/\//i.test(demo.previewUrl.trim());

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${canonicalUrl}#work`,
    name: demo.title,
    alternateName: demo.titleEn,
    description: demo.description,
    genre: demo.sectorAr,
    image: demo.image,
    url: canonicalUrl,
    inLanguage: ["ar-LY", "en"],
    datePublished: "2025-01-01",
    author: { "@id": absoluteUrl(config, ORG_ID) },
    publisher: { "@id": absoluteUrl(config, ORG_ID) },
    ...(hasLivePreview ? { workExample: demo.previewUrl } : {}),
    ...(cls && cls.priceUsd != null
      ? {
          offers: {
            "@type": "Offer",
            name: `${cls.name} — ${cls.nameEn}`,
            priceCurrency: "USD",
            price: String(cls.priceUsd),
            availability: "https://schema.org/InStock",
            url: canonicalUrl,
            seller: { "@id": absoluteUrl(config, ORG_ID) },
          },
        }
      : {}),
    keywords: [
      demo.sectorAr,
      demo.sectorEn,
      ...(demo.features ?? []),
      ...(demo.featuresEn ?? []),
      "تصميم مواقع",
      "web design Tripoli",
    ],
  };
}

/**
 * Titre + description SEO d'une réalisation, dans la langue demandée.
 *
 * Ordre de priorité : champs personnalisés saisis dans /admin/content (ou
 * proposés par l'assistant SEO IA) → repli automatique sur le titre et la
 * description du projet. La description est toujours tronquée pour rester
 * dans la zone d'affichage Google.
 */
export function demoSeoMeta(demo: Demo, locale: "ar" | "en" = "ar"): { title: string; description: string } {
  if (locale === "en") {
    return {
      title: demo.metaTitleEn?.trim() || `${demo.titleEn} — live website showcase by Nukhba`,
      description: metaDescription(demo.metaDescriptionEn?.trim() || demo.descriptionEn),
    };
  }
  return {
    title: demo.metaTitle?.trim() || `${demo.title} — معرض موقع حي من نخبة`,
    description: metaDescription(demo.metaDescription?.trim() || demo.description),
  };
}

export interface PageSeoOptions {
  /** Chemin interne, ex "/contact". */
  path: string;
  /** Titre court de la page (le suffixe de marque est ajouté par le template). */
  title: string;
  description: string;
  /**
   * Image OG/Twitter absolue ou racine ("/og.jpg"). Défaut : /og.jpg.
   * Passer `false` pour n'en déclarer aucune : les conventions de fichiers
   * Next.js (opengraph-image.tsx / twitter-image.tsx) s'en chargent alors.
   */
  image?: string | false;
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
  // undefined = pas d'images déclarées manuellement (la page s'appuie sur
  // les fichiers opengraph-image / twitter-image du segment de route).
  const ogImage =
    opts.image === false
      ? undefined
      : opts.image
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
      ...(ogImage
        ? { images: [{ url: ogImage, width: 1376, height: 768, alt: opts.title }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}
