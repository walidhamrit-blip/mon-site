# Alignement marché — formule de prix boutique

- **Date :** 4 novembre 2026 (règle de repli et recharge Steam ajoutées le même jour)
- **Portée :** boutique `/codes` (cartes cadeaux, wallets, top-ups, abonnements numériques)
- **Devise :** USDT / USD uniquement. Le LYD a été retiré du site et de l'administration.
- **Statut :** automatique et actif (`siteConfig.pricingAlignment.enabled`)

---

## 1. La règle, en une phrase

> Chaque montant est vendu **1,5 % sous le prix du revendeur le moins cher**, sans jamais
> monter au-dessus de la **valeur faciale** de la carte ; et quand le marché passe **sous**
> le plancher de rentabilité, le prix est ramené à **coût + 1 %** plutôt que laissé au-dessus
> du marché.

Trois références, une seule décision par montant :

| Référence | Rôle | Exemple |
| --- | --- | --- |
| **Revendeur** (Eneba, G2A) | cible à battre | Steam 50 $ → 51,39 $ |
| **Valeur faciale** (prix officiel) | plafond, jamais une cible | Xbox 50 $ → 50,00 $ |
| **Coût fournisseur** (FazerCards) | plancher, jamais une cible | Steam 50 $ → 49,25 $ |

## 2. La formule

```
plancher    = (coût + frais_fixe + profit_mini) / (1 − commission)
cible       = référence × (1 − décote)          → si la référence vient d'un revendeur
cible       = min(prix_actuel, référence)       → si la référence est une valeur faciale

si cible ≥ plancher :
    recommandé = max(cible, plancher)           → prix rentable au niveau du marché
sinon (marché sous le plancher) :
    recommandé = coût × (1 + marge_de_repli)    → prix au niveau du marché, marge minimale
```

Paramètres (`src/lib/config.ts` → `pricingAlignment`), réglables sans toucher au code :

