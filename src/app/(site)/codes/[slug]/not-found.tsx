import Link from "next/link";
import { digitalCatalogStatus } from "@/lib/digital-store";
import { getSiteDataCached } from "@/lib/store";
import { siteLocale } from "@/lib/seo";
import { StoreUnavailableProduct } from "@/components/store-status-notice";

/**
 * Fiche produit introuvable — mais pas forcément inexistante.
 *
 * Le 29/10/2026, la base étant suspendue (quota Neon épuisé), les ~390
 * fiches du fournisseur renvoyaient un 404 nu : un client venu d'un lien
 * direct ne comprenait pas, et repartait. On distingue donc les deux cas :
 *
 *  - panne en cours → message de maintenance + commande par WhatsApp ;
 *  - slug réellement inconnu → 404 classique, avec retour au rayon.
 *
 * Le code HTTP reste 404 dans les deux cas : c'est la réponse honnête pour
 * une URL dont le contenu n'existe pas à cet instant, et elle évite de faire
 * passer un repli pour la vraie fiche.
 */
export default async function DigitalProductNotFound() {
  const { config } = await getSiteDataCached();
  const ar = siteLocale(config) === "ar";
  const status = digitalCatalogStatus();

  if (status.degraded) {
    return <StoreUnavailableProduct ar={ar} phone={config.phone} />;
  }

  return (
    <div className="site-container px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[46rem]">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
          {ar ? "المنتج غير متاح" : "Product not available"}
        </p>
        <h1 className="mt-3 text-[clamp(1.6rem,1.1rem+2vw,2.4rem)] font-black leading-[1.1] tracking-[-0.03em]">
          {ar
            ? "هذا المنتج لم يعد في الكتالوج"
            : "This product is no longer in the catalogue"}
        </h1>
        <p className="mt-4 text-[14px] leading-7 text-[var(--muted-foreground)]">
          {ar
            ? "قد يكون الرابط قديماً أو أن المنتج لم يعد متوفراً لدى الموزّع. تصفّح المتجر لرؤية المنتجات المتاحة اليوم، أو اسألنا على واتساب عن بديل."
            : "The link may be out of date, or the product is no longer offered by the distributor. Browse the store to see what is available today, or ask us on WhatsApp for an alternative."}
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link
            href="/codes"
            className="inline-flex h-10 items-center rounded-full bg-[var(--accent)] px-5 text-[13px] font-black text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
          >
            {ar ? "تصفّح المتجر" : "Browse the store"}
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-10 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-5 text-[13px] font-bold transition-colors hover:border-[var(--accent)]"
          >
            {ar ? "تواصل معنا" : "Contact us"}
          </Link>
        </div>
      </div>
    </div>
  );
}
