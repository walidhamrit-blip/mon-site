import type { Metadata } from "next";
import { HomeSections } from "@/components/sections/home-sections";
import { getSiteDataCached } from "@/lib/store";
import {
  DEFAULT_META_DESCRIPTION,
  faqJsonLd,
  howToJsonLd,
  pageMetadata,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: "/",
    title: "تصميم مواقع ومتاجر إلكترونية في طرابلس — تسليم في 7 أيام",
    description: DEFAULT_META_DESCRIPTION,
    keywords: [
      "تصميم مواقع طرابلس",
      "شركة تصميم مواقع ليبيا",
      "متجر إلكتروني ليبيا",
      "web design Tripoli Libya",
    ],
  });
}

export default async function HomePage() {
  const { config, content } = await getSiteDataCached();
  const isSectionEnabled = (id: string) =>
    content.layout.entries.some(
      (e) => e.kind === "builtin" && e.builtinId === id && e.enabled,
    );

  const schemas: Record<string, unknown>[] = [];
  if (isSectionEnabled("faq") && content.faqs.length > 0) {
    schemas.push(faqJsonLd(content.faqs));
  }
  if (isSectionEnabled("process") && content.process.length > 0) {
    schemas.push(howToJsonLd(config, content.process));
  }

  return (
    <>
      {schemas.length > 0 && <JsonLd data={schemas} />}
      <HomeSections />
    </>
  );
}
