# Audit prix & concurrence — Nukhba

- **Date :** 4 novembre 2026
- **Périmètre :** offres web (forfaits, services à la carte, abonnements, maintenance) **et** boutique codes & cartes cadeaux (`/codes`)
- **Devise de référence :** USD (celle facturée par NOWPayments). **Taux de contrôle :** officiel **6,42 LYD/USD**, parallèle **9,90 LYD/USD** (relevés du 1er au 3 novembre 2026)
- **Nature :** audit en lecture seule — aucun prix n'a été modifié dans le code ni en base.
- **Convention :** « réel LYD » = conversion au taux parallèle (ce que le client paie effectivement pour obtenir des dollars/USDT) ; « affiché LYD » = conversion produite par le site (`siteConfig.currency.rates.LYD`).

---

## 0. Synthèse (60 secondes)

**Trois forces**

1. En **export** (Égypte, Golfe, Europe), les forfaits sont **3 à 10 fois sous le marché** : 360 $ tout compris pour 5 pages, là où une agence standard facture 850–2 300 $ (Égypte) et 1 630–4 085 $ (Émirats).
2. La **boutique codes** achète nettement sous la valeur faciale sur PlayStation (−13 %), Xbox (−16 %), Robux (−17 %), Google Play (−3,6 %) : il y a de la marge disponible, elle n'est simplement pas captée.
3. Le discours « un paiement, propriété des fichiers, SEO dès la conception » est un vrai différenciateur face aux abonnements DIY (Wix 17–39 $/mois, soit 612–1 404 $ sur 3 ans).

**Trois failles majeures**

1. **Le taux LYD du site est faux d'un facteur ~2.** `LYD: 4.83` (`src/lib/config.ts:68`, `src/lib/currency.ts:137`) alors que le parallèle est à **9,90** et l'officiel à 6,42. Tout prix affiché en dinar est sous-estimé de ~51 %. Un forfait à 360 $ s'affiche **1 739 LYD** alors qu'il coûte **3 564 LYD** réels.
2. **Une partie du catalogue est vendue à perte.** Steam, Google Play, Amazon et le petit pack Robux sont sous le barème de marge maison (`src/lib/fazercards-pricing.ts:58`) : marge nette **négative** après frais de passerelle, jusqu'à −1,09 $ sur une carte Steam 100 $.
3. **La grille de prix est inversée par rapport aux coûts.** Nukhba est la moins chère du marché là où le grossiste laisse le moins de marge (Steam, +1 à +2 % de coût) et la plus chère là où il en laisse le plus (PSN 50 $, facturé 50,50 $ contre 48,20 $ chez Eneba, avec un coût de 42,63 $).

**Verdict.** Le problème n'est pas le niveau général des prix, qui est cohérent ; c'est **la cohérence interne** (taux de change, marges, plafonds, prix affiché vs prix payable) et **l'architecture** (quel produit porte la marge, quel produit porte l'acquisition). Corriger ces quatre points vaut environ **+10 % de revenu sur les projets**, **+6 700 $ d'ARR** sur les abonnements et **+32 % de marge nette** sur la boutique, sans augmenter le prix perçu par le client.

**Cinq actions, dans cet ordre**

| # | Action | Effort | Gain estimé |
|---|---|---|---|
| 1 | Corriger `LYD` à 9,90 (et le rendre éditable avec date de relevé) | 5 min | Supprime un risque de réclamation sur 100 % des prix en dinar |
| 2 | Aligner les plafonds de caisse sur la grille (25 $ / 50 $ vs cartes à 50,50 $) | 1 h | Rend achetables les 4 cartes les plus rentables |
| 3 | Repricer Steam / Google Play / Amazon / Robux au-dessus du point mort | 2 h | +32 % de marge nette à volume constant |
| 4 | Afficher le prix **payable** (360 / 612 / 1 056 $) au lieu de 300 $ + 20 % | 2 h | Supprime la friction « +20 % au checkout » |
| 5 | Réaligner abonnements & maintenance (19 → 29 $/mois, annuel ≈ 10 mois) | 1 j | +6 700 $ d'ARR à 45 abonnés |

---

## 1. Méthode, hypothèses et limites

**Sources internes** (valeurs par défaut du code, avant surcharge admin) :
`src/lib/config.ts` (forfaits, à la carte, devises, plafond boutique), `src/lib/subscription-plans.ts`, `src/lib/content.ts` (FAQ maintenance), `src/lib/digital-seed.ts` (catalogue), `src/lib/fazercards-pricing.ts` (barème), `src/lib/digital-sales-policy.ts` (plafonds), `src/lib/comparisons.ts` (prix concurrents publiés sur `/compare`).

**Sources externes** (relevées le 3–4 novembre 2026) : pages publiques des agences libyennes, égyptiennes et émiriennes ; Wix / Squarespace / Shopify ; Eneba, G2A, PlatPrices ; grille grossiste FazerCards (Steam, PSN, Xbox, Google Play, Amazon, Robux, région US, tarifs « from ») ; prix officiels Roblox et Spotify ; taux de change du dinar (Banque centrale + marché parallèle).

**Hypothèse de coût de transaction** utilisée pour la « marge nette » boutique : **1,5 % NOWPayments + 1,00 $ de frais fixes** (réseau + retrait). C'est l'hypothèse défavorable ; avec 0,40 $ de frais fixes, toutes les marges remontent d'environ 0,6 $. Le seuil de rentabilité de chaque référence est donc à lire comme un **plancher**.

