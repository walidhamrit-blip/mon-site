# Paiement par carte téléphonique avec livraison manuelle

Cette option permet au client d’acheter un code ou une carte cadeau du catalogue FazerCards avec une carte de recharge **Libyana** ou **Al Madar**. Le site ne prétend pas vérifier le solde auprès de l’opérateur : la vérification et la livraison sont humaines.

## Parcours client

1. Le client choisit sa carte cadeau, le montant et la quantité.
2. Dans la fenêtre d’achat, il sélectionne **Carte téléphonique** au lieu de **Crypto**.
3. Il renseigne l’opérateur, la valeur de la recharge en LYD et son code, ainsi qu’un téléphone de contact.
4. Le site crée la commande sans facture NOWPayments et ouvre `/codes/commande` avec la référence et le jeton de suivi.
5. Le suivi indique **carte reçue, à vérifier**. Le client ne doit pas renvoyer le code.
6. Après acceptation admin, le suivi indique **préparation manuelle**. Après refus, il indique que la carte n’a pas été acceptée et invite le client à contacter l’équipe.
7. Le code cadeau n’apparaît sur le suivi et dans l’e-mail client qu’après sa saisie manuelle par l’admin.

## Parcours admin

1. Ouvrir **Admin → Commandes de codes & cartes cadeaux** (`/admin/digital/orders`).
2. Dans **Cartes téléphoniques à vérifier**, contrôler l’opérateur, la valeur déclarée, le montant de la commande et les coordonnées du client.
3. Afficher puis copier le code de recharge. Vérifier/recharger le crédit par le canal habituel de l’opérateur.
4. **N’accepter qu’après avoir réellement reçu le crédit et vérifié qu’il couvre la vente.**
   - **Crédit vérifié — accepter** : la ligne de paiement passe à `paid`, la commande digitale à `manual`. Aucun achat fournisseur n’est déclenché.
   - **Refuser la carte** : saisir un motif interne ; le paiement passe à `failed`, la commande digitale à `failed`, et la livraison reste verrouillée.
5. Après acceptation, ouvrir la commande dans la liste inférieure et cliquer **Saisir les codes manuellement**.
6. Saisir une carte cadeau par ligne : `NUMÉRO | PIN | URL_D_ACTIVATION` (PIN et URL facultatifs), puis **Enregistrer et envoyer au client**.

## Protections mises en place

- Code de recharge chiffré en **AES-256-GCM** avec la clé existante `DIGITAL_CODES_SECRET` (ou `SESSION_SECRET`).
- Empreinte **HMAC-SHA-256 unique** : le même code, même saisi avec des espaces ou tirets différents, ne peut pas être utilisé sur deux commandes.
- Le code secret n’apparaît ni dans le suivi public, ni dans les e-mails, ni dans les journaux applicatifs ajoutés par ce flux.
- Le code n’est déchiffré que pour la page admin authentifiée et masqué visuellement par défaut.
- Route de checkout protégée par contrôle d’origine et limitation de débit existants.
- La livraison manuelle est bloquée côté serveur tant que la carte n’est pas `approved` : masquer un bouton ne suffit pas.
- Les relances, le polling et le cron ne peuvent pas acheter automatiquement une carte cadeau pour ce moyen de paiement.
- Une carte déjà traitée ne peut pas être acceptée/refusée une seconde fois ; une commande déjà livrée ne peut plus voir son paiement modifié.
- L’e-mail de notification admin contient la référence, le produit et la valeur déclarée, **jamais le code de recharge**.

## Exploitation et limites

- Aucune API Libyana/Al Madar n’est appelée : la validité, l’encaissement et la valeur du crédit restent à vérifier manuellement.
- Le montant de la carte est en **LYD**, tandis que le catalogue est facturé en **USD**. L’admin doit appliquer son taux et vérifier la couverture avant acceptation ; le site ne devine pas le taux de change.
- Conserver la même clé `DIGITAL_CODES_SECRET`/`SESSION_SECRET` : la rotation rend les anciens codes illisibles, comme pour les codes cadeaux déjà stockés.
- La table `phone_card_payments` et la colonne `orders.payment_method` sont créées automatiquement par `ensureSchema()` au déploiement. Aucune variable d’environnement supplémentaire n’est nécessaire.

## Vérifications techniques

```bash
node --test scripts/phone-card-payments.test.mjs
npm run typecheck
npx eslint src/components/digital-buy-dialog.tsx src/lib/phone-card-core.ts src/lib/phone-card-payments.ts
```
