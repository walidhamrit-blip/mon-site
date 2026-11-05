# Être bien noté sur Trustpilot & Scamadviser — plan d'action

> Concerne `nokhba.net.ly` (نخبة) : agence de création de sites **et** boutique de
> codes digitaux (gift cards, top-ups, cartes téléphoniques) à Tripoli, avec une
> clientèle partiellement internationale.
>
> Deux plateformes, deux logiques radicalement différentes :
> **Trustpilot note des clients**, **Scamadviser note un site**.

---

## 1. Ce que chaque plateforme mesure vraiment

### Trustpilot — la note des clients

- Note affichée = **TrustScore** (0–5), pas une moyenne simple : moyenne
  **bayésienne** (peu d'avis ⇒ la note est tirée vers ~3,5), **pondérée par la
  récence** (les avis anciens pèsent de moins en moins) et par la légitimité
  (avis détectés comme frauduleux = écartés avant calcul).
- Conséquences pratiques :
  - **Le volume compte moins que la régularité.** 20 avis étalés sur 6 mois
    battent 20 avis obtenus la même semaine puis plus rien.
  - Un profil neuf avec « 5,0 / 3 avis » s'affichera autour de 3,8–4,0.
    Il faut typiquement **10 à 15 avis ≥ 4,5** pour franchir 4,0.
  - Une période de silence fait **redescendre** la note vers la moyenne.
- Deux types d'avis : **invités** (étiquette « Vérifié », envoyés via les outils
  Trustpilot) et **organiques** (n'importe qui peut en déposer). Les deux
  comptent, les invités sont plus crédibles pour l'acheteur.

### Scamadviser — la note du site (algorithme)

- Trust score **1–100**, calculé automatiquement à partir de **40+ sources de
  données** (Scamadviser appartient à Gogolook depuis fin 2024).
- Bandes publiées : **1–20** très probablement dangereux · **21–40** probablement
  dangereux · **41–60** prudence · **61–80** probablement sûr · **81–100** très
  probablement sûr.
- Signaux pris en compte : **âge du domaine**, transparence du **WHOIS**,
  réputation de l'hébergement / IP, **SSL**, **coordonnées vérifiables**
  (adresse, téléphone, e-mail), cohérence entre le pays annoncé et le TLD,
  trafic, **avis sur Scamadviser**, **avis sur des plateformes tierces
  (dont Trustpilot)**, ancienneté et activité des réseaux sociaux, blacklists
  (APWG, GASA), moyens de paiement traçables.
- Le score est **dynamique** : il bouge tout seul quand les signaux s'améliorent
  (souvent en quelques jours), sans intervention humaine.
- **La vérification d'entreprise est gratuite** (revendication du profil +
  dossier envoyé à `report@scamadviser.com`). Scamadviser indique explicitement
  que **quiconque propose de changer un Trust Score contre paiement est un
  escroc**.
- ⚠️ Pour une boutique de codes digitaux, ce score est **stratégique** : c'est
  exactement la catégorie de sites que les acheteurs européens vérifient avant
  de payer, et que l'algorithme soupçonne par défaut.

**Lien entre les deux :** un profil Trustpilot peuplé d'avis réels est un signal
positif *pour* Scamadviser. C'est le même travail qui paie deux fois.

---

## 2. Ce qu'il ne faut jamais faire

| Interdit | Pourquoi c'est un piège |
|---|---|
| Acheter des avis (Fiverr, fermes à avis) | Trustpilot les détecte (IP, appareils, historique) et **écarte les avis** ; un pic de 5 étoiles sur un domaine jeune est aussi un signal **négatif** chez Scamadviser. |
| Ne solliciter que les clients contents | Interdit par les règles Trustpilot (sélection des avis). Sollicitez **tous** les clients livrés. |
| Offrir une remise / un code en échange d'un avis | Interdit. Vous pouvez remercier, jamais récompenser l'avis. |
| Payer pour « améliorer » son score Scamadviser | Arnaque signalée par Scamadviser lui-même. |
| Payer un abonnement en croyant acheter la note | Aucune plateforme ne vend la note. L'abonnement achète des **invitations** et des **widgets**, pas des étoiles. |
| Afficher sur le site une note moyenne non sourcée | Vous avez déjà la bonne règle dans le code (voir §6). Google ignore de toute façon les `aggregateRating` auto-déclarés par une entreprise sur sa propre page ; pire, un balisage non conforme expose à une action manuelle. |