**Limites**

- Les prix en base peuvent avoir été modifiés via `/admin` : l'audit porte sur les valeurs du code (catalogue par défaut) et sur les règles de calcul.
- Les tarifs grossiste sont des prix « from » indicatifs : le prix réel dépend du plan et du stock, et peut être meilleur (remise de plan) ou moins bon.
- Les prix concurrents sont ceux **publiés** ; les remises négociées ne sont pas observables.
- Aucune donnée de vente réelle (volumes, panier moyen) n'a été utilisée : les simulations sont des scénarios à structure de mix explicite, pas des prévisions.

---

## 2. Ce que Nukhba vend aujourd'hui

### 2.1 Forfaits (paiement unique)

| Formule | Prix modèle | Personnalisation (20 %) | **Total payable** | Affiché LYD (×4,83) | **Réel LYD (×9,90)** | Délai |
|---|---|---|---|---|---|---|
| Vitrine | 300 $ | 60 $ | **360 $** | 1 739 د.ل | **3 564 د.ل** | 7 j |
| Vitrine+ (mise en avant) | 510 $ | 102 $ | **612 $** | 2 956 د.ل | **6 059 د.ل** | 10 j |
| Boutique / Réservation | 880 $ | 176 $ | **1 056 $** | 5 100 د.ل | **10 454 د.ل** | 14–21 j |

Source : `src/lib/config.ts:112-190` (prix) et `:114`, `:146`, `:182` (20 %). Hébergement 1re année inclus, domaine (~12 $/an) au nom du client (`src/lib/content.ts:393`).

### 2.2 Services à la carte (« à partir de »)

| Service | Prix | Lecture |
|---|---|---|
| Réglage / correction | 15 $ | Prix d'appel, très bas |
| Ajout d'une section | 19 $ | Cohérent |
| Slides / pitch deck | 29 $ | Cohérent |
| Identité visuelle | 39 $ | **Bas** (logo + charte + templates) |
| Refonte de site | 49 $ | **Très bas** face à un projet complet |
| Landing page | 59 $ | Bas |

Source : `src/lib/config.ts:277-338`.

### 2.3 Récurrent

| Offre | Mensuel | Annuel | Incohérence |
|---|---|---|---|
| Maintenance (FAQ) | **19 $/mois** | — | Plus cher que l'abonnement complet Vitrine (10 $/mois) |
| Abonnement Vitrine | 10 $ | 69 $ | Annuel = 6,9 mois → remise 42 % |
| Abonnement Vitrine+ | 12 $ | 89 $ | Annuel = 7,4 mois → remise 38 % |
| Abonnement Boutique | 25 $ | 199 $ | Annuel = 8 mois → remise 34 % |

Sources : `src/lib/subscription-plans.ts:42-57`, `src/lib/content.ts:424`.
Deux logiques se contredisent : un client qui paie **19 $/mois pour de la maintenance seule** paierait **10 $/mois** pour le site entier en abonnement.

### 2.4 Boutique codes & cartes (extraits)

| Produit | Montants | Prix (USD) | Statut catalogue |
|---|---|---|---|
| Steam Wallet | 5 / 10 / 25 / 50 / 100 $ | 5,40 / 10,60 / 25,90 / 50,50 / 100,40 | 5–10 $ achetables ; au-delà, bloqué par le plafond (cf. C-3) |
| PlayStation Store US | 10 / 25 / 50 $ | 10,80 / 25,90 / **50,50** | 10 $ seulement sous le plafond de caisse |
| Xbox | 10 / 25 / 50 / 100 $ | 10,80 / 25,90 / **50,50** / 100,40 | idem ; le 100 $ est en plus masqué (> 100 $) |
| Google Play US | 10 / 25 / 50 / 100 $ | 10,70 / 25,80 / 50,50 / 100,40 | idem |
| Amazon US | 10 / 25 / 50 / 100 $ | 10,60 / 25,70 / 50,40 / 100,40 | idem |
| Robux | 400 / 800 / 1 700 / 4 500 | 4,90 / 9,80 / 19,90 / 49,90 | Achetables |
| Spotify Premium | 3 / 6 / 12 mois | 17,90 / 32,90 / 59,90 | À vérifier (cf. M-4) |

Source : `src/lib/digital-seed.ts:51-266`.
**À retenir :** dès qu'une carte dépasse **25 $**, le défaut de configuration la rend non achetable (cf. C-3).

---

## 3. Benchmarks — trois arènes, trois logiques

> Conversions : 1 USD = 9,90 LYD (parallèle). Certaines agences libyennes affichent des conversions implicites à 5–6 LYD/USD ; à ce taux, leurs prix en dollars paraissent plus élevés. Les deux lectures sont indiquées quand elles changent la conclusion.

### 3.1 Arène 1 — Libye (le marché où se joue la conversion locale)

