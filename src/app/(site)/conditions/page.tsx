import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { ConditionsClient } from "./conditions-client";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    locale,
    path: "/conditions",
    title:
      locale === "ar"
        ? "شروط البيع والخدمة والأكواد الرقمية — نخبة"
        : "Terms of Sale, Web Projects & Codes — Nukhba",
    description:
      locale === "ar"
        ? "شروط التعامل والخدمة: الأسعار بالدولار وUSDT، العربون، الاشتراكات والتجديد، النطاق والاستضافة، الملكية الفكرية، وشروط بيع الأكواد الرقمية."
        : "General terms: USD and crypto settlement, project deposits, subscriptions and renewals, domain and hosting, IP ownership, and digital code conditions.",
    keywords: ["شروط الخدمة", "terms of service", "Nukhba"],
  });
}

export default async function ConditionsPage({ searchParams }: LocalePageProps) {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const ar = locale === "ar";
  return (
    <div className="pt-6 min-h-[70vh]">
      <JsonLd
        data={breadcrumbJsonLd(
          config,
          [
            { name: ar ? "الرئيسية" : "Home", path: "/" },
            { name: ar ? "شروط البيع والخدمة" : "Terms of Sale & Service", path: "/conditions" },
          ],
          locale,
        )}
      />
      <div className="mx-auto max-w-[800px] px-4 sm:px-6 lg:px-8 py-10">
        <ConditionsClient />
      </div>
    </div>
  );
}
