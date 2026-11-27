import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import {
  breadcrumbJsonLd,
  pageMetadata,
  webPageJsonLd,
} from "@/lib/seo";
import { formatServicePrice, serviceStartingPrice } from "@/lib/service-pricing";
import { AUDIT_ITEM_COUNT } from "@/lib/audit-checklist";
import { AuditClient } from "./audit-client";

/** Prix vivant du service « Fix & Optimize » (source : /admin → Réglages). */
function auditPriceUsd(services: ReadonlyArray<{ id: string; priceFromUsd: number }>): number {
  return serviceStartingPrice(services, "fix-optimize", 90);
}

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const price = formatServicePrice(auditPriceUsd(config.standaloneServices), locale === "ar" ? "ar" : "en");
  return pageMetadata(config, {
    locale,
    path: "/audit",
    title:
      locale === "ar"
        ? `تدقيق موقع في ${AUDIT_ITEM_COUNT} نقطة — تقرير قبل/بعد`
        : `${AUDIT_ITEM_COUNT}-Point Website Audit — Before/After Report`,
    description:
      locale === "ar"
        ? `تدقيق تقني في ${AUDIT_ITEM_COUNT} نقطة: سرعة، هاتف، SEO، روابط، أمان ووصولية. تقرير قابل للطباعة، إصلاحات فورية، وقياسات مؤرخة من ${price}.`
        : `A ${AUDIT_ITEM_COUNT}-point technical audit: speed, mobile, SEO, links, security and accessibility. Printable report, immediate fixes and dated measurements from ${price}.`,
    keywords: [
      "website audit",
      "Lighthouse audit",
      "SEO audit Libya",
      "speed audit",
      "تدقيق موقع",
      "فحص SEO",
      "تحسين سرعة الموقع",
    ],
  });
}

export default async function AuditPage({ searchParams }: LocalePageProps) {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const ar = locale === "ar";
  const price = formatServicePrice(auditPriceUsd(config.standaloneServices), ar ? "ar" : "en");

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(
            config,
            [
              { name: ar ? "الرئيسية" : "Home", path: "/" },
              { name: ar ? "تدقيق الموقع" : "Audit", path: "/audit" },
            ],
            locale,
          ),
          webPageJsonLd(config, {
            locale,
            path: "/audit",
            name: ar
              ? `تدقيق موقع في ${AUDIT_ITEM_COUNT} نقطة — تقرير قبل/بعد`
              : `${AUDIT_ITEM_COUNT}-Point Website Audit — Before/After Report`,
            description: ar
              ? `تدقيق تقني في ${AUDIT_ITEM_COUNT} نقطة، إصلاحات فورية وتقرير مؤرخ من ${price}.`
              : `A ${AUDIT_ITEM_COUNT}-point technical audit, immediate fixes and a dated report from ${price}.`,
            about: "Website audit",
          }),
        ]}
      />
      <AuditClient />
    </>
  );
}
