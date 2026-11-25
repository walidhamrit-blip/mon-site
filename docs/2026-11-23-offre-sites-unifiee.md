# Offre sites unifiée — 23 novembre 2026

## Offre appliquée

- Base unique de **35 USD**, tous les modèles au même prix.
- Code statique, une langue, responsive.
- Personnalisation initiale du contenu fourni (logo, textes, images, coordonnées) dans la structure du modèle : **incluse, 0 USD**.
- Mise en ligne sur une adresse `vercel.app`, sous réserve de l’éligibilité et des limites du forfait Vercel utilisé. Aucun domaine personnalisé ni hébergement gratuit à vie promis.
- Sans base de données ni panneau d’administration dans la base ; commandes/demandes de réservation WhatsApp traitées manuellement.
- Langue supplémentaire : **10 USD / langue**, traduction fournie par le client.
- Gestion du contenu : **à partir de 10 USD supplémentaires**, base de données et administration nécessaires incluses, périmètre à confirmer.
- Réservations, boutique et paiement en ligne : **sur devis**, sans inventer de prix. Chaque module inclut sa gestion ; socle commun non facturé deux fois.
- Domaine personnalisé, maintenance et éventuels coûts externes/récurrents séparés et annoncés avant accord.

## Parcours

Le paiement direct concerne uniquement la base à 35 USD. Les options sont discutées via un lien WhatsApp contextualisé, puis confirmées par devis écrit avant facturation séparée. Aucun supplément de langue ou de gestion n’est ajouté silencieusement au checkout. Aucun développement de CMS/boutique/réservation pour les sites livrés n’est inclus dans cette modification de l’offre commerciale du site de l’agence.

Les fonctions visibles dans les démonstrations ne sont pas automatiquement actives dans l’offre statique ; cette distinction est affichée sur la galerie et dans les tarifs.

## Source de vérité et compatibilité

- `src/lib/website-offer.ts` : prix, offre de base, options AR/EN et résumé partagé.
- `config.pricing.plans` : une seule entrée `static-site`.
- `mergeConfig` normalise les anciens tarifs persistés à la lecture ; aucune migration destructive des commandes n’est exécutée.
- `resolveDemoClassification` ignore les anciens `planId`, `categoryTier` et `priceUsd` propres aux modèles dès que l’offre unifiée est présente.
- Le serveur de paiement utilise cette même configuration et le même calcul ; le navigateur ne choisit pas le prix.
- Les montants déjà enregistrés des commandes, échéanciers, réservations et abonnements existants ne sont pas réécrits.
- L’administration n’expose plus d’anciennes catégories, de prix propres aux modèles ni de taux automatique de 20 %. Le récapitulatif commercial y est en lecture seule ; les tarifs sont centralisés dans le module ci-dessus.
- FAQ commerciales et sous-titre/chips du hero alignés à la lecture, y compris avec des réglages antérieurs en base. Questions personnalisées hors des questions commerciales reconnues conservées.

## Surfaces mises à jour

Tarifs, création de sites via le composant partagé, galerie, badges des modèles/visionneuses, fiches, détail du prix, checkout, formulaire de demande, réglages et édition de modèles admin, FAQ, guides de prix/boutique/clinique, comparatifs, précisions des abonnements et conditions, assistant local/IA, llms.txt et llms-full.txt. Les données structurées de prix sont alimentées par la configuration partagée.

## Vérifications

- `npm test` : **1 159 tests réussis**, dont 13 tests de l’offre et de sa cohérence, ainsi que les régressions assistants/abonnements.
- `npm run typecheck` : réussi.
- `npm run build` : réussi.
- `npm run lint` : aucune erreur ; un avertissement React Compiler préexistant concernant `react-hook-form` / `watch` dans le formulaire.
- Contrôles HTTP du build de production local : 200 et contenu attendu pour `/pricing` AR/EN, `/creation-sites?lang=en`, `/demos?lang=en`, `/demos/myphone-tripoli?lang=en`, le guide de prix, `/llms.txt` et `/llms-full.txt`.
- Aucun test de paiement réel, aucun déploiement Vercel de production. Sans `DATABASE_URL` dans cet environnement, l’aperçu utilise le repli prévu ; les réglages persistés sont couverts par tests hors ligne.
- Pas de validation visuelle navigateur : les binaires Playwright ne sont pas installés dans l’environnement.


