# Paiement par carte téléphonique avec livraison manuelle

Cette option permet au client d’acheter un code ou une carte cadeau du catalogue FazerCards avec une carte de recharge **Libyana** ou **Al Madar**. Le site ne prétend pas vérifier le solde auprès de l’opérateur : la vérification et la livraison sont humaines.

## Formule du prix indicatif en LYD

Le devis affiché au client utilise le **total USDT de la commande, quantité comprise** :

> **Total LYD = total USDT × taux USD/LYD du marché parallèle × 120 %**

Les **20 %** compensent la détérioration de valeur constatée lors de la revente des cartes téléphoniques. Ce calcul est une information commerciale, pas un taux officiel ni une confirmation de paiement.

Exemples avec **1 USD/USDT = 9,84 LYD** :

- `5 × 9,84 × 1,20 = 59,04 LYD` ;
- `10 × 9,84 × 1,20 = 118,08 LYD`.

Le navigateur demande un devis à `/api/fazercards/phone-card-quote`, mais le checkout **recalcule tout côté serveur** à partir du prix catalogue. Le client doit confirmer le calcul affiché. Si le montant, la source ou le taux change avant l’envoi, la commande est refusée et le nouveau devis doit être accepté.

### Source du taux

Dans **Admin → Réglages → Boutique digitale / FazerCards**, deux modes sont disponibles :

- **Médiane Telegram + Fulus/secours manuel** : le serveur lit les pages publiques `https://t.me/s/dollar_ly`, `https://t.me/s/lydollar` et `https://t.me/s/suqalmushir`, sans compte ni clé API. Il ne retient que le **dollar en espèces**, jamais les chèques, virements Turquie, taux bancaires ou taux officiels. Au moins **deux canaux distincts** doivent fournir une publication de moins de **36 heures**, avec une date arabe cohérente avec la date Telegram et un écart maximal de **3 %** entre toutes les valeurs retenues. Le taux est leur médiane, arrondie à quatre décimales. Les abonnés, vues et réactions ne pondèrent jamais ce calcul.
- **Taux manuel uniquement** : aucun fournisseur automatique n’est consulté et le taux saisi par l’admin est utilisé.

Le client peut ouvrir les liens exacts des publications retenues et voir leur valeur, leur date et leurs vues au moment de la lecture. Ces références sont enregistrées en JSON avec le devis accepté pour l’audit admin. Les publications et le devis restent **communautaires et indicatifs**, pas une cotation officielle ni une garantie d’exécution.

Si le consensus Telegram échoue, le serveur essaie `GET https://fulus.ly/api/v1/rates/current` lorsque `FULUS_API_KEY` est configurée. Le taux manuel admin prend ensuite le relais. Les résultats automatiques sont mis en cache pendant 10 minutes ; sans taux manuel, le dernier résultat connu peut servir pendant au plus 6 heures et il est explicitement marqué comme ancien.

La date du taux manuel est enregistrée côté serveur à chaque modification. Sans consensus, Fulus, taux manuel ou dernier taux réutilisable valide, le dépôt d’une carte est bloqué : **aucun prix n’est inventé et le taux bancaire officiel n’est jamais substitué silencieusement**.

La clé facultative `FULUS_API_KEY` est un secret serveur à ajouter dans Vercel. Elle n’apparaît ni dans le navigateur, ni dans les réponses API, ni dans la documentation publique du site. Aucun accès Facebook privé ou restriction de connexion n’est contourné.

## Parcours client

1. Le client choisit sa carte cadeau, le montant et la quantité.
2. Dans la fenêtre d’achat, il sélectionne **Carte téléphonique** au lieu de **Crypto**.
3. Il consulte le devis en LYD, la source et l’horodatage du taux, la majoration de 20 %, puis coche la case confirmant qu’il a compris et accepté ce devis indicatif.
4. Il renseigne l’opérateur, la valeur de la recharge en LYD et son code, ainsi qu’un téléphone de contact.
5. Le site crée la commande sans facture NOWPayments et ouvre `/codes/commande` avec la référence et le jeton de suivi.
6. Le suivi indique **carte reçue, à vérifier**. Le client ne doit pas renvoyer le code.
7. Après acceptation admin, le suivi indique que la carte est acceptée et que le code cadeau arrive. Après refus, il indique que la carte n’a pas été acceptée et invite le client à contacter l’équipe.
8. Le code cadeau n’apparaît sur le suivi et dans l’e-mail client qu’une fois réellement émis (achat automatique chez le fournisseur) ou saisi par l’admin.

## Parcours admin

1. Ouvrir **Admin → Commandes de codes & cartes cadeaux** (`/admin/digital/orders`).
2. Dans **Cartes téléphoniques à vérifier**, contrôler l’opérateur, la valeur déclarée, le montant de la commande et les coordonnées du client.
3. Comparer la valeur de la carte au **devis effectivement accepté par le client** : montant USDT, taux, 20 %, total LYD, source et écart avec la carte déclarée.
4. Afficher puis copier le code de recharge. Vérifier/recharger le crédit par le canal habituel de l’opérateur.
5. **N’accepter qu’après avoir réellement reçu le crédit et vérifié qu’il couvre la vente.**
   - **Crédit vérifié — accepter et livrer** : la ligne de paiement passe à `paid`, la commande digitale à `manual`, puis le site **achète le code chez le fournisseur (FazerCards) et l’envoie au client** dans la même action. Le message indique le résultat : code livré, code en préparation, ou motif du blocage.
   - **Accepter sans livrer** : la carte est acceptée, mais aucun achat n’est déclenché ; le code est saisi à la main (commande déjà livrée par WhatsApp, fournisseur indisponible, client à recontacter).
   - **Refuser la carte** : saisir un motif interne ; le paiement passe à `failed`, la commande digitale à `failed`, et la livraison reste verrouillée.
