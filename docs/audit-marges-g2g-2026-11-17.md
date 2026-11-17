# Audit de marge G2G — prix FazerCards vs 3 meilleurs prix de vente

**Date du relevé :** 17 novembre 2026
**Branche :** `arena/0d5f911e-mon-site`
**Objet :** (1) fixer la variable `G2G_FEE_PERCENT` sur Vercel, (2) connaître le gain net réel par produit.

**Méthode reproductible :**

```bash
node scripts/g2g-margin-audit.mjs          # tableaux ci-dessous
node scripts/g2g-margin-audit.mjs --json   # sortie machine
node --test scripts/g2g-margin-audit.test.mjs   # verrouille les formules
```

Données d'entrée : `docs/data/g2g-margin-audit-2026-11-17.json` (aucun appel réseau, aucun secret).

---

## 1. Réponse courte

| Question | Réponse |
| --- | --- |
| **Valeur à mettre dans `G2G_FEE_PERCENT` (Vercel)** | **`12`** — ne jamais sous-estimer la commission |
| Fourchette réellement mesurée | **6,05 % → 14,98 %** selon le canal de retrait et le maintien (ou non) de la promo 4,99 % |
| Produits réellement listables au prix du marché | **Steam Wallet 100 $ (US)** (la seule à marge confortable), puis **PSN 50 / 25 / 10 $ (US)** en marge mince |
| Produits à ne pas lister | Google Play 10, PSN 100, Amazon 10 / 50, Steam 10 / 50, **et tous les Robux** |
| Cause racine des pertes | les frais fixes de retrait (0,99 $ + 1,00 $ de réseau) écrasent les paniers < 15 $, et le 4,99 % de commission s'y ajoute |

Le `12` n'est pas une estimation : il est calé au-dessus des taux mesurés en régime nominal
(10,73 % / 10,23 % / 6,05 %), avec ~1,3 point de marge de sécurité sur le plus élevé. À 12 %, le
moteur **sous-estime** légèrement le net réel — il refuse donc des ventes marginales qui auraient
été tout juste rentables. C'est l'erreur acceptable ; l'inverse (accepter une vente à perte) ne
l'est pas.

Un seul scénario dépasse 12 : la **fin de la promotion de commission**, où le prélèvement monte à
**14,98 %**. Ce n'est pas un cas nominal mais un point de surveillance : si G2G met fin à la promo
4,99 %, il faut **repasser la variable à 15** et relever les prix, pas laisser 12 en place.

---

## 2. Les frais G2G, couche par couche

Tous ces frais sont **côté vendeur** : ils se déduisent du prix affiché, aucun n'est refacturé à l'acheteur.

| # | Couche | Barème relevé | S'applique |
| --- | --- | --- | --- |
| 1 | **Commission de vente** | **4,99 %** (promo « Gift Cards / Top-Up »). Hors promo : 9,99 % (rang Normal) → 4,99 % (Legendary) pour la catégorie « Other Service » | par vente |
| 2 | **Frais de retrait** | USDT/BTC/ETH **4,99 % + 0,99 $** (2,99 % + 0,99 $ en Legendary) ; PayPal **2,99 % + 0,99 $** (0,99 % + 0,99 $ en Legendary) ; Payoneer 2,99 % + 3,99 $ ; virement US 2,99 % + 2,99 $ ; SWIFT 2,99 % + 13,99 $ ; Skrill 7,99 % + 0,99 $ | **par lot retiré**, pas par vente |
| 3 | **Frais réseau crypto** | ≈ **1,00 $** par retrait on-chain | par retrait |
| 4 | Frais d'inscription / de mise en ligne | **aucun** | — |
| 5 | Taxe locale sur la commission | mentionnée par G2G, non chiffrable ici | à vérifier au premier relevé de facture |

Sources : `support.g2g.com` art. 5000001408 (commission) et art. 5000001416 (retraits, table USD).

**Le point décisif est le #2 :** les frais fixes (0,99 $ + 1,00 $ = **1,99 $**) ne tombent pas sur
chaque vente mais sur **chaque retrait**. Un vendeur qui accumule 400 $ de ventes avant de retirer
les dilue dans 400 $ ; un vendeur qui retire après chaque vente les paie intégralement sur cette vente.
C'est pour cela que le script calcule deux modes :

- **`batch`** (cas réel visé) — les frais fixes sont répartis au prorata du lot retiré ;
- **`solo`** (pire cas) — la vente paie seule tous les frais fixes. C'est ce mode qui explique
  pourquoi une carte à 10 $ ne peut structurellement pas être rentable.

### Taux de prélèvement effectif

Formule exacte du net :

```
net = P × (1 − commission) × (1 − tauxRetrait) − fraisFixes × (P / lotRetiré)
```

