import type { Metadata } from "next";
import Link from "next/link";
import { findSubscriptionForTracking } from "@/lib/subscriptions";
import { SUBSCRIPTION_GRACE_DAYS } from "@/lib/subscription-plans";
import type { SubscriptionDisplayStatus } from "@/lib/subscription-lifecycle";

export const metadata: Metadata = {
  title: "متابعة الاشتراك — Nukhba",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<SubscriptionDisplayStatus, { ar: string; en: string; tone: string }> = {
  inactive: { ar: "بانتظار الدفع الأول", en: "Awaiting first payment", tone: "text-amber-500" },
  active: { ar: "نشط", en: "Active", tone: "text-emerald-500" },
  grace: { ar: "فترة السماح", en: "Grace period", tone: "text-amber-500" },
  expired: { ar: "موقوف", en: "Suspended", tone: "text-red-500" },
  canceled: { ar: "ملغى", en: "Canceled", tone: "text-[var(--muted-foreground)]" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Tripoli",
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
}) {
  const { ref, t } = await searchParams;
  const view = ref ? await findSubscriptionForTracking(ref, t ?? null) : null;

  if (!view) {
    return (
      <main className="pt-6 min-h-[70vh]">
        <div className="mx-auto max-w-[720px] px-4 py-16 space-y-4 text-center">
          <h1 className="text-2xl font-black">لم نجد هذا الاشتراك</h1>
          <p className="text-[var(--muted-foreground)]">
            الرابط غير صحيح أو منتهي. تحقق من الرابط الذي وصلك.
          </p>
          <Link href="/abonnements" className="inline-block underline">
            الاشتراكات
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
            {label.ar} · {label.en}
          </p>
        </header>

        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-[var(--muted-foreground)]">الدورة / Cycle</div>
            <div className="font-bold">{cycleLabel}</div>
          </div>
          <div>
            <div className="text-[var(--muted-foreground)]">المبلغ / Amount</div>
            <div className="font-bold">${view.priceUsd}</div>
          </div>
          <div>
            <div className="text-[var(--muted-foreground)]">نهاية الفترة المدفوعة / Paid until</div>
            <div className="font-bold">{formatDate(view.currentPeriodEnd)}</div>
          </div>
          <div>
            <div className="text-[var(--muted-foreground)]">آخر يوم للوصول / Access until</div>
            <div className="font-bold">{formatDate(view.accessEndsAt)}</div>
          </div>
          {view.emailMasked && (
            <div className="sm:col-span-2">
              <div className="text-[var(--muted-foreground)]">البريد الإلكتروني / E-mail</div>
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

        {view.canResubscribe && (
          <Link
            href="/abonnements"
            className="inline-flex items-center rounded-2xl bg-[var(--accent)] px-5 py-3 font-bold text-[var(--accent-foreground)]"
          >
            الاشتراك من جديد / Subscribe again
          </Link>
        )}
      </div>
    </main>
  );
}