---

## 3. Trustpilot — la marche à suivre

**Le plan gratuit suffit pour démarrer** : profil revendiqué, note, réponses aux
avis, **1 widget**, **~50 invitations/mois**. Les offres payantes (à partir de
~100 $/mois, engagement annuel) ajoutent du volume d'invitations, des widgets
personnalisables et l'intégration **Google Seller Ratings** (les étoiles dans les
annonces Google) — à envisager **seulement** quand vous aurez un flux régulier
d'avis.

1. **Revendiquer le profil** `trustpilot.com/review/nokhba.net.ly` (le profil
   peut déjà exister sans vous). Renseigner : nom exact, logo, catégorie,
   description, site, adresse, téléphone `+218 91 344 2640`, e-mail
   `contact@nokhba.net.ly`. **Identité identique au site, au footer, à Google
   Business Profile et au WHOIS** (cohérence NAP : c'est un critère des deux
   plateformes).
2. **Créer le flux d'invitation** — le bon moment est **juste après la
   livraison**, quand la satisfaction est maximale :
   - commande digitale livrée → e-mail `🎁 Vos codes…` (`src/lib/digital-emails.ts`) ;
   - site livré / mise en ligne → e-mail de remise (`src/lib/delivery-emails.ts`) ;
   - abonnement renouvelé sans incident.
   Le plan gratuit se pilote par **import CSV** (1 fois/semaine) ; les plans
   payants par API ou par **BCC** automatique depuis vos propres e-mails.
3. **Textes multilingues** (arabe en premier, puis français, anglais) dans
   l'invitation : demander l'avis **dans la langue du client**, jamais de
   consigne de note (« mettez 5 étoiles » = violation).
4. **Répondre à 100 % des avis, sous 48 h**, y compris les 1–2 étoiles.
   Réponse courte, factuelle, avec la référence de commande et une solution.
   Une réponse posée à un avis négatif convertit mieux qu'un 5/5 sans réponse :
   c'est ce que lit un prospect méfiant.
5. **Traiter les faux avis** : signaler via le formulaire (contenu illégal,
   concurrent, non-client) — Trustpilot tranche sur les règles, pas sur votre
   abonnement. Ne jamais répondre agressivement : la réponse reste publique.
6. **Afficher la note** : 1 widget gratuit = la barre « Excellent · TrustScore
   4,6 · 132 avis » sous le hero ou dans la section avis. Sur le plan gratuit,
   le widget fait aussi de la publicité pour Trustpilot : c'est le prix de la
   gratuité.
7. **Rythme visé** : 8–15 avis/mois les 6 premiers mois, puis maintien. Objectif
   réaliste **4,3–4,6**, pas 5,0 (un profil 5,0 avec peu d'avis inspire la
   méfiance).

---

## 4. Scamadviser — la marche à suivre

1. **Vérifier l'état actuel** : `scamadviser.com/check-website/nokhba.net.ly`.
   Noter le score, et surtout **la liste des facteurs négatifs** affichée —
   c'est votre feuille de route (elle est propre à votre domaine).
2. **Revendiquer / faire vérifier l'entreprise** (gratuit) : dossier envoyé à
   `report@scamadviser.com` avec registre de commerce libyen, adresse, téléphone,
   e-mail de domaine, extrait du site, preuves de livraison, profils sociaux.
   La vérification ajoute une mention « entreprise vérifiée » qui **ne change pas
   la note mécaniquement** mais change la lecture humaine de la fiche.
3. **Corriger les signaux que l'algorithme regarde** (par ordre de rendement) :

