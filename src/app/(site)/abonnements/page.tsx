import type { Metadata } from "next";
import { getSiteDataCached } from "@/lib/store";
import { pageMetadata } from "@/lib/seo";
import { SUBSCRIPTION_GRACE_DAYS, SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";
import { AbonnementsClient } from "./abonnements-client";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  return pageMetadata(config, {
    path: "/abonnements",
    title: "اشتراكات شهرية وسنوية — الدفع بالعملات الرقمية",
    description:
      "اشترك شهرياً أو سنوياً في باقات الواجهة والمتجر، وادفع بالعملات الرقمية عبر NOWPayments. تُجدَّد الاشتراكات تلقائياً عبر رابط دفع يصلك بالبريد الإلكتروني.",
    keywords: [
      "اشتراك موقع شهري",
      "دفع بالعملات الرقمية",
      "subscription website Libya",
    ],
  });
}

export default async function AbonnementsPage() {
  return (
    <main className="pt-6 min-h-[70vh]">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8 py-10">
        <AbonnementsClient
          plans={SUBSCRIPTION_PLANS.map((plan) => ({
            id: plan.id,
            tier: plan.tier,
            cycle: plan.cycle,
            name: plan.name,
            nameEn: plan.nameEn,
            priceUsd: plan.priceUsd,
            intervalDay: plan.intervalDay,
          }))}
          graceDays={SUBSCRIPTION_GRACE_DAYS}
        />
      </div>
    </main>
  );
}
