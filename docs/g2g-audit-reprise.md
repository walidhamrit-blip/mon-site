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


## Lecture réelle de l'offre et préparation de la reprise

Le diagnostic utilisé par l'utilisateur en production a retourné pour `G1795521210943KM` : Google Play Gift Card TRY 25 (TR), `live`, prix 1 USD, minimum 1, `api_qty` 0, `available_qty` 0, `delivery_type` `instant_inventory`, `code_label` `Code`. Il s'agit d'une capture ponctuelle : revérifier ces valeurs et les autres stocks avant toute vente. Le formulaire d'inventaire manuel indique également un champ Code, mais ne démontre pas le fonctionnement complet d'une livraison OpenAPI après commande. Les modalités et échéances restent à confirmer.

Travaux locaux complémentaires : `g2gGetDeliveryStatus` prépare le GET signé de l'état d'une livraison, et `g2g-delivery-plan.ts` simule les décisions : attente fournisseur, réservation préalable à l'envoi, lecture de statut après un envoi ambigu, confirmation seulement après vérification de l'état et des quantités, ou revue humaine. Aucune de ces briques n'est raccordée à la file réelle ni ne transmet de code. Il faut encore implémenter et prouver le stockage transactionnel de l'intention d'envoi, le contrôle d'annulation/expiration avant envoi, la gestion des interruptions et les tests de bout en bout sur base réelle sans dépense. Ne jamais réémettre automatiquement après un envoi incertain.

La réponse du support FazerCards confirme que les champs `code` ou `codes` contiennent le code après `completed`, mais ne fournit pas la structure JSON exacte dans `GET /orders/{orderId}`. L'extracteur de démonstration suppose `order.code` ou `order.codes` ; ne pas le brancher en production avant de confirmer le schéma exact au moyen d'une réponse fictive documentée. Aucun code réel ne doit être partagé pour cette vérification.


## Précisions du support FazerCards

L'utilisateur a communiqué une nouvelle réponse écrite du support : l'objet `order` contient `id` et `status`, puis après `completed`, `code` (chaîne pour une carte) ou `codes` (liste de chaînes pour plusieurs). Les champs de code sont absents avant `completed`. Cette précision correspond au prototype strict, qui refuse les formes contradictoires et les mauvaises quantités. Le support ne confirme pas la structure `cards` citée par la documentation ; elle reste donc non prise en charge. Aucun exemple JSON complet ni essai fournisseur n'a confirmé les autres champs ou comportements, et le prototype reste non raccordé à la production. Le statut de livraison G2G et toutes les garanties de concurrence et reprise restent à valider ; ne pas activer le stock.


## Simulation du parcours de livraison

`scripts/g2g-delivery-simulation.test.mjs` assemble les évaluateurs dans un modèle isolé à transport fictif : attente fournisseur, réservation simulée, accusé, confirmation, doublons concurrents, crash et timeout. La réservation en mémoire n'est qu'une hypothèse atomique : elle ne démontre pas un verrou PostgreSQL, une persistance durable, l'absence de course entre révocation et envoi, ni la validité du contrat réseau réel. Le contrôle avant envoi est également simulé. Le code produit et les chronos restent inchangés ; la livraison reste bloquée en production. Il faut encore concevoir et tester le stockage transactionnel, les interruptions réelles, l'annulation et la confirmation G2G avant toute activation.


## Prototype de réservation PostgreSQL non raccordé

`docs/g2g-dispatch-reservation-prototype.sql` et `src/lib/g2g-dispatch-reservation-prototype.ts` préparent une intention d'envoi unique par commande/livraison, sans stocker de code et sans bail automatiquement récupérable. L'insertion utilise un `INSERT ... ON CONFLICT DO NOTHING` et l'horloge de la base pour refuser une échéance passée. L'écriture doit être commitée avant tout effet externe ; un commit incertain implique une revue. Ce prototype n'est pas une autorisation d'envoi et ne vérifie pas les annulations, la fraîcheur des données G2G ou l'identité/quantité fournisseur. Il n'est raccordé à aucun cron ni schéma de production, ni déployé. Tests unitaires simulés uniquement : concurrence et crash réels sur PostgreSQL, droits et migration restent à vérifier dans une base de test dédiée. Aucun SQL ne doit être appliqué en production à ce stade.

