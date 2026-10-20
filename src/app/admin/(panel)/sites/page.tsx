import { getSiteData } from "@/lib/store";
import type { PricingPlanData } from "@/lib/site-types";
import { SitesManager } from "./sites-manager";

export default async function AdminSitesPage() {
  const { config, content } = await getSiteData();

  return (
    <SitesManager
      initialDemos={content.demos}
      plans={config.pricing.plans as unknown as PricingPlanData[]}
      currency={config.pricing.currency}
    />
  );
}
