import type { Metadata } from "next";
import { resolveDemoClassification, resolvePlanPriceBreakdown } from "@/lib/classification";
import { getDemoCapturedAt, getDemoPreviewImages } from "@/lib/preview-manifest";
import {
  marketAreaServed,
  marketLanguages,
  marketLabels,
  resolveMarket,
  type MarketConfig,
} from "@/lib/market";
import type { Demo, Faq, ProcessStep, Testimonial } from "@/lib/site-types";
import { DEFAULT_SITE_DOMAIN, domainFromOrigin } from "@/lib/site-identity";

/**
 * Central SEO + structured-data (JSON-LD) helpers.
 *
 * Tout le référencement du site passe par ici : métadonnées Next.js
 * (title/description/canonical/Open Graph/Twitter) et schémas schema.org
 * utilisés par Google Search et les moteurs IA (ChatGPT, Perplexity,
 * Google AI Overviews…). Les builders acceptent la configuration vivante
 * lue depuis la base (/admin → Réglages) avec repli sur les défauts code.
 *
 * Aucune ville ni aucun pays n'est écrit en dur : tout provient du
 * « marché » (`config.market`), ce qui permet d'ouvrir le site à d'autres
 * pays sans redéploiement, et d'y injecter un positionnement international.
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
  /** Profil de marché (ville, pays, fuseau, devise locale…). */
  market?: (MarketConfig & { globalReach?: boolean }) | null;
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
      price: number;
      description: string;
      descriptionEn: string;
      priceUsd?: number | null;
      customizationPercent?: number | null;
    }>;
  };
  stats?: {
    ratingValue?: string;
    reviewCount?: string;
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
 *
 * Conservée telle quelle pour les marchés francophones ; `defaultMetaDescription`
 * en produit une variante adossée au marché configuré.
 */
export const DEFAULT_META_DESCRIPTION =
  "وكالة نخبة لتصميم المواقع في طرابلس: مواقع واجهة، متاجر إلكترونية وأنظمة حجز — تسليم في 7 أيام، سرعة 90+، تحسين SEO لمحركات البحث والذكاء الاصطناعي، ودعم واتساب.";

/**
 * Description meta par défaut, adossée au marché actif.
 *
 * Le texte reste «(libyen + international) » : on garde le mot-clé local qui
 * fait la force du référencement de longue date, et on ajoute la formule
 * internationale qui attire la clientèle hors du pays d'origine.
 */
export function defaultMetaDescription(config: Pick<SiteConfig, "market">): string {
  const market = resolveMarket(config.market);
  const ar = marketLabels(market, "ar");
  const reach = config.market?.globalReach ? " وللعالم" : "";
  // ~160 caractères : la description doit rester dans la zone d'affichage
  // des résultats Google (le contrôle SEO le vérifie à chaque build).
  return `وكالة نخبة لتصميم المواقع في ${ar.city}: مواقع واجهة، متاجر إلكترونية وأنظمة حجز${reach} — تسليم في 7 أيام، سرعة 90+، تحسين SEO، ودعم واتساب.`;
}

/**
 * Code de vérification Search Console du domaine **par défaut**.
 *
 * Google n'émet un code que pour une propriété donnée : ce code n'a donc de
 * valeur que si le site reste sur le domaine par défaut. Dès que le domaine
 * change, il faut réémettre un code (ou poser GOOGLE_SITE_VERIFICATION).
 */
export const DEFAULT_GOOGLE_SITE_VERIFICATION =
  "POB624EdzYiqxSgcA5PYaLyZDBbjBVx3mnAgEeUjKcg";

/**
 * Code de vérification Google Search Console (méthode balise HTML meta).
 *
 * Émis par le layout racine (<meta name="google-site-verification">) et
 * contrôlé par l'audit SEO admin. La variable d'environnement
 * GOOGLE_SITE_VERIFICATION permet de le remplacer sans redéployer de code
 * (même motif que DEFAULT_INDEXNOW_KEY dans src/lib/indexnow.ts).
 *
 * Le code par défaut n'est renvoyé que si le domaine courant est encore le
 * domaine par défaut : sur un autre domaine, il serait invalide — mieux vaut
 * ne rien émettre et laisser l'audit admin signaler la vérification comme
 * manquante.
 */
export function googleSiteVerification(domain?: string | null): string {
  const fromEnv = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  if (fromEnv) return fromEnv;
  const current = domain ? domainFromOrigin(domain) : DEFAULT_SITE_DOMAIN;
  return current === DEFAULT_SITE_DOMAIN ? DEFAULT_GOOGLE_SITE_VERIFICATION : "";
}

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

/**
 * Convertit une étiquette BCP-47 (« ar-LY ») en locale Open Graph
 * (« ar_LY »). Open Graph attend un underscore ; les graphes sociaux
 * refusent le format hyphenisé.
 */
export function ogLocale(locale: string): string {
  const cleaned = locale.replace(/-/g, "_");
  const [lang, region] = cleaned.split("_");
  if (!lang) return "ar";
  return region ? `${lang}_${region.toUpperCase()}` : lang;
}

/** Schéma Organization — entité marque référencée par les autres nœuds. */
export function organizationJsonLd(config: SiteConfig) {
  const market = resolveMarket(config.market);
  const en = marketLabels(market, "en");
  const globalReach = Boolean(config.market?.globalReach) || market.id === "global";
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl(config, ORG_ID),
    name: `${config.nameAr} — ${config.name}`,
    alternateName: `Nukhba Premium Web Agency ${en.city}`,
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
    description: globalReach
      ? `وكالة تصميم وتطوير مواقع${en.city === "Worldwide" ? "" : ` في ${en.city}`} تعمل لأسواق عربية وعالمية: مواقع واجهة، متاجر إلكترونية، أنظمة حجز، تحسين SEO وتسليم في 7 أيام.`
      : `وكالة تصميم وتطوير مواقع في ${en.city} — ${en.country}: مواقع واجهة، متاجر إلكترونية، أنظمة حجز، تحسين SEO وتسليم في 7 أيام.`,
    inLanguage: marketLanguages(market),
    sameAs: [config.social.instagram, config.social.facebook, config.social.tiktok].filter(
      (u) => u && /^https?:\/\//.test(u),
    ),
  };
}

