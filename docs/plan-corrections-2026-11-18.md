# Plan de corrections — Nokhba.net.ly

**Date :** 18 novembre 2026
**Branche d'audit :** `arena/eafcdc44-mon-site` (base `cdbf0a8`)
**Périmètre :** code source, build local, tests, configuration de déploiement.
**Hors périmètre (non accessible depuis cet environnement) :** base de production, logs Vercel, Search Console, analytics réels, site live.

> **Mise à jour du 18/11/2026 :** D1 (**90 USDT**) et D2 (**Better Stack**)
> validés ; **C-01 à C-04 appliqués et vérifiés en preview**.
> Prix à source unique, outils de build sans avis bloquant non justifié,
> frontières d'erreur, instrumentation serveur et SDK Sentry conditionnel —
> **tests verts**, build et `seo:check` OK. C-05 : contrôle GitHub planifié
> ajouté ; reste le compte Better Stack et les alertes Telegram. Le diagnostic initial est conservé
> pour référence.

---

## ملخص تنفيذي (بالعربية)

- الموقع مبني بتقنية **Next.js 16 + React 19 + TypeScript + PostgreSQL (Neon)**، ومستضاف على **Vercel**، والكود على **GitHub**. هذا يجيب مباشرة على الأسئلة الثلاثة في تحليلك.
- الحالة التقنية الأساسية **جيدة**: 1022 اختباراً تنجح، فحص الأنواع نظيف، البناء ينجح، رؤوس الأمان مفعّلة، وفحص SEO وLighthouse يعمل تلقائياً في CI.
- **المشكلة الأولى مؤكدة في الكود**: بطاقة السعر تقرأ الرقم من لوحة الإدارة (مثلاً 90 USDT)، بينما نصوص ثابتة في عدة ملفات تقول 15 $. هذا يفسر بالضبط ما لاحظته. الحل: مصدر واحد للسعر + اختبار يمنع عودة التكرار.
- **لا توجد حدود أخطاء** (`error.tsx`) ولا **مراقبة أخطاء وقت التشغيل** (Sentry غير مثبت) ولا **مراقبة توفر خارجية**. أي عطل يبقى خفياً حتى يشتكي عميل.
- **ثغرتان متوسطتان** في `next` و`nodemailer`، والإصلاح متاح ومباشر.
- **الثقة**: يوجد قسم آراء و«قبل/بعد»، لكن ينقص دليل قابل للتحقق: دراسات حالة مؤرخة، تقرير تدقيق نموذجي، وقائمة الأربعين نقطة المنشورة.
- **الواجهة**: المسارَان موجودان فعلاً (3 بطاقات + قسم أعمال + متجر)، لكن الازدحام وليس غياب الفصل هو المشكلة.
- **تم تنفيذ الدفعة الأولى**: السعر 90 بمصدر واحد، تحديث المكتبات (0 ثغرات في الإنتاج)، وصفحات أخطاء + تسجيل أخطاء الخادم. 1033 اختباراً ناجحاً.
- **الخطة في 5 مراحل**: قرارات (30 دقيقة) → إصلاحات فورية (1–2 يوم) → مراقبة (1 يوم) → أدلة وثقة (3–5 أيام) → Nokhba AI Doctor (أسبوعان).
- **تم تأكيد السعر النهائي: 90 USDT**، وتم تطبيق إصلاح «مصدر واحد للسعر» في الكود مع اختبار يمنع التكرار. القراران المتبقيان: مزوّد المراقبة ونطاق AI Doctor.
- **ما لا يجب أتمتته**: حذف البيانات، تعديل المدفوعات، أسرار الخادم، والنشر على موقع عميل دون موافقة بشرية.

---

## 1. Réponses au questionnaire de l'analyse

L'analyse se terminait par trois questions. Voici les réponses factuelles, lues dans le dépôt :

| Question | Réponse vérifiée |
|---|---|
| Technologie | **Next.js 16.4.2** (App Router, Turbopack), **React 19.2.6**, **TypeScript 5.9**, **Tailwind CSS 4.1**, **Drizzle ORM 0.45** + **PostgreSQL (Neon)**, `next/image`, Framer Motion, AI SDK 7 (Anthropic / Gemini / OpenAI) |
| Hébergement | **Vercel** (production `nokhba.net.ly`, previews protégées, 4 crons dans `vercel.json`) |
| Accès au code | **Oui, via GitHub** : dépôt `walidhamrit-blip/mon-site`, branche de travail `arena/eafcdc44-mon-site` |

Autres faits utiles :

- **30 pages publiques** métier (hors variantes opengraph), **78 routes** générées au build.
- **1022 tests** `node:test` exécutés localement, **tous verts** en 12,5 s.
- CI existante : `lint`, `typecheck`, `tests`, puis build + `seo:check` + `audit:catalog` + Lighthouse sur 4 URLs.
- Endpoint de santé : `/api/health` (mode public minimal, mode complet avec secret/admin).
- Alertes opérationnelles déjà présentes : Telegram pour certaines opérations, e-mails fournisseurs.

---

## 2. Synthèse exécutive

### 2.1 Verdict

Le site n'est **pas** un site fragile à reconstruire. C'est une plateforme commerciale déjà outillée : panier, paiements crypto, livraison de codes, back-office, catalogue de ~280 produits, SEO bilingue, cache, tests de non-régression.

Les vrais risques sont ailleurs :

1. **Une incohérence de prix** (P0), dont la cause était structurelle — **corrigée le 18/11/2026** (C-01).
2. **Une visibilité encore partielle sur les pannes** : les frontières d'erreur et les logs serveur sont en place (C-03), mais il manque toujours la capture centralisée (Sentry) et le moniteur de disponibilité externe.
3. **Un déficit de preuve commerciale** sur l'offre la plus vendable (`Fix & Optimize`) : promesse forte, mais aucun échantillon de livrable.
4. **Des dépendances à corriger** (3 vulnérabilités modérées) — **corrigées le 18/11/2026** (C-02).
5. **Un parcours d'accueil dense** : deux activités, mais six points d'entrée concurrents.

### 2.2 Ce que l'analyse initiale a vu juste — et ce qu'il faut nuancer

| Constat de l'analyse | Statut après audit du code |
|---|---|
| Prix 90 USDT vs 15 $ sur Fix & Optimize | **Confirmé**, et la cause est identifiée : le prix affiché est dynamique, les textes sont figés (voir C-01) |
| Deux activités mélangées sur l'accueil | **Partiellement vrai** : la séparation existe (3 cartes + panneau « pour votre activité »), le problème est la **densité** et la **hiérarchie**, pas l'absence de parcours |
| Manque de preuves de confiance | **Vrai** : témoignages et « avant/après » existent, mais pas d'étude de cas mesurée ni de rapport type |
| Audit 40+ points sans exemple | **Vrai** : la promesse est là, le livrable n'est pas montré |
| Absence de surveillance permanente | **Vrai en externe** : l'endpoint de santé existe, mais rien ne l'appelle périodiquement ; aucune capture d'erreur JS |
| Site accessible lors du contrôle | Cohérent avec le build local et l'endpoint de santé ; l'état de production n'a pas pu être revérifié ici |

### 2.3 Scorecard (état au 18/11/2026)

| Axe | État | Priorité |
|---|---|---|
| Cohérence commerciale (prix, offres) | 🟢 Corrigée le 18/11 (90 unique) | — |
| Robustesse runtime (erreurs, récupération) | 🟢 Frontières + instrumentation (18/11) | — |
| Sécurité des dépendances | 🟢 0 avis bloquant non justifié (18/11) | — |
| Observabilité (erreurs, disponibilité) | 🟠 Sentry prêt (DSN à ajouter), uptime non installé | **P1** |
| Preuve / conversion | 🟠 Base solide, preuves insuffisantes | **P1** |
| Clarté de l'accueil | 🟠 Deux parcours, trop d'entrées | **P1** |
| Performance | 🟢 Bonne base, tout est dynamique | P2 |
| SEO / GEO | 🟢 Très au-dessus de la moyenne | P2 |
| Sécurité applicative | 🟢 En-têtes complets et testés | P2 |
| Tests / CI | 🟢 1033 tests, garde-fous réels | — |

---

## 3. Ce qui est déjà solide (à ne pas casser)

