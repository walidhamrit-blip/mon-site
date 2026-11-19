# Runbook — surveillance et incidents

**Version :** 18/11/2026
**Site :** https://nokhba.net.ly
**Dépôt :** `walidhamrit-blip/mon-site`
**Hébergement :** Vercel (projet `walid-website/mon-site`)
**Base :** PostgreSQL (Neon)

Ce document décrit **ce qui est surveillé, qui est alerté, et quoi faire**. Il est conçu pour être suivi par une personne non développeuse, avec l'agent IA pour les corrections de code.

> Règle d'or : aucune alerte ne doit rester sans propriétaire. Une alerte sans destinataire est un silence.

---

## 1. Ce qui doit être surveillé

| # | Cible | URL | Attendu | Fréquence | Gravité si échec |
|---|---|---|---|---|---|
| 1 | Santé applicative + base | `https://nokhba.net.ly/api/health` | HTTP 200 **et** corps contenant `"ok":true` | 3–5 min | Critique |
| 2 | Accueil | `https://nokhba.net.ly/` | HTTP 200 + mot-clé `نخبة` | 5 min | Critique |
| 3 | Boutique | `https://nokhba.net.ly/codes` | HTTP 200 | 5 min | Élevée |
| 4 | Page commerciale clé | `https://nokhba.net.ly/services/fix-optimize` | HTTP 200 | 15 min | Moyenne |
| 5 | TLS + domaine | `nokhba.net.ly` | Expiration > 14 jours | 1×/jour | Élevée |
| 6 | Erreurs navigateur | Sentry | Aucune nouvelle issue non triée | Temps réel | Variable |
| 7 | Core Web Vitals | Vercel Speed Insights | p75 LCP < 2,5 s (mobile) | Hebdomadaire | Moyenne |
| 8 | SEO technique | Lighthouse CI planifié | SEO ≥ 90, performance ≥ 85 | 2×/jour | Moyenne |
| 9 | Liens | `scripts/link-check.mjs` | Aucun 404/410/5xx | Hebdomadaire | Faible |
| 10 | Métier | `/admin` (commandes, leads, livraisons) | Aucune file bloquée | Quotidien | Élevée |

**Pourquoi `/api/health` et pas seulement `/` ?**
La page d'accueil peut être servie depuis un cache ou un repli alors que la base est tombée. `/api/health` exécute un `select 1` réel et renvoie **503** si la base ne répond pas. C'est la seule sonde qui distingue « le site répond » de « le site peut vendre ».

**Mode public vs mode complet.**
- Sans secret : `{ ok, mode: "public", database.connected, catalog.degraded }` — suffisant pour un moniteur.
- Avec `Authorization: Bearer $CRON_SECRET` : diagnostic détaillé (NOWPayments, e-mail, fournisseurs, catalogue). **Ne jamais coller ce secret dans un ticket, un chat ou un moniteur tiers.**

---

## 2. Mise en place du moniteur externe (30 min)

### Option A — Better Stack ✅ **choisi le 18/11/2026**

1. Créer un compte sur `betterstack.com`, plan gratuit.
2. Créer 4 moniteurs HTTP(S) :

| Nom | URL | Méthode de contrôle | Intervalle |
|---|---|---|---|
| Nukhba — santé | `/api/health` | statut 200 + **mot-clé** `"ok":true` | 3 min |
| Nukhba — accueil | `/` | statut 200 + mot-clé `نخبة` | 5 min |
| Nukhba — boutique | `/codes` | statut 200 | 5 min |
| Nukhba — TLS | `nokhba.net.ly` | expiration certificat | 1 jour |

3. Configurer les alertes : e-mail + Telegram. Escalade après 2 échecs consécutifs (évite les faux positifs).
4. Activer la page de statut publique seulement si elle est maintenue (sinon, ne pas la publier).

### Option B — UptimeRobot (solution de repli, non retenue)

1. Créer un compte, plan gratuit (50 moniteurs, 5 min).
2. Moniteur HTTP(s) avec **keyword monitoring** sur `/api/health` → `"ok":true`.
3. Ajouter les moniteurs 2, 3, 5 du tableau.
4. Contacts d'alerte : e-mail principal + e-mail secondaire. Pour Telegram, utiliser l'intégration webhook.

