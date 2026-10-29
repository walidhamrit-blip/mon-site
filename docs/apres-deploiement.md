# Après le déploiement — plan d'action pas à pas

**Pour qui :** le propriétaire du site (tout se fait dans un navigateur, sans
toucher au code).
**Quand :** à partir du 29/10/2026, dans l'ordre des sections.
**Objectif :** faire passer `nokhba.net.ly` de « site invisible » à « site
indexé, trouvé sur les requêtes de Tripoli et sur les fiches produit ».

Références : [`audit-seo-2026-10-28.md`](./audit-seo-2026-10-28.md) (le
diagnostic et le pourquoi de chaque correctif), [`badge-netlinking.md`](./badge-netlinking.md)
(la procédure de netlinking client).

> **Règle de lecture :** une section = une action = un résultat vérifiable.
> Ne passez pas à la suivante avant d'avoir coché la ligne « ✅ Contrôle ».

---

## 0. Ce qui est déjà fait (ne le refaites pas)

| Date | Action | Preuve |
|---|---|---|
| 29/10 00:25 UTC | PR #111 fusionnée → la production sert **l'arabe** (titres, H1, descriptions, JSON-LD), `/codes` est lié depuis l'accueil et le menu | commit `785db6c`, déploiement Vercel `success`, accueil vérifié |
| 29/10 00:31 UTC | PR #113 fusionnée → **sitemap dynamique** : il liste le catalogue réellement vendu au lieu des 10 fiches « seed » | commit `b39a4bc`, `/sitemap.xml` de production contient les familles `fzr-topup…`, `fzr-gamekey…`, `fzr-giftcard…` |
| déjà en place | Vérification Google : balise `<meta name="google-site-verification">`, fichier `public/googleaf08e19c9e7d8550.html`, **et** enregistrement TXT DNS `google-site-verification=POB624…` | trois méthodes simultanées, la propriété « Domaine » doit donc se valider en un clic |
| déjà en place | `robots.txt` déclare le sitemap et autorise explicitement les robots IA (GPTBot, ClaudeBot, PerplexityBot…) | `https://nokhba.net.ly/robots.txt` |
| déjà en place | **IndexNow** : clé publiée sur `https://nokhba.net.ly/496dc8c7fd1cb72cb39630115e74bdde.txt`, ping automatique à chaque enregistrement depuis `/admin` | `src/lib/indexnow.ts`, `src/app/admin/actions.ts` |
| déjà en place | Messagerie : MX Zoho (`mx`, `mx2`, `mx3.zoho.com`), SPF `include:zohomail.com`, DMARC `p=none` | requêtes DNS du 29/10 |

Ce qui **n'est pas** automatisable et reste donc à faire : Search Console,
Bing, Google Business Profile, boîte `contact@`, backlinks. C'est l'objet des
sections 2 à 7.

---

## 1. Avant de cliquer : noter le point de départ (5 min)

Sans mesure de départ, impossible de dire si ça marche. Dans un fichier
`suivi-seo.md` (ou une feuille Google Sheet), note à la main aujourd'hui :

```
Date : 29/10/2026
Pages indexées (Search Console) : 0 (ou inconnu)
Impressions 28 derniers jours     : 
Clics 28 derniers jours           : 
Sessions organiques (analytics)   : 
```

Puis, une fois par semaine, refais la même photo. C'est tout le tableau de
bord nécessaire pendant 90 jours.

---

## 2. Étape 1 — Google Search Console (jour 1, 20 min)

C'est **la** priorité : sans Search Console, Google ne sait pas que le sitemap
a changé, et vous ne voyez pas pourquoi vos pages ne sont pas indexées.

### 2.1 Ouvrir la console

1. Aller sur <https://search.google.com/search-console>.
2. Se connecter avec le compte Google du propriétaire (gardez ce compte : c'est
   lui qui recevra les alertes).
3. En haut à gauche, le sélecteur de propriété → **« Ajouter une propriété »**.

### 2.2 Créer la propriété « Domaine » (pas « Préfixe d'URL »)

La propriété **Domaine** couvre `nokhba.net.ly`, `www.` et tous les
sous-domaines : c'est celle qu'il faut.

