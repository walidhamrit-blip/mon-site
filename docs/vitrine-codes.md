# Vitrine `/codes` — organisation « boutique » et jaquettes

**Périmètre :** page publique `/codes` (clés de jeux, cartes cadeaux, recharges,
codes logiciels) et fiche `/codes/<slug>`.
**Alignée sur** l'organisation du fournisseur (FazerCards) : barre de filtres en
haut, rail de facettes sur le côté, grille de produits dense.

---

## 1. Structure de la page

```
┌──────────────────────────────────────────────────────────┐
│ en-tête de rayon (titre + accroche + compteurs)          │
├──────────────────────────────────────────────────────────┤
│ BARRE DE FILTRES — collante (sticky top-0, z-30)         │
│  [recherche]                    [tri ▾]  [filtres ⚙]     │
│  (Familles : Tout · Clés de jeux · Cartes · Recharges…)  │
├───────────────┬──────────────────────────────────────────┤
│ RAIL          │  « 24 produits sur 120 »  [filtres actifs]│
│  Sections     │  ┌────┬────┬────┬────┐                   │
│  Plateformes  │  │ 2:3│    │    │    │  4 cartes/ligne   │
│  Régions      │  └────┴────┴────┴────┘                   │
│  Prix         │  bandeau de réassurance                   │
│  Aide WhatsApp│                                          │
└───────────────┴──────────────────────────────────────────┘
```

### Côté du rail : gauche en anglais, droite en arabe

Le rail est le **premier enfant** du conteneur `grid` et toutes ses marges sont
écrites en propriétés logiques (`start-*` / `end-*`, jamais `left` / `right`) :
le sens du document (`dir="rtl"` posé par `I18nProvider`) suffit donc à le
basculer à droite en arabe, sans aucune règle conditionnelle. Un test
(`scripts/game-covers.test.mjs`) interdit la réintroduction de `ml-auto`,
`pl-*`… dans ce composant.

### Grille

| Écran | Colonnes |
| --- | --- |
| mobile | 2 |
| ≥ 1024 px | 3 |
| ≥ 1280 px (`xl`) | **4** |

### Codes de logiciels (à venir)

Les familles du rail ne sont **pas** codées en dur : elles sont déduites des
produits (`software_key`, `gift_card`, `game_topup`, `subscription_code`) et
libellées par `DIGITAL_KIND_LABELS`. Dès que le fournisseur publiera des clés
logicielles, la section « Codes logiciels » apparaîtra seule, avec son icône
`KeyRound`, son compteur et son filtre. Aucun code de page à modifier.

---

## 2. Jaquettes des jeux

`src/lib/game-covers.ts` fait la correspondance **produit → visuel** :