### Essai sur la base Supabase dédiée

Avec l'accord de l'utilisateur, la table prototype a été créée dans le projet distinct `g2g-test`, avec RLS activée et privilèges `anon` et `authenticated` révoqués. Avec des identifiants fictifs, deux requêtes concurrentes sur deux processus PostgreSQL distincts visant la même clé ont renvoyé respectivement 1 et 0 réservation ; une seule ligne persistait. Une échéance passée a donné 0 insertion et un `ROLLBACK` a laissé 0 ligne. RLS activée, SELECT `anon` et INSERT `authenticated` refusés par les privilèges vérifiés. Les lignes fictives de réservation restent dans la table de test. Le test porte sur des requêtes SQL équivalentes, pas sur le chemin TypeScript complet ni un crash réel du worker : la reprise après interruption, la fraîcheur et l'annulation, les transactions applicatives et les appels distants restent à prouver. Aucun achat, envoi ni modification de production.

### Orchestration transactionnelle simulée

`reserveCommittedPrototype` prépare BEGIN/insertion/COMMIT sur connexion exclusive et retourne `uncertain` en cas d'erreur, y compris une réponse COMMIT perdue. Le test `scripts/g2g-transaction-workflow.test.mjs` utilise cette fonction avec un client PostgreSQL simulé, une réservation en mémoire et un transport fictif : vérifie l'ordre COMMIT/envoi, doublon après crash simulé, timeout, échec de commit, expiration et statuts distants non livrables. Ces tests ne sont pas raccordés au cron ni aux API. Le connecteur Supabase exécute des requêtes SQL mais ne fournit pas de connexion PostgreSQL au processus Node ; on n'a donc pas exécuté cette fonction TypeScript contre `g2g-test`, ni simulé un vrai crash de processus sur cette base. Les essais SQL réels précédents ne remplacent pas ce test d'intégration. La validation transactionnelle, la lecture fiable d'annulation, la course entre contrôle et POST et la confirmation distante restent bloquantes.

### Test PostgreSQL manuel préparé pour GitHub Actions

`.github/workflows/g2g-postgres-manual.yml` et `scripts/g2g-postgres-integration.mjs` préparent, sans exécution automatique, un essai Node/PostgreSQL sur le seul projet `g2g-test` (`tghunxntbjtkvvmyvxwh`). Le script exige le secret GitHub `G2G_TEST_DATABASE_URL`, vérifie l'hôte ou l'utilisateur du pooler et le nom de base, impose TLS vérifié et refuse les paramètres URL. Il utilise des identifiants fictifs aléatoires, deux connexions pour la concurrence, une échéance passée, un rollback et un arrêt de processus après COMMIT, puis tente de supprimer uniquement ses propres lignes de test. Aucun code ni fournisseur réel. Si le nettoyage échoue, les lignes fictives peuvent rester et le test échoue. Le script ne teste ni un vrai envoi ni la reprise après envoi ; il ne vérifie pas les règles métier ou l'annulation.

Le secret doit être ajouté par l'utilisateur dans les réglages GitHub, jamais dans la conversation ou le dépôt. L'URL doit viser exclusivement `g2g-test` (connexion PostgreSQL directe ou session/transaction pooler Supabase adaptée), sans paramètre de requête. La table prototype doit déjà exister et le compte de test doit y avoir accès. Le workflow `workflow_dispatch` n'est proposé par GitHub que si son fichier existe sur la branche par défaut ; la sélection de la branche à tester doit ensuite être vérifiée. Le workflow et le script sont locaux et n'ont pas été exécutés sur GitHub ni connectés à Supabase depuis Node. Ne pas fusionner ni déployer sans revue et accord. La réservation reste non raccordée à la livraison réelle.
