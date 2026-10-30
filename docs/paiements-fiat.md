# Sortir du tout-crypto : encaisser en fiat sans perdre la marge

Date : 30 octobre 2026 · Marché : Libye (principal), diaspora Golfe/Europe (secondaire)

---

## 1. Le constat

Aujourd'hui la boutique n'accepte qu'une chose : un paiement crypto via
NOWPayments. Le client qui n'a pas d'USDT n'a **aucun** chemin d'achat — pas de
carte, pas de wallet local, pas de virement. Il ne « part pas » au début du
tunnel : il part **à la dernière étape**, après avoir choisi son produit et
saisi ses coordonnées. C'est le pire endroit pour perdre quelqu'un.

Le marché rend ce filtre très coûteux :

- en Libye, le paiement reste massivement dominé par le cash et les wallets
  bancaires locaux (Moamalat, LYPay/OnePay, MobiCash, Yusr, Masrafi, Sahara,
  EDFali, Sadad) ; les cartes locales ne servent qu'à un nombre limité de
  terminaux et sont rarement acceptées à l'international ;
- un client du Golfe ou d'Europe a une carte Visa/Mastercard, pas forcément un
  wallet crypto.

Autrement dit : le « grand potentiel de clients payeurs en fiat » n'est pas un
public exotique à convertir, c'est **le public normal** du produit (cartes
cadeaux, top-ups, codes de jeux).

**Mesure à faire avant tout investissement** — elle est déjà dans la base :

```sql
-- Taux d'aboutissement des commandes digitales (30 derniers jours)
select status, count(*) from digital_orders
where created_at > now() - interval '30 days' group by status order by 2 desc;
```

Si tu vois beaucoup de `pending` et peu de `delivered`, le blocage est bien le
paiement, et non le produit ou le prix.

---

## 2. Les options, classées par faisabilité réelle

| # | Option | Ce que le client utilise | Effort | Faisable depuis la Libye ? |
|---|---|---|---|---|
| **A** | **Agrégateur local (DPAY)** | Moamalat, EDFali, MITF (Masrafi/Yusr/Sahara), Sadad, MobiCash + **cartes internationales via MPGS en USD** | Moyen (API REST + webhook signé) | ✅ oui, après KYC entreprise |
| **B** | MyPay (`mypay.ly`) | mêmes rails, plus QR/agent | Moyen | ✅ oui (alternative à A) |
| **C** | **Virement / wallet confirmé manuellement** | virement bancaire LYD, Sadad, EDFali… preuve envoyée sur WhatsApp | **Faible** (déjà 80 % du code présent) | ✅ oui, **dès aujourd'hui**, aucun contrat |
| **D** | Onramp carte→crypto (Guardarian, Transak, Onramp.money…) | carte Visa/MC, le crypto arrive sur ta facture | Faible (lien sortant) | ⚠️ partiel : cartes libyennes souvent refusées, KYC client, 2–5 % de frais |
| **E** | Merchant of Record (Paddle, Lemon Squeezy) | carte | — | ❌ **exclu** : Paddle interdit explicitement les « gift cards, vouchers, stored value » et les services financiers/crypto. Ton catalogue tombe pile dans l'interdit. |
| **F** | Entité étrangère + Stripe/PayPal | carte | Élevé (société, comptes, fiscalité) | ⚠️ possible mais disproportionné au volume actuel |

### Détail des deux options qui comptent

**A. DPAY (dpay.ly, édité par DITS, opérateur libyen)**

- API REST unifiée : `POST https://dpay.ly/api/payment/sessions/open` avec
  `Authorization: Bearer <token>`, `pay_method` ∈ `moamalat | edfali |
  masrefypay | yousrpay | saharapay | mobicash | sadad`, `amount` **en LYD**,
  `data` (métadonnées libres, donc ta référence de commande).
- Réponse : `session_id`, `payment_link` (page de paiement hébergée), montant,
  frais, `expired_at`. Session **15 minutes**.
- Webhook signé : en-tête `X-DPAY-Signature` = HMAC-SHA256(timestamp + corps),
  avec rejeu automatique côté DPAY. Test : code `111111` = succès,
  `000000` = refus.
- **0 commission DPAY** : tu ne paies que la commission de ton accord avec la
  banque ; l'argent est crédité **directement sur ton compte**, DPAY ne le
  détient pas.
- **MPGS / Mastercard en USD** : rail « cartes globales » 3-D Secure 2 avec
  snapshot du taux de change par transaction → c'est ce qui ouvre les clients
  hors Libye **sans** créer de société à l'étranger, si ta banque active cette
  passerelle sur ton compte.

**C. Virement/wallet confirmé à la main (à faire immédiatement)**

Aucun contrat, aucun KYC nouveau, et l'architecture existe déjà : une commande,
un statut `manual`, l'admin qui valide. Il manque seulement l'écran côté client
(montant LYD + référence + instructions) et le bouton côté admin (voir § 4).
C'est le moyen le plus rapide de capter les clients fiat, et un filet de
sécurité permanent si un rail tombe.

---

## 3. Recommandation

