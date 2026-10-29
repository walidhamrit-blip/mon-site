import Link from "next/link";
import { ArrowUpRight, KeyRound } from "lucide-react";

/**
 * Bandeau « disponible maintenant » des pages d'attente (/products, /apps).
 *
 * Ces pages annoncent des produits à venir ; sans ce lien, un visiteur (et
 * Googlebot) n'a aucun chemin vers la boutique déjà ouverte. Le bandeau crée
 * un lien contextuel des pages « coming soon » vers /codes, et rappelle que
 * les clés logicielles sont déjà vendues.
 */
export function DigitalStoreBanner({ locale }: { locale: "ar" | "en" }) {
  const ar = locale === "ar";
  return (
    <section className="pb-14">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--accent)]/35 bg-[var(--accent)]/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black">
                {ar ? "متاح الآن: أكواد الألعاب والبرامج" : "Available now: game keys & software codes"}
              </h2>
              <p className="mt-1 max-w-[62ch] text-[13.5px] leading-6 text-[var(--muted-foreground)]">
                {ar
                  ? "بطاقات هدايا Steam وPlayStation وXbox، أكواد ألعاب وبرامج (Minecraft، Red Dead Redemption 2) وشحن العملات داخل الألعاب — أسعار بالدولار وتسليم على بريدك الإلكتروني."
                  : "Steam, PlayStation and Xbox gift cards, game and software keys (Minecraft, Red Dead Redemption 2) and in-game top-ups — USD pricing, delivered to your inbox."}
              </p>
            </div>
          </div>
          <Link
            href="/codes"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-black text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            {ar ? "تصفّح المتجر الرقمي" : "Browse the digital store"}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
