import { getSiteData } from "@/lib/store";
import type { PricingPlanData } from "@/lib/site-types";
import { SectionsStudio } from "./sections-studio";

export default async function AdminSectionsPage() {
  const { config, content } = await getSiteData();

  return (
    <SectionsStudio
      initialLayout={content.layout}
      initialDemos={content.demos}
      plans={config.pricing.plans as unknown as PricingPlanData[]}
      currency={config.pricing.currency}
    />
  );
}
