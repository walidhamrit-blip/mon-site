import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import {
  breadcrumbJsonLd,
  offerCatalogJsonLd,
  pageMetadata,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { PricingClient } from "./pricing-client";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: "/pricing",
    title: "باقات أسعار تصميم المواقع والمتاجر — طرابلس ليبيا",
    description:
      "باقات تصميم المواقع والمتاجر في ليبيا: من 300 دولار لموقع الواجهة حتى المتجر الإلكتروني بنظام الحجز — دفع كامل أو أقساط بالعملات الرقمية، تسليم 7 إلى 21 يوماً.",
    keywords: [
      "أسعار تصميم المواقع ليبيا",
      "تكلفة متجر إلكتروني طرابلس",
      "باقات تصميم مواقع",
      "website pricing Libya",
    ],
  });
}

export default async function PricingPage() {
  const { config } = await getSiteDataCached();
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "الباقات والأسعار", path: "/pricing" },
          ]),
          offerCatalogJsonLd(config),
        ]}
      />
      <PricingClient />
    </>
  );
}
