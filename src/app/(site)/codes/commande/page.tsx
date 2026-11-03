import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/localized-link";
import { ChevronLeft } from "lucide-react";
import { DigitalOrderStatus } from "./digital-order-status";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    path: "/codes/commande",
    locale,
    title: locale === "ar" ? "متابعة الطلب — أكواد وبطاقات رقمية" : "Order Tracking — Digital Codes & Gift Cards",
    description: locale === "ar"
      ? "تابع طلبك من الأكواد والبطاقات الرقمية واعرض الكود بعد تأكيد الدفع."
      : "Track your digital code or gift card order and view the code once payment is confirmed.",
    noindex: true,
  });
}

/**
 * Suivi d'une commande de code / carte cadeau.
 * L'URL de retour NOWPayments porte `ref` et `t` (jeton de suivi).
 */
export default async function DigitalOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; t?: string }>;
} & LocalePageProps) {
  const params = await searchParams;
  const { config } = await getSiteDataCached();
  const ar = (await pageLocale(config, searchParams)) === "ar";

  return (
    <main className="pt-6 min-h-[70vh]">
      <div className="mx-auto w-full max-w-[760px] px-4 py-10 sm:px-6">
        <Link
          href="/codes"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--muted-foreground)] transition-colors hover:text-[var(--accent)]"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          {ar ? "الأكواد وبطاقات الهدايا" : "Codes & gift cards"}
        </Link>

        <h1 className="mt-4 text-[clamp(1.6rem,1.2rem+1.6vw,2.1rem)] font-black tracking-[-0.02em]">
          {ar ? "متابعة الطلب" : "Order tracking"}
        </h1>
        <p className="mt-2 text-[14px] leading-7 text-[var(--muted-foreground)]">
          {ar
            ? "يظهر الكود هنا فور تأكيد الدفع من الشبكة — ويُرسل أيضاً إلى بريدك الإلكتروني."
            : "Your code appears here as soon as the network confirms payment — and it is also sent by email."}
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