| Concurrent | Offre | Prix publié | ≈ USD | Concurrent vs Nukhba |
|---|---|---|---|---|
| **IP Libya** | Design site | dès 500 د.ل | 51 $ | −86 % |
| IP Libya | Site vitrine (FAQ) | dès 1 200 د.ل | 121 $ | **−66 %** |
| IP Libya | Boutique en ligne | dès 3 500 د.ل | 354 $ | −66 % (vs Boutique 1 056 $) |
| IP Libya | Gestion de site | 400 د.ل/mois | 40 $ | vs maintenance 19 $ +110 % |
| IP Libya | SEO | 700 د.ل/mois | 71 $ | — |
| IP Libya | Hébergement | 250 د.ل/an | 25 $ | inclus 1re année chez Nukhba |
| **Abdu Tech** | Pack Essentiel (1 page, domaine, e-mails, hébergement) | 1 500 د.ل | 152 $ | −58 % |
| Abdu Tech | Pack Business (multi-pages + back-office) | 4 000 د.ل | 404 $ | −62 % (vs Boutique) |
| **Maksab** | Moyenne marché — e-commerce (agence) | 3 150 د.ل | 318 $ | −70 % |
| **Evyx** | Boutique WooCommerce simple | dès 4 000 د.ل | 404 $ | −62 % |
| Evyx | Boutique avancée | jusqu'à 20 000 د.ل | 2 020 $ | +91 % |
| **ShoPlus / JoShop** | SaaS boutique (dinar + Sadad) | 99–200 $/an | 99–200 $/an | vs abonnement 199 $/an |
| **OpenSooq** (freelances) | Site + identité | 100–250 د.ل | 10–25 $ | −93 % |

**Lecture.** Sur le marché libyen, Nukhba est **2,4 à 3 fois plus chère** que l'offre vitrine locale (3 564 vs 1 200–1 500 د.ل) et **2 à 3 fois plus chère** que l'offre boutique (10 454 vs 3 500–5 000 د.ل). Ce n'est pas nécessairement une erreur — le livrable est différent (Next.js, bilingue, Lighthouse 90+, fichiers remis) — mais **aucune offre d'entrée n'existe sous 360 $**, ce qui laisse tout le bas de marché aux concurrents. Le SaaS local (99–200 $/an, paiement en dinar) est, lui, un concurrent direct de l'abonnement annuel à 69–199 $.

### 3.2 Arène 2 — MENA / export (la marge réelle)

| Marché | Site vitrine 5–10 pages | Vitrine 360 $ vs eux* |
|---|---|---|
| Égypte — agence publiée (Web Pioneer) | 90–450 $ | **−75 % à +25 %** (le prix tombe dans leur fourchette) |
| Égypte — agence corporate | 270–910 $ | −60 % à +33 % |
| Égypte — agence « top » (Intrazero) | 2 000–5 000 $ | **−82 % à −93 %** |
| Égypte — e-commerce | 360–2 000 $ (publié) / 5 000–25 000 $ (agence) | 0 % à −96 % |
| Émirats — site standard | 1 630–4 085 $ | −78 % à −91 % |
| Émirats — site sur mesure | 4 085–12 255 $ | −91 % à −97 % |
| Émirats — e-commerce / plateforme | 16 340 $+ | −98 % |
| Liban — freelance / petite agence | 500–1 500 $ / 2 000–5 000 $ | −28 % à −93 % |
| France — freelance / agence (5 pages) | ≈ 1 100–3 300 $ | −67 % à −89 % |
| Égypte — SEO (référence) | ≈ 290 $/mois | vs claim « 1 000 $+/mois » |
| Liban / Golfe — SEO | 700–2 000 $/mois | — |

\* Signe négatif = Nukhba moins cher ; signe positif = Nukhba plus cher.

**Lecture.** À l'export, Nukhba est **la solution la moins chère** de l'échantillon hors freelances low-cost. C'est une position d'acquisition excellente et un **manque à gagner** : il n'y a aucune raison de vendre 360 $ un livrable qu'une agence du Caire facture 850–2 300 $ et une agence de Dubaï 1 630–4 085 $. La contrainte n'est pas le prix mais la preuve (portfolio, témoignages, contrat) et l'accès au paiement.

### 3.3 Arène 3 — DIY & freelances (le vrai comparatif du client pressé)

| Option | Coût | Sur 3 ans | Prix d'entrée vs Nukhba |
|---|---|---|---|
| Wix (Light / Core / Business) | 17 / 29 / 39 $/mois | 612 / 1 044 / 1 404 $ | 360 $ une fois |
| Squarespace (Basic → Advanced) | 16–49 $/mois | 576–1 764 $ | idem |
| Shopify (Basic) | 29–39 $/mois | 1 044–1 404 $ | idem |
| WordPress.com (Personal) | 4 $/mois | 144 $ | Moins cher, mais non maintenu |
| Freelance (Égypte, publié) | 90–450 $ | — | Comparable |
| Freelance (Libye, OpenSooq) | 10–25 $ | — | 14–36× moins cher |
| Template prêt (revendiqué par Nukhba) | 100–150 $ | — | −58 % à −72 % |

**Lecture.** L'argument « un paiement au lieu d'un abonnement » est solide et **chiffrable** : 360 $ contre 612–1 404 $ sur trois ans. En revanche, le comparatif `/compare` annonce Wix à « 20–50 $/mois » alors que la grille vérifiée est **17–39 $** (Wix) et **16–49 $** (Squarespace) : la fourchette doit être actualisée, sinon la comparaison est attaquable.

### 3.4 Le point qui fausse toutes les comparaisons en dinar

| | Vitrine | Vitrine+ | Boutique |
|---|---|---|---|
| Prix payable | 360 $ | 612 $ | 1 056 $ |
| **Affiché par le site** (×4,83) | 1 739 د.ل | 2 956 د.ل | 5 100 د.ل |
| **Coût réel** (×9,90) | 3 564 د.ل | 6 059 د.ل | 10 454 د.ل |
| Écart | **+105 %** | **+105 %** | **+105 %** |

