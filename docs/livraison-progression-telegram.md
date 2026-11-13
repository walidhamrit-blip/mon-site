# Livraison : progression en temps réel et canal Telegram

> Point 4 du plan d'amélioration — « parcours de livraison et rétention client ».
> Risque visé : l'acheteur qui paie en crypto ne sait pas si son paiement est
> passé, si le code est en cours, ou si quelque chose a échoué. Il écrit au
> support ou abandonne.

## 1. Barre de progression en trois étapes

La page `/codes/commande` (référence + jeton de suivi) affiche désormais une
progression explicite au lieu d'une ligne « rafraîchi toutes les 15 s » que le
client ne pouvait pas vérifier :

| Étape | Ce que le client lit | Déclencheur serveur |
|---|---|---|
| 1 | Confirmation du réseau | `orders.ipn_status` ∈ `waiting`/`confirming`/`confirmed`/`sending` (ou rien reçu) |
| 2 | Génération de votre code | commande `paid` / `paid_fulfilling` |
| 3 | Livraison | `delivered` |

Décisions structurantes :

- **Trois étapes, pas quatre.** « Paiement envoyé » et « transfert vu par le
  réseau » sont deux nuances du *même* moment vécu ("j'ai payé, ça n'arrive
  pas"). Elles changent le **message**, pas le nombre d'étapes.
- **Le message dit quoi faire.** Attente réseau → « n'envoyez pas de second
  paiement » + délai usuel de la crypto (`confirmationEtaSeconds`, TRC-20 ≈ 90 s,
  BTC ≈ 40 min). Aucun délai inventé si l'actif est inconnu.
- **Un échec n'est jamais présenté comme une attente.** `failed` et
  `manual_review` mettent l'étape 2 en alerte et orientent vers le support ;
  auparavant la roue tournait indéfiniment, ce qui ressemblait à un bug.
- **Carte téléphonique** (`paymentMethod = "phone_card"`) : l'étape 1 devient
  « Vérification de la carte » — il n'y a pas de blockchain.
- **`delivered` est terminal** : un statut de file retardataire ne peut pas
  faire reculer la barre.

Noyau pur et testé : `src/lib/delivery-progress-core.ts`
(`deliveryProgress`, `deliveryProgressMessage`, `deliveryStepLabel`),
35 tests dans `scripts/delivery-progress.test.mjs`.

Données exposées par `GET /api/digital/orders/{ref}` (en plus de l'existant) :
`ipnStatus`, `payCurrency`, `telegramUrl`. Aucune adresse, aucun montant payé,
et toujours derrière le jeton de suivi.

## 2. Recevoir aussi le code sur Telegram

Canal **additionnel** : l'e-mail Zoho part dans tous les cas.

1. Page de suivi et e-mails de livraison affichent un bouton
   `https://t.me/@NokhbaGamebot?start=order-dgc-…` (construit par
   `telegramOrderUrlFromEnv`, jamais côté client).
2. Le client tape le bouton → le bot enregistre le consentement
   (`telegram_order_watches`) et confirme que le code arrivera **ici**.
   Variante saisie à la main : `/prevenir DGC-…`.
3. À la livraison, `notifyTelegramOrderDelivered()` envoie les codes dans le
   chat (texte brut, sans `parse_mode` : un code contenant `<` ou `&` reste
   intact).

### Consentement et idempotence

- **Consentement explicite par commande** : démarrer le bot n'abonne à rien.
  Une ligne = (commande, chat), contrainte `UNIQUE (order_ref, chat_id)`.
- **Aucun rejeu** : `notified_at` est posé par l'UPDATE conditionnel
  (`WHERE notified_at IS NULL`) *avant* l'envoi. Un IPN rejoué, une relance
  admin ou un redémarrage ne renvoie jamais un second code.
- **Jamais de groupe** : l'abonnement se fait depuis un chat privé.
- Le jeton de suivi ne transite **jamais** par Telegram (seule la référence
  publique voyage dans le payload `/start`).

### Activation

- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` (voir `.env.example`) ;
  sans `TELEGRAM_BOT_USERNAME`, aucun bouton n'est affiché.
- La table `telegram_order_watches` est créée au démarrage par `ensureSchema()`
  (`CREATE TABLE IF NOT EXISTS`) — aucun script de migration à lancer.
- Webhook : `/admin/telegram → Installer le webhook` (déjà en place).

## 3. Vérifications

```bash
node --test scripts/delivery-progress.test.mjs   # 35 tests (noyau + câblage)
npm test                                         # 926 tests
npx tsc --noEmit && npx next build
```
