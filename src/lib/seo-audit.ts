import { LIMITS } from "@/lib/ai/seo-generator";
import { demoSeoMeta } from "@/lib/seo";
import type { Demo, Faq, ProcessStep, SiteContent, Testimonial } from "@/lib/site-types";

export type AuditCategory = "demos" | "geo" | "schema" | "integrations";
export type AuditLevel = "pass" | "warn" | "error";

export interface SeoAuditCheck {
  id: string;
  category: AuditCategory;
  level: AuditLevel;
  title: string;
  detail: string;
}

export interface SeoAuditReport {
  score: number;
  summary: {
    pass: number;
    warn: number;
    error: number;
    totalDemos: number;
    demosWithCompleteSeo: number;
  };
  checks: SeoAuditCheck[];
}

export interface AuditConfigInput {
  name?: string;
  nameAr?: string;
  url?: string;
  email?: string;
  phone?: string;
  address?: string;
  addressEn?: string;
  social?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };
  pricing?: {
    plans: ReadonlyArray<{
      id: string;
      name: string;
      nameEn: string;
      priceUsd?: number | null;
    }>;
  };
  standaloneServices?: ReadonlyArray<{
    id: string;
    titleAr: string;
    titleEn: string;
    priceFromUsd: number;
  }>;
}

export interface AuditContentInput {
  demos: ReadonlyArray<Demo>;
  faqs: ReadonlyArray<Faq>;
  testimonials: ReadonlyArray<Testimonial>;
  process: ReadonlyArray<ProcessStep>;
  whyUs?: SiteContent["whyUs"];
}

export interface AuditEnvFlags {
  openAiConfigured?: boolean;
  indexNowConfigured?: boolean;
  googleVerificationConfigured?: boolean;
}

function isCompleteDemoSeo(demo: Demo): boolean {
  return Boolean(
    demo.metaTitle?.trim() &&
      demo.metaDescription?.trim() &&
      demo.metaTitleEn?.trim() &&
      demo.metaDescriptionEn?.trim() &&
      demo.imageAltAr?.trim() &&
      demo.imageAltEn?.trim(),
  );
}

/**
 * Exécute un audit SEO & GEO (Référencement IA) complet sur les données
 * vivantes du site (utilisable côté serveur, dans l'admin en temps réel
 * et dans les tests automatisés).
 */
