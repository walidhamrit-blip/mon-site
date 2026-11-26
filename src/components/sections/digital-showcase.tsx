import { LocalizedLink as Link } from "@/components/localized-link";
import Image from "next/image";
import { imageOptimizationProps } from "@/lib/image-source";
import { ArrowUpRight, Gamepad2, ShieldCheck, Zap } from "lucide-react";
import { DIGITAL_KIND_LABELS, type DigitalKind } from "@/lib/digital-types";
import { Price } from "@/components/price";

/**
 * Bandeau « boutique numérique » de la page d'accueil.
 *
 * Rendu côté serveur (aucun JavaScript requis) pour deux raisons :
 *  - le maillage interne vers les fiches produits existe dans le HTML
 *    initial, donc il est crawlable même si le client n'hydrate pas ;
 *  - il relie les deux activités du site (agence web + boutique de codes)
 *    aux yeux de Google, qui les traitait jusqu'ici comme deux univers
 *    séparés — la page d'accueil ne mentionnait jamais `/codes`.
 */
export interface ShowcaseDigitalProduct {
  slug: string;
  image?: string;
  /** Nom commercial déjà nettoyé par `productDisplayName`. */
  title: string;
  platform: string;
  kind: DigitalKind;
  fromUsd: number | null;
}

export function DigitalShowcase({
  locale,
  products,
  total,
}: {
  locale: "ar" | "en";
  products: ShowcaseDigitalProduct[];
  total: number;
}) {
  if (products.length === 0) return null;
  const ar = locale === "ar";

  return (
    <section
      aria-labelledby="digital-store-title"
      className="border-t border-[var(--border)] bg-[var(--secondary)]/30"
    >
      <div className="site-container px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-[11px] font-black text-[var(--accent)]">
              <Gamepad2 className="h-3.5 w-3.5" aria-hidden="true" />
              {ar ? "متجر نخبة الرقمي" : "Nukhba digital store"}
            </p>
            <h2
              id="digital-store-title"
              className="mt-3 text-[clamp(1.5rem,1.1rem+1.6vw,2.1rem)] font-black leading-tight"
            >
              {ar
                ? "أكواد ألعاب وبرامج وبطاقات هدايا — تسليم فوري"
                : "Game keys, software codes & gift cards — instant delivery"}
            </h2>
            <p className="mt-2 max-w-[62ch] text-[14px] leading-7 text-[var(--muted-foreground)]">
              {ar
                ? `Steam، PlayStation، Xbox، Roblox، Google Play، أكواد ألعاب وبرامج (Minecraft، Red Dead Redemption 2) وشحن داخل الألعاب — ${total} منتجاً بأسعار الدولار، تسليم إلكتروني بعد تأكيد الدفع.`
                : `Steam, PlayStation, Xbox, Roblox, Google Play, game and software keys (Minecraft, Red Dead Redemption 2) and in-game top-ups — ${total} products priced in USD, delivered electronically after payment confirmation.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">
              <Zap className="h-3 w-3" aria-hidden="true" /> {ar ? "تسليم فوري" : "Instant delivery"}
            </span>
            <span className="chip">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" /> {ar ? "أكواد أصلية" : "Genuine codes"}
            </span>
          </div>
        </div>

        <ul className="mt-7 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <li key={product.slug}>
              <Link
                href={`/codes/${product.slug}`}
                className="store-preview-card group flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--accent)]"
              >
                {/* Image décorative : le nom du produit est écrit juste en dessous,
                    un alt identique serait lu deux fois par les lecteurs d'écran. */}
                {product.image && <span className="store-preview-art"><Image src={product.image} alt="" width={640} height={400} sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 390px" className="h-full w-full object-cover" {...imageOptimizationProps(product.image)} /></span>}
                <span className="min-w-0 flex-1 p-3.5 sm:p-5">
                  <span className="block text-[10.5px] font-black uppercase tracking-[0.1em] text-[var(--muted-foreground)] sm:text-[11px]">
                    {product.platform} ·{" "}
                    {ar
                      ? DIGITAL_KIND_LABELS[product.kind].ar
                      : DIGITAL_KIND_LABELS[product.kind].en}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[13.5px] font-black leading-snug sm:text-[14px]">
                    {product.title}
                  </span>
                  {/* Prix converti et formaté dans la devise choisie par le
                      visiteur (Intl.NumberFormat via le CurrencyProvider). */}
                  <span className="mt-1.5 block text-[12px] font-bold text-[var(--accent)]">
                    {product.fromUsd != null ? (
                      <>
                        {ar ? "من" : "From"} <Price usd={product.fromUsd} />
                      </>
                    ) : ar ? (
                      "قريباً"
                    ) : (
                      "Coming soon"
                    )}
                  </span>
                </span>
                <ArrowUpRight className="mx-3.5 mb-3.5 h-4 w-4 shrink-0 text-[var(--accent)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 sm:mx-5 sm:mb-5 rtl:rotate-[-90deg]" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <Link
            href="/codes"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-black text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            {ar ? "تصفّح كل الأكواد والبطاقات" : "Browse all codes & cards"}
            <ArrowUpRight className="h-4 w-4 rtl:rotate-[-90deg]" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