### Vérification obligatoire après installation

1. Dans Vercel, créer une **preview** avec une `DATABASE_URL` volontairement invalide.
2. Pointer temporairement un moniteur sur l'URL de preview.
3. Attendre 2 passages : l'alerte doit arriver en **moins de 5 minutes**.
4. Remettre le moniteur sur la production.
5. Noter la date du test dans le tableau §8.

### Réglages Better Stack à appliquer tels quels

| Réglage | Valeur |
|---|---|
| Type | HTTP(S) |
| URL santé | `https://nokhba.net.ly/api/health` |
| Règle de succès | statut `200` **et** corps contenant `"ok":true` |
| Intervalle | 3 min |
| Régions | 2 régions (Europe + Moyen-Orient si disponible) |
| Confirmation | 2 échecs consécutifs avant alerte |
| Timeout | 10 s |
| Alerte | e-mail + Telegram |
| Page de statut | privée au départ, publique seulement si maintenue |

> Ne jamais mettre `CRON_SECRET` ni aucun en-tête d'authentification dans le
> moniteur : la sonde publique suffit et un secret chez un tiers est une fuite.

### Contrôle GitHub complémentaire (déjà en place)

Le workflow `.github/workflows/surveillance.yml` s'exécute **toutes les 6 heures**
et à la demande. Il vérifie :

- `/api/health` → HTTP 200 **et** `"ok":true` ;
- l'accueil → marqueur de marque arabe ;
- `/codes` → HTTP 200 ;
- le certificat TLS → échec sous 7 jours, avertissement sous 14 jours.

En cas d'échec, il ouvre une issue GitHub étiquetée `surveillance` (ou commente
celle déjà ouverte) ; au rétablissement, il la commente et la ferme.

Ce contrôle **ne remplace pas Better Stack** : il n'envoie pas de Telegram et
peut être décalé par GitHub. Il sert de second avis, indépendant de Vercel.
Il ne démarre qu'après fusion sur `main` (les crons GitHub ne s'exécutent que
sur la branche par défaut). Lancement manuel possible depuis l'onglet Actions.

---

## 3. Mise en place de Sentry (1 h, action propriétaire + agent)

> **État du code (18/11/2026, C-04) :** l'intégration est écrite et testée.
> Sans DSN, le SDK n'est **ni chargé ni téléchargé** : aucun impact sur le
> build, le serveur ou le navigateur. Il ne manque que le compte et les
> variables d'environnement.

