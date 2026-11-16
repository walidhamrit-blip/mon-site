"use client";

import { useState } from "react";

function formatValue(value: number | null, decimals?: number): string {
  if (value == null || !Number.isFinite(value)) return "";
  return decimals == null ? String(value) : value.toFixed(decimals);
}

/**
 * Champ décimal contrôlé sans perdre le point en cours de saisie.
 *
 * Un `<input type="number">` lié directement à un nombre arrondit ou efface
 * les valeurs intermédiaires (« 5. » devient « 5 »). Ce composant conserve le
 * texte saisi pendant le focus et ne normalise l’affichage qu’à la sortie.
 */
export function DecimalInput({
  value,
  onChange,
  decimals,
  disabled,
  placeholder,
  className,
  ariaLabel,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Nombre maximal de décimales et affichage normalisé à la sortie. */
  decimals?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? formatValue(value, decimals);

  const allowed = decimals == null
    ? /^\d*(\.\d*)?$/
    : new RegExp(`^\\d*(\\.\\d{0,${decimals}})?$`);

  return (
    <input
      type="text"
      inputMode="decimal"
      dir="ltr"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onFocus={() => setDraft(formatValue(value, decimals))}
      onChange={(event) => {
        const next = event.target.value.trim().replace(",", ".");
        if (!allowed.test(next)) return;
        setDraft(next);
        if (next === "" || next === ".") {
          onChange(null);
          return;
        }
        const parsed = Number(next);
        onChange(Number.isFinite(parsed) && parsed >= 0 ? parsed : null);
      }}
      onBlur={() => {
        // Les valeurs pendant la frappe sont déjà transmises à `onChange`
        // (ou réinitialisées à null pour ""/".") ; il suffit de rendre la main
        // à l’affichage formaté par `value`.
        setDraft(null);
      }}
      className={className}
    />
  );
}
