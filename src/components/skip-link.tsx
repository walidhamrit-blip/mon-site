"use client";

import { useI18n } from "@/lib/i18n";

/**
 * Lien d'évitement : premier élément atteint au clavier (Tab), il permet de
 * sauter la barre de navigation pour aller directement au contenu principal.
 * Invisible tant qu'il n'a pas le focus.
 */
export function SkipLink({ targetId = "main-content" }: { targetId?: string }) {
  const { locale } = useI18n();
  return (
    <a href={`#${targetId}`} className="skip-link">
      {locale === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}
    </a>
  );
}
