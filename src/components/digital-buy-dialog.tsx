"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Loader2, Lock, Minus, Plus, ShieldCheck, Smartphone, X, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { Price } from "@/components/price";
import {
  MIN_CRYPTO_INVOICE_USD,
  denominationLabel,
  regionLabel,
  type DigitalProduct,
} from "@/lib/digital-types";
import { RegionalAlert } from "@/components/regional-alert";
import { recommendedNetworksLabel } from "@/lib/payment-networks";
import { MAX_DIGITAL_ORDER_USD } from "@/lib/digital-sales-policy";
import { playerIdGate } from "@/lib/fazercards-player-id-core";
import type { PhoneCardLydQuote } from "@/lib/phone-card-pricing-core";
import { PHONE_CARD_DISABLED_ERROR, phoneCardUnavailableNotice } from "@/lib/phone-card-core";

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
  const siteConfig = useSiteConfig();
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
  const [phoneCardDisabled, setPhoneCardDisabled] = useState(false);
  const phoneCardEnabled = siteConfig.fazercards?.phoneCardPaymentsEnabled !== false && !phoneCardDisabled;
  const [selectedPaymentMethod, setPaymentMethod] = useState<"nowpayments" | "phone_card">("nowpayments");
  // Si l'admin coupe le flux pendant qu'un dialogue est ouvert, la sélection
  // retombe sur crypto sans conserver un formulaire de carte actif.
  const paymentMethod = phoneCardEnabled ? selectedPaymentMethod : "nowpayments";
  const [cardOperator, setCardOperator] = useState<"libyana" | "al_madar">("libyana");
  const [cardCode, setCardCode] = useState("");
  const [cardValueLyd, setCardValueLyd] = useState("");
  const [phoneQuoteResult, setPhoneQuoteResult] = useState<{
    amount: number;
    quote?: PhoneCardLydQuote;
    error?: "unavailable" | "network";
  } | null>(null);
  const [acceptedPhoneQuoteKey, setAcceptedPhoneQuoteKey] = useState("");
  const [phoneQuoteRefresh, setPhoneQuoteRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Champs acheteur exigés par le fournisseur (top-ups : identifiant de
  // joueur, serveur…). Sans eux la recharge est refusée APRÈS paiement.
  const [buyerFields, setBuyerFields] = useState<Record<string, string>>({});
  /**
   * Vérification de l'identifiant joueur chez le fournisseur.
   *
   * Un identifiant venu d'un AUTRE jeu est accepté par le formulaire mais
   * crédite un inconnu — une recharge livrée est irréversible. Quand le
   * fournisseur sait vérifier le jeu, on affiche le pseudo du compte pour que
   * le client confirme, et on bloque l'envoi si l'identifiant n'existe pas.
   */
  const [idCheck, setIdCheck] = useState<{
    state: "idle" | "checking" | "ok" | "invalid" | "unverifiable";
    playerName?: string;
    reason?: string;
  }>({ state: "idle" });
  /**
   * Certification explicite de l'identifiant, demandée quand le fournisseur
   * ne sait pas vérifier le jeu. Sans elle, la caisse refuse la commande :
   * vérifier l'identifiant « quand c'est possible » ne suffisait pas — un
   * identifiant bidon ouvrait la page de paiement sur ces jeux.
   */
  const [idConfirmed, setIdConfirmed] = useState(false);

  const selected = available.find((item) => item.id === selectedId) ?? available[0] ?? null;
  const total = (selected?.priceUsd ?? 0) * quantity;
  const phoneQuoteAmount = Math.round(total * 100) / 100;
  const currentPhoneQuoteResult = phoneQuoteResult?.amount === phoneQuoteAmount ? phoneQuoteResult : null;
  const phoneQuote = currentPhoneQuoteResult?.quote ?? null;
  const phoneQuoteError = currentPhoneQuoteResult?.error ?? null;
  const phoneQuotePending =
    paymentMethod === "phone_card" && !phoneQuote && !phoneQuoteError;
  const phoneQuoteKey = phoneQuote
    ? [
        phoneQuote.amountUsdt.toFixed(2),
        phoneQuote.rateLyd.toFixed(4),
        phoneQuote.totalLyd.toFixed(2),
        phoneQuote.source,
        phoneQuote.rateUpdatedAt ?? "",
      ].join(":")
    : "";
  const phoneQuoteAccepted = Boolean(phoneQuoteKey) && acceptedPhoneQuoteKey === phoneQuoteKey;
  const requiredFields = selected?.fields ?? [];
  const maxQuantity = Math.max(1, Math.min(MAX_QUANTITY, selected?.maxQuantity ?? MAX_QUANTITY));
  const isFazercards = product.supplier === "fazercards";
  // Facture crypto minimale : pour un article à 0,81 $, il faut au moins
  // deux unités — sinon la passerelle refuse la facture après le clic.
  const minQuantity =
    isFazercards && selected && selected.priceUsd > 0
      ? Math.max(1, Math.ceil(MIN_CRYPTO_INVOICE_USD / selected.priceUsd))
      : 1;
  const belowMinimum =
    paymentMethod === "nowpayments" &&
    isFazercards &&
    selected != null &&
    total < MIN_CRYPTO_INVOICE_USD;
  const effectiveMinQuantity = paymentMethod === "phone_card" ? 1 : minQuantity;
  // Plafond d'achat automatique : au-delà, la commande basculerait en
  // livraison manuelle après paiement. Le navigateur reflète la règle
  // serveur (modifiable dans /admin/settings) pour éviter d'encaisser pour rien.
  const configuredFazercardsMax = Number(siteConfig.fazercards?.maxOrderUsd);
  const maxOrderLimitUsd = isFazercards
    ? Number.isFinite(configuredFazercardsMax) && configuredFazercardsMax > 0
      ? configuredFazercardsMax
      : 25
    : MAX_DIGITAL_ORDER_USD;
  const aboveLimit =
    selected != null && Math.round(total * 100) / 100 > maxOrderLimitUsd;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Le navigateur demande un devis indicatif ; le checkout le recalculera et
  // vérifiera que le client a accepté exactement la même version du taux.
  useEffect(() => {
    if (!isFazercards || paymentMethod !== "phone_card" || phoneQuoteAmount <= 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/fazercards/phone-card-quote?amount=${phoneQuoteAmount.toFixed(2)}`,
          { cache: "no-store" },
        );
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          quote?: PhoneCardLydQuote;
          error?: string;
        };
        if (cancelled) return;
        if (data.error === PHONE_CARD_DISABLED_ERROR) setPhoneCardDisabled(true);
        if (!response.ok || !data.ok || !data.quote) {
          setPhoneQuoteResult({ amount: phoneQuoteAmount, error: "unavailable" });
        } else {
          setPhoneQuoteResult({ amount: phoneQuoteAmount, quote: data.quote });
        }
      } catch {
        if (!cancelled) setPhoneQuoteResult({ amount: phoneQuoteAmount, error: "network" });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isFazercards, paymentMethod, phoneQuoteAmount, phoneQuoteRefresh]);

  const idFieldsKey = JSON.stringify(buyerFields);
  const allIdFieldsFilled =
    requiredFields.length > 0 &&
    requiredFields.every((field) => (buyerFields[field.key] ?? "").trim() !== "");

  /**
   * Faut-il passer par le contrôle d'identifiant avant de facturer ?
   * Uniquement pour une recharge FazerCards dont les champs sont remplis.
   */
  const requiresIdCheck =
    isFazercards && product.kind === "game_topup" && requiredFields.length > 0;

  /**
   * Issue du contrôle, décidée par la MÊME règle que la caisse serveur :
   *  - `allow` : vérifié, ou certifié par le client sur un jeu non vérifiable ;
   *  - `block` : identifiant inexistant chez le fournisseur ;
   *  - `require_confirmation` : jeu non vérifiable → case à cocher obligatoire ;
   *  - `pending` : contrôle en cours (ou pas encore lancé) → on n'envoie rien.
   */
  const idGate: "allow" | "block" | "require_confirmation" | "pending" = !requiresIdCheck
    ? "allow"
    : idCheck.state === "ok"
      ? "allow"
      : idCheck.state === "invalid"
        ? "block"
        : idCheck.state === "unverifiable"
          ? playerIdGate({ checked: false, valid: false, confirmed: idConfirmed })
          : "pending";

  // `setState` est appelé DANS le callback asynchrone (jamais en synchrone
  // dans l'effet) : sinon React boucle et le lint le refuse.
  useEffect(() => {
    if (!isFazercards || product.kind !== "game_topup" || !selected) return;
    if (!allIdFieldsFilled) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIdCheck({ state: "checking" });
      try {
        const res = await fetch("/api/fazercards/validate-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productSlug: product.slug,
            fields: Object.fromEntries(
              Object.entries(buyerFields).map(([key, value]) => [key, value.trim()]),
            ),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          checked?: boolean;
          valid?: boolean;
          playerName?: string;
          reason?: string;
        };
        if (cancelled) return;
        if (!data.checked) {
          // Jeu non vérifiable : la vente reste possible, mais elle exige une
          // certification explicite du client (voir `idGate`).
          setIdCheck({
            state: "unverifiable",
            ...(data.reason ? { reason: data.reason } : {}),
          });
        } else if (data.valid) {
          setIdCheck({
            state: "ok",
            ...(data.playerName ? { playerName: data.playerName } : {}),
          });
        } else {
          setIdCheck({ state: "invalid" });
        }
      } catch {
        if (!cancelled) setIdCheck({ state: "unverifiable" });
      }
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `idFieldsKey` couvre le contenu des champs sans dépendre de la référence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFieldsKey, allIdFieldsFilled, selected?.id, product.slug, product.kind, isFazercards]);

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
    if (paymentMethod === "phone_card") {
      const normalizedCode = cardCode.replace(/[\s-]/g, "");
      if (!phone.trim()) {
        setError(ar ? "أدخل رقم هاتفك لنتمكن من التواصل معك بعد التحقق." : "Enter your phone number so we can contact you after verification.");
        return;
      }
      if (!/^\d{6,32}$/.test(normalizedCode)) {
        setError(ar ? "أدخل رمز بطاقة الهاتف: من 6 إلى 32 رقماً." : "Enter the phone card code: 6 to 32 digits.");
        return;
      }
      if (!Number.isFinite(Number(cardValueLyd.replace(",", "."))) || Number(cardValueLyd.replace(",", ".")) <= 0) {
        setError(ar ? "أدخل قيمة بطاقة الهاتف بالدينار الليبي." : "Enter the phone card value in LYD.");
        return;
      }
      if (!phoneQuote) {
        setError(
          ar
            ? "تعذر الحصول على سعر السوق الموازي الحالي. أعد المحاولة أو اختر الدفع بالعملات الرقمية."
            : "The current parallel-market rate is unavailable. Retry or choose crypto payment.",
        );
        return;
      }
      if (!phoneQuoteAccepted) {
        setError(
          ar
            ? "اقرأ طريقة احتساب السعر بالدينار ثم أكّد موافقتك في المربع قبل إرسال البطاقة."
            : "Read the LYD price calculation and tick the confirmation box before submitting your card.",
        );
        return;
      }
    }
    const missingField = requiredFields.find(
      (field) => !(buyerFields[field.key] ?? "").trim(),
    );
    if (idGate === "pending") {
      setError(
        ar
          ? "جارٍ التحقق من المعرّف — انتظر لحظة ثم أعد المحاولة."
          : "The player ID is still being checked — wait a moment, then retry.",
      );
      return;
    }
    if (idGate === "block") {
      setError(
        ar
          ? "معرّف اللاعب غير موجود عند المزوّد. تحقق من أنه معرّف حسابك في هذه اللعبة (وليس لعبة أخرى)."
          : "This player ID does not exist at the supplier. Check that it is your account in THIS game — not another one.",
      );
      return;
    }
    if (idGate === "require_confirmation") {
      setError(
        ar
          ? "لا يمكننا التحقق من هذا المعرّف تلقائياً. أكّد في المربع أن هذا المعرّف هو حسابك في هذه اللعبة — الشحن نهائي."
          : "We cannot verify this ID automatically. Tick the box confirming it is your account in THIS game — a top-up cannot be undone.",
      );
      return;
    }
    if (missingField) {
      setError(
        ar
          ? `أدخل « ${missingField.label || missingField.key} » لإتمام الشحن.`
          : `Enter "${missingField.label || missingField.key}" to complete this order.`,
      );
      return;
    }

    setBusy(true);
    try {
      // Chaque fournisseur a sa caisse : les produits FazerCards (catalogue
      // live) passent par /api/fazercards/checkout, les fiches historiques
      // par /api/digital/checkout. Le serveur recalcule le prix dans les deux cas.
      const res = await fetch(
        isFazercards ? "/api/fazercards/checkout" : "/api/digital/checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Les deux routes acceptent `productSlug`/`productId` : on envoie
            // `product.id` (toujours préfixé `fzr-`) pour FazerCards afin que
            // la livraison auto fonctionne même si le slug public a été personnalisé.
            productSlug: product.slug,
            productId:
              isFazercards && product.id.startsWith("fzr-")
                ? product.id
                : product.slug,
            denominationId: selected.id,
            quantity,
            email: email.trim(),
            name: name.trim() || undefined,
            phone: phone.trim() || undefined,
            locale: locale === "en" ? "en" : "ar",
            ...(isFazercards && Object.keys(buyerFields).length > 0
              ? { fields: buyerFields }
              : {}),
            // Certification explicite : le serveur la REFUSE absente quand le
            // fournisseur ne sait pas vérifier le jeu.
            ...(isFazercards ? { idConfirmed } : {}),
            paymentMethod: isFazercards ? paymentMethod : "nowpayments",
            ...(isFazercards && paymentMethod === "phone_card"
              ? {
                  phoneCard: {
                    operator: cardOperator,
                    code: cardCode.replace(/[\s-]/g, ""),
                    valueLyd: cardValueLyd.trim(),
                    quoteAccepted: phoneQuoteAccepted,
                    quote: phoneQuote,
                  },
                }
              : {}),
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        paymentUrl?: string;
        orderRef?: string;
        trackingToken?: string;
        message?: string;
        error?: string;
        totalUsd?: number;
      };

      if (!res.ok || !data.ok || !data.paymentUrl) {
        if (data.error === PHONE_CARD_DISABLED_ERROR) {
          setPhoneCardDisabled(true);
          setCardCode("");
          setAcceptedPhoneQuoteKey("");
          setPhoneQuoteResult(null);
        }
        setError(data.error === PHONE_CARD_DISABLED_ERROR
          ? phoneCardUnavailableNotice(ar ? "ar" : "en")
          : data.message || (ar ? "تعذر إنشاء الطلب. حاول مرة أخرى." : "Could not create the order. Please retry."));
        if (data.error === "phone_card_quote_changed" || data.error === "phone_card_rate_unavailable") {
          // Ne laisse pas l'utilisateur renvoyer indéfiniment l'ancien devis :
          // le nouveau taux est chargé et sa case d'accord est réinitialisée.
          setPhoneQuoteResult(null);
          setAcceptedPhoneQuoteKey("");
          setPhoneQuoteRefresh((value) => value + 1);
        }
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
                  onClick={() => {
                    setSelectedId(item.id);
                    // Pré-remplit la quantité minimale facturable.
                    const unit = item.priceUsd > 0 ? item.priceUsd : 0;
                    const needed =
                      isFazercards && paymentMethod === "nowpayments" && unit > 0
                        ? Math.max(1, Math.ceil(MIN_CRYPTO_INVOICE_USD / unit))
                        : 1;
                    setQuantity(Math.min(needed, MAX_QUANTITY));
                    setBuyerFields({});
                    setIdConfirmed(false);
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-start transition-colors ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:border-[var(--accent)]/60"
                  }`}
                >
                  <span className="block text-[13.5px] font-black" dir="ltr">
                    {denominationLabel(item, locale)}
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
              onClick={() => setQuantity((value) => Math.max(effectiveMinQuantity, value - 1))}
              disabled={quantity <= effectiveMinQuantity}
              aria-label={ar ? "إنقاص" : "Decrease"}
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-[15px] font-black tabular-nums">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
              disabled={quantity >= maxQuantity}
              aria-label={ar ? "زيادة" : "Increase"}
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Moyen de paiement : la carte téléphonique reste une revue humaine,
            jamais une confirmation automatique du crédit. */}
        {isFazercards && (
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-[var(--muted-foreground)]">
              {ar ? "طريقة الدفع" : "Payment method"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("nowpayments");
                  setQuantity((value) => Math.max(minQuantity, value));
                  setError("");
                }}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-black ${
                  paymentMethod === "nowpayments"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] hover:border-[var(--accent)]/60"
                }`}
              >
                <CreditCard className="h-4 w-4" />
                {ar ? "عملات رقمية" : "Crypto"}
              </button>
              <button
                type="button"
                disabled={!phoneCardEnabled}
                aria-describedby={!phoneCardEnabled ? "phone-card-paused-notice" : undefined}
                onClick={() => {
                  setPaymentMethod("phone_card");
                  setError("");
                }}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-black disabled:cursor-not-allowed disabled:opacity-50 ${
                  paymentMethod === "phone_card"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] hover:border-[var(--accent)]/60"
                }`}
              >
                <Smartphone className="h-4 w-4" />
                {ar ? "بطاقة / رصيد هاتف" : "Phone card / balance"}
              </button>
            </div>
            {!phoneCardEnabled && (
              <p id="phone-card-paused-notice" role="status" className="mt-2 rounded-xl border border-amber-300/60 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-5 text-[var(--foreground)]">
                <strong className="block">{ar ? "الدفع اليدوي متوقف مؤقتاً" : "Manual payments temporarily paused"}</strong>
                {phoneCardUnavailableNotice(ar ? "ar" : "en")}
              </p>
            )}
          </div>
        )}

        {isFazercards && paymentMethod === "phone_card" && (
          <div className="mt-3 space-y-3 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3.5">
            <div>
              <p className="text-[12.5px] font-black">
                {ar ? "الدفع ببطاقة تعبئة الهاتف" : "Pay with a phone recharge card"}
              </p>
              <p className="mt-1 text-[11.5px] leading-5 text-[var(--muted-foreground)]">
                {ar
                  ? "أدخل الرمز مرة واحدة فقط. سنتحقق من البطاقة يدوياً قبل تجهيز بطاقة الهدية؛ إرسال الرمز لا يعني قبول الدفع."
                  : "Submit the code once only. We will verify the card manually before preparing your gift card; submitting it does not mean payment is accepted."}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
              <div className="text-[10.5px] font-black uppercase tracking-wide text-[var(--muted-foreground)]">
                {ar ? "السعر التقديري بالدينار الليبي" : "Indicative price in LYD"}
              </div>
              {phoneQuotePending && (
                <p className="mt-2 flex items-center gap-2 text-[11.5px] text-[var(--muted-foreground)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {ar ? "جارٍ جلب سعر السوق الموازي…" : "Fetching the parallel-market rate…"}
                </p>
              )}
              {phoneQuoteError && (
                <p className="mt-2 text-[11.5px] leading-5 text-amber-700">
                  {phoneQuoteError === "network"
                    ? ar
                      ? "تعذر الاتصال بخدمة السعر. تحقق من الشبكة؛ لن نخترع سعراً بديلاً."
                      : "Could not reach the rate service. Check your connection; we will not invent a fallback price."
                    : ar
                      ? "السعر غير متاح حالياً. أعد المحاولة لاحقاً أو اختر العملات الرقمية؛ لن يتم استخدام السعر الرسمي تلقائياً."
                      : "The rate is currently unavailable. Retry later or choose crypto; the official bank rate is never substituted automatically."}
                </p>
              )}
              {phoneQuote && (
                <>
                  <p className="mt-1.5 text-[14px] font-black text-[var(--foreground)]" dir="ltr">
                    {phoneQuote.amountUsdt.toFixed(2)} USDT × {phoneQuote.rateLyd.toFixed(4)} LYD × 120% = {phoneQuote.totalLyd.toFixed(2)} LYD
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-[var(--muted-foreground)]">
                    {ar
                      ? "يشمل الحساب 20% لتعويض نقص قيمة بطاقات الهاتف عند إعادة بيعها. هذا تقدير للمعلومة وليس سعر صرف رسمياً."
                      : "The calculation includes 20% to offset the loss of value when reselling phone cards. This is indicative information, not an official exchange rate."}
                  </p>
                  <p className="mt-1 text-[10.5px] leading-4 text-[var(--muted-foreground)]">
                    {phoneQuote.source === "fulus"
                      ? ar ? "المصدر: Fulus · السوق الموازي" : "Source: Fulus · parallel market"
                      : phoneQuote.source === "community"
                        ? ar
                          ? "المصدر: معدل وسيط من منشورات Telegram العامة · سعر نقدي تقريبي"
                          : "Source: median of public Telegram posts · indicative cash rate"
                        : ar ? "المصدر: سعر يدوي من الإدارة" : "Source: manual rate set by staff"}
                    {" · "}
                    {new Date(phoneQuote.rateUpdatedAt ?? phoneQuote.fetchedAt).toLocaleString(
                      ar ? "ar-LY" : "en-GB",
                      { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Tripoli" },
                    )}
                  </p>
                  {phoneQuote.source === "community" && (phoneQuote.references?.length ?? 0) > 0 && (
                    <details className="mt-1.5 rounded-md border border-[var(--border)] px-2 py-1.5 text-[10.5px] leading-4">
                      <summary className="cursor-pointer font-bold">
                        {ar
                          ? `المنشورات المستخدمة في المعدل الوسيط (${phoneQuote.references?.length ?? 0})`
                          : `Posts used for the median (${phoneQuote.references?.length ?? 0})`}
                      </summary>
                      <ul className="mt-1.5 space-y-1 border-t border-[var(--border)] pt-1.5">
                        {phoneQuote.references?.map((reference) => (
                          <li key={reference.url} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <a
                              href={reference.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="font-bold underline underline-offset-2"
                              dir="ltr"
                            >
                              {reference.label}
                            </a>
                            <span dir="ltr">{reference.rateLyd.toFixed(4)} LYD</span>
                            <span className="text-[var(--muted-foreground)]">
                              {new Date(reference.rateUpdatedAt).toLocaleString(
                                ar ? "ar-LY" : "en-GB",
                                { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Tripoli" },
                              )}
                              {reference.views != null
                                ? ` · ${new Intl.NumberFormat(ar ? "ar-LY" : "en-GB", { notation: "compact" }).format(reference.views)} ${ar ? "مشاهدة" : "views"}`
                                : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {phoneQuote.stale && (
                    <p className="mt-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[10.5px] leading-4 text-amber-700">
                      {ar
                        ? "تنبيه: هذا آخر سعر تلقائي معروف لأن التحديث تعذر. أنت توافق على هذا السعر تحديداً."
                        : "Warning: this is the last known automatic rate because refreshing failed. You are agreeing to this specific rate."}
                    </p>
                  )}
                  <label className="mt-2 flex cursor-pointer items-start gap-2 border-t border-[var(--border)] pt-2 text-[11.5px] font-bold leading-5">
                    <input
                      type="checkbox"
                      checked={phoneQuoteAccepted}
                      onChange={(event) => setAcceptedPhoneQuoteKey(event.target.checked ? phoneQuoteKey : "")}
                      className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
                    />
                    <span>
                      {ar
                        ? `قرأت الحساب وأوافق على السعر التقديري ${phoneQuote.totalLyd.toFixed(2)} د.ل، مع بقاء قبول بطاقة الهاتف خاضعاً للتحقق اليدوي.`
                        : `I have read the calculation and agree to the indicative ${phoneQuote.totalLyd.toFixed(2)} LYD price; my phone card remains subject to manual verification.`}
                    </span>
                  </label>
                </>
              )}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                  {ar ? "المشغّل *" : "Operator *"}
                </span>
                <select
                  value={cardOperator}
                  onChange={(event) => setCardOperator(event.target.value as "libyana" | "al_madar")}
                  className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                >
                  <option value="libyana">Libyana</option>
                  <option value="al_madar">Al Madar</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                  {ar ? "قيمة البطاقة (د.ل) *" : "Card value (LYD) *"}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={cardValueLyd}
                  onChange={(event) => setCardValueLyd(event.target.value)}
                  placeholder="50"
                  className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  dir="ltr"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                {ar ? "رمز بطاقة التعبئة *" : "Recharge card code *"}
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                value={cardCode}
                onChange={(event) => setCardCode(event.target.value)}
                placeholder="0000 0000 0000 0000"
                maxLength={64}
                className="h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 font-mono text-[15px] tracking-wide outline-none focus:border-[var(--accent)]"
                dir="ltr"
              />
            </label>
            <p className="flex items-start gap-2 text-[11px] leading-5 text-[var(--muted-foreground)]">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
              {ar
                ? "يُحفظ الرمز مشفّراً ولا يظهر إلا للإدارة. لا تستخدم بطاقة مستعملة ولا ترسل الرمز عبر واتساب بعد إرسال الطلب."
                : "The code is encrypted and only visible to authorised staff. Do not use an already redeemed card or send the code on WhatsApp after ordering."}
            </p>
          </div>
        )}

        {/* Champs exigés par le fournisseur (recharge de jeu) */}
        {requiredFields.length > 0 && (
          <div className="mt-4 space-y-2.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-[var(--accent)]">
              {ar ? "بيانات الحساب المطلوبة للشحن" : "Account details required for this top-up"}
            </p>
            {requiredFields.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                  {field.label || field.key} *
                </span>
                <input
                  value={buyerFields[field.key] ?? ""}
                  onChange={(event) => {
                    // Toute modification de l'identifiant annule la
                    // certification précédente : elle portait sur une autre
                    // valeur.
                    setIdConfirmed(false);
                    setBuyerFields((current) => ({ ...current, [field.key]: event.target.value }));
                  }}
                  inputMode={field.type === "number" ? "numeric" : "text"}
                  placeholder={field.key}
                  className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  dir="ltr"
                />
              </label>
            ))}

            {/* Rappel explicite : c'est LA cause d'erreur constatée en
                production (identifiant d'un autre jeu collé dans ce champ). */}
            <p className="rounded-lg bg-[var(--secondary)]/60 px-2.5 py-2 text-[11px] leading-4 text-[var(--muted-foreground)]">
              {ar
                ? `تنبيه: هذا المعرّف يجب أن يكون حسابك في « ${product.platform} » تحديداً. الشحن يُطبَّق فوراً ولا يمكن التراجع عنه.`
                : `Careful: this ID must be your account in ${product.platform} specifically. A top-up is applied instantly and cannot be undone.`}
            </p>

            {idCheck.state === "checking" && (
              <p className="flex items-center gap-1.5 text-[11.5px] text-[var(--muted-foreground)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {ar ? "جارٍ التحقق من المعرّف…" : "Checking the ID…"}
              </p>
            )}
            {allIdFieldsFilled && idCheck.state === "ok" && (
              <p className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-2 text-[12px] font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {ar ? "الحساب:" : "Account:"}{" "}
                {idCheck.playerName || (ar ? "تم التحقق" : "verified")}
              </p>
            )}
            {allIdFieldsFilled && idCheck.state === "invalid" && (
              <p className="rounded-lg bg-red-500/10 px-2.5 py-2 text-[12px] font-bold text-red-700">
                {ar
                  ? "لم يتم العثور على هذا المعرّف في هذه اللعبة. تحقق منه قبل الدفع."
                  : "This ID was not found in this game. Check it before paying."}
              </p>
            )}
            {/* Jeu non vérifiable : la vente reste possible (sinon des jeux
                entiers deviendraient invendables), mais le client doit
                certifier explicitement l'identifiant. */}
            {allIdFieldsFilled && idCheck.state === "unverifiable" && (
              <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-2.5 py-2">
                <p className="text-[12px] font-bold leading-5 text-amber-900">
                  {ar
                    ? "لا يمكننا التحقق من هذا المعرّف تلقائياً لدى المزوّد."
                    : "We cannot verify this ID automatically with the supplier."}
                </p>
                {idCheck.reason && (
                  <p className="mt-0.5 text-[11px] leading-4 text-amber-800/80">
                    {idCheck.reason}
                  </p>
                )}
                <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11.5px] leading-4 text-amber-950">
                  <input
                    type="checkbox"
                    checked={idConfirmed}
                    onChange={(event) => setIdConfirmed(event.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
                  />
                  <span>
                    {ar
                      ? `أؤكد أن هذا المعرّف هو حسابي في « ${product.platform} » تحديداً، وأن الشحن نهائي ولا يمكن استرجاعه.`
                      : `I confirm this ID is my account in ${product.platform} specifically, and that a top-up cannot be reversed.`}
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

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
                {paymentMethod === "phone_card"
                  ? ar ? "الهاتف للتواصل *" : "Contact phone *"
                  : ar ? "الهاتف (اختياري)" : "Phone (optional)"}
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

        {aboveLimit && (
          <p className="mt-3 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-[12.5px] leading-5 text-amber-800">
            {ar
              ? `الحد الأقصى ${maxOrderLimitUsd} $ للطلب الواحد — قلّل الكمية أو تواصل معنا على واتساب.`
              : `Maximum ${maxOrderLimitUsd} $ per order — reduce the quantity or contact us on WhatsApp.`}
          </p>
        )}

        {belowMinimum && (
          <p className="mt-3 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-[12.5px] leading-5 text-amber-800">
            {ar
              ? `الحد الأدنى للدفع ${MIN_CRYPTO_INVOICE_USD.toFixed(2)} $ — اختر ${minQuantity} وحدات على الأقل.`
              : `Minimum order ${MIN_CRYPTO_INVOICE_USD.toFixed(2)} $ — choose at least ${minQuantity} units.`}
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-red-300/60 bg-red-50 px-3 py-2 text-[12.5px] leading-5 text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy || !selected || belowMinimum || aboveLimit || idGate === "pending" || (paymentMethod === "phone_card" && phoneQuotePending)}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-black text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {busy
            ? ar
              ? "جارٍ إنشاء الطلب…"
              : "Creating the order…"
            : paymentMethod === "phone_card"
              ? ar
                ? "إرسال البطاقة للتحقق"
                : "Submit card for verification"
              : ar
                ? `الدفع الآن · ${total.toFixed(2)} $`
                : `Pay now · $${total.toFixed(2)}`}
        </button>

        <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-[var(--muted-foreground)]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          {paymentMethod === "phone_card"
            ? ar
              ? "الطلب مجاني الإنشاء ولا يُعد مدفوعاً إلا بعد قبول الإدارة للبطاقة. بعدها يتم تسليم بطاقة الهدية يدوياً إلى بريدك وعلى صفحة التتبع."
              : "Submitting an order is free; it is only marked paid after staff accept the card. Your gift card is then delivered manually by email and on the tracking page."
            : ar
              ? "الدفع بالعملات الرقمية (USDT وغيرها) عبر صفحة دفع آمنة. يُسلَّم الكود إلى بريدك الإلكتروني بعد تأكيد الدفع — عادةً في أقل من 5 دقائق."
              : "Crypto payment (USDT and others) on a secure hosted page. Your code is e-mailed right after payment confirmation — usually under 5 minutes."}
        </p>

        {/* Frais de réseau : ils sont FIXES et peuvent dépasser la valeur
            d'un petit article. On oriente donc le client vers les chaînes
            à quelques centimes (liste blanche de `payment-networks.ts`). */}
        {paymentMethod === "nowpayments" && (
          <p className="mt-1.5 flex items-start gap-2 text-[11px] leading-5 text-[var(--muted-foreground)]">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
            {ar
              ? `لتفادي رسوم شبكة مرتفعة، استخدم: ${recommendedNetworksLabel()}`
              : `To avoid high network fees, pay on: ${recommendedNetworksLabel()}`}
          </p>
        )}
      </div>
    </div>
  );
}