1. Créer un projet **Next.js** sur `sentry.io` (plan gratuit).
2. Récupérer le **DSN** et le stocker dans Vercel → Settings → Environment Variables (Production **et** Preview) :
   - `SENTRY_DSN` — événements serveur et tunnel ;
   - `NEXT_PUBLIC_SENTRY_DSN` — **le même DSN**, pour les erreurs navigateur (il est public par nature : il ne permet que d'écrire, pas de lire) ;
   - `SENTRY_AUTH_TOKEN` (scope `project:releases`, pour les source maps) ;
   - `SENTRY_ORG`, `SENTRY_PROJECT`.
3. **Ne jamais** committer ces valeurs ; `.env*` est déjà ignoré. Un jeton collé dans un chat doit être révoqué.
4. Redéployer (un déploiement existant ne relit pas les nouvelles variables).
5. Vérifier : provoquer une erreur sur une **preview** (route de test), constater l'événement dans Sentry avec la pile et le commit.
6. Vérifier qu'une preview **sans** `SENTRY_DSN` build et fonctionne normalement.
7. Créer les règles d'alerte :
   - nouvelle issue → e-mail ;
   - erreur sur `/api/payments/*`, `/api/lead`, `/codes/commande` → e-mail + Telegram ;
   - taux d'erreur > 2 % sur 5 min → e-mail + Telegram.
8. Vérifier la confidentialité : aucun e-mail, téléphone, cookie, en-tête ni référence de commande visible dans les événements.

### Ce que le code applique déjà

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Collecte des données | `dataCollection` : identité, cookies, en-têtes, corps, query string **tous désactivés** | Sentry 11 collecte ces champs par défaut |
| Filtre supplémentaire | `scrubSentryEvent` (`src/lib/sentry-scrub.ts`) | retire URL de requête, cookies, corps, query des breadcrumbs |
| Échantillonnage | traces `0.1`, replays `0` | quota et vie privée |
| Tunnel | `POST /monitoring` → Sentry, DSN autorisés uniquement | contourne les bloqueurs de publicité |
| Chargement | `import()` conditionnel | zéro octet Sentry sans DSN |
| Source maps | upload uniquement si jeton + org + projet | un build sans jeton ne casse pas |

**À ne pas faire :** activer les replays de session au départ (données personnelles, poids), ni `tracesSampleRate: 1.0` (coût et bruit).

---

## 4. Routine hebdomadaire (15 min)

| Jour | Contrôle | Où |
|---|---|---|
| Lundi | Issues Sentry non triées | Sentry |
| Lundi | Core Web Vitals p75 mobile | Vercel → Speed Insights |
| Mardi | Leads et commandes de la semaine | `/admin/leads`, `/admin/orders` |
| Mercredi | File de livraison bloquée | `/admin/livraisons` |
| Jeudi | Solde fournisseur / plafond | `/admin/soldes`, `/admin/digital` |
| Vendredi | Résultat Lighthouse planifié + liens | GitHub Actions |
| Mensuel | `npm audit` complet + mise à jour des dépendances | local / Dependabot |
| Trimestriel | Exercice de restauration base | Neon |

### 4 bis. Contrôle automatique des liens (lundi 05:23 UTC)

`.github/workflows/liens.yml` exécute `scripts/link-check.mjs` sur la
production :

- toutes les pages du sitemap (40 maximum) ;
- jusqu'à 80 liens internes découverts dans ces pages ;
- jusqu'à 60 liens externes, dont 5 par page au maximum.

Un **404/410/5xx** est un échec : l'issue `liens` est créée (ou complétée d'un
commentaire) avec le rapport, l'URL fautive et la page d'origine. Le workflow
du lundi suivant **ferme** l'issue si tout est revenu à la normale. Un
**401/403/429** n'est qu'un avertissement : ces codes viennent presque toujours
d'une protection anti-robots, pas d'un lien mort.

Reproduction à la main :

```bash
SITE_URL=https://nokhba.net.ly node scripts/link-check.mjs
```

Lecture d'une alerte : corriger d'abord les liens **internes** (ils sont sous
notre contrôle), puis vérifier un lien externe dans un navigateur avant de le
retirer — un site partenaire peut bloquer momentanément les robots. Ne jamais
supprimer un lien externe sur la seule foi d'un 403.

Comme tout `schedule`, le workflow ne s'exécute qu'une fois sur la branche par
défaut : le tester avec `gh workflow run liens.yml --ref main` après fusion.

---

## 5. Playbooks d'incident

### 5.1 Le site ne répond plus (timeout ou 5xx)

1. Ouvrir `https://nokhba.net.ly/api/health` dans un navigateur.
2. Si **503** avec `database.connected: false` → passer à 5.2.
3. Si **200** mais page en erreur → passer à 5.3.
4. Si aucune réponse → vérifier le statut Vercel (incident plateforme) puis redéployer le dernier commit sain.
5. Si l'incident dépasse 15 min : message court sur les canaux clients (sans détail technique), puis mise à jour toutes les 30 min.

### 5.2 Base de données indisponible (health 503)

