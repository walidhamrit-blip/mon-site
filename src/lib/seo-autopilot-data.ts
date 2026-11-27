import type { SeoAutopilotState } from "@/lib/seo-autopilot";

/**
 * État persistant du pilote automatique SEO Search Console.
 *
 * - `cooldownDays` : durée minimale (règle anti-yo-yo 14–21j) pendant laquelle
 *   une URL fraîchement optimisée reste verrouillée afin de laisser Google
 *   stabiliser sa position et mesurer le gain de CTR.
 * - `history` : journal horodaté des optimisations par chemin relatif.
 * - `overrides` : surcharges SERP bilingues (`<title>` & `meta description`)
 *   générées automatiquement par `scripts/gsc-auto-optimize.mjs` et validées
 *   avant commit.
 */
export const SEO_AUTOPILOT_STATE: SeoAutopilotState = {
  "cooldownDays": 18,
  "history": {
    "/abonnements": {
      "lastOptimizedAt": "2026-11-25T13:16:00.000Z",
      "baselinePosition": 7.3,
      "baselineCtr": 0.067,
      "baselineImpressions": 30,
      "note": "FAQ + mots-clés abonnements Libye (PR #271)"
    },
    "/demos/al-manhaj-company": {
      "lastOptimizedAt": "2026-11-25T13:16:00.000Z",
      "baselinePosition": 13.5,
      "baselineCtr": 0.158,
      "baselineImpressions": 19,
      "note": "Métadonnées B2B/détail Tripoli (PR #271)"
    },
    "/demos/toy-store-tripoly": {
      "lastOptimizedAt": "2026-11-25T13:16:00.000Z",
      "baselinePosition": 9,
      "baselineCtr": 0.028,
      "baselineImpressions": 36,
      "note": "CTR Page 1 Toy Store Tripoli (PR #271)"
    },
    "/pricing": {
      "lastOptimizedAt": "2026-11-25T13:58:00.000Z",
      "baselinePosition": 7.3,
      "baselineCtr": 0,
      "baselineImpressions": 47,
      "note": "CTR Page 1 ancrage 35$ USD/USDT (PR #276)"
    },
    "/contact": {
      "lastOptimizedAt": "2026-11-25T13:58:00.000Z",
      "baselinePosition": 5.8,
      "baselineCtr": 0,
      "baselineImpressions": 23,
      "note": "CTR Page 1 WhatsApp & devis gratuit (PR #276)"
    },
    "/demos/pizzeria-forno-tripoli": {
      "lastOptimizedAt": "2026-11-25T13:58:00.000Z",
      "baselinePosition": 8.2,
      "baselineCtr": 0,
      "baselineImpressions": 33,
      "note": "CTR Page 1 Pizza Forno Tripoli (PR #276)"
    },
    "/codes/fzr-giftcard-playstation-be": {
      "lastOptimizedAt": "2026-11-26T00:00:00.000Z",
      "baselinePosition": 18.4,
      "baselineCtr": 0,
      "baselineImpressions": 15,
      "note": "Fiche PlayStation (BE) — 8 champs SEO/éditoriaux (correctif n°3)"
    }
  },
  "overrides": {}
};
