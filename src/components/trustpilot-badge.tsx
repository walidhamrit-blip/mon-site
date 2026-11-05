import type { SiteConfigData } from "@/lib/site-types";
import {
  shouldShowReviewWidget,
  trustpilotBusinessUnitId,
  trustpilotProfileUrl,
  trustpilotTemplateId,
} from "@/lib/trust";
import { getTrustpilotStats } from "@/lib/trustpilot-stats";
import { TrustpilotWidget } from "@/components/trustpilot-widget";

/**
 * Badge Trustpilot prêt à l'emploi (composant serveur).
 *
 * Regroupe la décision d'affichage, qui doit rester **la même partout** :
 *   1. compte Trustpilot configuré (`businessUnitId`) ;
 *   2. fiche publique connue ;
 *   3. assez d'avis (`widgetMinReviews`, 1 par défaut).
 *
 * Tant que ces conditions ne sont pas réunies, le composant ne rend **rien**
 * (pas de cadre vide, pas de « 0,0/5 »). Dès le premier avis publié, le widget
 * apparaît de lui-même sur les pages qui l'incluent.
 */

export interface TrustpilotBadgeProps {
  config: Pick<SiteConfigData, "trust">;
  locale: string;
  theme?: "light" | "dark";
  height?: string;
  className?: string;
}

export async function TrustpilotBadge({
  config,
  locale,
  theme = "light",
  height = "24px",
  className = "",
}: TrustpilotBadgeProps) {
  const businessUnitId = trustpilotBusinessUnitId(config.trust.businessUnitId);
  if (!businessUnitId) return null;

  const profileUrl = trustpilotProfileUrl(config.trust);
  if (!profileUrl) return null;

  const stats = await getTrustpilotStats(config.trust);
  const visible = shouldShowReviewWidget({
    reviewCount: stats.reviewCount,
    businessUnitId,
    minReviews: config.trust.widgetMinReviews,
  });
  if (!visible) return null;

  return (
    <TrustpilotWidget
      businessUnitId={businessUnitId}
      templateId={trustpilotTemplateId(config.trust.widgetTemplate)}
      profileUrl={profileUrl}
      locale={locale}
      theme={theme}
      height={height}
      className={className}
      label={
        locale === "ar"
          ? "اقرأ تقييمات العملاء على Trustpilot"
          : "Read our Trustpilot reviews"
      }
    />
  );
}