1. **Maintenant (cette semaine)** : option C — un onglet « paiement local
   (virement / wallet) » dans le checkout. Ça ne bloque sur rien, ça n'exige
   aucun contrat, et ça valide la demande réelle.
2. **En parallèle** : engager la démarche société (registre de commerce, compte
   professionnel) puis déposer le dossier DPAY (KYC = société + document
   bancaire). C'est ce délai externe qui décidera de la date, pas le code
   (voir § 5 bis si tu n'as pas encore de société).
3. **À l'activation DPAY** : Moamalat + EDFali + Sadad + MobiCash d'abord (les
   plus utilisés), puis MPGS (cartes internationales USD) si ta banque
   l'accorde, et enfin MyPay en secours.
4. **Pour la diaspora** : option D en complément (lien carte→crypto), le temps
   que MPGS soit ouvert.
5. **À ne pas faire** : Paddle / Lemon Squeezy (interdits sur les cartes
   cadeaux), et pas de société étrangère tant que le volume ne le justifie pas.

À terme, le crypto reste : il ne coûte presque rien (1 % NOWPayments) et sert
de rail de secours quand une passerelle locale est indisponible.

---

## 4. Ce que ça demande côté code (précisément)

### 4.1 Généraliser le paiement (le vrai travail)

Aujourd'hui le paiement est **câblé sur NOWPayments** : `orders` porte
`paymentId`, `payAddress`, `payAmount`, `ipnStatus`… Il faut un champ
`provider` et des colonnes fiat.

| Fichier | Changement |
|---|---|
| `src/db/schema.ts` + DDL dans `src/db/index.ts` | `orders.provider` (`nowpayments` \| `dpay` \| `mypay` \| `manual`), `orders.fiat_currency`, `orders.fiat_amount`, `orders.fx_rate`, `orders.provider_ref` (index unique) |
| `src/lib/payment-providers/types.ts` (nouveau) | interface commune : `createIntent(order)` → `{ redirectUrl, providerRef }`, `parseWebhook(req)` → `{ providerRef, paid, amount, currency }`, `isConfigured()` |
| `src/lib/payment-providers/dpay.ts` (nouveau) | session open + vérification HMAC `X-DPAY-Signature` (timestamp + corps), lecture du statut |
| `src/lib/payment-providers/manual.ts` (nouveau) | instructions + référence, aucune API |
| `src/app/api/payments/create/route.ts` | aiguillage par `provider` au lieu d'appeler `createInvoice()` en dur |
| `src/app/api/payments/dpay/webhook/route.ts` (nouveau) | vérifier la signature **avant** tout, idempotence par `provider_ref`, montant ≥ dû (tolérance 0), puis `deliverPaidDigitalOrder()` |
| `src/app/api/payments/manual/route.ts` + action admin | créer la commande « en attente de virement » et confirmer côté admin |
| `src/components/digital-buy-dialog.tsx` | deux onglets : « Payer par carte / wallet local » (LYD) et « Crypto (USDT…) » ; montant LYD figé à la création |
| `src/app/admin/(panel)/digital/orders/page.tsx` | bouton « Marquer payé + livrer » (virement reçu), avec saisie de la référence bancaire et journalisation |
| `src/lib/orders-emails*.ts` | e-mail d'instructions LYD (montant exact, référence à mettre en libellé, délai), relance à 30 min |
| `.env.example` | `DPAY_API_TOKEN`, `DPAY_WEBHOOK_SECRET`, `DPAY_SANDBOX`, `FIAT_MARKUP_PERCENT`, `LYD_RATE_REFRESH` |

### 4.2 Les trois règles à ne jamais casser

1. **Le montant est calculé côté serveur**, jamais envoyé par le navigateur
   (c'est déjà la règle pour la crypto — elle vaut identiquement en fiat).
2. **Taux de change figé à la création de la commande** et stocké (`fx_rate`).
   Sinon un écart de taux sur 30 minutes se paie sur la marge, et la comptabilité
   devient inexplicable. Prévoir une marge explicite (`FIAT_MARKUP_PERCENT`,
   ex. 2 %) qui absorbe le spread et la commission bancaire.
3. **Livraison uniquement sur webhook vérifié ou confirmation humaine** —
   jamais sur le retour navigateur (`success_url`), qui se falsifie avec la
   barre d'adresse. Idempotence obligatoire : deux webhooks identiques = une
   seule livraison.

### 4.3 Estimation

- Option C (virement manuel + affichage LYD + admin) : **1 à 2 jours**.
- Option A (DPAY, sandbox → production) : **2 à 4 jours**, dont la moitié en
  test sur les rails (Sadad exige l'année de naissance, EDFali le mobile…).
- MPGS (cartes internationales) : surtout une démarche bancaire ; côté code,
  c'est un `pay_method` de plus si DPAY l'expose.

---

## 5. Ce qui ne dépend pas du code (et qui prendra plus de temps)

| Démarche | Où | Délai typique |
|---|---|---|
| KYC entreprise (registre de commerce + document bancaire) | DPAY / MyPay | quelques jours ouvrés, manuel |
| Contrat d'acceptation carte avec ta banque (Moamalat, MPGS) | banque | variable, c'est le chemin critique |
| Politique de taux LYD (source, marge, arrondi au 0,25 LYD) | toi | décision, pas technique |
| Conditions de remboursement en fiat (webhook, litige) | toi | à publier avant activation |
| Comptabilité : deux devises encaissées, deux relevés | comptable | à cadrer tôt |

⚠️ Point d'honnêteté à avoir avec l'acquéreur : la **revente de codes et de
cartes cadeaux** est une catégorie sensible pour les banques (risque de
revente/abus). Déclare l'activité précisément (« revente de codes numériques
au détail »), garde les preuves de livraison, et prévois le crypto comme rail de
continuité si un rail fiat est suspendu.

---

## 5 bis. Cas concret : pas encore de société

C'est le cas aujourd'hui. Autant l'écrire clairement : **le KYC DPAY/MyPay
exige une société** (documents de société + registre de commerce, revue manuelle
avant le mode live — « aucun compte direct sans vérification complète »). Sans
société : pas de page de paiement DPAY, pas de contrat Moamalat, pas de MPGS.
Aucun contournement technique n'existe, et ce n'est pas le code qui bloque :
c'est le statut juridique.

**L'ordre réaliste (et ce que chaque étape débloque)**

| Étape | Ce que ça débloque | Délai typique |
|---|---|---|
| 1. Registre de commerce + numéro fiscal | la possibilité de contracter, facturer, et rassurer un acquéreur | 2 à 6 semaines selon le guichet |
| 2. Compte bancaire au nom de la société | le versement des rails (Moamalat, MPGS, DPAY ne paient pas un compte personnel) | 1 à 3 semaines |
| 3. Compte DPAY/MyPay + KYC | page de paiement locale, wallets, webhooks | quelques jours |
| 4. Contrat Moamalat / MPGS avec la banque | cartes locales puis cartes internationales en USD | variable, chemin critique |

**En attendant la société, trois façons d'encaisser du fiat sans se mettre en
faute**

1. **Crypto (déjà en place)** — 1 % NOWPayments, aucune démarche.
2. **Wallet local / virement confirmé à la main** — Sadad, EDFali, MobiCash ou
   virement vers un compte au nom de l'exploitant. C'est autorisé et courant,
   mais ce n'est pas une solution à 12 mois : un volume régulier sur un compte
   personnel finit par être signalé ou plafonné par la banque. Précautions
   minimales : **vérifier le paiement dans l'application de la banque** (jamais
   une capture d'écran — elle se falsifie en 30 secondes), exiger la référence
   de commande dans le libellé, plafonner les premières commandes, livrer après
   encaissement constaté, tenir un relevé séparé des dépenses personnelles.
3. **Réseau de revendeurs** — des boutiques paient en LYD/cash et revendent le
   code ; tu captes du fiat « hors ligne » sans KYC technique, au prix d'une
   marge partagée (souvent 5–10 %). C'est souvent la première marche réelle
   d'un catalogue de codes dans un marché cash.

**Ce que je ne recommande pas d'attendre** : lancer l'intégration DPAY en
production avant le registre de commerce. Le sandbox, oui (ça ne coûte rien et
ça valide les rails) ; le live, non.

---

## 6. Plan séquencé

| Phase | Contenu | Résultat mesurable |
|---|---|---|
| **J0–J2** | Option C : checkout LYD + virement/wallet + validation admin + e-mails | premières commandes payées en LYD ; taux d'aboutissement du checkout |
| **J0 (en parallèle)** | Dossier KYC DPAY + question à la banque sur MPGS | compte DPAY en test |
| **J3–J10** | Option A en sandbox (111111/000000), webhook signé, tests bout en bout | une commande payée en sandbox = code livré automatiquement |
| **J11–J20** | Activation Moamalat + EDFali + Sadad + MobiCash en production | > 50 % des commandes payées en fiat |
| **J20–J30** | MPGS (cartes internationales) puis onramp diaspora | premières ventes hors Libye par carte |
| **Continu** | Réconciliation quotidienne, relance des `pending`, veille taux | écart « reçu ≠ attendu » = 0 |

KPI à suivre : taux d'aboutissement du checkout (commandes créées → livrées),
part fiat vs crypto, panier moyen par rail, délai création → livraison, taux
d'échec par rail (OTP expiré, session 15 min dépassée).

---

## 7. Sources

- DPAY (rails libyens, API, webhooks, MPGS USD) : https://dpay.ly/ ·
  https://dpay.ly/docs/api
- MyPay (API + webhooks LYD) : https://docs.mypay.ly/
- Écosystème de paiement libyen (LYPay, OnePay, wallets bancaires, Sadad) :
  https://www.malomat.org/en-us/articles/37609718835357
- Réalité du paiement en Libye (cash, cartes locales limitées, hawala) :
  https://wise.com/gb/hub/payment-methods/libya
- Paddle — catégories interdites (gift cards / stored value) :
  https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle
- Lemon Squeezy — produits physiques interdits, éligibilité par pays de versement :
  https://www.paymentsrank.com/compare/paddle-vs-lemon-squeezy/
