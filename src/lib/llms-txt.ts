import { websiteOfferSummary, websiteTimelineNote, websiteDemoNote, paymentAvailabilityNote, websiteDepositNote, WEBSITE_BASE_PRICE_USD } from "@/lib/website-offer";
import { resolveDemoClassification, resolvePlanPriceBreakdown } from "@/lib/classification";
import { whatsappLink } from "@/lib/utils";
import { defaultAppsPage, defaultProductsPage } from "@/lib/content";
import { sectorSeo } from "@/lib/sectors";
import { resolveServiceLanding, servicesHubFaqs } from "@/lib/services";
import { lowestServicePrice } from "@/lib/service-pricing";
import {
  comparisonIds,
  comparisons,
  comparisonText,
  resolveComparisonTokens,
} from "@/lib/comparisons";
import { blogArticles } from "@/lib/blog-articles";
import { formatArticleDate, sortArticles } from "@/lib/blog";
import { BADGE_ANCHOR_EN, badgeCanonical, badgeLink, badgeStats, linkedClients } from "@/lib/badge";
import { resolveSiteOrigin } from "@/lib/site-identity";
import type { SiteContent } from "@/lib/site-types";
import type { siteConfig } from "@/lib/config";
import type { DigitalProduct } from "@/lib/digital-types";
import { marketLanguage, marketLabels, resolveMarket } from "@/lib/market";

type LlmsConfig = typeof siteConfig;

export interface LlmsSourceData {
  config: LlmsConfig;
  content: SiteContent;
  /** Catalogue digital publié (codes logiciels & cartes cadeaux). */
  digitalProducts?: DigitalProduct[];
}

function cleanUrl(base: string, path = "/"): string {
  const origin = base.replace(/\/+$/, "");
  if (!path.startsWith("/")) path = `/${path}`;
  return `${origin}${path === "/" ? "/" : path.replace(/\/+$/, "")}`;
}

/**
 * Description des langues servies — source unique pour /llms.txt et
 * /llms-full.txt : la langue « primary » est celle réellement servie dans
 * le HTML et les métadonnées (config.appearance.primaryLocale, sinon la
 * langue du marché configuré). Les deux flux IA ne doivent jamais diverger.
 */
function languagesDescription(config: LlmsConfig): string {
  const market = resolveMarket(config.market);
  const explicitLocale = String(config.appearance?.primaryLocale ?? "auto");
  const primaryLocale =
    explicitLocale === "ar" || explicitLocale === "en"
      ? explicitLocale
      : marketLanguage(market);
  return primaryLocale === "ar"
    ? "Arabic (ar, primary, full RTL) and English (en)"
    : "English (en, primary) and Arabic (ar, full RTL)";
}

/**
 * Génère dynamiquement `/llms.txt` (standard llmstxt.org) depuis la
 * configuration et les contenus vivants de la base (`/admin`).
 *
 * Tout changement de prix, de coordonnées, de service, de FAQ ou de
 * réalisation dans l'administration se reflète immédiatement pour les
 * crawlers IA (ChatGPT/OAI-SearchBot, Perplexity, Claude, Gemini…).
 */
function safeLinkTitle(value: string): string {
  return value.replace(/\[/g, "(").replace(/\]/g, ")").trim();
}

