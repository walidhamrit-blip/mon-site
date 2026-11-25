import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { getSiteDataCachedShared as getSiteDataCached } from "@/lib/catalog-cache";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { reviewInvitesEnabled, reviewLinks } from "@/lib/trust";
import { TrustpilotBadge } from "@/components/trustpilot-badge";
import { ReviewsClient } from "./reviews-client";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    locale,
    path: "/avis",
    title:
      locale === "ar"
        ? "تقييمات العملاء وسياسة التقييم — نخبة"
        : "Customer reviews & review policy — Nukhba",
    description:
      locale === "ar"
        ? "أين تقرأ تقييمات العملاء وتكتب تجربتك على Trustpilot وGoogle وScamadviser، وكيف نتعامل مع كل تقييم: رد خلال 48 ساعة دون حذف ودون مقابل."
        : "Where to read and write verified client reviews on Trustpilot, Google and Scamadviser, and how every review is handled: reply within 48 hours, no deletion, no incentives.",
    keywords: ["تقييمات", "avis clients", "Trustpilot", "Scamadviser", "Nukhba"],
  });
}

export default async function ReviewsPage({ searchParams }: LocalePageProps) {
  const { config, content } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const ar = locale === "ar";
  return (
    <div className="pt-6 min-h-[70vh]">
      <JsonLd
        data={breadcrumbJsonLd(
          config,
          [
            { name: ar ? "الرئيسية" : "Home", path: "/" },
            { name: ar ? "تقييمات العملاء" : "Customer Reviews", path: "/avis" },
          ],
          locale,
        )}
      />
      <div className="mx-auto max-w-[860px] px-4 sm:px-6 lg:px-8 py-10">
        <ReviewsClient
          trustbox={<TrustpilotBadge config={config} locale={locale} height="24px" />}
          links={reviewLinks(config.trust)}
          invitesEnabled={reviewInvitesEnabled(config.trust)}
          testimonials={content.testimonials.slice(0, 6).map((item) => ({
            name: item.name,
            nameEn: item.nameEn,
            role: item.role,
            roleEn: item.roleEn,
            text: item.text,
            textEn: item.textEn,
          }))}
          supportEmail={config.email}
          whatsapp={`https://wa.me/${config.whatsapp}`}
        />
      </div>
    </div>
  );
}
