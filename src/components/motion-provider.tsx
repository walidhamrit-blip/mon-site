"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Réglage global des animations Framer Motion : quand le visiteur demande
 * moins de mouvement (réglage système `prefers-reduced-motion`), les
 * déplacements et zooms sont coupés — seuls les fondus restent.
 * Sans ce réglage, le CSS respectait déjà la préférence, mais pas les
 * animations JavaScript (menu mobile, assistant, cartes, formulaire).
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