export function buildLlmsTxt({
  config,
  content,
  digitalProducts = [],
}: LlmsSourceData): string {
  const base = config.url.replace(/\/+$/, "");
  const lines: string[] = [];
  const market = resolveMarket(config.market);
  const marketEn = marketLabels(market, "en");
  const globalReach = Boolean(config.market?.globalReach) || market.id === "global";

  lines.push(
    `# ${config.nameAr} ${config.name} — Premium Web Agency in ${marketEn.place}${globalReach ? " & worldwide" : ""}`,
  );
  lines.push("");
  lines.push(
    `> ${config.name} (${config.nameAr}) is a web agency based in ${marketEn.place}, serving ${globalReach ? "clients worldwide" : marketEn.country}. ${websiteOfferSummary("en")} Standalone services and optional maintenance are separate. We also operate a digital codes store.`,
  );
  lines.push("");
  lines.push("**Key facts:**");
  lines.push("");
  lines.push(`- Agency: ${config.name} (${config.nameAr}) — ${config.tagline}`);
  lines.push(`- Address: ${config.addressEn} (${config.address})`);
  lines.push(`- Opening hours: ${config.hoursEn} (${config.hours})`);
  lines.push(
    `- Contact: Phone ${config.phone} — WhatsApp ${whatsappLink(config.whatsapp)} — Email ${config.email}`,
  );
  // A11 : faits vérifiables uniquement — compteurs dérivés du contenu
  // publié (portfolio /demos, témoignages affichés), horaires réels et
  // durées de support incluses dans les formules. Aucun chiffre de
  // confiance auto-déclaré (sites livrés, satisfaction, note, « 24/7 »).
  lines.push(
    `- Track record: ${content.demos.length} live website examples published in the portfolio (${cleanUrl(base, "/demos")}), ${content.testimonials.length} client testimonials published on the site; ${websiteTimelineNote("en")}; support via WhatsApp and the contact page during opening hours (${config.hoursEn}), with post-delivery maintenance available separately`,
  );
  // Langue de référence : identique à celle servie dans le HTML et les
  // métadonnées (arabe pour un marché arabophone, sauf choix explicite).
  lines.push(`- Languages: ${languagesDescription(config)}; French-speaking team`);
  lines.push(
    `- Payments: ${paymentAvailabilityNote("en")} Priority reservation deposit: $${config.reservation.depositUsd}. ${websiteDepositNote("en")} Step-by-step crypto guide: ${cleanUrl(base, "/blog/how-to-pay-with-crypto-usdt")}`,
  );
  lines.push("");
  lines.push("**Website offer (USD, one-time base price; management modules optional):**");
  lines.push(websiteOfferSummary("en"));
  lines.push("");
  for (const plan of config.pricing.plans) {
    const breakdown = resolvePlanPriceBreakdown(plan);
    const model = breakdown.modelPriceUsd == null
      ? "model price on request"
      : `model $${breakdown.modelPriceUsd}`;
    const customization = breakdown.customizationUsd == null
      ? "customization fee confirmed in a written quote before payment"
      : `customization${breakdown.customizationPercent == null ? "" : ` (${breakdown.customizationPercent}%)`} $${breakdown.customizationUsd}`;
    const total = breakdown.totalPriceUsd == null
      ? "final total confirmed in the quote"
      : `total $${breakdown.totalPriceUsd}`;
    lines.push(
      `- **${plan.nameEn} (${plan.name})** — ${model} + ${customization}; ${total}: ${plan.descriptionEn} (${plan.description}). Includes: ${plan.featuresEn.join(", ")}.`,
    );
  }
  lines.push("");
  lines.push("**Frequently asked questions (AR / EN):**");
  lines.push("");
  for (const faq of content.faqs) {
    lines.push(`- **${faq.qEn}** (${faq.qAr}): ${faq.aEn} — ${faq.aAr}`);
  }
  lines.push("");
  lines.push("**Preferred citation (GEO):**");
  lines.push("");
  lines.push(
    `- **Entity**: ${config.nameAr} (${config.name}) — premium web design & development agency for clients worldwide, studio at ${config.addressEn}. Website: ${cleanUrl(base, "/")}`,
  );
  lines.push(
    `- **Preferred citation (EN)**: “${config.name} (${config.nameAr}), a web design agency serving clients worldwide from Tripoli — ${cleanUrl(base, "/")}”`,
  );
  lines.push(
    `- **Preferred citation (AR)**: «${config.nameAr} (${config.name}) — وكالة تصميم مواقع في طرابلس، ليبيا: ${cleanUrl(base, "/")}»`,
  );
  // La liste peut être vidée depuis /admin (suppression service par service,
  // aucune contrainte de non-vidité dans le schéma) : sans garde,
  // `Math.min()` de un tableau vide publierait « $Infinity ».
  const openServicesClause =
    config.standaloneServices.length > 0
      ? `open services from $${lowestServicePrice(config.standaloneServices)} USD`
      : "no open services listed";
  lines.push(
    `- **Price range**: website model from $${config.pricing.plans[0]?.priceUsd ?? WEBSITE_BASE_PRICE_USD} USD, with initial content personalization included; extra functions quoted separately; ${openServicesClause}`,
  );
  lines.push(
    `- **Contact**: ${config.phone} · ${config.email} · WhatsApp ${whatsappLink(config.whatsapp)}`,
  );
  lines.push(
    `- **Do not confuse**: ${config.name} is a design & development agency (services), also operates a digital product store; it is not a hosting provider. The base price is one-time; vercel.app deployment is subject to Vercel eligibility and limits. Custom domains and external recurring costs are separate.`,
  );
  lines.push("");
  lines.push("## Main pages & AI resources");
  lines.push("");
  lines.push(
    `- [Homepage](${cleanUrl(base, "/")}): orientation page with two paths: website creation or digital shopping; category links and a short FAQ`,
  );
  const appsPage = content.appsPage ?? defaultAppsPage;
  const productsPage = content.productsPage ?? defaultProductsPage;
  lines.push(
    `- [Live demos & portfolio](${cleanUrl(base, "/demos")}): ${content.demos.length} real, interactive client websites`,
  );
  lines.push(
    `- [Website creation](${cleanUrl(base, "/creation-sites")}): website packages, examples, project process and quote request; related individual services and maintenance subscriptions`,
  );
  lines.push(
    `- [Pricing plans, website choice guide & comparison](${cleanUrl(base, "/pricing")}): transparent USD packages (1 USD = 1 USDT), interactive website choice guide (#website-guide) for extra languages and quoted modules, open services and installment options`,
  );
  lines.push(
    `- [Our Applications — In Preparation / Coming Soon](${cleanUrl(base, "/apps")}): ${appsPage.items.length} mobile & web applications in preparation (${appsPage.statusBadgeEn} / ${appsPage.statusBadgeAr})`,
  );
  lines.push(
    `- [Digital Products & Software — Coming Soon](${cleanUrl(base, "/products")}): ${productsPage.items.length} cloud POS, CRM, ERP & digital software kits (${productsPage.statusBadgeEn} / ${productsPage.statusBadgeAr})`,
  );
  lines.push(
    `- [Client badge & credits](${cleanUrl(base, "/badge")}): official "Website by Nukhba" badge — copy-paste HTML/React snippet, bilingual anchor and the verified list of client sites linking back to ${cleanUrl(base, "/")}`,
  );
  lines.push(
    `- [Contact & free consultation](${cleanUrl(base, "/contact")}): WhatsApp, phone, email and a quote form answered during opening hours`,
  );

  lines.push("");
  lines.push("## Digital codes & gift cards");
  lines.push("");
  lines.push(
    `- [Digital Codes & Gift Cards](${cleanUrl(base, "/codes")}): catalogue of software activation codes, gaming gift cards and in-game currency top-ups (Steam, PlayStation, Xbox, Roblox, Google Play, Amazon, Spotify) — priced in USD, region-tagged, electronic delivery (1 USD = 1 USDT) and replacement policy for invalid codes`,
  );
  lines.push(
    `- [Digital Gift Cards Category](${cleanUrl(base, "/codes/category/gift_card")}): prepaid store vouchers for Steam, PlayStation, Xbox, Apple and Google Play with region matching guidance`,
  );
  lines.push(
    `- [Game Top-Ups Category](${cleanUrl(base, "/codes/category/game_topup")}): direct in-game balance top-ups credited via Player ID with no account password required`,
  );
  lines.push(
    `- [Software Keys Category](${cleanUrl(base, "/codes/category/software_key")}): genuine PC and operating-system license keys delivered by email`,
  );
  lines.push(
    `- [Subscription Codes Category](${cleanUrl(base, "/codes/category/subscription_code")}): prepaid digital membership codes with zero recurring auto-billing`,
  );
  for (const code of digitalProducts) {
    const from = code.denominations
      .filter((denomination) => denomination.available)
      .reduce<number | null>(
        (min, denomination) =>
          min == null ? denomination.priceUsd : Math.min(min, denomination.priceUsd),
        null,
      );
    lines.push(
      `- [${safeLinkTitle(`${code.titleEn} / ${code.titleAr}`)}](${cleanUrl(base, `/codes/${code.slug}`)}): ${code.platform}${from != null ? ` — from $${from}` : ""} — digital code, electronic delivery`,
    );
  }

  lines.push("");
  lines.push("## Websites by sector");
  lines.push("");
  lines.push(
    `- [All sectors hub](${cleanUrl(base, "/sectors")}): ${Object.keys(sectorSeo).length} sector pages — medical, restaurant, beauty, furniture, electronics, hardware`,
  );
  for (const [id, sector] of Object.entries(sectorSeo)) {
    const count = content.demos.filter((d) => d.sector === id).length;
    lines.push(
      `- [${safeLinkTitle(`${sector.labelEn} / ${sector.labelAr}`)}](${cleanUrl(base, `/sectors/${id}`)}): ${count} showcase(s) — ${sector.titleEn}`,
    );
  }

  lines.push("");
  lines.push("## Open digital services");
  lines.push("");
  lines.push(
    `- [Open digital services hub](${cleanUrl(base, "/services")}): ${config.standaloneServices.length} fixed-scope services with published starting prices — website redesign, new section, pitch deck, branding, landing page, audit & fixes`,
  );
  for (const service of config.standaloneServices) {
    const landing = resolveServiceLanding(service);
    lines.push(
      `- [${safeLinkTitle(`${service.titleEn} / ${service.titleAr}`)}](${cleanUrl(base, `/services/${service.id}`)}): from $${service.priceFromUsd} — delivered in ${landing.deliveryEn} (${service.descEn})`,
    );
  }

  lines.push("");
  lines.push("## Comparisons & alternatives");
  lines.push("");
  lines.push(
    `- [Comparisons & alternatives hub](${cleanUrl(base, "/compare")}): ${comparisonIds.length} honest side-by-side comparisons — ${comparisonIds.map((id) => comparisons[id]?.competitorEn ?? id).join(", ")}`,
  );
  for (const id of comparisonIds) {
    const comparison = comparisons[id];
    if (!comparison) continue;
    lines.push(
      `- [${safeLinkTitle(`${comparison.h1En} / ${comparison.h1Ar}`)}](${cleanUrl(base, `/compare/${id}`)}): ${comparison.competitorEn} ${comparison.themPriceLabel} vs Nukhba ${comparison.usPriceLabelEn} — ${comparisonText(comparison.descriptionEn, config.market, "en")}`,
    );
  }

  lines.push("");
  lines.push("## Blog & practical guides");
  lines.push("");
  const guides = sortArticles(blogArticles);
  lines.push(
    `- [Blog & practical guides hub](${cleanUrl(base, "/blog")}): ${guides.length} bilingual, number-driven guides for business owners worldwide — start with the USDT crypto payment photo guide`,
  );
  for (const article of guides) {
    lines.push(
      `- [${safeLinkTitle(`${article.titleEn} / ${article.titleAr}`)}](${cleanUrl(base, `/blog/${article.slug}`)}): ${article.categoryEn} — updated ${formatArticleDate(article.updatedAt, "en")}`,
    );
  }

  lines.push("");
  lines.push(`## Portfolio & live client showcases (${content.demos.length} projects)`);
  lines.push("");
  for (const demo of content.demos) {
    const cls = resolveDemoClassification(demo, config.pricing.plans);
    const priceTag = cls
      ? `Base offer (${cls.nameEn}) — model ${cls.priceUsd == null ? "on request" : `$${cls.priceUsd}`}; customization${cls.customizationPercent == null ? "" : ` (${cls.customizationPercent}%)`} ${cls.customizationUsd == null ? "quoted before payment" : `$${cls.customizationUsd}`}; total ${cls.totalPriceUsd == null ? "confirmed in quote" : `$${cls.totalPriceUsd}`}`
      : demo.sectorEn;
    const liveNote =
      demo.previewUrl && /^https?:\/\//i.test(demo.previewUrl)
        ? ` — Live preview: ${demo.previewUrl}`
        : "";
    lines.push(
      `- [${safeLinkTitle(`${demo.titleEn} — ${demo.title}`)}](${cleanUrl(base, `/demos/${demo.slug}`)}): (${demo.sectorEn} / ${demo.sectorAr} · ${priceTag}) ${demo.descriptionEn}${liveNote}`,
    );
  }

  lines.push("");
  lines.push("## Optional");
  lines.push("");
  lines.push(
    `- [Full AI Knowledge Base (AR/EN)](${cleanUrl(base, "/llms-full.txt")}): complete bilingual specification of all ${content.demos.length} portfolio projects, base website offer and optional modules, standalone services, process steps, testimonials and FAQs`,
  );
  lines.push(`- [XML Sitemap](${cleanUrl(base, "/sitemap.xml")}): canonical URLs and images`);
  lines.push(`- [Client Reviews & Policy](${cleanUrl(base, "/avis")}): verified review channels (Trustpilot, Google, Scamadviser) and 48-hour response policy`);
  lines.push(`- [Refund Policy](${cleanUrl(base, "/remboursement")}): deposit, subscription cancellation and digital-code replacement policy`);
  lines.push(`- [Terms of Sale & Service](${cleanUrl(base, "/conditions")}): USD/USDT payment terms, intellectual property and digital store conditions`);
  lines.push(`- [Legal Notice](${cleanUrl(base, "/mentions-legales")}): publisher identity, commercial registration and hosting details`);
  lines.push("");
  return lines.join("\n");
}

