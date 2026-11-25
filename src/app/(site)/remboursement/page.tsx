import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { RefundClient } from "./refund-client";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    locale,
    path: "/remboursement",
    title:
      locale === "ar"
        ? "سياسة الاسترداد والإلغاء والضمان — نخبة"
        : "Refund, Cancellation & Replacement Policy — Nukhba",
    description:
      locale === "ar"
        ? "قواعد الاسترداد والإلغاء: العربون، إلغاء الاشتراكات، استبدال الأكواد الرقمية التالفة خلال 48 ساعة، وطريقة تقديم الطلب بالبريد أو واتساب."
        : "Clear rules on deposits, subscription cancellations, 48-hour replacement for faulty digital codes, and how to submit a request by email or WhatsApp.",
    keywords: ["سياسة الاسترداد", "refund policy", "Nukhba"],
  });
}

export default async function RefundPage({ searchParams }: LocalePageProps) {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const ar = locale === "ar";
  return (
    <div className="mx-auto max-w-[800px] px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        data={breadcrumbJsonLd(
          config,
          [
            { name: ar ? "الرئيسية" : "Home", path: "/" },
            { name: ar ? "سياسة الاسترداد" : "Refund Policy", path: "/remboursement" },
          ],
          locale,
        )}
      />
      <RefundClient />
    </div>
  );
}
