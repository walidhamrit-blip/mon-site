import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  pageMetadata,
  siteLocale,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { PricingClient } from "./pricing-client";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = siteLocale(config);
  return pageMetadata(config, {
    path: "/pricing",
    title:
      locale === "ar"
        ? "أسعار تصميم المواقع والمتاجر بالدولار"
        : "Website & Store Pricing in USD — No Surprises",
    description:
      locale === "ar"
        ? "أسعار واضحة بالدولار في {country}: سعر النموذج + رسوم التخصيص + الإجمالي قبل الدفع (1 دولار = 1 USDT) — دفعة واحدة أو 2–3 أقساط."
        : "Transparent USD pricing in {countryEn}: model price, a separate customization fee, a clear total before checkout (1 USD = 1 USDT) — full or 2–3 installments.",
    keywords: [
      "website pricing USD",
      "e-commerce website price",
      "pay for a website with USDT",
      "باقات تصميم مواقع بالدولار",
      "website pricing {countryEn}",
      "أسعار تصميم المواقع {country}",
      "تكلفة متجر إلكتروني {city}",
      "باقات تصميم مواقع",
      "website pricing Libya",
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
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
          faqJsonLd(content.faqs),
        ]}
      />
      <PricingClient />
    </>
  );
}
