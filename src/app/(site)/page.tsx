import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import {
  DEFAULT_META_DESCRIPTION,
  faqJsonLd,
  howToJsonLd,
  pageMetadata,
} from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { ServicesRibbon } from "@/components/sections/services-ribbon";
import { Hero } from "@/components/sections/hero";
import { WhyUs } from "@/components/sections/why-us";
import { DemosGallery } from "@/components/sections/demos-gallery";
import { IdentityStudio } from "@/components/sections/identity-studio";
import { Process } from "@/components/sections/process";
import { Pricing } from "@/components/sections/pricing";
import { FlexiblePayment } from "@/components/sections/flexible-payment";
import { Services } from "@/components/sections/services";
import { Testimonials } from "@/components/sections/testimonials";
import { FAQ } from "@/components/sections/faq";
import { CTAForm } from "@/components/sections/cta-form";

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

export default async function Home() {
  const { config, content } = await getSiteDataCached();
  return (
    <>
      <JsonLd
        data={[
          faqJsonLd(content.faqs),
          howToJsonLd(config, content.process),
        ]}
      />
      <Hero />
      <ServicesRibbon />
      <WhyUs />
      <DemosGallery />
      <IdentityStudio />
      <Process />
      <Pricing />
      <FlexiblePayment />
      <Services />
      <Testimonials />
      <FAQ />
      <CTAForm />
    </>
  );
}
