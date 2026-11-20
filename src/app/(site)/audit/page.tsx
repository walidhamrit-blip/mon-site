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
import { AuditClient } from "./audit-client";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    locale,
    path: "/audit",
    title:
      locale === "ar"
        ? "تدقيق موقع في 46 نقطة — تقرير قبل/بعد"
        : "46-Point Website Audit — Before/After Report",
    description:
      locale === "ar"
        ? "تدقيق تقني في 46 نقطة: سرعة، هاتف، SEO، روابط، أمان ووصولية. تقرير قابل للطباعة، إصلاحات فورية، وقياسات مؤرخة من 90 دولاراً."
        : "A 46-point technical audit: speed, mobile, SEO, links, security and accessibility. Printable report, immediate fixes and dated measurements from $90.",
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

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(
            config,
            [
              { name: "Home", path: "/" },
              { name: "Audit", path: "/audit" },
            ],
            locale,
          ),
          webPageJsonLd(config, {
            locale,
            path: "/audit",
            name:
              locale === "ar"
                ? "تدقيق موقع في 46 نقطة — تقرير قبل/بعد"
                : "46-Point Website Audit — Before/After Report",
            description:
              locale === "ar"
                ? "تدقيق تقني في 46 نقطة، إصلاحات فورية وتقرير مؤرخ من 90 دولاراً."
                : "A 46-point technical audit, immediate fixes and a dated report from $90.",
            about: "Website audit",
          }),
        ]}
      />
      <AuditClient />
    </>
  );
}