## Audit transversal demandé ensuite

Corrections supplémentaires effectuées sur les sources et l’aperçu de production local :

- Abonnements : maintenance facultative d’un site **déjà créé**, pas une seconde grille d’achat de sites ; catalogue de prix réutilisé, aucune modification des identifiants ni des tarifs historiques. Débits non automatiques, cycles 30/365 jours, fin des services de maintenance selon l’accord et non perte automatique des fichiers. Retrait de la fausse promesse « deux mois offerts ».
- Délais : suppression des garanties génériques 7 jours / 7–14 jours dans l’accueil, les comparatifs, fiches, secteurs, métadonnées, manifeste PWA, cartes sociales, e-mails et HowTo JSON-LD. Calendrier confirmé selon le contenu, le modèle et les fonctions. Les choix de délai souhaité dans le formulaire restent des **demandes du client**, pas des engagements.
- Portée : démonstrations et fonctions prévisualisées distinguées explicitement de la base statique ; langue supplémentaire, gestion de contenu, modules connectés et prestations sur mesure distingués. Aucun changement des garanties des produits des clients représentés dans les démos.
- Révisions, SEO et support : retrait des promesses universelles de deux révisions gratuites, 30–90 jours de support, score Lighthouse fixe ou classement garanti. Les devis de prestations spécifiques et droits contractuels restent distincts.
- Acompte : la page de paiement, la réservation, les conditions et les assistants expliquent que le crédit se fait sur une **facture de solde confirmée par l’équipe**. Le checkout plein tarif **ne déduit pas automatiquement** l’acompte. Aucun automatisme fictif ajouté au paiement.
- Paiement : ne pas promettre espèces ou virement bancaire systématiquement ; les moyens manuels doivent être réellement actifs dans le checkout et vérifiés. Retrait des affirmations « aucune donnée de paiement conservée » : les références/adresses fournies en transfert manuel sont conservées pour vérification, mais aucune clé privée ou phrase de récupération n’est demandée.
- Assistants : plafonds de vente numérique tirés de la politique partagée (110 USD par commande / plafond cartes cadeaux), acompte issu de la configuration, abonnements clairement facultatifs.
- Anciens textes : normalisation **à la lecture** de 61 anciennes valeurs par défaut exactes (`website-content-migration.ts`), sans réécrire les commandes. Les textes personnalisés et listes volontairement vides sont préservés ; une personnalisation inconnue en production doit donc encore être examinée en base. Nouvelle version de clé du cache partagé du site.

### Contrôles de l’audit

- `npm test` : **1 159 / 1 159**.
- TypeScript, build de production : réussis ; lint : 0 erreur, avertissement React Hook Form préexistant.
- `node scripts/audit-website-content.mjs` sur le build local : **118 contrôles réussis**, couvrant 58 routes du site en AR/EN et les deux index IA, sans achat ni soumission de paiement. Le script vérifie HTTP 200, l’absence de plusieurs anciennes promesses et les principales précisions commerciales. Les fiches de stock numérique dépendantes de la base sont exclues.
- Limites inchangées : **pas de déploiement**, de contrôle de base de production, de transaction réelle ou de validation visuelle navigateur. La base n’est pas disponible ici ; les tests d’anciens réglages sont hors ligne. Les liens/démos externes et avis tiers ne sont pas certifiés par cet audit.


### Contrôle public complémentaire

Voir `docs/2026-11-23-controle-production.md` : le site public sert toujours l’ancienne grille, et la connexion Vercel actuelle ne donne pas accès à l’équipe propriétaire. Le contrôle ciblé public ne remplace pas une lecture directe Neon. Les dernières corrections supplémentaires restent locales ; elles ont passé 1 159 tests et 118 contrôles HTTP du build local.
