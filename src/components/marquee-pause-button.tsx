"use client";

import { Pause, Play } from "lucide-react";

/**
 * Bouton lecture / pause des bandeaux défilants (WCAG 2.2.2) : le survol à la
 * souris ne suffit pas, il faut pouvoir arrêter le mouvement au toucher et au
 * clavier. Masqué en CSS quand le visiteur demande moins d'animations (le
 * bandeau est alors déjà immobile).
 */
export function MarqueePauseButton({
  paused,
  onToggle,
  ar,
  label,
  className = "",
}: {
  paused: boolean;
  onToggle: () => void;
  ar: boolean;
  /** Nom du bandeau, pour un libellé explicite (« Mettre en pause : … »). */
  label: string;
  className?: string;
}) {
  const action = paused ? (ar ? "تشغيل" : "Play") : ar ? "إيقاف مؤقت" : "Pause";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${action} — ${label}`}
      title={action}
      className={`marquee-pause-button ${className}`}
    >
      {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
