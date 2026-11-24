# Guide interactif de choix du site

## Parcours

- Guide AR/EN intégré au composant Tarifs commun aux pages `/pricing` et `/creation-sites`, ancre `#website-guide`.
- Accès depuis la galerie `/demos` et la navigation de création.
- Choix de l'administration du contenu, du nombre de langues supplémentaires, des modules de réservation/boutique/paiement et des besoins particuliers.
- Résumé actualisé, montant indicatif dans la devise d'affichage du site, message de contact chiffré en USD.
- Contact WhatsApp prérempli, copie du résumé avec aperçu copiable en cas d'indisponibilité du presse-papiers, lien vers les autres moyens de contact.
- Les choix restent en mémoire de la page. Aucun envoi automatique, aucune commande ni aucun paiement n'est créé.

## Calcul et limites

- Base statique une langue : 35 USD. Personnalisation initiale du contenu fourni : 0 USD.
- Chaque langue supplémentaire : 10 USD, traduction fournie par le client. Au-delà du sélecteur ou pour une traduction : contact.
- Administration seule : à partir de 10 USD supplémentaires, donc estimation à partir de 45 USD.
- Réservation/boutique/paiement : sur devis, sans tarif inventé. L'administration et la base nécessaires sont cadrées dans le devis du module, pas ajoutées une deuxième fois.
- Un besoin non chiffré affiche « partie connue seulement — pas le total du projet ». Une note personnalisée déclenche aussi cette réserve.
- Domaine, coûts externes/récurrents et frais de prestataires non inclus dans le sous-total. Publication vercel.app sous réserve d'éligibilité et de limites Vercel.
- Le calculateur utilise les constantes canoniques de `website-offer.ts`, jamais les données de paiement.

## Correction liée à la navigation bilingue

Le test navigateur a révélé que le layout utilisait la langue de la requête comme langue principale dans le provider. Un lien EN pouvait ainsi perdre `?lang=en` et revenir à l'arabe après rechargement. Le provider reçoit maintenant la véritable langue principale du site, distincte de la langue de l'URL. Le rendu initial reste aligné sur la langue demandée. Régression couverte.

## Validation locale

- `npm test` : 1 182 tests réussis, dont 13 tests du guide (1 056 combinaisons de calcul parcourues).
- `npm run build` : réussi.
- `npm run typecheck` : réussi.
- `npm run lint` : aucune erreur ; avertissement préexistant React Hook Form dans `cta-form.tsx`.
- `scripts/website-guide-browser.mjs` : parcours Playwright sur build local, bureau EN et mobile AR/RTL ; calculs réactifs, clavier, demande personnalisée, URL WhatsApp, copie/aperçu, réinitialisation, navigation et absence d'envoi de requêtes d'écriture. Aucun message WhatsApp n'a été envoyé.

Pour relancer : démarrer le site puis `CHROMIUM_EXECUTABLE_PATH=/chemin/vers/chromium node scripts/website-guide-browser.mjs` (ou utiliser le Chromium installé par Playwright). Captures temporaires sous `.scratch/`, non versionnées. Pas de dépendance de production ajoutée.

Environnement local sans `DATABASE_URL` : réglages de secours publics, pas de modification Neon et pas de validation de données privées de production. Ces changements ne sont pas publiés par ce travail local.