1. **En-têtes de sécurité** : HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP, COOP/CORP, posés dans `next.config.ts` et `src/proxy.ts`, verrouillés par `scripts/security-headers.test.mjs`.
2. **SEO/GEO** : titres bornés à 60 caractères, canoniques, JSON-LD (Service, Offer, FAQPage, CollectionPage), `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, vérifiés en CI par `scripts/seo-check.mjs`.
3. **Cache et invalidation** : `unstable_cache` + tags `site-data` / `digital-catalog`, invalidation à l'écriture, documentés dans `docs/performance-rendu-cache.md`.
4. **Résilience base** : si `DATABASE_URL` manque ou si Neon tombe, le site retombe sur les contenus par défaut et le signale (vérifié au build). L'incident Neon du 29/10 a déjà produit des correctifs.
5. **Tests** : 1022 tests couvrant paiements, codes, livraison, SEO, accessibilité, sécurité, admin, i18n. C'est rare à ce niveau.
6. **Politique d'avis honnête** : pas de note agrégée inventée, pas de `aggregateRating` auto-déclaré, lien vers les plateformes tierces (`/avis`).
7. **Bilingue AR/EN avec RTL**, locale pilotée par l'URL et non par un en-tête client.
8. **Santé** : `/api/health` distingue un mode public (`select 1`) d'un mode complet protégé, avec limitation de débit.

Le plan ci-dessous **ajoute** des garde-fous ; il ne réécrit pas ces fondations.

---

## 4. Constats détaillés et corrections

Légende : **P0** = à corriger cette semaine ; **P1** = ce mois ; **P2** = ce trimestre ; **P3** = ensuite.
Effort exprimé en sessions de travail assistées (½ journée ≈ 3 h).

---

### C-01 — Prix affiché incohérent : 90 USDT sur la carte, 15 $ dans le texte · **P0**

**Statut : corrigé le 18/11/2026** (prix confirmé à 90 USDT).

**Constat.** Sur `/services/fix-optimize`, la carte tarifaire affichait le prix lu dans la configuration (90 USDT dans `/admin`), tandis que le paragraphe d'introduction, la réponse « answer-first », les descriptions, les comparatifs et `llms.txt` annonçaient encore 15 $.

**Preuve dans le code :**

| Élément | Fichier | Comportement |
|---|---|---|
| Carte tarifaire | `src/components/service-detail-view.tsx:116` | `<Price usd={service.priceFromUsd} />` → **dynamique** |
| Schéma `Offer` | `src/lib/services.ts:661` | `price: String(service.priceFromUsd)` → **dynamique** |
| Contenu éditorial | `src/lib/services.ts:501,503,511,513` | « from $15 » → **figé** |
| `resolveServiceLanding()` | `src/lib/services.ts:604-606` | renvoie l'objet statique, **sans réinjecter le prix** |
| Hero du hub services | `src/components/services-hub-view.tsx:114` | `from: "15 دولاراً" / "$15"` → **figé** |
| Textes i18n | `src/lib/i18n.tsx:113,115` | « from $15 » → **figé** |
| Comparatifs | `src/lib/comparisons.ts` (12 occurrences) | « services from $15 » → **figé** |
| `llms.txt` | `src/lib/llms-txt.ts:391` | « from $15 » → **figé** |
| Blog | `src/lib/blog-articles.ts:397-398` | « from $15 » → **figé** |

**Cause racine.** Il existe **deux sources de vérité** pour le prix :
1. `config.standaloneServices[].priceFromUsd`, modifiable dans `/admin → Réglages`, lue à l'exécution ;
2. des chaînes de caractères figées dans le contenu éditorial.

Dès que le propriétaire modifie le prix dans l'admin (15 → 90), la carte et le JSON-LD suivent, les textes non. C'est exactement le symptôme observé. Le problème n'est donc pas une faute de frappe : **il se reproduira au prochain changement de tarif**.

**Correction recommandée.**

1. **Trancher le prix** (décision D1) : 90 USDT si c'est le tarif réel de départ, sinon 15. Ne jamais garder les deux.
2. Créer `src/lib/service-pricing.ts` :
   - `serviceStartingPrice(services, id)` (une seule fonction, réutilisée par la page, le hub, les métadonnées et le JSON-LD) ;
   - `formatStartingPrice(amount, locale)` ;
   - `fillPriceTokens(text, services)` qui remplace `{price:<id>}` par le prix du service visé (permet de citer un autre service sans figer son tarif).
3. Remplacer dans `serviceLandingDefaults` les montants figés par `{price}` (le service concerné uniquement). Pour les textes qui parlent d'un **autre** service (ex. « second section from $15 »), soit supprimer le montant, soit injecter le prix du service visé via une liste.
4. Dans le hub (`services-hub-view.tsx`), supprimer le littéral ligne 114 et dériver le montant du helper existant `price()` (avec un formatage arabe « 15 دولاراً » plutôt qu'un `$` brut) ; corriger `heroSecondaryAr/En` dans `i18n.tsx` pour utiliser le même jeton `{from}`.
5. Dans le contenu éditorial de longue durée (comparatifs, blog, `llms.txt`), **retirer les montants** et renvoyer vers `/services` (« tarifs publiés sur la page services »). Un comparatif ne doit pas devenir faux à chaque changement de tarif.
6. Ajouter `scripts/service-price-consistency.test.mjs` :
   - simuler `priceFromUsd = 90` et vérifier que le texte résolu, la description, la réponse et le JSON-LD contiennent **90** et **aucun** « 15 » ;
   - échouer si `serviceLandingDefaults["fix-optimize"]` contient un montant en dur ;
   - échouer si `services-hub-view.tsx` contient `"15 دولاراً"` ou `"$15"`.
7. Optionnel : dans `/admin`, afficher un aperçu du rendu de la page service après modification du prix (réduit le risque humain).

**Fichiers.** `src/lib/services.ts`, `src/lib/service-pricing.ts` (nouveau), `src/components/services-hub-view.tsx`, `src/lib/i18n.tsx`, `src/lib/comparisons.ts`, `src/lib/blog-articles.ts`, `src/lib/llms-txt.ts`, `scripts/service-price-consistency.test.mjs` (nouveau).

**Critères d'acceptation.**
- Changer le prix dans `/admin` met à jour **carte + métadonnées + réponse + JSON-LD + llms.txt**, sans autre édition.
- Le test échoue si un montant figé réapparaît.
- `npm test` reste vert.

**Effort.** ½ à 1 session. **Risque.** Faible (contenu), à condition de ne pas toucher aux calculs de commande.

**Correction appliquée (18/11/2026).**
- Nouveau module `src/lib/service-pricing.ts` : `formatServicePrice`, `serviceStartingPrice`, `lowestServicePrice`, `fillPriceTokens`.
- `src/lib/config.ts` : tarif de repli `fix-optimize` = **90**.
- `src/lib/services.ts` : **les six services** utilisent `{price}` dans leurs titres, descriptions et réponses, résolu par `resolveServiceLanding()` avec le prix vivant. La FAQ « second section » ne fige plus 15 $.
- `src/components/services-hub-view.tsx` : le hero affiche le **minimum calculé** (19 $ actuellement) ; plus aucun 15 $ littéral.
- `src/lib/i18n.tsx`, `comparisons.ts`, `blog-articles.ts`, `llms-txt.ts` : montants de service figés retirés ou rendus dynamiques.
- Nouveau test `scripts/service-price-consistency.test.mjs` : vérifie 90, l'absence de `{price}`, la propagation d'un prix modifié **pour chaque service**, l'absence de montant en dur dans `services.ts` et l'absence de « $15 » dans les contenus publics.
- Vérifications : `npm test` → **1027/1027**, `typecheck` 0 erreur, `build` OK, `seo:check` 0 erreur bloquante ; pages locales : carte **90**, meta description « من 90 دولاراً », JSON-LD `"price":"90"`, hub « تبدأ من 19 دولاراً », les 6 pages services sans jeton `{price}`.

---

### C-02 — Dépendances vulnérables · **P0**

**Constat.** `npm audit --omit=dev` remonte **3 vulnérabilités modérées** :

| Paquet | Version installée | Correctif | Portée |
|---|---|---|---|
| `next` | 16.4.2 | 16.4.6 | Avis sur `use cache` / `unstable_cache` (fuite de cache entre valeurs de paramètres racine) |
| `nodemailer` | 10.1.2 | 10.6.0 | Analyse d'adresses e-mail (commentaires/guillemets) |

Les avis Next concernent précisément un mécanisme que le site utilise massivement (`unstable_cache`). Même si l'exposition réelle n'est pas démontrée ici, le correctif est disponible et sans rupture d'API.

**Correction.**
1. `npm audit fix` (les deux correctifs restent dans les plages `^16.4.2` et `^10.1.2`).
2. Rejouer `npm test`, `npm run typecheck`, `npm run build`, puis vérifier `/api/health` en preview.
3. Ajouter au workflow `ci.yml` : `npm audit --omit=dev --audit-level=high` (les modérés restent visibles sans bloquer) et une revue mensuelle `npm audit` complète.
4. Activer Dependabot (ou Renovate) : mises à jour groupées mineures/patchs, PR séparée pour les majeures.

**Critère d'acceptation.** `npm audit --omit=dev` → 0 vulnérabilité ; build et 1022 tests verts ; preview fonctionnelle (paiement test non requis).
**Effort.** ½ session. **Risque.** Faible.

**Correction appliquée (18/11/2026).**
- `next` **16.4.2 → 16.4.6**, `nodemailer` **10.1.2 → 10.6.0**, `postcss` **8.5.8 → 8.5.33**.
- `npm audit --omit=dev` : **0 vulnérabilité**.
- CI : étape `node scripts/audit-prod.mjs` avant le lint. Le script échoue sur tout avis high/critical non justifié, imprime les exceptions et refuse celles qui ont expiré.
- `.github/dependabot.yml` : mises à jour hebdomadaires groupées (production / développement), majeures Next/React en PR séparées, GitHub Actions mensuelles.
- **Exception documentée (ajoutée le 18/11 avec Sentry) :** `GHSA-fc5q-39xc-vjpf`, ReDoS dans `picomatch` ≤ 4.0.7, tiré par `@sentry/bundler-plugins`. Aucun correctif publié à ce jour ; ce code sert uniquement au build des source maps, n'est ni déployé ni exécuté au runtime. Exception datée au **31/01/2027** dans `scripts/audit-prod.mjs` : dès qu'une version corrigée sort, Dependabot la propose et l'exception doit être retirée.
- Note honnête : un `npm audit` complet (outils de développement inclus) conserve des avis dans la chaîne ESLint. `npm audit fix --force` propose de **rétrograder** `eslint-config-next` ou `@sentry/nextjs` : refusé, car ces paquets ne sont pas déployés et la rétrogradation casserait la configuration.

---

### C-03 — Aucune frontière d'erreur, aucune instrumentation · **P0**

**Constat.** Le dépôt ne contient **aucun** `error.tsx`, `global-error.tsx` ni `instrumentation.ts`. En production, une exception dans un composant client (Framer Motion, lecteur de démo, formulaire) affiche la page d'erreur générique de Next : pas de marque, pas de retour, pas de trace exploitable.

**Correction.**
1. `src/app/global-error.tsx` (client) : HTML minimal autonome, `lang`/`dir`, message bilingue, bouton « recharge », et plus tard `Sentry.captureException`.
2. `src/app/(site)/error.tsx` (client) : page de marque avec `reset()`, liens `/`, `/contact`, WhatsApp, et affichage du `digest` seulement (jamais `error.message` en production).
3. `src/app/admin/(panel)/error.tsx` : erreur admin distincte, pour ne pas ressembler à une déconnexion.
4. `src/instrumentation.ts` : export `onRequestError` (hook Next 16) qui journalise côté serveur (console structuré, puis Sentry en C-04).
5. `src/app/loading.tsx` : squelette discret pour les pages dynamiques (perception de vitesse).
6. Test `scripts/error-boundaries.test.mjs` : présence des fichiers, `use client`, absence de `error.message` rendu en clair, présence de `reset`.

**Critère d'acceptation.** Une route qui lève une exception affiche la page de marque, propose un retour, et l'erreur apparaît dans les logs serveur ; le build passe.
**Effort.** ½ session. **Risque.** Faible.

**Correction appliquée (18/11/2026).**
- Nouveaux fichiers : `src/app/global-error.tsx`, `src/app/(site)/error.tsx`, `src/app/admin/(panel)/error.tsx`, `src/app/loading.tsx`, `src/instrumentation.ts`.
- Les erreurs publiques utilisent `LocalizedLink` (la langue est conservée), proposent `reset()`, l'accueil et le contact, et n'affichent que le `digest` — jamais `error.message`.
- L'erreur admin est distincte de l'écran de connexion (« vous êtes toujours connecté »).
- `onRequestError` journalise un JSON d'une ligne : méthode, chemin, route, type, nom/message/digest/pile tronquée. **Aucun en-tête, cookie ou query string** n'est journalisé.
- Test `scripts/error-boundaries.test.mjs` + script `npm run test:resilience`.
- Vérification réelle : une route temporaire qui lève une erreur a produit le log `{"level":"error","source":"next.onRequestError",...,"digest":"4019484202"}` ; le chunk client de la frontière est bien généré et le digest est transmis au payload RSC. Le rendu visuel de la frontière doit être confirmé en preview (le HTML initial est un flux, la frontière s'affiche après hydratation).
- `npm test` → **1033/1033**, `typecheck` 0 erreur, `lint` 0 erreur, `build` OK.

---

### C-04 — Aucune capture d'erreurs runtime · **P1**

**Constat.** `@sentry/nextjs` n'est pas installé. Pourtant, la CSP autorise déjà `https://*.ingest.sentry.io` (`next.config.ts:53`) : la place a été préparée, mais rien n'envoie d'événement. Vercel Analytics et Speed Insights sont bien montés (`src/app/(site)/layout.tsx`) mais ne remontent **aucune erreur** et ne déclenchent **aucune alerte**.