Effet pervers : à 1 739 د.ل, un forfait Nukhba **paraît au niveau d'Abdu Tech (1 500 د.ل)**. Le visiteur compare, se décide… puis découvre au paiement qu'il doit acheter des USDT au taux parallèle et payer **le double en dinar**. C'est le premier facteur de perte de conversion et le premier risque de réputation de tout le site.

---

## 4. Boutique codes : coût, marge, concurrence

### 4.1 Ce que coûte réellement chaque carte (grossiste, région US)

| Famille | Coût grossiste vs prix officiel | Lecture |
|---|---|---|
| PlayStation US | **−12 % à −15 %** (50 $ → 42,63 $) | La meilleure marge du catalogue |
| Xbox US | **−13 % à −17 %** (50 $ → 41,65 $) | Idem |
| Robux | **−17 %** (4 500 → 41,35 $, vs 49,99 $ officiels) | Idem |
| Google Play US | −3,6 % (50 $ → 48,18 $) | Marge mince |
| Amazon US | −2 % (50 $ → 49,00 $) | Marge très mince |
| Steam US | **−1,5 % à +2 %** (10 $ → 10,01 $) | Quasi nul, parfois au-dessus du pair |

### 4.2 Marge réelle par référence (frais : 1,5 % + 1,00 $)

| Produit | Prix actuel | Coût | Marge brute | **Marge nette** | Prix barème* | Écart |
|---|---|---|---|---|---|---|
| Steam 5 $ | 5,40 $ | 4,92 $ | 8,9 % | **−0,60 $ (−11,1 %)** | 6,15 $ | −0,75 $ |
| Steam 10 $ | 10,60 $ | 10,01 $ | 5,6 % | **−0,57 $ (−5,4 %)** | 11,78 $ | −1,18 $ |
| Steam 25 $ | 25,90 $ | 25,43 $ | 1,8 % | **−0,92 $ (−3,5 %)** | 28,90 $ | −3,00 $ |
| Steam 50 $ | 50,50 $ | 49,25 $ | 2,5 % | **−0,51 $ (−1,0 %)** | 55,97 $ | −5,47 $ |
| Steam 100 $ | 100,40 $ | 98,98 $ | 1,4 % | **−1,09 $ (−1,1 %)** | 109,98 $ | −9,58 $ |
| PSN 10 $ US | 10,80 $ | 8,62 $ | 20,2 % | +1,02 $ (9,4 %) | 10,15 $ | +0,65 $ |
| PSN 25 $ US | 25,90 $ | 21,81 $ | 15,8 % | +2,70 $ (10,4 %) | 24,79 $ | +1,11 $ |
| PSN 50 $ US | 50,50 $ | 42,63 $ | 15,6 % | **+6,11 $ (12,1 %)** | 48,45 $ | +2,05 $ |
| Xbox 10 $ | 10,80 $ | 8,72 $ | 19,3 % | +0,92 $ (8,5 %) | 10,26 $ | +0,54 $ |
| Xbox 25 $ | 25,90 $ | 21,01 $ | 18,9 % | +3,50 $ (13,5 %) | 23,88 $ | +2,02 $ |
| Xbox 50 $ | 50,50 $ | 41,65 $ | 17,5 % | **+7,09 $ (14,0 %)** | 47,33 $ | +3,17 $ |
| Xbox 100 $ | 100,40 $ | 84,05 $ | 16,3 % | +13,84 $ (13,8 %) | 93,39 $ | +7,01 $ |
| Google Play 10 $ | 10,70 $ | 9,63 $ | 10,0 % | −0,09 $ (−0,8 %) | 11,33 $ | −0,63 $ |
| Google Play 50 $ | 50,50 $ | 48,18 $ | 4,6 % | +0,56 $ (1,1 %) | 54,75 $ | −4,25 $ |
| Google Play 100 $ | 100,40 $ | 96,35 $ | 4,0 % | +1,54 $ (1,5 %) | 107,06 $ | −6,66 $ |
| Amazon 10 $ | 10,60 $ | 9,80 $ | 7,5 % | −0,36 $ (−3,4 %) | 11,53 $ | −0,93 $ |
| Amazon 50 $ | 50,40 $ | 49,00 $ | 2,8 % | −0,36 $ (−0,7 %) | 55,69 $ | −5,29 $ |
| Amazon 100 $ | 100,40 $ | 97,99 $ | 2,4 % | −0,10 $ (−0,1 %) | 108,88 $ | −8,48 $ |
| Robux 400 | 4,90 $ | 4,75 $ | 3,1 % | **−0,92 $ (−18,8 %)** | 5,94 $ | −1,04 $ |
| Robux 800 | 9,80 $ | 8,15 $ | 16,8 % | +0,50 $ (5,1 %) | 9,59 $ | +0,21 $ |
| Robux 1 700 | 19,90 $ | 17,15 $ | 13,8 % | +1,45 $ (7,3 %) | 20,18 $ | −0,28 $ |
| Robux 4 500 | 49,90 $ | 41,35 $ | 17,1 % | +6,80 $ (13,6 %) | 46,99 $ | +2,91 $ |

\* Prix calculé par le barème maison (`src/lib/fazercards-pricing.ts:58-79`) : marge 20 % / 15 % / 12 % / 10 % par tranche de coût, avec plancher de gain.

**Trois lectures**

