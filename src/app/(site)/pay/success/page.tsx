import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { PaymentStatus } from "@/components/payment-status";
import { getSiteDataCached } from "@/lib/store";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    path: "/pay/success",
    locale,
    title: locale === "ar" ? "تأكيد الدفع — نخبة" : "Payment Confirmation — Nukhba",
    description: locale === "ar"
      ? "تابع حالة دفعك لدى نخبة. يتم تأكيد الدفع عند إشعار الشبكة."
      : "Track your Nukhba payment status. Payment is confirmed when the network notification arrives.",
    noindex: true,
  });
}

/**
 * Page de retour après un paiement NOWPayments.
 * Le statut réel est confirmé par l'IPN (webhook),
 * jamais par cette simple redirection.
 */
export default async function PaySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; t?: string }>;
} & LocalePageProps) {
  const { ref, t } = await searchParams;
  const { config } = await getSiteDataCached();
  const ar = (await pageLocale(config, searchParams)) === "ar";

  return (
    <main className="pt-6 min-h-[70vh]">
      <div className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8 py-10">
        {/* Prop `orderRef` (et non `ref`) : `ref` est réservée par React 19. */}
        <PaymentStatus orderRef={ref ?? ""} trackingToken={t} />
        <p className="mt-6 text-center text-xs opacity-50">
          {ar
            ? "يتم تأكيد الدفع عند استلام إشعار الشبكة — عادة خلال دقائق."
            : "Payment is confirmed once the network notification arrives — usually within a few minutes."}
        </p>
      </div>
    </main>
  );
}
