# Recharger automatiquement FazerCards depuis les ventes

Date : 30 octobre 2026 · Étude de faisabilité **et implémentation** du mode « recharge par lot »
(désactivé par défaut — voir § 7 pour la mise en service)

---

## 1. Ce que dit réellement l'e-mail NOWPayments

Trois e-mails promotionnels de `maryanna@nowpayments.io` (boîte `walidhamrit@gmail.com`) :

| Date | Objet | Message utile |
|---|---|---|
| 24/10/2026 | **NOWPayments \| $0-Fee Payouts** | Payouts à **0 % de commission** ; **0 $ de frais réseau** uniquement pour les payouts « ChangeNOW Pro » envoyés **par e-mail** |
| 26/10/2026 | NOWPayments \| Solutions for Every Industry | Cas client : « ~6 000 $ d'économies de frais de payout » |
| 30/10/2026 | NOWPayments \| Fiat Operations | Dépôts/payouts via un wallet ChangeNOW Pro partagé |

Ce que l'e-mail dit en bas de page, et qui compte le plus :

> « Standard payment fees: 1% same currency · 1.5% with conversion »
> « **Internal ChangeNOW Pro network fees are $0**; other fees may apply. »

**Traduction opérationnelle :**

- la **commission** NOWPayments sur un payout est bien de **0 %** (c'est déjà le cas standard, la promo ne change rien là-dessus) ;
- les **frais de réseau blockchain** restent dus sur un payout « classique » vers une adresse crypto ;
- le « 0 $ de frais » ne concerne que les payouts **vers un e-mail** d'un utilisateur ChangeNOW Pro.

Or FazerCards ne se recharge **pas** par e-mail : son API de rechargement demande un **virement USDT vers une adresse** (`POST /payments/create` → `address`). On tombe donc dans le cas « autres frais peuvent s'appliquer » : **frais réseau normaux**.

➡️ **Conclusion sur ce point : la promo ne rend pas la recharge FazerCards gratuite.** Elle confirme seulement qu'il n'y a pas de commission NOWPayments à payer en plus des frais réseau.

---

## 2. Est-ce techniquement automatisable ? Oui — les deux briques existent

**Côté fournisseur (FazerCards, déjà intégré au dépôt) :**

| Endpoint | Rôle | Déjà présent |
|---|---|---|
| `GET /payments/methods` | méthodes activées + **minimum/maximum par méthode** (USDT TRC20 : min **10 $**, max 50 000 $) | ✅ `fazercardsPaymentMethods()` |
| `POST /payments/create` `{method:"trc20", amount:100}` | crée la facture de rechargement → renvoie `address`, `amount`, `expiresAt`, `id` | ✅ `fazercardsPaymentCreate()` |
| `GET /payments/{id}` | statut (`pending` → crédité) | ✅ `fazercardsPaymentGet()` |

**Côté caisse (NOWPayments) :**

| Endpoint | Rôle |
|---|---|
| `POST /v1/auth` | JWT (avec `NOWPAYMENTS_EMAIL` / `NOWPAYMENTS_PASSWORD`, déjà dans `.env.example`) |
| `GET /v1/balance` | solde custody disponible par devise |
| `GET /v1/payout/fee?currency&amount` | **devis du frais réseau** avant envoi |
| `GET /v1/payout-withdrawal/min-amount/:coin` | montant minimal de payout |
| `POST /v1/payout` | envoi vers l'adresse FazerCards |
| `POST /v1/payout/:batch-id/verify` | **validation 2FA** (code e-mail ou TOTP) |
| `GET /v1/payout/{id}` | statut : `waiting → processing → sending → finished` |

Le flux complet est donc réalisable :

```
vente payée (IPN)  →  livraison du code (débit solde FazerCards = coût fournisseur)
                   →  cumul des coûts fournisseurs non encore « refinancés »
                   →  seuil atteint ?
                        oui → POST /payments/create (FazerCards)  → adresse + montant
                            → POST /v1/payout (NOWPayments)      → USDT TRC20 envoyé
                            → GET /payments/{id}                 → crédit confirmé
                            → ligne de registre « refinancé »
```

---

## 3. Pourquoi « un virement par vente » est une mauvaise idée

C'est la formulation de départ (« à chaque vente on envoie le même montant débité »), et elle casse sur trois murs chiffrés :

**a) Le minimum de dépôt FazerCards est de 10 $ (USDT TRC20).**
Une vente à 5 $ (coût fournisseur ~4 $) ne peut pas être refinancée individuellement : le virement serait rejeté en dessous du minimum.

