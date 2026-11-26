# Deux univers, une marque mère (étape 1)

Le site sert deux publics qui n'ont presque rien en commun :

| | Nukhba Studio (sites et applications) | Nukhba Store (cartes et clés de jeux) |
| --- | --- | --- |
| Client | Entreprise, commerçant (B2B) | Joueur (B2C) |
| Décision | Longue : comparaison, devis | Achat d'impulsion |
| Identité | Sobre, fixe : encre + or | Gaming : palette choisie par le visiteur |
| Action principale | « طلب عرض » (devis) | « تتبع طلبي » (suivi de commande) |

Architecture de marque retenue : **marque mère endossante**. Nukhba reste la
marque de confiance ; chaque univers a sa propre identité et affiche
« إحدى خدمات نخبة / A Nukhba service ».

## Ce qui est en place

- **Source unique** : `src/lib/universes.ts`. `universeForPath()` classe chaque
  URL en `store` (`/codes…`), `studio` (`/creation-sites`, `/demos`,
  `/pricing`, `/services`, `/sectors`, `/abonnements`, `/audit`, `/badge`,
  `/livraison`, `/apps`, `/products`, `/compare`, `/blog`) ou `hub` (accueil,
  contact, avis, pages légales, paiement).
- **Aucune URL modifiée** : pas de redirection, pas de risque SEO.
- **`UniverseShell`** (`src/components/universe-shell.tsx`) pose
  `data-universe` sur `.public-shell`. Le composant est client, mais
  `usePathname()` est résolu au rendu serveur : le HTML initial porte déjà le
  bon univers (pas de clignotement), et le layout reste statique/ISR.
- **En-tête** : menu, nom de sous-marque, logo et action principale propres à
  l'univers. Une barre de marque discrète (non collante) permet de passer de
  l'un à l'autre. Le sélecteur de palette n'apparaît que dans la boutique.
- **Pied de page** : contenu propre à chaque univers ; la boutique ne pousse
  pas la création de sites (et inversement). Seule la dernière ligne rappelle
  l'autre service (« أيضاً من نخبة »).
- **Style** : `src/app/universes.css`, chargé globalement après `gaming.css`.
  Le cloisonnement se fait **par sélecteur**, jamais par lieu d'import : Next.js
  ne décharge pas une feuille de style lors d'une navigation client.
  - studio + hub : jetons de couleur fixes (jour : encre `#1B2B48`, or
    `#8A620C` ; nuit : or `#E9C77B` sur noir), sans angles asymétriques,
    barres inclinées, relief 3D ni halos néon ;
  - boutique : identité gaming inchangée, y compris le dégradé Royal Gold ;
  - `data-universe-preview="store|studio"` : un sous-arbre adopte l'identité
    d'un autre univers (portes de l'accueil, bloc catalogue de l'accueil). La
    palette du visiteur est copiée sur `body` (`--store-*`) avant surcharge.
- **Accueil** : deux portes (Studio / Store), chacune dans l'identité de son
  univers. Les visuels `gatewayWebsites`, `gatewayGiftCards`, `gatewayTopUps`
  restent administrables.
- **Données structurées** : `Organization` + `WebSite` partout (marque mère) ;
  `ProfessionalService` + catalogue d'offres web uniquement hors boutique ;
  la boutique déclare son entité `Store` sur `/codes`.
- **Tests** : `scripts/universes.test.mjs` (classement des URL, liens
  existants, contrastes ≥ 4.5:1 de l'identité studio de jour et de nuit,
  JSON-LD).

## Ajouter une page

Une nouvelle route du studio doit être ajoutée à `universePrefixes.studio`,
sinon elle sera traitée comme une page de la marque (`hub`). Les routes sous
`/codes` sont automatiquement dans la boutique.

## Étape 2 (dans 2 à 3 mois, selon les données Search Console)

Sous-domaine pour la boutique, même code, même base, même admin :

```
nukhba.com        → studio + marque
store.nukhba.com  → boutique
```

1. `src/proxy.ts` : réécriture selon l'en-tête `Host` (`store.` → `/codes…`).
2. Redirections 301 `/codes/*` → `https://store.<domaine>/*` (voir
   `docs/migration-domaine.md` pour la procédure Search Console).
3. Deux propriétés Search Console, deux sitemaps, `canonical` par hôte.
4. **Comptes de paiement séparés** (clés NOWPayments distinctes) : un incident
   sur la boutique ne doit pas bloquer les encaissements de l'agence.
5. Pages légales séparées : remboursement d'un code numérique et contrat de
   prestation web ne relèvent pas des mêmes règles.

`universes.ts` reste la source de vérité : seule la résolution de l'univers
(chemin → hôte + chemin) change.
