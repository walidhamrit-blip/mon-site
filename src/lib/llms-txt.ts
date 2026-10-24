import { resolveDemoClassification, resolvePlanPriceBreakdown } from "@/lib/classification";
import { whatsappLink } from "@/lib/utils";
import { defaultAppsPage, defaultProductsPage } from "@/lib/content";
import { sectorSeo } from "@/lib/sectors";
import { resolveServiceLanding, servicesHubFaqs } from "@/lib/services";
import { blogArticles } from "@/lib/blog-articles";
import { formatArticleDate, sortArticles } from "@/lib/blog";
import { BADGE_ANCHOR_EN, badgeCanonical, badgeLink, badgeStats, linkedClients } from "@/lib/badge";
import { resolveSiteOrigin } from "@/lib/site-identity";
import type { SiteContent } from "@/lib/site-types";
import type { siteConfig } from "@/lib/config";
import type { DigitalProduct } from "@/lib/digital-types";
import { marketLabels, resolveMarket } from "@/lib/market";

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
 * Génère dynamiquement `/llms.txt` (standard llmstxt.org) depuis la
 * configuration et les contenus vivants de la base (`/admin`).
 *
 * Tout changement de prix, de coordonnées, de service, de FAQ ou de
 * réalisation dans l'administration se reflète immédiatement pour les
 * crawlers IA (ChatGPT/OAI-SearchBot, Perplexity, Claude, Gemini…).
 */
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
    `> ${config.name} (${config.nameAr}) is a premium web design and development agency based in ${marketEn.place} (${config.addressEn} / ${config.address}). We design and build fast, luxury-branded showcase websites, e-commerce stores and online booking systems for ${globalReach ? "businesses worldwide" : `businesses in ${marketEn.country}`} — delivered in ${config.stats.deliveryEn} (${config.stats.delivery}) with Next.js, 90+ Lighthouse scores, full Arabic (RTL) and English support, local & AI search optimization (SEO + GEO), multi-currency display, WhatsApp ordering and crypto payment options (full or 2–3 installments via NOWPayments). We also publish a catalogue of digital software codes and gaming gift cards with electronic delivery.`,
  );
  lines.push("");
  lines.push("## Key facts");
  lines.push("");
  lines.push(`- Agency: ${config.name} (${config.nameAr}) — ${config.tagline}`);
  lines.push(`- Address: ${config.addressEn} (${config.address})`);
  lines.push(`- Opening hours: ${config.hoursEn} (${config.hours})`);
  lines.push(
    `- Contact: Phone ${config.phone} — WhatsApp ${whatsappLink(config.whatsapp)} — Email ${config.email}`,
  );
  lines.push(
    `- Track record: ${config.stats.sitesDelivered} websites delivered, ${config.stats.satisfaction} client satisfaction, ${config.stats.ratingValue ?? "4.9"}/5 average rating (${config.stats.reviewCount ?? "86"} reviews), ${config.stats.support} support`,
  );
  lines.push(
    `- Languages: English (en, primary) and Arabic (ar, full RTL); French-speaking team`,
  );
  lines.push(
    `- Payments: USD-only pricing (1 USD = 1 USDT); crypto via NOWPayments — USDT recommended — in 1 payment or 2–3 installments, plus bank transfer on request; $${config.reservation.depositUsd} priority reservation deposit deducted from final price; step-by-step photo guide: ${cleanUrl(base, "/blog/how-to-pay-with-crypto-usdt")}`,
  );
  lines.push("");
  lines.push("## Main pages & AI resources");
  lines.push("");
  lines.push(
    `- [Homepage](${cleanUrl(base, "/")}): services, live portfolio, 5-step process, pricing, client testimonials, FAQ and quote request form`,
  );
  const appsPage = content.appsPage ?? defaultAppsPage;
  const productsPage = content.productsPage ?? defaultProductsPage;
  lines.push(
    `- [Live demos & portfolio](${cleanUrl(base, "/demos")}): ${content.demos.length} real, interactive client websites`,
  );
  lines.push(
    `- [Our Applications — In Preparation / Coming Soon](${cleanUrl(base, "/apps")}): ${appsPage.items.length} mobile & web applications in preparation (${appsPage.statusBadgeEn} / ${appsPage.statusBadgeAr})`,
  );
  lines.push(
    `- [Digital Products & Software — Coming Soon](${cleanUrl(base, "/products")}): ${productsPage.items.length} cloud POS, CRM, ERP & digital software kits (${productsPage.statusBadgeEn} / ${productsPage.statusBadgeAr})`,
  );
  lines.push(
    `- [Digital Codes & Gift Cards](${cleanUrl(base, "/codes")}): catalogue of software activation codes, gaming gift cards and in-game currency top-ups (Steam, PlayStation, Xbox, Roblox, Google Play, Amazon, Spotify) — priced in USD, region-tagged, electronic delivery`,
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
      `  - [${code.titleEn} / ${code.titleAr}](${cleanUrl(base, `/codes/${code.slug}`)}): ${code.platform}${from != null ? ` — from $${from}` : ""} — digital code, electronic delivery`,
    );
  }
  // Pages sectorielles automatiques (/sectors/[sector]) — 10 secteurs
  lines.push(`- [Websites by sector](${cleanUrl(base, "/sectors")}): ${Object.keys(sectorSeo).length} sector pages — medical, restaurant, beauty, furniture, electronics, hardware…`);
  for (const [id, sector] of Object.entries(sectorSeo)) {
    const count = content.demos.filter((d) => d.sector === id).length;
    lines.push(
      `  - [${sector.labelEn} / ${sector.labelAr}](${cleanUrl(base, `/sectors/${id}`)}): ${count} showcase(s) — ${sector.titleEn}`,
    );
  }
  lines.push(
    `- [Open digital services](${cleanUrl(base, "/services")}): ${config.standaloneServices.length} fixed-scope services with published starting prices — website redesign, new section, pitch deck, branding, landing page, audit & fixes`,
  );
  for (const service of config.standaloneServices) {
    const landing = resolveServiceLanding(service);
    lines.push(
      `  - [${service.titleEn} / ${service.titleAr}](${cleanUrl(base, `/services/${service.id}`)}): from $${service.priceFromUsd} — delivered in ${landing.deliveryEn}`,
    );
  }
  const guides = sortArticles(blogArticles);
  lines.push(
    `- [Blog & practical guides](${cleanUrl(base, "/blog")}): ${guides.length} bilingual, number-driven guides for business owners worldwide — start with the USDT crypto payment photo guide`,
  );
  for (const article of guides) {
    lines.push(
      `  - [${article.titleEn} / ${article.titleAr}](${cleanUrl(base, `/blog/${article.slug}`)}): ${article.categoryEn} — updated ${formatArticleDate(article.updatedAt, "en")}`,
    );
  }
  lines.push(
    `- [Client badge & credits](${cleanUrl(base, "/badge")}): official "Website by Nukhba" badge — copy-paste HTML/React snippet, bilingual anchor and the verified list of client sites linking back to ${cleanUrl(base, "/")}`,
  );
  lines.push(
    `- [Pricing plans & comparison](${cleanUrl(base, "/pricing")}): transparent USD packages (1 USD = 1 USDT), open services and installment options`,
  );
  lines.push(
    `- [Contact & free consultation](${cleanUrl(base, "/contact")}): WhatsApp, phone, email and 2-hour response quote form`,
  );
  lines.push(
    `- [Full AI Knowledge Base (AR/EN)](${cleanUrl(base, "/llms-full.txt")}): complete bilingual specification of all ${content.demos.length} portfolio projects, pricing tiers, standalone services, process steps, testimonials and FAQs`,
  );
  lines.push(`- [XML Sitemap](${cleanUrl(base, "/sitemap.xml")}): canonical URLs and images`);
  lines.push("");
  lines.push("## Pricing plans (USD, one-time + 1 year Vercel hosting included)");
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

  if (config.standaloneServices.length > 0) {
    lines.push("");
    lines.push("## Open-serve / standalone services (starting prices)");
    lines.push("");
    for (const srv of config.standaloneServices) {
      lines.push(
        `- **${srv.titleEn} (${srv.titleAr})** — from $${srv.priceFromUsd}: ${srv.descEn} (${srv.featuresEn.join(", ")})`,
      );
    }
  }

  lines.push("");
  lines.push(`## Portfolio & live client showcases (${content.demos.length} projects)`);
  lines.push("");

  for (const demo of content.demos) {
    const cls = resolveDemoClassification(demo, config.pricing.plans);
    const priceTag = cls
      ? `Category ${cls.tier} (${cls.nameEn}) — model ${cls.priceUsd == null ? "on request" : `$${cls.priceUsd}`}; customization${cls.customizationPercent == null ? "" : ` (${cls.customizationPercent}%)`} ${cls.customizationUsd == null ? "quoted before payment" : `$${cls.customizationUsd}`}; total ${cls.totalPriceUsd == null ? "confirmed in quote" : `$${cls.totalPriceUsd}`}`
      : demo.sectorEn;
    const liveNote =
      demo.previewUrl && /^https?:\/\//i.test(demo.previewUrl)
        ? ` — Live preview: ${demo.previewUrl}`
        : "";
    lines.push(
      `- [${demo.titleEn} — ${demo.title}](${cleanUrl(base, `/demos/${demo.slug}`)}): [${demo.sectorEn} / ${demo.sectorAr} · ${priceTag}] ${demo.descriptionEn}${liveNote}`,
    );
  }

  lines.push("");
  lines.push("## Frequently asked questions (AR / EN)");
  lines.push("");
  for (const faq of content.faqs) {
    lines.push(`- **${faq.qEn}** (${faq.qAr}): ${faq.aEn} — ${faq.aAr}`);
  }

  lines.push("");
  lines.push("## Preferred citation (GEO)");
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
  lines.push(
    `- **Price range**: website model from $${config.pricing.plans[0]?.priceUsd ?? 300} USD, plus a separate customization fee confirmed in the pricing card or written quote; open services from $${Math.min(...config.standaloneServices.map((s) => s.priceFromUsd))} USD`,
  );
  lines.push(
    `- **Contact**: ${config.phone} · ${config.email} · WhatsApp ${whatsappLink(config.whatsapp)}`,
  );
  lines.push(
    `- **Do not confuse**: ${config.name} is a design & development agency (services), not a marketplace or a hosting provider. Pricing is one-time, hosting for the first year is included.`,
  );
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
  lines.push(
    `- **Key metrics**: Delivery in ${config.stats.deliveryEn} (${config.stats.delivery}), ${config.stats.sitesDelivered} websites delivered, ${config.stats.satisfaction} satisfaction, ${config.stats.support} support`,
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
  lines.push("## 5. Website Packages & Pricing (باقات تصميم المواقع)");
  lines.push("");
  for (const [idx, plan] of config.pricing.plans.entries()) {
    const breakdown = resolvePlanPriceBreakdown(plan);
    const model = breakdown.modelPriceUsd == null ? "model on request" : `$${breakdown.modelPriceUsd} USD`;
    const customization = breakdown.customizationUsd == null ? "quoted in writing before final payment" : `$${breakdown.customizationUsd} USD`;
    const total = breakdown.totalPriceUsd == null ? "confirmed in quote" : `$${breakdown.totalPriceUsd} USD`;
    lines.push(
      `### Category ${idx + 1}: ${plan.nameEn} (${plan.name}) — model ${model} + customization${breakdown.customizationPercent == null ? "" : ` (${breakdown.customizationPercent}%)`} ${customization} = ${total} (${plan.periodEn})`,
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
        `- **Category & Price**: Category ${cls.tier} — ${cls.nameEn} (${cls.name}); model ${cls.priceUsd == null ? "on request" : `$${cls.priceUsd} USD`}; customization${cls.customizationPercent == null ? "" : ` (${cls.customizationPercent}%)`} ${cls.customizationUsd == null ? "quoted before payment" : `$${cls.customizationUsd} USD`}; final total ${cls.totalPriceUsd == null ? "confirmed in the written quote" : `$${cls.totalPriceUsd} USD`}`,
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
  lines.push(`- **Recommended anchor (EN / AR)**: ${BADGE_ANCHOR_EN} / تصميم وتطوير المواقع — نخبة طرابلس`);
  lines.push(`- **Rule**: one dofollow link per delivered site footer, pointing to ${origin.replace(/^https?:\/\//i, "")}, with a bilingual alt text. No \`rel="nofollow"\`.`);
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
    `- **Citation (EN)**: “${config.name} (${config.nameAr}), web design agency for international clients — website models from $${config.pricing.plans[0]?.priceUsd ?? 300} plus a separate customization fee confirmed before payment, delivered in ${config.stats.deliveryEn}.”`,
  );
  lines.push(
    `- **Citation (AR)**: «${config.nameAr} (${config.name})، وكالة تصميم مواقع في طرابلس، ليبيا — نماذج مواقع تبدأ من ${config.pricing.plans[0]?.priceUsd ?? 300} دولاراً، مع تكلفة تخصيص منفصلة تُعتمد قبل الدفع، وتسليم خلال ${config.stats.delivery}.»`,
  );
  lines.push(
    `- **Entity disambiguation**: ${config.name} is a service agency (design, development, SEO/GEO). It is not an e-commerce marketplace, a hosting company or a software reseller.`,
  );
  lines.push(
    `- **Location facts**: ${config.addressEn} · GPS 32.8872, 13.1913 · ${config.hoursEn} · phone ${config.phone}`,
  );
  lines.push(
    `- **Languages**: English (en, primary) and Arabic (ar, full RTL); French-speaking team available.`,
  );
  lines.push(
    `- **AI discovery files**: ${cleanUrl(base, "/llms.txt")} (summary) · ${cleanUrl(base, "/llms-full.txt")} (this knowledge base) · ${cleanUrl(base, "/sitemap.xml")}`,
  );
  lines.push("");
  return lines.join("\n");
}