1. Choisir la tuile de gauche, **Domaine**, et saisir `nokhba.net.ly`.
2. Google affiche un enregistrement **TXT** à poser chez le registrar.
   Or **il est déjà en place** (voir § 0). Cliquez sur **Vérifier** : la
   validation est immédiate.
3. Si Google refuse : vérifiez que le TXT visible dans la console est bien
   `google-site-verification=POB624EdzYiqxSgcA5PYaLyZDBbjBVx3mnAgEeUjKcg`.
   S'il affiche un **autre** code, c'est une nouvelle propriété → le TXT n'est
   pas le même : ajoutez ce nouveau TXT chez le registrar, attendez 10 min, re-vérifiez.
   (Ne supprimez pas l'ancien TXT.)

### 2.3 Soumettre le sitemap

1. Menu de gauche → **Sitemaps**.
2. Champ « Ajouter un sitemap » : taper `sitemap.xml` (juste ça, pas l'URL
   complète) → **Envoyer**.
3. Statut attendu : « Réussi ». Le nombre d'URL détectées apparaît sous
   24–48 h : il doit être de l'ordre de **450** (52 pages fixes + les fiches
   `/codes/…`). Prenez le chiffre exact affiché : c'est votre référence.

**Ne soumettez pas le sitemap tous les jours.** Une soumission suffit :
Google relit le fichier tout seul. Re-soumettre n'accélère rien et n'apporte
aucun signal.

### 2.4 Demander l'indexation des 10 URLs qui comptent

Outil **Inspection de l'URL** (barre du haut), une URL à la fois, puis bouton
**« Demander l'indexation »**. Google limite à une dizaine de demandes par jour
(quota non communiqué) : étalez sur 2 jours.

| # | URL | Pourquoi |
|---|---|---|
| 1 | `https://nokhba.net.ly/` | page d'entrée, requêtes de marque + « تصميم مواقع طرابلس » |
| 2 | `https://nokhba.net.ly/codes` | rayon boutique, la page qui doit capter « شحن شدات » |
| 3 | `https://nokhba.net.ly/codes/fzr-topup-pubg-mobile-auto` | produit le plus recherché en Libye |
| 4 | `https://nokhba.net.ly/codes/fzr-topup-free-fire-mena` | 2ᵉ jeu le plus demandé |
| 5 | `https://nokhba.net.ly/codes/fzr-topup-mobile-legends-global` | 3ᵉ jeu |
| 6 | `https://nokhba.net.ly/codes/steam-wallet` | intention d'achat internationale, panier élevé |
| 7 | `https://nokhba.net.ly/codes/playstation-store` | carte cadeau, forte demande |
| 8 | `https://nokhba.net.ly/services` | page commerciale « création de site » |
| 9 | `https://nokhba.net.ly/pricing` | requêtes « سعر تصميم موقع » |
| 10 | `https://nokhba.net.ly/demos` | preuve visuelle, réduit le rebond des pages service |

Les autres URLs (≈ 440) n'ont pas besoin d'une demande manuelle : elles
entreront par le sitemap et par les liens internes, en 2 à 6 semaines.

### 2.5 Lire le rapport « Indexation des pages » (le plus important)

Menu de gauche → **Indexation → Pages**. C'est ici que se joue la suite.
Au bout de 7 jours, chaque ligne vous dit quoi faire :