| Scénario | Commission | Retrait | Fixes | **Taux effectif** | Équivalent `G2G_FEE_PERCENT` |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pessimiste — USDT TRC-20, Normal, lot 200 $ | 4,99 % | 4,99 % | 1,99 $ | **10,73 %** | 10,73 |
| Réaliste — USDT TRC-20, Normal, lot 400 $ | 4,99 % | 4,99 % | 1,99 $ | **10,23 %** | 10,23 |
| Cible — PayPal USD, Legendary, lot 800 $ | 4,99 % | 0,99 % | 0,99 $ | **6,05 %** | 6,05 |
| Risque — fin de la promo 4,99 % | 9,99 % | 4,99 % | 1,99 $ | **14,98 %** | 14,98 |

> Le code n'accepte **qu'un seul pourcentage** (`G2G_FEE_PERCENT`, cf. `src/lib/g2g-core.ts` ligne ~412 :
> `netRevenueUsd = unitPrice × qty × (1 − feePercent/100)`). Les montants fixes doivent donc être
> « cuits » dans un pourcentage unique. `12` couvre tous les scénarios sauf le scénario de risque,
> où il reste légèrement optimiste de 3 points.

---

## 3. Comparaison produit par produit (3 prix les plus bas)

Prix de référence = **3ᵉ prix le plus bas** de la place de marché : c'est le prix à ne pas dépasser
pour apparaître dans les trois premières offres. Les frais de traitement acheteur ne sont **pas**
déduits du vendeur, ils ne sont donc pas modélisés.

Le tableau ci-dessous reprend le **scénario réaliste** (USDT TRC-20, lot de 400 $). Les scénarios
pessimiste, cible et risque sont détaillés en annexe (§7), avec le même calcul.

| Produit | Valeur | Coût FazerCards | 3 prix G2G | 3ᵉ prix | Net encaissé | Marge | % | Verdict |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Amazon Gift Card USD 10 (US) | 10,00 $ | 9,80 $ | 10,70 | 10,70 $ | 9,61 $ | **-0,19 $** | -2,02 % | ❌ perte |
| Amazon Gift Card USD 50 (US) | 50,00 $ | 49,00 $ | 53,40 · 53,50 · 54,18 | 54,18 $ | 48,64 $ | **-0,36 $** | -0,74 % | ❌ perte |
| Google Play Gift Card USD 10 (US) | 10,00 $ | 9,63 $ | 8,00 | 8,00 $ | 7,18 $ | **-2,45 $** | -34,09 % | ❌ perte |
| Google Play Gift Card USD 25 (US) | 25,00 $ | 24,09 $ | 27,56 · 27,99 · 28,00 | 28,00 $ | 25,14 $ | **+1,05 $** | +4,16 % | ⚠️ faible |
| PSN Gift Card USD 10 (US) | 10,00 $ | 8,62 $ | 9,84 · 9,85 · 9,90 | 9,90 $ | 8,89 $ | **+0,27 $** | +3,01 % | ⚠️ faible |
| PSN Gift Card USD 25 (US) | 25,00 $ | 21,81 $ | 24,73 · 24,74 · 24,92 | 24,92 $ | 22,37 $ | **+0,56 $** | +2,51 % | ⚠️ faible |
| PSN Gift Card USD 50 (US) | 50,00 $ | 42,63 $ | 49,19 · 49,20 · 50,40 | 50,40 $ | 45,24 $ | **+2,61 $** | +5,78 % | ✅ |
| PSN Gift Card USD 100 (US) | 100,00 $ | 87,42 $ | 90,00 | 90,00 $ | 80,79 $ | **-6,63 $** | -8,20 % | ❌ perte |
| Robux 800 (Global) | 9,99 $ | 8,15 $ | 4,66 · 4,77 · 4,79 | 4,79 $ | 4,30 $ | **-3,85 $** | -89,53 % | ❌ perte |
| Robux 1 700 (Global) | 19,99 $ | 17,15 $ | 9,96 · 10,00 · 10,14 | 10,14 $ | 9,10 $ | **-8,05 $** | -88,40 % | ❌ perte |
| Robux 4 500 (Global) | 49,99 $ | 41,35 $ | 23,55 · 26,84 · 26,99 | 26,99 $ | 24,23 $ | **-17,12 $** | -70,66 % | ❌ perte |
| Steam Wallet Code USD 10 (US) | 10,00 $ | 10,01 $ | 10,72 | 10,72 $ | 9,62 $ | **-0,39 $** | -4,02 % | ❌ perte |
| Steam Wallet Code USD 50 (US) | 50,00 $ | 49,25 $ | 50,00 · 50,69 · 54,45 | 54,45 $ | 48,88 $ | **-0,37 $** | -0,76 % | ❌ perte |
| Steam Wallet Code USD 100 (US) | 100,00 $ | 98,98 $ | 141,75 · 141,76 | 141,76 $ | 127,26 $ | **+28,28 $** | +22,22 % | ✅ |

---

## 4. Lecture des résultats

### 4.1 Ce qui gagne de l'argent