1. Vérifier Neon : quota, suspension, limite de connexions.
2. Le site bascule en mode dégradé (catalogue de repli). **Ne pas** promettre de vente pendant ce temps.
3. Si quota : passer au plan supérieur ou réduire le plafond de calcul (déjà fait lors de l'incident du 29/10).
4. Après retour : vérifier `/api/health` (`database.connected: true`), puis une fiche `/codes/<slug>` réelle.
5. Vérifier que les demandes de contact n'ont pas été perdues (journal des e-mails).

### 5.3 Erreur applicative après déploiement

1. Identifier le déploiement fautif dans Vercel (heure, commit).
2. **Rollback immédiat** : Vercel → Deployments → déploiement précédent → *Instant Rollback*.
3. Vérifier `/api/health` et une page commerciale.
4. Ouvrir une issue avec l'erreur Sentry et le commit.
5. Corriger sur une branche, preview, tests, nouvelle PR. Ne pas corriger directement sur `main`.

### 5.4 Pic d'erreurs dans Sentry

1. Regrouper par fichier et par route.
2. Si l'erreur touche le paiement ou la livraison → traiter comme **critique**, même si le site répond.
3. Chercher la dernière modification liée (commit, variable d'environnement, fournisseur).
4. Appliquer un correctif en PR ; rollback si l'origine est le dernier déploiement.

### 5.5 Panne de paiement (NOWPayments)

1. `/api/health` en mode complet (admin) : vérifier `apiKeyValid`, le mode sandbox/réel, le compte crypto de réception.
2. Vérifier le tableau `/admin/orders` : commandes bloquées en attente.
3. Ne jamais redemander un paiement à un client dont la commande est déjà payée : vérifier la référence avant toute communication.
4. Si la passerelle est en panne : afficher un message clair, proposer un moyen alternatif déjà prévu (paiement manuel si activé).

### 5.6 Fuite de secret suspectée

1. Révoquer la clé concernée (NOWPayments, Sentry, CRON_SECRET, ADMIN_PASSWORD).
2. Redéployer avec les nouvelles valeurs.
3. Vérifier les journaux d'accès admin et les commandes récentes.
4. Ne jamais coller le secret dans un ticket ou une conversation ; documenter seulement **quelle** clé a été révoquée et **quand**.

### 5.7 Site client compromis (si Nokhba AI Doctor est vendu)

1. Suspendre le scan et les accès.
2. Informer le client avec les faits, sans attribution prématurée.
3. Conserver les preuves (captures, journaux), ne rien supprimer.
4. Ne jamais appliquer de correctif chez un client sans accord écrit.

---

## 6. Rollback

| Situation | Action | Délai cible |
|---|---|---|
| Dernier déploiement fautif | Vercel → Instant Rollback | < 5 min |
| Correctif déjà fusionné | `git revert <sha>` + PR + merge | < 30 min |
| Variable d'environnement fautive | Corriger dans Vercel + Redeploy | < 15 min |
| Données corrompues | Restauration Neon (branche) après sauvegarde | selon RPO |
| Fonctionnalité isolée | Feature flag / kill-switch (ex. `AUDIT_DOCTOR_ENABLED=false`) | < 5 min |

**Après tout rollback :** vérifier `/api/health`, une page commerciale, une fiche produit, puis consigner l'incident dans §8.

---

## 7. Sauvegarde et restauration

1. Vérifier le plan Neon et la fenêtre de restauration (RPO/RTO).
2. Export mensuel chiffré vers un stockage hors Neon (conservation 6 mois).
3. Exercice trimestriel :
   - créer une branche Neon à partir d'un point de restauration ;
   - vérifier `settings`, `orders`, `leads` ;
   - comparer un prix affiché et une commande ;
   - supprimer la branche.
4. Consigner la date, la durée et le résultat.

**Une sauvegarde non restaurée n'est pas une sauvegarde.**

---

## 8. Journal des tests et incidents

| Date | Type (test/incident) | Détail | Durée | Action | Statut |
|---|---|---|---|---|---|
| 18/11/2026 | Audit | Diagnostic code + build local | — | Plan `docs/plan-corrections-2026-11-18.md` | Ouvert |
| | | Test alerte disponibilité | | | |
| | | Test Sentry | | | |
| | | Restauration base | | | |

---

## 9. Ce qu'il ne faut jamais automatiser

- Supprimer une table, une colonne ou des données clients.
- Modifier les clés, les mots de passe ou les accès.
- Changer les paramètres de paiement ou les adresses de réception.
- Publier un correctif sur le site d'un client sans accord écrit.
- Fusionner une PR générée par une IA sans revue humaine.
- Envoyer des données personnelles à un modèle sans nécessité et sans base légale.

**Règle des trois niveaux :** détection automatique → proposition par l'IA → exécution après validation humaine.

---

## 10. Contacts et accès (à compléter par le propriétaire)

| Rôle | Nom | Canal | Astreinte |
|---|---|---|---|
| Propriétaire | | téléphone / e-mail | oui |
| Agent IA (corrections) | Arena | conversation | non |
| Hébergeur | Vercel | support | — |
| Base | Neon | support | — |
| Paiement | NOWPayments | support | — |

> Ne jamais écrire un mot de passe, une clé API ou un token dans ce tableau.
