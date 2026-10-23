"use client";

import { useCurrency } from "@/components/currency-provider";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { resolveMarket } from "@/lib/market";
import { formatLyd } from "@/lib/classification";

/** Taux de la devise du marché par rapport au dollar (1 USD = X). */
function useMarketRate(): number {
  const siteConfig = useSiteConfig();
  const market = resolveMarket(siteConfig.market);
  const rates = siteConfig.currency?.rates as Record<string, number> | undefined;
  const rate = rates?.[market.currency];
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : 1;
}

/**
 * Affichage d'un prix dans la devise choisie par le visiteur.
 *
 * Les prix sont stockés en USD (devise de facturation) ; ce composant se
 * charge de la conversion et du formatage. Il est utilisable depuis un
 * composant serveur comme depuis un composant client : la conversion se
 * fait dans le navigateur, où la devise choisie est connue.
 *
 * `showLocal` affiche en plus l'équivalent dans la devise du marché (par
 * défaut le dinar libyen) — l'indication historique du site, utile au
 * client local ; elle disparaît si le visiteur a choisi cette devise-là.
 */
export function Price({
  usd,
  className = "",
  compact = false,
  showLocal = false,
}: {
  /** Montant en USD (devise de facturation). */
  usd: number;
  className?: string;
  /** Format compact : sans décimales au-delà de 100. */
  compact?: boolean;
  /** Affiche l'équivalent dans la devise du marché. */
  showLocal?: boolean;
}) {
  const { format, formatCompact, currency } = useCurrency();
  const { locale } = useI18n();
  const siteConfig = useSiteConfig();
  const market = resolveMarket(siteConfig.market);
  const marketRate = useMarketRate();
  const ar = locale === "ar";

  const isMarketCurrency = currency === market.currency.toUpperCase();
  const localLabel = ar ? market.currencyAr : market.currencyEn;

  return (
    <span className={className}>
      <span dir="ltr">{compact ? formatCompact(usd) : format(usd)}</span>
      {showLocal && !isMarketCurrency && (
        <span className="ms-1 opacity-60">
          {" · "}≈ {formatLyd(usd * marketRate)} {localLabel}
        </span>
      )}
    </span>
  );
}

/**
 * Équivalent d'un montant USD dans la devise du marché.
 *
 * Le taux utilisé est celui du marché (configurable dans /admin), pas celui
 * de la devise sélectionnée : c'est l'indication « pour les gens d'ici ».
 */
export function MarketPrice({
  usd,
  className = "",
}: {
  usd: number;
  className?: string;
}) {
  const { locale } = useI18n();
  const siteConfig = useSiteConfig();
  const market = resolveMarket(siteConfig.market);
  const marketRate = useMarketRate();
  const ar = locale === "ar";
  return (
    <span className={className} dir="ltr">
      {formatLyd(usd * marketRate)} {ar ? market.currencyAr : market.currencyEn}
    </span>
  );
}