| Signal | Action concrète sur `nokhba.net.ly` |
|---|---|
| WHOIS masqué / données incomplètes | Passer le WHOIS en **données d'entreprise publiques** (nom légal, adresse Tripoli, e-mail de domaine). C'est le premier facteur de « pénalité d'opacité ». |
| Âge du domaine | Ne se force pas. Compensez par les autres signaux et **restez sur le même domaine** (une migration repart à zéro côté Scamadviser : voir `docs/migration-domaine.md`). |
| Coordonnées vérifiables | Adresse `شارع الجمهورية، طرابلس` + téléphone `+218 91 344 2640` + e-mail de domaine déjà présents dans `src/lib/config.ts` → **les faire figurer sur une vraie page**, pas seulement dans le footer. |
| Identité juridique | **Créer une page « Mentions légales / À propos »** : raison sociale, n° de registre de commerce, adresse, responsable de publication, hébergeur (Vercel), contact. Aujourd'hui le site n'a que `conditions`, `remboursement`, `livraison` — cette page manque et c'est un manque visible pour l'algorithme comme pour l'acheteur. |
| SSL / en-têtes | Déjà en place (`scripts/security-headers.test.mjs`). Vérifier que **toutes** les variantes (`www`, `http` → `https`) répondent en 200/301 propres. |
| Avis tiers | **Le levier le plus rapide** : un profil Trustpilot peuplé est explicitement un signal positif pour Scamadviser. Le travail du §3 alimente celui-ci. |
| Réseaux sociaux | Comptes **anciens et cohérents** (même logo, même adresse, publications régulières). Un compte créé hier avec 0 follower est neutre au mieux. |
| Moyens de paiement traçables | Le checkout NOWPayments (crypto) est **un signal faible** pour un acheteur européen. Afficher clairement les alternatives et la politique de remboursement réduit la perception de risque. |
| Politiques claires | `conditions`, `remboursement`, `livraison` existent : les **lier depuis chaque fiche produit et le checkout**, pas seulement depuis le footer. |
| Blacklists | Vérifier `Google Safe Browsing` (Search Console) et l'absence de faux positif. Une levée de faux positif peut prendre des semaines : c'est le seul point bloquant réel. |

4. **Ne pas rafraîchir la fiche en boucle** : l'algorithme se met à jour seul,
   souvent en quelques jours après correction. Si le score reste bloqué sur un
   facteur factuellement faux, relancer `report@scamadviser.com` avec la preuve.
5. **Traiter les avis négatifs sur la fiche** : répondre publiquement, rembourser
   si c'est justifié, puis demander au client de mettre à jour son avis (c'est
   autorisé sur Scamadviser ; sur Trustpilot, on ne demande pas la modification,
   on répond).

---

## 5. Plan 30 jours (ordre de priorité)

**Semaine 1 — fondations**
- [ ] Page **Mentions légales / من نحن** avec identité juridique + registre + hébergeur.
- [ ] Liens vers `conditions` / `remboursement` / `livraison` depuis le tunnel d'achat.
- [ ] WHOIS en données d'entreprise publiques.
- [ ] Scan Scamadviser initial : capture du score et des facteurs négatifs (point de départ chiffré).

**Semaine 2 — Trustpilot**
- [ ] Profil revendiqué, identité alignée (NAP) partout.
- [ ] E-mail de demande d'avis ajouté après livraison (digital **et** sites).
- [ ] Textes d'invitation AR / FR / EN rédigés.
- [ ] Widget gratuit posé près de la section avis.

**Semaine 3 — volume**
- [ ] Import CSV des clients livrés des 60 derniers jours (tous, sans tri).
- [ ] Réponses aux avis sous 48 h (modèles prêts, personnalisés à chaque fois).
- [ ] Dossier de vérification envoyé à Scamadviser.

**Semaine 4 — consolidation**
- [ ] Google Business Profile complété (photos, horaires, catégories) et **avis Google** sollicités aussi : ils alimentent la recherche locale, pas Scamadviser, mais convertissent plus en Libye.
- [ ] Re-scan Scamadviser, comparaison avec la semaine 1.
- [ ] Décision : le plan gratuit suffit-il, ou passer à l'offre payante (Seller Ratings) ?

---

## 6. État actuel du site — ce qui aide, ce qui manque

**Déjà bon (à ne pas casser)**
- Aucune note moyenne inventée : la section avis n'affiche que le **nombre de
  témoignages réellement publiés** (`src/components/sections/testimonials.tsx`),
  et `src/lib/seo.ts` n'émet volontairement **ni `aggregateRating` ni `review`**
  auto-déclarés. C'est la posture correcte — la garder tant que les avis ne sont
  pas sourcés d'une plateforme tierce.
- Adresse, téléphone, e-mail centralisés dans `src/lib/config.ts`, JSON-LD
  complet, page Google Maps, politiques de vente et de remboursement déjà
  rédigées, en-têtes de sécurité testés.

