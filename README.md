# نخبة Nukhba — Agence Web Premium Tripoli

Site vitrine haut de gamme construit avec Next.js 16 + Tailwind + Framer Motion.

## Installation
```bash
npm install
npm run dev # http://localhost:3000
```

## Configuration unique
Editez `src/lib/config.ts`:
- `siteConfig.pricing.plans` : prix, noms, options
- `theme.accent` : couleur d'accent (#C6A664 doré par défaut)
- `whatsapp` : numéro sans "+"
- `social` : liens Instagram/Facebook
- `email`, `phone`, `address`

## Thèmes du site (8 thèmes, clair + sombre)
`src/lib/themes.ts` contient le catalogue des thèmes. Chaque thème définit **sa palette claire ET sa palette sombre** : le mode clair/sombre reste donc un réglage totalement indépendant (un bouton dédié ☀/☾ dans la barre supérieure), et n'importe quel thème se voit dans les deux modes.

| Thème | ID | Ambiance |
|---|---|---|
| نخبة الذهبي — Nukhba Gold | `nukhba` | noir profond & doré (thème d'origine) |
| أزرق ملكي — Royal Blue | `royal` | confiance, agencies & services |
| زمردي أخضر — Emerald | `emerald` | clinics & produits naturels |
| خمري أنيق — Burgundy | `burgundy` | restaurants, mode & hôtellerie |
| فحمي مينيمال — Graphite | `graphite` | minimalisme haut de gamme |
| نحاسي دافئ — Copper | `copper` | cafés, restaurants & chaleur |
| تركوازي بحري — Ocean Teal | `teal` | cabinets médicaux & tourisme |
| بنفسجي نبيل — Violet | `violet` | tech, studios & marques créatives |

- Les palettes sont converties en CSS (`html[data-theme="x"]` / `html.dark[data-theme="x"]`) et injectées dans le `<head>` par `src/app/layout.tsx` (`themeCss()`).
- Un script inline (`THEME_BOOT_SCRIPT`) applique thème + mode **avant le premier rendu** : aucun clignotement de couleurs.
- Sélection : bouton palette dans la barre supérieure (desktop), liste dans le menu mobile, ou la section « ثيمات الموقع » de la page d'accueil.
- Le choix est mémorisé dans `localStorage` (`nukhba-palette` et `nukhba-mode`).
- `src/app/globals.css` conserve `:root` / `.dark` comme repli (thème par défaut) si le JavaScript est désactivé.

## Contenu modifiable
`src/lib/content.ts` : démos, secteurs, pourquoi nous, étapes, témoignages, FAQ
`src/lib/i18n.tsx` : traductions AR/EN

## Images
Remplacez les URLs Unsplash par vos images dans `content.ts` et sections. Placez mockups dans `public/images/` et référencez `/images/...`.

## Déploiement
- **Vercel** : `vercel --prod` — SSG automatique, 90+ Lighthouse. Ajoutez `nokhba.net.ly` dans Settings → Domains et configurez les DNS chez votre registrar.
- **VPS** : `npm run build` + `npm start` derrière Nginx + PM2. Ajoutez `DATABASE_URL` si vous activez formulaire DB.

## Formulaire
La demande est enregistrée en base (table `leads`, visible dans `/admin`), transmise au webhook optionnel, et déclenche **deux e-mails** :

- **notification à l'agence** — tous les champs de la demande, un lien WhatsApp pré-rempli et l'accès direct à la demande dans l'administration (répondre à l'e-mail écrit au client) ;
- **accusé de réception client** — en arabe ou en anglais selon la langue du formulaire, avec le récapitulatif de la demande et les prochaines étapes.

Aucun fournisseur d'e-mail n'est obligatoire : sans configuration, le formulaire fonctionne exactement comme avant (la demande reste enregistrée et consultable dans `/admin`), et l'absence d'e-mail est signalée dans les journaux du serveur.

