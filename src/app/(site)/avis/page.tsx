import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { getSiteDataCachedShared as getSiteDataCached } from "@/lib/catalog-cache";
import { pageMetadata } from "@/lib/seo";
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
        ? "أين تقرأ تقييمات نخبة وتكتب تقييماً (Trustpilot، Google، Scamadviser)، وكيف نتعامل مع كل تقييم: رد خلال 48 ساعة، دون حذف ودون أي مقابل."
        : "Where to read and write Nukhba reviews (Trustpilot, Google, Scamadviser), and how we handle every review: reply within 48 hours, no deletion, no incentives.",
    keywords: ["تقييمات", "avis clients", "Trustpilot", "Scamadviser", "Nukhba"],
  });
}

export default async function ReviewsPage({ searchParams }: LocalePageProps) {
  const { config, content } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return (
    <div className="pt-6 min-h-[70vh]">
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
