# Passerelle Carte Bancaire → USDC Polygon (PayGate.to)

## 1. Principe et architecture

Cette passerelle permet aux clients d’acheter des codes (`/codes`) ou de régler les formules/services de l’agence par **Visa, Mastercard, Apple Pay, Google Pay ou virement SEPA** depuis n’importe quel navigateur standard, tandis que l’agence encaisse **instantanément et sans garde intermédiaire (non-custodial)** en **USDC sur le réseau Polygon** directement sur son portefeuille personnel (`0x…`).

- **100 % Vercel Serverless** : aucun VPS, aucun démon Tor, aucun nœud Lightning à maintenir.
- **Zéro KYB / zéro société requise côté marchand** : aucune inscription ni clé API, seul un portefeuille EVM personnel (`0x…`) sur Polygon est requis.
- **Livraison automatique de bout en bout** : dès la confirmation cryptographique du paiement, la commande passe à `paid`, l’alerte Telegram et l’e-mail de confirmation partent, et la file de livraison (`delivery_jobs`) achète et livre automatiquement le code FazerCards.

---

## 2. Activation en 2 minutes (sans redéploiement)

1. Ouvrez votre portefeuille personnel non-custodial (**MetaMask**, **Rabby**, **Trust Wallet** ou **Ledger**) sur le réseau **Polygon (POL / MATIC)** et copiez votre adresse de réception (`0x…`, 42 caractères).
   - ⚠️ **Ne copiez jamais l’adresse du contrat officiel du jeton USDC** (`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`) : le système la bloque automatiquement par sécurité, car y envoyer des fonds les brûlerait.
2. Connectez-vous à **`/admin/settings`** → onglet **« Carte bancaire (PayGate.to) »**.
3. Collez votre adresse `0x…`, ajustez au besoin :
   - **Minimum de commande par carte** : `15 $` recommandé (les processeurs mondiaux exigent généralement entre 10 $ et 15 $) ;
   - **Majoration frais carte (%)** : `5 %` par défaut pour absorber la commission processeur/conversion ;
   - **Seuil minimal stablecoin reçu** : `0.80` (80 % du prix catalogue de base) ;
   - **Mode fournisseur** : laissez *Automatique multi-fournisseurs* (`pay.php`) pour afficher automatiquement les meilleurs processeurs selon le pays de l’acheteur.
4. Cochez **« Activer le paiement par carte »** puis cliquez sur **Enregistrer**.

*(Alternative par variables d’environnement sur Vercel : `PAYGATE_USDC_POLYGON_WALLET=0x...` et `PAYGATE_ENABLED=true`.)*

---

## 3. Sécurité cryptographique du webhook (`/api/payments/paygate/callback`)

Aucune livraison ni validation de commande n’est jamais déclenchée sans la validation cumulative des 6 garde-fous suivants :

1. **Jeton HMAC-SHA256 par commande (`token`)** : signé avec `PAYGATE_CALLBACK_SECRET` (ou une clé dérivée par séparation de domaine de `SESSION_SECRET` / `DIGITAL_CODES_SECRET`), comparé en temps constant (`timingSafeEqual`).
2. **Signature asymétrique RSA-SHA256 officielle (`X-PayGate-Signature` / `X-PayGate-Key-Id: v1`)** : vérifiée avec la clé publique officielle de PayGate.to sur l’URL exacte `${callbackBase}?${rawQuery}`.
3. **Priorité à la dernière valeur de paramètre** : empêche toute injection de faux paramètres (`value_coin`, `coin`, `pending`) en amont dans la query string.
4. **Refus des transactions `pending`** : tant que la transaction blockchain n’est pas confirmée (`pending=1`), le serveur accuse réception (`200 ok`) sans marquer la commande payée ni livrer de code.
5. **Contrôle de destination et de montant (`validatePayGateSettlement`)** :
   - `address_in` doit correspondre exactement à l’adresse temporaire Polygon allouée pour cette commande ;
   - `address_out` doit reverser ≥ 90 % au portefeuille marchand configuré ;
   - le jeton reçu doit être un stablecoin USD (`USDC` / `USDT`) et `value_coin >= minAcceptableUsd`.
6. **Idempotence stricte (`webhook_events` + `UPDATE … WHERE status = …`)** : un double appel réseau de PayGate.to ou une course avec la réconciliation de secours (`payment-status.php`) ne peut jamais produire ni double e-mail ni double achat fournisseur.

---

## 4. Protection contre les blocages Antivirus / Filtres FAI (Domaine personnalisé & Mode natif)

Les domaines publics partagés de PayGate (`checkout.paygate.to`, `checkout.paygate.sbs`) sont parfois signalés par certains antivirus grand public (**Avast, AVG, Kaspersky, Bitdefender, NordVPN Threat Protection**) ou par les filtres DNS de FAI, car des milliers de marchands les partagent. En revanche, les processeurs financiers réglementés derrière PayGate (**Wert, MoonPay, Guardarian, Ramp Network, Transak, Mercuryo, Banxa, Stripe**) ne sont jamais bloqués.

Deux niveaux de protection sont intégrés dans `/admin/settings` → **« Carte bancaire (PayGate.to) »** :

### Niveau A — Passerelle intégrée sur votre propre domaine (`/pay/card/[ref]`) — **Actif par défaut (0 config DNS)**
- Le navigateur du client n’ouvre **jamais** `*.paygate.to` ni `*.paygate.sbs` : le lien généré est `https://votredomaine.com/pay/card/DGC-XXXX?k=…` (protégé par un jeton HMAC-SHA256 à séparation de domaine).
- Le client reste sur votre domaine HTTPS, voit les processeurs actifs pour son montant (et peut en changer en 1 clic si sa banque refuse un processeur donné).
- Lorsqu’il clique sur **Payer**, la route serveur `/api/payments/paygate/go` interroge PayGate de serveur à serveur (en transmettant le pays réel `PGTO-IPCountry`), extrait l’URL HTTPS directe du processeur agréé (`widget.wert.io`, `buy.moonpay.com`, `guardarian.com`…) et redirige le client en `302` direct sans qu’aucune requête DNS ou TLS vers `*.paygate.*` n’ait jamais lieu sur l’appareil de l’acheteur.

### Niveau B — Sous-domaine personnalisé Cloudflare Worker (`pay.votredomaine.com`) — **White-Label complet**
Si votre domaine utilise le DNS gratuit de Cloudflare et que vous souhaitez en plus héberger en marque blanche les widgets embarqués (Stripe, Robinhood, multi-coin) directement sous `https://pay.votredomaine.com` :
1. Dans `/admin/settings` → **Carte bancaire (PayGate.to)**, passez *Mode d’ouverture* sur **« Sous-domaine personnalisé Cloudflare »** et saisissez `pay.votredomaine.com`.
2. Cliquez sur **« Copier le code Cloudflare Worker »** (pré-rempli automatiquement avec votre domaine et la réécriture des en-têtes `Location`).
3. Dans Cloudflare (gratuit, 100 000 requêtes/jour) : **Workers & Pages → Create application → Hello World → Edit code → Coller → Deploy**, puis dans **Domains & Routes → Add Custom Domain**, ajoutez `pay.votredomaine.com`.