**Steam Wallet 100 $ (US)** est un cas à part : seulement **2 vendeurs** sur la catégorie, à
**141,75 $ / 141,76 $** pour une carte de 100 $. Coût FazerCards 98,98 $. Net ≈ **127,26 $** en
scénario réaliste, soit **+28,28 $ (+22,22 %)**. C'est la seule ligne où la marge absorbe
confortablement tous les frais, quel que soit le canal de retrait, et où le prix conseillé
(140,34 $) reste **sous** le 3ᵉ prix. C'est la priorité de mise en ligne : peu de concurrence,
prix très au-dessus de la valeur faciale.

**PSN 50 / 25 / 10 $ (US)** sont rentables mais avec une marge fragile (respectivement
+5,78 %, +2,51 %, +3,01 % en réaliste). Elles ne tiennent que parce que le marché PSN se traite
au-dessus de la valeur faciale (50 $ vendu 49,19–50,40 $) et parce que FazerCards achète à ~85 %.
Une baisse de 3 % du prix de marché, ou une hausse du coût fournisseur, suffit à les faire basculer.

### 4.2 Ce qui perd de l'argent — et pourquoi

| Famille | Constat | Explication |
| --- | --- | --- |
| **Robux** (800/1 700/4 500) | −63 % à −91 % | **Mauvais produit, pas mauvais prix.** La catégorie G2G « Roblox » est un marché de **recharge manuelle par identifiant joueur** (« Manual Top Up »), pas de **codes**. Le marché y traite à 4,66–26,99 $ quand FazerCards coûte 8,15–41,35 $. Ce ne sont pas les mêmes objets : aucun code Roblox ne peut s'aligner. **À exclure définitivement.** |
| **Google Play 10 $** | −28 % à −35 % | Le marché vend une carte de 10 $ à **8,00 $**, sous le prix d'achat FazerCards (9,63 $). Impossible sans perte, quel que soit le canal. |
| **PSN 100 $** | −3 % à −14 % | Marché à **90,00 $** pour 100 $ de valeur faciale, coût 87,42 $. Le prélèvement (6 à 15 %) mange la marge de 2,6 $. |
| **Amazon 10 / 50 $** | −1 % à −8 % | Marge brute de 2 à 9 % seulement, inférieure au prélèvement dans tous les scénarios sauf la cible. |
| **Steam 10 / 50 $** | −1 % à −10 % | Le marché Steam est aligné sur la valeur faciale (50 $ vendu 50,00–54,45 $) pour les petits montants : aucune place pour un revendeur. |
| **Google Play 25 $** | +4 % à +8 % | Rentable **si** le coût réel est bien ≈ 24,09 $. Ce coût est **estimé**, pas relevé : à confirmer depuis `/admin/digital` avant toute mise en ligne. |

### 4.3 Le seuil des petits montants

Sous ~15 $ de valeur faciale, le modèle est structurellement perdant sur G2G : la commission de
4,99 % représente 0,50 $ sur une carte à 10 $, et les frais fixes de retrait 1,99 $ — soit
**près de 25 % du prix**. Même PSN 10 $, la meilleure des petites lignes, ne dégage que
**+0,27 $** en réaliste et tombe à **−0,20 $** si la promo s'arrête. Une vente de 10 $ ne finance
pas deux dollars de frais fixes.

---

## 5. Recommandation pour `G2G_FEE_PERCENT`

### Valeur à déployer : `12`

```env
G2G_FEE_PERCENT=12
```

Justification :

1. **Couvre 3 des 4 scénarios** (10,73 / 10,23 / 6,05 %) avec une marge de sécurité de 1,3 à 6 points.
2. **Ne surestime jamais la marge** : le moteur (`src/lib/g2g-fulfilment-core.ts`) refuse une offre
   quand `marge < min_margin_percent`. Surestimer les frais fait refuser des ventes marginales —
   sans danger. Les sous-estimer ferait acheter à perte.
3. **Le seul scénario qu'il ne couvre pas** (14,98 %, fin de promo) n'est pas un scénario nominal :
   s'il se produit, il faut **recalculer** la variable, pas la laisser à 12. C'est un point de
   surveillance, pas une raison de bloquer le lancement à 15.

### Quand descendre à `10`

Uniquement si **les trois conditions** sont réunies :

- le plafond de commande (`fazercards.maxOrderUsd`) est **≥ 50 $**, donc les frais fixes se diluent ;
- le canal de retrait **PayPal en rang Legendary** est confirmé (0,99 % + 0,99 $) ;
- au moins deux retraits réels ont montré ce taux sur le relevé.

Dans ce cas, 10 reste prudent vis-à-vis de la fourchette (6,05 % mesuré) tout en cessant de
refuser les lignes PSN. **Ne jamais descendre sous 9** : le scénario réaliste USDT est à 10,23 %,
et `min_margin_percent` vaut déjà 12 — un `G2G_FEE_PERCENT` inférieur créerait un décalage entre
les deux garde-fous.

### Ce qu'il ne faut pas faire

- **Ne pas mettre 4,99.** C'est la commission de vente seule ; elle ignore le retrait, qui pèse
  autant. C'est l'erreur la plus probable et la plus coûteuse.
