# Alignement marché — formule de prix boutique

- **Date :** 4 novembre 2026
- **Portée :** boutique `/codes` (cartes cadeaux, wallets, top-ups, abonnements numériques)
- **Devise :** USDT / USD uniquement. Le LYD a été retiré du site et de l'administration.
- **Statut :** automatique et actif (`siteConfig.pricingAlignment.enabled`)

---

## 1. La règle, en une phrase

> Chaque montant est vendu **1,5 % sous le prix du revendeur le moins cher**, sans jamais
> descendre sous le **plancher de rentabilité** ni monter au-dessus de la **valeur faciale**
> de la carte.

Trois références, et une seule décision possible par montant :

| Référence | Rôle | Exemple |
| --- | --- | --- |
| **Revendeur** (Eneba, G2A) | cible à battre | Steam 50 $ → 51,39 $ |
| **Valeur faciale** (prix officiel) | plafond, jamais une cible | Xbox 50 $ → 50,00 $ |
| **Coût fournisseur** (FazerCards) | plancher, jamais une cible | Steam 50 $ → 49,25 $ |

## 2. La formule

```
plancher  = (coût + frais_fixe + profit_mini) / (1 − commission)
cible     = référence × (1 − décote)            → si la référence vient d'un revendeur
cible     = min(prix_actuel, référence)         → si la référence est une valeur faciale
recommandé = max(cible, plancher)               → sinon, aucun prix n'est appliqué
```

Paramètres (`src/lib/config.ts` → `pricingAlignment`), réglables sans toucher au code :

| Paramètre | Valeur | Pourquoi |
| --- | --- | --- |
| `undercutPercent` | 1,5 % | être visiblement moins cher, sans déclencher de guerre des prix |
| `feePercent` | 1,5 % | commission du processeur de paiement |
| `fixedFeeUsd` | 1,00 $ | frais fixes par transaction |
| `minProfitUsd` | 0,50 $ | en dessous, l'opération n'a pas d'intérêt |
| `maxStepPercent` | 25 % | garde-fou : aucune variation plus forte en une fois |
| `minRetailUsd` | 1,50 $ | plancher absolu, aligné sur `MIN_RETAIL_USD` |
| `lockedProductIds` | `[]` | fiches dont le prix est décidé à la main |

Le plancher divise par `(1 − commission)` et non par `(1 + commission)` : la commission est
prélevée **sur le prix payé**, pas sur le coût. L'écart est de quelques centimes par vente —
c'est exactement la marge qui manquait.

## 3. Les six états d'un montant

| État | Signification | Action |
| --- | --- | --- |
| `aligned` | le prix est déjà au bon niveau | rien |
| `lowered` | le prix a été baissé vers la cible | rien |
| `raised` | le prix a été relevé vers une cible restée sous le plafond | vérifier à l'écran |
| `blocked` | **le marché est sous notre plancher** | décision commerciale (voir §5) |
| `step_blocked` | variation > 25 % : probable erreur de relevé | vérifier le relevé |
| `no_benchmark` / `no_cost` | aucun prix comparable ou coût inconnu | compléter la donnée |
| `locked` | prix verrouillé à la main | rien |

Un état `blocked` n'est pas une panne : c'est un montant où **vendre au prix du marché
reviendrait à vendre à perte**. La formule refuse alors de bouger le prix, plutôt que de
casser la marge en silence.

## 4. Ce que ça change, montant par montant

Simulation sur les coûts revendeur relevés le 3 novembre 2026 (coût = prix de gros,
prix actuel = `retailPriceForCost(coût)`).

