# Audit de reprise G2G / FazerCards — pilote suspendu

## Décision

**Pas de vente ni d'achat réel pour l'instant.** La production ne constitue pas une chaîne de livraison automatique complète : garder toutes les offres G2G à stock zéro, les mappings désactivés et `G2G_AUTO_DELIVERY` non armé. Vérifier ces états directement sur les plateformes ; ils ne sont pas attestés par cet audit statique. Une modification directe chez G2G contourne les garde-fous du site.

## Informations reçues des supports

- G2G, ticket 5964546 : la suspension passée n'était liée ni à une commande spécifique ni à l'intégration API ; le motif précis n'a pas été communiqué. Le vendeur doit fournir des codes légitimes et valides et pouvoir apporter des justificatifs en cas de litige. G2G renvoie aux politiques et à la documentation sans répondre explicitement sur l'achat après commande, les délais ou un environnement de test.
- Réponse FazerCards communiquée par l'utilisateur : `POST /giftcards/order` renvoie `order.id`, `GET /orders/{orderId}` retourne les codes lorsque le statut est `completed`, et la clé `Idempotency-Key` est acceptée pendant 7 jours. Cette confirmation ne prouve pas que notre parcours G2G l'utilise ; aucun achat réel n'a été effectué pour le vérifier.
- Aucun secret ni code réel ne doit figurer dans ces notes, journaux, fixtures ou réponses publiques.

## Offre pilote choisie

L'utilisateur a confirmé le choix **Google Play Turquie 25 TRY** : offre G2G `G1795076410074VF`, catégorie fournisseur `google_play_tr`, carte `25_try`. Ce choix ne valide ni le mapping en production, ni la disponibilité, ni le prix, ni le format de livraison ; il n'autorise aucune activation de stock ou commande réelle. Tous ces points restent à vérifier avant le pilote.

## Contrat G2G documentaire

