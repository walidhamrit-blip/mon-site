# Suivi hebdomadaire de la mesure

> Une ligne par lundi. Remplir depuis Vercel Analytics → Events.
> Mode d'emploi : `docs/mesure-funnel.md`.
> Aucune donnée personnelle ici : uniquement des compteurs.

**Référence** : début de mesure = **18/11/2026** · fin = **25/11/2026**
(période sans modification de l'accueil)

> Les dates de ce document suivent le calendrier local. Les horodatages des
> runs GitHub peuvent afficher deux jours de plus : c'est l'horloge de la CI,
> pas une autre mesure.

| Semaine | Visites | `gateway_click` | Carte n°1 | `whatsapp_click` | `lead_submit` | `checkout_start` | Décision |
|---|---:|---:|---|---:|---:|---:|---|
| Réf. S1 | | | | | | | aucune |
| S2 | | | | | | | |
| S3 | | | | | | | |
| S4 | | | | | | | |

## Référence technique de l'accueil

Relevé du **18/11/2026**, avant toute modification de l'accueil (C-08).
Lighthouse **12**, mobile émulé, **3 runs**, médiane — production
`https://nokhba.net.ly/`.

| Indicateur | Valeur (médiane) | Trois runs |
|---|---:|---|
| Performance | **87** | 58 · 89 · 87 |
| Accessibilité | 100 | 100 · 100 · 100 |
| Bonnes pratiques | 96 | 96 · 96 · 96 |
| SEO | 100 | 100 · 100 · 100 |
| LCP | 2,96 s | — |
| TBT | 301 ms | — |
| CLS | 0 | — |
| Speed Index | 2,85 s | — |

- Le run à 58 est un **outlier** : la médiane est publiée, jamais le meilleur run.
- JS inutilisé ≈ **170 Kio** ; JS legacy ≈ **25 Kio**.
- Seul diagnostic en échec : `errors-in-console`.
- Pour comparer après C-08 : même outil, même URL, **3 runs**, et 14 jours de
  recul. Un écart inférieur à la variance observée ici (58–89) ne prouve rien.

## Événements vérifiés en production

| Événement | État | Preuve |
|---|---|---|
| `audit_request` | **vérifié** le 18/11/2026 | envoi du formulaire de `/audit`, événement visible dans Vercel Analytics |
| `service_view` | **vérifié** | événement visible lors d'un test d'ouverture de page service |
| `gateway_click` | à confirmer | — |
| `whatsapp_click` | à confirmer | — |
| `lead_submit` | à confirmer | — |
| `checkout_start` | à confirmer | — |

- `audit_request` est désormais observé en production : le formulaire de
  `/audit` l'émet bien, avec `source:"audit-form"`.
- Les quatre autres restent à confirmer dans l'onglet Events : le code les
  émet, mais cela ne remplace pas une observation réelle.
- Ne cocher « vérifié » qu'après l'avoir vu dans l'onglet Events, jamais par
  déduction depuis le code.
- Refaire ce contrôle une fois par mois et après tout changement de formulaire.

## Journal des décisions

| Date | Observation | Décision | Effet attendu | Mesuré le |
|---|---|---|---|---|
| | | | | |

## Rappels

- Sous **100 visites** ou **20 clics**, ne pas conclure.
- Une baisse de plus de **30 %** des visites : lire le runbook de surveillance
  avant de toucher au site.
- Après un changement d'accueil (C-08) : **14 jours** de mesure avant de
  comparer à la référence.
- Vérifier chaque mois que les 6 événements sont toujours présents.
