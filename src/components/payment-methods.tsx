"use client";

import { Apple } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const methods = ["visa", "mastercard", "apple-pay", "google-pay"] as const;

const cryptoAssets = [
  { ticker: "BTC", name: "Bitcoin", tone: "btc" },
  { ticker: "ETH", name: "Ethereum", tone: "eth" },
  { ticker: "USDT", name: "Tether", tone: "usdt" },
  { ticker: "USDC", name: "USD Coin", tone: "usdc" },
  { ticker: "BNB", name: "BNB", tone: "bnb" },
  { ticker: "SOL", name: "Solana", tone: "sol" },
  { ticker: "TON", name: "Toncoin", tone: "ton" },
  { ticker: "LTC", name: "Litecoin", tone: "ltc" },
  { ticker: "XRP", name: "XRP", tone: "xrp" },
] as const;

const manualMethodLabels: Record<string, string> = {
  skrill: "Skrill",
  neteller: "Neteller",
  airtm: "Airtm",
  d17: "D17",
  advcash: "Volet",
  webmoney: "WebMoney",
  kashy: "Kashy",
  binance_pay: "Binance Pay",
  okx_pay: "OKX Pay",
  bybit_pay: "Bybit Pay",
  redotpay: "RedotPay",
  usdt_bep20: "USDT · BEP-20",
  usdt_trc20: "USDT · TRC-20",
  usdt_ton: "USDT · TON",
  usdt_polygon: "USDT · Polygon",
  usdt_sol: "USDT · Solana",
};

/** Brand marks for the card and wallet options shown at checkout. */
export function PaymentBrandLogos({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      aria-label="Visa, Mastercard, Apple Pay, Google Pay"
      role="img"
    >
      {methods.map((method) => (
        <span key={method} className={`payment-brand payment-brand-${method}`}>
          {method === "visa" && <span className="payment-visa">VISA</span>}
          {method === "mastercard" && (
            <span className="payment-mastercard-mark" aria-hidden="true">
              <i />
              <i />
            </span>
          )}
          {method === "mastercard" && <span className="payment-mastercard-word">mastercard</span>}
          {method === "apple-pay" && (
            <>
              <Apple aria-hidden="true" className="h-[17px] w-[17px] fill-current stroke-[1.5]" />
              <span>Pay</span>
            </>
          )}
          {method === "google-pay" && (
            <>
              <span className="payment-google-g" aria-hidden="true">G</span>
              <span><span className="payment-google-word">Google</span> Pay</span>
            </>
          )}
        </span>
      ))}
    </div>
  );
}

/** Common crypto logos plus the original NOWPayments checkout provider. */
export function CryptoPaymentLogos() {
  return (
    <div className="flex flex-wrap items-center gap-2" role="img" aria-label="NOWPayments, Bitcoin, Ethereum, USDT, USDC and 300+ cryptocurrencies">
      <span className="payment-brand payment-brand-nowpayments">
        <span className="payment-now-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>NOWPayments</span>
      </span>
      {cryptoAssets.map((asset) => (
        <span key={asset.ticker} className="payment-brand payment-brand-coin" aria-label={asset.name}>
          <span className={`payment-coin payment-coin-${asset.tone}`} aria-hidden="true">{asset.ticker === "BTC" ? "₿" : asset.ticker === "ETH" ? "◆" : asset.ticker === "USDT" ? "₮" : asset.ticker.slice(0, 1)}</span>
          <span>{asset.ticker}</span>
        </span>
      ))}
      <span className="payment-brand payment-brand-many-crypto">300+ cryptos</span>
    </div>
  );
}

function ManualPaymentLogos({ methods }: { methods: string[] }) {
  const activeMethods = methods.filter((method) => manualMethodLabels[method]);
  if (activeMethods.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="img" aria-label={`Additional payment methods: ${activeMethods.map((method) => manualMethodLabels[method]).join(", ")}`}>
      {activeMethods.map((method) => (
        <span key={method} className="payment-brand payment-brand-manual">{manualMethodLabels[method]}</span>
      ))}
    </div>
  );
}

function PaymentRibbonContent({
  manualMethods,
  phoneCardEnabled,
}: {
  manualMethods: string[];
  phoneCardEnabled: boolean;
}) {
  return (
    <div className="payment-ribbon-content">
      <PaymentBrandLogos />
      <span className="payment-ribbon-separator" aria-hidden="true" />
      <CryptoPaymentLogos />
      {manualMethods.length > 0 && <span className="payment-ribbon-separator" aria-hidden="true" />}
      <ManualPaymentLogos methods={manualMethods} />
      {phoneCardEnabled && (
        <>
          <span className="payment-ribbon-separator" aria-hidden="true" />
          <div className="flex items-center gap-2" role="img" aria-label="Libyana and Al Madar phone recharge cards, digital store only">
            <span className="payment-brand payment-brand-manual">Libyana</span>
            <span className="payment-brand payment-brand-manual">Al Madar</span>
          </div>
        </>
      )}
    </div>
  );
}

/** Site-wide, accessible payment-method marquee; the duplicate makes the loop seamless. */
export function PaymentMethodsRibbon({
  manualMethods = [],
  phoneCardEnabled = false,
}: {
  manualMethods?: string[];
  phoneCardEnabled?: boolean;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const heading = ar ? "طرق الدفع المتاحة" : "Payment methods";

  return (
    <section className="payment-ribbon" aria-label={heading}>
      <div className="payment-ribbon-heading">
        <span className="payment-ribbon-dot" aria-hidden="true" />
        {heading}
      </div>
      <div className="payment-ribbon-window" aria-label={ar ? "البطاقات والمحافظ والعملات الرقمية ووسائل الدفع الإضافية" : "Cards, wallets, crypto and other payment methods"}>
        <div className="payment-ribbon-track">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="payment-ribbon-group"
              aria-hidden={copy === 1 ? "true" : undefined}
            >
              <PaymentRibbonContent manualMethods={manualMethods} phoneCardEnabled={phoneCardEnabled} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