**b) Le frais réseau n'est pas proportionnel.**
Un transfert USDT TRC20 coûte typiquement ~0,8–1,5 $, quel que soit le montant.

| Montant envoyé | Frais réseau estimés | Coût en % du montant |
|---|---|---|
| 4 $ | ~1 $ | **~25 %** |
| 10 $ | ~1 $ | **~10 %** |
| 50 $ | ~1 $ | ~2 % |
| 200 $ | ~1 $ | ~0,5 % |

Avec une marge de 15–20 % sur une carte à 5 $ (soit 0,75–1 $), **un virement par vente consomme toute la marge**, voire plus.

**c) La mécanique de paiement n'est pas instantanée ni gratuite en attention.**
Chaque payout exige par défaut une **validation 2FA** (code envoyé par e-mail, valable **1 heure**, sinon rejet automatique). Un code par vente = automatisation impossible sans TOTP, et un payout en échec laisse la facture FazerCards expirer.

**d) Le risque d'emballement.** Un payout automatique déclenché par un événement client (IPN) est un **robinet d'argent sortant**. Il faut un registre, de l'idempotence et un plafond, sinon un double IPN ou un rejeu déclenche deux virements.

---

## 4. Design recommandé : « float constant + recharge par lot »

L'objectif réel n'est pas « un virement par vente », c'est **que le solde FazerCards ne manque jamais**, tout en gardant la marge de notre côté. Le dépôt sait déjà calculer ce besoin :

- `assessFazercardsBalance()` (`src/lib/fazercards-balance-core.ts`) donne le **niveau** (`ok` / `low` / `critical`), le **plafond de vente couvert** et la **recharge conseillée** (multiple de 10 $, marge de sécurité 15 %) ;
- `digital_orders.supplier_cost_usd` contient le **coût fournisseur réel de chaque commande** : c'est exactement « le montant débité » que vous voulez refinancer.

**Règles proposées (mode par défaut) :**

1. Après chaque livraison réussie, on **cumule** `supplier_cost_usd` dans un registre (`settings` → clé `fazercards.topup`).
2. On ne déclenche **rien** tant que le cumul est < **seuil** (ex. 50 $) **ou** que le solde FazerCards reste au-dessus du plafond de vente (`level = ok`).
3. Si cumul ≥ seuil **et** solde réel FazerCards < plafond de vente → **un seul** virement du montant cumulé (arrondi au dollar, plafonné par `FAZERCARDS_TOPUP_MAX_USD`).
4. Avant envoi : `GET /v1/payout/fee` (frais ≤ 2 % du montant, sinon on attend) et vérification que le montant ≥ minimum de la méthode.
5. Après envoi : suivi `GET /v1/payout/{id}` + `GET /payments/{id}` ; le registre n'est soldé **que** quand FazerCards confirme le crédit. Sinon alerte interne.
6. Garde-fous : idempotence par `clé = hash(dernière commande incluse)`, plafond/jour, `dry-run` obligatoire au début, interrupteur `FAZERCARDS_AUTOTOPUP_ENABLED=0` par défaut, alerte e-mail à chaque virement (montant, adresse, txid).

**Variantes selon le niveau de risque accepté :**

| Mode | Déclencheur | Avantage | Inconvénient |
|---|---|---|---|
| **A. Par vente** (demande initiale) | chaque livraison | solde fournisseur strictement constant | minimum 10 $ + frais réseau ~10–25 % → **déconseillé** |
| **B. Par lot/seuil** ⭐ recommandé | cumul ≥ 50 $ **ou** solde sous le plafond | frais ~0,5–1 %, un seul 2FA | léger décalage (quelques ventes) |
| **C. Manuel 1 clic** (phase 1) | bouton admin avec montant pré-rempli | zéro risque d'emballement, mise en place immédiate | une action humaine |

Recommandation : **C d'abord** (1–2 semaines, on observe les montants réels), puis **B**.

---

## 5. Prérequis et points de blocage à trancher

