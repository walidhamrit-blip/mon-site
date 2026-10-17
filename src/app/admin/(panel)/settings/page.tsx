import { getSiteData } from "@/lib/store";
import type { SiteConfigData } from "@/lib/site-types";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { config } = await getSiteData();
  const initial = JSON.parse(JSON.stringify(config)) as SiteConfigData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Configuration</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Coordonnées, réseaux sociaux et tarifs affichés sur le site public. Les
          modifications sont visibles immédiatement après enregistrement.
        </p>
      </div>
      <SettingsForm initial={initial} />
    </div>
  );
}