| Paramètre | Valeur | Pourquoi |
| --- | --- | --- |
| `undercutPercent` | 1,5 % | être visiblement moins cher, sans déclencher de guerre des prix |
| `feePercent` | **1,4 %** | commission NOWPayments multi-devises (0,9 % mono-devise) |
| `fixedFeeUsd` | 1,00 $ | frais fixes par transaction (hypothèse haute : retraits 0 %, réseau offert sur USDT TRC20 jusqu'en décembre) |
| `minProfitUsd` | 0,50 $ | en dessous, l'opération n'a pas d'intérêt |
| `blockedMarginPercent` | **1 %** | marge de repli quand le marché est sous le plancher |
| `maxStepPercent` | 25 % | garde-fou : aucune variation plus forte en une fois |
| `minRetailUsd` | 1,50 $ | plancher absolu, aligné sur `MIN_RETAIL_USD` |
| `lockedProductIds` | `[]` | fiches dont le prix est décidé à la main |

Le plancher divise par `(1 − commission)` et non par `(1 + commission)` : la commission est
prélevée **sur le prix payé**, pas sur le coût.

### Les frais réels du compte : 1,4 %, pas 1 %

L'e-mail NOWPayments **« Your service fee has changed »** du **18 octobre 2026** est sans
ambiguïté :

> *« Your service fee has changed from 1% to **0.9%** for mono-currency payments, and from
> 1.5% to **1.4%** for multi-currency payments. No action is needed on your side — the new
> rate applies automatically to your transactions. »*

La page publique `nowpayments.io/pricing` affiche encore 1 % / 1,5 % (et parle de 0,3 % pour
les partenaires éligibles) : elle décrit le barème générique, pas le taux négocié du compte.
C'est l'e-mail qui fait foi, et le taux s'applique automatiquement.

**Lequel nous concerne ?** Nos factures sont émises en **USD** (`NOWPAYMENTS_CURRENCY=usd`)
et réglées dans la crypto choisie par le client : il y a conversion à chaque paiement, donc
**multi-devises → 1,4 %**. Le **0,9 %** ne s'appliquerait qu'à un paiement émis et réglé dans
la même devise (facturation directe en USDT). Le jour où la caisse facture en USDT, il suffit
de passer `feePercent` à 0,9 dans `config.ts` — les tests suivent.

### Le repli « coût + 1 % » : ce qu'il fait, et ce qu'il coûte

Décision du 4 novembre : sur les montants bloqués, on préfère **rester au niveau du marché**
avec une marge symbolique plutôt que d'afficher 10 à 20 % plus cher que les revendeurs.

Conséquence chiffrée, à assumer en connaissance de cause : **la commission (1,4 % + 1,00 $)
coûte plus que 1 % du coût**. Sur les 22 références du catalogue, 13 passent en marge nette
négative et la marge cumulée d'un panier « un exemplaire de chaque » tombe de **76,28 $ à
13,92 $**. L'écran d'admin affiche la marge réelle et marque « vente à perte » : ce n'est pas
un bug du calcul, c'est l'effet mécanique des frais fixes sur les petits montants.

Trois sorties possibles, par ordre d'efficacité :
1. **Baisser les frais fixes** (moins de commissions, panier minimum) : chaque dollar de frais
   fixe en moins rend rentables plusieurs montants.
2. **Remonter `blockedMarginPercent`** : couvrir le pourcentage seul demande ~1,6 % ; couvrir
   aussi le dollar fixe demande ~11 % sur un coût de 10 $ — on repasse alors au-dessus du
   marché, donc cette sortie ne vaut que si l'on accepte de redevenir plus cher.
3. **Renégocier le coût** (palier fournisseur supérieur) : le plancher descend sous le marché.

## 3. Les états d'un montant

| État | Signification | Action |
| --- | --- | --- |
| `aligned` | le prix est déjà au bon niveau | rien |
| `lowered` | le prix a été baissé vers la cible | rien |
| `raised` | le prix a été relevé vers une cible restée sous le plafond | vérifier à l'écran |
| `cost_margin` | **marché sous le plancher** → prix ramené à coût + 1 % | surveiller la marge nette |
| `blocked` | marché sous le plancher et repli désactivé (`blockedMarginPercent: 0`) | décision commerciale |
| `step_blocked` | variation > 25 % : probable erreur de relevé | vérifier le relevé |
| `no_benchmark` / `no_cost` | aucun prix comparable ou coût inconnu | compléter la donnée |
| `locked` | prix verrouillé à la main | rien |

## 4. Ce que ça change, montant par montant

Simulation sur les coûts revendeur relevés le 3 novembre 2026 (prix actuel = `retailPriceForCost(coût)`).

| Produit | Montant | Coût | Avant | Marché | Après | État | Marge nette avant → après |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Steam | 5 $ | 4,92 | 6,15 | 5,17 | **4,97** | repli | +0,14 → −1,02 |
| Steam | 10 $ | 10,01 | 11,78 | 10,75 | **10,11** | repli | +0,61 → −1,04 |
| Steam | 25 $ | 25,43 | 28,90 | 27,86 | **27,44** | baissé | +2,07 → +0,63 |
| Steam | 50 $ | 49,25 | 55,97 | 51,39 | **49,74** | repli | +4,94 → −1,21 |
| Steam | 100 $ | 98,98 | 109,98 | 100,00 | **99,97** | repli | +8,46 → −1,41 |
| PlayStation | 10 $ | 8,62 | 10,15 | 10,00 | **8,71** | repli | +0,39 → −1,03 |
| PlayStation | 25 $ | 21,81 | 24,79 | 23,29 | **22,03** | repli | +1,63 → −1,09 |
| PlayStation | 50 $ | 42,63 | 48,45 | 45,93 | **45,24** | baissé | +4,14 → +0,98 |
| PlayStation | 100 $ | 87,42 | 97,14 | 100,00 | 97,14 | aligné | +7,36 |
| Xbox | 10 $ | 8,72 | 10,26 | 10,00 | **8,81** | repli | +0,40 → −1,03 |
| Xbox | 25 $ | 21,01 | 23,88 | 25,00 | 23,88 | aligné | +1,54 |
| Xbox | 50 $ | 41,65 | 47,33 | 50,00 | 47,33 | aligné | +4,02 |
| Xbox | 100 $ | 84,05 | 93,39 | 100,00 | 93,39 | aligné | +7,03 |
| Amazon | 10 $ | 9,80 | 11,53 | 10,00 | **9,90** | repli | +0,57 → −1,04 |
| Amazon | 50 $ | 49,00 | 55,69 | 50,00 | **49,49** | repli | +4,91 → −1,20 |
| Amazon | 100 $ | 97,99 | 108,88 | 100,00 | **98,97** | repli | +8,37 → −1,41 |
| Google Play | 10 $ | 9,63 | 11,33 | 10,00 | **9,73** | repli | +0,54 → −1,04 |
| Google Play | 50 $ | 48,18 | 54,75 | 50,00 | **48,66** | repli | +4,80 → −1,20 |
| Google Play | 100 $ | 96,35 | 107,06 | 100,00 | **100,00** | baissé | +8,21 → +1,25 |
| Roblox | 400 | 4,75 | 5,94 | 4,99 | **4,80** | repli | +0,11 → −1,02 |
| Roblox | 800 | 8,15 | 9,59 | 9,99 | 9,59 | aligné | +0,31 |
| Roblox | 1 700 | 17,15 | 20,18 | 19,99 | **19,99** | baissé | +1,75 → +1,56 |
| Roblox | 4 500 | 41,35 | 46,99 | 49,99 | 46,99 | aligné | +3,98 |

Tableau complet et journal : **`/admin/digital/alignment`**.

## 5. Recharge de compte Steam (nouvelle ligne)

La carte cadeau Steam est **structurellement chère** : le fournisseur la facture au-dessus de
sa valeur faciale (10 $ → 10,01 $). La **recharge de compte** (« Steam by login ») est facturée
**en dessous** : 10 USDT crédités coûtent **9,75 $** (remise Bronze 2,5 % ; 3 % Silver, 3,55 %
Gold). C'est cette ligne qui doit remplacer les cartes Steam sur les montants bloqués.

| Montant | Coût (remise 2,5 %) | Valeur portefeuille | Prix de vente aligné | Carte cadeau Steam (avant) |
| ---: | ---: | ---: | ---: | ---: |
| 5 | 4,88 $ | 5,00 $ | **4,93 $** | 6,15 $ |
| 10 | 9,75 $ | 10,00 $ | **9,85 $** | 11,78 $ |
| 20 | 19,50 $ | 20,00 $ | **19,70 $** | — |
| 50 | 48,75 $ | 50,00 $ | **49,24 $** | 55,97 $ |
| 100 | 97,50 $ | 100,00 $ | **98,48 $** | 109,98 $ |

Fiche : `steam-account-topup` (`src/lib/digital-own-products.ts`), région **CIS** (la recharge
par identifiant n'est ouverte que sur les storefronts éligibles : Russie, Ukraine, Kazakhstan,
Biélorussie…), champ obligatoire **`steamLogin`**, livraison manuelle.

**Statut `coming_soon` — pourquoi.** La fiche, ses coûts et ses prix sont publiés et alignés,
mais la caisse ne l'accepte pas encore : le tunnel ne collecte pas l'identifiant Steam et la
commande passe par `/api/v2/steam-topup/order` (`steamLogin`, `currency`, `amount`), pas par
`/orders` (`offer_id`). Brancher cette caisse demande trois choses : champ `steamLogin` dans le
formulaire de paiement, stockage du champ sur la commande, appel `check-login` puis `order`.
Tant que ce n'est pas fait, la fiche reste en liste d'attente — elle ne peut pas être vendue
« à moitié ».

## 6. Ce que l'écran d'administration sert à décider

Pour chaque montant en repli ou bloqué, trois issues :

1. **Renégocier le coût** (palier FazerCards supérieur) → le plancher descend sous le marché.
2. **Vendre en lot** (bundle « 2 × 5 $ », panier minimum) → le coût fixe se dilue.
3. **Basculer sur la recharge Steam** (ou délistage) : mieux vaut une référence absente qu'une
   référence à perte.

La colonne « vente à perte » signale les montants servis sous le plancher : ce sont les seuls
à traiter en priorité.

## 7. Où c'est appliqué, et comment le vérifier

| Endroit | Fichier | Effet |
| --- | --- | --- |
| Formule pure | `src/lib/competitor-pricing.ts` | aucune dépendance, testable |
| Relevés datés | `src/lib/competitor-prices.ts` | date + canal obligatoires |
| Fiches maison | `src/lib/digital-own-products.ts` | recharge Steam, fusionnée partout |
| Catalogue servi (API) | `src/lib/fazercards-catalog.ts` | après la politique commerciale |
| Catalogue stocké | `src/lib/digital-store.ts` | après les overrides admin |
| Caisse | `src/app/api/digital/checkout/route.ts` | relit le même catalogue → prix vu = prix payé |
| Écran + journal | `src/app/admin/(panel)/digital/alignment/page.tsx` | lecture seule + traçabilité |

Vérification : `npm run test:digital` (dont `scripts/competitor-pricing.test.mjs`, 19 cas).

**Mise à jour des relevés :** éditer `MARKET_BENCHMARKS` dans `src/lib/competitor-prices.ts`
avec la date du jour. Un relevé sans date est refusé par les tests — c'est volontaire : un
prix de marché sans date de relevé n'est pas une donnée, c'est une rumeur.

## 8. Limites assumées

- **Relevés manuels.** Eneba et G2A n'exposent pas d'API publique de prix par dénomination ;
  la table est mise à jour à la main. Prévoir un relevé hebdomadaire (10 minutes).
- **Marge de repli négative après frais** sur 13 des 22 références (voir §2). C'est le prix de
  la compétitivité à frais fixes constants.
- **Plafond de commande à 50 $** (`MAX_DIGITAL_ORDER_USD`) : les cartes 100 $ restent
  achetables mais non commandables en ligne. Ce plafond est indépendant de la formule et
  devrait être relevé à 110 $ pour couvrir les 100 $ alignés.
- **Recharge Steam non vendable en ligne** tant que la caisse « login » n'est pas branchée.
- **Coût = prix de gros FazerCards.** Si le fournisseur change, seul le coût bouge ; la
  formule suit automatiquement.
- **Pas de pas d'arrondi à 0,50 $.** Les prix sont arrondis au centime, ce qui garde la décote
  de 1,5 % intacte.
