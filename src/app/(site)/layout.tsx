import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { WhatsAppFloat } from "@/components/whatsapp-float";

// Layout des pages publiques du site (groupe de routes `(site)`).
// Le panneau d'administration /admin n'est PAS dans ce groupe :
// il n'affiche donc ni navbar, ni pied de page, ni bouton WhatsApp du site,
// et n'envoie aucune donnée à Vercel Web Analytics.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
      <WhatsAppFloat />
      <Analytics />
    </>
  );
}
