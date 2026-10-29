import type { Metadata } from "next";
import { resolveDemoClassification, resolvePlanPriceBreakdown } from "@/lib/classification";
import { getDemoCapturedAt, getDemoPreviewImages } from "@/lib/preview-manifest";
import {
  marketAreaServed,
  marketLanguage,
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
  /** Apparence : langue de référence, thème, mode. */
  appearance?: {
    primaryLocale?: "auto" | "ar" | "en" | string | null;
    defaultLocale?: "ar" | "en" | string | null;
  } | null;
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
  "Nukhba builds premium websites, e-commerce stores and booking systems for clients worldwide — delivered in 7 days, 90+ speed, SEO + AI-search ready, USD pricing payable in USDT.";

/**
 * Description meta par défaut, adossée au marché actif.
 *
 * Le texte reste «(libyen + international) » : on garde le mot-clé local qui
 * fait la force du référencement de longue date, et on ajoute la formule
 * internationale qui attire la clientèle hors du pays d'origine.
 */
export function defaultMetaDescription(
  config: Pick<SiteConfig, "market" | "appearance">,
  locale?: "ar" | "en",
): string {
  const lang = locale ?? siteLocale(config);
  const market = resolveMarket(config.market);
  const labels = marketLabels(market, lang);
  const reach = config.market?.globalReach
    ? lang === "ar"
      ? " وللعالم"
      : " and worldwide"
    : "";
  // ~155 caractères : la description doit rester dans la zone d'affichage
  // des résultats Google (le contrôle SEO le vérifie à chaque build).
  // ≤ 155 caractères, phrase complète : une description coupée au milieu
  // d'un mot (« … مع متجر… ») gaspille la seule accroche de la SERP.
  return lang === "ar"
    ? `وكالة نخبة في ${labels.city}: مواقع ومتاجر إلكترونية بأسعار بالدولار${reach}، تسليم في 7 أيام، تحسين SEO — ومتجر أكواد ألعاب وبرامج وبطاقات هدايا.`
    : `Nukhba in ${labels.city}: websites and online stores priced in USD${reach}, delivered in 7 days, SEO-ready — plus a digital store for game keys, software and gift cards.`;
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
 * Langue de référence du site — celle du HTML initial, des titres, des
 * descriptions et des données structurées.
 *
 * Trois niveaux, du plus explicite au plus automatique :
 *  1. `appearance.primaryLocale` = "ar" ou "en" : choix explicite de
 *     l'exploitant (/admin → Apparence) ;
 *  2. "auto" (défaut) : langue du marché configuré — arabe pour la Libye,
 *     l'Égypte, l'Arabie saoudite, les Émirats, le Maghreb ; anglais sinon.
 *
 * Pourquoi : un site adressé à Tripoli qui se présente en anglais dans son
 * HTML ne peut pas se classer sur « تصميم مواقع طرابلس ». La langue servie
 * doit être celle des requêtes réellement tapées par les clients. Un
 * exploitant qui vise d'abord l'international peut forcer "en" en un clic.
 *
 * Le visiteur peut ensuite basculer la langue côté client ; les métadonnées
 * restent, elles, alignées sur le HTML initial (une seule version par URL,
 * pas de hreflang trompeur vers une page inexistante).
 */
export function siteLocale(config: {
  appearance?: { primaryLocale?: string | null; defaultLocale?: string | null } | null;
  market?: (MarketConfig & { globalReach?: boolean }) | null;
}): "ar" | "en" {
  const explicit = String(config.appearance?.primaryLocale ?? "auto").toLowerCase();
  if (explicit === "ar" || explicit === "en") return explicit;
  // Repli : langue du marché. `defaultLocale` n'est volontairement plus
  // prioritaire — il pouvait rester bloqué sur « en » alors que la valeur
  // était un simple défaut enregistré, ce qui produisait un site anglais
  // pour un marché arabophone.
  const market = resolveMarket(config.market);
  return marketLanguage(market);
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
  const ar = marketLabels(market, "ar");
  const globalReach = Boolean(config.market?.globalReach) || market.id === "global";
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl(config, ORG_ID),
    name: `${config.nameAr} — ${config.name}`,
    // La marque n'est plus seulement une agence : l'entité couvre aussi le
    // magasin de codes. Un `alternateName` figé sur « Web Agency » brouille
    // le rapprochement avec les requêtes gaming.
    alternateName: `Nukhba Web Design & Digital Store ${en.city}`,
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
      ? `وكالة تصميم وتطوير مواقع${market.id === "global" ? "" : ` في ${ar.city}`} تعمل لأسواق عربية وعالمية: مواقع واجهة، متاجر إلكترونية، أنظمة حجز، تحسين SEO وتسليم في 7 أيام — ومتجر رقمي لأكواد الألعاب والبرامج وبطاقات الهدايا.`
      : `وكالة تصميم وتطوير مواقع في ${ar.city} — ${ar.country}: مواقع واجهة، متاجر إلكترونية، أنظمة حجز، تحسين SEO وتسليم في 7 أيام — ومتجر رقمي لأكواد الألعاب والبرامج وبطاقات الهدايا.`,
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
  // Conservé dans la signature pour ne pas casser les appelants ; les avis ne
  // sont plus balisés (voir plus bas).
  _testimonials?: ReadonlyArray<Testimonial>,
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
    name: `${config.nameAr} — ${config.name} · Web Design & Digital Store`,
    alternateName: `Nukhba Web Agency & Digital Store ${en.city}`,
    url: absoluteUrl(config, "/"),
    logo: absoluteUrl(config, "/icon.svg"),
    image: absoluteUrl(config, "/og.jpg"),
    slogan: `مواقع ومتاجر إلكترونية فاخرة تُسلَّم في 7 أيام — ${ar.city}${globalReach ? " وللعالم" : ""}`,
    telephone: config.phone,
    email: config.email,
    priceRange: "$$",
    currenciesAccepted: "USD",
    paymentAccepted: "Cryptocurrency (USDT), Bank Transfer",
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
      "بطاقات هدايا الألعاب",
      "أكواد الألعاب والبرامج الرقمية",
      "شحن العملات داخل الألعاب",
      `Web Design ${en.city}`,
      `Web Agency ${en.city}`,
      "E-Commerce Development",
      "Next.js Web Development",
      "Game Gift Cards",
      "Software Activation Keys",
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
    // Pas d'`aggregateRating` ni de `review` auto-déclarés ici.
    // Depuis 2019, Google n'affiche pas les avis « auto-attribués » d'une
    // entreprise sur sa propre page (self-serving reviews) et considère leur
    // balisage comme du spam de données structurées. Les témoignages restent
    // visibles dans la section dédiée ; les avis éligibles sont ceux d'une
    // fiche Google Business Profile vérifiée. Les mentions « 4.9/5 » de
    // l'interface sont donc décoratives, pas un signal SEO.
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
 * Schéma `Store` — l'activité « boutique d'codes et cartes cadeaux ».
 *
 * Le site porte deux activités distinctes : une agence web (ProfessionalService)
 * et une boutique de codes numériques. Sans entité `Store`, Google ne
 * comprenait que l'agence et traitait `/codes` comme une simple page du site
 * de services. Le nœud est déclaré une fois (`@id` stable), enrichi du
 * catalogue sur `/codes`.
 */
export function storeJsonLd(
  config: SiteConfig,
  products: ReadonlyArray<{
    name: string;
    url: string;
    image?: string | null;
    priceUsd?: number | null;
  }> = [],
) {
  const storeUrl = absoluteUrl(config, "/codes");
  const market = resolveMarket(config.market);
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${storeUrl}#store`,
    name: `${config.nameAr} ${config.name} — Digital Store`,
    alternateName: "متجر نخبة للأكواد والبطاقات الرقمية",
    url: storeUrl,
    image: absoluteUrl(config, "/og.jpg"),
    description:
      "متجر رقمي لبطاقات الهدايا وأكواد الألعاب والبرامج: Steam، PlayStation، Xbox، Roblox، Google Play، Amazon وغيرها. أسعار بالدولار وتسليم إلكتروني.",
    parentOrganization: { "@id": absoluteUrl(config, ORG_ID) },
    currenciesAccepted: "USD",
    paymentAccepted: "Cryptocurrency (USDT), NOWPayments",
    areaServed: { "@type": "Place", name: "Worldwide" },
    knowsLanguage: marketLanguages(market),
    ...(products.length > 0
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "أكواد وبطاقات رقمية — Digital codes & gift cards",
            numberOfItems: products.length,
            itemListElement: products.map((product) => ({
              "@type": "Offer",
              url: product.url,
              ...(product.priceUsd != null
                ? {
                    priceCurrency: "USD",
                    price: String(product.priceUsd),
                    availability: "https://schema.org/InStock",
                  }
                : {}),
              itemOffered: {
                "@type": "Product",
                name: product.name,
                url: product.url,
                ...(product.image ? { image: product.image } : {}),
              },
            })),
          },
        }
      : {}),
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
  const cls = resolveDemoClassification(demo, config.pricing.plans);
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
export function demoSeoMeta(demo: Demo, locale: "ar" | "en" = "en"): { title: string; description: string } {
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

/**
 * Longueur maximale d'un titre affiché dans les résultats Google.
 *
 * Google coupe autour de ~600 px (≈ 60 caractères latins, un peu plus en
 * arabe). Au-delà, la fin du titre — souvent le mot-clé ou la ville — dispa-
 * raît. Tous les titres du site passent donc par `serpTitle`, qui borne la
 * longueur et n'ajoute le suffixe de marque que s'il reste de la place.
 */
export const SERP_TITLE_MAX = 60;

/** Suffixe de marque par langue. */
const BRAND_LABEL: Record<"ar" | "en", string> = { ar: "نخبة", en: "Nukhba" };
const BRAND_PATTERN = /(nukhba|نخبة)/i;

/** Nettoie un titre : espaces multiples, séparateurs orphelins en fin. */
function normalizeTitle(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*[|—–-]\s*$/, "")
    .trim();
}

/** Coupe une chaîne sur un mot, sans laisser de ponctuation suspendue. */
function clampAtWord(value: string, max: number): string {
  if (value.length <= max) return value;
  const slice = value.slice(0, max);
  // 1) Ponctuation forte : on préfère un titre complet (« … في 2026 ؟ »)
  //    à une troncature avec points de suspension au milieu d'un mot-clé.
  const strong = Math.max(
    slice.lastIndexOf("؟"),
    slice.lastIndexOf("?"),
    slice.lastIndexOf("!"),
  );
  if (strong >= max * 0.45) return value.slice(0, strong + 1).trim();
  // 2) Séparateur éditorial (sous-titre, précision) : on coupe avant.
  let separator = -1;
  for (const mark of [" — ", " – ", " | ", ": "]) {
    const index = slice.lastIndexOf(mark);
    if (index > separator) separator = index;
  }
  if (separator >= max * 0.5) {
    return value
      .slice(0, separator)
      .replace(/[\s|—–,:;.\-]+$/, "")
      .trim();
  }
  // 3) Dernier recours : coupure sur un espace.
  const cut = slice.lastIndexOf(" ");
  const base = (cut > max * 0.55 ? slice.slice(0, cut) : slice)
    .replace(/[\s|—–,:;.\-]+$/, "")
    .trim();
  return `${base}…`;
}

/**
 * Construit le titre réellement servi dans la SERP.
 *
 * - supprime une marque déjà présente en fin de titre (« … | Nukhba نخبة »)
 *   puis l'ajoute UNE seule fois si la place le permet : fini les titres
 *   « Websites … — Nukhba | Nukhba نخبة » qui dépassaient 75 caractères ;
 * - ne dépasse jamais `max` caractères (60 par défaut), pour éviter la
 *   troncature sauvage de Google au milieu d'un mot-clé.
 */
export function serpTitle(
  raw: string,
  locale: "ar" | "en" = "ar",
  max: number = SERP_TITLE_MAX,
): string {
  let title = normalizeTitle(raw ?? "");
  if (!title) return BRAND_LABEL[locale];

  // « Titre | Nukhba » ou « Titre | نخبة Nukhba » → « Titre ».
  const parts = title.split(/\s*\|\s*/);
  if (parts.length > 1 && BRAND_PATTERN.test(parts[parts.length - 1])) {
    parts.pop();
    title = parts.join(" | ").trim();
  }
  // « Titre — Nukhba », « Titre - نخبة » → « Titre ».
  title = title.replace(/\s*[—–-]\s*(nukhba|نخبة)\s*$/i, "").trim();

  if (!BRAND_PATTERN.test(title)) {
    const suffix = ` | ${BRAND_LABEL[locale]}`;
    if (title.length + suffix.length <= max) title = `${title}${suffix}`;
  }
  return clampAtWord(title, max);
}

/** Description meta bornée à la largeur d'affichage Google (≈155 car.). */
export function serpDescription(raw: string, max = 155): string {
  const clean = (raw ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  // Coupe à la fin d'une phrase quand elle tombe dans la zone visible :
  // une description qui s'arrête sur un point se lit mieux qu'un « … ».
  const sentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("؟ "),
    slice.lastIndexOf("? "),
  );
  if (sentence >= max * 0.6) return clean.slice(0, sentence + 1).trim();
  const cut = slice.lastIndexOf(" ");
  const base = (cut > max * 0.6 ? slice.slice(0, cut) : slice)
    .replace(/[\s,;:.\-]+$/, "")
    .trim();
  return `${base}…`;
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
  /** Force la langue de la page (sinon : langue de référence du site). */
  locale?: "ar" | "en";
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
 * Open Graph (en_US + alternate ar), Twitter Card et robots.
 */
export function pageMetadata(config: SiteConfig, opts: PageSeoOptions): Metadata {
  const canonical = absoluteUrl(config, opts.path);
  // Les jetons de marché ({city}, {country}…) sont résolus ici : les titres
  // et descriptions restent lisibles dans le code, mais suivent le marché
  // configuré.
  const market = resolveMarket(config.market);
  const locale = opts.locale ?? siteLocale(config);
  // Titre borné à 60 caractères, suffixe de marque ajouté une seule fois.
  const title = serpTitle(applyMarketTokens(opts.title, market, locale), locale);
  // Description bornée à ~155 caractères (largeur d'affichage Google).
  const description = serpDescription(
    applyMarketTokens(opts.description, market, locale),
  );
  const keywords = opts.keywords?.map((keyword) =>
    applyMarketTokens(keyword, market, locale),
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
      // La locale Open Graph décrit la LANGUE DE LA PAGE, pas le marché :
      // une page anglaise sur un marché libyen doit s'annoncer en en_US,
      // sinon les graphes sociaux et les moteurs reçoivent un signal
      // contradictoire avec <html lang>.
      locale: locale === "ar" ? ogLocale(market.locale) : "en_US",
      alternateLocale:
        locale === "ar" ? ["en_US"] : [ogLocale(market.locale)],
      type: "website",
      // Dimensions déclarées uniquement pour l'image OG par défaut. Une
      // jaquette produit (carrée, 600×600 chez le fournisseur) annoncée en
      // 1376×768 produit un aperçu social recadré et un balisage faux.
      ...(ogImage
        ? {
            images: [
              {
                url: ogImage,
                alt: title,
                ...(ogImage.endsWith("/og.jpg")
                  ? { width: 1376, height: 768 }
                  : {}),
              },
            ],
          }
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
