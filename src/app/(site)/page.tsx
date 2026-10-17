import { ServicesRibbon } from "@/components/sections/services-ribbon";
import { Hero } from "@/components/sections/hero";
import { WhyUs } from "@/components/sections/why-us";
import { DemosGallery } from "@/components/sections/demos-gallery";
import { Customizer } from "@/components/sections/customizer";
import { ThemeGallery } from "@/components/sections/theme-gallery";
import { Process } from "@/components/sections/process";
import { Pricing } from "@/components/sections/pricing";
import { Testimonials } from "@/components/sections/testimonials";
import { FAQ } from "@/components/sections/faq";
import { CTAForm } from "@/components/sections/cta-form";

export default function Home() {
  return (
    <>
      <Hero />
      <ServicesRibbon />
      <WhyUs />
      <DemosGallery />
      <Customizer />
      <ThemeGallery />
      <Process />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTAForm />
    </>
  );
}