- [order.api_delivery](https://docs.g2g.com/order-api-delivery-18583502e0.md) : l'exemple gift card contient `order_id`, `offer_id`, `delivery_summary.delivery_id`, `requested_qty` et `expired_at`. L'échéance doit être vérifiée pour chaque commande : aucun délai universel ne doit être déduit de l'exemple.
- [Deliver Code](https://docs.g2g.com/deliver-code-18583491e0.md) : le POST de livraison utilise `delivery_id` et `codes[]` avec `content`, `content_type: text/plain` et `reference_id`. Le format de `content` dépend de l'offre ; [Get Offer](https://docs.g2g.com/get-offer-18583485e0.md) indique `code_label`. Il reste à vérifier le format exact de l'offre pilote et sa compatibilité avec un code Google Play seul.
- [Get Delivery Status](https://docs.g2g.com/get-delivery-status-18583492e0.md) décrit notamment les états `pending`, `in_progress`, `partial_delivered`, `delivered`, `unfulfilled` et `expired`. Un POST accepté n'est pas une preuve finale de livraison : vérifier le statut et les quantités avant toute reprise ou conclusion.
- [Webhook Resend Policy](https://docs.g2g.com/webhook-resend-policy-1237167m0.md) : sans réponse HTTP 200, jusqu'à cinq nouvelles tentatives après 30, 60, 120, 240 et 480 minutes. La déduplication et les reprises doivent être sûres malgré les replays et les crashes.

## État du code inspecté

- `src/app/api/webhooks/g2g/route.ts` : le webhook réserve et journalise la livraison ; le chemin d'achat est conditionné par `automaticDeliveryVerified()` et reste bloqué par la configuration actuelle du code. Les coûts ne doivent pas apparaître dans la réponse webhook.
- `src/app/api/admin/g2g/offer-qty/route.ts` : l'activation positive est bloquée tant que la livraison automatique n'est pas vérifiée. `src/lib/g2g-stock-price.ts` ne remonte pas de stock dans la version inspectée.
- `src/lib/g2g-purchase.ts` : une modification locale prépare une clé aléatoire et persiste atomiquement la clé, le corps et la date avant l'appel fournisseur ; elle est transmise au POST. La garde de livraison non vérifiée bloque également l'achat directement. Aucun retry d'achat après timeout ou crash n'est activé. Les tests utilisent des mocks, sans base PostgreSQL réelle ni fournisseur. Une ancienne opération ambiguë doit être rapprochée manuellement ; une clé ajoutée après coup ne sécurise pas rétroactivement une requête antérieure.
- `src/lib/g2g-delivery.ts` : les livraisons ne sont pas envoyées automatiquement ; les cas concernés sont orientés vers une revue manuelle. Le format exact et le statut final ne sont pas intégrés de bout en bout.
- La confirmation fournisseur concerne une durée de 7 jours, mais aucun mécanisme de reprise après crash, vérification de fenêtre ou réémission n'est ici mis en service. Ne pas relancer automatiquement une opération, avec ou sans clé.

## Travaux avant tout pilote réel

1. Vérifier les conditions G2G applicables : achat après commande, livraison, preuves de provenance, tests autorisés et échéances. En cas de doute, obtenir une réponse explicite du support.
2. Confirmer une seule offre pilote, son SKU fournisseur, devise et région, le type de livraison et `code_label`, ainsi que le prix, la commission et le coût de conversion. Ne relever `api_qty` sur aucune autre offre avant validation du pilote.
3. Auditer et tester en conditions transactionnelles réelles (sans achat) la persistance de la clé FazerCards et de la requête ; concevoir séparément toute reprise, la fenêtre de 7 jours et le traitement des anciennes commandes sans clé. Ne jamais relancer après expiration ou sur une opération historique ambiguë sans rapprochement manuel.
4. Vérifier sur les contrats fournisseur le schéma exact `order.id` et les structures `code`/`codes` ; tester uniquement avec des fixtures fictives. Refuser toute extraction incertaine, code manquant ou nombre incohérent. Ne transmettre aucun code avant `completed` vérifié.
5. Implémenter et tester la livraison G2G et sa confirmation : statut, quantités, échecs partiels, expiration, annulation, crash, double webhook, timeout et reprise. Si résultat ambigu, vérifier le statut G2G avant tout nouvel envoi ; escalader manuellement si l'état reste incertain.
6. Vérifier marge, solde fournisseur, alertes et procédure manuelle, y compris conservation sécurisée des justificatifs. Tester sans achats et sans secrets exposés.
7. Seulement après revue, tests de bout en bout sans dépense et accord explicite : envisager un pilote unique à quantité maximale 1, avec surveillance humaine et procédure d'arrêt. Ne pas interpréter cette liste comme une autorisation d'activation.


## Nouvelle offre et travaux en préparation locale

D'après la capture transmise par l'utilisateur, la nouvelle offre Google Play TR 25 TRY semble être `G1795521210943KM` ; elle affichait prix 1 USD et stock 0. Il faut confirmer son identifiant et ses valeurs par lecture directe de l'API avant toute configuration. L'ancien identifiant `G1795076410074VF` correspond à l'offre antérieure retirée ; ne pas le réutiliser comme pilote. Le coût fournisseur de 0,49 USD est déclaré par l'utilisateur et reste à vérifier au moment du pilote.

Un diagnostic admin local en lecture seule permet d'afficher les champs d'une offre (notamment `code_label`, `delivery_type`, quantités et prix), sans créer de mapping ni modifier le stock. Il n'a pas été exécuté contre l'API réelle dans cet environnement. L'écran d'ajout manuel de codes vu par l'utilisateur comporte un champ Code ; cela ne prouve pas à lui seul le format de livraison API.

Un prototype de validation pure dans `src/lib/g2g-delivery-assessment.ts` teste des formes fictives `order.code` et `order.codes` uniquement après `completed`, ainsi que la confirmation du statut et des quantités G2G. **Il n'est pas raccordé à la file ni à un appel réseau** : le schéma exact de la réponse fournisseur et le format de l'offre n'ont pas été confirmés, aucune chaîne n'est prête à être envoyée, et aucun statut de livraison ne doit être avancé en production par ce prototype. Les erreurs, états ambigus et livraisons partielles exigent une intervention humaine. La livraison, les achats et l'activation de stock restent bloqués ; les tests simulés ne valident pas la concurrence PostgreSQL ni une livraison réelle.
