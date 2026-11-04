import { getSiteData } from "@/lib/store";
import { VisualsEditor } from "./visuals-editor";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  const { content } = await getSiteData();
  return <VisualsEditor initial={content.visuals} />;
}
