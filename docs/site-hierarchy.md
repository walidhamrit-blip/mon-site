# Navigation publique simplifiée

## Deux intentions, quatre liens principaux

- `/` : orientation (acheter un produit ou créer un site), trois entrées,
  catégories boutique, aperçu de catalogue, résumé web, assistance et FAQ courte.
- `/codes` : boutique ; facettes `kind` pour les cartes, clés de jeux/logiciels,
  recharges et abonnements. Le fournisseur classe jeux et logiciels ensemble
  (`software_key`) : ne pas inventer un catalogue distinct.
- `/creation-sites` : offres → exemples → étapes → devis → FAQ projet.
- `/contact` : assistance commune.

Les URL `/services`, `/demos`, `/pricing`, `/abonnements`, `/sectors`, `/blog`,
`/compare`, `/apps`, `/products` restent disponibles : pas de suppression ni
redirection arbitraire des pages indexées. Elles sont secondaires, accessibles
via le parcours web et/ou le pied de page. Les anciens liens `/#pricing`,
`/#demos`, `/#process`, `/#lead-form` sont transférés côté client vers les
sections correspondantes de `/creation-sites` (les fragments ne sont pas
transmis au serveur).

## SEO / GEO

- Un H1 par page ; H2 pour les blocs, H3 pour les points d'assistance.
- Métadonnées et canonique propres pour `/creation-sites`, ajout au sitemap.
- Les facettes restent canoniques vers `/codes` : pas de pages SEO minces
  générées pour chaque combinaison de filtres.
- FAQ courte de l'accueil : même source pour les réponses HTML et JSON-LD,
  dans la langue initiale. Le schéma HowTo est déplacé vers la page projet
  qui affiche réellement les étapes.
- Marché et lieu issus de la configuration, pas de villes artificielles.
- Mise à jour de llms.txt pour expliquer les deux parcours aux lecteurs IA.
- Les sections web détaillées réutilisent les prix, exemples, FAQ et étapes
  administrables existants. La composition courte de l'accueil est désormais
  fixe ; l'ancien ordre du constructeur d'accueil n'y est plus appliqué.

## Maintenance

Neon en panne : conserver les catégories et les liens, afficher le message de
maintenance et ne pas présenter les produits de repli comme achetables.
Aucun faux stock, prix de démonstration ou paiement simulé n'est ajouté.
Le contrôle complet du catalogue et des commandes attend le rétablissement
Neon ; cette refonte ne modifie pas le paiement ni la synchronisation.
