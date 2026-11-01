# Révision admin — 1 novembre 2026

## État production observé (lecture seule)

Sources : https://nokhba.net.ly/api/health (horodatage retourné :
2026-11-01T09:19:47.317Z) et https://nokhba.net.ly/codes.

- Neon : `database.connected: true`, latence 701 ms, aucune erreur de quota.
- Catalogue : `catalog.degraded: false` ; la boutique publique affiche 775 produits
  (293 recharges, 121 cartes cadeaux, 361 clés).
- NOWPayments : clé valide, mode réel, secret IPN configuré.
- FazerCards : accès valide ; catalogue en cache, 775 produits.
- E-mail : Resend configuré, réponse et notifications vers contact@nokhba.net.ly.
  L'existence et la réception effective de cette boîte ne sont pas confirmées.
- Reloadly : toujours en sandbox ; fournisseur historique, à distinguer des ventes
  FazerCards actuelles. Ne pas basculer ses anciennes commandes vers FazerCards.

Ce constat ponctuel confirme la fin du blocage Neon observé, mais pas un achat,
une livraison ou un solde fournisseur suffisant. Aucune transaction, relance,
écriture métier ou modification d'environnement n'a été déclenchée pour cet audit.

## Corrections réalisées

- Menu regroupé par Boutique digitale, Création de sites & Contact, contenus et
  réglages, puis outils historiques/pages secondaires.
- Les raccourcis publics correspondent à Accueil, Boutique, Création de sites,
  Contact. Une seule entrée active, même sur les sous-pages des commandes digitales.
- Tableau de bord : accès directs au catalogue réel et aux commandes digitales.
  Les compteurs existants sont explicitement ceux des demandes/paiements web,
  pas un total mélangeant ventes digitales et projets web.
- En panne : indicateurs indisponibles (`—`), pas de faux zéro ni de faux message
  « aucune demande » ; suppression de l'affirmation que le site fonctionne normalement.
- Diagnostic manuel sur le tableau de bord, sans cache, avec délai maximal.
  Les états inconnus ne deviennent pas verts ; un HTTP 500 contenant un diagnostic
  est lisible ; un échec de requête efface les anciens résultats.
- L'ancien constructeur est identifié comme héritage : l'ordre et la visibilité de
  ses sections ne pilotent plus l'accueil fixe. Aucune donnée historique supprimée.
- L'éditeur Hero précise que seul son sous-titre est repris par `/creation-sites` ;
  la bannière d'accueil reste une photo sans texte. Les autres champs sont conservés.
- Le catalogue `/apps` et `/products` est explicitement distinct de `/codes`.

## Reprise de l'ancien travail — prochaines vérifications

Dans l'admin authentifié sur l'environnement cible :

1. Consulter le solde FazerCards et l'audit de marge (coût, frais, prix de vente).
2. Vérifier les montants disponibles, plateformes et régions, surtout les cartes
   cadeaux : l'affichage d'un produit n'est pas une preuve de stock.
3. Examiner les commandes bloquées et leur fournisseur sans relance globale.
   Une commande déjà livrée ne doit jamais être achetée une seconde fois.
4. Confirmer la réception de contact@ et une livraison transactionnelle contrôlée.
5. Seulement avec accord sur la dépense, réaliser un test de bout en bout au montant
   convenu : identifiant joueur validé si requis, paiement, IPN, livraison et e-mail.

Le cas AFK Journey documenté reste un dossier support, pas une commande à relancer
(`incident-recharge-afk-journey.md`). Le rétablissement Neon ne le résout pas.

## Limites de validation

Tests structurels, logique d'entrée active, TypeScript, lint ciblé, tests SEO,
tests digitaux et build de production. Pas de session administrateur authentifiée
utilisée pour tester les formulaires en production ; aucun secret récupéré.

## Retrait de Reloadly demandé avant publication

- Suppression des panneaux de connexion, synchronisation, ancien éditeur et audit
  Reloadly du parcours actif ; le catalogue admin présente uniquement FazerCards.
- Suppression du contrôle Reloadly dans `/api/health` et du diagnostic admin.
- Anciennes API admin : authentification conservée, puis réponse `410 supplier_retired`.
- Ancienne caisse bloquée avant catalogue, base et facture ; les caisses FazerCards
  restent distinctes et inchangées.
- Relances de livraison historiques bloquées côté serveur et retirées de l’interface ;
  le cron ne considère plus cet ancien fournisseur comme disponible.
- Anciennes actions de synchronisation, recalcul et édition bloquées côté serveur.
- Tables, identifiants fournisseur et codes chiffrés conservés : aucune migration
  destructive ni bascule d’une ancienne commande vers FazerCards.
- Les modules et tests historiques restent en compatibilité, pas en intégration active.
  Les anciennes variables distantes ne sont pas supprimées automatiquement, mais ne
  réactivent aucun des parcours bloqués. Le modèle `.env.example` ne les propose plus.