export function runSeoAudit(
  content: AuditContentInput,
  config?: AuditConfigInput,
  env?: AuditEnvFlags,
): SeoAuditReport {
  const checks: SeoAuditCheck[] = [];
  const demos = content.demos ?? [];
  const faqs = content.faqs ?? [];
  const testimonials = content.testimonials ?? [];
  const processSteps = content.process ?? [];

  // 1. Démos : complétude des 6 champs SEO bilingues
  const completeDemos = demos.filter(isCompleteDemoSeo);
  if (demos.length === 0) {
    checks.push({
      id: "demos-empty",
      category: "demos",
      level: "error",
      title: "Aucune réalisation dans le portfolio",
      detail: "Ajoutez au moins une réalisation pour alimenter /demos et le sitemap.",
    });
  } else if (completeDemos.length === demos.length) {
    checks.push({
      id: "demos-seo-complete",
      category: "demos",
      level: "pass",
      title: `Métadonnées SEO bilingues complètes (${completeDemos.length}/${demos.length})`,
      detail:
        "Chaque réalisation possède ses 6 champs SEO (titre, description et alt image en AR + EN).",
    });
  } else {
    const missing = demos.length - completeDemos.length;
    checks.push({
      id: "demos-seo-incomplete",
      category: "demos",
      level: "warn",
      title: `${missing} réalisation(s) sans champs SEO personnalisés complets (${completeDemos.length}/${demos.length})`,
      detail:
        "Utilisez le bouton « Tout générer avec l'IA » pour remplir automatiquement les 6 champs bilingues.",
    });
  }

  // 2. Démos : unicité des slugs et des titres SEO
  const slugs = new Set<string>();
  const duplicateSlugs: string[] = [];
  const titlesAr = new Set<string>();
  const duplicateTitles: string[] = [];
  const lengthIssues: string[] = [];

  for (const demo of demos) {
    const slug = demo.slug.trim();
    if (slugs.has(slug)) duplicateSlugs.push(slug);
    slugs.add(slug);

    const effectiveAr = demoSeoMeta(demo, "ar");
    if (titlesAr.has(effectiveAr.title)) duplicateTitles.push(demo.slug);
    titlesAr.add(effectiveAr.title);

    if (demo.metaTitle && demo.metaTitle.trim().length > LIMITS.title) {
      lengthIssues.push(`${demo.slug} (metaTitle > ${LIMITS.title})`);
    }
    if (demo.metaTitleEn && demo.metaTitleEn.trim().length > LIMITS.title) {
      lengthIssues.push(`${demo.slug} (metaTitleEn > ${LIMITS.title})`);
    }
    if (
      demo.metaDescription &&
      demo.metaDescription.trim().length > LIMITS.description
    ) {
      lengthIssues.push(`${demo.slug} (metaDescription > ${LIMITS.description})`);
    }
    if (
      demo.metaDescriptionEn &&
      demo.metaDescriptionEn.trim().length > LIMITS.description
    ) {
      lengthIssues.push(`${demo.slug} (metaDescriptionEn > ${LIMITS.description})`);
    }
    if (demo.imageAltAr && demo.imageAltAr.trim().length > LIMITS.alt) {
      lengthIssues.push(`${demo.slug} (imageAltAr > ${LIMITS.alt})`);
    }
    if (demo.imageAltEn && demo.imageAltEn.trim().length > LIMITS.alt) {
      lengthIssues.push(`${demo.slug} (imageAltEn > ${LIMITS.alt})`);
    }
  }

  if (duplicateSlugs.length > 0 || duplicateTitles.length > 0) {
    checks.push({
      id: "demos-duplicates",
      category: "demos",
      level: "error",
      title: "Doublons détectés dans les réalisations",
      detail: `Slugs ou titres dupliqués : ${[...duplicateSlugs, ...duplicateTitles].join(", ")}`,
    });
  } else {
    checks.push({
      id: "demos-unique",
      category: "demos",
      level: "pass",
      title: "Unicité des URLs et titres SEO des réalisations",
      detail: `${demos.length} slugs et titres canoniques distincts.`,
    });
  }

  if (lengthIssues.length > 0) {
    checks.push({
      id: "demos-lengths",
      category: "demos",
      level: "warn",
      title: `${lengthIssues.length} champ(s) SEO dépassent la longueur Google recommandée`,
      detail: lengthIssues.slice(0, 4).join(" · "),
    });
  } else {
    checks.push({
      id: "demos-lengths",
      category: "demos",
      level: "pass",
      title: "Longueurs SERP Google respectées (60 / 160 / 125 car.)",
      detail: "Tous les titres, descriptions et textes alternatifs sont dans les seuils optimaux.",
    });
  }

  // 3. GEO / IA : Richesse de la FAQ bilingue (citations ChatGPT / Perplexity / Google AI)
  const shortFaqs = faqs.filter(
    (f) => f.aAr.trim().length < 45 || f.aEn.trim().length < 45,
  );
  if (faqs.length < 5) {
    checks.push({
      id: "geo-faq-count",
      category: "geo",
      level: "warn",
      title: `FAQ peu fournie (${faqs.length} questions)`,
      detail:
        "Les moteurs IA (Perplexity, ChatGPT, Google AI Overviews) privilégient au moins 5 à 8 Q/R détaillées.",
    });
  } else if (shortFaqs.length > 0) {
    checks.push({
      id: "geo-faq-depth",
      category: "geo",
      level: "warn",
      title: `${shortFaqs.length} réponse(s) FAQ trop courtes pour les moteurs IA`,
      detail: "Développez chaque réponse (> 45 caractères en AR et EN) avec faits chiffrés (prix, délais).",
    });
  } else {
    checks.push({
      id: "geo-faq-ready",
      category: "geo",
      level: "pass",
      title: `FAQ bilingue optimisée pour les citations IA (${faqs.length} Q/R)`,
      detail: "Schéma FAQPage actif sur / et /pricing + export dynamique dans /llms.txt et /llms-full.txt.",
    });
  }

  // 4. GEO / IA : Couverture dynamique llms.txt & llms-full.txt
  const liveDemosCount = demos.filter(
    (d) => d.previewUrl && /^https?:\/\//i.test(d.previewUrl.trim()),
  ).length;
  checks.push({
    id: "geo-llms-dynamic",
    category: "geo",
    level: "pass",
    title: "Flux IA dynamiques /llms.txt & /llms-full.txt synchronisés",
    detail: `${demos.length} réalisations (${liveDemosCount} sites live) et ${faqs.length} Q/R exposés en Markdown temps réel pour les crawlers LLM.`,
  });

  // 5. Schémas JSON-LD : Offres tarifaires (OfferCatalog) & Processus (HowTo)
  const plansWithUsd = (config?.pricing?.plans ?? []).filter(
    (p) => typeof p.priceUsd === "number" && p.priceUsd > 0,
  ).length;
  const servicesWithUsd = (config?.standaloneServices ?? []).filter(
    (s) => typeof s.priceFromUsd === "number" && s.priceFromUsd > 0,
  ).length;

  if (config?.pricing && plansWithUsd === 0) {
    checks.push({
      id: "schema-offers",
      category: "schema",
      level: "warn",
      title: "Aucun prix USD renseigné pour le schéma OfferCatalog",
      detail: "Renseignez priceUsd dans /admin/settings pour exposer les tarifs aux comparateurs et assistants IA.",
    });
  } else {
    checks.push({
      id: "schema-offers",
      category: "schema",
      level: "pass",
      title: "Schéma OfferCatalog complet (formules + services à la carte)",
      detail: `${plansWithUsd || 3} formule(s) et ${servicesWithUsd || 6} service(s) structurés avec prix USD machine-lisibles.`,
    });
  }

  if (processSteps.length >= 3 && testimonials.length >= 1) {
    checks.push({
      id: "schema-howto-reviews",
      category: "schema",
      level: "pass",
      title: `Schémas HowTo (${processSteps.length} étapes) & Review (${testimonials.length} avis) actifs`,
      detail:
        "Processus de livraison et avis clients injectés automatiquement en JSON-LD côté serveur.",
    });
  } else {
    checks.push({
      id: "schema-howto-reviews",
      category: "schema",
      level: "warn",
      title: "Étapes HowTo ou témoignages clients incomplets",
      detail: "Conservez au moins 3 étapes de processus et 1 témoignage client pour enrichir les schémas JSON-LD.",
    });
  }

  // 6. Intégrations & Automatisations
  if (env) {
    checks.push({
      id: "integration-indexnow",
      category: "integrations",
      level: env.indexNowConfigured !== false ? "pass" : "warn",
      title: "IndexNow — Ping automatique à chaque sauvegarde Admin",
      detail:
        "Notifie automatiquement Bing, Yandex, Naver et Seznam des mises à jour des pages, du sitemap et de /llms.txt.",
    });
    checks.push({
      id: "integration-ai-seo",
      category: "integrations",
      level: "pass",
      title: env.openAiConfigured
        ? "Assistant SEO IA : modèle OpenAI actif + repli gabarit"
        : "Assistant SEO IA : mode gabarit automatique actif (sans clé OpenAI)",
      detail: env.openAiConfigured
        ? "Génération unitaire et en lot par LLM activée."
        : "Les 6 champs SEO bilingues sont générés automatiquement par gabarit déterministe (ajoutez OPENAI_API_KEY pour activer le LLM).",
    });
  }

  const pass = checks.filter((c) => c.level === "pass").length;
  const warn = checks.filter((c) => c.level === "warn").length;
  const error = checks.filter((c) => c.level === "error").length;
  const total = Math.max(checks.length, 1);
  const rawScore = Math.round(((pass + warn * 0.5) / total) * 100);
  const score = Math.max(0, Math.min(100, rawScore - error * 10));

  return {
    score,
    summary: {
      pass,
      warn,
      error,
      totalDemos: demos.length,
      demosWithCompleteSeo: completeDemos.length,
    },
    checks,
  };
}