6. Si la livraison automatique a été bloquée (plafond, fournisseur en panne, code pas encore émis), la carte affiche **Livrer le code automatiquement** pour relancer sans second débit dès que le code est disponible.
7. Sinon, ouvrir la commande dans la liste inférieure et cliquer **Saisir les codes manuellement**, puis saisir une carte cadeau par ligne : `NUMÉRO | PIN | URL_D_ACTIVATION` (PIN et URL facultatifs), puis **Enregistrer et envoyer au client**.

### Livraison automatique après acceptation

L’acceptation de la carte est le **contrôle humain** : elle confirme que le crédit a réellement été reçu. C’est seulement après ce geste que le code peut être acheté et envoyé sans autre intervention.

- La décision est centralisée dans `phoneCardDeliveryRoute()` (`src/lib/phone-card-core.ts`) et appliquée aux deux chemins d’achat (FazerCards et Reloadly historique) : carte non acceptée → **aucun achat possible**.
- L’achat exige le drapeau `phoneCardApproved`, transmis **uniquement** par une action admin authentifiée (`reviewPhoneCardPaymentAction`, `retryDigitalDeliveryAction`). Ni le cron de reprise, ni l’IPN, ni le suivi client ne le passent : aucun robot ne peut dépenser d’argent.
- L’opération est **idempotente** : une commande déjà livrée n’est jamais rachetée, et une transaction fournisseur existante sert à récupérer les codes au lieu de repasser commande.
- Les plafonds existants (plafond FazerCards, contrôle d’identifiant joueur, plafond Reloadly) restent appliqués : au-delà, la commande repasse en livraison manuelle avec un motif lisible.
- Si la carte est acceptée mais que le code n’arrive pas, **Livrer le code automatiquement** relance la récupération chez le fournisseur — jamais un second débit.

## Protections mises en place

- Code de recharge chiffré en **AES-256-GCM** avec la clé existante `DIGITAL_CODES_SECRET` (ou `SESSION_SECRET`).
- Empreinte **HMAC-SHA-256 unique** : le même code, même saisi avec des espaces ou tirets différents, ne peut pas être utilisé sur deux commandes.
- Le code secret n’apparaît ni dans le suivi public, ni dans les e-mails, ni dans les journaux applicatifs ajoutés par ce flux.
- Le code n’est déchiffré que pour la page admin authentifiée et masqué visuellement par défaut.
- Route de checkout protégée par contrôle d’origine et limitation de débit existants ; route de devis également limitée et cache Telegram/Fulus côté serveur.
- URLs Telegram en liste blanche, délai de 5 s par canal et réponse bornée ; aucune URL fournie par le client n’est récupérée.
- Le total USDT, le taux, les 20 %, le total LYD, la source, les horodatages et les références de publications du devis sont enregistrés avec le paiement pour l’audit.
- La livraison manuelle est bloquée côté serveur tant que la carte n’est pas `approved` : masquer un bouton ne suffit pas.
- Le cron de reprise, l’IPN et le polling client ne peuvent **jamais** acheter de code pour ce moyen de paiement : seul un administrateur authentifié, après acceptation de la carte, déclenche l’achat (`phoneCardApproved`).
- Une carte déjà traitée ne peut pas être acceptée/refusée une seconde fois ; une commande déjà livrée ne peut plus voir son paiement modifié.
- L’e-mail de notification admin contient la référence, le produit et la valeur déclarée, **jamais le code de recharge**.

## Exploitation et limites

- Aucune API Libyana/Al Madar n’est appelée : la validité, l’encaissement et la valeur du crédit restent à vérifier manuellement.
- Le devis LYD ne déclenche aucun achat et ne marque pas la commande comme payée. Il ne remplace pas le contrôle du crédit réellement reçu.
- Telegram et Fulus fournissent des indications de marché, pas une garantie : l’admin peut choisir le mode manuel si le prix proposé ne correspond pas au marché local. Une date texte contredisant la date Telegram fait ignorer le message ; une divergence de plus de 3 % bloque le consensus au lieu de choisir arbitrairement une source.
- Conserver la même clé `DIGITAL_CODES_SECRET`/`SESSION_SECRET` : la rotation rend les anciens codes illisibles, comme pour les codes cadeaux déjà stockés.
- Les colonnes de devis de `phone_card_payments`, dont `quote_references`, sont ajoutées automatiquement par `ensureSchema()` au déploiement. Les anciennes commandes, sans devis ou références enregistrés, restent lisibles.

## Vérifications techniques

```bash
node --test scripts/phone-card-payments.test.mjs
npm run typecheck
npx eslint src/components/digital-buy-dialog.tsx src/lib/phone-card-core.ts src/lib/phone-card-pricing-core.ts src/lib/phone-card-community-core.ts src/lib/phone-card-community.ts src/lib/phone-card-rate.ts src/lib/phone-card-payments.ts
```
