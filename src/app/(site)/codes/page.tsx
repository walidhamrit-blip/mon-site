import type { Metadata } from "next";
import { getDigitalCatalog } from "@/lib/digital-store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata, siteLocale } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { DigitalCatalog } from "@/components/digital-catalog";
import { sortByDemand } from "@/lib/digital-priority";
import { getSiteDataCached } from "@/lib/store";
import { marketLabels, resolveMarket } from "@/lib/market";

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
        ? "بطاقات الهدايا وأكواد الألعاب الرقمية — Steam وPlayStation وXbox"
        : "Digital Gift Cards & Game Codes — Steam, PlayStation, Xbox",
    description:
      locale === "ar"
        ? "متجر بطاقات الهدايا وأكواد الألعاب الرقمية: Steam وPlayStation وXbox وRoblox وGoogle Play وAmazon والمزيد. أسعار واضحة بالدولار، تفاصيل المنطقة وتسليم رقمي فوري حول العالم."
        : "Shop digital gift cards and game codes for Steam, PlayStation, Xbox, Roblox, Google Play and more. Clear USD pricing, region details and digital delivery worldwide.",
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

export default async function CodesPage() {
  const { config } = await getSiteDataCached();
  /**
   * Ordre commercial dès le serveur : les fiches les plus demandées (recharges
   * des jeux de la région, cartes des grandes boutiques, zones payables en
   * USDT) arrivent en tête du HTML, donc aussi en tête du plan de page et du
   * JSON-LD. Le composant client recalcule le même ordre (module partagé) quand
   * le visiteur change de tri.
   */
  const products = sortByDemand(await getDigitalCatalog({ publicOnly: true }));
  const market = resolveMarket(config.market);

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(config, "/codes")}#collection`,
    name: "Digital gift cards and game codes — Nukhba",
    url: absoluteUrl(config, "/codes"),
    inLanguage: [market.locale, "en"],
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    description:
      "Catalogue de codes logiciels, cartes cadeaux gaming et recharges de monnaie de jeu, disponibles à l'achat en ligne avec livraison électronique immédiate.",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(config, `/codes/${product.slug}`),
        name: product.titleAr,
      })),
    },
  };

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "الأكواد وبطاقات الهدايا", path: "/codes" },
          ]),
          collectionSchema,
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
                <span className="text-[var(--accent)]">Worldwide digital store</span>
              </div>

              <h1 className="mt-3 max-w-[26ch] text-[clamp(1.6rem,1.1rem+2vw,2.5rem)] font-black leading-[1.08] tracking-[-0.03em] text-balance">
                Digital gift cards & game codes
                <span className="text-[var(--accent)]"> — made simple</span>
              </h1>

              <p className="mt-2.5 max-w-[68ch] text-[14px] leading-7 text-[var(--muted-foreground)]">
                Steam, PlayStation, Xbox, Nintendo, Roblox, Google Play, Amazon and
                game keys. Check each card’s region before ordering — digital
                delivery is sent to your email after payment confirmation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
              <span className="chip chip-accent">{products.length} products</span>
              <span className="chip">Digital delivery</span>
              <span className="chip">USD pricing</span>
            </div>
          </div>
        </div>
      </section>

      <DigitalCatalog products={products} />
    </>
  );
}
