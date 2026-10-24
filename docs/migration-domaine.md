# Migration de domaine — runbook

> Comment passer de `nokhba.net.ly` à un autre domaine (`.com`, `.net`, `.agency`…)
> **sans toucher au code**.

Dernière mise à jour : octobre 2026 · PR #58 (préparation) + ce document.

---

## 1. Pourquoi cette page existe

`nokhba.net.ly` est un **ccTLD** (extension nationale libyenne). Google le traite comme un
signal de géolocalisation fort : petit **boost** en Libye, petit **demotion** ailleurs.
Ce n'est **ni une pénalité, ni un blocage** — mais c'est le principal frein SEO
résiduel pour une audience internationale.

Le reste du site a déjà été rendu neutre (marché configurable, devises, SEO piloté par
la config). Il ne restait que le **domaine lui-même**, encore écrit en dur à une
dizaine d'endroits. C'est ce que la PR #58 a corrigé.

**Après la PR #58, changer de domaine est une opération de configuration, pas de développement.**

---

## 2. Ce qui est déjà prêt

| Élément | État |
|---|---|
| Domaine et URL canonique | modifiables depuis `/admin` → Réglages (« Domaine affiché », « URL canonique ») |
| Résolution centralisée | `src/lib/site-identity.ts` — source unique de vérité |
| Sitemap, métadonnées, canoniques, JSON-LD | suivent la config admin |
| Badge de netlinking (12 sites clients) | URL de crédit et extraits copiables suivent le domaine |
| Audit du badge |Tolère les anciens domaines (`--accept`) → pas de fausse alerte |
| E-mails sortants | domaine d'expéditeur dérivé du domaine canonique |
| Workflows CI | lisent la variable de dépôt `SITE_URL` |
| Garde-fou | `scripts/site-identity.test.mjs` échoue si le domaine est re-fossilisé dans le code |

---

## 3. Procédure

### Étape 1 — Préparer (sans impact)

1. Acheter le nouveau domaine chez le registrar.
2. Ajouter le domaine dans **Vercel → Settings → Domains** (Vercel gère le certificat).
3. Pointer les enregistrements DNS :
   - `A` / `ALIAS` → IP Vercel ;
   - `CNAME` `www` → `cname.vercel-dns.com` ;
   - `MX` + SPF/DKIM/DMARC **si** l'envoi d'e-mails doit passer par le nouveau domaine.
4. Créer la propriété Search Console sur le **nouveau** domaine et récupérer :
   - le **code de vérification** (méta-tag) → `GOOGLE_SITE_VERIFICATION` ;
   - le **fichier de vérification** → `public/<nouveau-code>.html`.
5. Vérifier le domaine d'envoi chez Resend (SPF/DKIM) si l'on change l'expéditeur.

> ⚠️ **Ne supprimez pas encore `public/googleaf08e19c9e7d8550.html`** : il est lié à
> l'ancienne propriété Search Console et sert encore de preuve pour le `.net.ly`.

### Étape 2 — Basculer la configuration

5. `/admin` → Réglages :
   - « Domaine affiché » → `exemple.com` ;
   - « URL canonique » → `https://exemple.com`.
6. Variables d'environnement (Vercel → Settings → Environment Variables) :

   | Variable | Nouvelle valeur |
   |---|---|
   | `SITE_URL` | `https://exemple.com` |
   | `NEXT_PUBLIC_SITE_URL` | `https://exemple.com` |
   | `EMAIL_DOMAIN` | `exemple.com` (si l'expéditeur change) |
   | `GOOGLE_SITE_VERIFICATION` | code de la nouvelle propriété |
   | `GOOGLE_INDEXING_SITE_URL` | `sc-domain:exemple.com` (recommandé) |
   | `BRAND_DOMAIN` | `exemple.com` |

7. Redéployer (le build est statique : un redéploiement suffit).
8. Repository → Settings → Secrets and variables → Actions → **Variables** :
   créer `SITE_URL = https://exemple.com` (utilisé par les workflows badge et captures).

### Étape 3 — Redirection permanente

9. Chez le registrar (ou chez Vercel), rediriger **301** :
   `https://nokhba.net.ly/*` → `https://exemple.com/*`
   (redirection « permanente », pas « temporaire » : elle transmet l'autorité).
10. Vérifier que `https://www.nokhba.net.ly/` suit bien la redirection.

### Étape 4 — Netlinking (le point sensible)

Les **12 sites clients** portent un lien dofollow vers `nokhba.net.ly`. Deux options :

- **Option A (recommandée)** — laisser le lien tel quel. La redirection 301 fait suivre
  le lien et l'autorité transite. Aucun travail sur les sites clients.
- **Option B** — remplacer le lien sur les 12 sites (il faut les relancer → travail).
  Dans ce cas, mettre à jour les extraits sur `/badge` et prévenir les clients.

Pendant la transition, l'audit hebdomadaire doit tolérer l'ancien domaine :

```bash
npm run badge:audit -- --accept=https://nokhba.net.ly
```

Sans ce drapeau, l'audit signalera les 12 clients « badge manquant » et ouvrira des
issues — c'est le comportement attendu *si* on a choisi l'option B et que le
remplacement n'est pas fait.

### Étape 5 — Paie et e-mails

11. **NOWPayments** (tableau de bord) :
    - URL d'IPN → `https://exemple.com/api/payments/ipn` ;
    - URL de retour succès / annulation → `https://exemple.com/pay/success` et `/pay/cancel` ;
    - le **montant facturé reste en USD** — la devise d'affichage est sans impact.
12. **Resend** : domaine d'expéditeur vérifié, `EMAIL_FROM` aligné.
13. **Formulaire de contact** : l'adresse e-mail affichée est elle aussi modifiable
    depuis `/admin` → Réglages.

### Étape 6 — Vérifications

```bash
npm run build
npm run test:seo          # 141 tests, dont le garde-fou anti-durcissement
npm run test:subscriptions
BASE_URL=https://exemple.com npm run seo:check
npm run badge:audit -- --dry-run
```

Puis, sur le site en production :

| Contrôle | Attendu |
|---|---|
| `https://exemple.com/` | 200, `<link rel="canonical">` sur le nouveau domaine |
| `https://nokhba.net.ly/` | **301** vers le nouveau domaine |
| `https://exemple.com/sitemap.xml` | URLs sur le nouveau domaine |
| `https://exemple.com/llms.txt` | nouveau domaine |
| `https://exemple.com/codes` | 200 (vitrine catalogue intacte) |
| Search Console | nouvelle propriété vérifiée, sitemap soumis |
| `https://exemple.com/googleaf…html` | fichier de vérification de la **nouvelle** propriété |

---

## 4. Rollback

Tout est réversible : `/admin` → Réglages (remettre l'ancien domaine), variables
d'environnement d'origine, redirection 301 retirée. Le `.net.ly` reste actif
pendant toute la durée de l'opération — **ne supprimez pas l'ancien domaine avant
que la nouvelle propriété Search Console soit vérifiée**.

---

## 5. Ce qui n'est **pas** automatisé (et pourquoi)

- **Le fichier de vérification Search Console** : Google n'émet un code que pour une
  propriété et pour un domaine. Il doit être déposé manuellement dans `public/`.
- **Le code de vérification méta-tag** : il n'est émis que si le domaine correspond.
  `googleSiteVerification()` le désactive automatiquement sur un autre domaine — c'est
  volontaire, un code invalide ne sert à rien et masquerait la ligne manquante.
- **Les enregistrements DNS et le 301** : chez le registrar, hors du dépôt.
- **La signature des e-mails (SPF/DKIM)** : chez Resend, hors du dépôt.
