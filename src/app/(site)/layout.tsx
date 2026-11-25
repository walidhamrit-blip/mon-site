import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { FloatingWidgets } from "@/components/floating-widgets";
import { PaymentMethodsRibbon } from "@/components/payment-methods";
import { SkipLink } from "@/components/skip-link";
import { getSiteDataCachedShared } from "@/lib/catalog-cache";
import { publicManualPaymentOptions } from "@/lib/manual-payment-public";

// Layout des pages publiques du site (groupe de routes `(site)`).
// Le panneau d'administration /admin n'est PAS dans ce groupe :
// il n'affiche donc ni navbar, ni pied de page, ni bouton WhatsApp du site,
// et n'envoie aucune donnée à Vercel Web Analytics ni à Vercel Speed Insights.
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const { config } = await getSiteDataCachedShared();
  const manualMethods = publicManualPaymentOptions(config.manualPayments).map(({ method }) => method);

  return (
    <>
      <div className="public-shell">
      <SkipLink />
      <Navbar />
      {/* tabIndex -1 : le lien d'évitement y place réellement le focus. */}
      <main id="main-content" tabIndex={-1} className="site-main min-h-screen focus:outline-none">
        {children}
      </main>
      <PaymentMethodsRibbon
        manualMethods={manualMethods}
        phoneCardEnabled={config.fazercards.phoneCardPaymentsEnabled}
      />
      {/* @username du bot Telegram, lu côté serveur : aucun préfixe
          NEXT_PUBLIC_ n'est nécessaire (et un jeton ne doit jamais y être). */}
      {/* Année calculée côté serveur : le pied de page client hydrate alors
          le même texte que le HTML mis en cache (pas de décalage au 1er janvier). */}
      <Footer telegramBot={process.env.TELEGRAM_BOT_USERNAME} year={new Date().getFullYear()} />
      </div>
      <FloatingWidgets />
      <Analytics />
      {/* Speed Insights : mesure des Core Web Vitals réels (LCP, INP, CLS…).
          Le script est servi depuis `/_vercel/speed-insights/script.js`
          (même origine, donc couvert par la CSP `script-src 'self'`). */}
      <SpeedInsights />
    </>
  );
}
