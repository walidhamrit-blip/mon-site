import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { pageMetadata } from "@/lib/seo";
import { ConditionsClient } from "./conditions-client";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: "/conditions",
    title: "الشروط العامة للبيع — Terms & conditions of sale — Nukhba",
    description:
      "شروط الخدمة لمواقع نخبة: الأسعار والدفع بالعملات الرقمية، العربون، الاشتراكات والتجديد، الإلغاء، النطاق والاستضافة، والملكية الفكرية.",
    keywords: ["شروط الخدمة", "terms of service", "Nukhba"],
  });
}

export default function ConditionsPage() {
  return (
    <div className="pt-6 min-h-[70vh]">
      <div className="mx-auto max-w-[800px] px-4 sm:px-6 lg:px-8 py-10">
        <ConditionsClient />
      </div>
    </div>
  );
}
