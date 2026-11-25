import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { legalRows } from "@/lib/trust";
import { LegalNoticeClient } from "./legal-notice-client";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    locale,
    path: "/mentions-legales",
    title:
      locale === "ar"
        ? "المعلومات القانونية وبيانات الناشر — نخبة"
        : "Legal Notice, Publisher & Hosting Info — Nukhba",
    description:
      locale === "ar"
        ? "البيانات القانونية الرسمية: الاسم التجاري، السجل التجاري، العنوان في طرابلس، الهاتف، البريد الإلكتروني، مسؤول النشر ومزوّد الاستضافة."
        : "Official publisher details: trading name, commercial registration, Tripoli address, phone, support email, publication manager and hosting provider.",
    keywords: ["المعلومات القانونية", "mentions légales", "Nukhba"],
  });
}

export default async function LegalNoticePage({ searchParams }: LocalePageProps) {
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
            { name: ar ? "المعلومات القانونية" : "Legal Notice", path: "/mentions-legales" },
          ],
          locale,
        )}
      />
      <div className="mx-auto max-w-[860px] px-4 sm:px-6 lg:px-8 py-10">
        <LegalNoticeClient rows={legalRows(config)} supportEmail={config.email} />
      </div>
    </div>
  );
}
