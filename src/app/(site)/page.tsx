import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { pageMetadata } from "@/lib/seo";
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
    description:
      "نخبة وكالة تصميم مواقع في طرابلس: مواقع واجهة فاخرة، متاجر إلكترونية وأنظمة حجز — تسليم في 7 أيام، سرعة 90+ Lighthouse، تحسين SEO لمحركات البحث والذكاء الاصطناعي، ودعم واتساب. اطلب عرضك المجاني.",
    keywords: [
      "تصميم مواقع طرابلس",
      "شركة تصميم مواقع ليبيا",
      "متجر إلكتروني ليبيا",
      "web design Tripoli Libya",
    ],
  });
}

export default function Home() {
  return (
    <>
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
