import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { pageMetadata, siteLocale } from "@/lib/seo";
import { ConditionsClient } from "./conditions-client";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = siteLocale(config);
  return pageMetadata(config, {
    path: "/conditions",
    title:
      locale === "ar"
        ? "شروط البيع والخدمة — نخبة"
        : "Terms of Sale & Service — Nukhba",
    description:
      locale === "ar"
        ? "شروط خدمة نخبة: الأسعار والدفع بالعملات الرقمية، العربون، الاشتراكات والتجديد، الإلغاء، النطاق والاستضافة، الملكية الفكرية، وشروط بيع الأكواد الرقمية."
        : "Nukhba terms: pricing and crypto payment, deposits, subscriptions and renewals, cancellation, domain and hosting, intellectual property, and digital-code sales conditions.",
    keywords: ["شروط الخدمة", "terms of service", "Nukhba"],
  });
}

export default function ConditionsPage() {
  return (
    <div className="pt-6 min-h-[70vh]">
      <div className="mx-auto max-w-[800px] px-4 sm:px-6 lg:px-8 py-10">
        <ConditionsClient />
      </div>
    </div>
  );
}
