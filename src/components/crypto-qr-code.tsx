"use client";

import { useMemo, useState } from "react";
import QRCode from "qrcode";
import { Maximize2, Minimize2, QrCode } from "lucide-react";
import {
  MANUAL_PAYMENT_METHOD_LABELS,
  isDirectCryptoWalletMethod,
  type ManualPaymentMethod,
} from "@/lib/manual-payment-core";

function buildQrSvgData(text: string): { total: number; pathD: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const qr = QRCode.create(trimmed, { errorCorrectionLevel: "M" });
    const count = qr.modules.size;
    const data = qr.modules.data;
    const margin = 2;
    const total = count + margin * 2;
    const commands: string[] = [];
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (data[row * count + col]) {
          commands.push(`M${col + margin} ${row + margin}h1v1h-1z`);
        }
      }
    }
    return { total, pathD: commands.join("") };
  } catch {
    return null;
  }
}

/**
 * Affiche le QR code d'un moyen de paiement crypto :
 *  - si l'administrateur a importé un QR officiel (ex. Binance Pay / OKX / Bybit / RedotPay),
 *    affiche cette image ;
 *  - sinon, génère localement un QR SVG net à partir de l'adresse ou de l'identifiant,
 *    sans aucun appel réseau tiers.
 */
export function CryptoQrCode({
  method,
  value,
  customImageUrl,
  locale,
}: {
  method: ManualPaymentMethod;
  value: string;
  customImageUrl?: string;
  locale: "ar" | "en";
}) {
  const ar = locale === "ar";
  const [expanded, setExpanded] = useState(false);
  const customImage = customImageUrl?.trim() ?? "";
  const svgQr = useMemo(
    () => (customImage ? null : buildQrSvgData(value)),
    [customImage, value],
  );

  if (!customImage && !svgQr) return null;

  const isDirectWallet = isDirectCryptoWalletMethod(method);
  const label = MANUAL_PAYMENT_METHOD_LABELS[method];
  const sizePx = expanded ? 216 : 128;

  const helperText = isDirectWallet
    ? ar
      ? `امسح الرمز عبر محفظتك أو تطبيق التداول (${label})`
      : `Scan with your wallet or exchange app (${label})`
    : customImage
      ? ar
        ? `امسح رمز QR الرسمي داخل تطبيق ${label}`
        : `Scan this official QR code inside ${label}`
      : ar
        ? `امسح الرمز أو انسخ المعرّف في ${label}`
        : `Scan or copy the ID inside ${label}`;

  return (
    <div className="mt-2.5 flex flex-col items-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--background)]/70 p-3 text-center">
      <div className="flex w-full items-center justify-between gap-2 text-[10.5px] font-bold text-[var(--muted-foreground)]">
        <span className="inline-flex items-center gap-1">
          <QrCode className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
          {ar ? "الدفع عبر رمز QR" : "Scan to pay (QR)"}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-label={
            expanded
              ? ar
                ? "تصغير رمز QR"
                : "Shrink QR code"
              : ar
                ? "تكبير رمز QR"
                : "Enlarge QR code"
          }
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold hover:border-[var(--accent)]"
        >
          {expanded ? (
            <>
              <Minimize2 className="h-3 w-3" aria-hidden="true" />
              {ar ? "تصغير" : "Smaller"}
            </>
          ) : (
            <>
              <Maximize2 className="h-3 w-3" aria-hidden="true" />
              {ar ? "تكبير" : "Enlarge"}
            </>
          )}
        </button>
      </div>

      <div
        className="rounded-xl border border-stone-200 bg-white p-2 shadow-xs transition-[background-color,border-color,box-shadow]"
        style={{ width: sizePx + 18, height: sizePx + 18 }}
      >
        {customImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={customImage}
            alt={ar ? `رمز QR للدفع عبر ${label}` : `${label} payment QR code`}
            width={sizePx}
            height={sizePx}
            className="h-full w-full rounded-md object-contain"
          />
        ) : svgQr ? (
          <svg
            role="img"
            aria-label={ar ? `رمز QR لـ ${label}` : `QR code for ${label}`}
            viewBox={`0 0 ${svgQr.total} ${svgQr.total}`}
            width={sizePx}
            height={sizePx}
            shapeRendering="crispEdges"
            className="h-full w-full"
          >
            <rect width={svgQr.total} height={svgQr.total} fill="#ffffff" />
            <path d={svgQr.pathD} fill="#111111" />
          </svg>
        ) : null}
      </div>

      <p className="text-[11px] leading-4 text-[var(--muted-foreground)]">
        {helperText}
      </p>
    </div>
  );
}