**Correction.**
1. Installer Sentry (offre gratuite ; vérifier le quota mensuel actuel, il suffit largement pour un site de cette taille).
2. Configuration manuelle plutôt que wizard : `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation-client.ts`, `withSentryConfig`.
3. Tunnel `POST /monitoring` (route propre, DSN autorisés uniquement) pour éviter les bloqueurs de publicité et **ne pas élargir la CSP**.
4. Confidentialité : `dataCollection` coupe identité, cookies, en-têtes, corps et query string ; `replaysSessionSampleRate: 0` ; filtre `scrubSentryEvent` en plus.
5. Échantillonnage : `tracesSampleRate: 0.1` (pas 1.0), `profilesSampleRate: 0`.
6. Source maps : `SENTRY_AUTH_TOKEN` côté Vercel (action propriétaire), jamais dans le dépôt.
7. Le DSN doit être **optionnel** : sans `SENTRY_DSN`, le build et le site fonctionnent exactement comme aujourd'hui (même philosophie que le repli base).
8. Règles d'alerte : nouvelle issue, erreur sur `/api/payments/*`, `/api/lead`, `/codes/commande`, taux d'erreur > 2 % sur 5 min → e-mail + Telegram.
9. Ajouter au `README` la procédure de vérification (envoyer une erreur de test depuis une preview).

**Critère d'acceptation.** Une erreur provoquée en preview apparaît dans Sentry avec la pile, le chemin et la version ; aucune donnée personnelle visible ; le build sans DSN passe.
**Effort.** 1 session + création du compte. **Risque.** Moyen (poids client, CSP) → tunnel + échantillonnage faible.

