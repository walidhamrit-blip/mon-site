# A07 — Catégories indexables du catalogue

Quatre rayons distincts, sans réserver de slug de fiche produit :

- `/codes/category/gift_card`
- `/codes/category/game_topup`
- `/codes/category/software_key`
- `/codes/category/subscription_code`

Chaque rayon possède un H1, un title, une description et un CollectionPage/ItemList propres, dans la langue principale du site (anglais/arabe). Les recharges décrivent une livraison sur Player ID, pas un code par e-mail. Les fiches gardent leurs URL `/codes/[slug]` et ajoutent un lien vers leur catégorie dans le HTML et le fil d’Ariane structuré.

## Pagination et découverte

- 24 produits par page, ordre commercial partagé avec le catalogue, filtrage par nature avant découpage.
- Liens HTML numérotés et précédent/suivant, `aria-current` sur la page courante, sans dépendance au JavaScript.
- Page 1 canonique sans query ; les suivantes sont auto-canoniques (`?page=2`, etc.) avec title/H1/description distinguant le numéro de page.
- Paramètre invalide ou page au-delà de la dernière : 404 lorsque le catalogue est sain.
- Navigation depuis `/codes` et entre les catégories. Les anciens liens `/codes?kind=…`, les facettes et tous les liens produits du catalogue restent inchangés.
- Sitemap : quatre pages de catégorie et toutes les pages supplémentaires réellement nécessaires ; entrées des fiches existantes conservées.

Une catégorie vide reste un guide accessible avec texte propre, message d’absence et liens vers les autres rayons. Pendant une panne déclarée : maintenance + noindex, sans ItemList ni liens vers des fiches de démonstration ; les URL paginées déjà connues ne deviennent pas des 404. Le sitemap n’ajoute alors aucune pagination issue du repli.

## Régression

`scripts/digital-categories.test.mjs`, inclus dans `test:seo` et `test:digital`, couvre les quatre natures, les bornes de pagination, la traversée exhaustive sans doublon, le HTML rendu, les métadonnées/canoniques, l’arabe, les états vide/panne et le maillage existant.

Vérifications locales : `npm ci`, `npm run test:seo` (204 tests), `npm run test:digital` (294 tests), `npm run typecheck`, `npm run lint` (aucune erreur ; avertissement React Hook Form préexistant dans `cta-form.tsx`). `npm ci` signale des vulnérabilités préexistantes dans les dépendances, non modifiées dans ce chantier SEO.

Vérifications complémentaires : build de production, réponses HTTP des quatre rayons (200), catégorie inconnue et page invalide (404), maintien de `/codes?kind=game_topup` (200), quatre rayons dans le sitemap local, `seo:check` et `audit:catalog` réussis. Le garde-fou SEO distingue désormais les collections des fiches produits et conserve les query strings de pagination lors de la lecture du sitemap et du contrôle des canoniques.
