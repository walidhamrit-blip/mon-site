import { getSiteData } from "@/lib/store";
import type { PricingPlanData } from "@/lib/site-types";
import { ContentEditor } from "./content-editor";

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminContentPage({ searchParams }: Props) {
  const params = await searchParams;
  const { config, content } = await getSiteData();

  return (
    <ContentEditor
      initial={content}
      plans={config.pricing.plans as unknown as PricingPlanData[]}
      currency={config.pricing.currency}
      initialTab={params.tab}
    />
  );
}
