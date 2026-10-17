import { Hero } from "@/components/sections/hero";
import { WhyUs } from "@/components/sections/why-us";
import { DemosGallery } from "@/components/sections/demos-gallery";
import { Customizer } from "@/components/sections/customizer";
import { Process } from "@/components/sections/process";
import { Pricing } from "@/components/sections/pricing";
import { Testimonials } from "@/components/sections/testimonials";
import { FAQ } from "@/components/sections/faq";
import { CTAForm } from "@/components/sections/cta-form";

export default function Home() {
  return (
    <>
      <Hero />
      <WhyUs />
      <DemosGallery />
      <Customizer />
      <Process />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTAForm />

      {/* Analytics placeholder */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Plausible / GA placeholder - replace with real ID
            // window.plausible = window.plausible || function(){(plausible.q = plausible.q || []).push(arguments)}
          `,
        }}
      />
    </>
  );
}
