import { storeCategories } from "@/lib/site-hierarchy";
import type { Metadata } from "next";
import Link from "next/link";
import { digitalCatalogStatus, getDigitalCatalog } from "@/lib/digital-store";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  pageMetadata,
  siteLocale,
  storeJsonLd,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { DigitalCatalog } from "@/components/digital-catalog";
import { StoreUnavailableNotice } from "@/components/store-status-notice";
import { sortByDemand } from "@/lib/digital-priority";
import { getSiteDataCached } from "@/lib/store";
import { marketLabels, resolveMarket } from "@/lib/market";
import { storeFaqs } from "@/lib/digital-seo";
import { lowestPriceUsd } from "@/lib/digital-types";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const market = resolveMarket(config.market);
  const labels = marketLabels(market, "en");
  // Les métadonnées suivent la langue principale du site (/admin → Réglages).
  const locale = siteLocale(config);
  return pageMetadata(config, {
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
  const products = sortByDemand(await getDigitalCatalog({ publicOnly: true }));
  /**
   * Panne de la base : le catalogue affiché n'est plus le vrai (repli sur les
   * fiches de démonstration) et aucune commande ne pourrait être enregistrée.
   * On le DIT au visiteur, et on ne présente pas le repli comme le catalogue.
   */
  const status = digitalCatalogStatus();
  const degraded = status.degraded;
  const market = resolveMarket(config.market);
  const locale = siteLocale(config);
  const ar = locale === "ar";
  const faqs = storeFaqs(locale);
  const fromPrices = products
    .map((product) => lowestPriceUsd(product))
    .filter((value): value is number => value != null);
  const cheapest = fromPrices.length > 0 ? Math.min(...fromPrices) : null;

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
          url: absoluteUrl(config, `/codes/${product.slug}`),
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
    "@id": `${absoluteUrl(config, "/codes")}#collection`,
    name: ar
      ? "بطاقات الهدايا وأكواد الألعاب والبرامج — نخبة"
      : "Gift cards, game keys and software codes — Nukhba",
    url: absoluteUrl(config, "/codes"),
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
          url: absoluteUrl(config, `/codes/${product.slug}`),
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
    "@id": `${absoluteUrl(config, "/codes")}#faq`,
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
          ]),
          collectionSchema,
          storeSchema,
          faqSchema,
        ]}
      />

      {/*
        En-tête de rayon — volontairement compact : la vitrine s'organise
        comme celle du fournisseur (barre de filtres collante + rail de
        facettes + grille), donc le contenu marchand doit commencer dans le
        premier écran. Le titre et l'accroche restent complets pour le SEO.
      */}
      <section className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--secondary)]/30">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 start-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full opacity-20 blur-3xl rtl:translate-x-1/2"
          style={{ background: "var(--accent)" }}
        />
        <div className="site-container relative px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 pb-5 pt-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-[52rem]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-[11px] font-black shadow-[var(--shadow-xs)]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
                <span className="text-[var(--accent)]">
                  {ar
                    ? "متجر رقمي عالمي — تسليم فوري"
                    : "Worldwide digital store"}
                </span>
              </div>

              <h1 className="mt-3 max-w-[28ch] text-[clamp(1.6rem,1.1rem+2vw,2.5rem)] font-black leading-[1.08] tracking-[-0.03em] text-balance">
                {ar ? "أكواد ألعاب وبرامج وبطاقات هدايا" : "Game keys, gift cards & digital codes"}
                <span className="text-[var(--accent)]"> {ar ? "— بأسعار واضحة" : "— made simple"}</span>
              </h1>

              <p className="mt-2.5 max-w-[68ch] text-[14px] leading-7 text-[var(--muted-foreground)]">
                {ar
                  ? "بطاقات هدايا Steam وPlayStation وXbox وNintendo وRoblox وGoogle Play وAmazon، أكواد ألعاب وبرامج (Minecraft، Red Dead Redemption 2) وشحن العملات داخل الألعاب. تحقّق من منطقة كل بطاقة قبل الطلب — التسليم الرقمي يصلك على بريدك الإلكتروني بعد تأكيد الدفع."
                  : "Steam, PlayStation, Xbox, Nintendo, Roblox, Google Play and Amazon gift cards, game keys and software (Minecraft, Red Dead Redemption 2), plus in-game top-ups. Check each card’s region before ordering — digital delivery is sent to your email after payment confirmation."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
              <span className="chip chip-accent">
                {degraded
                  ? ar
                    ? "صيانة مؤقتة"
                    : "Temporary maintenance"
                  : ar
                    ? `${products.length} منتجاً`
                    : `${products.length} products`}
              </span>
              <span className="chip">
                {ar ? "تسليم رقمي فوري" : "Digital delivery"}
              </span>
              {/*
                Pendant une panne, le prix « à partir de » proviendrait des
                fiches de démonstration : on n'annonce pas un tarif pour des
                produits qui ne peuvent pas être commandés.
              */}
              {!degraded && (
                <span className="chip">
                  {ar
                    ? cheapest != null
                      ? `تبدأ من ${cheapest.toFixed(2)} $`
                      : "أسعار بالدولار"
                    : cheapest != null
                      ? `From $${cheapest.toFixed(2)}`
                      : "USD pricing"}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {degraded && (
        <StoreUnavailableNotice ar={ar} phone={config.phone} />
      )}

      {/*
        Pendant une panne de base, la grille n'est pas affichée : elle
        contiendrait les fiches de démonstration, présentées comme le
        catalogue réel — c'est exactement ce qui a trompé les visiteurs (et
        le sitemap) le 29/10/2026.
      */}
      <nav aria-label={ar ? "فئات المتجر" : "Store categories"} className="site-container flex flex-wrap gap-2 px-4 py-6 sm:px-6 lg:px-8">
        {storeCategories.map((category) => <Link key={category.kind} href={category.kind === "all" ? "/codes" : `/codes?kind=${category.kind}`} aria-current={initialKind === category.kind ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-bold ${initialKind === category.kind ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]" : "border-[var(--border)] bg-[var(--card)]"}`}>{ar ? category.ar : category.en}</Link>)}
      </nav>
      {!degraded && <DigitalCatalog key={initialKind} products={products} initialKind={initialKind} />}

      {/*
        Contenu de rayon : ces sections répondent aux questions réellement
        posées avant l'achat (région, livraison, authenticité, paiement).
        Elles rendent `/codes` utile pour l'internaute ET pour Google — un
        simple mur de cartes sans texte se classe mal sur les requêtes
        « acheter une carte Steam en Libye ».
      */}
      <section className="section-tight border-t border-[var(--border)]">
        <div className="site-container grid gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:px-8">
          <div>
            <h2 className="text-2xl font-black">
              {ar ? "كيف يعمل الشراء والتسليم؟" : "How buying and delivery work"}
            </h2>
            <ol className="mt-5 space-y-4">
              {(ar
                ? [
                    "اختر المنتج ثم المبلغ والمنطقة المناسبة لحسابك.",
                    "ادفع بالدولار أو USDT عبر NOWPayments — دون حساب على المتجر.",
                    "يصلك الكود على بريدك الإلكتروني بعد تأكيد الدفع مباشرة.",
                    "استخدم الكود في المتجر أو اللعبة الرسمية، واحتفظ برسالة الطلب.",
                  ]
                : [
                    "Choose the product, amount and the region that matches your account.",
                    "Pay in USD or USDT via NOWPayments — no store account needed.",
                    "Your code arrives by email right after payment confirmation.",
                    "Redeem it in the official store or game, and keep the order email.",
                  ]
              ).map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-[14px] leading-7">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[12px] font-black text-[var(--accent)]">
                    {index + 1}
                  </span>
                  <span className="opacity-85">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4 text-[13px] leading-6 text-[var(--muted-foreground)]">
              {ar
                ? "الأكواد تُشترى من الموزّع الرسمي عند الطلب. الأسعار بالدولار الأمريكي، و1 دولار = 1 USDT. البطاقات الإقليمية لا تُسترجع بعد التسليم — تحقّق من منطقة حسابك أولاً."
                : "Codes are purchased from the official distributor on demand. Prices are in USD, with 1 USD = 1 USDT. Region-locked cards cannot be refunded after delivery — check your account region first."}
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-black">
              {ar ? "أسئلة شائعة قبل الشراء" : "Questions before you buy"}
            </h2>
            <div className="mt-5 divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
              {faqs.map((faq) => (
                <details key={faq.q} className="group p-4">
                  <summary className="cursor-pointer list-none text-[14px] font-black leading-6 marker:hidden">
                    {faq.q}
                  </summary>
                  <p className="mt-2 text-[13px] leading-7 text-[var(--muted-foreground)]">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
            <p className="mt-4 text-[12.5px] leading-6 text-[var(--muted-foreground)]">
              {ar ? "لم تجد إجابتك؟ " : "Still unsure? "}
              <Link href="/contact" className="font-bold text-[var(--accent)] underline-offset-4 hover:underline">
                {ar ? "تواصل معنا على واتساب" : "Talk to us on WhatsApp"}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