**État au 06/11/2026**

| Point | Statut |
|---|---|
| Page **mentions légales** + identité juridique | ✅ page `/mentions-legales` en ligne ; **reste à saisir** le registre de commerce et le responsable de publication dans l'admin. |
| **Demande d'avis** dans les e-mails de livraison | ✅ implémentée (codes, recharge, reçu de recette), désactivée tant que l'admin ne l'active pas. |
| **Liens de profils** (Trustpilot / Google / Scamadviser) | ✅ affichables et validés ; **restent à créer** côté plateformes, puis à coller dans l'admin. |
| **Page `/avis`** (politique d'avis) | ✅ en ligne — sert de page cible aux e-mails d'invitation. |
| **Avis du site encore non sourcés** | ⚠️ inchangé volontairement : aucun widget Trustpilot tant que le profil n'existe pas. Dès qu'il existe, la section avis peut afficher la note **réelle et liée** au lieu de témoignages sans provenance. |
| **Fiche Scamadviser** | ⏳ action humaine : revendication + dossier `report@scamadviser.com`. |

---

## 7. Indicateurs à suivre

| Indicateur | Cible 90 jours |
|---|---|
| Trustpilot TrustScore | ≥ 4,3 |
| Nombre d'avis Trustpilot | ≥ 40, dont ≥ 50 % « Vérifié » |
| Taux de réponse aux avis | 100 % sous 48 h |
| Taux d'invitation → avis | 8–15 % (normal : 5–15 %) |
| Score Scamadviser | ≥ 80 (« probablement sûr ») |
| Facteurs négatifs Scamadviser | 0 facteur factuellement faux |

---

## 8. Implémenté dans le code (06/11/2026)

Tout ce qui suit est en place et couvert par `scripts/trust-reviews.test.mjs`
(inclus dans `npm run test:seo`).

| Brique | Où | Comportement |
|---|---|---|
| **Réglages** | `/admin → Réglages → Avis & Mentions légales` | 3 URL de profils (`trust.*`), interrupteur `trust.reviewInvites`, identité légale (`legal.*`). Tous vides par défaut : aucun lien affiché, aucun avis demandé. |
| **Validation d'URL** | `src/lib/trust.ts` | `https` obligatoire, domaine de la plateforme obligatoire (`fr.trustpilot.com`, `g.page`, `www.scamadviser.com`…), identifiants `user:pass` et sous-domaines imbriqués refusés. |
| **Page `/avis`** | `src/app/(site)/avis/` | Profils réels, politique d'avis en 5 engagements, procédure, témoignages publiés tels que reçus. **Aucune moyenne, aucun compteur.** |
| **Page `/mentions-legales`** | `src/app/(site)/mentions-legales/` | Éditeur, registre, responsable de publication, hébergeur, données. Une valeur non renseignée est **omise** (`legalRows()`), jamais inventée. |
| **E-mails** | `src/lib/review-emails.ts` + `digital-emails.ts` + `delivery-emails.ts` | Bloc bilingue AR/EN dans l'e-mail des codes et dans le reçu de recette ; demande adressée à tous les clients, sans consigne de note, sans contrepartie, support dans le même bloc. |
| **Liens** | pied de page, `LegalLinks`, section avis de l'accueil, `sitemap.ts` | Les deux pages sont découvrables et indexables. |
| **Garde-fous** | `scripts/trust-reviews.test.mjs` | Refus des URL piégées, refus des formulations « 5 étoiles »/contrepartie, interdiction d'`aggregateRating`/`ratingValue`/`reviewCount` dans les nouveaux modules, compatibilité des configurations enregistrées avant l'ajout des blocs `trust`/`legal`. |

### Ce qu'il reste à faire (actions humaines, pas du code)

1. **Créer les profils** Trustpilot / Google Business / Scamadviser, puis coller
   leurs URL dans l'admin et activer `reviewInvites`.
2. **Renseigner l'identité légale** (raison sociale, n° de registre, autorité,
   responsable de publication) : la page est en ligne mais n'affiche pour
   l'instant que les coordonnées et l'hébergeur.
3. **Passer le WHOIS** en données d'entreprise publiques.
4. **Envoyer le dossier de vérification** à `report@scamadviser.com`.
5. **Répondre aux avis** sous 48 h — aucun code ne le fera à votre place.

