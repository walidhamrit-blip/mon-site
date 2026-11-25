# Relier Google Search Console pour le contrôle et l’amélioration SEO automatiques

- **Domaine contrôlé :** `https://nokhba.net.ly` (`sc-domain:nokhba.net.ly`)
- **Panneau d’administration en direct :** `/admin/search-console`
- **Suivi quotidien intelligent (7j/7) :** `.github/workflows/gsc-monitor.yml` (`npm run seo:gsc-monitor`)
- **Extraction CLI locale / CSV :** `npm run seo:gsc-quick-wins`

> **Règle de sécurité absolue :** ne collez **jamais** le contenu de votre clé privée (`-----BEGIN PRIVATE KEY-----…`) dans un chat, un ticket public ou un fichier du dépôt. Les clés sont déposées **uniquement** dans **Vercel Environment Variables** et **GitHub Actions Secrets**.

---

## Architecture mise en place

Une fois les 3 variables configurées, votre site dispose de **4 automatismes complémentaires** :

1. **Notification automatique à chaque sauvegarde Admin (`src/lib/indexnow.ts` + `src/lib/google-indexing.ts`)** : chaque mise à jour de contenu ou de fiche resoumet automatiquement `https://nokhba.net.ly/sitemap.xml` à Google Search Console (en production uniquement, jamais depuis une preview).
2. **Panneau temps réel `/admin/search-console`** : affiche à la demande vos clics, impressions, CTR, position moyenne (28j vs 28j précédents), l’état du sitemap, les **Quick Wins Page 2 (positions 11–20)** et les **pages en 1re page à faible CTR (< 2,5 %)** — plus un analyseur CSV instantané utilisable même sans clé API.
3. **Contrôle quotidien intelligent tous les matins à 08:30 UTC (`.github/workflows/gsc-monitor.yml`)** :
   - Relève chaque matin le **pouls court terme (7 jours)** et la **tendance de fond (28 jours)**.
   - Contrôle `https://nokhba.net.ly/sitemap.xml` et ne le resoumet intelligemment qu’au besoin (le lundi, s’il manque, si Google ne l’a pas lu depuis 7 jours, ou s’il reste des erreurs avec un délai anti-spam de 20 h).
   - Met à jour quotidiennement le ticket unique de suivi sur GitHub (**`📊 Suivi automatique Google Search Console`**) et publie l’artefact JSON/Markdown (90 jours).
   - Envoie un condensé sur Telegram le lundi, et **immédiatement** n’importe quel autre jour uniquement en cas d’anomalie (erreur sitemap ou baisse brutale de trafic).
4. **Pont direct vers Arena (`gh` + `google_sheets`)** :
   - Depuis Arena, l’agent lit automatiquement le ticket GitHub mis à jour par `gsc-monitor.yml` (et/ou votre Google Sheet si `GOOGLE_SHEETS_GSC_SPREADSHEET_ID` est configuré), identifie les pages à optimiser et ouvre une Pull Request vérifiée par les tests automatisés avant mise en production.

---

## Étape 1 — Vérifier que la propriété existe dans Search Console

Rendez-vous sur **https://search.google.com/search-console** et vérifiez que vous voyez :

- soit la propriété **Domaine** : `nokhba.net.ly` *(recommandé → valeur API : `sc-domain:nokhba.net.ly`)* ;
- soit la propriété **Préfixe de l’URL** : `https://nokhba.net.ly/` *(valeur API : `https://nokhba.net.ly/`)*.

Si la propriété n’est pas encore validée, suivez d’abord `docs/guide-gsc-sitemap-2026-11-01.md`.

---

## Étape 2 — Créer le compte de service Google Cloud (gratuit, ~3 min)

1. Ouvrez **https://console.cloud.google.com/** et créez un projet (ex. `nukhba-seo`) ou sélectionnez un projet existant.
2. Allez dans **APIs & Services → Library** (*Bibliothèque*) :
   - Recherchez **Google Search Console API** → cliquez sur **Enable** (*Activer*).
   - *(Optionnel, pour synchroniser un tableau Google Sheets)* Recherchez **Google Sheets API** → cliquez sur **Enable**.
3. Allez dans **IAM & Admin → Service Accounts** (*Comptes de service*) → **+ Create Service Account** :
   - **Name** : `nukhba-gsc-bot`
   - Cliquez sur **Create and Continue**, puis **Done** (aucun rôle IAM Cloud n’est requis).
