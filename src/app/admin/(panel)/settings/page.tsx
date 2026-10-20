import { getSiteData } from "@/lib/store";
import type { SiteConfigData } from "@/lib/site-types";
import { SettingsForm } from "./settings-form";

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminSettingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const { config } = await getSiteData();

  return (
    <SettingsForm
      initial={config as unknown as SiteConfigData}
      initialTab={params.tab}
    />
  );
}