### Variables d'environnement (e-mails)
| Variable | Effet |
| --- | --- |
| `RESEND_API_KEY` | Envoi via l'API Resend (appel REST, aucune dépendance supplémentaire) |
| `EMAIL_FROM` | Expéditeur — par défaut `Nukhba <no-reply@nokhba.net.ly>` (domaine à vérifier chez Resend) |
| `EMAIL_DOMAIN` | Domaine de l'expéditeur par défaut — `nokhba.net.ly` |
| `SMTP_HOST` | Serveur SMTP — utilisé à la place de Resend si défini |
| `SMTP_PORT` | Port SMTP — `587` par défaut |
| `SMTP_USER` / `SMTP_PASS` | Authentification SMTP |
| `SMTP_SECURE` | `true` pour une connexion SSL directe (port 465) |
| `SMTP_TLS_REJECT_UNAUTHORIZED` | `false` pour accepter un certificat auto-signé |
| `LEAD_NOTIFICATION_EMAIL` | Adresse qui reçoit les notifications — par défaut l'e-mail du site |

- Webhook: POST vers `https://formspree.io` ou Make/Zapier via `WEBHOOK_URL`
- UTM conservé via `window.location.search`

## Paiements crypto (NOWPayments)

Le site intègre NOWPayments : bouton « ادفع بالعملات الرقمية / Pay with crypto »
sur les cartes tarifaires, prix affichés en د.ل **et en USD**, paiement sur la
page hébergée NOWPayments, confirmation automatique par IPN (webhook) et suivi
dans `/admin/orders`.

### Paiement en totalité ou en tranches

Le dialogue de paiement propose trois modes, reflétés dans le prix affiché :

| Mode | Facturation |
| --- | --- |
| **Paiement total** | 100 % du prix USD en une fois |
| **2 tranches** | 50 % / 50 % (arrondi au centime, la dernière tranche absorbe le reste) |
| **3 tranches** | 33,3 % / 33,3 % / 33,4 % |

- La **première tranche est facturée immédiatement** ; les suivantes sont
  créées à l'avance en base (une commande par tranche, référence
  `NKH-XXXX-T2`, `NKH-XXXX-T3`) et restent à régler depuis la page de suivi
  `/pay/success?ref=NKH-XXXX`.
- Chaque tranche est un paiement NOWPayments distinct : l'IPN confirme chaque
  versement indépendamment, et l'e-mail « paiement confirmé » précise la
  tranche concernée.
- Le montant est toujours recalculé côté serveur à partir de `priceUsd` :
  le navigateur ne peut pas modifier le prix ni la répartition.
- L'admin `/admin/orders` affiche le badge « Tranche 2/3 » et le groupe de
  paiement associé.

### 1) Côté NOWPayments (une fois, dans votre tableau de bord)

1. Confirmez votre e-mail d'inscription.
2. **Settings → API keys** : créez une clé API (gardez-la secrète).
3. **Settings → Payouts / Crypto accounts** : ajoutez les adresses de
   réception (BTC, USDT-TRC20, ETH…) — sans wallet, aucun paiement ne peut
   être crédité.