/** Schéma WebSite — présence web, langues, éditeur. */
export function websiteJsonLd(config: SiteConfig) {
  const market = resolveMarket(config.market);
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl(config, WEBSITE_ID),
    name: `${config.nameAr} ${config.name}`,
    url: absoluteUrl(config, "/"),
    inLanguage: marketLanguages(market),
    publisher: { "@id": absoluteUrl(config, ORG_ID) },
    // Pas de SearchAction : le site n'expose pas de recherche publique par
    // URL (la recherche des démos est purement côté client). Déclarer une
    // SearchAction sans {search_term_string} dans l'URL serait invalide.
  };
}

/**
 * Schéma ProfessionalService (sous-type de LocalBusiness) — riche pour le
 * SEO local et les réponses IA : coordonnées GPS, horaires, contact, avis
 * individuels synchronisés depuis l'admin, réseaux et expertises.
 *
 * Tout le volet géographique vient du marché configuré ; `globalReach` ouvre
 * en plus la zone desservie au monde entier (le SEO local reste déclaré).
 */
export function localBusinessJsonLd(
  config: SiteConfig,
  testimonials?: ReadonlyArray<Testimonial>,
) {
  const market = resolveMarket(config.market);
  const en = marketLabels(market, "en");
  const ar = marketLabels(market, "ar");
  const globalReach = Boolean(config.market?.globalReach) || market.id === "global";
  const hasGeo = market.localRadiusKm > 0 && (market.lat !== 0 || market.lng !== 0);
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": absoluteUrl(config, BUSINESS_ID),
    name: `${config.nameAr} — ${config.name} Premium Web Agency`,
    alternateName: `Nukhba Web Agency ${en.city}`,
    url: absoluteUrl(config, "/"),
    logo: absoluteUrl(config, "/icon.svg"),
    image: absoluteUrl(config, "/og.jpg"),
    slogan: `مواقع ومتاجر إلكترونية فاخرة تُسلَّم في 7 أيام — ${ar.city}${globalReach ? " وللعالم" : ""}`,
    telephone: config.phone,
    email: config.email,
    priceRange: "$$",
    currenciesAccepted: "USD, LYD",
    paymentAccepted: "Cash, Bank Transfer, Cryptocurrency",
    address: {
      "@type": "PostalAddress",
      streetAddress: config.address,
      addressLocality: en.city,
      addressRegion: en.city,
      addressCountry: market.countryCode,
    },
    ...(hasGeo
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: market.lat,
            longitude: market.lng,
          },
          hasMap: `https://www.google.com/maps/search/?api=1&query=${market.lat},${market.lng}`,
        }
      : {}),
    areaServed: marketAreaServed(market, globalReach),
    // Zone de service locale : autour du point d'ancrage (Tripoli, Tajoura,
    // Janzour, Ain Zara, Gasr Ben Ghashir…) — signal de SEO local explicite.
    ...(hasGeo
      ? {
          serviceArea: {
            "@type": "GeoCircle",
            geoMidpoint: {
              "@type": "GeoCoordinates",
              latitude: market.lat,
              longitude: market.lng,
            },
            geoRadius: String(Math.round(market.localRadiusKm * 1000)),
          },
        }
      : {}),
    knowsLanguage: ["ar", "en", "fr"],
    hasOfferCatalog: { "@id": absoluteUrl(config, "/pricing#offer-catalog") },
    knowsAbout: [
      "تصميم مواقع الإنترنت",
      "تطوير متاجر إلكترونية",
      "أنظمة الحجز والمواعيد",
      "تحسين محركات البحث SEO",
      "تحسين الظهور في الذكاء الاصطناعي GEO",
      `Web Design ${en.city}`,
      `Web Agency ${en.city}`,
      "E-Commerce Development",
      "Next.js Web Development",
      ...(globalReach ? ["International Web Design", "E-Commerce Worldwide"] : []),
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
        closes: "23:00",
      },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: config.phone,
      email: config.email,
      availableLanguage: ["Arabic", "English", "French"],
      areaServed: globalReach ? "WW" : market.countryCode,
    },
    sameAs: [config.social.instagram, config.social.facebook, config.social.tiktok].filter(
      (u) => u && /^https?:\/\//.test(u),
    ),
    // Note visible sur le site (section témoignages) — source unique :
    // config.stats (voir src/lib/config.ts), avec repli sur les valeurs
    // historiques si une configuration ancienne ne les porte pas.
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: config.stats?.ratingValue ?? "4.9",
      bestRating: "5",
      worstRating: "1",
      reviewCount: config.stats?.reviewCount ?? "86",
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
export function faqJsonLd(
  faqs: ReadonlyArray<Faq>,
  market?: MarketConfig | null,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: resolveMarket(market).locale,
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
  const planOffers = config.pricing.plans.flatMap((plan) => {
    const totalPriceUsd = resolvePlanPriceBreakdown(plan).totalPriceUsd;
    return totalPriceUsd == null
      ? []
      : [
          {
            "@type": "Offer",
            name: plan.name,
            alternateName: plan.nameEn,
            description: `${plan.description} — model + customization`,
            url: absoluteUrl(config, "/pricing"),
            priceCurrency: "USD",
            price: String(totalPriceUsd),
            availability: "https://schema.org/InStock",
            seller: { "@id": absoluteUrl(config, ORG_ID) },
          },
        ];
  });

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
    "@id": absoluteUrl(config, "/pricing#offer-catalog"),
    name: "باقات وخدمات تصميم وتطوير المواقع — Nukhba pricing & services",
    url: absoluteUrl(config, "/pricing"),
    numberOfItems: planOffers.length + serviceOffers.length,
    provider: { "@id": absoluteUrl(config, ORG_ID) },
    itemListElement: [...planOffers, ...serviceOffers],
  };
}

