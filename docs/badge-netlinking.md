# Crédit client « Website by Nukhba » — A12

Le badge est un crédit de réalisation **facultatif**, pas un dispositif de
netlinking ni une promesse de classement. Le client choisit librement de garder
le lien, de le refuser ou de le retirer, y compris après une refonte. Aucune
réduction, prestation ou condition contractuelle ne doit imposer un lien suivi.

## Ancre et qualification

- Ancre neutre : `Website by Nukhba` / `نخبة`, aussi dans le `alt` et le `title`.
- Pas de mots-clés de service ou de ville ajoutés à l'ancre.
- Les extraits HTML et React de `/badge` utilisent par défaut
  `rel="sponsored nofollow noopener"` avec `target="_blank"`. Ce choix prudent
  qualifie le crédit lié à une prestation commerciale ; `noopener` protège
  l'ouverture d'onglet mais ne qualifie pas la relation commerciale.
- Tout crédit rémunéré, imposé contractuellement ou obtenu en échange d'un
  avantage doit conserver `sponsored` (éventuellement avec `nofollow`). Il ne
  doit jamais être présenté comme une recommandation éditoriale indépendante.
- Un lien réellement éditorial, sans contrepartie ni obligation, reste à la
  discrétion du client. Ne jamais lui demander de retirer `nofollow` pour
  « transmettre l'autorité ». Ces attributs sont des indications pour les
  moteurs, pas une garantie de suivi ou d'absence d'autorité.

## Installation volontaire

Après accord du client, copier l'extrait HTML ou React de
**https://nokhba.net.ly/badge** dans son footer. HTML convient aussi aux blocs
personnalisés WordPress, Webflow et Shopify. Les assets sont hébergés sur le
domaine configuré : `/badge/nukhba-badge.svg` et
`/badge/nukhba-badge-light.svg` (176 × 44). Le crédit et sa destination restent
visibles et compréhensibles ; pas de lien caché ni d'injection SEO.

Le footer du site agence ne porte pas de crédit client externe : ses liens
internes de navigation ne nécessitent pas cette qualification commerciale.

## Vérification et statuts historiques

```bash
npm run badge:audit
npm run badge:audit -- --only=hala-dun
npm run badge:audit -- --dry-run
```

L'audit lit le HTML initial à la racine, puis `/ar` et `/en`, accepte les
origines configurées et rejette les imitations de domaine. Les noms de statuts
restent compatibles avec `public/badge/clients.json` :

| Statut | Lecture et action |
| --- | --- |
| `verified` | lien présent sans `nofollow` détecté ; pas une certification SEO ou commerciale, vérifier le `rel` selon le contexte |
| `nofollow` | crédit présent et qualifié `nofollow` ; accepté, ne pas retirer l'attribut |
| `missing` | crédit non trouvé ; respecter le refus client, proposer seulement avec son accord |
| `down` | site injoignable ; réessayer plus tard |
| `pending` | pas encore contrôlé |

Le `rel` brut est conservé dans le diagnostic : le statut seul ne prouve pas
l'absence ou la présence de `sponsored`. L'audit ne mesure pas le consentement.
Le workflow hebdomadaire met à jour les statuts via PR ; `nofollow` ne doit
jamais déclencher une demande de déqualification. Retirer du suivi les clients
qui refusent le crédit pour ne pas les relancer indéfiniment.

Les paramètres `utm_source=client_footer&utm_medium=badge&utm_campaign=client_credit`
servent uniquement à mesurer les visites référentes. Ils ne sont ni une
qualification commerciale pour les robots ni une obligation pour le client.