4. Cliquez sur le compte de service créé → onglet **Keys** (*Clés*) → **Add Key → Create new key → JSON** → **Create**.
5. Un fichier `.json` est téléchargé sur votre ordinateur. Il contient notamment deux champs :
   - `"client_email"` : ex. `nukhba-gsc-bot@nukhba-seo.iam.gserviceaccount.com`
   - `"private_key"` : commence par `-----BEGIN PRIVATE KEY-----\n...`

---

## Étape 3 — Autoriser ce compte dans Google Search Console (~1 min)

1. Copiez la valeur `"client_email"` du fichier JSON.
2. Ouvrez **https://search.google.com/search-console** et sélectionnez la propriété `nokhba.net.ly`.
3. Allez dans **Paramètres** (en bas à gauche) → **Utilisateurs et autorisations** → **Ajouter un utilisateur**.
4. Collez l’adresse `...@....iam.gserviceaccount.com`.
5. Choisissez l’autorisation **Complet** (*Full*) → **Ajouter**.
   > Pourquoi **Complet** ? L’accès « Restreint » permet de lire les statistiques, mais Google refuse la soumission automatique du sitemap (`HTTP 403`) sans l’accès **Complet**.

---

## Étape 4 — Enregistrer les 3 secrets dans Vercel et GitHub (~2 min)

Préparez ces 3 variables à partir de votre fichier JSON :

| Nom de la variable | Valeur à coller |
|---|---|
| `GOOGLE_INDEXING_CLIENT_EMAIL` | L’adresse `client_email` (ex. `nukhba-gsc-bot@....iam.gserviceaccount.com`) |
| `GOOGLE_INDEXING_PRIVATE_KEY` | Toute la chaîne `private_key` du JSON (`-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n`) |
| `GOOGLE_INDEXING_SITE_URL` | `sc-domain:nokhba.net.ly` *(si propriété Domaine)* **ou** `https://nokhba.net.ly/` *(si propriété Préfixe)* |

### A. Sur Vercel (pour `/admin/search-console` + soumission auto du sitemap)

1. Ouvrez votre projet sur **Vercel → Settings → Environment Variables**.
2. Ajoutez les 3 variables ci-dessus pour l’environnement **Production**.
3. Déclenchez un **Redeploy** du dernier déploiement de production.
4. Connectez-vous sur `https://nokhba.net.ly/admin/search-console` et cliquez sur **Charger les données GSC**.

### B. Sur GitHub (pour le contrôle automatique chaque lundi + pont Arena)

1. Ouvrez **https://github.com/walidhamrit-blip/mon-site/settings/secrets/actions**.
2. Cliquez sur **New repository secret** et ajoutez :
   - `GOOGLE_INDEXING_CLIENT_EMAIL`
   - `GOOGLE_INDEXING_PRIVATE_KEY`
   - `GOOGLE_INDEXING_SITE_URL`
3. Pour tester immédiatement sans attendre lundi : ouvrez l’onglet **Actions → Google Search Console Monitor → Run workflow**.

---

## Étape 5 (Optionnel) — Synchroniser aussi vers Google Sheets

Si vous souhaitez conserver l’historique hebdomadaire dans une feuille Google Sheets (également lisible en direct par le connecteur `google_sheets` dans Arena) :

1. Créez une feuille Google Sheets vierge sur Google Drive.
2. Cliquez sur **Partager** et donnez le rôle **Éditeur** à l’adresse `GOOGLE_INDEXING_CLIENT_EMAIL`.
3. Relevez l’identifiant dans l’URL de la feuille : `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`.
4. Ajoutez `GOOGLE_SHEETS_GSC_SPREADSHEET_ID` dans GitHub Actions Secrets (et sur Vercel si souhaité).

---

## Étape 6 — Comment lancer une boucle d’amélioration automatique dans Arena

Une fois le workflow actif :

1. **Chaque matin (7j/7)**, GitHub Actions interroge Search Console, contrôle intelligemment `sitemap.xml` et met à jour le ticket **`📊 Suivi automatique Google Search Console`** avec :
   - les requêtes en **position 11 à 20** (*Quick Wins Page 2*) classées par potentiel de trafic ;
   - les pages déjà en **1re page mais à CTR < 2,5 %** nécessitant un meilleur `<title>` / meta description.
2. **À tout moment dans Arena**, écrivez simplement :
   > *« Contrôle le dernier rapport Search Console et applique les optimisations SEO prioritaires »*
3. Arena lit automatiquement le rapport GitHub (et/ou Google Sheets), réécrit les balises `<title>`, meta descriptions, chapôs *Answer-First*, FAQ JSON-LD et maillage interne sur une branche dédiée, vérifie les **1 187+ tests** et garde-fous commerciaux (`35 $` offre site web, bilinguisme AR/EN, CWV), puis vous soumet la Pull Request prête à fusionner.
