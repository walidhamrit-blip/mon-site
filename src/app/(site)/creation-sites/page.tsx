import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import { breadcrumbJsonLd, howToJsonLd, pageMetadata, siteLocale, webPageJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { WebsiteCreationView } from "@/components/website-creation-view";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const ar = locale === "ar";
  return pageMetadata(config, {
    locale,
    path: "/creation-sites",
    title: ar ? "إنشاء مواقع ومتاجر إلكترونية في {city}" : "Website & Online Store Creation in {cityEn}",
    description: ar ? "إنشاء مواقع ومتاجر إلكترونية في {country}: استعرض الباقات والأسعار ونماذج المواقع وخطوات العمل ثم اطلب عرض سعر يناسب مشروعك." : "Website and online store creation in {countryEn}. Explore packages, prices, website examples and our process, then request a quote for your project.",
  });
}

export default async function WebsiteCreationPage({ searchParams }: LocalePageProps) {
  const { config, content } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const ar = locale === "ar";
  const name = ar ? "إنشاء المواقع" : "Website creation";
  // FAQ text matches the initial server locale, as does the visible view.
  const faq = { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: ar ? "ar" : "en", mainEntity: content.faqs.map((item) => ({ "@type": "Question", name: ar ? item.qAr : item.qEn, acceptedAnswer: { "@type": "Answer", text: ar ? item.aAr : item.aEn } })) };
  return <>
    <JsonLd data={[
      breadcrumbJsonLd(config, [{ name: ar ? "الرئيسية" : "Home", path: "/" }, { name, path: "/creation-sites" }], locale),
      webPageJsonLd(config, { path: "/creation-sites", locale, name, description: ar ? "الباقات والنماذج وخطوات إنشاء موقع لنشاطك." : "Packages, examples and the steps to create a website for your business." }),
      howToJsonLd(config, content.process),
      ...(content.faqs.length ? [faq] : []),
    ]} />
    <WebsiteCreationView />
  </>;
}
