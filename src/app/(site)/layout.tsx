import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { WhatsAppFloat } from "@/components/whatsapp-float";
import { SiteChatbot } from "@/components/site-chatbot";

// Layout des pages publiques du site (groupe de routes `(site)`).
// Le panneau d'administration /admin n'est PAS dans ce groupe :
// il n'affiche donc ni navbar, ni pied de page, ni bouton WhatsApp du site,
// et n'envoie aucune donnée à Vercel Web Analytics ni à Vercel Speed Insights.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {children}
      </main>
      <Footer />
      <WhatsAppFloat />
      <SiteChatbot />
      <Analytics />
      {/* Speed Insights : mesure des Core Web Vitals réels (LCP, INP, CLS…).
          Le script est servi depuis `/_vercel/speed-insights/script.js`
          (même origine, donc couvert par la CSP `script-src 'self'`). */}
      <SpeedInsights />
    </>
  );
}