- **Ne pas mettre 6.** Correspond au meilleur canal (PayPal Legendary) : irréaliste tant que le
  rang n'est pas atteint, et dangereux sur les petits paniers.
- **Ne pas chercher un pourcentage « exact » par produit.** Le code n'a qu'une variable globale ;
  la marge par produit se pilote par le **prix**, pas par le taux.

### Garde-fous complémentaires

| Réglage | Valeur recommandée | Où |
| --- | --- | --- |
| `G2G_FEE_PERCENT` | `12` | Vercel → Environment Variables |
| `min_margin_percent` | `12` (défaut actuel) | table `g2g_offer_mappings` / panneau admin |
| Plafond de commande digital | relever de 25 $ à **≥ 50 $** | `fazercards.maxOrderUsd` |
| Retrait minimum | **200 $** par lot | opérationnel — c'est ce qui dilue les 1,99 $ |

---

## 6. Périmètre et limites

- **Prix relevés** sur les pages publiques des groupes d'offres G2G le 17/11/2026. Les prix changent
  quotidiennement ; l'ordre de grandeur et les conclusions structurelles sont stables, les marges
  exactes ne le sont pas.
- **Steam 100 $ (US) n'a que 2 vendeurs** : le « 3ᵉ prix » est structurellement impossible, le calcul
  retient le dernier prix disponible (141,76 $). Un troisième vendeur ferait baisser la référence.
- **Coûts FazerCards** issus de la grille du 03/11/2026 (`docs/alignement-marche-2026-11-04.md` §4).
  Le catalogue live via `/admin/digital` fait foi ; **Google Play 25 $ (≈ 24,09 $) est une estimation**
  et doit être vérifié avant mise en ligne.
- **Exclusions assumées** : Amazon 100 $ (annonce à 15,86 $ pour 100 $ de valeur faciale — aberrante,
  écartée) et Xbox US 10/25/50/100 (aucune offre USD US exploitable relevée, catégorie dominée par
  les abonnements Game Pass et les devises locales ; à re-relever).
- **Non modélisés** : la taxe locale sur la commission, d'éventuels frais de conversion de devise
  (les offres G2G sont en USD, le coût FazerCards en USD — pas de conversion dans ce périmètre), et
  le coût d'acquisition (le temps de saisie manuelle d'une commande).
- **Mode `solo`** (une vente = un retrait) volontairement exclu des tableaux : il rendrait tout le
  catalogue négatif et ne correspond pas à une exploitation normale. Le script le calcule
  (`--json`, champ `soloTakePercent`) pour mesurer le risque d'un retrait après chaque vente.

---

## 7. Annexes — scénarios complets

Les tableaux ci-dessous sont générés par `node scripts/g2g-margin-audit.mjs` et reproduisent,
pour chaque scénario de frais, le net et la marge à la référence de marché, le prix nécessaire
pour une marge nette de 12 %, et le coût fournisseur maximal admissible.

### Pessimiste — USDT TRC20, rang Normal, lot de retrait 200 $

| Produit | Valeur | Coût FazerCards | 3 prix G2G | 3ᵉ prix | Net encaissé | Marge | % | Verdict |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Amazon Gift Card USD 10 (US) | 10,00 $ | 9,80 $ | 10,70 | 10,70 $ | 9,55 $ | **-0,25 $** | -2,59 % | ❌ perte |
| Amazon Gift Card USD 50 (US) | 50,00 $ | 49,00 $ | 53,40 · 53,50 · 54,18 | 54,18 $ | 48,37 $ | **-0,63 $** | -1,31 % | ❌ perte |
| Google Play Gift Card USD 10 (US) | 10,00 $ | 9,63 $ | 8,00 | 8,00 $ | 7,14 $ | **-2,49 $** | -34,84 % | ❌ perte |
| Google Play Gift Card USD 25 (US) | 25,00 $ | 24,09 $ | 27,56 · 27,99 · 28,00 | 28,00 $ | 25,00 $ | **+0,91 $** | +3,63 % | ⚠️ faible |
| PSN Gift Card USD 10 (US) | 10,00 $ | 8,62 $ | 9,84 · 9,85 · 9,90 | 9,90 $ | 8,84 $ | **+0,22 $** | +2,47 % | ⚠️ faible |
| PSN Gift Card USD 25 (US) | 25,00 $ | 21,81 $ | 24,73 · 24,74 · 24,92 | 24,92 $ | 22,25 $ | **+0,44 $** | +1,96 % | ⚠️ faible |
| PSN Gift Card USD 50 (US) | 50,00 $ | 42,63 $ | 49,19 · 49,20 · 50,40 | 50,40 $ | 44,99 $ | **+2,36 $** | +5,25 % | ✅ |
| PSN Gift Card USD 100 (US) | 100,00 $ | 87,42 $ | 90,00 | 90,00 $ | 80,35 $ | **-7,07 $** | -8,80 % | ❌ perte |
| Robux 800 (Global) | 9,99 $ | 8,15 $ | 4,66 · 4,77 · 4,79 | 4,79 $ | 4,28 $ | **-3,87 $** | -90,59 % | ❌ perte |
| Robux 1 700 (Global) | 19,99 $ | 17,15 $ | 9,96 · 10,00 · 10,14 | 10,14 $ | 9,05 $ | **-8,10 $** | -89,45 % | ❌ perte |
| Robux 4 500 (Global) | 49,99 $ | 41,35 $ | 23,55 · 26,84 · 26,99 | 26,99 $ | 24,10 $ | **-17,25 $** | -71,61 % | ❌ perte |
| Steam Wallet Code USD 10 (US) | 10,00 $ | 10,01 $ | 10,72 | 10,72 $ | 9,57 $ | **-0,44 $** | -4,60 % | ❌ perte |
| Steam Wallet Code USD 50 (US) | 50,00 $ | 49,25 $ | 50,00 · 50,69 · 54,45 | 54,45 $ | 48,61 $ | **-0,64 $** | -1,32 % | ❌ perte |
| Steam Wallet Code USD 100 (US) | 100,00 $ | 98,98 $ | 141,75 · 141,76 | 141,76 $ | 126,55 $ | **+27,57 $** | +21,79 % | ✅ |