| Statut affiché | Ce que ça veut dire | Action |
|---|---|---|
| **Explorée, actuellement non indexée** | Google a lu la page et l'a jugée insuffisante ou redondante | c'est un signal de **contenu**, pas de technique : enrichir la fiche (paragraphe propre au jeu, régions, guide d'achat) et ajouter 2–3 liens internes depuis des pages fortes. Ne pas re-demander l'indexation. |
| **Détectée, actuellement non indexée** | Google connaît l'URL mais n'a pas encore prévu de la visiter | patience 2–4 semaines ; accélérer en liant la page depuis `/codes` et depuis les pages de catégorie |
| **Exclue par une balise « noindex »** | la page se bloque elle-même | anormal sur une page publique → signaler (ce sont normalement uniquement `/pay/`, `/codes/commande`, `/admin`) |
| **Page en double, Google a choisi une autre URL canonique** | deux URLs identiques | vérifier la balise `canonical` ; si `www.` apparaît, le problème est côté domaine |
| **Introuvable (404)** | URL au sitemap sans page | ne devrait plus arriver après #113 ; si ça arrive, envoyer l'URL exacte |
| **« Réussie »** | page indexée | rien à faire |

**Rythme :** une seule visite par semaine (mardi), même jour, même heure.
Consulter tous les jours ne fait rien avancer et empêche de voir la tendance.

### ✅ Contrôle (§ 2)

- [ ] la propriété **Domaine** `nokhba.net.ly` est vérifiée (cadenas / nom affiché)
- [ ] le sitemap est au statut « Réussi » avec ~450 URLs
- [ ] les 10 URLs de la liste ont reçu « Demande d'indexation envoyée »
- [ ] vous savez lire la page « Indexation des pages »

---

## 3. Étape 2 — Vérifier vous-même le sitemap (2 min, à faire aujourd'hui)

Indépendant de Google, cela confirme que le déploiement du 29/10 est bien en
ligne.

1. Ouvrir <https://nokhba.net.ly/sitemap.xml> dans un onglet.
2. `Ctrl+F` → `fzr-topup` : vous devez voir des **dizaines** d'occurrences
   (et non les 10 anciennes fiches `steam-wallet`, `roblox-us`, …).
3. Chercher aussi `fzr-gamekey` et `fzr-giftcard` : les deux familles doivent
   être présentes.
4. Ouvrir <https://nokhba.net.ly/robots.txt> : la dernière ligne doit être
   `Sitemap: https://nokhba.net.ly/sitemap.xml`.

### ✅ Contrôle (§ 3)

- [ ] `fzr-topup`, `fzr-gamekey`, `fzr-giftcard` apparaissent tous les trois
- [ ] `robots.txt` déclare bien le sitemap

Si l'une des cases n'est pas cochée : **le déploiement n'est pas celui du
29/10** ; ne touchez à rien d'autre et faites-le signaler avant de continuer
(un sitemap à 62 URLs ne servira à rien à soumettre).

---

## 4. Étape 3 — Bing Webmaster Tools + IndexNow (jour 1, 15 min)

Bing n'est pas un « petit Google » : il alimente **Copilot**, et une partie des
réponses de ChatGPT Search. Le coût est de 15 minutes.

### 4.1 Importer depuis Search Console (le plus rapide)

1. Aller sur <https://www.bing.com/webmasters> et se connecter (compte
   Microsoft ; peut être une adresse Gmail).
2. Choisir **« Importer depuis Google Search Console »** : Bing reprend la
   propriété, les sitemaps et l'historique déjà vérifié.
3. Si l'import échoue : « Ajouter un site manuellement » → `https://nokhba.net.ly`
   → vérification par balise meta (déjà posée) ou par fichier XML.

### 4.2 Soumettre le sitemap

**Sitemaps → Envoyer un sitemap** → `https://nokhba.net.ly/sitemap.xml`.

### 4.3 Activer IndexNow (déjà câblé côté site)

Le site envoie déjà une notification IndexNow à chaque enregistrement fait
depuis `/admin` (clé publiée à la racine du domaine). Rien à installer.

Deux vérifications utiles :

1. Ouvrir <https://nokhba.net.ly/496dc8c7fd1cb72cb39630115e74bdde.txt> : la
   page doit afficher exactement
   `496dc8c7fd1cb72cb39630115e74bdde`. Si elle affiche une 404, dites-le :
   sans ce fichier, les pings sont rejetés.
2. Test manuel (optionnel). Depuis un ordinateur, coller cette URL dans le
   navigateur — elle doit renvoyer `200` ou `202` :
   ```
   https://api.indexnow.org/indexnow?url=https%3A%2F%2Fnokhba.net.ly%2Fcodes&key=496dc8c7fd1cb72cb39630115e74bdde
   ```

IndexNow ne s'applique pas à Google : pour Google, seul le sitemap compte.

### ✅ Contrôle (§ 4)

