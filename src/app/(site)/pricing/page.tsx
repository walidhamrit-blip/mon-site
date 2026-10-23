import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  pageMetadata,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { PricingClient } from "./pricing-client";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: "/pricing",
    title: "باقات أسعار تصميم المواقع والمتاجر — {city} {country}",
    description:
      "أسعار مواقع في {country}: سعر نموذج كل فئة بالدولار والدينار الليبي، ورسوم تخصيص منفصلة، وإجمالي واضح قبل الدفع أو عرض مكتوب للموافقة — دفع كامل أو أقساط.",
    keywords: [
      "أسعار تصميم المواقع {country}",
      "تكلفة متجر إلكتروني {city}",
      "باقات تصميم مواقع",
      "website pricing {countryEn}",
    ],
  });
}

export default async function PricingPage() {
  const { config, content } = await getSiteDataCached();
  return (
    <>
      {/* Le catalogue d'offres (#offer-catalog) est déjà injecté par le
          layout racine sur toutes les pages : ne pas le dupliquer ici. */}
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "الباقات والأسعار", path: "/pricing" },
          ]),
          faqJsonLd(content.faqs),
        ]}
      />
      <PricingClient />
    </>
  );
}
