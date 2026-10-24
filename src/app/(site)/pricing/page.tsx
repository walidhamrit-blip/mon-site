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
    title: "Website & Store Pricing Plans in USD — Pay in USDT",
    description:
      "Transparent USD website pricing: model price per category, a separate customization fee, and a clear total before checkout (1 USD = 1 USDT) — pay in full or in 2–3 crypto installments.",
    keywords: [
      "website pricing USD",
      "e-commerce website price",
      "pay for a website with USDT",
      "باقات تصميم مواقع بالدولار",
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