- [ ] le site est vérifié dans Bing Webmaster Tools
- [ ] le sitemap est soumis côté Bing
- [ ] le fichier de clé IndexNow s'affiche bien

---

## 5. Étape 4 — Google Business Profile (jours 2–3, 45 min)

C'est **le levier n° 1 du référencement local à Tripoli**, et la seule source
d'avis qui compte pour Google depuis la fin des avis auto-déclarés. Pour les
requêtes « تصميم موقع في طرابلس », le pack de résultats local passe souvent
avant les liens classiques.

### 5.1 Créer la fiche

1. Aller sur <https://business.google.com> → **Ajouter un établissement**.
2. **Nom** : `نخبة | Nukhba` (exactement comme sur le site, sans mots-clés
   ajoutés — un nom surchargé fait suspendre la fiche).
3. **Catégorie principale** : « Concepteur de sites web » (Web designer).
   Catégories secondaires utiles : « Agence de marketing », « Service de
   développement de logiciels », « Boutique de jeux vidéo » (si la partie
   codes est assumée publiquement).
4. **Adresse** : `شارع الجمهورية، طرابلس، ليبيا`. Si vous ne recevez pas de
   clients sur place, choisissez plutôt **zone de service** : Tripoli (+
   éventuellement les villes voisines) et **masquez l'adresse**.
5. **Téléphone** : `+218 91 344 2640` — identique au site.
6. **Site web** : `https://nokhba.net.ly` (sans `/ar`, sans paramètres).
7. **Horaires** : ceux affichés sur `/contact`, c'est-à-dire
   **السبت – الخميس, 9:00 – 22:00**. Toute différence entre la fiche et le site
   affaiblit la cohérence (nom, adresse, téléphone, horaires = « NAP »).

### 5.2 Vérifier la fiche

Google propose vidéo, téléphone, SMS ou courrier. La **vidéo** est la plus
rapide en Libye : préparez-vous à filmer l'enseigne, le matériel de travail
(ordinateur, bureau), un document au nom de l'activité, et à montrer que vous
êtes sur place. Suivez les consignes à la lettre : une vidéo hors sujet fait
échouer la vérification.

### 5.3 Remplir, puis entretenir