#### Prix conseillé (marge nette ≥ 12 %, 1 % sous le 3ᵉ vendeur)

| Produit | Prix conseillé | Sous le 3ᵉ vendeur ? | Coût max à 12 % | `G2G_FEE_PERCENT` équivalent |
| --- | ---: | :---: | ---: | ---: |
| Amazon Gift Card USD 10 (US) | **12,47 $** | NON — hors marché | 8,41 $ | 10,73 % |
| Amazon Gift Card USD 50 (US) | **62,37 $** | NON — hors marché | 42,56 $ | 10,73 % |
| Google Play Gift Card USD 10 (US) | **12,26 $** | NON — hors marché | 6,28 $ | 10,73 % |
| Google Play Gift Card USD 25 (US) | **30,66 $** | NON — hors marché | 22,00 $ | 10,73 % |
| PSN Gift Card USD 10 (US) | **10,97 $** | NON — hors marché | 7,78 $ | 10,73 % |
| PSN Gift Card USD 25 (US) | **27,76 $** | NON — hors marché | 19,58 $ | 10,73 % |
| PSN Gift Card USD 50 (US) | **54,26 $** | NON — hors marché | 39,59 $ | 10,73 % |
| PSN Gift Card USD 100 (US) | **111,28 $** | NON — hors marché | 70,71 $ | 10,73 % |
| Robux 800 (Global) | **10,37 $** | NON — hors marché | 3,76 $ | 10,73 % |
| Robux 1 700 (Global) | **21,83 $** | NON — hors marché | 7,97 $ | 10,73 % |
| Robux 4 500 (Global) | **52,63 $** | NON — hors marché | 21,20 $ | 10,73 % |
| Steam Wallet Code USD 10 (US) | **12,74 $** | NON — hors marché | 8,42 $ | 10,73 % |
| Steam Wallet Code USD 50 (US) | **62,69 $** | NON — hors marché | 42,78 $ | 10,73 % |
| Steam Wallet Code USD 100 (US) | **140,34 $** | oui | 111,37 $ | 10,73 % |

**`G2G_FEE_PERCENT` équivalent pour ce scénario : 11,00 %**
(fourchette 10,73 % – 10,73 %, arrondie au demi-point supérieur).

---

### Réaliste — USDT TRC20, rang Normal, lot de retrait 400 $

