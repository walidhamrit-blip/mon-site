import type { Metadata } from "next";
import { PaymentStatus } from "@/components/payment-status";

export const metadata: Metadata = {
  title: "Paiement confirmé — Nukhba",
  robots: { index: false, follow: false },
};

/**
 * Page de retour après un paiement NOWPayments.
 * Le statut réel est confirmé par l'IPN (webhook),
 * jamais par cette simple redirection.
 */
export default async function PaySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; t?: string }>;
}) {
  const { ref, t } = await searchParams;

  return (
    <main className="pt-[calc(var(--header-h)+1.5rem)] min-h-[70vh]">
      <div className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8 py-10">
        {/* Prop `orderRef` (et non `ref`) : `ref` est réservée par React 19
            et ferait échouer tout le rendu de cette page. */}
        <PaymentStatus orderRef={ref ?? ""} trackingToken={t} />
        <p className="mt-6 text-center text-xs opacity-50">
          Le paiement est confirmé dès réception de la notification du
          réseau — généralement en quelques minutes.
        </p>
      </div>
    </main>
  );
}