4. **Settings → IPN** : ajoutez `https://nokhba.net.ly/api/payments/ipn`
   (l'URL est aussi envoyée à chaque paiement, ce double la fiabilité).
5. Si votre compte est en mode test, activez le sandbox (voir `NOWPAYMENTS_SANDBOX`).

### 2) Côté site (variables d'environnement)

| Variable | Effet |
| --- | --- |
| `NOWPAYMENTS_API_KEY` | **Requise** — clé API du marchand |
| `NOWPAYMENTS_IPN_SECRET` | Secret IPN — par défaut = clé API |
| `NOWPAYMENTS_EMAIL` / `NOWPAYMENTS_PASSWORD` | Optionnel — permet d'interroger le statut en direct (sinon : IPN seul) |
| `NOWPAYMENTS_SANDBOX` | `true` pour tester sur api-sandbox.nowpayments.io |
| `NOWPAYMENTS_CURRENCY` | Devise de facturation — `usd` par défaut (la LYD n'est pas supportée par NOWPayments) |
| `SITE_URL` | URL publique pour les retours succès/annulation et l'IPN (variable serveur, non exposée au navigateur) |

### Notes

- Le site crée une **facture NOWPayments** (API `/invoice`) : c'est elle qui
  fournit la page de paiement hébergée (`invoice_url`) avec les retours
  `success_url` / `cancel_url`, et le client y choisit sa cryptomonnaie.
  Le `payment_id` est enregistré sur la commande dès le premier IPN, qui
  retrouve la commande par son `order_id` (référence `NKH-…`).
- Si le dialogue affiche « échec de création du paiement » à la validation :
  vérifiez que `NOWPAYMENTS_API_KEY` est bien définie (Settings → API keys)
  et que le compte n'est pas en mode test sans `NOWPAYMENTS_SANDBOX=true`.
- Les prix s'affichent en د.ل mais sont facturés en USD : chaque formule a un
  `priceUsd` dans `src/lib/config.ts` (éditable aussi dans
  Admin → Configuration — laissé vide, la formule n'est plus payable en
  crypto). Ajustez-le selon votre taux de change.
- **Seul l'IPN (ou le statut `finished`/`confirmed`) confirme un paiement** —
  la redirection `success_url` n'est qu'une indication visuelle.
- La clé API ne quitte jamais le serveur : création du paiement, IPN et
  consultation du statut sont tous des appels serveur-à-serveur.
- Commandes visibles dans `/admin/orders` (nav « Paiements crypto ») avec
  filtres par statut et détails (adresse, montant crypto, IPN brut).

## SEO
- sitemap.ts, robots.ts, metadata, hreflang, Open Graph, LocalBusiness JSON-LD déjà inclus
- Ajoutez Google Analytics ID dans `src/app/page.tsx` placeholder
- respects `prefers-reduced-motion` via Framer Motion

## A personnaliser avant mise en ligne
1. Prix réels dans config.ts
2. Numéro WhatsApp réel
3. Adresse/email/horaires
4. Images réelles (remplacer Unsplash)
5. Logos clients (bande de confiance)
6. Domaine officiel (`nokhba.net.ly`) dans `src/lib/config.ts` (`domain` et `url`), utilisé aussi pour les métadonnées SEO.
7. GA/Plausible ID
8. Favicon/OG image dans public/
9. Textes légaux si besoin
10. Fournisseur d'e-mail (`RESEND_API_KEY` ou `SMTP_HOST`) pour les demandes de devis

## Performance
- next/image lazy, SSG, CSS variables, pas de gros JS
- Lighthouse 90+ visé — testez avec `npm run build && npx serve out` ou Vercel Analytics

## RTL parfait
- dir dynamique, icônes directionnelles, animations inversées via `dir` context

## Panneau d'administration
- **URL** : `/admin` (connexion) — interface en français, accès protégé par session signée (7 jours)
- **Variable obligatoire** : `ADMIN_PASSWORD` (Settings → Environment Variables sur Vercel). Optionnel : `SESSION_SECRET` (sinon la session est signée avec ADMIN_PASSWORD)
- **Modules** :
  - **Tableau de bord** — statistiques (total, nouveaux, en cours, traités), activité 14 jours, dernières demandes
  - **Demandes** — les formulaires du site sont enregistrés en base (table `leads`, créée automatiquement) : filtres, recherche, statuts, notes internes, contact WhatsApp/email, export CSV
  - **Configuration** — coordonnées, réseaux sociaux, chiffres et tarifs éditables, visibles immédiatement sur le site
  - **Contenu** — démos, témoignages et FAQ éditables (réordonner, ajouter, supprimer) avec bouton « Réinitialiser »
- Les réglages sont stockés dans la table `settings` ; par défaut le site utilise les valeurs de `src/lib/config.ts` et `src/lib/content.ts`
- Après chaque enregistrement, le site public est régénéré automatiquement (revalidation Next.js)
- **Optionnel** : `WEBHOOK_URL` — si définie, chaque demande du formulaire est aussi envoyée vers ce webhook (Formspree, Make, Zapier…)
- **Optionnel** : `RESEND_API_KEY` ou `SMTP_HOST` — si un fournisseur d'e-mail est défini, chaque nouvelle demande déclenche une notification à l'agence et un accusé de réception au client
