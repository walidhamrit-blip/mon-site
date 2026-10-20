"use client";

import { Hero } from "@/components/sections/hero";
import { ServicesRibbon } from "@/components/sections/services-ribbon";
import { WhyUs } from "@/components/sections/why-us";
import {
  DemosGallery,
  CustomShowcaseSection,
} from "@/components/sections/demos-gallery";
import { IdentityStudio } from "@/components/sections/identity-studio";
import { Process } from "@/components/sections/process";
import { Pricing } from "@/components/sections/pricing";
import { Services } from "@/components/sections/services";
import { Testimonials } from "@/components/sections/testimonials";
import { FAQ } from "@/components/sections/faq";
import { CTAForm } from "@/components/sections/cta-form";
import { useSiteConfig, useSiteContent } from "@/components/site-provider";
import type { BuiltInSectionId } from "@/lib/site-types";

function renderBuiltInSection(id: BuiltInSectionId) {
  switch (id) {
    case "hero":
      return <Hero />;
    case "ribbon":
      return <ServicesRibbon />;
    case "whyUs":
      return <WhyUs />;
    case "demos":
      return <DemosGallery />;
    case "identityStudio":
      return <IdentityStudio />;
    case "process":
      return <Process />;
    case "pricing":
      return <Pricing />;
    case "services":
      return <Services />;
    case "testimonials":
      return <Testimonials />;
    case "faq":
      return <FAQ />;
    case "cta":
      return <CTAForm />;
    default:
      return null;
  }
}

export function HomeSections() {
  const config = useSiteConfig();
  const { layout } = useSiteContent();
  const customMap = new Map(layout.customSections.map((s) => [s.id, s]));

  const heroEnabled = layout.entries.some(
    (e) => e.kind === "builtin" && e.builtinId === "hero" && e.enabled,
  );

  return (
    <>
      {!heroEnabled && (
        <div className="pt-[88px]">
          <h1 className="sr-only">
            {config.nameAr} — {config.name}
          </h1>
        </div>
      )}
      {layout.entries
        .filter((entry) => entry.enabled)
        .map((entry) => {
          if (entry.kind === "builtin" && entry.builtinId) {
            return (
              <div key={entry.key}>{renderBuiltInSection(entry.builtinId)}</div>
            );
          }
          if (entry.kind === "custom" && entry.customId) {
            const sec = customMap.get(entry.customId);
            if (!sec) return null;
            return <CustomShowcaseSection key={entry.key} section={sec} />;
          }
          return null;
        })}
    </>
  );
}