1. **2FA des payouts.** Par défaut NOWPayments envoie un code par e-mail à chaque payout. Pour automatiser, il faut soit activer le **TOTP** (secret à stocker dans Vercel — secret sensible !), soit faire désactiver la 2FA sur le compte (déconseillé). À vérifier auprès de NOWPayments : c'est **le** point qui décide entre automatique et semi-automatique.
2. **Solde custody.** Un payout se fait depuis le **solde custody NOWPayments**, pas depuis un wallet externe. Les encaissements du site y arrivent par défaut (la facture ne définit pas de `payout_address`) : c'est compatible, mais cela veut dire que l'argent des ventes reste chez NOWPayments (contrepartie : ce n'est plus un règlement « non-custodial » vers votre propre wallet).
3. **Devise.** Le plus simple : laisser les clients payer dans la devise reçue, puis **convertir en USDT** pour le payout (0,5 % de frais de conversion) — ou régler directement en USDT si NOWPayments le permet sur votre compte. Sans conversion, une vente payée en BTC ne peut pas financer un dépôt USDT.
4. **Fiscalité / traçabilité.** Chaque virement automatique est un mouvement d'argent : garder le registre (montant, date, txid, commandes couvertes) est indispensable pour la comptabilité.
5. **Fraude et remboursements.** Refinancer **à la livraison**, jamais au paiement : une commande payée mais non livrée (ou remboursée) ne doit pas avoir déjà financé le fournisseur.
6. **Ordre de grandeur.** Avec un plafond de vente de 300 $ (`FAZERCARDS_MAX_ORDER_USD`), le float cible raisonnable est **~350–400 $** (plafond + sécurité 15 %, cf. `BALANCE_TOPUP_SAFETY`).

---

## 6. Ce qui existe déjà dans le dépôt et ce qu'il faudrait ajouter

**Déjà là :**

- `src/lib/fazercards.ts` — wrappers rechargement (`fazercardsPaymentMethods/Create/Get`) déjà écrits mais **non utilisés** ;
- `src/lib/fazercards-balance.ts` + `-core.ts` — évaluation du solde, niveau, recharge conseillée, alertes e-mail dédupliquées ;
- `src/app/api/cron/fazercards-balance/route.ts` — cron quotidien **en lecture seule** ; un test (`scripts/fazercards-balance.test.mjs`) **interdit** explicitement d'y appeler `payments/create` — garde-fou volontaire à conserver ;
- `digital_orders.supplier_cost_usd` — le montant débité par vente ;
- `NOWPAYMENTS_EMAIL` / `NOWPAYMENTS_PASSWORD` — nécessaires au JWT des payouts.

**Ajouté dans cette branche (mode B) :**

| Fichier | Contenu |
|---|---|
| `src/lib/nowpayments-payout.ts` | `auth()` JWT + cache, `payoutFee()`, `minAmount()`, `createPayout()`, `verifyPayout()`, `getPayout()` |
| `src/lib/fazercards-autotopup-core.ts` | logique pure : cumul, seuil, décision, idempotence (testable sans réseau) |
| `src/lib/fazercards-autotopup.ts` | orchestration : lecture registre → création facture FazerCards → payout → suivi → écriture registre |
| `src/app/api/cron/fazercards-topup/route.ts` | cron (protégé par `CRON_SECRET`), `?dry=1` par défaut au début |
| `src/app/admin/(panel)/digital/fazercards-balance-panel.tsx` | ajout d'un bouton « Recharger maintenant » (mode C) + état du registre |
| `.env.example` | `FAZERCARDS_AUTOTOPUP_ENABLED`, `FAZERCARDS_TOPUP_THRESHOLD_USD=50`, `FAZERCARDS_TOPUP_MAX_USD=300`, `NOWPAYMENTS_PAYOUT_CURRENCY=usdt`, `NOWPAYMENTS_PAYOUT_NETWORK=trc20`, `NOWPAYMENTS_TOTP_SECRET` |
| `src/db/schema.ts` | table `fazercards_topups` (id, créé_le, montant, adresse, payout_id, statut, commandes couvertes, txid) — ou `settings` si on veut éviter une migration |
| `scripts/fazercards-autotopup.test.mjs` | seuils, idempotence, plafonds, « jamais au paiement », pas de payout si frais > 2 % |

---

## 7. Mise en service (mode B implémenté)

Le mode B est en place dans cette branche, **désactivé par défaut**. Rien ne
part tant que trois verrous ne sont pas levés.

**1. Variables d'environnement (Vercel → Settings → Environment Variables)**

| Variable | Rôle | Défaut |
|---|---|---|
| `FAZERCARDS_AUTOTOPUP_ENABLED` | interrupteur principal — **sans `true`, aucun virement** | `false` |
| `NOWPAYMENTS_EMAIL` / `NOWPAYMENTS_PASSWORD` | jeton JWT indispensable aux virements | — |
| `NOWPAYMENTS_PAYOUT_CURRENCY` | devise envoyée (ticker NOWPayments) | `usdttrc20` |
| `NOWPAYMENTS_PAYOUT_TOTP_SECRET` | secret 2FA applicative (base32) — automatise la validation | — |
| `FAZERCARDS_AUTOTOPUP_THRESHOLD_USD` | écart minimal avant un virement | `50` |
| `FAZERCARDS_AUTOTOPUP_MAX_USD` | plafond par virement | `300` |
| `FAZERCARDS_AUTOTOPUP_MAX_FEE_RATIO` | frais réseau tolérés (3 %) | `0.03` |
| `FAZERCARDS_AUTOTOPUP_METHOD` | méthode de dépôt FazerCards | `trc20` |

**2. Ordre de mise en route conseillé**

1. renseigner `NOWPAYMENTS_EMAIL` / `NOWPAYMENTS_PASSWORD` et vérifier que
   `GET /v1/balance` renvoie un solde en `usdttrc20` (l'argent des ventes) ;
2. lancer une **simulation** depuis `/admin/digital` → « Simuler » : le rapport
   affiche solde lu, float cible, frais réseau, montant qui partirait ;
3. faire **un** virement réel à la main depuis l'administration, puis vérifier
   qu'il est crédité et que l'historique se solde ;
4. seulement ensuite `FAZERCARDS_AUTOTOPUP_ENABLED=true`. Le cron planifié
   (05:40 UTC) continue de **simuler** : l'exécution automatique réelle demande
   `?execute=1`, à ajouter volontairement à l'URL du cron quand on est prêt.

**3. Comportement en production**

- un seul virement à la fois : tant que la facture n'est pas créditée (ou
  expirée), aucun nouvel envoi — pas de double paiement en cas de rejeu ;
- le montant envoyé = facture FazerCards + frais réseau estimés, pour que le
  fournisseur reçoive exactement le montant demandé ;
- frais réseau > 3 % du montant (6 % en urgence) → report au passage suivant ;
- e-mail interne à chaque virement créé, à chaque crédit, à chaque échec ;
- sans `NOWPAYMENTS_PAYOUT_TOTP_SECRET`, la 2FA est manuelle : un e-mail
  prévient et le code se saisit dans `/admin/digital` (le virement est rejeté
  par NOWPayments au bout d'une heure si personne ne le valide).

**4. Fichiers ajoutés**

| Fichier | Rôle |
|---|---|
| `src/lib/totp.ts` | TOTP RFC 6238 (validation automatique du virement) |
| `src/lib/nowpayments-payout.ts` | JWT, solde custody, devis de frais, création/validation/statut de virement |
| `src/lib/fazercards-autotopup-core.ts` | décision pure (seuil, arrondi, frais, financement, états) |
| `src/lib/fazercards-autotopup.ts` | orchestration : facture FazerCards → virement → suivi → registre → e-mails |
| `src/app/api/cron/fazercards-topup/route.ts` | cron protégé, **simulation par défaut** |
| `src/app/api/admin/digital/fazercards-topup/route.ts` | simulation / exécution / validation 2FA depuis l'admin |
| `src/app/admin/(panel)/digital/fazercards-topup-panel.tsx` | panneau « Recharge automatique du solde fournisseur » |
| `scripts/fazercards-autotopup.test.mjs` | 30 tests : décision, frais, états, TOTP, câblage |

Les deux crons existants restent inchangés : `/api/cron/fazercards-balance`
(alerte, lecture seule) et le nouveau `/api/cron/fazercards-topup` (simulation).

## 8. Réponse courte

**Oui, c'est automatisable**, les deux API sont déjà disponibles (FazerCards `payments/create`, NOWPayments `payout`) et le dépôt contient déjà la moitié du travail (évaluation du solde, coût fournisseur par commande, alertes).

**Mais pas sous la forme « un virement du montant exact à chaque vente »** : le minimum de dépôt FazerCards (10 $) et les frais réseau fixes (~1 $ par transfert) rendraient l'opération perdante sur les petits paniers. La bonne forme est **la recharge par lot au franchissement d'un seuil**, avec registre, plafond, idempotence et validation 2FA — le « 0 frais » de l'e-mail ne concernant, lui, que les payouts par e-mail ChangeNOW Pro, pas un virement USDT vers FazerCards.
