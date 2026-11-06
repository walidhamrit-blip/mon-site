import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import { pageMetadata } from "@/lib/seo";
import { legalRows } from "@/lib/trust";
import { LegalNoticeClient } from "./legal-notice-client";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    locale,
    path: "/mentions-legales",
    title: locale === "ar" ? "المعلومات القانونية — نخبة" : "Legal notice — Nukhba",
    description:
      locale === "ar"
        ? "المعلومات القانونية لنخبة: الاسم التجاري، السجل التجاري، العنوان، الهاتف، البريد الإلكتروني، مسؤول النشر والاستضافة."
        : "Nukhba legal notice: trading name, commercial registration, address, phone, e-mail, publication manager and hosting provider.",
    keywords: ["المعلومات القانونية", "mentions légales", "Nukhba"],
  });
}

export default async function LegalNoticePage() {
  const { config } = await getSiteDataCached();
  return (
    <div className="pt-6 min-h-[70vh]">
      <div className="mx-auto max-w-[860px] px-4 sm:px-6 lg:px-8 py-10">
        <LegalNoticeClient rows={legalRows(config)} supportEmail={config.email} />
      </div>
    </div>
  );
}
