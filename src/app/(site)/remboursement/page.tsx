import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { pageMetadata, siteLocale } from "@/lib/seo";
import { RefundClient } from "./refund-client";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = siteLocale(config);
  return pageMetadata(config, {
    path: "/remboursement",
    title:
      locale === "ar" ? "سياسة الاسترداد — نخبة" : "Refund Policy — Nukhba",
    description:
      locale === "ar"
        ? "سياسة استرداد مدفوعات نخبة: العربون، إلغاء الاشتراكات، ضمان الخدمة، والأكواد الرقمية، وكيفية طلب الاسترداد عبر البريد الإلكتروني أو واتساب."
        : "Nukhba refund policy: deposits, subscription cancellation, service guarantee and digital codes, plus how to request a refund by email or WhatsApp.",
    keywords: ["سياسة الاسترداد", "refund policy", "Nukhba"],
  });
}

export default function RefundPage() {
  return (
    <div className="mx-auto max-w-[800px] px-4 py-16 sm:px-6 lg:px-8">
      <RefundClient />
    </div>
  );
}