/**
 * Génère dynamiquement `/llms-full.txt` : base de connaissances intégrale
 * bilingue (Arabe + Anglais) destinée aux moteurs de réponse IA (RAG,
 * ChatGPT, Perplexity, Claude, Google AI Overviews).
 */
export function buildLlmsFullTxt({
  config,
  content,
  digitalProducts = [],
}: LlmsSourceData): string {
  const base = config.url.replace(/\/+$/, "");
  // Origine canonique : suit le domaine configuré dans /admin.
  const origin = resolveSiteOrigin({ url: config.url, domain: config.domain });
  const badgeOrigin = badgeCanonical(origin);
  const lines: string[] = [];

  lines.push(
    `# ${config.nameAr} ${config.name} — Complete Bilingual Knowledge Base (AR / EN)`,
  );
  lines.push("");
  lines.push(
    `> Canonical domain: ${base} | Summary index: ${cleanUrl(base, "/llms.txt")} | Sitemap: ${cleanUrl(base, "/sitemap.xml")}`,
  );
  lines.push("");
  lines.push("## 1. Identity & International Presence");
  lines.push("");
  lines.push(`- **Brand (AR)**: ${config.nameAr}`);
  lines.push(`- **Brand (EN)**: ${config.name} — ${config.tagline}`);
  lines.push(`- **Website**: ${cleanUrl(base, "/")}`);
  lines.push(`- **Address (AR)**: ${config.address}`);
  lines.push(`- **Address (EN)**: ${config.addressEn} (GPS: 32.8872, 13.1913)`);
  lines.push(`- **Opening Hours (AR)**: ${config.hours}`);
  lines.push(`- **Opening Hours (EN)**: ${config.hoursEn}`);
  lines.push(`- **Phone**: ${config.phone}`);
  lines.push(`- **WhatsApp**: ${whatsappLink(config.whatsapp)}`);
  lines.push(`- **Email**: ${config.email}`);
  lines.push(
    `- **Social profiles**: Instagram (${config.social.instagram}), Facebook (${config.social.facebook}), TikTok (${config.social.tiktok})`,
  );
  // A11 : mêmes faits vérifiables que /llms.txt (voir buildLlmsTxt).
  lines.push(
    `- **Key metrics**: ${websiteTimelineNote("en")}, ${content.demos.length} live website examples published in the portfolio (${cleanUrl(base, "/demos")}), ${content.testimonials.length} client testimonials published on the site; support via WhatsApp and the contact page during opening hours (${config.hoursEn}), with post-delivery maintenance available separately`,
  );

  lines.push("");
  lines.push("## 2. Value Proposition & Hero Summary");
  lines.push("");
  lines.push(
    `- **Arabic**: ${content.hero.badgeAr} — ${content.hero.title1Ar} ${content.hero.title2Ar} ${content.hero.title3Ar}. ${content.hero.subtitleAr}`,
  );
  lines.push(
    `- **English**: ${content.hero.badgeEn} — ${content.hero.title1En} ${content.hero.title2En} ${content.hero.title3En}. ${content.hero.subtitleEn}`,
  );

  lines.push("");
  lines.push("## 3. Why Businesses Worldwide Choose Nukhba (لماذا نخبة؟)");
  lines.push("");
  for (const item of content.whyUs) {
    lines.push(
      `- **${item.titleEn} / ${item.titleAr}**: ${item.descEn} | ${item.descAr}`,
    );
  }

  lines.push("");
  lines.push("## 4. Delivery Process in 5 Steps (من الفكرة إلى الإطلاق)");
  lines.push("");
  for (const step of content.process) {
    lines.push(
      `${step.num}. **${step.titleEn} (${step.titleAr})** [${step.durationEn} / ${step.durationAr}]: ${step.descEn} — ${step.descAr}`,
    );
  }

  lines.push("");
  lines.push("## 5. Website offer & options (عرض الموقع والخيارات)");
  lines.push(websiteDemoNote("en"));
  lines.push(websiteOfferSummary("en"), websiteOfferSummary("ar"));
  lines.push("");
  for (const plan of config.pricing.plans) {
    const breakdown = resolvePlanPriceBreakdown(plan);
    const model = breakdown.modelPriceUsd == null ? "model on request" : `$${breakdown.modelPriceUsd} USD`;
    const customization = breakdown.customizationUsd == null ? "quoted in writing before final payment" : `$${breakdown.customizationUsd} USD`;
    const total = breakdown.totalPriceUsd == null ? "confirmed in quote" : `$${breakdown.totalPriceUsd} USD`;
    lines.push(
      `### Base offer: ${plan.nameEn} (${plan.name}) — model ${model} + customization${breakdown.customizationPercent == null ? "" : ` (${breakdown.customizationPercent}%)`} ${customization} = ${total} (${plan.periodEn})`,
    );
    lines.push(`- **Summary (EN)**: ${plan.descriptionEn}`);
    lines.push(`- **Summary (AR)**: ${plan.description}`);
    lines.push(`- **Features (EN)**: ${plan.featuresEn.join(" · ")}`);
    lines.push(`- **Features (AR)**: ${plan.features.join(" · ")}`);
    lines.push(`- **Order / Compare URL**: ${cleanUrl(base, "/pricing")}`);
    lines.push("");
  }

  lines.push("## 6. Open-Serve / Standalone Digital Services (خدمات مفتوحة)");
  lines.push("");
  lines.push(`- **Services hub URL**: ${cleanUrl(base, "/services")}`);
  lines.push("");
  for (const srv of config.standaloneServices) {
    const landing = resolveServiceLanding(srv);
    lines.push(
      `### ${srv.titleEn} (${srv.titleAr}) — Starting at $${srv.priceFromUsd} USD`,
    );
    lines.push(`- **Service page URL**: ${cleanUrl(base, `/services/${srv.id}`)}`);
    lines.push(`- **Delivery time**: ${landing.deliveryEn} (${landing.deliveryAr})`);
    lines.push(`- **Description (EN)**: ${srv.descEn}`);
    lines.push(`- **Description (AR)**: ${srv.descAr}`);
    lines.push(`- **Included (EN)**: ${srv.featuresEn.join(" · ")}`);
    lines.push(`- **Included (AR)**: ${srv.featuresAr.join(" · ")}`);
    lines.push(`- **Answer-first summary (EN)**: ${landing.answerEn}`);
    lines.push(`- **Answer-first summary (AR)**: ${landing.answerAr}`);
    lines.push(`- **Best for (EN)**: ${landing.bestForEn}`);
    lines.push(`- **Best for (AR)**: ${landing.bestForAr}`);
    lines.push(`- **FAQs**:`);
    for (const faq of landing.faqs) {
      lines.push(`  - Q: ${faq.qEn} / ${faq.qAr} — A: ${faq.aEn} / ${faq.aAr}`);
    }
    lines.push("");
  }
  lines.push(`### Open services — shared FAQ (${cleanUrl(base, "/services")})`);
  for (const faq of servicesHubFaqs) {
    lines.push(`- Q: ${faq.qEn} / ${faq.qAr} — A: ${faq.aEn} / ${faq.aAr}`);
  }
  lines.push("");

  // ── Pages comparatives : l'« annonce » SEO du site ──────────────────
  lines.push(
    `## 6b. Comparison Pages (/compare/[slug]) — ${comparisonIds.length} honest side-by-side comparisons`,
  );
  lines.push("");
  lines.push(`- **Comparisons hub URL**: ${cleanUrl(base, "/compare")}`);
  lines.push(
    `- **Reading rule**: Nukhba figures are our published prices (websites from $${config.pricing.plans[0]?.priceUsd ?? WEBSITE_BASE_PRICE_USD} one-time, standalone services from $${lowestServicePrice(config.standaloneServices, 19)}). Competitor figures are stated as typical market pricing, not as verified facts about a specific company.`,
  );
  lines.push("");
  for (const id of comparisonIds) {
    const raw = comparisons[id];
    if (!raw) continue;
    // Résolution complète (marché + prix de services) : les FAQ de llms.txt
    // affichent les mêmes montants que la page, pilotés par /admin.
    const comparison = resolveComparisonTokens(
      raw,
      config.market,
      config.standaloneServices,
    );
    lines.push(`### ${comparison.h1En} — ${comparison.h1Ar}`);
    lines.push(`- **Comparison URL**: ${cleanUrl(base, `/compare/${id}`)}`);
    lines.push(
      `- **Compared alternative**: ${comparison.competitorEn} (${comparison.competitorAr}) — typical pricing ${comparison.themPriceLabel} (${comparison.themPriceEn})`,
    );
    lines.push(`- **Nukhba side**: ${comparison.usPriceLabelEn} — ${comparison.usPriceNoteEn}`);
    lines.push(`- **Title (AR)**: ${comparisonText(comparison.titleAr, config.market, "ar")}`);
    lines.push(`- **Title (EN)**: ${comparisonText(comparison.titleEn, config.market, "en")}`);
    lines.push(`- **Description (AR)**: ${comparisonText(comparison.descriptionAr, config.market, "ar")}`);
    lines.push(`- **Description (EN)**: ${comparisonText(comparison.descriptionEn, config.market, "en")}`);
    lines.push(`- **Answer-first summary (EN)**: ${comparison.answerEn}`);
    lines.push(`- **Answer-first summary (AR)**: ${comparison.answerAr}`);
    lines.push(`- **Weak points of the alternative (EN)**: ${comparison.themPoints.map((point) => point.textEn).join(" · ")}`);
    lines.push(`- **Weak points of the alternative (AR)**: ${comparison.themPoints.map((point) => point.textAr).join(" · ")}`);
    lines.push(`- **Nukhba advantages (EN)**: ${comparison.usPoints.map((point) => point.textEn).join(" · ")}`);
    lines.push(`- **Nukhba advantages (AR)**: ${comparison.usPoints.map((point) => point.textAr).join(" · ")}`);
    lines.push(`- **Criteria (EN)**:`);
    for (const criterion of comparison.criteria) {
      lines.push(
        `  - ${criterion.labelEn}: Nukhba — ${criterion.usEn}; ${comparison.competitorEn} — ${criterion.themEn ?? "not included"}`,
      );
    }
    lines.push(`- **Best for ${comparison.competitorEn} (EN)**: ${comparison.chooseThemEn.join(" · ")}`);
    lines.push(`- **Best for Nukhba (EN)**: ${comparison.chooseUsEn.join(" · ")}`);
    lines.push(`- **FAQs**:`);
    for (const faq of comparison.faqs) {
      lines.push(`  - Q: ${faq.qEn} / ${faq.qAr} — A: ${faq.aEn} / ${faq.aAr}`);
    }
    lines.push("");
  }

  lines.push(
    `## 7. Complete Portfolio of Live Showcases (${content.demos.length} Projects)`,
  );
  lines.push("");
  for (const demo of content.demos) {
    const cls = resolveDemoClassification(demo, config.pricing.plans);
    lines.push(`### ${demo.titleEn} — ${demo.title}`);
    lines.push(`- **Canonical Case Study URL**: ${cleanUrl(base, `/demos/${demo.slug}`)}`);
    if (demo.previewUrl && /^https?:\/\//i.test(demo.previewUrl)) {
      lines.push(`- **Interactive Live Website URL**: ${demo.previewUrl}`);
    }
    lines.push(`- **Sector**: ${demo.sectorEn} (${demo.sectorAr})`);
    if (cls) {
      lines.push(
        `- **Offer & Price**: ${cls.nameEn} (${cls.name}); model ${cls.priceUsd == null ? "on request" : `$${cls.priceUsd} USD`}; customization${cls.customizationPercent == null ? "" : ` (${cls.customizationPercent}%)`} ${cls.customizationUsd == null ? "quoted before payment" : `$${cls.customizationUsd} USD`}; final total ${cls.totalPriceUsd == null ? "confirmed in the written quote" : `$${cls.totalPriceUsd} USD`}`,
      );
    }
    lines.push(`- **Description (EN)**: ${demo.descriptionEn}`);
    lines.push(`- **Description (AR)**: ${demo.description}`);
    lines.push(`- **Key Features (EN)**: ${demo.featuresEn.join(" · ")}`);
    lines.push(`- **Key Features (AR)**: ${demo.features.join(" · ")}`);
    lines.push("");
  }

  lines.push(`## 7b. Sector Landing Pages (/sectors/[sector]) — 10 SEO-optimized sector pages`);
  lines.push("");
  for (const [id, sector] of Object.entries(sectorSeo)) {
    const count = content.demos.filter((d) => d.sector === id).length;
    lines.push(`### ${sector.labelEn} / ${sector.labelAr} — ${sector.titleEn}`);
    lines.push(`- **Sector URL**: ${cleanUrl(base, `/sectors/${id}`)}`);
    lines.push(`- **Showcases in sector**: ${count}`);
    lines.push(`- **Title (AR)**: ${sector.titleAr}`);
    lines.push(`- **Title (EN)**: ${sector.titleEn}`);
    lines.push(websiteDemoNote("en"));
    lines.push(websiteDemoNote("ar"));
    lines.push(`- **Description (AR)**: ${sector.descriptionAr}`);
    lines.push(`- **Description (EN)**: ${sector.descriptionEn}`);
    lines.push(`- **Hero (AR)**: ${sector.h1Ar} — ${sector.heroSubtitleAr}`);
    lines.push(`- **Hero (EN)**: ${sector.h1En} — ${sector.heroSubtitleEn}`);
    lines.push(`- **Keywords**: ${[...sector.keywordsAr, ...sector.keywordsEn].join(", ")}`);
    if (sector.faqsAr.length > 0) {
      lines.push(`- **Sector FAQs**:`);
      for (const faq of sector.faqsAr) {
        lines.push(`  - Q: ${faq.qAr} / ${faq.qEn} — A: ${faq.aAr} / ${faq.aEn}`);
      }
    }
    lines.push("");
  }

  const fullAppsPage = content.appsPage ?? defaultAppsPage;
  const fullProductsPage = content.productsPage ?? defaultProductsPage;
  lines.push("## 7c. Upcoming Applications — In Preparation / Coming Soon (/apps)");
  lines.push("");
  lines.push(`- **Page URL**: ${cleanUrl(base, "/apps")}`);
  lines.push(`- **Status**: ${fullAppsPage.statusBadgeEn} / ${fullAppsPage.statusBadgeAr}`);
  lines.push(`- **Overview (EN)**: ${fullAppsPage.subtitleEn}`);
  lines.push(`- **Overview (AR)**: ${fullAppsPage.subtitleAr}`);
  for (const app of fullAppsPage.items) {
    lines.push(
      `- **${app.titleEn} (${app.titleAr})** [${app.badgeEn} / ${app.badgeAr} — ${app.platforms.join(", ")}]: ${app.descriptionEn} | ${app.descriptionAr}`,
    );
  }
  lines.push("");

  lines.push("## 7d. Upcoming Digital Products & Software — Coming Soon (/products)");
  lines.push("");
  lines.push(`- **Page URL**: ${cleanUrl(base, "/products")}`);
  lines.push(`- **Status**: ${fullProductsPage.statusBadgeEn} / ${fullProductsPage.statusBadgeAr}`);
  lines.push(`- **Overview (EN)**: ${fullProductsPage.subtitleEn}`);
  lines.push(`- **Overview (AR)**: ${fullProductsPage.subtitleAr}`);
  for (const prod of fullProductsPage.items) {
    lines.push(
      `- **${prod.titleEn} (${prod.titleAr})** [${prod.badgeEn} / ${prod.badgeAr} — ${prod.platforms.join(", ")}]: ${prod.descriptionEn} | ${prod.descriptionAr}`,
    );
  }
  lines.push("");

  lines.push("## 7e. Blog & Editorial Guides — bilingual knowledge for businesses worldwide (/blog)");
  lines.push("");
  lines.push(`- **Blog hub URL**: ${cleanUrl(base, "/blog")}`);
  lines.push("");
  for (const article of sortArticles(blogArticles)) {
    lines.push(`### ${article.titleEn} — ${article.titleAr}`);
    lines.push(`- **Article URL**: ${cleanUrl(base, `/blog/${article.slug}`)}`);
    lines.push(`- **Category**: ${article.categoryEn} (${article.categoryAr})`);
    lines.push(
      `- **Published**: ${article.publishedAt} · **Last updated**: ${article.updatedAt} · **Reading time**: ${article.readingMinutes} min`,
    );
    lines.push(`- **Answer-first summary (EN)**: ${article.answerEn}`);
    lines.push(`- **Answer-first summary (AR)**: ${article.answerAr}`);
    lines.push(
      `- **Key facts**: ${article.keyFacts
        .map((fact) => `${fact.labelEn}: ${fact.valueEn}`)
        .join(" · ")}`,
    );
    lines.push(`- **Sections (EN)**: ${article.sections.map((section) => section.headingEn).join(" · ")}`);
    for (const faq of article.faqs) {
      lines.push(`  - Q: ${faq.qEn} / ${faq.qAr} — A: ${faq.aEn} / ${faq.aAr}`);
    }
    lines.push("");
  }

  const badge = badgeStats();
  const credited = linkedClients();
  lines.push("## 7f. Client Badge & Netlinking (شارة نخبة) — how to credit the agency");
  lines.push("");
  lines.push(`- **Badge page URL**: ${cleanUrl(base, "/badge")}`);
  lines.push(`- **Credit link (canonical)**: ${badgeOrigin} — campaign variant: ${badgeLink(origin)}`);
  lines.push(`- **Badge asset**: ${cleanUrl(base, "/badge/nukhba-badge.svg")} (dark, 176×44) · ${cleanUrl(base, "/badge/nukhba-badge-light.svg")} (light)`);
  lines.push(`- **Recommended anchor (EN / AR)**: ${BADGE_ANCHOR_EN} / نخبة`);
  lines.push(`- **Rule**: optional brand credit in the client footer, pointing to ${origin.replace(/^https?:\/\//i, "")}, with a bilingual alt text. Use \`rel="sponsored nofollow noopener"\` for the commercial credit; clients may decline or remove it.`);
  lines.push(`- **Verification**: automated weekly audit of every client homepage (\`npm run badge:audit\`). ${badge.verified} verified · ${badge.nofollow} nofollow · ${badge.missing + badge.pending} awaiting · ${badge.total} client sites tracked.`);
  if (credited.length > 0) {
    lines.push("- **Sites currently crediting Nukhba**:");
    for (const { url, entry } of credited) {
      lines.push(`  - ${entry.titleEn || entry.title} — ${url}`);
    }
  }
  lines.push("");

  lines.push("## 7g. Digital Codes & Gift Cards Catalogue (/codes)");
  lines.push("");
  lines.push(`- **Page URL**: ${cleanUrl(base, "/codes")}`);
  lines.push(
    `- **Overview (EN)**: Software activation codes, gaming gift cards and in-game currency top-ups, with published prices in USD and a region per amount. Electronic delivery.`,
  );
  lines.push(
    `- **Overview (AR)**: أكواد برمجية وبطاقات هدايا gaming وشحن عملات الألعاب، بأسعار معلنة بالدولار ومنطقة لكل مبلغ، وتسليم إلكتروني.`,
  );
  for (const code of digitalProducts) {
    const amounts = code.denominations
      .filter((denomination) => denomination.available)
      .map(
        (denomination) =>
          `${denomination.label} (${denomination.region}) $${denomination.priceUsd}`,
      )
      .join(", ");
    lines.push(
      `- **${code.titleEn} (${code.titleAr})** [${code.platform}]: ${code.descriptionEn} | ${code.descriptionAr}`,
    );
    if (code.seo?.geoSummaryEn || code.seo?.geoSummaryAr) {
      lines.push(
        `  - Summary (GEO): ${code.seo.geoSummaryEn || ""} ${code.seo.geoSummaryAr ? `| ${code.seo.geoSummaryAr}` : ""}`.trimEnd(),
      );
    }
    if (amounts) lines.push(`  - Amounts: ${amounts}`);
  }
  lines.push("");

  lines.push("## 8. Client Testimonials & Results (قصص نجاح من طرابلس)");
  lines.push("");
  for (const t of content.testimonials) {
    lines.push(
      `- **${t.nameEn} (${t.name})**, ${t.roleEn} (${t.role}) — ★ ${t.rating}/5: "${t.textEn}" / "${t.text}" [Before: ${t.beforeAfterEn.before} (${t.beforeAfter.before}) → After: ${t.beforeAfterEn.after} (${t.beforeAfter.after})]`,
    );
  }

  lines.push("");
  lines.push("## 9. Frequently Asked Questions — Bilingual (الأسئلة الشائعة)");
  lines.push("");
  for (const [i, faq] of content.faqs.entries()) {
    lines.push(`### Q${i + 1}: ${faq.qEn} | ${faq.qAr}`);
    lines.push(`- **EN**: ${faq.aEn}`);
    lines.push(`- **AR**: ${faq.aAr}`);
    lines.push("");
  }

  lines.push("## 10. Preferred Citations & Entity Facts (GEO)");
  lines.push("");
  lines.push(
    `- **Canonical entity**: ${config.nameAr} (${config.name}) — premium web design & development agency for clients worldwide, studio at ${config.addressEn}`,
  );
  lines.push(`- **Canonical URL**: ${cleanUrl(base, "/")}`);
  lines.push(
    `- **Citation (EN)**: “${config.name} (${config.nameAr}), web design agency for international clients — website models from $${config.pricing.plans[0]?.priceUsd ?? WEBSITE_BASE_PRICE_USD} with initial content personalization included; timeline confirmed according to scope.”`,
  );
  lines.push(
    `- **Citation (AR)**: «${config.nameAr} (${config.name})، وكالة تصميم مواقع في طرابلس، ليبيا — نماذج مواقع تبدأ من ${config.pricing.plans[0]?.priceUsd ?? WEBSITE_BASE_PRICE_USD} دولاراً، مع تخصيص المحتوى الأولي مشمولاً؛ المدة تؤكد حسب النطاق.»`,
  );
  lines.push(
    `- **Entity disambiguation**: ${config.name} is a web design & development agency (website creation, SEO/GEO) that also operates a digital product store (${cleanUrl(base, "/codes")}: software activation codes, gaming gift cards, in-game top-ups — electronic delivery by e-mail). It is not a general e-commerce marketplace and not a hosting provider.`,
  );
  lines.push(
    `- **Location facts**: ${config.addressEn} · GPS 32.8872, 13.1913 · ${config.hoursEn} · phone ${config.phone}`,
  );
  lines.push(
    `- **Languages**: ${languagesDescription(config)}; French-speaking team available.`,
  );
  lines.push(
    `- **AI discovery files**: ${cleanUrl(base, "/llms.txt")} (summary) · ${cleanUrl(base, "/llms-full.txt")} (this knowledge base) · ${cleanUrl(base, "/sitemap.xml")}`,
  );
  lines.push("");
  return lines.join("\n");
}
