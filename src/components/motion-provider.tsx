"use client";

import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Réglage global des animations Framer Motion : quand le visiteur demande
 * moins de mouvement (réglage système `prefers-reduced-motion`), les
 * déplacements et zooms sont coupés — seuls les fondus restent.
 * Sans ce réglage, le CSS respectait déjà la préférence, mais pas les
 * animations JavaScript (menu mobile, assistant, cartes, formulaire).
 *
 * `LazyMotion` + `domAnimation` : le site n'utilise que les fonctionnalités
 * DOM d'animation (fondus, entrées, survols, touchers) — aucune fonctionnalité
 * `drag` ou `layout`. En ne chargeant que ce bundle minimal, le fichier
 * `framer-motion` ne pèse plus le poids des fonctionnalités inutilisées
 * sur chaque page (point 2 : réduction du JS initial).
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