| Produit | Valeur | Coût FazerCards | 3 prix G2G | 3ᵉ prix | Net encaissé | Marge | % | Verdict |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Amazon Gift Card USD 10 (US) | 10,00 $ | 9,80 $ | 10,70 | 10,70 $ | 9,61 $ | **-0,19 $** | -2,02 % | ❌ perte |
| Amazon Gift Card USD 50 (US) | 50,00 $ | 49,00 $ | 53,40 · 53,50 · 54,18 | 54,18 $ | 48,64 $ | **-0,36 $** | -0,74 % | ❌ perte |
| Google Play Gift Card USD 10 (US) | 10,00 $ | 9,63 $ | 8,00 | 8,00 $ | 7,18 $ | **-2,45 $** | -34,09 % | ❌ perte |
| Google Play Gift Card USD 25 (US) | 25,00 $ | 24,09 $ | 27,56 · 27,99 · 28,00 | 28,00 $ | 25,14 $ | **+1,05 $** | +4,16 % | ⚠️ faible |
| PSN Gift Card USD 10 (US) | 10,00 $ | 8,62 $ | 9,84 · 9,85 · 9,90 | 9,90 $ | 8,89 $ | **+0,27 $** | +3,01 % | ⚠️ faible |
| PSN Gift Card USD 25 (US) | 25,00 $ | 21,81 $ | 24,73 · 24,74 · 24,92 | 24,92 $ | 22,37 $ | **+0,56 $** | +2,51 % | ⚠️ faible |
| PSN Gift Card USD 50 (US) | 50,00 $ | 42,63 $ | 49,19 · 49,20 · 50,40 | 50,40 $ | 45,24 $ | **+2,61 $** | +5,78 % | ✅ |
| PSN Gift Card USD 100 (US) | 100,00 $ | 87,42 $ | 90,00 | 90,00 $ | 80,79 $ | **-6,63 $** | -8,20 % | ❌ perte |
| Robux 800 (Global) | 9,99 $ | 8,15 $ | 4,66 · 4,77 · 4,79 | 4,79 $ | 4,30 $ | **-3,85 $** | -89,53 % | ❌ perte |
| Robux 1 700 (Global) | 19,99 $ | 17,15 $ | 9,96 · 10,00 · 10,14 | 10,14 $ | 9,10 $ | **-8,05 $** | -88,40 % | ❌ perte |
| Robux 4 500 (Global) | 49,99 $ | 41,35 $ | 23,55 · 26,84 · 26,99 | 26,99 $ | 24,23 $ | **-17,12 $** | -70,66 % | ❌ perte |
| Steam Wallet Code USD 10 (US) | 10,00 $ | 10,01 $ | 10,72 | 10,72 $ | 9,62 $ | **-0,39 $** | -4,02 % | ❌ perte |
| Steam Wallet Code USD 50 (US) | 50,00 $ | 49,25 $ | 50,00 · 50,69 · 54,45 | 54,45 $ | 48,88 $ | **-0,37 $** | -0,76 % | ❌ perte |
| Steam Wallet Code USD 100 (US) | 100,00 $ | 98,98 $ | 141,75 · 141,76 | 141,76 $ | 127,26 $ | **+28,28 $** | +22,22 % | ✅ |

#### Prix conseillé (marge nette ≥ 12 %, 1 % sous le 3ᵉ vendeur)

| Produit | Prix conseillé | Sous le 3ᵉ vendeur ? | Coût max à 12 % | `G2G_FEE_PERCENT` équivalent |
| --- | ---: | :---: | ---: | ---: |
| Amazon Gift Card USD 10 (US) | **12,41 $** | NON — hors marché | 8,45 $ | 10,23 % |
| Amazon Gift Card USD 50 (US) | **62,03 $** | NON — hors marché | 42,80 $ | 10,23 % |
| Google Play Gift Card USD 10 (US) | **12,19 $** | NON — hors marché | 6,32 $ | 10,23 % |
| Google Play Gift Card USD 25 (US) | **30,49 $** | NON — hors marché | 22,12 $ | 10,23 % |
| PSN Gift Card USD 10 (US) | **10,91 $** | NON — hors marché | 7,82 $ | 10,23 % |
| PSN Gift Card USD 25 (US) | **27,61 $** | NON — hors marché | 19,69 $ | 10,23 % |
| PSN Gift Card USD 50 (US) | **53,96 $** | NON — hors marché | 39,82 $ | 10,23 % |
| PSN Gift Card USD 100 (US) | **110,66 $** | NON — hors marché | 71,10 $ | 10,23 % |
| Robux 800 (Global) | **10,32 $** | NON — hors marché | 3,78 $ | 10,23 % |
| Robux 1 700 (Global) | **21,71 $** | NON — hors marché | 8,01 $ | 10,23 % |
| Robux 4 500 (Global) | **52,34 $** | NON — hors marché | 21,32 $ | 10,23 % |
| Steam Wallet Code USD 10 (US) | **12,67 $** | NON — hors marché | 8,47 $ | 10,23 % |
| Steam Wallet Code USD 50 (US) | **62,34 $** | NON — hors marché | 43,01 $ | 10,23 % |
| Steam Wallet Code USD 100 (US) | **140,34 $** | oui | 111,99 $ | 10,23 % |

**`G2G_FEE_PERCENT` équivalent pour ce scénario : 10,50 %**
(fourchette 10,23 % – 10,23 %, arrondie au demi-point supérieur).

---

### Cible — PayPal USD, rang Legendary, lot de retrait 800 $

