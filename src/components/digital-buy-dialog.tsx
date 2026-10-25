"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, Minus, Plus, ShieldCheck, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Price } from "@/components/price";
import { regionLabel, type DigitalProduct } from "@/lib/digital-types";
import { RegionalAlert } from "@/components/regional-alert";

const MAX_QUANTITY = 10;

/** Mémorise la dernière commande du visiteur pour préremplir le suivi. */
export const DIGITAL_LAST_ORDER_KEY = "nukhba:digital-order";

interface Props {
  product: DigitalProduct;
  denominationId: string;
  onClose: () => void;
}

/**
 * Dialogue d'achat d'un code : montant, quantité, e-mail de livraison.
 *
 * Le prix affiché vient du catalogue, mais c'est le SERVEUR qui recalcule
 * le total facturé (aucun montant n'est envoyé par le navigateur).
 */
export function DigitalBuyDialog({ product, denominationId, onClose }: Props) {
  const { locale } = useI18n();
  const ar = locale === "ar";

  const available = useMemo(
    () => product.denominations.filter((item) => item.available),
    [product.denominations],
  );

  const [selectedId, setSelectedId] = useState(
    available.some((item) => item.id === denominationId)
      ? denominationId
      : available[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selected = available.find((item) => item.id === selectedId) ?? available[0] ?? null;
  const total = (selected?.priceUsd ?? 0) * quantity;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    setError("");
    if (!selected) {
      setError(ar ? "اختر المبلغ أولاً." : "Choose an amount first.");
      return;
    }
    if (!email.trim()) {
      setError(ar ? "أدخل بريدك الإلكتروني لاستلام الكود." : "Enter your e-mail to receive the code.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/digital/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSlug: product.slug,
          denominationId: selected.id,
          quantity,
          email: email.trim(),
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          locale: locale === "en" ? "en" : "ar",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        paymentUrl?: string;
        orderRef?: string;
        trackingToken?: string;
        message?: string;
        totalUsd?: number;
      };

      if (!res.ok || !data.ok || !data.paymentUrl) {
        setError(data.message || (ar ? "تعذر إنشاء الطلب. حاول مرة أخرى." : "Could not create the order. Please retry."));
        setBusy(false);
        return;
      }

      try {
        window.localStorage.setItem(
          DIGITAL_LAST_ORDER_KEY,
          JSON.stringify({
            ref: data.orderRef,
            token: data.trackingToken,
            title: ar ? product.titleAr : product.titleEn,
            at: Date.now(),
          }),
        );
      } catch {
        // Stockage local indisponible : le lien de retour suffit.
      }

      window.location.href = data.paymentUrl;
    } catch {
      setError(ar ? "اتصال الشبكة تعطّل." : "Network error.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={ar ? "شراء الكود" : "Buy code"}
    >
      <div className="w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[var(--card)] p-5 shadow-2xl sm:rounded-2xl sm:p-6 max-h-[92vh]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--accent)]">
              {ar ? "شراء فوري" : "Buy now"}
            </div>
            <h2 className="mt-1 truncate text-[17px] font-black" dir="auto">
              {ar ? product.titleAr : product.titleEn}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={ar ? "إغلاق" : "Close"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Carte régionale : dernier rappel AVANT le paiement — c'est ici
            qu'il compte, pas en haut de la fiche. Les régions viennent des
            montants réellement proposés à la vente. */}
        <RegionalAlert
          regions={available.flatMap((item) => [item.region])}
          className="mt-4"
        />

        {/* Montants */}
        <div className="mt-4">
          <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-[var(--muted-foreground)]">
            {ar ? "المبلغ" : "Amount"}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {available.map((item) => {
              const active = item.id === selected?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`rounded-xl border px-3 py-2.5 text-start transition-colors ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:border-[var(--accent)]/60"
                  }`}
                >
                  <span className="block text-[13.5px] font-black" dir="ltr">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--muted-foreground)]">
                    {regionLabel(item.region, locale)} ·{" "}
                    <Price usd={item.priceUsd} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quantité + total */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 px-4 py-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wide text-[var(--muted-foreground)]">
              {ar ? "الكمية" : "Quantity"}
            </div>
            <div className="text-[15px] font-black" dir="ltr">
              <Price usd={total} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              disabled={quantity <= 1}
              aria-label={ar ? "إنقاص" : "Decrease"}
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-[15px] font-black tabular-nums">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(MAX_QUANTITY, value + 1))}
              disabled={quantity >= MAX_QUANTITY}
              aria-label={ar ? "زيادة" : "Increase"}
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Coordonnées */}
        <div className="mt-4 space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
              {ar ? "البريد الإلكتروني لاستلام الكود *" : "E-mail to receive the code *"}
            </span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              dir="ltr"
            />
          </label>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                {ar ? "الاسم (اختياري)" : "Name (optional)"}
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                {ar ? "الهاتف (اختياري)" : "Phone (optional)"}
              </span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+218…"
                autoComplete="tel"
                className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                dir="ltr"
              />
            </label>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-300/60 bg-red-50 px-3 py-2 text-[12.5px] leading-5 text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy || !selected}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-black text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {busy
            ? ar
              ? "جارٍ إنشاء الطلب…"
              : "Creating the order…"
            : ar
              ? `الدفع الآن · ${total.toFixed(2)} $`
              : `Pay now · $${total.toFixed(2)}`}
        </button>

        <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-[var(--muted-foreground)]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          {ar
            ? "الدفع بالعملات الرقمية (USDT وغيرها) عبر صفحة دفع آمنة. يُسلَّم الكود إلى بريدك الإلكتروني بعد تأكيد الدفع — عادةً في أقل من 5 دقائق."
            : "Crypto payment (USDT and others) on a secure hosted page. Your code is e-mailed right after payment confirmation — usually under 5 minutes."}
        </p>
      </div>
    </div>
  );
}