- **Photos** : 10 minimum — façade/enseigne si visible, bureau, 3–5 captures
  de réalisations (les pages `/demos` font l'affaire), logo, photo de l'équipe.
  Ajoutez une photo neuve toutes les 2 semaines.
- **Description** (750 caractères max) : qui vous êtes, ce que vous faites,
  où, en arabe, sans emojis ni majuscules criardes :
  > نخبة — تصميم مواقع ومتاجر إلكترونية في طرابلس، مع تسليم سريع وحجز
  > عبر واتساب. متجر رقمي لبطاقات الألعاب وشحن الألعاب. استشارة مجانية.
- **Avis** : demandez-en **5 réels** dans le premier mois à de vrais clients
  (bouton « Demander des avis » → lien direct à envoyer sur WhatsApp). Ne
  fabriquez jamais d'avis, ne les achetez pas : la sanction est la
  suspension de la fiche.
- **Publications** : un post par semaine (une réalisation, une offre, un
  article du blog). 5 minutes par semaine, effet mesurable sur la fiche.

### ✅ Contrôle (§ 5)

- [ ] fiche créée avec la bonne catégorie, le bon téléphone et la bonne adresse
- [ ] fiche vérifiée (Google l'affiche comme « Vérifié »)
- [ ] 10 photos en ligne
- [ ] premier avis client reçu

---

## 6. Étape 5 — La boîte `contact@nokhba.net.ly` (jour 2, 20 min)

L'adresse est affichée sur `/contact`, dans le pied de page, dans le JSON-LD
et dans les e-mails de commande. Une boîte qui ne reçoit rien = des demandes
perdues **et** un signal de confiance dégradé.

**Test réel du 29/10 — la boîte n'existe pas.** Un message envoyé depuis
Gmail a été rejeté en **`550 5.1.1`** (« destinataire inconnu »). Le diagnostic
est net : le domaine a bien des MX Zoho (`mx.zoho.com`, `mx2.zoho.com`,
`mx3.zoho.com`), un SPF correct (`v=spf1 include:zohomail.com ~all`) et un
DMARC (`v=DMARC1; p=none;`) — donc **l'infrastructure est prête, il manque
seulement la boîte**. Toutes les demandes envoyées à `contact@` ont donc été
perdues jusqu'ici.

> ⚠️ Deux effets de bord à corriger dans le même mouvement :
> 1. les confirmations de commande partent de `no-reply@nokhba.net.ly`, boîte
>    qui n'existe pas non plus : un client qui répond est rejeté ;
> 2. le formulaire de contact notifie cette même adresse morte — c'est
>    pourquoi `LEAD_NOTIFICATION_EMAIL` doit pointer vers une adresse qui
>    reçoit réellement (voir § 6.4).

### 6.1 Tester

Depuis une adresse externe (Gmail, Outlook…), envoyer un message à
`contact@nokhba.net.ly` avec pour objet « test ». Attendre 5 minutes, puis
vérifier la réception dans Zoho Mail (dossier « Spam » inclus).

- **Le message arrive** → rien à faire, passez à 6.4.
- **Erreur « adresse introuvable » (550 / 5.1.1)** → la boîte n'existe pas,
  allez au 6.2.

### 6.2 Créer la boîte ou l'alias

1. Aller sur <https://mail.zoho.com> avec le compte administrateur du domaine.
2. **Admin Console → Utilisateurs → Ajouter un utilisateur** :
   `contact@nokhba.net.ly` (ou **Groupes / Alias** si vous préférez rediriger
   vers votre boîte personnelle).
3. Définir un mot de passe, se connecter une fois pour activer la boîte.
4. Refaire le test du 6.1.

> Si vous préférez ne pas créer `contact@` : changez l'adresse publique dans
> **/admin → Paramètres** vers une adresse qui fonctionne **aujourd'hui**.
> Une adresse morte coûte plus qu'une adresse Gmail.

### 6.3 Créer aussi `no-reply@`

Même écran, 30 secondes : sans cette boîte, les réponses aux e-mails de
commande continuent d'être rejetées. Une fois créée, définir sur Vercel :

- `EMAIL_REPLY_TO=contact@nokhba.net.ly` → les clients qui cliquent
  « Répondre » écrivent à une adresse qui existe ;
- `LEAD_NOTIFICATION_EMAIL=contact@nokhba.net.ly` (ou votre Gmail tant que
  Zoho n'est pas prêt) → le formulaire de contact alerte quelqu'un qui lit.

Vérification : `https://nokhba.net.ly/api/health` → la section `mail` doit
afficher `"replyTo": "contact@nokhba.net.ly"`, et la liste `warnings` ne doit
plus mentionner `EMAIL_REPLY_TO`.

### 6.4 Confort (facultatif mais recommandé)

- **Zoho Admin → E-mail → Authentification** : activer **DKIM** pour le
  domaine, puis passer DMARC de `p=none` à `p=quarantine` **après 2–4
  semaines** sans problème de livraison.
- Ajouter une signature professionnelle (nom, téléphone, site) : chaque e-mail
  envoyé devient une occasion de revenir sur le site.

### ✅ Contrôle (§ 6)

- [ ] e-mail de test reçu dans Zoho
- [ ] l'adresse affichée sur le site est la même que celle qui reçoit

---

## 7. Étape 6 — Premiers backlinks (semaines 1–2)

Un domaine de moins d'un an sans lien entrant est indexé lentement, et se
positionne mal même sur son propre nom. Objectif réaliste : **5 à 10 liens de
qualité en 30 jours**, pas 100 liens annuaires.

### 7.1 Badge client (le plus rentable)

Chaque site livré porte un lien dofollow vers `nokhba.net.ly` :

1. Envoyer le lien <https://nokhba.net.ly/badge> au client (ou l'installer
   vous-même dans le pied de page, avec son accord).
2. La procédure complète, l'extrait HTML/React et l'audit des poses déjà
   faites sont dans [`badge-netlinking.md`](./badge-netlinking.md).

### 7.2 Profils sociaux cohérents

Les liens déjà déclarés dans le code : Instagram `nukhba.ly`, Facebook
`nukhba.ly`, TikTok `@nukhba.ly`, WhatsApp `wa.me/218913442640`.

Pour chacun : nom identique (« نخبة | Nukhba »), lien vers
`https://nokhba.net.ly` dans le profil (pas dans un lien intermédiaire),
adresse et téléphone identiques, 5 publications minimum. **Vérifiez que les
comptes existent réellement** : un lien social mort dans le pied de page est
un signal négatif.

### 7.3 Annuaire et carte

- La fiche Google Business Profile du § 5 (elle génère un lien).
- Une page Facebook « établissement » reliée au même NAP.
- Les annuaires locaux libyens sérieux (chambres de commerce, associations
  d'entreprises) : uniquement ceux qui publient une vraie adresse.

### 7.4 Partenaires et presse

- 2–3 partenaires (hébergeur, imprimeur, photographe, comptable) qui vous
  citent dans une page réelle.
- 1–2 mentions presse/blog local (une interview suffit) : c'est le type de lien
  qui pèse le plus après le badge client.

### 7.5 Ce qu'il ne faut pas faire

- Acheter des liens en lot, échanger des liens en masse, utiliser des
  annuaires « 1000 backlinks ».
- Mettre le même texte d'ancre partout : varier (« تصميم مواقع في طرابلس »,
  « متجر بطاقات الألعاب »…), et parfois le simple nom du site.

### ✅ Contrôle (§ 7)

- [ ] 3 badges clients posés et visibles dans le HTML (pas en JS)
- [ ] 4 profils sociaux cohérents pointant vers le site
- [ ] 1 mention partenaire ou presse en ligne

---

## 8. Étape 7 — La routine de mesure (10 min/semaine, tous les mardis)

| Où | Quoi | Signal attendu après 2 semaines | Après 8 semaines |
|---|---|---|---|
| Search Console → Sitemaps | « URL détectées » | ~450 | stable |
| Search Console → Pages | pages **indexées** | 10 → 60 | 200+ |
| Search Console → Performances | **impressions** | > 0 (site visible) | 500–5 000/mois |
| Search Console → Performances | **requêtes** | marque « نخبة » | + requêtes produit (« بطاقة بلايستيشن ») |
| Search Console → Performances | **CTR** moyen | — | 2–5 % |
| Analytics | sessions organiques | 0–10 | 100–300/mois |
| Business Profile | appels, itinéraires, demandes | 0–5 | 20–50 |
| Boutique | commandes issues de l'organique | — | à mesurer |

**Interprétation rapide :**

- **Impressions en hausse, clics plats** → les titres/descriptions ne
  convainquent pas : travail éditorial sur les 10 pages qui reçoivent le plus
  d'impressions (Search Console → Onglet « Pages »).
- **Pages indexées bloquées sous 10** → problème de qualité ou de maillage :
  enrichir `/codes` et les 20 fiches des jeux les plus demandés, et lier les
  fiches depuis des pages de catégorie.
- **Tout à zéro après 4 semaines** → vérifier « Indexation des pages » et la
  balise `noindex` ; si le sitemap est toujours à 62 URLs, le problème est
  côté déploiement, pas côté SEO.

---

## 9. Calendrier récapitulatif

| Quand | Quoi | Durée |
|---|---|---|
| **Aujourd'hui** | § 3 (contrôle du sitemap) + § 1 (noter les chiffres de départ) | 10 min |
| **Jour 1** | § 2 Search Console : propriété, sitemap, 10 demandes d'indexation | 20 min |
| **Jour 1** | § 4 Bing + IndexNow | 15 min |
| **Jour 2** | § 6 boîte `contact@` (test + création si besoin) | 20 min |
| **Jours 2–3** | § 5 Google Business Profile (création + photos + vérification) | 45 min |
| **Jours 3–7** | § 7 badges clients + profils sociaux | 1 h |
| **Chaque mardi** | § 8 routine de mesure (10 min) + 1 publication Business Profile | 20 min |
| **J+14** | lire « Indexation des pages », lister les statuts, décider des enrichissements | 30 min |
| **J+30** | bilan : pages indexées, impressions, avis, commandes organiques | 30 min |
| **J+60 / J+90** | relancer 2 guides de blog + 1 partenariat par mois ; viser 100–300 sessions/mois | — |

---

## 10. Les pièges à éviter

1. **Ne pas renvoyer le sitemap tous les jours** — une fois suffit, Google le relit.
2. **Ne pas demander l'indexation de 400 pages** — quota quotidien limité et
   sans effet sur les pages faibles : elles entrent par le sitemap et le maillage.
3. **Ne pas renommer les slugs `fzr-…`** maintenant : 399 URLs déjà en ligne,
   chaque renommage = une 301 à contrôler (voir audit § 8).
4. **Ne pas ajouter `hreflang`/`/en/…`** avant que les routes anglaises
   existent : un `hreflang` vers une page inexistante est une erreur.
5. **Ne pas bloquer les robots IA** dans `robots.txt` : ils amènent des visites
   (ChatGPT, Copilot, Perplexity), et le site est justement cité dans les
   réponses génératives.
6. **Ne pas toucher au domaine** ni au `www` : toute migration de domaine
   impose une nouvelle vérification et fait repartir l'indexation de zéro.
7. **Ne pas changer la langue par défaut dans `/admin`** : le site est en
   arabe pour le marché libyen ; repasser en anglais annule le correctif n° 1.
8. **Ne pas publier de chiffres non vérifiables** (« 120+ sites », « 4.9/5 »)
   sans preuve publique : c'est un risque de pénalité et un mauvais signal de
   qualité (audit § 5, point 8).
9. **Garder la CI verte** : `npm run seo:check` bloque les régressions de
   titres, descriptions, canonical et données structurées à chaque PR.

---

## 11. Ce qui reste à faire côté code (et qui n'est pas de votre ressort)

Ces chantiers sont documentés dans l'audit (§ 8) et feront l'objet de PR
séparées. Ils ne bloquent rien aujourd'hui, mais ils conditionnent le trafic
au-delà de 8 semaines :

| Chantier | Effet attendu | Quand |
|---|---|---|
| **Pagination du rayon `/codes`** (48 produits/page) | HTML plus léger, crawl plus profond | après stabilisation de l'indexation |
| **Pages de catégories** (`/codes/steam`, `/codes/recharges`, `/codes/cles-logiciels`) | capter « بطاقة ستيم », « شحن ببجي » au niveau rayon | mois 1 |
| **Enrichir 20 fiches** (PUBG, Free Fire, Mobile Legends, Steam, PlayStation, Xbox, Roblox) | sortir du contenu « mince » qui bloque l'indexation | mois 1 |
| **Version anglaise `/en/…` + `hreflang`** | clientèle internationale revendiquée par la home | mois 2 |
| **Noms de jeux en arabe** (ببجي، فري فاير، ماين كرافت) | correspondre aux requêtes réellement tapées | mois 1–2 |
| **Nouveaux articles de blog** (2/mois, en arabe) | maillage éditorial + longue traîne | continu |

---

## 12. Checklist finale (à imprimer)

```
[ ] Propriété Search Console « Domaine » vérifiée
[ ] Sitemap soumis, statut « Réussi », ~450 URLs détectées
[ ] 10 URLs prioritaires : indexation demandée (2 jours)
[ ] Sitemap de production vérifié à la main (fzr-topup / gamekey / giftcard)
[ ] Bing Webmaster Tools : site vérifié + sitemap soumis
[ ] Fichier de clé IndexNow accessible
[ ] Google Business Profile : créé, vérifié, 10 photos, 1er avis
[ ] contact@nokhba.net.ly : e-mail de test reçu
[ ] 3 badges clients en ligne (dofollow, dans le HTML)
[ ] 4 profils sociaux cohérents
[ ] 1 mention presse ou partenaire
[ ] Rappel hebdomadaire du mardi : Search Console + Business Profile
[ ] Chiffres de départ notés, puis relevés chaque semaine
```

Quand les 3 premières cases sont cochées, l'essentiel est fait : le reste est
de la répétition hebdomadaire. Le premier signal à guetter n'est pas le trafic,
c'est **« pages indexées » qui décolle de 10** — c'est le signe que Google a
compris ce que le site vend.