| Produit | Valeur | Coût FazerCards | 3 prix G2G | 3ᵉ prix | Net encaissé | Marge | % | Verdict |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Amazon Gift Card USD 10 (US) | 10,00 $ | 9,80 $ | 10,70 | 10,70 $ | 10,05 $ | **+0,25 $** | +2,51 % | ⚠️ faible |
| Amazon Gift Card USD 50 (US) | 50,00 $ | 49,00 $ | 53,40 · 53,50 · 54,18 | 54,18 $ | 50,90 $ | **+1,90 $** | +3,73 % | ⚠️ faible |
| Google Play Gift Card USD 10 (US) | 10,00 $ | 9,63 $ | 8,00 | 8,00 $ | 7,52 $ | **-2,11 $** | -28,13 % | ❌ perte |
| Google Play Gift Card USD 25 (US) | 25,00 $ | 24,09 $ | 27,56 · 27,99 · 28,00 | 28,00 $ | 26,30 $ | **+2,21 $** | +8,42 % | ✅ |
| PSN Gift Card USD 10 (US) | 10,00 $ | 8,62 $ | 9,84 · 9,85 · 9,90 | 9,90 $ | 9,30 $ | **+0,68 $** | +7,32 % | ✅ |
| PSN Gift Card USD 25 (US) | 25,00 $ | 21,81 $ | 24,73 · 24,74 · 24,92 | 24,92 $ | 23,41 $ | **+1,60 $** | +6,84 % | ✅ |
| PSN Gift Card USD 50 (US) | 50,00 $ | 42,63 $ | 49,19 · 49,20 · 50,40 | 50,40 $ | 47,35 $ | **+4,72 $** | +9,97 % | ✅ |
| PSN Gift Card USD 100 (US) | 100,00 $ | 87,42 $ | 90,00 | 90,00 $ | 84,55 $ | **-2,87 $** | -3,39 % | ❌ perte |
| Robux 800 (Global) | 9,99 $ | 8,15 $ | 4,66 · 4,77 · 4,79 | 4,79 $ | 4,50 $ | **-3,65 $** | -81,11 % | ❌ perte |
| Robux 1 700 (Global) | 19,99 $ | 17,15 $ | 9,96 · 10,00 · 10,14 | 10,14 $ | 9,53 $ | **-7,62 $** | -80,03 % | ❌ perte |
| Robux 4 500 (Global) | 49,99 $ | 41,35 $ | 23,55 · 26,84 · 26,99 | 26,99 $ | 25,36 $ | **-15,99 $** | -63,08 % | ❌ perte |
| Steam Wallet Code USD 10 (US) | 10,00 $ | 10,01 $ | 10,72 | 10,72 $ | 10,07 $ | **+0,06 $** | +0,61 % | ⚠️ faible |
| Steam Wallet Code USD 50 (US) | 50,00 $ | 49,25 $ | 50,00 · 50,69 · 54,45 | 54,45 $ | 51,15 $ | **+1,90 $** | +3,72 % | ⚠️ faible |
| Steam Wallet Code USD 100 (US) | 100,00 $ | 98,98 $ | 141,75 · 141,76 | 141,76 $ | 133,18 $ | **+34,20 $** | +25,68 % | ✅ |

#### Prix conseillé (marge nette ≥ 12 %, 1 % sous le 3ᵉ vendeur)

| Produit | Prix conseillé | Sous le 3ᵉ vendeur ? | Coût max à 12 % | `G2G_FEE_PERCENT` équivalent |
| --- | ---: | :---: | ---: | ---: |
| Amazon Gift Card USD 10 (US) | **11,85 $** | NON — hors marché | 8,85 $ | 6,05 % |
| Amazon Gift Card USD 50 (US) | **59,27 $** | NON — hors marché | 44,79 $ | 6,05 % |
| Google Play Gift Card USD 10 (US) | **11,65 $** | NON — hors marché | 6,61 $ | 6,05 % |
| Google Play Gift Card USD 25 (US) | **29,14 $** | NON — hors marché | 23,15 $ | 6,05 % |
| PSN Gift Card USD 10 (US) | **10,43 $** | NON — hors marché | 8,18 $ | 6,05 % |
| PSN Gift Card USD 25 (US) | **26,38 $** | NON — hors marché | 20,60 $ | 6,05 % |
| PSN Gift Card USD 50 (US) | **51,57 $** | NON — hors marché | 41,67 $ | 6,05 % |
| PSN Gift Card USD 100 (US) | **105,74 $** | NON — hors marché | 74,40 $ | 6,05 % |
| Robux 800 (Global) | **9,86 $** | NON — hors marché | 3,96 $ | 6,05 % |
| Robux 1 700 (Global) | **20,74 $** | NON — hors marché | 8,38 $ | 6,05 % |
| Robux 4 500 (Global) | **50,02 $** | NON — hors marché | 22,31 $ | 6,05 % |
| Steam Wallet Code USD 10 (US) | **12,11 $** | NON — hors marché | 8,86 $ | 6,05 % |
| Steam Wallet Code USD 50 (US) | **59,57 $** | NON — hors marché | 45,01 $ | 6,05 % |
| Steam Wallet Code USD 100 (US) | **140,34 $** | oui | 117,20 $ | 6,05 % |

**`G2G_FEE_PERCENT` équivalent pour ce scénario : 6,50 %**
(fourchette 6,05 % – 6,05 %, arrondie au demi-point supérieur).

---

### Risque — fin de la promo 4,99 % (retour au tarif « Other Service » rang Normal), lot de 400 $