1. **10 références sur 22 sont sous le point mort** : toute la gamme Steam (5 à 100 $), Google Play 10 $, les trois cartes Amazon et le pack Robux 400. Le catalogue a été saisi **avant** l'instauration du barème et n'a jamais été recalculé.
2. Le barème lui-même n'est pas appliqué : sur PSN 50 $, le prix « politique » serait 48,45 $, le prix affiché est 50,50 $ (+2,05 $ de trop perçu, au détriment du volume) ; sur Steam 100 $, le prix politique serait 109,98 $ (invendable) alors qu'il est affiché 100,40 $ (vente à perte). **Le barème n'est pas tenable sur les produits où le grossiste ne laisse pas de marge** : c'est le barème qu'il faut adapter, pas seulement les prix.
3. Le **prix plancher de 1,50 $** et le plafond de commande structurent une boutique qui ne peut pas gagner d'argent sur les petits paniers : à 1 $ de frais fixes, une carte à 5 $ ne peut pas être rentable face à la valeur faciale.

### 4.3 Où se situe Nukhba face aux autres canaux

| Canal | Steam 50 $ | PSN 50 $ | Lecture |
|---|---|---|---|
| **Prix officiel** (Steam / PlayStation) | 50,00 $ | 50,00 $ | Référence |
| **Eneba** (3–4 nov. 2026) | 51,73–51,75 $ | **48,20 $** | +3,5 % / −3,6 % du pair |
| **G2A** (avec remises) | 51,39 $ | 45,93 $ (−8 %) | +2,8 % / −8,1 % |
| **Nukhba** | **50,50 $** | **50,50 $** | Le moins cher sur Steam, **le plus cher sur PSN** |
| **Rue à Tripoli** (OpenSooq, sept.–oct. 2026) | 745–950 د.ل pour 100 $ | idem | Soit **7,45–9,50 LYD par dollar** de valeur faciale, donc 373–475 د.ل pour 50 $ |

**Le paradoxe.** Nukhba est **moins chère qu'Eneba sur les grosses cartes Steam** (50 $ : −2,4 % ; 25 $ : −7 %) — la famille où sa marge nette est négative — et **4,8 % plus chère qu'Eneba sur PSN** (la famille où elle gagne 12 %). Résultat : elle attire le trafic sur le produit qui la fait perdre et repousse celui qui la ferait gagner.

**En dinar, l'écart est plus violent encore.** À 9,90, la carte PSN 50 $ de Nukhba coûte 500 د.ل, contre 373–475 د.ل chez un revendeur de rue — soit **+5 % à +34 %**. Mais le site affiche **244 د.ل** (50,50 × 4,83) : le client croit acheter deux fois moins cher qu'à la rue et découvre l'inverse au paiement.

### 4.4 Le plafond contredit la grille (à corriger avant tout repricing)

Trois règles se contredisent :

- `MAX_GIFT_CARD_PRICE_USD = 100` (`src/lib/digital-sales-policy.ts:3`) : les cartes jusqu'à 100 $ restent visibles.
- `MAX_DIGITAL_ORDER_USD = 50` (`:2`) : toute commande **au-dessus de 50 $ est refusée** (`src/lib/digital-order-core.ts:130`).
- `siteConfig.fazercards.maxOrderUsd = 25` (`src/lib/config.ts:265`) : la caisse affiche un plafond de **25 $** pour les produits FazerCards (`src/components/digital-buy-dialog.tsx:101`).

Conséquence : **Steam 50 $, PSN 50 $, Xbox 50 $, Google Play 50 $ (tous à 50,50 $) ne peuvent pas être achetés**, et au-delà de 25 $, plus rien ne passe par défaut. Les références les plus rentables du catalogue (PSN, Xbox, Steam, Google Play à 50 $ et 100 $) sont donc **techniquement invendables ou invisibles** — ce qui explique peut-être qu'elles n'aient jamais été repricées.

---

## 5. Constats classés

