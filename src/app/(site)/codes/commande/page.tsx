import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DigitalOrderStatus } from "./digital-order-status";

export const metadata: Metadata = {
  title: "Suivi de commande — Codes & cartes cadeaux | Nukhba",
  robots: { index: false, follow: false },
};

/**
 * Suivi d'une commande de code / carte cadeau.
 *
 * L'URL de retour NOWPayments porte `ref` et `t` (jeton de suivi). Sans
 * eux, la page propose de reprendre la dernière commande de l'appareil ou
 * de saisir référence + jeton.
 */
export default async function DigitalOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; t?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="pt-6 min-h-[70vh]">
      <div className="mx-auto w-full max-w-[760px] px-4 py-10 sm:px-6">
        <Link
          href="/codes"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--muted-foreground)] transition-colors hover:text-[var(--accent)]"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          Codes &amp; cartes cadeaux
        </Link>

        <h1 className="mt-4 text-[clamp(1.6rem,1.2rem+1.6vw,2.1rem)] font-black tracking-[-0.02em]">
          Suivi de commande
        </h1>
        <p className="mt-2 text-[14px] leading-7 text-[var(--muted-foreground)]">
          Votre code s&apos;affiche ici dès que le paiement est confirmé par le
          réseau — et il est aussi envoyé par e-mail.
        </p>

        <div className="mt-6">
          <DigitalOrderStatus
            initialRef={params.ref ?? ""}
            initialToken={params.t ?? ""}
          />
        </div>
      </div>
    </main>
  );
}
