import type { Metadata } from "next";
import { getDigitalCatalog } from "@/lib/digital-store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { DigitalCatalog } from "@/components/digital-catalog";
import { getSiteDataCached } from "@/lib/store";
import { marketLabels, resolveMarket } from "@/lib/market";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const market = resolveMarket(config.market);
  const labels = marketLabels(market, "en");
  return pageMetadata(config, {
    path: "/codes",
    title: "بطاقات الهدايا والأكواد الرقمية — Steam، PlayStation، Roblox",
    description:
      "كتالوج أكواد برمجية وبطاقات هدايا gaming ومنصات رقمية: Steam، PlayStation، Xbox، Roblox، Google Play، Amazon — أسعار واضحة باليورو والدولار والريال والدرهم، وتوصيل إلكتروني فوري.",
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
 * Le catalogue est pré-généré : sans fenêtre de revalidation, un changement
 * de statut ou de prix en admin resterait invisible jusqu'au déploiement
 * suivant. L'admin revalide déjà `/codes` (layout) ; ce délai n'est qu'un
 * filet de sécurité.
 */
export const revalidate = 60;

export default async function CodesPage() {
  const { config } = await getSiteDataCached();
  const products = await getDigitalCatalog({ publicOnly: true });
  const market = resolveMarket(config.market);
  const labels = marketLabels(market, "ar");
  const globalReach = Boolean(config.market?.globalReach) || market.id === "global";

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(config, "/codes")}#collection`,
    name: "بطاقات الهدايا والأكواد الرقمية — Nukhba digital codes & gift cards",
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

      {/* En-tête éditorial */}
      <section className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--secondary)]/35 pt-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 start-1/2 h-72 w-[620px] -translate-x-1/2 rounded-full blur-3xl opacity-20 rtl:translate-x-1/2"
          style={{ background: "var(--accent)" }}
        />
        <div className="site-container relative px-4 sm:px-6 lg:px-8">
          <div className="max-w-[62rem] pb-8 pt-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-1.5 text-xs font-black shadow-sm sm:text-sm">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--accent)]" />
              <span className="text-[var(--accent)]">
                {globalReach
                  ? "بوابة عالمية — codes & gift cards"
                  : `أكواد وبطاقات هدايا — ${labels.city}`}
              </span>
            </div>

            <h1 className="mt-4 max-w-[24ch] text-[clamp(1.9rem,1.2rem+2.6vw,3.1rem)] font-black leading-[1.06] tracking-[-0.03em] text-balance">
              أكواد برمجية وبطاقات هدايا
              <span className="text-[var(--accent)]"> — بأسعار واضحة</span>
            </h1>

            <p className="mt-4 max-w-[62ch] text-[15.5px] leading-8 text-[var(--muted-foreground)]">
              Steam، PlayStation، Xbox، Nintendo، Roblox، Google Play، Amazon ومنصات
              أخرى. كل بطاقة بمناطقها وأسعارها، تُسلَّم إلكترونياً على بريدك خلال
              دقائق من تأكيد الدفع — والكتالوج متاح الآن، والبيع يفتح تباعاً.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <span className="chip chip-accent">
                {products.length} {globalReach ? "منصة عالمية" : "منتج في الكتالوج"}
              </span>
              <span className="chip">تسليم إلكتروني فوري</span>
              <span className="chip">أسعار بالدولار · تحويل لأى عملة</span>
            </div>
          </div>
        </div>
      </section>

      <DigitalCatalog products={products} />
    </>
  );
}