| Produit | Valeur | Coût FazerCards | 3 prix G2G | 3ᵉ prix | Net encaissé | Marge | % | Verdict |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Amazon Gift Card USD 10 (US) | 10,00 $ | 9,80 $ | 10,70 | 10,70 $ | 9,10 $ | **-0,70 $** | -7,72 % | ❌ perte |
| Amazon Gift Card USD 50 (US) | 50,00 $ | 49,00 $ | 53,40 · 53,50 · 54,18 | 54,18 $ | 46,06 $ | **-2,94 $** | -6,37 % | ❌ perte |
| Google Play Gift Card USD 10 (US) | 10,00 $ | 9,63 $ | 8,00 | 8,00 $ | 6,80 $ | **-2,83 $** | -41,58 % | ❌ perte |
| Google Play Gift Card USD 25 (US) | 25,00 $ | 24,09 $ | 27,56 · 27,99 · 28,00 | 28,00 $ | 23,81 $ | **-0,28 $** | -1,19 % | ❌ perte |
| PSN Gift Card USD 10 (US) | 10,00 $ | 8,62 $ | 9,84 · 9,85 · 9,90 | 9,90 $ | 8,42 $ | **-0,20 $** | -2,41 % | ❌ perte |
| PSN Gift Card USD 25 (US) | 25,00 $ | 21,81 $ | 24,73 · 24,74 · 24,92 | 24,92 $ | 21,19 $ | **-0,62 $** | -2,94 % | ❌ perte |
| PSN Gift Card USD 50 (US) | 50,00 $ | 42,63 $ | 49,19 · 49,20 · 50,40 | 50,40 $ | 42,85 $ | **+0,22 $** | +0,51 % | ⚠️ faible |
| PSN Gift Card USD 100 (US) | 100,00 $ | 87,42 $ | 90,00 | 90,00 $ | 76,52 $ | **-10,90 $** | -14,25 % | ❌ perte |
| Robux 800 (Global) | 9,99 $ | 8,15 $ | 4,66 · 4,77 · 4,79 | 4,79 $ | 4,07 $ | **-4,08 $** | -100,12 % | ❌ perte |
| Robux 1 700 (Global) | 19,99 $ | 17,15 $ | 9,96 · 10,00 · 10,14 | 10,14 $ | 8,62 $ | **-8,53 $** | -98,93 % | ❌ perte |
| Robux 4 500 (Global) | 49,99 $ | 41,35 $ | 23,55 · 26,84 · 26,99 | 26,99 $ | 22,95 $ | **-18,40 $** | -80,20 % | ❌ perte |
| Steam Wallet Code USD 10 (US) | 10,00 $ | 10,01 $ | 10,72 | 10,72 $ | 9,11 $ | **-0,90 $** | -9,83 % | ❌ perte |
| Steam Wallet Code USD 50 (US) | 50,00 $ | 49,25 $ | 50,00 · 50,69 · 54,45 | 54,45 $ | 46,29 $ | **-2,96 $** | -6,39 % | ❌ perte |
| Steam Wallet Code USD 100 (US) | 100,00 $ | 98,98 $ | 141,75 · 141,76 | 141,76 $ | 120,53 $ | **+21,55 $** | +17,88 % | ✅ |

#### Prix conseillé (marge nette ≥ 12 %, 1 % sous le 3ᵉ vendeur)

| Produit | Prix conseillé | Sous le 3ᵉ vendeur ? | Coût max à 12 % | `G2G_FEE_PERCENT` équivalent |
| --- | ---: | :---: | ---: | ---: |
| Amazon Gift Card USD 10 (US) | **13,10 $** | NON — hors marché | 8,01 $ | 14,98 % |
| Amazon Gift Card USD 50 (US) | **65,49 $** | NON — hors marché | 40,54 $ | 14,98 % |
| Google Play Gift Card USD 10 (US) | **12,87 $** | NON — hors marché | 5,99 $ | 14,98 % |
| Google Play Gift Card USD 25 (US) | **32,20 $** | NON — hors marché | 20,95 $ | 14,98 % |
| PSN Gift Card USD 10 (US) | **11,52 $** | NON — hors marché | 7,41 $ | 14,98 % |
| PSN Gift Card USD 25 (US) | **29,15 $** | NON — hors marché | 18,64 $ | 14,98 % |
| PSN Gift Card USD 50 (US) | **56,98 $** | NON — hors marché | 37,71 $ | 14,98 % |
| PSN Gift Card USD 100 (US) | **116,84 $** | NON — hors marché | 67,34 $ | 14,98 % |
| Robux 800 (Global) | **10,89 $** | NON — hors marché | 3,58 $ | 14,98 % |
| Robux 1 700 (Global) | **22,92 $** | NON — hors marché | 7,59 $ | 14,98 % |
| Robux 4 500 (Global) | **55,27 $** | NON — hors marché | 20,19 $ | 14,98 % |
| Steam Wallet Code USD 10 (US) | **13,38 $** | NON — hors marché | 8,02 $ | 14,98 % |
| Steam Wallet Code USD 50 (US) | **65,83 $** | NON — hors marché | 40,74 $ | 14,98 % |
| Steam Wallet Code USD 100 (US) | **140,34 $** | oui | 106,06 $ | 14,98 % |

**`G2G_FEE_PERCENT` équivalent pour ce scénario : 15,00 %**
(fourchette 14,98 % – 14,98 %, arrondie au demi-point supérieur).
