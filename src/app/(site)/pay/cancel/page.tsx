import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Paiement annulé — Nukhba",
  robots: { index: false, follow: false },
};

/** Page de retour si le client abandonne le paiement. */
export default async function PayCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <main className="pt-6 min-h-[70vh]">
      <div className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8 py-10 text-center">
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-8 max-w-md mx-auto">
          <h1 className="text-2xl font-black">Paiement non finalisé</h1>
          <p className="mt-2 text-sm opacity-70 leading-relaxed">
            Vous avez quitté la page de paiement avant la finalisation
            {ref ? ` (commande ${ref})` : ""}. Aucun montant n&apos;a été
            débité.
          </p>
          <div className="mt-6 flex gap-2 justify-center flex-wrap">
            <Link
              href="/pricing"
              className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold text-sm inline-flex items-center hover:bg-[var(--accent-hover)] transition-colors"
            >
              Reprendre ma commande
            </Link>
            <Link
              href="/contact"
              className="h-11 px-6 rounded-full border border-[var(--border)] font-bold text-sm inline-flex items-center hover:bg-white/5 transition-colors"
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
