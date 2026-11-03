import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/localized-link";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    path: "/pay/cancel",
    locale,
    title: locale === "ar" ? "الدفع غير مكتمل — نخبة" : "Payment Not Completed — Nukhba",
    description: locale === "ar"
      ? "لم يكتمل الدفع. يمكنك استئناف طلبك أو التواصل مع نخبة."
      : "Your payment was not completed. Resume your order or contact Nukhba.",
    noindex: true,
  });
}

/** Page de retour si le client abandonne le paiement. */
export default async function PayCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
} & LocalePageProps) {
  const { ref } = await searchParams;
  const { config } = await getSiteDataCached();
  const ar = (await pageLocale(config, searchParams)) === "ar";

  return (
    <main className="pt-6 min-h-[70vh]">
      <div className="mx-auto max-w-[960px] px-4 sm:px-6 lg:px-8 py-10 text-center">
        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-8 max-w-md mx-auto">
          <h1 className="text-2xl font-black">{ar ? "الدفع غير مكتمل" : "Payment not completed"}</h1>
          <p className="mt-2 text-sm opacity-70 leading-relaxed">
            {ar
              ? `غادرت صفحة الدفع قبل الإتمام${ref ? ` (الطلب ${ref})` : ""}. لم يتم خصم أي مبلغ.`
              : `You left the payment page before completion${ref ? ` (order ${ref})` : ""}. No amount was charged.`}
          </p>
          <div className="mt-6 flex gap-2 justify-center flex-wrap">
            <Link
              href="/pricing"
              className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold text-sm inline-flex items-center hover:bg-[var(--accent-hover)] transition-colors"
            >
              {ar ? "استئناف الطلب" : "Resume my order"}
            </Link>
            <Link
              href="/contact"
              className="h-11 px-6 rounded-full border border-[var(--border)] font-bold text-sm inline-flex items-center hover:bg-white/5 transition-colors"
            >
              {ar ? "تواصل معنا" : "Contact us"}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