### Volontairement non fait

- **Aucun `aggregateRating` / `review` en JSON-LD** : une note auto-déclarée
  par une entreprise sur sa propre page est ignorée par Google et expose à une
  action manuelle. À n'ajouter qu'à partir d'avis réellement publiés sur une
  plateforme tierce, et après lecture des règles en vigueur.
- **Aucun widget Trustpilot** : il nécessite l'identifiant du profil, qui
  n'existe pas encore. Le composant est trivial à ajouter ensuite (un script
  + une `div`), mais afficher un widget vide serait pire que rien.
- **Aucune note de remplissage** dans `/avis` : pas de « 4,9/5 » inventé, pas
  de « +500 clients satisfaits ». C'est ce qui rend la page crédible — et
  c'est aussi ce que Scamadviser signale comme signal négatif quand un jeune
  domaine affiche soudainement des notes parfaites.

---

## 9. Créer le profil Trustpilot Business — pas à pas

> « Trustpilot Business » = le **compte professionnel gratuit** (tableau de
> bord) sur `business.trustpilot.com`. Il n'y a pas de bouton « revendiquer » :
> **s'inscrire avec son domaine, c'est revendiquer le profil** de ce domaine,
> avis déjà présents inclus.

### 9.1 Avant de commencer — les trois choix qui décident de tout

| Choix | Valeur à utiliser | Pourquoi c'est structurant |
|---|---|---|
| **Domaine revendiqué** | `nokhba.net.ly` (sans `www`) | Les avis se rattachent au **domaine**, pas à la marque. Changer de domaine plus tard = demande de fusion manuelle, plusieurs semaines. C'est aussi le domaine du `sitemap`, des canoniques et de `src/lib/site-identity.ts` : rester aligné. |
| **E-mail de création** | `contact@nokhba.net.ly` (adresse **sur le domaine**) | Si l'e-mail est sur le domaine, la revendication est **immédiate**. Sinon Trustpilot passe en vérification de domaine (voir 9.3). |
| **Nom affiché** | `Nukhba` (et `نخبة` dans la description) | Doit être identique au site, au pied de page, à Scamadviser et à la fiche Google. Une incohérence de nom est un signal négatif pour Scamadviser. |

Trustpilot exige un **site actif** pour collecter des avis — c'est le cas.

### 9.2 Étapes

1. Aller sur `business.trustpilot.com` → **Create free account**.
2. Renseigner : nom (`Nukhba`), **site web** `https://nokhba.net.ly`,
   e-mail `contact@nokhba.net.ly`, pays, secteur.
