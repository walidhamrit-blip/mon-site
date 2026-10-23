"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

export interface SubscriptionPlanView {
  id: string;
  tier: "vitrine" | "vitrine-plus" | "boutique" | "test";
  cycle: "monthly" | "annual";
  name: string;
  nameEn: string;
  priceUsd: number;
  intervalDay: number;
}

type Cycle = "monthly" | "annual";

interface SubscribeSuccess {
  ok: true;
  ref: string;
  planName: string;
  priceUsd: string;
  intervalDay: number;
  trackingUrl: string;
  graceDays: number;
  notice: string;
}

const ERROR_MESSAGES: Record<string, { ar: string; en: string }> = {
  already_subscribed: {
    ar: "يوجد اشتراك نشط بهذه الباقة لهذا البريد الإلكتروني.",
    en: "An active subscription to this plan already exists for this e-mail.",
  },
  plans_not_synced: {
    ar: "الاشتراكات غير متاحة حالياً. حاول لاحقاً.",
    en: "Subscriptions are not available right now. Please try again later.",
  },
  rate_limited: {
    ar: "محاولات كثيرة. حاول بعد بضع دقائق.",
    en: "Too many attempts. Please try again in a few minutes.",
  },
  invalid_input: {
    ar: "تحقق من الحقول المطلوبة.",
    en: "Please check the required fields.",
  },
  gateway_error: {
    ar: "تعذّر إنشاء الاشتراك لدى بوابة الدفع. حاول مرة أخرى.",
    en: "Could not create the subscription with the payment gateway. Please try again.",
  },
};