| ID | Sévérité | Constat | Preuve | Impact | Correction |
|---|---|---|---|---|---|
| **C-1** | Critique | Taux LYD 4,83 vs 9,90 parallèle (6,42 officiel) | `config.ts:68`, `currency.ts:137` | Tous les prix en dinar sous-estimés de 51 % : réclamations, abandon au paiement | Passer à 9,90 + afficher « taux au 04/11/2026 » |
| **C-2** | Critique | 10 références sous le point mort (Steam, Google Play 10, Amazon, Robux 400) | § 4.2 vs `fazercards-pricing.ts:58` | Perte sèche à chaque vente ; jusqu'à −1,09 $/carte | Repricer selon § 6.2 |
| **C-3** | Critique | Plafonds 25 $ / 50 $ vs cartes à 50,50 $ et 100,40 $ | `config.ts:265`, `digital-sales-policy.ts:2`, `digital-buy-dialog.tsx:101` | Les 4 cartes les plus rentables sont invendables | Plafond caisse = 120 $, plafond auto = 60 $, ou scinder les cartes > 50 $ |
| **C-4** | Critique | Prix d'appel 300 $ ≠ prix payable 360 $ (+20 %) | `config.ts:112-114` | Friction au checkout, sentiment de supplément caché | Afficher 360 $ tout compris |
| **C-5** | Majeur | Maintenance 19 $/mois > abonnement site 10 $/mois | `content.ts:424` vs `subscription-plans.ts:42` | Le client rationnel prend l'abonnement, pas la maintenance | Supprimer la ligne 19 $ ou la porter à 29 $ et aligner les abonnements |
| **C-6** | Majeur | Remises annuelles 34–42 % (annuel = 6,9–8 mois) | `subscription-plans.ts:42-57` | Sous-tarification du récurrent, cannibalise le paiement unique | Annuel = 10 mois (190 / 290 / 490 $) |
| **C-7** | Majeur | Architecture inversée : moins cher sur Steam (marge ~0), plus cher sur PSN (marge 12 %) | § 4.3 | Trafic acheté au mauvais endroit | PSN/Xbox sous Eneba, Steam à parité Eneba |
| **C-8** | Majeur | Paiement 100 % crypto : +2–3 % de coût implicite (achat d'USDT au parallèle) non affiché | modèle économique | Prix réel supérieur au prix affiché ; concurrents locaux acceptent le dinar | Afficher le prix payable ; proposer un canal local (Sadad / MobiCash / virement) avec +2,5 % assumé |
| **C-9** | Majeur | Aucune offre sous 360 $ face à un marché local à 1 200–1 500 د.ل | § 3.1 | Perte de tout le bas de marché libyen | Offre d'entrée 220–240 $ (3 pages, 5 jours) ou pack « vitrine + 1 an » |
| **M-1** | Majeur | Prix concurrents publiés sur `/compare` partiellement datés (Wix 20–50 $ vs 17–39 $) | `comparisons.ts:415` | Comparaison attaquable (publicité comparative) | Ajouter « prix relevés le … » + source sous chaque tableau |
| **M-2** | Moyen | Spotify 12 mois 59,90 $ vs 155,88 $ officiel US (−62 %) | `digital-seed.ts:266` | Incohérence de sourcing : soit prix régional (risque de compte), soit perte | Vérifier le coût grossiste réel de la référence |
| **M-3** | Moyen | Refonte à 49 $, identité à 39 $, landing à 59 $ | `config.ts:277-334` | Ces prix décrédibilisent le positionnement premium et fixent un ancrage bas | Refonte 149 $, identité 89 $, landing 99 $ |
| **M-4** | Moyen | Acompte de réservation 1 $ | `config.ts:243-246` | Signal prix « discount » ; 1 $ ne couvre pas les frais | 19 $ déduits du devis |
| **m-1** | Mineur | Pas de prix « tout compris » sur les cartes (taxe réseau implicite) | — | Petits paniers non rentables | Commande minimum 15 $ ou bundles |
| **m-2** | Mineur | Pas d'offre packagée (site + maintenance + SEO) | — | Panier moyen plafonné | Pack « Lancement » 690 $ |

### Détail des points critiques

**C-1 — Le taux de change est la première décision de prix du site.**
Le taux 4,83 correspond à un ancrage ancien, très éloigné du parallèle (9,90) comme de l'officiel (6,42). Comme tous les montants passent par `<Price usd={…} />` et `siteConfig.currency.rates`, une seule valeur fausse **tous** les prix en dinar du site, des cartes et des abonnements. Correction : `LYD: 9.9`, plus une phrase dans l'interface (« conversion indicative au taux du 04/11/2026 ; le paiement est facturé en USD »). Le taux restant éditable dans `/admin → Marché & Devises`, ajouter la date du dernier relevé au même endroit.

**C-2 — Le catalogue a divergé du barème.**
Le barème de `fazercards-pricing.ts` a été conçu pour ne jamais vendre à perte (marge 20/15/12/10 % + plancher de gain). Les prix saisis dans `digital-seed.ts` ne l'appliquent pas : la marge brute de Steam 25 $ est de 1,8 %, celle de Steam 100 $ de 1,4 %, très en dessous du plancher de 10 %. Soit le barème pilote réellement les prix (et il faut le brancher sur le catalogue), soit il ne sert qu'à l'audit admin — mais les deux ne peuvent pas coexister.

**C-3 — Des plafonds pensés pour la livraison, pas pour la grille.**
Le plafond de 25 $ correspond au plafond d'achat automatique FazerCards (risque de solde), et le plafond de 50 $ à une politique temporaire. Ils n'ont pas été revus quand les cartes 50 $ et 100 $ ont été ajoutées : la grille annonce des produits que la caisse refuse. Deux options : (a) relever les plafonds (solde marchand couvrant 120 $), ou (b) retirer du catalogue les montants supérieurs au plafond. L'entre-deux actuel — afficher sans pouvoir vendre — est le pire des cas.

**C-4 — Le prix d'appel doit être le prix payable.**
`300 $ + 20 % de personnalisation` est une construction lisible en interne, illisible en ligne : le client voit 300 $ sur la page, 360 $ dans le récapitulatif. Les concurrents (Wix, agences égyptiennes) annoncent un prix tout compris. Recommandation : afficher **360 / 612 / 1 056 $** comme prix, et mentionner « personnalisation incluse » ; conserver le détail dans le récapitulatif.

---

## 6. Repricing recommandé

### 6.1 Côté web — architecture, pas nivellement

| Levier | Aujourd'hui | Recommandé | Justification | Effet |
|---|---|---|---|---|
| Prix affiché | 300 + 20 % | **360 $ tout compris** | Prix payable = prix vu | Conversion ↑ |
| Entrée de gamme | — | **240 $** (3 pages, 5 j, 1 révision) | Comble le vide entre 360 $ et l'offre locale à 1 200–1 500 د.ل (≈ 120–150 $) ; reste premium | +volume local |
| Vitrine+ | 612 $ | **650 $** | −72 % vs Égypte, −84 % vs Émirats | +6 % |
| Boutique | 1 056 $ | **1 290 $** | Reste −68 % vs Égypte, −92 % vs Émirats | +22 % |
| Refonte | 49 $ | **149 $** | Une refonte = un projet, pas un réglage | +200 % |
| Identité | 39 $ | **89 $** | Idem | +128 % |
| Maintenance | 19 $/mois | **29 $/mois** | Sous le marché local (400 د.ل ≈ 40 $) | +53 % |
| Abonnement Vitrine | 10 / 69 $ | **19 / 190 $** | Wix Light = 17 $/mois ; annuel = 10 mois | +90 % / +175 % |
| Abonnement Vitrine+ | 12 / 89 $ | **29 / 290 $** | Idem | +142 % / +226 % |
| Abonnement Boutique | 25 / 199 $ | **49 / 490 $** | Idem ; reste < Shopify + agence | +96 % / +146 % |
| Acompte réservation | 1 $ | **19 $** (déduits) | Signal premium, couvre les frais | — |
| À la carte bas de gamme | 15–59 $ | 29–99 $ | Évite l'ancrage « 15 $ » | +50 % à +100 % |

**Simulation à volume constant** (10 projets/mois : 5 Vitrine, 3 Vitrine+, 2 Boutique) :
aujourd'hui **5 748 $** → recommandé **6 330 $** (+10,1 %), à qualité identique. Le prix d'entrée reste à 360 $ : la hausse porte uniquement sur Vitrine+ et Boutique, où la marge de manœuvre face au marché est démontrée.
Sur le récurrent (45 abonnés : 30 / 10 / 5), MRR **545 $** → **1 105 $**, soit **+6 720 $ d'ARR**.

**Ce qu'il ne faut pas faire :** augmenter le prix d'entrée avant d'avoir corrigé le taux LYD. Une hausse de dollar, alors que le prix en dinar est déjà faux, serait illisible et contre-productive.

### 6.2 Côté boutique — trois règles, pas un pourcentage

1. **Aucune référence sous le point mort**, sauf deux références d'acquisition explicitement désignées (Steam 5 $ et 10 $), à condition qu'elles partent en bundle ou dans un panier ≥ 15 $. Toute autre référence doit couvrir coût + 1 $ de frais fixes + 0,50 $ de marge, sinon délistage.
2. **Steam = acquisition, PSN/Xbox = marge.** Steam reste à parité Eneba (le « moins cher du marché » est un argument de trafic), PSN/Xbox passent **sous** Eneba pour convertir la marge de 12–17 % que le grossiste laisse.
3. **Petits montants = bundles.** Commande minimum 15 $ (ou 2 cartes), car à 1 $ de frais fixes une carte à 5 $ n'est jamais rentable.

| Produit | Prix actuel | **Prix recommandé** | Marge nette estimée* | Position vs marché |
|---|---|---|---|---|
| Steam 5 $ | 5,40 $ | **bundle uniquement** (5,65 $ à l'unité) | −0,35 $ | ≈ officiel |
| Steam 10 $ | 10,60 $ | **11,00 $** (acquisition, bundle conseillé) | −0,17 $ | ≈ Eneba (10,75) |
| Steam 25 $ | 25,90 $ | **27,70 $** | +0,85 $ | −0,6 % vs Eneba (27,86) |
| Steam 50 $ | 50,50 $ | **51,50 $** | +0,48 $ | −0,5 % vs Eneba (51,74) |
| Steam 100 $ | 100,40 $ | **103,90 $**† | +2,34 $ | ≈ marché |
| PSN 50 $ US | 50,50 $ | **47,90 $** | +3,55 $ | −0,6 % vs Eneba (48,20) |
| PSN 25 $ US | 25,90 $ | **24,50 $** | +1,32 $ | ≈ Eneba |
| Xbox 50 $ | 50,50 $ | **46,90 $** | +3,55 $ | sous Eneba |
| Xbox 100 $ | 100,40 $ | **92,90 $**† | +6,46 $ | −7 % vs pair |
| Google Play 50 $ | 50,50 $ | **52,50 $** | +2,53 $ | pair + 5 % |
| Amazon 50 $ | 50,40 $ | **52,50 $** ou délistage | +1,71 $ | pair + 5 % |
| Robux 1 700 | 19,90 $ | **19,40 $** | +0,96 $ | −3 % vs officiel |
| Robux 4 500 | 49,90 $ | **48,90 $** | +5,82 $ | −2 % vs officiel (49,99) |
| Robux 400 / 800 | 4,90 / 9,80 $ | **délistage / 9,60 $** | −0,92 / +0,31 $ | 400 non rentable |

\* Frais 1,5 % + 1,00 $, chiffre plancher (avec 0,40 $ de frais, ajouter ~0,6 $). Les prix marqués † supposent le plafond de caisse relevé (cf. C-3) : sinon ces cartes restent invendables.

**Impact à volume constant** sur un mix de 100 commandes (40 Steam 10 $, 20 Steam 50 $, 20 PSN 50 $, 10 Xbox 25 $, 10 Google Play 10 $) :
marge nette **123 $** aujourd'hui → **163 $** après la seule phase 1 (repricing des références déficitaires, hors Steam 5/10 laissés en acquisition), soit **+32 %**, sans dégrader la position concurrentielle sur Steam.
La phase 2 (baisse PSN/Xbox sous Eneba) échange de la marge unitaire contre du volume : point mort à **+72 % de volume PSN**. À arbitrer avec les données de trafic réelles.

**Levier supplémentaire : le plan grossiste.** Le plan Gold (29,99 $/mois) annonce des remises supplémentaires (3,55 % sur les top-ups Steam). Sur 10 cartes Steam 50 $/mois, la remise (≈ 17 $) couvre déjà l'abonnement. À faire confirmer pour les cartes, pas seulement les top-ups.

### 6.3 Deux scénarios de positionnement (à trancher)

| | **A. Premium local** | **B. Export** |
|---|---|---|
| Cible | PME de Tripoli, paiement en dinar | PME d'Égypte / Golfe / diaspora |
| Prix d'entrée | 240 $ (≈ 2 380 د.ل réels) | 360 $ |
| Prix Boutique | 1 290 $ | 1 490 $ |
| Condition | Moyen de paiement local + preuve locale | Portfolio, contrat, facture, anglais |
| Risque | Guerre des prix locale (1 200–1 500 د.ل) | Cycle de vente plus long |
| Marge | Volume moyen, marge moyenne | Volume faible, **marge 2–3×** |

La structure actuelle (prix export, discours local, paiement crypto) est un **entre-deux** : elle est trop chère pour la Libye et pas assez chère pour l'export. Choisir un scénario vaut mieux que d'optimiser au centime un positionnement flou.

---

## 7. Plan d'action

**Sous 48 h — corriger ce qui est faux**

1. `LYD: 9.9` + mention de date dans `/admin → Marché & Devises`.
2. Plafonds de caisse relevés (auto 60 $, commande 120 $) **ou** cartes > 50 $ retirées du catalogue — pas d'entre-deux.
3. Repricing des 10 références sous le point mort (§ 6.2, phase 1).

**Sous 2 semaines — corriger ce qui est flou**

4. Prix affichés = prix payables (360 / 612 / 1 056 $).
5. Suppression de la ligne « maintenance 19 $ » contradictoire ; nouvelle grille d'abonnements (19 / 29 / 49 $, annuel = 10 mois).
6. Mention « taux au … » + source sur `/compare` et sur les pages tarifs.
7. Révision des prix à la carte (15–59 $ → 29–99 $).

**Sous 60 jours — choisir une arène**

8. Décision scénario A ou B (§ 6.3), avec l'offre d'entrée qui va avec.
9. Test de prix sur Vitrine+ (650 $) et Boutique (1 290 $) pendant 30 jours, mesure du taux de conversion.
10. Mise en place d'un relevé concurrentiel trimestriel (Libye : IP Libya, Abdu Tech, Maksab, Evyx ; cartes : Eneba, G2A, prix officiels) — un tableau daté suffit.

**Garde-fous à ajouter au code (pour que l'écart ne se reproduise pas)**

- Un test qui échoue si une référence du catalogue a une marge nette < 0 avec le barème en vigueur.
- Un test qui échoue si un prix de carte dépasse le plafond de caisse applicable.
- Un test qui vérifie que chaque devise activée a un taux > 0 et daté de moins de 90 jours.
- L'audit admin existant (`src/lib/digital-audit.ts`) sait déjà calculer coût et marge : l'étendre en **alerte de marge négative** au lieu d'un simple rapport.

---

## 8. Vérifications & sources

**Vérifié dans le code :** grille et taux (`config.ts`), abonnements (`subscription-plans.ts`), maintenance (`content.ts`), catalogue (`digital-seed.ts`), barème de marge (`fazercards-pricing.ts`), plafonds (`digital-sales-policy.ts`, `digital-order-core.ts`, `digital-buy-dialog.tsx`), prix concurrents publiés (`comparisons.ts`).

**Vérifié en ligne (3–4 novembre 2026) :**

- Taux du dinar : Banque centrale 6,42 ; marché parallèle 9,89–9,97 (Al Wasat, Libya Akhbar, 1er–3 nov. 2026).
- Agences libyennes : iplibya.com (500 / 1 200 / 3 500 / 4 000 د.ل ; hébergement 250 د.ل/an ; SEO 700 د.ل/mois ; gestion 400 د.ل/mois), abdu.ly (1 500 / 4 000 د.ل), maksabagency.com (moyennes marché), evyx.net (4 000–20 000 د.ل), ShoPlus / JoShop (99–200 $/an).
- MENA / Europe : Web Pioneer (Égypte, prix USD publiés), Intrazero (Égypte), Udjat (Égypte), Wise Hustlers (Émirats), Voxire (Liban), guides de prix français 2026.
- DIY : Wix 17 / 29 / 39 $, Squarespace 16–49 $, Shopify 29–39 $ (relevés 2026).
- Cartes : grossiste FazerCards, région US (Steam, PSN, Xbox, Google Play, Amazon, Robux) ; Eneba / G2A / PlatPrices (3 nov. 2026 : PSN 50 $ à 48,20 $, Steam 50 $ à 51,73–51,75 $, G2A PSN 50 $ à 45,93 $) ; OpenSooq Libye (cartes 100 $ à 745–950 د.ل).
- Prix officiels : Roblox (400/800/1 700/4 500 = 4,99/9,99/19,99/49,99 $), Spotify US (12,99 $/mois, 155,88 $/an).

**Non vérifié (à confirmer par l'exploitant) :** prix réellement pratiqués en base après surcharges admin ; volumes de vente ; remise exacte du plan grossiste Gold sur les cartes ; coût grossiste Spotify ; éligibilité d'un canal de paiement local (Sadad / MobiCash).

---

*Audit réalisé en lecture seule. Les prix recommandés du § 6 sont des propositions chiffrées, pas des modifications appliquées : chaque ligne peut être acceptée ou refusée indépendamment.*