**Correction appliquée (18/11/2026) — code prêt, compte à créer.**
- Ajout de `@sentry/nextjs` **11.14.0** et de quatre points d'entrée : `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `src/instrumentation-client.ts`, `src/app/monitoring/route.ts`.
- `register()` et `onRequestError` n'importent le SDK que si `SENTRY_DSN` existe ; le navigateur ne télécharge le SDK que si `NEXT_PUBLIC_SENTRY_DSN` existe. **Sans DSN : zéro octet, zéro requête, build identique.**
- Confidentialité : Sentry 11 collecte par défaut identité, cookies, en-têtes, corps et query string ; tout est coupé via `dataCollection`, puis `scrubSentryEvent` retire URL de requête, cookies et corps. `traceLifecycle: "static"` rend le filtre des transactions effectif.
- Tunnel : route `POST /monitoring` avec liste blanche de DSN (testé : DSN étranger → **403**, sans DSN → **404**). La CSP n'a pas été élargie.
- `withSentryConfig` n'est activé que si un DSN ou un jeton d'upload existe : sans cela, le build reste nu ; avec DSN factice, le build passe et l'inclusion des fichiers `server-runtime-injection` est correcte (plus d'avertissement au démarrage).
- Tests : 3 cas ajoutés (désactivation sans DSN, absence de PII, tunnel non ouvert) → `npm run test:resilience` = **9/9**.
- **Vérifié en preview le 18/11/2026 :** `dsnConfigured: true`, `clientInitialized: true`, `eventId e0662133f8764750b838ebbf27da298a`, `flushed: true`. L'événement est bien arrivé dans Sentry (projet `MON-SITE-1`, environnement `preview`). Les routes de diagnostic temporaires ont été supprimées.
- **Correctif issu du test :** `onRequestError` appelle désormais `Sentry.flush(2000)` après `captureRequestError`. Sans cela, une fonction Vercel peut être gelée dès la réponse et perdre l'événement resté dans le tampon.

---

### C-05 — Aucune surveillance de disponibilité externe · **P1**

**Constat.** `/api/health` existe et répond `{ ok: true }` en mode public (limité en débit), avec un mode complet protégé. Mais **rien ne l'appelle périodiquement** : `vercel.json` ne contient que 4 crons métier quotidiens. Un site en panne peut donc rester muet, comme lors de l'incident Neon du 29/10.

**Correction.**
1. Moniteur externe toutes les 3–5 min sur `https://nokhba.net.ly/api/health`, avec vérification de mot-clé `"ok":true` (pas seulement le code HTTP).
2. Moniteur secondaire sur `/` (mot-clé `نخبة`) et sur `/codes` (le catalogue est le cœur commercial).
3. Moniteur d'expiration TLS/domaine (30/14/7 jours).
4. Alertes : e-mail + Telegram ; astreinte définie (qui regarde, sous quel délai).
5. Workflow GitHub Actions planifié (toutes les 6 h) : `curl` santé + `npm run seo:check` + Lighthouse mobile sur production, ouverture/mise à jour d'une issue en cas d'échec. Aucun fournisseur supplémentaire nécessaire pour cette partie.
6. Runbook d'incident : symptôme → vérification → décision (rollback Vercel, redéploiement, mode dégradé) → communication client.

**Critère d'acceptation.** Couper la base sur une preview déclenche une alerte < 5 min ; le runbook permet à une personne non développeuse d'appliquer la première étape.
**Effort.** ½ session + compte. **Risque.** Faible.

**Correction partielle appliquée (18/11/2026).**
- Workflow `.github/workflows/surveillance.yml` : toutes les 6 h + lancement manuel ; santé (200 **et** `ok:true`), accueil, `/codes`, TLS (échec < 7 j, alerte < 14 j).
- En cas d'échec : ouverture ou mise à jour d'une issue `surveillance`, avec le rapport complet ; fermeture automatique au rétablissement.
- Règles testées sans réseau (`scripts/uptime-check.test.mjs`, 6 cas) et script utilisable à la main : `SITE_URL=… node scripts/uptime-check.mjs`.
- **Reste à faire (propriétaire) :** compte Better Stack + moniteurs et alertes Telegram (runbook §2). Le workflow GitHub ne remplace pas l'alerte temps réel.

---

### C-06 — `Fix & Optimize` : promesse forte, livrable invisible · **P1**

**Constat.** La page promet un audit 40+ points, des réparations, un rapport avant/après et un suivi de deux semaines. Aucun **exemple de rapport**, aucune **liste des 40 points**, aucune **méthode de gravité**, aucun **SLA** explicite. Le client doit payer sans savoir à quoi ressemble le livrable.

**Correction.**
1. Publier la **liste des 40+ points** par catégorie (disponibilité, performance, mobile, SEO, liens, sécurité, données structurées, accessibilité), avec le poids de chaque catégorie.
2. Publier un **rapport exemple complet** : audit réel d'un site de démonstration (par exemple une démo `public/live-demos/`), anonymisé, daté, avec :
   - captures Lighthouse avant/après ;
   - 5 à 8 problèmes réels, leur gravité, la cause, la correction ;
   - ce qui n'a **pas** été corrigé et pourquoi ;
   - durée et limites.
3. Ajouter un bloc « ce que vous recevez » : rapport HTML/PDF de N pages, appel de restitution de 30 min, suivi 14 jours, conditions de retour arrière.
4. Générer le PDF depuis la page HTML (CSS `@media print`) plutôt que d'ajouter une dépendance.
5. Ajouter un formulaire « auditer mon site » qui enregistre l'URL et l'e-mail dans `leads` avec `source=audit` (réutiliser `/api/lead`, sans nouveau circuit).
6. Toute affirmation chiffrée doit porter une **date et un outil** (« Lighthouse mobile, 18/11/2026 »). Sinon, la retirer.

**Critère d'acceptation.** Un visiteur peut lire un rapport complet avant de commander ; chaque promesse de la page a une preuve ou une limite explicite.
**Effort.** 1–2 sessions (contenu). **Risque.** Faible.

**État au 20/11/2026 — appliqué.**
- `src/lib/audit-checklist.ts` : **46 points** répartis en 8 catégories, poids total 100, textes AR/EN.
- Page **`/audit`** : liste complète, bloc « ce que vous recevez » (rapport
  imprimable, points classés, mesures datées, appel de 30 min + suivi 14 jours),
  **rapport exemple réel** et formulaire.
- Rapport exemple : démo **Tulin Magazin** (notre démo, pas un client),
  Lighthouse 12 mobile, 3 runs, médiane, **20/11/2026**, avant et après en
  production (après déploiement du correctif). Avant : performance 82
  (69–86), accessibilité 96, bonnes pratiques 75, SEO 100. Après : performance
  85 (67–90), accessibilité **100**, bonnes pratiques 75, SEO 100.
  L'écart de performance est dans le bruit : **aucun gain de vitesse n'est
  revendiqué**. Seule l'accessibilité (96 → 100, sur les trois runs) est
  présentée comme un gain.
- Correctifs réels mesurés : `aria-label` sur les commandes icône du lecteur de
  démo (`link-name`) et contraste des libellés à `opacity-50` (`color-contrast`).
- Formulaire : réutilise `/api/lead` (`need=audit`, URL dans `message`), émet
  `audit_request {source:"audit-form"}` ; aucune PII dans l'analytics.