export function AbonnementsClient({
  plans,
  graceDays,
}: {
  plans: SubscriptionPlanView[];
  graceDays: number;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";

  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [selected, setSelected] = useState<string>("vitrine");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptGraceRule, setAcceptGraceRule] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SubscribeSuccess | null>(null);

  const tiers = useMemo(() => {
    const byTier = new Map<string, { name: string; nameEn: string; monthly?: SubscriptionPlanView; annual?: SubscriptionPlanView }>();
    for (const plan of plans) {
      const entry = byTier.get(plan.tier) ?? { name: plan.name, nameEn: plan.nameEn };
      entry[plan.cycle] = plan;
      byTier.set(plan.tier, entry);
    }
    return Array.from(byTier.entries()).map(([tier, value]) => ({ tier, ...value }));
  }, [plans]);

  const selectedPlanId = `${selected}-${cycle}`;
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlan || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan.id,
          name,
          email,
          phone,
          acceptGraceRule: true,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as
        | SubscribeSuccess
        | { ok: false; error?: string; message?: string };
      if (response.ok && data.ok === true) {
        setSuccess(data as SubscribeSuccess);
        return;
      }
      const failure = data as { error?: string; message?: string };
      const known = failure.error ? ERROR_MESSAGES[failure.error] : undefined;
      if (failure.error === "gateway_error" && failure.message) {
        setError(failure.message);
        return;
      }
      setError(known ? (ar ? known.ar : known.en) : failure.message ?? (ar ? "حدث خطأ." : "Something went wrong."));
    } catch {
      setError(ar ? "تعذّر الاتصال بالخادم." : "Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 space-y-4">
        <h1 className="text-2xl font-black">
          {ar ? "تم إنشاء اشتراكك" : "Your subscription is created"}
        </h1>
        <p className="text-[var(--muted-foreground)]">
          {ar
            ? `أرسلنا رابط الدفع الأول إلى ${email} عبر NOWPayments. أكمل الدفع بالعملة الرقمية التي تختارها لتفعيل الاشتراك.`
            : `The first payment link was sent to ${email} by NOWPayments. Pay with the crypto of your choice to activate the subscription.`}
        </p>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--secondary)]/40 p-4 text-sm space-y-1">
          <div>
            {ar ? "المرجع" : "Reference"}: <strong dir="ltr">{success.ref}</strong>
          </div>
          <div>
            {ar ? "الباقة" : "Plan"}: <strong>{success.planName}</strong> — ${success.priceUsd} /{" "}
            {success.intervalDay >= 365 ? (ar ? "سنة" : "year") : ar ? "شهر" : "month"}
          </div>
        </div>
        <p className="text-sm rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          {success.notice}
        </p>
        <a
          href={success.trackingUrl}
          className="inline-flex items-center rounded-2xl bg-[var(--accent)] px-5 py-3 font-bold text-[var(--accent-foreground)]"
        >
          {ar ? "متابعة اشتراكي" : "Follow my subscription"}
        </a>
        <p className="text-xs text-[var(--muted-foreground)]">
          {ar
            ? "احفظ هذا الرابط: هو الوسيلة الوحيدة لمتابعة اشتراكك."
            : "Keep this link: it is the only way to follow your subscription."}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3 text-center">
        <h1 className="text-3xl sm:text-4xl font-black">
          {ar ? "اشتراكات شهرية وسنوية" : "Monthly & annual subscriptions"}
        </h1>
        <p className="text-[var(--muted-foreground)]">
          {ar
            ? "ادفع بالعملات الرقمية عبر NOWPayments. اختر الباقة والدورة."
            : "Pay with crypto through NOWPayments. Choose a plan and a billing cycle."}
        </p>
        <div className="inline-flex rounded-2xl border border-[var(--border)] p-1" role="tablist">
          {(["annual", "monthly"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={cycle === value}
              onClick={() => setCycle(value)}
              className={`rounded-xl px-5 py-2 text-sm font-bold ${
                cycle === value
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "text-[var(--muted-foreground)]"
              }`}
            >
              {value === "monthly" ? (ar ? "شهري" : "Monthly") : ar ? "سنوي" : "Annual"}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((tier) => {
          const plan = cycle === "monthly" ? tier.monthly : tier.annual;
          const isSelected = selected === tier.tier;
          const saving =
            tier.monthly && tier.annual
              ? tier.monthly.priceUsd * 12 - tier.annual.priceUsd
              : 0;
          return (
            <button
              key={tier.tier}
              type="button"
              onClick={() => setSelected(tier.tier)}
              aria-pressed={isSelected}
              className={`text-start rounded-[24px] border p-6 transition ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] bg-[var(--card)]"
              }`}
            >
              <div className="text-lg font-black">{ar ? tier.name : tier.nameEn}</div>
              <div className="mt-3 text-3xl font-black">
                ${plan?.priceUsd ?? "—"}
                <span className="text-sm font-normal text-[var(--muted-foreground)]">
                  {" "}/ {cycle === "monthly" ? (ar ? "شهر" : "month") : ar ? "سنة" : "year"}
                </span>
              </div>
              {cycle === "annual" && plan && (
                <div className="mt-2 text-sm font-bold">
                  {ar
                    ? `أي $${(plan.priceUsd / 12).toFixed(2)} / شهر`
                    : `That is $${(plan.priceUsd / 12).toFixed(2)} / month`}
                </div>
              )}
              {cycle === "annual" && saving > 0 && (
                <div className="mt-1 text-sm text-[var(--accent)]">
                  {ar ? `توفير $${saving} مقارنة بالشهري` : `Save $${saving} vs monthly`}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-bold">{ar ? "الاسم الكامل" : "Full name"}</span>
            <input
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-bold">{ar ? "البريد الإلكتروني" : "E-mail"}</span>
            <input
              required
              type="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3"
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm font-bold">{ar ? "الهاتف" : "Phone"}</span>
            <input
              required
              minLength={6}
              maxLength={24}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm space-y-2">
          <p>
            {ar
              ? `ملاحظة هامة: فترة السماح لا يمكن أن تتجاوز ${graceDays} أيام وفق قواعد بوابة الدفع NOWPayments. عند انتهاء هذه المدة يُعلَّق الاشتراك، ويمكنك الاشتراك من جديد في أي وقت.`
              : `Important: the grace period cannot exceed ${graceDays} days under NOWPayments' rules. After that the subscription is suspended, and you can subscribe again at any time.`}
          </p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              required
              checked={acceptGraceRule}
              onChange={(e) => setAcceptGraceRule(e.target.checked)}
              className="mt-1"
            />
            <span>
              {ar
                ? "أقرّ بأنني اطلعت على هذه القاعدة وأوافق عليها."
                : "I have read this rule and accept it."}
            </span>
          </label>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !acceptGraceRule || !selectedPlan}
          className="w-full rounded-2xl bg-[var(--accent)] px-5 py-3 font-black text-[var(--accent-foreground)] disabled:opacity-50"
        >
          {submitting
            ? ar ? "جارٍ الإنشاء…" : "Creating…"
            : ar
              ? `اشترك — $${selectedPlan?.priceUsd ?? ""} / ${cycle === "monthly" ? "شهر" : "سنة"}`
              : `Subscribe — $${selectedPlan?.priceUsd ?? ""} / ${cycle === "monthly" ? "month" : "year"}`}
        </button>
      </form>
    </div>
  );
}
