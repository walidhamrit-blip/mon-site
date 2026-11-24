# Contrôle du site public — Vercel + Neon

## Conclusion

**La version publique consultée affiche toujours l’ancienne offre.** Le correctif à 35 USD existe dans la branche de travail, sans push ni fusion à ce stade : cette ancienne version publique est donc attendue, et ne constitue pas un échec des correctifs locaux. Le contrôle public devra être répété après fusion et déploiement.

Contrôle effectué en lecture seule, sans déploiement, modification de base, paiement ou soumission de formulaire. Les pages publiques fournissent des indices sur la configuration servie, pas un export ni une lecture directe des tables Neon.

## Constats publics

| Surface consultée | Constat |
| --- | --- |
| `/pricing` et `/pricing?lang=en` | Trois catégories : modèles 60 / 100 / 299 USD, personnalisation 10 %, totaux 66 / 110 / 328,90 USD. Pas encore l’offre unique à 35 USD. |
| `/creation-sites?lang=en` | Même ancienne grille ; certains modèles ont encore un prix propre de 120 USD, total 132 USD. Anciennes promesses de délai et support. |
| `/demos/myphone-tripoli?lang=en` | Modèle 299 USD, supplément de personnalisation 29,90 USD, total 328,90 USD ; tableau de bord et fonctions boutique présentés dans l’ancienne catégorie. |
| `/pricing` / sa FAQ | Acompte de 5 USD dans le bandeau, mais 1 USD dans la FAQ. |
| `/abonnements?lang=en` | Prix de maintenance récurrents présentés comme incluant la création de sites de 5 ou 10 pages, ou d’un magasin complet. Mention incorrecte d’environ deux mois économisés annuellement. |
| `/contact` et `/contact?lang=en` | Heures de fermeture contradictoires : **22 h en arabe, 18 h en anglais**, mêmes jours samedi–jeudi. Mention « ouvert maintenant » sans calcul de l’heure et promesses non qualifiées de réponse en 2 h. |
| `/conditions?lang=en` | Les conditions expliquent déjà les transferts manuels et leur vérification ; cela contredit les affirmations publiques générales de paiement exclusivement crypto ou d’absence de données de paiement conservées. |
| `/llms.txt` (premier fragment) | Répète la livraison en 7 jours, l’acompte configuré de 5 USD, les horaires contradictoires et une disponibilité de virement bancaire « sur demande ». |

La page de création comporte également un élément d’audit dans les réalisations : la qualité de publication de ce contenu mérite une revue éditoriale, indépendamment des tarifs. Aucune suppression automatique effectuée.

### URLs consultées

- https://nokhba.net.ly/pricing
- https://nokhba.net.ly/pricing?lang=en
- https://nokhba.net.ly/creation-sites?lang=en — premier fragment
- https://nokhba.net.ly/demos/myphone-tripoli?lang=en
- https://nokhba.net.ly/abonnements?lang=en
- https://nokhba.net.ly/contact
- https://nokhba.net.ly/contact?lang=en
- https://nokhba.net.ly/conditions?lang=en
- https://nokhba.net.ly/llms.txt — premier fragment, pas l’index entier

## Accès à l’infrastructure

- Le connecteur Vercel est activé.
- La liste des projets du périmètre personnel retourne **zéro projet**.
- La liste des équipes est refusée : **Access denied**, autorisations ou périmètre insuffisants.
- Aucun connecteur Neon n’est proposé par cet environnement.
- Pas de `DATABASE_URL` dans l’environnement local.

En conséquence : **pas de lecture directe Neon**, pas de vérification des variables de production, du commit déployé ou de l’état des déploiements. Aucun secret n’a été demandé, extrait ou enregistré.

## Compléments apportés au code après cette vérification

En complément de l’audit précédent :

- Suppression des dernières mentions non qualifiées de réponse en 2 h dans les traductions, le CTA arabe et les écrans de paiement.
- Suppression de l’état « ouvert maintenant » statique, remplacé par un rappel des heures publiées.
- Index IA : moyens de paiement conditionnés à leur activation effective dans le checkout ; traitement manuel du crédit d’acompte expliqué, montant lu dans la configuration.
- Reconnaissance de la variante arabe exacte du CTA trouvée sur le site public dans la normalisation des anciens contenus.
- Régression basée sur les **valeurs publiques observées** : 60/100/299 USD + 10 %, modèle à 120 USD, acompte à 5 USD. L’offre affichée devient 35 USD / personnalisation 0 USD, tout en conservant l’acompte configuré à 5 USD et les données historiques.
- Contrôle HTTP local renforcé contre le retour de ces dernières formulations.

Le propriétaire a ensuite confirmé une fermeture à **22 h**. Les valeurs par défaut arabe/anglais et le repli SEO ont été corrigés. La lecture des réglages reconnaît les anciennes valeurs connues 18 h / 23 h pour éviter leur réapparition après déploiement, sans modifier la base ni les données historiques.

## Reste nécessaire pour certifier la production

1. Rétablir la connexion Vercel sur le compte et l’équipe propriétaires du projet `mon-site`, avec accès en lecture au projet et aux déploiements. Ne pas transmettre de jeton en conversation.
2. Horaire confirmé par le propriétaire : **22 h**, correction locale prête.
3. Vérifier les contenus personnalisés Neon par une voie autorisée en lecture seule. Les montants de commandes et contrats historiques ne doivent pas être réécrits.
4. Après autorisation, pousser la branche, ouvrir et fusionner la PR, puis vérifier le déploiement Vercel, le domaine public, les réponses AR/EN, les métadonnées et les index IA. La connexion Vercel n’est pas une condition pour pousser la branche ou ouvrir une PR via GitHub.

Le présent contrôle **n’a pas déclenché la mise en ligne**.


## Validation des compléments locaux

- **1 159 tests réussis**, aucun échec.
- **118 contrôles HTTP** réussis sur 58 routes locales en AR/EN et les deux index IA.
- TypeScript et build de production local réussis.
- Lint : aucune erreur, un avertissement React Compiler préexistant (`react-hook-form` / `watch`).

Ces résultats concernent le code corrigé et l’aperçu local, **pas la version publique encore ancienne**.
