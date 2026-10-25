"use client";

import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { regionalOnlyRegions, regionLabel } from "@/lib/digital-types";

/**
 * Avertissement « carte régionale » — gras et clignotant.
 *
 * Un code régional (PlayStation US, Google Play Turquie…) ne s'active QUE
 * sur un compte du pays concerné. C'est la première cause de réclamation
 * sur une carte cadeau : le client paie, reçoit un code valide, et ne peut
 * pas l'utiliser. L'avertissement est donc affiché sur la carte du
 * catalogue, sur la fiche et dans la fenêtre d'achat (donc avant le
 * paiement), jamais une seule fois en haut de page.
 *
 * Rendu :
 *  - texte en **gras**, bordure épaisse, fond ambre (lisible en mode clair
 *    comme en mode sombre) ;
 *  - pulsation LENTE (~1,8 s), désactivée pour qui a demandé
 *    `prefers-reduced-motion` — le texte reste alors fixe mais toujours gras
 *    et visible. Pas de clignotement rapide (> 3 Hz), qui serait un risque
 *    photosensible et une infraction WCAG 2.2.2.
 *
 * Aucun rendu pour une fiche mondiale : le composant se neutralise seul.
 */
export function RegionalAlert({
  regions,
  className = "",
  compact = false,
}: {
  /** Régions de la fiche ou du montant (`["US"]`, `["global"]`, …). */
  regions: readonly string[] | null | undefined;
  className?: string;
  /** Version dense (carte du catalogue) : une seule ligne, sans détail. */
  compact?: boolean;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const zones = regionalOnlyRegions(regions);
  if (zones.length === 0) return null;

  const countries = zones.map((zone) => regionLabel(zone, locale)).join(ar ? "، " : ", ");
  const message = ar
    ? `بطاقة إقليمية — لا تعمل إلا في ${countries} (حساب محلي إلزامي). لا تشترِها إن كان حسابك في بلد آخر.`
    : `Regional card — works only in ${countries} (local account required). Do not buy if your account is in another country.`;

  return (
    <p
      role="alert"
      className={`regional-alert flex items-start gap-2 rounded-xl border-2 border-amber-500 bg-amber-50 px-3 py-2 text-amber-950 ${
        compact ? "text-[11.5px] leading-5" : "text-[13.5px] leading-6"
      } font-black ${className}`}
    >
      <AlertTriangle
        aria-hidden="true"
        className={`shrink-0 text-amber-700 ${compact ? "mt-0.5 h-3.5 w-3.5" : "mt-0.5 h-4 w-4"}`}
      />
      <span>
        {compact ? (
          <>
            {ar ? "إقليمية" : "Regional"} · {countries}
          </>
        ) : (
          message
        )}
      </span>
    </p>
  );
}