| Produit | Montant | Coût | Prix actuel | Référence | Cible | Plancher | Prix servi | État |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Steam | 5 $ | 4,92 | 6,15 | 5,17 | 5,09 | 6,52 | 6,15 | bloqué |
| Steam | 10 $ | 10,01 | 11,78 | 10,75 | 10,59 | 11,69 | 11,78 | bloqué |
| Steam | 25 $ | 25,43 | 28,90 | 27,86 | 27,44 | 27,34 | **27,44** | baissé |
| Steam | 50 $ | 49,25 | 55,97 | 51,39 | 50,62 | 51,52 | 55,97 | bloqué |
| PlayStation | 50 $ | 42,63 | 48,45 | 45,93 | 45,24 | 44,80 | **45,24** | baissé |
| PlayStation | 100 $ | 87,42 | 97,14 | 100,00 | 100,00 | 90,27 | 97,14 | aligné |
| Xbox | 25 $ | 21,01 | 23,88 | 25,00 | 25,00 | 22,85 | 23,88 | aligné |
| Xbox | 50 $ | 41,65 | 47,33 | 50,00 | 50,00 | 43,81 | 47,33 | aligné |
| Google Play | 100 $ | 96,35 | 107,06 | 100,00 | 100,00 | 99,34 | **100,00** | baissé |
| Roblox | 1 700 | 17,15 | 20,18 | 19,99 | 19,99 | 18,93 | **19,99** | baissé |
| Roblox | 4 500 | 41,35 | 46,99 | 49,99 | 49,99 | 43,50 | 46,99 | aligné |

Tableau complet et journal : **`/admin/digital/alignment`**.

Ce que la simulation dit vraiment : la formule ne peut pas aligner ce qui est
**structurellement trop cher à l'achat**. Steam 5 $ coûte 4,92 $ en gros ; à ce coût, le
plancher est 6,52 $ alors que le marché est à 5,17 $. Aucune formule ne résout ça — il faut
soit un meilleur palier fournisseur, soit vendre ces montants en lot.

## 5. Ce que l'écran d'administration sert à décider

Pour chaque montant bloqué, trois issues :

1. **Renégocier le coût** (palier FazerCards supérieur) → le plancher descend sous le marché.
2. **Vendre en lot** (bundle « 2 × 5 $ », panier minimum) → le coût fixe se dilue.
3. **Délister** le montant : mieux vaut une référence absente qu'une référence à perte.

La colonne « vente à perte » signale les montants **déjà** servis sous le plancher : ce sont
les seuls à traiter en priorité, car chaque vente y détruit de la marge.

## 6. Où c'est appliqué, et comment le vérifier

| Endroit | Fichier | Effet |
| --- | --- | --- |
| Formule pure | `src/lib/competitor-pricing.ts` | aucune dépendance, testable |
| Relevés datés | `src/lib/competitor-prices.ts` | date + canal obligatoires |
| Catalogue servi (API) | `src/lib/fazercards-catalog.ts` | après la politique commerciale |
| Catalogue stocké | `src/lib/digital-store.ts` | après les overrides admin |
| Caisse | `src/app/api/digital/checkout/route.ts` | relit le même catalogue → prix vu = prix payé |
| Écran + journal | `src/app/admin/(panel)/digital/alignment/page.tsx` | lecture seule + traçabilité |

Vérification : `npm run test:digital` (dont `scripts/competitor-pricing.test.mjs`, 15 cas).

**Mise à jour des relevés :** éditer `MARKET_BENCHMARKS` dans `src/lib/competitor-prices.ts`
avec la date du jour. Un relevé sans date est refusé par les tests — c'est volontaire : un
prix de marché sans date de relevé n'est pas une donnée, c'est une rumeur.

## 7. Limites assumées

- **Relevés manuels.** Eneba et G2A n'exposent pas d'API publique de prix par dénomination ;
  la table est mise à jour à la main. Prévoir un relevé hebdomadaire (10 minutes).
- **Plafond de commande à 50 $** (`MAX_DIGITAL_ORDER_USD`) : les cartes 100 $ restent
  achetables mais non commandables en ligne. Ce plafond est indépendant de la formule et
  devrait être relevé à 110 $ pour couvrir les 100 $ alignés.
- **Coût = prix de gros FazerCards.** Si le fournisseur change, seul le coût bouge ; la
  formule suit automatiquement.
- **Pas de pas d'arrondi à 0,50 $.** Les prix sont arrondis au centime, ce qui garde la
  décote de 1,5 % intacte. Un arrondi commercial (`.50`, `.99`) rendrait la décote visible
  dans un sens ou dans l'autre selon le montant.
