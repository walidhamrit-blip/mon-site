"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { localizedPath } from "@/lib/locale";
import {
  EMPTY_MANUAL_PAYMENT_DRAFT,
  ManualPaymentForm,
  manualQuoteForOption,
  type ManualPaymentDraft,
} from "@/components/manual-payment-form";
import type { PublicManualPaymentOption } from "@/lib/manual-payment-public";

export interface SubscriptionPlanView {
  id: string;
  tier: "vitrine" | "vitrine-plus" | "boutique";
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
  /** Souscription réglée par virement manuel : en attente de vérification. */
  manual?: boolean;
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

  const [cycle, setCycle] = useState<Cycle>("annual");
  const [selected, setSelected] = useState<string>("vitrine");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptGraceRule, setAcceptGraceRule] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SubscribeSuccess | null>(null);
  /** Virement manuel (Skrill / Neteller / Airtm / D17 / Volet / WebMoney / Kashy) au lieu de la crypto. */
  const [manualOptions, setManualOptions] = useState<PublicManualPaymentOption[]>([]);
  const [manualDraft, setManualDraft] = useState<ManualPaymentDraft>(EMPTY_MANUAL_PAYMENT_DRAFT);
  const [manualAccepted, setManualAccepted] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const tiers = useMemo(() => {
    const byTier = new Map<string, { name: string; nameEn: string; monthly?: SubscriptionPlanView; annual?: SubscriptionPlanView }>();
    for (const plan of plans) {
      const entry = byTier.get(plan.tier) ?? { name: plan.name, nameEn: plan.nameEn };
      entry[plan.cycle] = plan;
      byTier.set(plan.tier, entry);
    }
    return Array.from(byTier.entries()).map(([tier, value]) => ({ tier, ...value }));
  }, [plans]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/manual-payments/options", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          options?: PublicManualPaymentOption[];
        };
        if (cancelled) return;
        const list = response.ok && Array.isArray(payload.options) ? payload.options : [];
        setManualOptions(list);
        if (list.length > 0) {
          setManualDraft((current) =>
            list.some((item) => item.method === current.method)
              ? current
              : { ...current, method: list[0].method },
          );
        }
      } catch {
        if (!cancelled) setManualOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPlanId = `${selected}-${cycle}`;
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlan || submitting) return;
    if (manualMode) {
      const option = manualOptions.find((item) => item.method === manualDraft.method);
      if (!option) {
        setError(ar ? "طريقة الدفع اليدوي غير متاحة." : "The manual payment method is unavailable.");
        return;
      }
      if (
        manualDraft.senderName.trim().length < 2 ||
        manualDraft.senderAccount.trim().length < 3 ||
        manualDraft.transactionRef.trim().length < 3
      ) {
        setError(
          ar
            ? "أدخل اسم صاحب الحساب وحساب المُرسِل ومعرّف العملية."
            : "Enter the sender name, sender account and transaction ID.",
        );
        return;
      }
      if (!manualAccepted) {
        setError(
          ar
            ? "أكّد أنك حوّلت المبلغ المطلوب."
            : "Confirm that you sent the stated amount.",
        );
        return;
      }
    }
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
          locale,
          ...(manualMode
            ? {
                manualPayment: {
                  ...manualDraft,
                  senderName: manualDraft.senderName.trim(),
                  senderAccount: manualDraft.senderAccount.trim(),
                  transactionRef: manualDraft.transactionRef.trim(),
                  note: manualDraft.note.trim() || undefined,
                  quoteAccepted: manualAccepted,
                  quote: (() => {
                    const option = manualOptions.find(
                      (item) => item.method === manualDraft.method,
                    );
                    const price = Number(selectedPlan.priceUsd);
                    return option && Number.isFinite(price)
                      ? manualQuoteForOption(option, Math.round(price * 100) / 100)
                      : undefined;
                  })(),
                },
              }
            : {}),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as
        | SubscribeSuccess
        | { ok: false; error?: string; message?: string };
      if (response.ok && data.ok === true) {
        setSuccess({ ...(data as SubscribeSuccess), manual: manualMode });
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
          {success.manual
            ? ar
              ? "استلمنا بيانات تحويلك. لا يُفتح الاشتراك إلا بعد أن نتحقق يدوياً من وصول المبلغ — احتفظ بمرجع العملية."
              : "We received your transfer details. The subscription only opens once we verify by hand that the money arrived — keep your transaction reference."
            : ar
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
        {!success.manual && (
          <p className="text-sm rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            {success.notice}
          </p>
        )}
        <a
          href={localizedPath(success.trackingUrl, locale)}
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
                {cycle === "annual" && plan
                  ? `$${(plan.priceUsd / 12).toFixed(2)}`
                  : `$${plan?.priceUsd ?? "—"}`}
                <span className="text-sm font-normal text-[var(--muted-foreground)]">
                  {" "}/ {ar ? "شهر" : "month"}
                </span>
              </div>
              {cycle === "annual" && plan && (
                <div className="mt-2 text-sm text-[var(--muted-foreground)]">
                  {ar
                    ? `الدفع السنوي: $${plan.priceUsd} / سنة`
                    : `Billed yearly: $${plan.priceUsd} / year`}
                </div>
              )}
              {cycle === "annual" && saving > 0 && (
                <div className="mt-1 text-sm font-bold text-[var(--accent)]">
                  {ar ? `توفير $${saving} في السنة` : `You save $${saving} per year`}
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

        {manualOptions.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={!manualMode}
                onClick={() => {
                  setManualMode(false);
                  setError(null);
                }}
                className={`rounded-xl border px-3 py-2.5 text-[12.5px] font-black ${
                  !manualMode
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] hover:border-[var(--accent)]/60"
                }`}
              >
                {ar ? "عملات رقمية" : "Crypto"}
              </button>
              <button
                type="button"
                aria-pressed={manualMode}
                onClick={() => {
                  setManualMode(true);
                  setError(null);
                }}
                className={`rounded-xl border px-3 py-2.5 text-[12.5px] font-black ${
                  manualMode
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] hover:border-[var(--accent)]/60"
                }`}
              >
                {ar ? "تحويل يدوي" : "Manual transfer"}
              </button>
            </div>
            {manualMode && (
              <ManualPaymentForm
                options={manualOptions}
                amountUsd={Math.round(Number(selectedPlan?.priceUsd ?? 0) * 100) / 100}
                draft={manualDraft}
                onDraftChange={setManualDraft}
                quoteAccepted={manualAccepted}
                onQuoteAcceptedChange={setManualAccepted}
                locale={ar ? "ar" : "en"}
              />
            )}
          </div>
        )}

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
            : manualMode
            ? ar
              ? "إرسال بيانات التحويل للتحقق"
              : "Submit transfer details"
            : ar
              ? `اشترك — $${selectedPlan?.priceUsd ?? ""} / ${cycle === "monthly" ? "شهر" : "سنة"}`
              : `Subscribe — $${selectedPlan?.priceUsd ?? ""} / ${cycle === "monthly" ? "month" : "year"}`}
        </button>
      </form>
    </div>
  );
}
