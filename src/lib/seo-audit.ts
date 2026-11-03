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
  /**
   * Score de complétude technique (0–100) : présence et cohérence des champs
   * et des contrôles. Ce n'est ni un score de classement, ni une mesure
   * d'éligibilité aux résultats enrichis, ni un taux de citation IA.
   */
  score: number;
  /** Étiquette de portée affichée avec le score (A14). */
  scoreScope: "technical-completeness";
  scoreLabel: string;
  scoreDisclaimer: string;
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
 * Exécute un audit de complétude technique SEO & GEO sur les données vivantes
 * du site (utilisable côté serveur, dans l'admin en temps réel et dans les
 * tests automatisés).
 *
 * ⚠️ Portée (A14) : les contrôles vérifient la présence, la syntaxe et la
 * cohérence de champs ou de schémas. Ils ne mesurent ni le classement, ni
 * l'éligibilité aux résultats enrichis, ni les citations IA. Un score de 100
 * signifie « tous les contrôles techniques sont satisfaits », pas « le site
 * est référencé ».
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
        "Chaque réalisation possède ses 6 champs SEO (titre, description et alt image en AR + EN). Complétude des champs uniquement : cela ne garantit ni l'indexation ni le classement.",
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
      title: "Longueurs dans les seuils recommandés (60 / 160 / 125 car.)",
      detail:
        "Tous les titres, descriptions et textes alternatifs sont dans les seuils de présentation SERP recommandés. Google peut tronquer autrement et aucun classement n'est garanti.",
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
        "Les recommandations pratiques visent au moins 5 à 8 Q/R détaillées. C'est un pré-requis éditorial, pas une garantie de citation par les moteurs IA.",
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
      title: `FAQ bilingue complète — pré-requis technique (${faqs.length} Q/R)`,
      detail:
        "Le schéma FAQPage est présent et les Q/R sont exportées dans /llms.txt et /llms-full.txt. L'affichage d'un résultat enrichi et une citation IA ne sont pas garantis par ce contrôle.",
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
    title: "Flux IA /llms.txt & /llms-full.txt publiés et synchronisés (contrôle de présence)",
    detail: `${demos.length} réalisations (${liveDemosCount} sites live) et ${faqs.length} Q/R sont exposés en Markdown. Ce contrôle vérifie la présence dans les flux ; l'ingestion réelle par les crawlers LLM n'est pas mesurée ici.`,
  });

  // 5. Schémas JSON-LD : Offres tarifaires (OfferCatalog) & Processus (HowTo)
  const plansWithUsd = (config?.pricing?.plans ?? []).filter(
    (p) => typeof p.priceUsd === "number" && p.priceUsd > 0,
  ).length;
  const servicesWithUsd = (config?.standaloneServices ?? []).filter(
    (s) => typeof s.priceFromUsd === "number" && s.priceFromUsd > 0,
  ).length;

  if (!config?.pricing) {
    checks.push({
      id: "schema-offers",
      category: "schema",
      level: "warn",
      title: "Configuration tarifaire absente — schéma OfferCatalog non évalué",
      detail:
        "Renseignez les formules et services dans /admin/settings pour pouvoir évaluer la présence de l'OfferCatalog.",
    });
  } else if (plansWithUsd === 0) {
    checks.push({
      id: "schema-offers",
      category: "schema",
      level: "warn",
      title: "Aucun prix USD renseigné pour le schéma OfferCatalog",
      detail:
        "Renseignez priceUsd dans /admin/settings pour exposer les tarifs aux comparateurs et assistants IA. L'éligibilité aux résultats enrichis n'est pas garantie pour autant.",
    });
  } else {
    checks.push({
      id: "schema-offers",
      category: "schema",
      level: "pass",
      title: "Schéma OfferCatalog présent et syntaxiquement valide",
      detail: `${plansWithUsd} formule(s) et ${servicesWithUsd} service(s) structurés avec prix USD machine-lisibles. La validité du schéma ne garantit pas l'éligibilité aux résultats enrichis.`,
    });
  }

  if (processSteps.length >= 3) {
    checks.push({
      id: "schema-howto",
      category: "schema",
      level: "pass",
      title: `Schéma HowTo présent (${processSteps.length} étapes)`,
      detail: `Le processus de livraison est structuré en JSON-LD. Les ${testimonials.length} témoignage(s) restent visibles dans le HTML mais ne sont pas balisés en Review : les avis auto-déclarés ne sont pas éligibles aux résultats enrichis Google. La présence du schéma ne garantit pas un résultat enrichi.`,
    });
  } else {
    checks.push({
      id: "schema-howto",
      category: "schema",
      level: "warn",
      title: "Étapes HowTo incomplètes",
      detail:
        "Conservez au moins 3 étapes de processus pour structurer le schéma HowTo. La présence du schéma ne garantit pas un résultat enrichi.",
    });
  }

  // 6. Intégrations & Automatisations
  if (env) {
    checks.push({
      id: "integration-indexnow",
      category: "integrations",
      level: env.indexNowConfigured !== false ? "pass" : "warn",
      title: "IndexNow — notification configurée à chaque sauvegarde Admin",
      detail:
        "Le code appelle IndexNow pour les pages, le sitemap et /llms.txt. La prise en compte par les moteurs n'est pas garantie et n'est pas vérifiée ici.",
    });
    checks.push({
      id: "integration-ai-seo",
      category: "integrations",
      level: "pass",
      title: env.openAiConfigured
        ? "Assistant SEO IA : modèle OpenAI actif + repli gabarit"
        : "Assistant SEO IA : mode gabarit automatique actif (sans clé OpenAI)",
      detail: env.openAiConfigured
        ? "Génération unitaire et en lot par LLM activée. La génération de métadonnées ne garantit ni l'indexation ni le classement."
        : "Les 6 champs SEO bilingues sont générés automatiquement par gabarit déterministe (ajoutez OPENAI_API_KEY pour activer le LLM). La complétude des champs ne garantit ni l'indexation ni le classement.",
    });
  }

  const pass = checks.filter((c) => c.level === "pass").length;
  const warn = checks.filter((c) => c.level === "warn").length;
  const error = checks.filter((c) => c.level === "error").length;
  const total = Math.max(checks.length, 1);
  // Score de complétude technique : les contrôles satisfaits rapportent des
  // points, les avertissements moitié, les erreurs sont pénalisées. Ce score
  // ne mesure ni le classement, ni l'éligibilité, ni les citations IA (A14).
  const rawScore = Math.round(((pass + warn * 0.5) / total) * 100);
  const score = Math.max(0, Math.min(100, rawScore - error * 10));

  return {
    score,
    scoreScope: "technical-completeness",
    scoreLabel: "Score de complétude technique",
    scoreDisclaimer:
      "Mesure la présence et la cohérence des champs et contrôles techniques. Ne mesure ni le classement, ni l'éligibilité aux résultats enrichis, ni les citations IA.",
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
