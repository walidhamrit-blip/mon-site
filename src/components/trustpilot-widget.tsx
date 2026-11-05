import Script from "next/script";

/**
 * Widget Trustpilot (TrustBox « v5 »).
 *
 * Le rendu réel est fait par le script de Trustpilot : le serveur n'émet
 * qu'un conteneur `div.trustpilot-widget` et ses `data-*`. Deux points
 * comptent :
 *
 *   - **le repli** : le `<a>` à l'intérieur du `div` reste cliquable si le
 *     script est bloqué (adblock, réseau) — on n'affiche jamais un cadre vide
 *     sans issue ;
 *   - **le choix du gabarit** : `data-template-id` désigne un type de widget
 *     (pas un compte) ; il est validé dans `src/lib/trust.ts`, une valeur
 *     inconnue retombe sur `micro-combo`.
 *
 * L'affichage est décidé par l'appelant (`shouldShowReviewWidget`) : un
 * profil sans avis afficherait « 0,0 / 5 », ce qui est pire que rien.
 */

export interface TrustpilotWidgetProps {
  businessUnitId: string;
  templateId: string;
  profileUrl: string;
  /** Locale du widget. Trustpilot n'a pas d'arabe : on retombe sur `en-US`. */
  locale: string;
  theme?: "light" | "dark";
  height?: string;
  label: string;
  className?: string;
}

/** Locales supportées par Trustpilot parmi celles utilisées par ce site. */
function widgetLocale(locale: string): string {
  if (locale.toLowerCase().startsWith("fr")) return "fr-FR";
  return "en-US";
}

export function TrustpilotWidget({
  businessUnitId,
  templateId,
  profileUrl,
  locale,
  theme = "light",
  height = "24px",
  label,
  className = "",
}: TrustpilotWidgetProps) {
  return (
    <>
      <div
        className={`trustpilot-widget ${className}`.trim()}
        data-locale={widgetLocale(locale)}
        data-template-id={templateId}
        data-businessunit-id={businessUnitId}
        data-style-height={height}
        data-style-width="100%"
        data-theme={theme}
        data-stars="1,2,3,4,5"
        data-review-languages="en,fr,ar"
      >
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-sm font-bold underline underline-offset-4"
        >
          {label}
        </a>
      </div>
      <Script
        src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
        strategy="afterInteractive"
      />
    </>
  );
}