1. `product.image` (image choisie dans l'admin) est prioritaire ;
2. sinon la jaquette locale du jeu (`/game-covers/<slug>.jpg`, portrait 600×900),
   trouvée par mots-clés sur le slug et le titre ;
3. sinon un **visuel de repli dessiné** (dégradé de la couleur de la fiche +
   initiales du jeu) — jamais de cadre gris ni d'image cassée.

La correspondance se fait sur des **mots entiers** et la clé la plus longue
gagne : `age of mythology retold` n'est pas capté par `age of mythology`, et
`rust` n'est pas trouvé dans `trust`.

Une entrée peut aussi porter des `excludes` : le catalogue contient des titres
qui **commencent** par celui d'un autre jeu. `Mobile Legends` (MOBA) et
`Mobile Legends: Adventure` (idle game) sont deux produits différents ; sans
exclusion, le second porterait le visuel du premier.

### Ajouter un jeu

```bash
# 1. Déposer une jaquette portrait (600×900 de préférence) :
public/game-covers/hollow-knight.jpg

# 2. Déclarer les mots-clés :
#    src/lib/game-covers.ts → GAME_COVERS
{ file: "/game-covers/hollow-knight.jpg", keys: ["hollow knight"] }
```

Deux familles de visuels cohabitent, et c'est voulu :

- **jaquettes** (`<jeu>.jpg`) pour les clés de jeux PC/console ;
- **visuels de marque** (`brand-<marque>.jpg` pour les cartes cadeaux photo,
  et un visuel logo-sur-dégradé pour les marques tierces comme Airbnb ou les
  MOBA mobiles, qui n'ont pas de jaquette 2:3 officielle).

Le test `scripts/game-covers.test.mjs` vérifie que **chaque entrée déclarée
possède son fichier** : une faute de frappe est détectée avant le déploiement.

Le catalogue fournisseur ne contenant aucune image, les fiches sans
correspondance utilisent le visuel de repli ; élargir la table est donc la
seule action nécessaire pour enrichir la vitrine jeu par jeu.

---

## 3. Ordre de la vitrine — demande et zones crypto

Le fournisseur renvoie son catalogue dans un ordre qui n'a rien de commercial
(les clés Steam arrivent avant les cartes PlayStation, un jeu de niche avant
PUBG). La vitrine impose donc son propre ordre, calculé par
`src/lib/digital-priority.ts` :

1. **Demande** — un poids par famille de produit (`DEMAND_KEYWORDS`) :
   PUBG Mobile 100, Free Fire 96, Mobile Legends 92, PlayStation 100,
   Steam Wallet 98, Amazon 82, Airbnb 46… Un jeu absent de la table ne vaut
   que son bonus de famille : il reste derrière.
   Le texte analysé dépend de la famille : la **marque** pour les cartes et
   recharges (« Halo Infinite (Xbox, Halo Credits) » n'est donc pas une carte
   Xbox), le **nom du jeu** pour les clés (dont la plateforme vaut « Steam »
   ou « Xbox » pour les 80 fiches). Et c'est le mot-clé le plus **long** qui
   gagne : `mobile legends adventure` (16) ne prend pas les 92 points de
   `mobile legends`.
2. **Zone** — `CRYPTO_REGIONS` classe les zones utiles à un acheteur qui paie
   en USDT : `GLOBAL` d'abord (valable partout), puis le Golfe et le Levant
   (`MENA`, `SA`, `AE`, `KW`, `QA`, `OM`, `BH`, `LB`), puis `EG`, `TR`, `LY`,
   puis `US`, `UK`, `EU`, `CA`.
   La zone se lit dans le **libellé** de la plateforme (`zoneFromPlatform`) :
   le champ `regions` du fournisseur annonce `GLOBAL` sur presque toutes les
   fiches. Les parenthèses de livraison (`Auto`, `Fast`, `Manual`, `Reserve`)
   ne sont pas des zones.
3. **Tourniquet par marque** — un tri strict par score plaçait les 41 cartes
   PlayStation de 41 pays sur les 41 premières places. Les fiches sont donc
   regroupées par marque (`brandKeyFor`, plateforme sans la zone entre
   parenthèses) et l'on prend une fiche par marque à chaque tour : la
   première ligne de la grille montre quatre produits différents, et la
   meilleure zone reste devant à l'intérieur de chaque marque.

Conséquences visibles :

| Élément | Comportement |
| --- | --- |
| Tri par défaut | « Les plus demandés » (`SortId = "popular"`), côté serveur **et** côté navigateur |
| HTML / JSON-LD | déjà triés : le plan de page suit l'ordre commercial |
| Huit premières cartes | étiquette « Populaire » / « مطلوب » |
| Rail des régions | zones USDT en tête, pastille `USDT`, puis volume décroissant |
| Rail des plateformes | triées par demande (PUBG, Free Fire, PlayStation, Steam… avant la niche) |
| Pastilles de familles | recharges → cartes → clés logicielles |

Le classement est **éditorial**, pas statistique : il n'utilise pas les
commandes (encore trop peu nombreuses pour être représentatives). Ajuster un
poids dans `DEMAND_KEYWORDS` ou l'ordre de `CRYPTO_REGIONS` suffit à changer
la vitrine ; `scripts/digital-priority.test.mjs` verrouille la règle et
l'absence de dérive entre serveur et navigateur.

---

## 4. Notes d'implémentation

- Le composant `DigitalCatalog` reste un composant **client** : les filtres,
  le tri et le tiroir mobile sont instantanés, sans requête réseau.
- Les jetons du thème (`--accent`, `--border`, `--radius-*`, `--shadow-*`) sont
  les seules couleurs utilisées : la vitrine suit la palette choisie et les
  modes clair/sombre.
- L'avertissement « carte régionale » reste affiché **sur chaque carte**
  (`RegionalAlert compact`), avant tout clic vers la fiche.
- Les images sont optimisées par `next/image` (formats modernes, `sizes`
  adaptés à la grille) ; les 4 premières cartes sont préchargées.
