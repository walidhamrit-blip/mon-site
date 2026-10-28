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

### Ajouter un jeu

```bash
# 1. Déposer une jaquette portrait (600×900 de préférence) :
public/game-covers/hollow-knight.jpg

# 2. Déclarer les mots-clés :
#    src/lib/game-covers.ts → GAME_COVERS
{ file: "/game-covers/hollow-knight.jpg", keys: ["hollow knight"] }
```

Le test `scripts/game-covers.test.mjs` vérifie que **chaque entrée déclarée
possède son fichier** : une faute de frappe est détectée avant le déploiement.

Le catalogue fournisseur ne contenant aucune image, les fiches sans
correspondance utilisent le visuel de repli ; élargir la table est donc la
seule action nécessaire pour enrichir la vitrine jeu par jeu.

---

## 3. Notes d'implémentation

- Le composant `DigitalCatalog` reste un composant **client** : les filtres,
  le tri et le tiroir mobile sont instantanés, sans requête réseau.
- Les jetons du thème (`--accent`, `--border`, `--radius-*`, `--shadow-*`) sont
  les seules couleurs utilisées : la vitrine suit la palette choisie et les
  modes clair/sombre.
- L'avertissement « carte régionale » reste affiché **sur chaque carte**
  (`RegionalAlert compact`), avant tout clic vers la fiche.
- Les images sont optimisées par `next/image` (formats modernes, `sizes`
  adaptés à la grille) ; les 4 premières cartes sont préchargées.