/**
 * Schéma HowTo — structure les étapes du processus de création de site
 * (content.process) pour les rich results et les moteurs de réponse IA.
 */
export function howToJsonLd(
  config: Pick<SiteConfig, "url" | "market">,
  steps: ReadonlyArray<ProcessStep>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${absoluteUrl(config, "/")}#howto`,
    name: "كيف نصمم ونطلق موقعك الاحترافي في 7 إلى 14 يوماً — How Nukhba builds your website",
    description:
      "5 خطوات واضحة من جلسة الاكتشاف والتصميم الحي إلى الإطلاق والتدريب.",
    inLanguage: marketLanguages(resolveMarket(config.market)),
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

/**
 * Spécification `speakable` : indique aux assistants vocaux et aux moteurs
 * de réponse (Google Assistant, Apple Intelligence, Copilot Voice…) la
 * portion de page à lire à voix haute. Les sélecteurs CSS doivent exister
 * dans le HTML rendu côté serveur.
 */
export interface WebPageSchemaOptions {
  path: string;
  name: string;
  description: string;
  /** Sélecteurs CSS des blocs à synthétiser (ex. ["h1", "#service-answer"]). */
  speakable?: string[];
  about?: string;
  dateModified?: string;
}

/** Schéma `WebPage` d'une page interne, avec résumé `speakable` optionnel. */
export function webPageJsonLd(
  config: Pick<SiteConfig, "url" | "market">,
  opts: WebPageSchemaOptions,
) {
  const url = absoluteUrl(config, opts.path);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: opts.name,
    description: metaDescription(opts.description, 300),
    inLanguage: marketLanguages(resolveMarket(config.market)),
    isPartOf: { "@id": absoluteUrl(config, WEBSITE_ID) },
    ...(opts.about ? { about: { "@type": "Thing", name: opts.about } } : {}),
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: absoluteUrl(config, "/og.jpg"),
    },
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    ...(opts.speakable && opts.speakable.length > 0
      ? {
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: opts.speakable,
          },
        }
      : {}),
    potentialAction: { "@type": "ReadAction", target: [url] },
  };
}

