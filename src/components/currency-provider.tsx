"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BASE_CURRENCY,
  DEFAULT_DISPLAY_CURRENCY,
  convertFromBase,
  currencyRate,
  enabledCurrencies,
  formatMoney,
  formatMoneyCompact,
  normalizeCurrency,
  type CurrencyCode,
} from "@/lib/currency";

/**
 * Devise d'affichage choisie par le visiteur.
 *
 * - La devise de facturation reste le dollar : le sélecteur ne change que
 *   l'AFFICHAGE des prix, jamais le montant réellement encaissé.
 * - Le choix est mémorisé sur l'appareil du visiteur (clé `nukhba-currency`),
 *   comme la langue et le thème.
 * - Un taux absent ou invalide retombe sur 1 : on n'affiche jamais un prix
 *   converti faux.
 */

const CURRENCY_KEY = "nukhba-currency";

interface CurrencyContextValue {
  /** Devise d'affichage courante. */
  currency: CurrencyCode;
  /** Devises proposées dans le sélecteur. */
  currencies: CurrencyCode[];
  /** Change la devise d'affichage. */
  setCurrency: (code: string) => void;
  /** Convertit un montant USD vers la devise d'affichage. */
  convert: (amountUsd: number) => number;
  /** Formate un montant USD dans la devise d'affichage. */
  format: (amountUsd: number) => string;
  /** Formate un montant USD (version compacte, sans décimales au-delà de 100). */
  formatCompact: (amountUsd: number) => string;
  /** Taux effectifs (1 USD = X), exposés pour les tests d'identité USDT. */
  rates: Record<string, number>;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  rates,
  enabled,
  children,
}: {
  /** Taux de conversion depuis la devise de base (1 USD = X). */
  rates?: Record<string, number> | null;
  /** Devises proposées dans le sélecteur. */
  enabled?: string[] | null;
  children: ReactNode;
}) {
  const currencies = useMemo(
    () => enabledCurrencies({ enabled: enabled ?? undefined }),
    [enabled],
  );

  // Affichage par défaut : USDT (même valeur que le dollar, sans conversion).
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_DISPLAY_CURRENCY);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CURRENCY_KEY);
      if (!saved) return;
      const normalized = normalizeCurrency(saved);
      if (currencies.includes(normalized)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrencyState(normalized);
      }
    } catch {
      /* localStorage indisponible */
    }
  }, [currencies]);

  const value = useMemo<CurrencyContextValue>(() => {
    const setCurrency = (code: string) => {
      const normalized = normalizeCurrency(code);
      if (!currencies.includes(normalized)) return;
      setCurrencyState(normalized);
      try {
        localStorage.setItem(CURRENCY_KEY, normalized);
      } catch {
        /* localStorage indisponible */
      }
    };

    return {
      currency,
      currencies,
      setCurrency,
      rates: rates ?? {},
      convert: (amountUsd: number) =>
        convertFromBase(amountUsd, currency, rates ?? undefined),
      // Conversion PUIS formatage : afficher « €59.50 » pour 59,50 $ serait
      // un prix faux. USDT a un taux de 1, donc son affichage est identique.
      format: (amountUsd: number) =>
        formatMoney(convertFromBase(amountUsd, currency, rates ?? undefined), currency),
      formatCompact: (amountUsd: number) =>
        formatMoneyCompact(convertFromBase(amountUsd, currency, rates ?? undefined), currency),
    };
  }, [currency, currencies, rates]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Hors provider (ex. rendu serveur isolé) : on renvoie des valeurs
    // neutres en USD plutôt que de casser le rendu.
    return {
      currency: DEFAULT_DISPLAY_CURRENCY,
      currencies: [DEFAULT_DISPLAY_CURRENCY, BASE_CURRENCY],
      setCurrency: () => {},
      rates: {},
      convert: (amountUsd: number) => amountUsd,
      format: (amountUsd: number) => formatMoney(amountUsd, DEFAULT_DISPLAY_CURRENCY),
      formatCompact: (amountUsd: number) => formatMoneyCompact(amountUsd, DEFAULT_DISPLAY_CURRENCY),
    };
  }
  return ctx;
}

/** Taux effectif de la devise courante (utile pour les conversions manuelles). */
export function useCurrencyRate(): number {
  const { currency } = useCurrency();
  return currencyRate(currency);
}