3. Ouvrir l'e-mail d'activation → **Activate account** → mot de passe → conditions.
   (L'e-mail part parfois en spam : vérifier avant de relancer.)
4. Compléter le profil public :
   - **Catégorie** : services numériques / création de sites, plus une catégorie
     secondaire pour la boutique de codes (n'en cocher qu'une ou deux : une
     catégorie fausse attire les mauvais visiteurs et les avis hors sujet).
   - **Logo** : le fichier déjà utilisé sur le site (carré, fond transparent).
   - **Coordonnées** : `شارع الجمهورية، طرابلس` / `+218 91 344 2640` /
     `contact@nokhba.net.ly` — **identiques** au site.
   - **Description** : le texte ci-dessous (AR puis EN).
5. **Une fois le profil en ligne**, copier son URL
   (`https://fr.trustpilot.com/review/nokhba.net.ly`) et la coller dans
   `/admin → Réglages → Avis & Mentions légales → Profil Trustpilot`, puis
   activer « Demander un avis après livraison ».
   Le site affichera alors le lien sur `/avis` et l'ajoutera aux e-mails de
   livraison — **rien avant**, volontairement.

### 9.3 Si la vérification de domaine est demandée

Quatre méthodes, par ordre de simplicité pour ce site :

| Méthode | Comment | Remarque |
|---|---|---|
| **Meta tag** | Renseigner `TRUSTPILOT_VERIFICATION` sur Vercel → la balise `trustpilot-one-time-domain-verification-id` est émise sur **toutes** les pages (implémenté, voir `.env.example`). | Aucun fichier à déposer, réversible en une variable d'environnement. |
| **Google Search Console** | La propriété est déjà vérifiée (balise + fichier `public/googleaf….html`) → cliquer **Verify domain** côté Trustpilot. | Le plus rapide si l'option est proposée. |
| **DNS TXT** | Enregistrement TXT chez le registrar de `net.ly`. | Propagation jusqu'à 72 h. |
| **Fichier HTML** | Déposer le fichier fourni à la racine de `public/`, puis redéployer. | Fonctionne, mais alourdit le dépôt pour un jeton temporaire. |

### 9.4 Description de profil — à copier

**العربية**

> نخبة (Nukhba) استوديو رقمي في طرابلس، ليبيا، متخصص في شيئين: تصميم وتطوير المواقع
> الإلكترونية للشركات والمتاجر، وتشغيل متجر أكواد رقمية موثوق.
>
> في مجال المواقع، نبني مواقع سريعة بالعربية والإنجليزية مع لوحة تحكم سهلة، متوافقة
> مع الهاتف، ومهيّأة لمحركات البحث، مع تسليم في موعد متفق عليه ودعم بعد التسليم.
>
> في المتجر الرقمي، نبيع أكواد الألعاب وبطاقات الهدايا وبطاقات تعبئة الرصيد. تسليم
> الأكواد يتم عبر البريد الإلكتروني أو في صفحة متابعة الطلب، ونوضّح لكل منتج منطقه
> (Global أو US أو EU) قبل الشراء. الدفع بالعملات الرقمية عبر بوابة NOWPayments.
>
> نعمل من السبت إلى الخميس من 9:00 إلى 23:00 بتوقيت طرابلس، ويمكن التواصل معنا
> بالعربية أو الإنجليزية أو الفرنسية. نردّ على كل تقييم، ونعالج أي مشكلة بإصلاح أو
> استرداد إن كان الخلل من عندنا.

**English**

> Nukhba is a digital studio based in Tripoli, Libya, focused on two things:
> building websites for businesses and running a dependable digital-code store.
>
> On the web side we design and build fast, mobile-first sites in Arabic and
> English, with a simple dashboard, search-engine-ready structure, an agreed
> delivery date and support after handover.
>
> In the digital store we sell game codes, gift cards and phone top-ups. Codes
> are delivered by e-mail and remain available from the order-tracking page, and
> every product states its region (Global, US, EU…) before purchase. Payment is
> in cryptocurrency through the NOWPayments gateway.
>
> We work Saturday to Thursday, 9:00–23:00 Tripoli time, and we answer in
> Arabic, English and French. We reply to every review, and if something is
> wrong on our side we fix it or refund it.

### 9.5 Gratuit ou payant ?

| | Plan gratuit | Plans payants (~100 à 900 $/mois, engagement annuel) |
|---|---|---|
| Profil revendiqué + badge « Claimed » | ✅ | ✅ |
| Répondre à tous les avis | ✅ | ✅ |
| Invitations d'avis | ~50/mois (import CSV) | 100 à 1000+/mois, envoi automatique, API |
| Widget sur le site | 1 (basique) | plusieurs, personnalisables |
| Google Seller Ratings (étoiles dans les annonces) | ❌ | ✅ (≥ 100 avis sur 24 mois et note ≥ 3,5) |

**Recommandation** : rester sur le **gratuit** jusqu'à ~15–20 avis, puis
arbitrer. Payer ne donne aucune étoile en plus : cela achète du **volume
d'invitations** et des **widgets**, rien d'autre.

### 9.6 Les erreurs qui coûtent cher

- **Revendiquer un autre domaine** que `nokhba.net.ly` (ancien domaine, `www`,
  sous-domaine) : les avis se retrouvent sur une fiche que personne ne consulte.
- **Inviter avant d'avoir livré** quoi que ce soit : les premiers avis arrivent
  sur une boutique vide, et un profil 5,0 avec trois avis est moins crédible
  qu'un profil 4,5 avec vingt.
- **Choisir une catégorie trop large** (« Shopping ») : les avis hors sujet
  affluent et la moyenne baisse pour de mauvaises raisons.
- **Personnaliser le nom affiché** (« Nukhba — Web & Codes ») : la cohérence
  NAP avec Scamadviser et Google vaut plus que le marketing.
- **Répondre aux avis en français** alors que le client écrit en arabe : la
  réponse est publique, elle doit être dans la langue de l'avis (ou bilingue).
