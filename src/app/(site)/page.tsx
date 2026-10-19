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
