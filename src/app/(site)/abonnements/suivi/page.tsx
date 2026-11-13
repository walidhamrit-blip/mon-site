import type { Metadata } from "next";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { LocalizedLink as Link } from "@/components/localized-link";
import { findSubscriptionForTracking } from "@/lib/subscriptions";
import { getSiteDataCachedShared as getSiteDataCached } from "@/lib/catalog-cache";
import { resolveMarket } from "@/lib/market";
import { SUBSCRIPTION_GRACE_DAYS } from "@/lib/subscription-plans";
import { CancelRenewal } from "./cancel-renewal";
import { pageMetadata } from "@/lib/seo";
import type { SubscriptionDisplayStatus } from "@/lib/subscription-lifecycle";

export async function generateMetadata({ searchParams }: LocalePageProps): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    path: "/abonnements/suivi",
    locale,
    title: locale === "ar" ? "متابعة الاشتراك — نخبة" : "Subscription Tracking — Nukhba",
    description: locale === "ar"
      ? "تابع حالة اشتراكك وموعد التجديد وفترة السماح."
      : "Track your subscription status, renewal date and grace period.",
    noindex: true,
  });
}

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<SubscriptionDisplayStatus, { ar: string; en: string; tone: string }> = {
  inactive: { ar: "بانتظار الدفع الأول", en: "Awaiting first payment", tone: "text-amber-500" },
  active: { ar: "نشط", en: "Active", tone: "text-emerald-500" },
  grace: { ar: "فترة السماح", en: "Grace period", tone: "text-amber-500" },
  expired: { ar: "موقوف", en: "Suspended", tone: "text-red-500" },
};

function formatDate(iso: string | null, timeZone: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  });
}

/**
 * Espace abonné : statut, prochaine échéance et délai de grâce.
 * Accès par référence + jeton (le même lien que celui de la souscription).
 */
export default async function SubscriptionTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; t?: string }>;
} & LocalePageProps) {
  const { ref, t } = await searchParams;
  const view = ref ? await findSubscriptionForTracking(ref, t ?? null) : null;
  // Les dates sont affichées dans le fuseau du marché configuré (et non un
  // fuseau figé) : un abonné à l'étranger voit des dates cohérentes.
  const { config } = await getSiteDataCached();
  const market = resolveMarket(config.market);
  const ar = (await pageLocale(config, searchParams)) === "ar";

  if (!view) {
    return (
      <main className="pt-6 min-h-[70vh]">
        <div className="mx-auto max-w-[720px] px-4 py-16 space-y-4 text-center">
          <h1 className="text-2xl font-black">{ar ? "لم نجد هذا الاشتراك" : "Subscription not found"}</h1>
          <p className="text-[var(--muted-foreground)]">
            {ar ? "الرابط غير صحيح أو منتهي. تحقق من الرابط الذي وصلك." : "The link is invalid or expired. Check the link you received."}
          </p>
          <Link href="/abonnements" className="inline-block underline">
            {ar ? "الاشتراكات" : "Subscriptions"}
          </Link>
        </div>
      </main>
    );
  }

  const label = STATUS_LABELS[view.status];
  const cycleLabel = view.cycle === "annual" ? "سنوي / Annual" : "شهري / Monthly";

  return (
    <main className="pt-6 min-h-[70vh]">
      <div className="mx-auto max-w-[720px] px-4 sm:px-6 py-10 space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-[var(--muted-foreground)]" dir="ltr">
            {view.ref}
          </p>
          <h1 className="text-3xl font-black">{view.planName}</h1>
          <p className={`text-lg font-bold ${label.tone}`}>
            {ar ? label.ar : label.en}
          </p>
        </header>

        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-[var(--muted-foreground)]">{ar ? "الدورة" : "Cycle"}</div>
            <div className="font-bold">{cycleLabel}</div>
          </div>
          <div>
            <div className="text-[var(--muted-foreground)]">{ar ? "المبلغ" : "Amount"}</div>
            <div className="font-bold">${view.priceUsd}</div>
          </div>
          <div>
            <div className="text-[var(--muted-foreground)]">{ar ? "نهاية الفترة المدفوعة" : "Paid until"}</div>
            <div className="font-bold">{formatDate(view.currentPeriodEnd, market.timezone)}</div>
          </div>
          <div>
            <div className="text-[var(--muted-foreground)]">{ar ? "آخر يوم للوصول" : "Access until"}</div>
            <div className="font-bold">{formatDate(view.accessEndsAt, market.timezone)}</div>
          </div>
          {view.emailMasked && (
            <div className="sm:col-span-2">
              <div className="text-[var(--muted-foreground)]">{ar ? "البريد الإلكتروني" : "E-mail"}</div>
              <div className="font-bold" dir="ltr">{view.emailMasked}</div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          فترة السماح لا يمكن أن تتجاوز {SUBSCRIPTION_GRACE_DAYS} أيام وفق قواعد بوابة الدفع NOWPayments.
          بعد ذلك يُوقف الاشتراك، ويمكنك الاشتراك من جديد.
          <br />
          <span className="text-[var(--muted-foreground)]">
            The grace period cannot exceed {SUBSCRIPTION_GRACE_DAYS} days under NOWPayments&apos; rules. After
            that the subscription is suspended and you can subscribe again.
          </span>
        </section>

        {view.status === "inactive" && (
          <p className="text-sm text-[var(--muted-foreground)]">
            أرسلت NOWPayments رابط الدفع الأول إلى بريدك الإلكتروني. أكمل الدفع لتفعيل الاشتراك.
          </p>
        )}

        {view.renewalCanceled && view.status !== "expired" && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--secondary)]/40 p-4 text-sm">
            تم إلغاء التجديد التلقائي. يبقى وصولك مفعّلاً حتى {formatDate(view.accessEndsAt, market.timezone)}.
            <br />
            <span className="text-[var(--muted-foreground)]">
              Renewal canceled. Access stays open until {formatDate(view.accessEndsAt, market.timezone)}. No further invoices will be issued.
            </span>
          </section>
        )}

        {!view.renewalCanceled && (view.status === "active" || view.status === "grace") && (
          <CancelRenewal reference={view.ref} token={t ?? ""} accessUntil={view.accessEndsAt} />
        )}

        {view.canResubscribe && (
          <Link
            href="/abonnements"
            className="inline-flex items-center rounded-2xl bg-[var(--accent)] px-5 py-3 font-bold text-[var(--accent-foreground)]"
          >
            {ar ? "الاشتراك من جديد" : "Subscribe again"}
          </Link>
        )}
      </div>
    </main>
  );
}
