# Production Vercel — guide d'exploitation

État de référence vérifié le **19/10/2026** (audit depuis l'agent Arena) :
projet Vercel `walid-website/mon-site`, domaine `nokhba.net.ly`,
commit de production `8b4e39e`, `/api/health` → `ok: true`.

Ce document est la fiche de référence pour garder la production en bon état :
qui fait quoi, chaque variable d'environnement, et comment vérifier.

---

## 1. La boucle de travail Arena → GitHub → Vercel

```
Agent Arena — code sur une branche arena/…
      ↓ Push + Pull Request GitHub
Vercel Preview — URL temporaire *.vercel.app pour tester (mobile, client…)
      ↓ Fusion de la PR sur main
Vercel Production — nokhba.net.ly mis à jour automatiquement
```

- **L'agent Arena peut** : modifier le code, ouvrir les PR, vérifier le
  statut du déploiement Vercel via GitHub (`gh pr checks`), corriger une
  erreur de build avant fusion, relire `/api/health` en production.
- **Le propriétaire seul peut** (tableau de bord vercel.com) : saisir les
  variables secrètes, gérer le domaine/DNS, cliquer « Redeploy », gérer
  les comptes Neon et NOWPayments.
- 🔒 Ne jamais coller un secret (mot de passe, clé API, token Vercel) dans
  une conversation, un commit ou une issue. `.gitignore` bloque déjà
  `.env` / `.env.*` (sauf `.env.example`, sans valeur réelle).

## 2. Variables d'environnement — une par une

Où : **Vercel → projet `mon-site` → Settings → Environment Variables**,
environnement **Production** coché (ajoutez **Preview** seulement si vous
voulez tester les paiements sur les URL d'aperçu).
⚠️ Après tout ajout/modification : **Deployments → ⋯ → Redeploy** — un
déploiement déjà en ligne ne relit jamais les nouvelles valeurs.

### Obligatoires

| Variable | Où l'obtenir | Remarques |
|---|---|---|
| `DATABASE_URL` | Neon / Supabase / Vercel Postgres → chaîne de connexion `postgresql://…?sslmode=require` | Tables `leads`, `settings`, `orders` créées automatiquement au premier chargement |
| `ADMIN_PASSWORD` | À inventer (gestionnaire de mots de passe) | ≥ 10 caractères. Sans elle, `/admin/login` affiche « Variable manquante » |
| `NOWPAYMENTS_API_KEY` | nowpayments.io → Settings → API keys | ⚠️ Clé **production** (`account.nowpayments.io`) ≠ clé **sandbox** — non interchangeables. Ne pas confondre avec le secret IPN |
| `NOWPAYMENTS_IPN_SECRET` | nowpayments.io → Settings → IPN | Déclarer l'URL `https://nokhba.net.ly/api/payments/ipn` côté NOWPayments |
| `SITE_URL` | — | `https://nokhba.net.ly` (retours succès/annulation + IPN) |

Prérequis NOWPayments souvent oublié : **Settings → Crypto accounts** —
ajouter au moins une adresse de réception (BTC, USDT-TRC20…), sinon aucun
paiement ne peut être crédité.

### Recommandées

| Variable | Valeur |
|---|---|
| `SESSION_SECRET` | `openssl rand -hex 32` — distinct du mot de passe admin (sinon la session est signée avec `ADMIN_PASSWORD`) |
| `NOWPAYMENTS_CURRENCY` | `usd` (la LYD n'est pas supportée par NOWPayments) |

### Optionnelles

| Variable | Rôle |
|---|---|
| `NOWPAYMENTS_SANDBOX` | Vide/`false` en production réelle. `true` **uniquement** avec une clé sandbox (mélange = `403 INVALID_API_KEY`) |
| `NOWPAYMENTS_EMAIL` / `NOWPAYMENTS_PASSWORD` | Polling direct du statut d'un paiement uniquement |
| `NOWPAYMENTS_API_BASE` | Laisser vide (tests internes) |
| `RESEND_API_KEY` **ou** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | E-mails de confirmation. Sans fournisseur, les demandes restent enregistrées mais aucun e-mail ne part |
| `LEAD_NOTIFICATION_EMAIL` | Destinataire des notifications de nouveaux leads |
| `WEBHOOK_URL` | Webhook sortant divers |

En local : `cp .env.example .env.local`, remplir, puis `npm run doctor`
(diagnostic complet, n'affiche jamais de secret).

## 3. Vérifier la production : `/api/health`

Ouvrir `https://nokhba.net.ly/api/health` — réponse attendue (valeurs
relevées le 19/10/2026) :

```json
{ "ok": true,
  "vercel": { "env": "production", "commit": "8b4e39e" },
  "database": { "urlConfigured": true, "connected": true, "error": null },
  "nowpayments": { "apiKeyConfigured": true, "apiKeyValid": true,
                   "ipnSecretConfigured": true, "sandbox": false,
                   "reachable": true, "error": null } }
```

Interprétation :

| Champ à `false` | Cause probable |
|---|---|
| `database.urlConfigured` | `DATABASE_URL` absente de l'environnement Production |
| `database.connected` | Base injoignable (chaîne, SSL, base en pause) — voir `database.error` |
| `nowpayments.apiKeyConfigured` | `NOWPAYMENTS_API_KEY` absente → l'ajouter puis **Redeploy** |
| `nowpayments.apiKeyValid` | Clé refusée : sandbox↔production croisés, secret IPN collé à la place, clé régénérée — voir `apiKeyError` |
| `nowpayments.reachable` | Sortie réseau vers NOWPayments bloquée |
| `vercel.commit` ≠ dernier commit `main` | Le déploiement de production n'est pas le dernier code |

`ok` n'est `true` que si un paiement peut réellement être créé
(base connectée **et** clé acceptée).

## 4. Test de bout en bout (réservation 1 $)

Fiche d'une démo → « Réservez votre place — 1 $ » → e-mail → la facture
NOWPayments s'ouvre → après paiement, l'IPN passe la commande `RSV-…` en
`confirmed`, visible dans **Admin → Paiements & réservations**.

## 5. Résultat de l'audit du 19/10/2026

| Contrôle | Résultat |
|---|---|
| Déploiement production (Vercel ↔ GitHub) | ✅ `Deployment has completed` sur `8b4e39e` |
| `GET /api/health` | ✅ `ok: true` — paiements **réels** (`sandbox: false`, clé valide, HTTP 200) |
| `/admin/login` | ✅ Formulaire sans alerte « Variable manquante » → `ADMIN_PASSWORD` présent |
| `npm run build` (local, sans secrets) | ✅ 28 routes — le mode dégradé est géré proprement |
| `npm run typecheck` | ✅ Aucune erreur TypeScript |
| `npm run lint` | ⚠️ 5 erreurs + 8 avertissements (non bloquants, voir §6) |
| `.gitignore` | ✅ `.env*`, `.next`, `.vercel` ignorés |

Non vérifiables de l'extérieur (à contrôler dans la **liste des noms** de
variables Vercel — jamais les valeurs) : `SESSION_SECRET` présent ?,
fournisseur e-mail (`RESEND_API_KEY` ou `SMTP_HOST`) présent ?

## 6. Points de vigilance

1. **Latence base à froid** : `latencyMs` ≈ 1 200 ms mesuré sur requête à
   froid (réveil de la base + ouverture TLS). Normal au premier appel ;
   si cela persiste à chaud, rapprocher la région des fonctions Vercel
   (Settings → Functions) de la région de la base PostgreSQL.
2. **Lint — 5 erreurs `react-hooks/set-state-in-effect`** :
   `src/components/theme-provider.tsx`, `src/lib/i18n.tsx`,
   `src/components/live-site-frames.tsx` (×3). Ce sont les lectures
   `localStorage` au montage (thème, langue, état des cadres) — motif
   volontaire, sans effet sur la production (le build Vercel ne bloque
   pas dessus). Correctif propre = `useSyncExternalStore`, à faire dans
   une PR dédiée testée en Preview, car le système thème/langue est
   sensible (correctifs PR #19→#21).
3. **Lint — 8 avertissements** : 6 `<img>` à migrer vers `next/image`
   (LCP/bande passante), 1 police personnalisée, 1 `watch()` react-hook-form
   incompatible avec la mémoïsation du compilateur React.
