# Badge de netlinking client — procédure

Le badge « Website by Nukhba » est le seul levier d'autorité hors contenu encore
disponible : chaque site livré pointe vers `nokhba.net.ly` avec une ancre
descriptive bilingue. Ce document décrit la pose, la vérification et le
traitement des exceptions.

- Page à envoyer au client : **https://nokhba.net.ly/badge**
- Statut à jour de tous les sites : section « المواقع المنجزة » de cette page
- Audit en ligne de commande : `npm run badge:audit`

---

## 1. Pourquoi un lien dofollow

Un lien `rel="nofollow"` n'apporte aucune autorité : il indique à Google de ne
pas suivre le lien. Pour que le badge compte, il doit être **dofollow** (aucun
`nofollow` dans `rel`) et **réellement présent dans le HTML initial** du pied de
page — pas injecté par JavaScript après chargement, sinon les robots ne le
voient pas.

Deux attributs restent utiles et ne neutralisent rien : `rel="noopener"` (sécurité
d'onglet) et `target="_blank"`. L'audit les accepte.

## 2. Poses par type de site

### Site statique / HTML

Copier l'extrait « HTML » de `/badge` juste avant `</body>`, dans le pied de page
partagé (sinon dans chaque page). Le fichier SVG est servi par nokhba.net.ly :
rien à héberger.

### React / Next.js

Utiliser l'onglet « React / Next.js ». Le composant `NukhbaBadge` s'insère dans le
`<footer>` du layout racine. Pour un site en `next/image`, remplacer le `<img>`
par `<Image src="https://nokhba.net.ly/badge/nukhba-badge.svg" width={176} height={44} alt="…" />`
et ajouter `nokhba.net.ly` à `images.remotePatterns`.

### WordPress / Webflow / Shopify

Insérer l'extrait HTML dans un bloc « HTML personnalisé » du pied de page
(Apparence → Widgets, ou Footer du thème). Ne pas utiliser un plugin de badges
tiers : il ajouterait un `nofollow` et un script externe.

## 3. Variantes

| Fichier | Usage |
| --- | --- |
| `/badge/nukhba-badge.svg` | fond sombre, pour les pieds de page clairs |
| `/badge/nukhba-badge-light.svg` | fond clair, pour les pieds de page sombres |

Les deux font 176 × 44 px, ~1 Ko, texte vectoriel (net à toute résolution). Le
`alt` recommandé est le même dans les deux cas :

```
تصميم وتطوير المواقع — نخبة طرابلس | Website by Nukhba — Tripoli web design agency
```

## 4. Vérification

```bash
npm run badge:audit                      # tous les clients
npm run badge:audit -- --only=hala-dun   # un seul
npm run badge:audit -- --dry-run         # plan, sans réseau
```

Sortie type :

```
✓ al-manhaj-company — badge en place — « Website by Nukhba »
~ hala-dun — lien en nofollow
· demo-jouets — aucun lien vers nokhba.net.ly
✖ pizzeria-demo1 — hors ligne (503)

1 vérifié(s) · 1 nofollow · 1 manquant(s) · 1 hors ligne · 9 en attente · 0 erreur(s)
```

Statuts :

| Statut | Signification | Action |
| --- | --- | --- |
| `verified` | lien dofollow trouvé | rien, il est compté |
| `nofollow` | lien présent mais neutralisé | retirer `rel="nofollow"` |
| `missing` | aucun lien vers nokhba.net.ly | poser le badge |
| `down` | site injoignable | relancer plus tard |
| `pending` | jamais vérifié | lancer l'audit |

L'audit contrôle la racine, puis `/ar` et `/en` : certains sites séparent le pied
de page par langue. Il ignore les imitations de domaine (`nokhba.net.ly.exemple.com`,
`notnokhba.net.ly`) et les liens construits uniquement en JavaScript.

## 5. Automatisation

`.github/workflows/badge-audit.yml` s'exécute **chaque lundi à 07:30 UTC**, à
chaque modification de l'audit ou de la liste des démos sur `main`, et à la
demande (`workflow_dispatch`) :

1. audit des sites clients publiés ;
2. publication directe sur `main` si un statut change — `public/badge/clients.json`
   alimente alors `/badge` et `llms-full.txt` §7f (sans dépendre de
   l'autorisation GitHub de création de Pull Requests) ;
3. ouverture — ou mise à jour — d'une issue `badge-client` listant les sites à
   corriger, avec l'extrait prêt à coller ;
4. fermeture automatique de cette issue quand plus aucun site n'est en
   `nofollow`/`missing`.

Le workflow peut être relancé à la main (`workflow_dispatch`, champ `only`).

## 6. Exceptions et cas limites

- **Site refait par un autre prestataire** : le badge peut être retiré, mais
  l'ancien site doit alors rediriger ou le client doit accepter de perdre le
  crédit. À documenter dans la fiche client.
- **Site vendu sans mention de crédit** : c'est un choix commercial. Retirer
  l'URL de `public/badge/clients.json` plutôt que de laisser un `missing`
  éternel dans l'issue.
- **Sous-domaine ou site vitrine sur mesure** : même règle, un lien par site.
- **Ne jamais** acheter de liens, ni poser le badge sur des sites qui ne sont pas
  des réalisations : le badge doit rester une preuve vérifiable.

## 7. Empreinte mesurable

Le lien porte `utm_source=client_footer&utm_medium=badge&utm_campaign=client_credit` :
dans Vercel Analytics (ou Plausible/GA), les sessions issues de ce `utm_source`
mesurent directement l'apport du parc client. Un pic de trafic référent sans
`utm` sur `/` signale un lien posé sans extrait officiel — à corriger pour garder
la traçabilité.