- Liens : appel depuis Fix & Optimize et entrée dans le sitemap.
- **Reproductibilité** : les runners GitHub n'accèdent pas aux previews Vercel ;
  les deux mesures ont donc été faites sur la production, même outil, même
  jour, avec la médiane de 3 runs (issues #234 et #238).

---

### C-07 — Preuves de confiance : passer du témoignage à l'étude de cas · **P1**

**Constat.** Les témoignages et les champs « avant/après » existent (`src/components/sections/testimonials.tsx:108-116`, `src/lib/content.ts:353+`), mais :
- aucune **étude de cas datée** avec mesures ;
- aucune **preuve de consentement** structurée pour les noms et citations ;
- les photos tierces ont été remplacées par des monogrammes (bien), mais les noms restent des personnes réelles sans traçabilité visible.

**Correction.**
1. Créer `/resultats` avec 3 études de cas, format commun : contexte → problème → actions → **mesures avant/après** (outil + date) → captures → durée → citation (avec accord) → limites.
2. Ajouter un champ `consentOnFile: boolean` (admin) aux témoignages ; n'afficher que ceux à `true` (ou anonymiser : « restaurant à Tripoli »).
3. Si un témoignage n'a pas d'accord documenté : l'anonymiser ou le retirer. Un faux témoignage coûte plus cher qu'un témoignage manquant.
4. Ajouter le JSON-LD `Article` + `about` sur les études de cas, les entrées sitemap et `llms.txt`, et un maillage depuis `/demos`, `/services` et l'accueil.
5. Ne jamais publier de note moyenne ni de nombre d'avis non sourcé (la politique actuelle est bonne : la conserver).

**Critère d'acceptation.** Trois études de cas publiées, chacune avec au moins une mesure avant/après et une preuve de consentement ou une anonymisation assumée.
**Effort.** 1–2 sessions + accords clients. **Risque.** Juridique/réputationnel si les accords manquent → traiter avant publication.

---

### C-08 — Accueil : deux activités, six entrées concurrentes · **P1**

**Constat.** Le code contient déjà un `HomeGateway` à **3 cartes** (sites, cartes cadeaux, recharges), puis un panneau « pour votre activité » avec **4 liens**, puis une section boutique avec **catégories**, puis une FAQ. La séparation demandée existe, mais le visiteur doit choisir parmi trop de portes avant de comprendre l'offre.

**Correction.**
1. Regrouper visuellement les 3 cartes en **2 familles** :
   - « Créer mon site » (1 carte) ;
   - « Acheter un produit numérique » (2 cartes : cartes cadeaux, recharges), sous un même titre de famille.
2. Supprimer ou fusionner le panneau « pour votre activité » en une seule bande courte sous le gateway (il duplique les mêmes liens).
3. Une seule action principale par famille, avec un accent de couleur distinct ; réduire les CTA concurrents au-dessus de la ligne de flottaison.
4. Ajouter un repère « Vous êtes… » (commerçant / acheteur de codes / développeur) seulement s'il est mesuré — sinon, ne pas ajouter de complexité.
5. Instrumenter les clics (C-09) **avant** de changer la mise en page, afin de comparer avant/après.
6. Mettre à jour intentionnellement `home-clarity`, `site-hierarchy` et `navigation-comfort` (ne pas désactiver les tests).

**Critère d'acceptation.** Un visiteur comprend en moins de 5 secondes qu'il y a deux activités ; le taux de clic du parcours principal est mesuré avant/après.
**Effort.** 1 session + mesure. **Risque.** Conversion : ne pas changer sans mesure.

---

### C-09 — Aucune mesure du funnel · **P1**

**Constat.** Vercel Analytics est installé, mais aucun événement personnalisé n'est émis. Impossible de savoir si le gateway fonctionne, quel service est consulté, ou où le visiteur abandonne.

**Correction.**
1. Créer `src/lib/analytics.ts` : enveloppe `track()` de `@vercel/analytics`, typée, sans PII.
2. Événements : `gateway_click {path}`, `service_view {id}`, `whatsapp_click {source}`, `lead_submit {source}`, `checkout_start {kind}`, `audit_request {source}`.
3. Ne jamais envoyer d'e-mail, téléphone, nom ou référence de commande.
4. Revue hebdomadaire : 5 minutes, trois chiffres (visites, clics parcours, demandes).

**Critère d'acceptation.** Les événements apparaissent dans Vercel Analytics en preview ; aucune donnée personnelle dans les propriétés.
**Effort.** ½ session. **Risque.** Faible.

**État au 18/11/2026 — appliqué.** `src/lib/analytics.ts` (liste blanche
`path`/`id`/`source`/`kind`, 64 caractères, silencieux en cas d'échec) ;
6 événements branchés (`gateway_click`, `service_view`, `whatsapp_click` avec
8 sources distinctes, `lead_submit`, `checkout_start` site et digital,
`audit_request` déclaré pour C-06). Tests `scripts/analytics.test.mjs`.
Mode d'emploi et routine : **`docs/mesure-funnel.md`** ; tableau de suivi :
`docs/suivi-mesure.md`.

**Correctif du 19/11/2026.** `track()` de Vercel perd silencieusement un
événement si `window.va` n'existe pas encore. Or `<Analytics />` installe
`window.va` dans un effet exécuté **après** ceux des pages : `service_view` et
`checkout_start` (événements de montage) étaient donc jetés au chargement
direct. `trackEvent` remplit désormais la file officielle `vaq`, rejouée par le
script Vercel. Test de comportement : `scripts/analytics-runtime.test.mjs`
(navigateur simulé, Node exécute le TypeScript directement).

---

### C-10 — CI : dépendances non auditées, Lighthouse partiel · **P1**

**Constat.**
- `npm audit` n'est pas dans la CI.
- Lighthouse ne teste que `/`, `/demos`, `/pricing`, `/contact` ; la performance est en `warn` à 0,75 ; `/services`, `/services/fix-optimize`, `/codes` et une fiche produit ne sont pas couverts.
- Aucun contrôle de liens externes.

**Correction.**
1. Ajouter `npm audit --omit=dev --audit-level=high`.
2. Étendre Lighthouse à `/services`, `/services/fix-optimize`, `/codes`, une fiche produit, en preset mobile.
3. Passer la performance en `error` à 0,85 sur mobile (après mesure de la base réelle, sinon seuil irréaliste).
4. Script hebdomadaire `scripts/link-check.mjs` : liens internes du sitemap + 5 liens externes par page, alerte sur 404/410/5xx, issue GitHub.
5. Conserver les assertions SEO/bonnes pratiques à 0,90.

**Critère d'acceptation.** Une régression de performance ou un lien cassé produit une issue, pas un silence.
**Effort.** 1 session. **Risque.** Faible (seuils à calibrer).

**État au 18/11/2026 — appliqué, sauf le seuil de performance.**
- Audit des dépendances : déjà dans `ci.yml` via `scripts/audit-prod.mjs`
  (high/critical, exception expirante `picomatch` au 31/01/2027).
- Lighthouse : 8 URL (ajout de `/services`, `/services/fix-optimize`,
  `/codes`, `/codes/steam-card`), délai du job porté à 25 min.
- **La performance reste en `warn` à 0,75** : passer en `error` à 0,85 sans
  mesure de la base réelle produirait un rouge permanent. À relever après deux
  semaines de runs verts, sur mobile.
- Liens : `scripts/link-checks` (règles pures + tests) et
  `scripts/link-check.mjs` (sitemap ≤ 40 pages, ≤ 80 liens internes, ≤ 60 liens
  externes dont 5 par page ; 404/410/5xx = échec, 401/403/429 = avertissement).
  Workflow `.github/workflows/liens.yml` : lundi 05:23 UTC, issue label `liens`
  ouverte/mise à jour, fermée au rétablissement.

---

### C-11 — Performance : tout est rendu à la demande · **P2**

**Constat.** Le build marque **toutes** les routes publiques en `ƒ (Dynamic)`, conséquence de la locale lue depuis les en-têtes. Les données sont mises en cache (bien), mais le HTML est reconstruit à chaque requête : le TTFB dépend d'une instance froide et de Neon. L'incident de quota Neon du 29/10 montre que ce couplage est un risque réel.

**Correction (après mesure).**
1. Relever les p75 LCP/INP/TTFB dans Speed Insights sur 7 jours (mobile, production).
2. Pour les pages **éditoriales** (services, blog, pages légales, comparatifs), envisager une coquille statique + locale côté client via `?lang`, ou un `Cache-Control: s-maxage=300, stale-while-revalidate=86400` devant la fonction.
3. Garder `/codes`, fiches produit et paiement en dynamique (le stock doit rester frais).
4. Budget images : 200 Ko max par visuel, WebP/AVIF, `sizes` explicites ; les 132 images locales pèsent 7,7 Mo, les jaquettes ~100 Ko chacune — acceptable, mais à surveiller.
5. Ne pas passer au statique avant d'avoir mesuré : l'incident de pré-rendu du catalogue est documenté dans `docs/performance-rendu-cache.md`.

**Critère d'acceptation.** TTFB p75 < 800 ms sur mobile ; aucune page commerciale ne dépend d'un rendu statique figé.
**Effort.** 2–3 sessions. **Risque.** Moyen (cache, fraîcheur des prix).

---

### C-12 — CSP : `'unsafe-inline'` sur les scripts · **P2**

**Constat.** `script-src` autorise `'unsafe-inline'` (et `'unsafe-eval'` en dev). C'est documenté et nécessaire au runtime Next/Framer Motion sans nonce. La CSP reste globalement solide, mais cette exception affaiblit la protection XSS.

**Correction.**
1. Ne pas élargir la CSP pour Sentry : utiliser `tunnelRoute`.
2. Tester `Content-Security-Policy-Report-Only` avec un nonce généré dans `src/proxy.ts` (toutes les pages sont déjà dynamiques, donc le coût est nul).
3. Migrer vers `script-src 'nonce-…' 'strict-dynamic'` après validation, puis retirer `'unsafe-inline'`.
4. Garder `scripts/security-headers.test.mjs` comme garde-fou.

**Effort.** 2–3 sessions. **Risque.** Élevé (hydratation) → report-only d'abord, rollback immédiat possible.

---

### C-13 — Sauvegardes : existence non prouvée · **P2**

**Constat.** Aucun exercice de restauration n'est documenté. Neon fournit une restauration à un instant donné selon le plan, mais une sauvegarde non testée n'est pas une sauvegarde.

**Correction.**
1. Vérifier le plan Neon et la fenêtre de restauration (RPO/RTO).
2. Export mensuel chiffré hors Neon (stockage objet), avec durée de conservation.
3. Exercice trimestriel : restaurer dans une branche Neon, vérifier `settings`, `orders`, `leads`, puis supprimer la branche.
4. Documenter la procédure dans `docs/runbook-surveillance.md`.

**Critère d'acceptation.** Une restauration réelle a été exécutée et chronométrée ; la procédure tient sur une page.
**Effort.** 2 h + action propriétaire. **Risque.** Faible.

**État au 20/11/2026 — partiel.**
- `scripts/backup-leads.mjs` et `scripts/restore-leads.mjs` : export JSON de la
  table `leads`, validation du fichier (version, compte, doublons, colonnes
  obligatoires), restauration en simulation par défaut, insertion des seules
  lignes absentes, transaction et réavancée de la séquence `id`.
- `scripts/lib/leads-backup.mjs` + 5 tests unitaires (aucune base requise).
- `.github/workflows/sauvegardes.yml` : aller-retour réel sur un PostgreSQL 16
  à chaque PR et sur `main` — table vidée puis restaurée, identifiants et
  séquence vérifiés.
- `docs/runbook-sauvegardes.md` : procédure, limites, exercice trimestriel.
- **Constat du 26/11/2026** : le projet Supabase (`g2g-test`, plan Free)
  affiche **« No backups »**. Il n'y a donc aucune sauvegarde fournisseur à
  espérer, ni rétention ni PITR.
- `scripts/backup-db.mjs` / `restore-db.mjs` : dump **complet** (schéma +
  données) via `pg_dump`, compressé, restauration en simulation par défaut ;
  second job CI (« base-complete ») qui supprime une table puis la restaure.
- **Reste à faire (propriétaire)** : planifier `backup:db` (cron ou tâche
  locale) et déposer les dumps chiffrés hors site. Aujourd'hui la perte
  maximale reste celle du dernier export manuel.

---

### C-14 — Nokhba AI Doctor · **P3 (spécification en §7)**

Le produit est faisable avec la pile existante. Il ne doit **pas** être construit avant les lots 1 et 2 : un scanner qui vend de la fiabilité doit lui-même être surveillé. Spécification complète en §7.

### C-15 — Page de statut publique · **P3**

Une page `/statut` alimentée par le moniteur externe (ou par `/api/health`) rassure les clients pendant un incident. À ne publier que si elle est maintenue : une page de statut périmée fait plus de mal que pas de page. Effort : ½ session, après C-05.

### C-16 — Offre de surveillance mensuelle · **P3**

Transformer la surveillance en abonnement (site + uptime + rapport mensuel). À construire seulement après 20 audits AI Doctor réels, avec un SLA écrit et un coût par client connu. Ce n'est pas un sujet de code au départ : c'est un contrat, un périmètre et une astreinte.

---

## 5. Plan par lots

### Lot 0 — Décisions (30 min, aujourd'hui)

| ID | Décision | Recommandation |
|---|---|---|
| D1 | Prix de départ `Fix & Optimize` | ✅ **90 USDT** (confirmé le 18/11/2026). Un seul chiffre, partout. |
| D2 | Moniteur de disponibilité | ✅ **Better Stack** (choisi le 18/11/2026) : 3 min, page de statut, Telegram. UptimeRobot reste la solution de repli. |
| D3 | Nokhba AI Doctor | D'abord **aimant à prospects** (scan gratuit, réparation payante), pas un produit autonome. |
| D4 | Témoignages sans accord écrit | **Anonymiser** ou retirer avant publication. |

Livrable : les quatre réponses consignées en tête de ce document.

---

### Lot 1 — Intégrité commerciale et robustesse (1–2 sessions)

**Tâches :** C-01 ✅, C-02 ✅, C-03 ✅ — lot terminé le 18/11/2026.

**Ordre :**
1. C-01 (prix) — fait.
2. C-02 (patchs) — fait.
3. C-03 (erreurs) — fait.

**Validation :**
```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```
Attendu : 0 erreur de type, 0 vulnérabilité, tests verts, build OK.

**Rollback :** `git revert` du lot, ou « Instant Rollback » Vercel vers le déploiement précédent.

---

### Lot 2 — Voir les pannes (1 session + comptes)

**Tâches :** C-04 ✅ (code), C-05, runbook ✅.

**Actions propriétaire :** créer le projet Sentry et copier `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` dans Vercel ; créer `SENTRY_AUTH_TOKEN` ; créer les moniteurs Better Stack et les alertes Telegram.

**Exercices de validation :**
- preview avec `SENTRY_DSN` absent → build OK ;
- erreur volontaire en preview → visible dans Sentry en < 2 min ;
- base coupée sur preview → alerte de disponibilité en < 5 min ;
- alerte Telegram reçue et acquittée.

**Rollback :** retirer `SENTRY_DSN` suffit à revenir à l'état actuel.

---

### Lot 3 — Prouver et convertir (3–5 sessions)

**Tâches :** C-06, C-07, C-08, C-09, C-10.

**Ordre imposé :**
1. C-09 (mesurer) ;
2. C-06 + C-07 (prouver) ;
3. C-08 (simplifier l'accueil, avec avant/après mesuré) ;
4. C-10 (verrouiller en CI).

**Validation :** 3 études de cas en ligne, rapport exemple accessible, événements visibles, CI rouge sur lien cassé.

---

### Lot 4 — Nokhba AI Doctor (2 semaines, après validation)

Voir §7. MVP en deux semaines, sans promesse d'auto-réparation.

---

## 6. Architecture de surveillance — les trois niveaux

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DÉTECTION (automatique, sans IA)                         │
│  • Externe : uptime 3–5 min, TLS, mot-clé santé             │
│  • Navigateur : Sentry (erreurs JS) + Speed Insights (CWV)  │
│  • Serveur : onRequestError → Sentry + logs Vercel          │
│  • SEO : Search Console, Lighthouse planifié, liens         │
│  • Métier : commandes, leads, livraisons, solde fournisseur │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. ANALYSE & PROPOSITION (IA, lecture seule)                │
│  • Regroupe les erreurs par cause probable                  │
│  • Cite les fichiers concernés                              │
│  • Propose un diff + un test de vérification                │
│  • Ouvre une issue ou une PR **brouillon**, jamais un push  │
│    direct sur main                                          │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. EXÉCUTION CONTRÔLÉE (humain)                             │
│  • Revue du diff par le propriétaire                        │
│  • CI obligatoire (lint, types, 1022 tests, build, SEO)     │
│  • Preview Vercel testée                                    │
│  • Fusion manuelle                                          │
│  • Rollback : revert ou Instant Rollback                    │
└─────────────────────────────────────────────────────────────┘
```

### Qui décide quoi

| Action | Automatique | Humain | Garde-fou technique |
|---|---|---|---|
| Détecter une panne / un 404 | ✅ | — | uptime + Sentry |
| Analyser une pile d'erreurs | ✅ | — | IA en lecture seule |
| Proposer un correctif | ✅ | — | PR brouillon + diff |
| Approuver un changement de code | — | ✅ | revue + CI |
| Publier sur `nokhba.net.ly` | — | ✅ | fusion manuelle |
| Supprimer une donnée / une table | — | ✅ | aucune permission IA en écriture |
| Modifier les paiements / les clés | — | ✅ | secrets hors dépôt, jamais dans un prompt |
| Modifier les réglages de sécurité | — | ✅ | revue + test d'en-têtes |
| Déployer chez un client | — | ✅ | accord écrit + preview |
| Revenir à la version précédente | ✅ (règle) | ✅ (décision) | health check post-déploiement |

**Règles à activer côté GitHub :** protéger `main` (PR obligatoire, checks `quality` et `seo-audit` requis), interdire le force-push, limiter les permissions du `GITHUB_TOKEN` à `contents: read` pour la CI, ne jamais exposer un secret dans une conversation ou un prompt.

---

## 7. Nokhba AI Doctor — spécification MVP

### 7.1 Proposition de valeur

> « Collez l'adresse de votre site. En 60 secondes, recevez un diagnostic clair : disponibilité, vitesse, SEO, liens, sécurité. Un rapport priorisé, avec les corrections proposées, prêt à être validé. »

Modèle : **scan gratuit** (aimant à prospects) → **rapport complet** → **réparation payante** (`Fix & Optimize`). Le diagnostic ne remplace pas la réparation ; il la déclenche.

### 7.2 Parcours

1. `/audit` : champ URL + e-mail + case « je suis autorisé à scanner ce site ».
2. `POST /api/audit` : validation, limitation de débit, insertion `audits(status=queued)`.
3. Worker (cron Vercel toutes les minutes) : 1 à 3 audits par passage.
4. Page `/audit/[token]` : progression, puis rapport ; `noindex`, expiration 30 jours.
5. CTA « faire corriger » → `/api/lead` avec `source=audit-doctor`.

### 7.3 Contrôles du MVP (sans navigateur)

| Catégorie | Poids | Mesures |
|---|---|---|
| Disponibilité | 20 | HTTP, redirections, TLS, temps de réponse |
| Performance | 30 | PageSpeed Insights API (mobile en priorité), LCP/CLS/INP, poids des ressources |
| SEO | 25 | title, description, H1, canonical, robots, sitemap, données structurées, `lang` |
| Liens | 15 | 30 liens échantillonnés (internes + externes), codes 4xx/5xx |
| Sécurité visible | 10 | HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, cookies `Secure`/`HttpOnly`, contenu mixte |

Le score est **explicable** : chaque point est rattaché à une mesure, et le rapport affiche la méthode. Aucun score opaque, aucun classement Google promis.

### 7.4 Architecture technique

```
/audit (form) → POST /api/audit → table audits (queued)
                                      │
                     cron 1 min ──────┘
                          │
                 worker (concurrence 1–3)
                   ├─ fetch HTML/headers/robots/sitemap  (garde SSRF)
                   ├─ PageSpeed Insights API (1 appel)
                   ├─ échantillon de 30 liens (HEAD puis GET)
                   ├─ contrôles sécurité visibles
                   └─ score + problèmes structurés (JSON)
                                      │
                   LLM (optionnel, 2 000 jetons max)
                   → résumé, priorisation, corrections proposées
                                      │
                         /audit/[token] (noindex, 30 j)
                                      │
                              CTA → /api/lead
```

Réutilisation : `src/lib/services.ts` (offres), `src/lib/seo-audit.ts` (contrôles internes), `src/lib/ai/*` (fournisseurs), `src/lib/rate-limit.ts`, `src/app/api/lead`.

**Contraintes de plateforme à trancher avant de coder :**
- Sur Vercel **Hobby**, les crons sont limités à une exécution par jour : un worker « toutes les minutes » n'est pas possible. Trois options : plan Pro, déclencheur externe (QStash/Upstash Scheduler, gratuit à faible volume), ou traitement quasi synchrone avec `waitUntil` de `@vercel/functions` (durée max de la fonction : 60 s en Hobby, 300 s en Pro).
- PageSpeed Insights : une clé API est fortement recommandée (quota plus élevé) ; sans clé, les appels sont limités et peuvent échouer en rafale. Prévoir un cache par domaine (1 audit/24 h).
- Le worker doit être **idempotent** : un audit `running` repris après timeout ne doit pas créer de doublon ni facturer deux fois un appel PSI.

### 7.5 Sécurité — non négociable pour un scanner public

1. **Anti-SSRF :** schémas `http`/`https` uniquement, ports 80/443, résolution DNS puis refus des adresses privées, loopback, link-local et `169.254.169.254`, revérifiée avant chaque connexion et à chaque redirection (max 3) ; pas d'identifiants dans l'URL.
2. **Limites :** timeout 10 s, réponse 2 Mo max, 30 liens max, 1 domaine par audit.
3. **Anti-abus :** 3 scans/jour/IP, e-mail obligatoire après le premier scan, CAPTCHA si anomalie, vérification de propriété (balise meta ou TXT) pour un scan profond.
4. **Éthique :** `robots.txt` respecté pour l'exploration des liens, aucun test intrusif (pas de fuzzing, pas d'injection, pas de force brute), User-Agent identifiable.
5. **Données :** rapport privé par jeton non devinable, expiration 30 jours, suppression sur demande, aucune donnée client dans les prompts LLM.
6. **Coût :** quota PageSpeed, plafond de jetons par rapport, kill-switch (`AUDIT_DOCTOR_ENABLED=false`), budget mensuel surveillé.

### 7.6 Découpage en deux semaines

| Période | Livrable | Critère |
|---|---|---|
| Jours 1–4 | Formulaire, file d'attente, fetch + contrôles, score, page rapport (sans IA) | 3 sites de démo audités, score reproductible ±5 |
| Jours 5–8 | PageSpeed, liens, sécurité, stockage, expiration | p95 < 90 s par audit |
| Jours 9–12 | Résumé IA, problèmes priorisés, PDF, CTA lead | Aucune hallucination de mesure : chaque phrase cite une donnée |
| Jours 13–14 | Limitation d'abus, tests, runbook, mise en ligne | 0 SSRF, 0 fuite de données, coût maîtrisé |

**Hors MVP :** connexion au dépôt du client, PR automatique, surveillance récurrente payante. À vendre seulement après 20 audits réels.

---

## 8. Backlog priorisé

| ID | Correction | Priorité | Effort | Dépend de | Propriétaire |
|---|---|---|---|---|---|
| C-01 | Prix : source unique + test | P0 | 0,5–1 j | D1 | Agent |
| C-02 | Patchs `next` / `nodemailer` + audit CI | P0 | 0,5 j | — | Agent |
| C-03 | `error.tsx`, `global-error.tsx`, instrumentation | P0 | 0,5 j | — | Agent |
| C-04 | Sentry (tunnel, PII, alertes) | P1 | 1 j | Compte Sentry | Agent + propriétaire |
| C-05 | Uptime + TLS + workflow planifié + runbook | P1 | 0,5 j | Compte moniteur | Agent + propriétaire |
| C-06 | Liste 40 points + rapport exemple + PDF | P1 | 1–2 j | C-01 | Agent |
| C-07 | `/resultats` + consentement témoignages | P1 | 1–2 j | Accords clients | Agent + propriétaire |
| C-08 | Accueil : 2 familles, moins d'entrées | P1 | 1 j | C-09 | Agent |
| C-09 | Événements analytics | P1 | 0,5 j | — | Agent |
| C-10 | CI : audit + Lighthouse étendu + liens | P1 | 1 j | — | Agent |
| C-11 | Performance : mesure puis cache éditorial | P2 | 2–3 j | Données réelles | Agent |
| C-12 | CSP : report-only puis nonce | P2 | 2–3 j | C-04 | Agent |
| C-13 | Sauvegarde / restauration testée | P2 | 2 h | Plan Neon | Propriétaire |
| C-14 | AI Doctor MVP | P3 | 2 sem. | Lots 1–2 | Agent |
| C-15 | Page de statut publique | P3 | 0,5 j | C-05 | Agent |
| C-16 | Offre de surveillance mensuelle | P3 | 1 j | C-14 | Propriétaire |

---

## 9. Prompts prêts à l'emploi

### Prompt 1 — Corriger l'incohérence de prix (C-01)

```text
Mission : supprimer la double source de vérité des prix des services.

Contexte : /services/fix-optimize affiche le prix de config.standaloneServices
(dynamique) dans la carte et le JSON-LD, mais le texte éditorial, le hub,
i18n, les comparatifs, le blog et llms.txt contiennent encore « 15 $ ».

Contraintes :
- Ne modifie aucun calcul de commande, de paiement ou de panier.
- Ne change pas la valeur du prix dans /admin : elle est décidée par le propriétaire.
- Le prix doit venir d'une seule fonction réutilisable.

Travail :
1. Crée src/lib/service-pricing.ts (serviceStartingPrice, formatStartingPrice,
   fillPriceTokens).
2. Dans src/lib/services.ts, remplace les montants du service par le jeton {price}
   et résous-le dans resolveServiceLanding.
3. Corrige src/components/services-hub-view.tsx:114 et src/lib/i18n.tsx:113,115
   pour utiliser le prix dynamique.
4. Retire les montants figés des comparatifs, du blog et de llms.txt, ou rends-les
   dynamiques ; renvoie vers /services pour le tarif courant.
5. Ajoute scripts/service-price-consistency.test.mjs : avec priceFromUsd = 90,
   aucun « 15 » ne doit rester dans la page, la description, la réponse et le JSON-LD.
6. Le test doit aussi couvrir un second service cité dans le texte (add-section)
   pour vérifier que le jeton {price:add-section} suit bien la configuration.

Validation : npm run lint && npm run typecheck && npm test && npm run build.
Livrable : une PR unique, avec le diff avant/après du prix et le test ajouté.
```

### Prompt 2 — Frontières d'erreur (C-03)

```text
Mission : rendre les erreurs visibles et récupérables.

Ajoute :
- src/app/global-error.tsx (client, HTML autonome, bilingue, bouton recharger) ;
- src/app/(site)/error.tsx (client, identité du site, reset(), liens /, /contact,
  WhatsApp, affichage du digest uniquement) ;
- src/app/admin/(panel)/error.tsx (distinct de la déconnexion) ;
- src/app/loading.tsx (squelette discret) ;
- src/instrumentation.ts avec onRequestError (journalisation structurée).

Interdits : exposer error.message en production, ajouter une dépendance,
modifier les pages métier. Ajoute un test scripts/error-boundaries.test.mjs.
Validation : une route de test qui lève une erreur affiche la page de marque,
et l'erreur apparaît dans les logs serveur.
```

### Prompt 3 — Observabilité (C-04 + C-05)

```text
Mission : voir les pannes avant les clients, sans élargir la CSP.

Partie code :
1. Installe @sentry/nextjs et configure server/edge/client + withSentryConfig.
2. tunnelRoute: "/monitoring" ; sendDefaultPii: false ; tracesSampleRate: 0.1 ;
   replays désactivés ; beforeSend masque e-mails, téléphones, références.
3. Le DSN est optionnel : sans SENTRY_DSN, build et site identiques à aujourd'hui.
4. Ajoute une route de test d'erreur réservée aux previews (jamais en production).
5. Ajoute un workflow GitHub planifié (6 h) : curl /api/health + Lighthouse mobile
   sur /, /services/fix-optimize, /codes ; ouvre une issue si échec.
6. Fusionne les modifications de src/instrumentation.ts avec celles du prompt 2,
   sans écraser onRequestError.

Partie propriétaire (à documenter, pas à coder) :
- créer le projet Sentry, SENTRY_DSN, SENTRY_AUTH_TOKEN dans Vercel ;
- créer le moniteur externe sur /api/health avec mot-clé "ok":true ;
- brancher les alertes e-mail + Telegram.

Validation : erreur visible dans Sentry en < 2 min ; build sans DSN OK ;
alerte de disponibilité en < 5 min sur une preview avec base coupée.
```

### Prompt 4 — Preuves commerciales (C-06 + C-07)

```text
Mission : rendre l'offre Fix & Optimize vérifiable avant l'achat.

1. Publie la liste des 40+ points d'audit par catégorie, avec le poids de chaque
   catégorie et la méthode de gravité.
2. Crée un rapport exemple complet à partir d'un site de démonstration du dépôt,
   anonymisé et daté : Lighthouse avant/après, 5 à 8 problèmes réels, cause,
   correction, ce qui n'a pas été corrigé, limites.
3. Ajoute un export PDF par CSS print, sans nouvelle dépendance.
4. Crée /resultats avec 3 études de cas au format : contexte, problème, actions,
   mesures avant/après (outil + date), captures, citation autorisée, limites.
5. Ajoute un champ de consentement aux témoignages ; n'affiche que les consentis,
   anonymise les autres.
6. Ajoute JSON-LD, sitemap, llms.txt et maillage interne.

Contrainte absolue : aucune mesure inventée. Si une donnée manque, écris « non
mesuré » plutôt qu'un chiffre.
```

### Prompt 5 — Nokhba AI Doctor, étape 1

```text
Mission : construire le MVP de Nokhba AI Doctor, sans IA au départ.

Périmètre :
- /audit : formulaire URL + e-mail + case d'autorisation ;
- POST /api/audit : validation, rate-limit 3/jour/IP, insertion dans une table
  audits (queued), retour d'un jeton ;
- worker cron : fetch HTML/headers/robots/sitemap, contrôles SEO et sécurité
  visibles, 30 liens échantillonnés, score pondéré explicable ;
- /audit/[token] : progression puis rapport priorisé, noindex, expiration 30 j ;
- CTA vers /api/lead avec source=audit-doctor.

Sécurité obligatoire : refus des schémas non http(s), ports 80/443, adresses
privées/loopback/link-local, redirections max 3 revérifiées, timeout 10 s,
réponse 2 Mo max, User-Agent identifiable, respect de robots.txt.

Interdits : scan intrusif, écriture dans le site audité, stockage de données
personnelles inutiles, appel LLM avant que les mesures soient stockées.

Validation : 3 démos auditées, score reproductible ±5, p95 < 90 s, 0 SSRF sur
une batterie de 10 URL pièges (localhost, 127.0.0.1, 169.254.169.254, file://).
```

---

## 10. Vérifications et commandes

| Commande | Ce qu'elle prouve | Ce qu'elle ne prouve pas |
|---|---|---|
| `npm run lint` | conventions, 1 avertissement connu | qualité fonctionnelle |
| `npm run typecheck` | cohérence des types | comportement runtime |
| `npm test` | 1022 tests métier et garde-fous | UX réelle, données de production |
| `npm run build` | build de production, 78 routes | performance réelle sur Vercel |
| `npm audit --omit=dev` | vulnérabilités connues | failles non publiées |
| `node --test scripts/service-price-consistency.test.mjs` | prix unique, pas de jeton, pas de 15 figé | rendu visuel réel |
| `npm run test:resilience` | frontières d'erreur, instrumentation, absence de fuite | rendu visuel après hydratation |
| `npm run seo:check` | balises, JSON-LD, sitemap (après `next start`) | classement Google |
| `npm run audit:catalog` | cohérence du catalogue | disponibilité fournisseur en production |
| Lighthouse CI | SEO, bonnes pratiques, accessibilité, performance locale | données terrain (RUM) |

Après chaque lot : build + tests + preview Vercel + `/api/health`.

---

## 11. Limites de cet audit

1. **Pas d'accès** à la base de production, aux logs Vercel, à Search Console ni aux analytics : la valeur réelle du prix (90 ou 15) doit être confirmée dans `/admin → Réglages`.
2. **Pas de mesure terrain** : les Core Web Vitals réels ne peuvent être jugés que depuis Speed Insights sur 7 jours.
3. **Pas de scan du site live** depuis cet environnement : les constats live de l'analyse initiale sont cohérents avec le code, mais non re-mesurés ici.
4. **Provenance des témoignages** non vérifiable depuis le dépôt : elle relève d'une décision et d'un accord client.
5. **La performance** ne doit pas être optimisée à l'aveugle : le passage au statique a déjà causé un incident documenté.
6. **Sentry** ajoute du poids côté client : tunnel, échantillonnage faible et désactivation des replays au départ.

---

## 12. Décisions demandées

1. **Prix de départ de `Fix & Optimize`** : ✅ **90 USDT** (réponse du 18/11/2026).
   → Appliqué : tarif de repli à 90, textes dérivés du prix vivant, test de non-régression.
2. **Moniteur de disponibilité** : Better Stack ou UptimeRobot ?
   → Recommandation : Better Stack si une page de statut et Telegram sont souhaités, sinon UptimeRobot.
3. **Nokhba AI Doctor** : outil interne, aimant à prospects, ou service payant ?
   → Recommandation : aimant à prospects d'abord (scan gratuit), réparation payante ensuite.

Après réponse, l'ordre d'exécution est : **Lot 1** (prix, dépendances, erreurs) → **Lot 2** (Sentry, uptime, runbook) → **Lot 3** (preuves, accueil, mesure) → **Lot 4** (AI Doctor).

---

*Document préparé le 18/11/2026. C-01, C-02 et C-03 appliqués le même jour ; C-04 écrit et testé, en attente du DSN ; C-05 reste à lancer (compte Better Stack). Les constats sont reproductibles avec les commandes du §10.*
