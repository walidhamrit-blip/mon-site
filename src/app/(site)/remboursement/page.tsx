import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { pageMetadata } from "@/lib/seo";
import { RefundClient } from "./refund-client";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: "/remboursement",
    title: "سياسة الاسترداد — Refund policy — Nukhba",
    description: "سياسة استرداد مدفوعات نخبة: العربون، إلغاء الاشتراكات، ضمان الخدمة وكيفية طلب الاسترداد عبر البريد الإلكتروني أو واتساب.",
    keywords: ["سياسة الاسترداد", "refund policy", "Nukhba"],
  });
}

export default function RefundPage() {
  return (
    <div className="mx-auto max-w-[800px] px-4 py-16 sm:px-6 lg:px-8">
      <RefundClient />
    </div>
  );
}
