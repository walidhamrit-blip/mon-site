"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { PayGateProviderOption } from "@/lib/paygate-core";

interface CardCheckoutClientProps {
  orderRef: string;
  checkoutToken: string;
  orderKind: string;
  planName: string;
  maskedEmail: string;
  billedUsd: number;
  initialStatus: string;
  forcedProvider: string;
  providers: PayGateProviderOption[];
  errorCode: string | null;
  triedProvider: string | null;
}

export function CardCheckoutClient({
  orderRef,
  checkoutToken,
  orderKind,
  planName,
  maskedEmail,
  billedUsd,
  initialStatus,
  forcedProvider,
  providers,
  errorCode,
  triedProvider,
}: CardCheckoutClientProps) {
  const { locale } = useI18n();
  const ar = locale === "ar";

  const eligibleProviders = providers.filter((p) => p.eligible);
  const defaultProviderId =
    forcedProvider || eligibleProviders[0]?.id || providers[0]?.id || "auto";

  const [selectedProvider, setSelectedProvider] = useState<string>(defaultProviderId);
  const [status, setStatus] = useState<string>(initialStatus);
  const [showAllProviders, setShowAllProviders] = useState<boolean>(
    Boolean(errorCode === "provider_unavailable"),
  );

  useEffect(() => {
    if (status === "paid") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/payments/paygate/status?ref=${encodeURIComponent(orderRef)}&k=${encodeURIComponent(checkoutToken)}`,
          { cache: "no-store" },
        );
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          status?: string;
        } | null;
        if (!cancelled && res.ok && data?.ok && data.status) {
          setStatus(data.status);
        }
      } catch {
        /* silencieux : prochain essai dans 5 s */
      }
    };
    const timer = setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [orderRef, checkoutToken, status]);

  const goHref = (providerId: string) =>
    `/api/payments/paygate/go?ref=${encodeURIComponent(orderRef)}&k=${encodeURIComponent(checkoutToken)}&provider=${encodeURIComponent(providerId)}&lang=${ar ? "ar" : "en"}`;

  const trackingFallbackHref =
    orderKind === "digital"
      ? `/codes/commande?ref=${encodeURIComponent(orderRef)}`
      : `/pay/success?ref=${encodeURIComponent(orderRef)}`;

  if (status === "paid") {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-emerald-500/35 bg-[var(--card)] p-6 sm:p-8 text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-xl font-black text-[var(--foreground)]">
          {ar ? "تم تأكيد الدفع بنجاح!" : "Payment confirmed!"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          {orderKind === "digital"
            ? ar
              ? "تم استلام الدفع وجارٍ إرسال الكود تلقائياً إلى بريدك الإلكتروني وعلى صفحة تتبع الطلب."
              : "Your payment is confirmed and your code is being delivered automatically to your email and order tracking page."
            : ar
              ? "تم تأكيد دفعك بنجاح وأرسلنا إيصال التأكيد إلى بريدك الإلكتروني."
              : "Your payment has been confirmed and a receipt has been sent to your email."}
        </p>
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-xs font-mono text-[var(--muted-foreground)]">
          {orderRef} · ${billedUsd.toFixed(2)} USD
        </div>
        <a
          href={trackingFallbackHref}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-black text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          {ar ? "الانتقال إلى صفحة التتبع" : "Open order tracking"}
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-8 shadow-lg">
      {/* En-tête sécurisé */}
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)]">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-[var(--foreground)]">
              {ar ? "بوابة الدفع الآمن بالبطاقة" : "Secure Card Checkout"}
            </h1>
            <p className="text-xs text-[var(--muted-foreground)]">
              Visa · Mastercard · Apple Pay · Google Pay
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--accent)]/35 bg-[var(--accent)]/10 px-3 py-1.5 text-end" dir="ltr">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            USD
          </div>
          <div className="text-base font-black text-[var(--foreground)]">
            ${billedUsd.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Résumé commande */}
      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3.5 text-xs space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--muted-foreground)]">
            {ar ? "الطلب" : "Order"}
          </span>
          <span className="font-bold text-[var(--foreground)] truncate max-w-[68%]">
            {planName}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--muted-foreground)]">
            {ar ? "المرجع" : "Reference"}
          </span>
          <span className="font-mono font-semibold text-[var(--foreground)]" dir="ltr">
            {orderRef}
          </span>
        </div>
        {maskedEmail && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--muted-foreground)]">
              {ar ? "البريد الإلكتروني" : "Email"}
            </span>
            <span className="font-mono text-[var(--foreground)]" dir="ltr">
              {maskedEmail}
            </span>
          </div>
        )}
      </div>

      {/* Alerte si un processeur spécifique n'a pas répondu */}
      {errorCode === "provider_unavailable" && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-400/50 bg-amber-500/10 p-3.5 text-xs leading-5 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {ar
              ? `المزوّد المختار (${triedProvider || "التلقائي"}) غير متاح حالياً لبلدك أو لهذا المبلغ. اختر مزوّد بطاقة آخر من القائمة أدناه بنقرة واحدة.`
              : `The selected processor (${triedProvider || "auto"}) is temporarily unavailable for your region or amount. Pick another licensed card processor below in one click.`}
          </div>
        </div>
      )}

      {/* Sélection de processeur */}
      {!forcedProvider && eligibleProviders.length > 1 && (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-[var(--foreground)]">
              {ar ? "مزوّد الدفع المعتمد" : "Licensed payment processor"}
            </span>
            <button
              type="button"
              onClick={() => setShowAllProviders((v) => !v)}
              className="text-[11px] font-semibold text-[var(--accent)] hover:underline cursor-pointer"
            >
              {showAllProviders
                ? ar
                  ? "إخفاء البدائل"
                  : "Hide alternatives"
                : ar
                  ? `تغيير المزوّد (${eligibleProviders.length})`
                  : `Switch processor (${eligibleProviders.length})`}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {(showAllProviders ? eligibleProviders : eligibleProviders.slice(0, 4)).map(
              (provider, idx) => {
                const active = selectedProvider === provider.id;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => setSelectedProvider(provider.id)}
                    className={`flex flex-col items-start rounded-xl border p-3 text-start transition-colors cursor-pointer ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)]/12"
                        : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)]/50"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-1.5">
                      <span className="text-xs font-black text-[var(--foreground)]">
                        {provider.name}
                      </span>
                      {idx === 0 && (
                        <span className="rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                          {ar ? "موصى به" : "Recommended"}
                        </span>
                      )}
                    </div>
                    <span className="mt-1 text-[10.5px] text-[var(--muted-foreground)]" dir="ltr">
                      {ar ? provider.methodsLabelAr : provider.methodsLabelEn}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </div>
      )}

      {/* Bouton principal -> redirection serveur directe vers le processeur agréé */}
      <a
        href={goHref(selectedProvider)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-black text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-hover)]"
      >
        <Lock className="h-4 w-4" />
        {ar
          ? `المتابعة للدفع الآمن · $${billedUsd.toFixed(2)}`
          : `Continue to secure card payment · $${billedUsd.toFixed(2)}`}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>

      {/* Attente temps réel */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--muted-foreground)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
        <span>
          {ar
            ? "هذه الصفحة تتحدث تلقائياً فور إتمام الدفع…"
            : "This page updates automatically as soon as your payment completes…"}
        </span>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-[11px] leading-5 text-[var(--muted-foreground)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
        <span>
          {ar
            ? "اتصال مباشر ومشفّر بمزوّد البطاقات المعتمد دون أي وسيط محجوب. إذا رُفضت بطاقتك لدى مزوّد معيّن، ارجع إلى هذه التبويبة واختر مزوّداً آخر بنقرة واحدة."
            : "Direct encrypted connection to the licensed card processor — no blocked intermediary domain. If your bank declines one processor, simply pick another one above."}
        </span>
      </div>
    </div>
  );
}