/** Schéma d'une réalisation du portfolio (page /demos/[slug]). */
export function demoJsonLd(config: SiteConfig, demo: Demo) {
  const market = resolveMarket(config.market);
  const marketEn = marketLabels(market, "en");
  const globalReach = Boolean(config.market?.globalReach) || market.id === "global";
  const normalizedPlans = config.pricing.plans.map((p) => ({
    ...p,
    price: typeof p.price === "number" ? p.price : 0,
  }));
  const cls = resolveDemoClassification(demo, normalizedPlans);
  const canonicalUrl = absoluteUrl(config, `/demos/${demo.slug}`);
  const hasLivePreview =
    Boolean(demo.previewUrl) && /^https?:\/\//i.test(demo.previewUrl.trim());

  // Images locales (captures Playwright) prioritaire : elles sont servies par
  // notre domaine, donc plus rapides à explorer et pérennes. À défaut, on
  // garde l'image externe du portfolio. `screenshot` est le nom Schema.org
  // dédié aux captures d'écran d'une œuvre.
  const localPreviews = getDemoPreviewImages(demo);
  const primaryImage =
    localPreviews.length > 0 ? absoluteUrl(config, localPreviews[0]) : demo.image;

  // Date réelle de la dernière capture locale (manifeste Playwright) :
  // elle date la vitrine du projet. À défaut de capture, aucune date
  // n'est déclarée — mieux vaut s'abstenir qu'annoncer une date fictive.
  const capturedAt = getDemoCapturedAt(demo);
  const capturedIso = capturedAt ? capturedAt.toISOString().slice(0, 10) : null;

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${canonicalUrl}#work`,
    name: demo.title,
    alternateName: demo.titleEn,
    description: demo.description,
    genre: demo.sectorAr,
    image: primaryImage,
    ...(localPreviews.length > 0
      ? {
          thumbnailUrl: localPreviews.map((path) => absoluteUrl(config, path)),
          screenshot: localPreviews.map((path) => absoluteUrl(config, path)),
        }
      : {}),
    url: canonicalUrl,
    inLanguage: marketLanguages(market),
    ...(capturedIso
      ? { datePublished: capturedIso, dateModified: capturedIso }
      : {}),
    author: { "@id": absoluteUrl(config, ORG_ID) },
    publisher: { "@id": absoluteUrl(config, ORG_ID) },
    isPartOf: { "@id": absoluteUrl(config, WEBSITE_ID) },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    about: {
      "@type": "Thing",
      name: demo.sectorAr,
      alternateName: demo.sectorEn,
    },
    audience: {
      "@type": "BusinessAudience",
      name: globalReach
        ? `${demo.sectorEn} businesses worldwide`
        : `${demo.sectorEn} businesses in ${marketEn.city}, ${marketEn.country}`,
    },
    ...(hasLivePreview ? { workExample: demo.previewUrl } : {}),
    ...(cls && cls.totalPriceUsd != null
      ? {
          offers: {
            "@type": "Offer",
            name: `${cls.name} — ${cls.nameEn} (model + customization)`,
            priceCurrency: "USD",
            price: String(cls.totalPriceUsd),
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
      `web design ${marketEn.city}`,
      ...(globalReach ? ["web design agency worldwide", "international web design"] : []),
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
 * Remplace les jetons de marché dans un texte de métadonnées.
 *
 * `{city}` / `{country}` valent pour la langue du marché (arabe ou anglais
 * selon la langue de la page) ; `{cityEn}` / `{countryEn}` valent toujours
 * en anglais. Les titres de pages s'écrivent ainsi :
 *   «设计 مواقع في {city} — {country} » → «تصميم مواقع في طرابلس — ليبيا ».
 *
 * Changer de marché dans /admin met donc à jour TOUS les titres, sans
 * toucher au code.
 */
export function applyMarketTokens(
  text: string,
  market: ReturnType<typeof resolveMarket>,
  locale: "ar" | "en" = "ar",
): string {
  const labels = marketLabels(market, locale);
  const labelsEn = marketLabels(market, "en");
  return text
    .replaceAll("{city}", labels.city)
    .replaceAll("{country}", labels.country)
    .replaceAll("{cityEn}", labelsEn.city)
    .replaceAll("{countryEn}", labelsEn.country)
    .replaceAll("{place}", labels.place)
    .replaceAll("{placeEn}", labelsEn.place);
}

/**
 * Construit les métadonnées Next.js complètes d'une page : canonical,
 * Open Graph (ar_LY + alternate en_US), Twitter Card et robots.
 */
export function pageMetadata(config: SiteConfig, opts: PageSeoOptions): Metadata {
  const canonical = absoluteUrl(config, opts.path);
  // Les jetons de marché ({city}, {country}…) sont résolus ici : les titres
  // et descriptions restent lisibles dans le code, mais suivent le marché
  // configuré.
  const market = resolveMarket(config.market);
  const title = applyMarketTokens(opts.title, market);
  const description = applyMarketTokens(opts.description, market);
  const keywords = opts.keywords?.map((keyword) =>
    applyMarketTokens(keyword, market),
  );
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
    title,
    description,
    keywords,
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
      title,
      description,
      url: canonical,
      siteName: `${config.nameAr} ${config.name}`,
      locale: ogLocale(resolveMarket(config.market).locale),
      alternateLocale: ["en_US"],
      type: "website",
      ...(ogImage
        ? { images: [{ url: ogImage, width: 1376, height: 768, alt: title }] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}
