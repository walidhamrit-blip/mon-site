> **Sécurisation en cours :** les indications d'activation dans les sections
> historiques ci-dessous ne doivent pas être appliquées. Les achats et la
> livraison automatiques restent bloqués ; garder `G2G_AUTO_DELIVERY` désarmé
> et tous les stocks G2G à 0. Voir l'[audit de reprise](g2g-audit-reprise.md)
> pour les réponses des fournisseurs, les limites actuelles et les prérequis.
>
# Pilote G2G OpenAPI v2 — procédure de branchement

> Objectif : vendre nos cartes cadeaux et clés de jeux FazerCards sur G2G,
> **sans acheter de stock d'avance**. Ce document décrit le déploiement
> progressif de l'automation : phase 1 (branchement, webhook, mapping),
> puis phase 2 (achat JIT, file de livraison, pilotage single-offer).
>
> **Briques 1 et 2 déjà déployées en production** (PR #207 et #209, merged sur main) :
> - ✅ Achat JIT (`src/lib/g2g-purchase.ts`) — 3 verrous : coupe-circuit, solde fournisseur, idempotence
> - ✅ File de livraison (`src/lib/g2g-delivery.ts`, cron `/api/cron/g2g-delivery`) — retry avec backoff, escalade Telegram
>
> **Brique 3 en cours : pilotage single-offer** — une seule offre passe en `api_qty = 1` avec le coupe-circuit armé, pour valider qu'une vraie vente se déroule sans litige avant d'élargir.

- Compte vendeur : `Walwal78`, **Seller ID / User ID `1003177397`**
- EKYC **Approved** le 13/11/2026 (ticket G2G `#5944715`)
- 1re vente manuelle le 10/11/2026 : offre `#G1793906316865GE`
  (*iTunes Gift Card TRY 100 (TR)*), commande `#1794322532545O5QE-1`
- Documentation officielle : <https://docs.g2g.com/llms.txt>
- Base API : `https://open-api.g2g.com`

---

## ⚠️ Règle n°1 — la clé secrète

G2G affiche la **Secret Key une seule fois** (g2g.com → Avatar →
**API Integration** → *Generate key*). Si elle est perdue, il faut régénérer
une paire de clés.

- ❌ Jamais dans un chat, un e-mail, un ticket support, un log, un screenshot,
  un fichier du dépôt ou une URL.
- ✅ Uniquement dans les **variables d'environnement Vercel** (Production +
  Preview si nécessaire), puis **redéployer**.
- ✅ En local : `.env.local` (ignoré par Git), jamais `.env` versionné.
- Ne pas créer une variable Vercel avec une valeur vide : Vercel la refuse.

---

## Étape 1 — Renseigner les variables côté serveur

Dans Vercel → projet `mon-site` → **Settings → Environment Variables** :

| Variable | Origine | Obligatoire en phase 1 |
| --- | --- | --- |
| `G2G_API_KEY` | API Integration → *Generate key* (clé publique, 32 hex) | ✅ |
| `G2G_SECRET_KEY` | Affichée **une seule fois** à la génération | ✅ |
| `G2G_USER_ID` | Seller ID `1003177397` | ✅ |
| `G2G_WEBHOOK_SECRET_TOKEN` | API Integration → section **Webhook** → *Generate random secret token* | ✅ (étape 3) |
| `G2G_WEBHOOK_URL` | Callback URL **exact** déclaré chez G2G, ex. `https://nokhba.net.ly/api/webhooks/g2g` | ✅ (étape 3) |
| `G2G_API_BASE` | `https://open-api.g2g.com` (défaut) | facultatif |

`G2G_WEBHOOK_SECRET_TOKEN` est un secret **différent** de `G2G_SECRET_KEY` :
le premier sert à vérifier les messages **entrants**, le second à signer nos
appels **sortants**.

### Rotation de clé : les 2 valeurs viennent de la MÊME génération

Quand on clique de nouveau sur **« Generate key »** (parce qu'une ancienne
clé existait déjà et que sa Secret Key n'était plus récupérable) :

- **l'ancienne paire est invalidée** : `G2G_API_KEY` **et**
  `G2G_SECRET_KEY` doivent être remplacées **ensemble**, avec les deux valeurs
  affichées lors du même clic. Un mélange « nouvelle API Key + ancienne
  Secret Key » (ou l'inverse) donne une erreur de signature sur tous les
  appels, sans autre indice que `401` / `invalid signature`.
- La nouvelle Secret Key n'est affichée **qu'une fois** : la copier avant de
  fermer la fenêtre G2G.
- Vérifier qu'il n'existe **qu'une seule ligne par nom** dans Vercel (un
  doublon affiche un liseré rouge sur « Key » et n'est pas enregistré), et
  qu'aucune ancienne valeur ne subsiste dans les environnements **Preview** ou
  **Development** : elle donnerait des résultats différents selon l'URL testée.
- `G2G_USER_ID`, `G2G_WEBHOOK_SECRET_TOKEN` et `G2G_WEBHOOK_URL` sont
  **indépendants** de cette rotation : ils ne changent pas.
- Comme pour toute modification de variable, un **redéploiement** est
  nécessaire avant de tester.

En cas de doute après le test `/admin/digital` : régénérer une nouvelle paire,
remplacer les **deux** variables, redéployer. C'est sans risque tant qu'aucune
offre n'est en `api_qty > 0`.

---

## Étape 2 — Vérifier que la clé fonctionne

Trois possibilités, toutes en **lecture seule** (`GET /v2/store`) :

```bash
# En local, après avoir rempli .env.local :
npm run g2g:check

# Sans réseau (contrôle de la config + calcul de signature) :
npm run g2g:check -- --sign-only

# Tests du noyau (signatures, webhook, marges, câblage) :
npm run test:g2g
```

Ou directement dans **`/admin/digital` → panneau « G2G — pilote OpenAPI v2 »**,
bouton *Tester la connexion* : il affiche le `user_id`, `account_status`,
`seller_status` et les devises de vente autorisées.

**Si la réponse est `400` avec `Invalid Header 'Content-Type'`**, l'en-tête
`Content-Type: application/json` manque (ou n'est envoyé que sur les requêtes
avec corps). Voir l'encadré ci-dessous.

> Le panneau affiche automatiquement la **famille** de l'erreur sous le
> message G2G (en-têtes, paire de clés, permissions, plafond, serveur…).
> Ne régénérez jamais des clés sur un `400` d'en-tête : ce n'est pas un
> problème de clé. À l'inverse, un `401` — ou un `400` contenant
> « invalid api key » / « signature » — pointe toujours vers la paire
> `G2G_API_KEY` / `G2G_SECRET_KEY`.

**Si la réponse est `401` / signature invalide**, vérifier dans l'ordre :

1. `G2G_SECRET_KEY` (régénérer la paire si elle a été perdue) ;
2. `G2G_API_KEY` et `G2G_USER_ID` (pas l'ID d'offre, bien le Seller ID) ;
3. l'horloge du serveur : le timestamp est en **millisecondes** et expire au
   bout de **5 minutes** ;
4. la casse / les espaces involontaires collés avec la clé.

> Note documentation : la page officielle *Verifying Signatures* affiche un
> hash d'exemple (`0884a10b…`) qui **ne se recalcule pas** avec les valeurs de
> son propre exemple. Les snippets JS/Python/PHP de cette page font foi, et le
> vecteur de la page *Message Signature* (`645343db…`) se recalcule
> exactement. Notre implémentation suit les snippets, pas le hash imprimé.

Signature des appels sortants :

```
canonicalString = canonicalPath + apiKey + userId + timestamp
g2g-signature   = HMAC_SHA256(secretKey, canonicalString).hexdigest()
```

où `canonicalPath` est **uniquement le chemin** (`/v2/store`), sans l'hôte.
En-têtes : `g2g-api-key`, `g2g-userid`, `g2g-timestamp`, `g2g-signature`.

### ⚠️ `Content-Type` est obligatoire, **même sur un `GET` sans corps**

C'est le piège n°1 du branchement, et il ne ressemble pas à un problème de
clé : la signature est pourtant correcte, tous les voyants de secrets sont
verts, et G2G répond quand même

> The request was unacceptable, often due to missing a required parameter.
> Invalid Header 'Content-Type'.

L'API exige `Content-Type: application/json` sur **chaque** requête, y
compris un `GET` vide. Tous les exemples `curl` de la documentation
officielle le portent, quelle que soit la méthode.

Côté code, l'en-tête est donc posé **inconditionnellement** par
`g2gRequestHeaders()` (`src/lib/g2g-core.ts`), jamais conditionné à la
présence d'un corps :

```ts
// ✅ correct — Content-Type part même sans corps
const headers = g2gRequestHeaders({ apiKey, secretKey, userId, canonicalPath, timestamp });

// ❌ casse tous les GET, dont GET /v2/store
if (options.body !== undefined) headers["Content-Type"] = "application/json";
```

Ne pas « nettoyer » cet en-tête sur les requêtes sans corps sous prétexte
qu'il est inutile en HTTP : G2G le refuse.

### Sonde d'en-têtes : quand la doc et la vraie API divergent

La documentation officielle et les implémentations publiques ne sont pas
d'accord entre elles (certaines envoient `Content-Type` sur un `GET` nu,
d'autres non ; le nom de l'en-tête utilisateur apparaît aussi bien comme
`g2g-userid` que `g2g-user-id`). Plutôt que de deviner depuis un
environnement qui n'a pas accès à l'API, le panneau admin sait trancher :

**`/admin/digital` → panneau G2G → « Diagnostiquer les en-têtes »**

Il rejoue `GET /v2/store` (**lecture seule**, aucune offre touchée) avec
plusieurs jeux d'en-têtes et affiche, pour chacun, le statut HTTP, le `code`
G2G, le `request_id` et le message exact :

| Variante | En-têtes |
| --- | --- |
| `baseline` | `Content-Type: application/json` + `Accept` + `g2g-userid` |
| `no_content_type` | `GET` nu, sans `Content-Type` |
| `no_accept` | `Content-Type` sans `Accept` |
| `charset_utf8` | `Content-Type: application/json; charset=utf-8` |
| `user_id_hyphen` | `g2g-user-id` au lieu de `g2g-userid` |

La ligne surlignée en vert est celle que G2G accepte : il suffit ensuite
d'aligner `g2gRequestHeaders()` (`src/lib/g2g-core.ts`) dessus.

#### Résultat relevé sur l'API réelle (16/11/2026)

La sonde a été exécutée en production, sur `GET /v2/store`, avec des
identifiants valides. **Résultat consolidé — c'est désormais une référence
mesurée, plus une hypothèse :**

| Variante | HTTP | Verdict | Message G2G |
| --- | --- | --- | --- |
| `baseline` | **200** | ✅ accepté | — |
| `no_content_type` | 400 | ❌ refusé | `Invalid Header 'Content-Type'` |
| `no_accept` | **200** | ✅ accepté | — |
| `charset_utf8` | 400 | ❌ refusé | `Invalid Header 'Content-Type'` |
| `user_id_hyphen` | 400 | ❌ refusé | `Missing Header 'g2g-user-id'` |

Trois enseignements, tous contre-intuitifs :

1. **`Content-Type` est obligatoire, y compris sur un `GET` vide.** C'était
   la panne d'origine.
2. **La valeur doit être exactement `application/json`** — la variante
   `application/json; charset=utf-8`, pourtant plus « correcte » en HTTP,
   est **refusée**. ⚠️ Ne jamais « enrichir » cet en-tête.
3. **L'en-tête utilisateur s'appelle bien `g2g-userid`** (sans tirets). Le
   piège : quand on envoie `g2g-user-id`, G2G répond `Missing Header
   'g2g-user-id'` — c'est-à-dire qu'il nomme **la forme qu'on a envoyée** et
   non celle qu'il attend. Ce message a déjà induit en erreur des
   intégrateurs en dehors de ce projet : le lire comme « il manque ce que je
   viens d'envoyer », donc « le vrai nom est l'autre forme ».

`Accept: application/json` est facultatif (`no_accept` passe en 200) ; on
continue de l'envoyer par hygiène.

Le panneau affiche aussi le **SHA du commit déployé** (`VERCEL_GIT_COMMIT_SHA`).
S'il ne correspond pas au dernier commit de la branche, le correctif n'est pas
encore en production : **redéployez avant de conclure que ça ne marche pas**.

---

## Étape 3 — Déclarer le webhook chez G2G

Dans **g2g.com → Avatar → API Integration → section Webhook** :

| Réglage | Valeur |
| --- | --- |
| Developer contact | une adresse e-mail surveillée (G2G alert si notre serveur ne répond pas) |
| Callback URL | `https://<votre-domaine>/api/webhooks/g2g` — **copier la chaîne exacte** dans `G2G_WEBHOOK_URL` |
| Secret token | générer avec *Generate random secret token* → `G2G_WEBHOOK_SECRET_TOKEN` |
| Events | cocher **`order.api_delivery`** (pas « tous les événements ») |

### Pas à pas dans la fenêtre « Callback URL »

La fenêtre affichée par G2G contient deux champs vides, le lien
*Generate random secret token* et le bouton **Save** :

1. **Callback URL** : coller **exactement** `https://nokhba.net.ly/api/webhooks/g2g`
   (domaine de production, en `https`, sans espace ni slash final). Cette même
   chaîne sera la valeur de `G2G_WEBHOOK_URL` — G2G l'inclut dans le calcul de
   la signature, donc les deux doivent être identiques au caractère près.
2. Cliquer sur **« Generate random secret token »** : le 2ᵉ champ se remplit
   avec une chaîne aléatoire (une douzaine de caractères, chiffres/lettres).
3. **COPIER cette chaîne AVANT de cliquer sur Save.** Comme la Secret Key de
   l'API, elle n'est pas récupérable ensuite ; si elle est perdue, il suffit de
   cliquer de nouveau sur *Generate random secret token* pour en créer une
   nouvelle (cela n'invalide PAS la paire `G2G_API_KEY` / `G2G_SECRET_KEY`).
4. La coller dans Vercel → `mon-site` → Settings → Environment Variables :
   **Name** = `G2G_WEBHOOK_SECRET_TOKEN`, **Value** = la chaîne,
   **Environment** = Production (+ Preview si utilisé), puis **Save** et
   **redéployer**. En local : `.env.local` uniquement.
5. Revenir sur G2G et cliquer sur **Save**. Le token reste alors masqué côté
   G2G : c'est la copie faite à l'étape 3 qui fait foi.
6. Cocher ensuite l'événement **`order.api_delivery`** et **uniquement celui-là**
   (ne pas cocher « Notification on all events »).

⚠️ Ce token est **différent** de `G2G_SECRET_KEY` (qui signe nos appels
sortants) et de `G2G_USER_ID`. Ne jamais le coller dans un chat, un e-mail ou
un ticket support. Vérification : `npm run g2g:check -- --sign-only` doit
afficher `Webhook token : présent`, et le voyant correspondant passe au vert
dans `/admin/digital`.

La signature entrante est :

```
canonicalString = webhookUrl + userId + timestamp
g2g-signature   = HMAC_SHA256(webhookSecretToken, canonicalString).hexdigest()
```

`webhookUrl` doit être **strictement identique** à la valeur enregistrée chez
G2G (casse, slash final, query string). Notre route accepte aussi la variante
avec `apiKey` insérée, au cas où l'implémentation G2G diffère de l'exemple de
code — dans les deux cas le secret token reste exigé.

La route vérifie **la signature et la fraîcheur du timestamp avant de lire le
corps**, déduplique par `delivery_id` via la table `webhook_events`, journalise
uniquement les identifiants/quantités (jamais de code ni de secret) et envoie
une alerte Telegram admin.

---

## Étape 3bis — Faut-il redéployer sur Vercel ?

**Oui : toute modification d'une variable d'environnement Vercel ne prend
effet qu'au déploiement suivant.** Un simple « Save » dans *Environment
Variables* ne suffit pas. Mais **avant de cliquer sur Redeploy**, vérifie que
les 5 variables obligatoires sont bien créées (sinon tu déploierais deux fois) :

| Variable | Voyant attendu dans Vercel |
| --- | --- |
| `G2G_API_KEY` | présente |
| `G2G_SECRET_KEY` | présente |
| `G2G_USER_ID` | `1003177397` |
| `G2G_WEBHOOK_SECRET_TOKEN` | présente (vient d'être générée) |
| `G2G_WEBHOOK_URL` | `https://nokhba.net.ly/api/webhooks/g2g` |

Points de vigilance :

- Chaque variable doit être attachée à l'environnement **Production** (et
  **Preview** seulement si tu testes aussi sur une URL de preview). Une
  variable créée uniquement en *Development* n'existe pas en production.
- `G2G_API_BASE` est facultative (`https://open-api.g2g.com` par défaut).
- Ne jamais créer une variable avec une valeur vide : Vercel la refuse.
- Ne rien committer : `.env.local` est ignoré par Git ; aucun secret ne doit
  apparaître dans le dépôt.

Ensuite, dans Vercel → **Deployments** → derniers `…` → **Redeploy** (sur le
déploiement de la branche courante), laisse le build se terminer.

En local, la checklist équivalente est :

```bash
npm run g2g:check -- --preflight
```

Elle affiche ✅/❌ pour les 6 variables, sans jamais montrer leur valeur, et
refuse de conclure si `G2G_WEBHOOK_URL` n'est pas en `https` ou ne se termine
pas par `/api/webhooks/g2g`.

Après le déploiement, la vraie vérification se fait sur le site :
**`/admin/digital` → panneau G2G → « Tester la connexion »** : les 5 voyants
doivent être verts et `GET /v2/store` doit afficher le compte vendeur.

#### Contrôles externes (sans aucun secret)

| Contrôle | Résultat attendu | Si ce n'est pas le cas |
| --- | --- | --- |
| `GET /api/health` | `{"ok":true,…}` | site ou base indisponible |
| `GET /api/admin/g2g` **sans session admin** | `401 {"ok":false,"error":"unauthorized"}` | **`404` = le code G2G n'est pas déployé** ; les variables d'environnement seules ne suffisent pas, il faut que le commit soit sur la branche déployée par Vercel |
| `POST /api/admin/g2g/webhook-test` (session admin) | `200` avec `verdict: "accepted"` | lire le `verdict` renvoyé — il nomme la cause exacte (voir ci-dessous) |
| `POST /api/webhooks/g2g` signé | `200 {"ok":true,"dry_run":true,…}` | vérifier `G2G_WEBHOOK_SECRET_TOKEN`, `G2G_WEBHOOK_URL` et l'horloge |

⚠️ `/api/webhooks/g2g` n'accepte **que** les `POST` signés. Ouvert dans un
navigateur — donc en `GET` — il renvoie **405** avec un message
d'explication : c'est **normal**, et c'est même la preuve que la route est
déployée (une route inexistante renverrait 404). Ce n'est donc pas un test
de bon fonctionnement. Pour valider : utiliser le bouton **« Envoyer un
événement de test »** du panneau, ou vérifier `GET /api/admin/g2g` (qui doit
répondre `401`, pas `404`).

### Valider la réception sans attendre G2G

En phase 1, `api_qty = 0` interdit toute commande réelle : **G2G n'émettra
donc jamais d'événement tout seul.** Sans bouton de test, la première
exécution du webhook aurait lieu le jour où un vrai client paie — le pire
moment pour découvrir qu'une signature est refusée.

Le panneau `/admin/digital` → section **« 3 bis. Tester la réception »**
envoie un `order.api_delivery` synthétique, correctement signé, à notre
propre webhook, puis affiche le verdict. Aucun achat, aucune livraison,
aucune modification d'offre ; le `delivery_id` est préfixé `TESTD…` pour être
repérable dans `webhook_events`.

| `verdict` | Signification | Action |
| --- | --- | --- |
| `accepted` | chaîne complète validée | passer à la correspondance d'offre |
| `duplicate` | déjà reçu | relancer pour un nouvel `delivery_id` |
| `bad_signature` | token G2G ≠ `G2G_WEBHOOK_SECRET_TOKEN`, **ou** `G2G_WEBHOOK_URL` différente au caractère près | régénérer le token, le copier **avant** de sauvegarder, le mettre dans Vercel, redéployer |
| `not_configured` | variable absente du déploiement qui répond | ajouter la variable puis **redéployer** |
| `wrong_target` | `G2G_WEBHOOK_URL` ne pointe pas sur `/api/webhooks/g2g` | corriger l'URL (ni slash final, ni paramètre) |
| `db_error` | signature acceptée, base indisponible | vérifier `DATABASE_URL` puis relancer |
| `unreachable` | DNS / TLS / délai dépassé | en preview les variables G2G sont *Production only* : tester depuis la production |
| `rejected` / `unexpected` | refus avant traitement | lire le corps de réponse affiché |

> Un `503` seul ne suffit pas à conclure : `not_configured` (variable
> manquante) et `db_error` (base indisponible) partagent ce statut mais
> n'appellent aucune action commune. D'où le classifieur
> `g2gWebhookTestVerdict()`.

> 🛑 Rappel : redéployer n'active **aucune** livraison automatique. La phase 1
> reste en *shadow mode* et toutes les offres G2G doivent garder
> `api_qty = 0`.

### Dépannage : contour rouge sur le champ « Key » dans Vercel

Dans le formulaire d'ajout d'une variable, un liseré rouge autour de **Key**
signale un problème sur le **nom**, pas sur la valeur. Les points noirs dans
**Value** sont normaux : Vercel masque les secrets (l'icône « œil » les révèle ;
ne jamais partager cette vue). Causes fréquentes :

1. **Doublon (le plus courant)** : `G2G_API_KEY` existe déjà pour le même
   environnement — Vercel refuse de créer deux fois la même clé. C'est une
   bonne nouvelle : fermer le formulaire, retrouver la ligne dans la liste des
   variables et vérifier simplement qu'elle est bien attachée à **Production**.
   Ne pas créer de doublon, ne pas cliquer sur l'icône poubelle.
2. **Caractère invisible** collé avec le nom (espace, guillemet, retour à la
   ligne) : effacer le champ et retaper `G2G_API_KEY` à la main, en majuscules,
   sans espace avant/après.
3. **Mauvais environnement** : une variable créée uniquement en *Development*
   n'existe pas en *Production* ; vérifier les cases d'environnement.

Le libellé exact de l'erreur s'affiche sous le champ ou en bas du formulaire :
le lire avant de réessayer. Aucun secret ne doit apparaître dans une capture
envoyée à un tiers.

---

## Étape 4 — Préparer le mapping des offres

1. **Trouver le SKU exact chez FazerCards** : `/admin/digital` → *Chercheur de
   `card_id`*. Coller le lien/UUID de la catégorie, relever le `card_id`, le
   prix USD, le stock et les quantités min/max.
2. **Créer la correspondance** dans le panneau G2G de `/admin/digital` :
   `offer_id` G2G → `category_id` + `card_id` (ou `game_id` + `key_id`).
3. **Vérifier avant d'activer** :
   - région **Global** ou pays exact (une carte TR ne se vend pas en Global) ;
   - format du code attendu par G2G (`code_label` renvoyé par `GET /v2/offers/{id}`) ;
   - prix de vente **en USD** : le garde-fou refuse toute autre devise (pas de
     conversion implicite) ;
   - marge nette après commission G2G ≥ `min_margin_percent` ;
   - **ne jamais lier un top-up par ID joueur** à une offre G2G qui attend un code.

### Le garde-fou d'activation du SKU

Un `card_id` est **collé à la main**. Une faute de frappe passerait
totalement inaperçue jusqu'à la phase 2, où elle livrerait le mauvais
produit à un client qui a déjà payé. L'activation est donc **fail-closed** :
à l'enregistrement, le serveur liste la catégorie chez FazerCards
(lecture seule, `GET /giftcards/cards`) et refuse d'activer tant que le
SKU n'est pas prouvé présent.

| Situation | Statut | Comportement |
| --- | --- | --- |
| `card_id` trouvé | `verified` | activable ; le nom et le prix réels sont mémorisés |
| `card_id` absent de la catégorie | `not_found` | **400 — activation refusée** |
| FazerCards injoignable ou non configuré | `unavailable` | **503 — activation refusée** (réessayer) |
| identifiants incomplets | `missing_ids` | activation refusée (`incomplete_mapping`) |

Dans tous les cas, l'enregistrement **désactivé** reste autorisé : une panne
FazerCards ne doit pas bloquer la saisie. Le panneau affiche alors
« ⚠️ SKU non vérifié », et « ✓ *nom réel* · *prix* » une fois la preuve
obtenue.

> `unavailable` et `not_found` sont délibérément distincts : « FazerCards est
> injoignable » et « ce `card_id` n'existe pas » n'appellent pas du tout la
> même action, même si les deux empêchent l'activation.

Les mappings sont stockés dans `g2g_offer_mappings`, **`enabled = false` par
défaut**, et l'API admin refuse d'activer une ligne sans `category_id` et
`supplier_sku_id`.

---

## Étape 5 — Valider en « shadow mode » (phase 1)

> 🛑 **Tant que la phase 2 n'est pas déployée, laisser `api_qty = 0` sur
> TOUTES les offres G2G.** Une offre avec `api_qty > 0` est achetable : un
> client paierait une commande que notre système ne livre pas encore. Les
> ventes actuelles en inventaire pré-chargé manuel peuvent continuer
> normalement.

Séquence de test recommandée :

1. `npm run g2g:check` → `code = 20000001`, `seller_status = active`.
2. `/admin/digital` → tous les voyants de secrets au vert, compte vendeur
   affiché, URL du webhook copiée.
3. Déclarer le webhook chez G2G avec `order.api_delivery`.
4. `/admin/digital` → **« Envoyer un événement de test »** → `verdict:
   "accepted"`, une ligne `TESTD…` dans `webhook_events` (`provider = g2g`)
   et une alerte Telegram. (Inutile d'attendre un événement réel : avec
   `api_qty = 0`, G2G n'en émettra aucun.)
5. Vérifier qu'une **signature falsifiée** est rejetée en `401`.

---

## Phase 2 (à construire, sur validation explicite)

### État : répétition générale (aucun achat câblé)

Le moteur de décision est en place et s'exécute sur chaque
`order.api_delivery` : il calcule la décision qu'il **prendrait**, la
consigne dans `g2g_deliveries` et l'annonce dans les logs et sur
Telegram. **Il n'achète rien.** L'achat fournisseur et la livraison ne
sont pas encore câblés.

Deux variables gouvernent tout :

| Variable | Rôle |
| --- | --- |
| `G2G_AUTO_DELIVERY` | coupe-circuit : doit valoir exactement `1`. Sinon, aucun achat n'est possible, même avec une correspondance activée. |
| `G2G_FEE_PERCENT` | commission G2G + frais de retrait, en %. **Aucun défaut** : sans elle, la décision est toujours un refus. |

Cette exigence est volontaire. Une commission sous-évaluée ou « devinée »
ferait acheter à perte de façon automatique et silencieuse.

### Les décisions possibles

| Décision | Signification |
| --- | --- |
| `proceed` | marge démontrée → achat autorisé (rien n'est encore acheté) |
| `mapping_disabled` | correspondance non activée |
| `offer_unreadable` | l'offre G2G n'a pas pu être relue à l'instant de l'événement |
| `kill_switch_off` | `G2G_AUTO_DELIVERY` absent |
| `fee_not_configured` | commission G2G non déclarée |
| `missing_price` | prix de vente illisible |
| `topup_forbidden` | l'offre attend un rechargement par ID joueur, jamais un code |
| `code_label_missing` | G2G n'indique pas le format de code attendu |
| `cost_unknown` | coût fournisseur inconnu (SKU jamais vérifié) — jamais assimilé à 0 |
| `currency_mismatch` | offre non libellée en USD |
| `quantity_invalid` | quantité hors bornes (1 à 100) |
| `cap_exceeded` | coût total supérieur au plafond du mapping |
| `margin_too_low` | marge nette insuffisante |

Tout est `fail-closed` : dans le doute, on ne dépense pas. Un achat
engagé par erreur est irréversible, alors qu'une commande non honorée se
traite à la main.

### Comment répéter sans risque

1. Renseigner **`G2G_FEE_PERCENT`** dans Vercel (Environment Variables),
   puis redéployer. **Ne pas** renseigner `G2G_AUTO_DELIVERY`.
2. `/admin/digital` → **« Envoyer un événement de test »**.
3. Lire `decision` (ce qui se passe réellement) et
   `hypothetical_decision` (ce qui se passerait une fois activé).

Les deux réponses à connaître :

- **`fee_not_configured`** — la commission n'est pas encore déclarée.
  Tant qu'elle manque, aucune marge n'est calculable : c'est le seul
  réglage à faire pour que la répétition devienne instructive.
- **`kill_switch_off`** — comportement normal et souhaité. La décision
  hypothétique, elle, est déjà significative : elle dit ce qui se
  passerait une fois l'automation activée.

Le coupe-circuit ne masque **pas** les autres motifs : une offre non
rentable annonce `margin_too_low`, pas `kill_switch_off`. C'est
volontaire — pendant la répétition, on veut voir la vraie raison.

| Réglage | Pendant la répétition |
| --- | --- |
| `G2G_FEE_PERCENT` | **à renseigner** (information, aucune dépense) |
| `G2G_AUTO_DELIVERY` | **à laisser vide** (c'est la sécurité) |

### État des briques

| Brique | État |
| --- | --- |
| Achat JIT | ✅ déployé (PR #207) |
| File de livraison | ✅ déployé (PR #209) |
| Pilotage single-offer | ✅ déployé (PR #210) — attend activation (`api_qty = 1`, `G2G_AUTO_DELIVERY = 1`) |
| Stock & prix (cron) | ✅ construit (brique 4) — attend activation du cron sur Vercel |
| Garde-fous | 🟡 partiel (coupe-circuit, alertes, interdiction top-up en place) |

### Activation de l'automation (brique 3)

Les deux briques techniques sont déployées. Pour passer en vente réelle sur **une seule offre** :

1. Le mapping `G1793906316865GE` doit exister et être `enabled = true` dans `g2g_offer_mappings` (via `/admin/digital` → panneau G2G).
2. `G2G_FEE_PERCENT` doit être renseigné dans les variables Vercel (déjà fait).
3. `G2G_AUTO_DELIVERY` doit valoir exactement `"1"` dans les variables Vercel (c'est le coupe-circuit : sans lui, aucun achat n'est possible).
4. `api_qty = 1` doit être posé sur l'offre chez G2G (via l'endpoint admin `PATCH /api/admin/g2g/offer-qty` ou directement sur g2g.com).

Tant que cette validation single-offer n'est pas concluante, `api_qty` reste à **0** sur toutes les autres offres.

### Briques restantes

| Brique | Description |
| --- | --- |
| Achat JIT | `order.api_delivery` → lire l'offre G2G (`unit_price`, `currency`, `code_label`) → contrôle de marge et de plafond → achat FazerCards avec `Idempotency-Key = g2g-<delivery_id>` |
| File de livraison | récupérer les codes (parfois asynchrones) via une file à retries, comme `delivery_jobs` — jamais dans le temps de vie d'un seul webhook serverless |
| Livraison | `POST /v2/orders/{order_id}/delivery` avec `{ delivery_id, codes: [{ content, content_type: "text/plain", reference_id }] }` |
| Stock & prix | cron qui aligne `api_qty` sur le stock FazerCards **et** le solde disponible, et coupe l'offre (`api_qty = 0`) si la marge passe sous le seuil |
| Garde-fous | kill-switch explicite, alerte Telegram sur tout échec, interdiction des top-ups par ID joueur sur offres « code » |

---

## Fichiers concernés

| Fichier | Rôle |
| --- | --- |
| `src/lib/g2g-core.ts` | Noyau pur : signatures HMAC, timestamp, décodage d'événement, marge |
| `src/lib/g2g.ts` | Client serveur signé (`/v2/store`, offres, livraison) |
| `src/app/api/admin/g2g/route.ts` | Diagnostic admin + CRUD des mappings (aucun secret renvoyé) |
| `src/app/admin/(panel)/digital/g2g-panel.tsx` | Panneau `/admin/digital` |
| `src/app/api/webhooks/g2g/route.ts` | Réception signée, idempotente, en shadow mode |
| `src/db/schema.ts`, `src/db/index.ts` | Table `g2g_offer_mappings` (créée automatiquement) |
| `scripts/g2g-check.mjs`, `scripts/g2g-core.test.mjs` | Vérification locale + tests |
| `.env.example` | Liste commentée des variables `G2G_*` |

Références : [Authentication Intro](https://docs.g2g.com/authentication-intro-1237152m0) ·
[Setup API Key](https://docs.g2g.com/setup-api-key-1237153m0) ·
[Setup Webhooks](https://docs.g2g.com/setup-webhooks-1237166m0) ·
[Message Signature](https://docs.g2g.com/message-signature-1237168m0) ·
[order.api_delivery](https://docs.g2g.com/order-api-delivery-18583502e0) ·
[Deliver Code](https://docs.g2g.com/deliver-code-18583491e0) ·
[Create/Update Offer](https://docs.g2g.com/create-offer-18583484e0)

## Sécurité stock pendant le pilote

Configurer `G2G_PILOT_OFFER_ID` avec l'identifiant de l'unique offre pilote
(par exemple `G1795076410074VF`) avant toute activation manuelle. Sans cette
configuration, aucune activation depuis l'admin n'est possible. La quantité
manuelle est limitée à 0 ou 1 ; 0 reste possible pour toute offre.

Le cron ne réactive jamais une offre : il ferme les mappings actifs non désignés,
ferme le pilote si son évaluation échoue et ferme le pilote si son stock dépasse 1.
Il ne traite pas les mappings désactivés. Avant activation et lors de tout
changement de pilote, vérifier et mettre à 0 **toutes les autres offres** chez
G2G, y compris celles sans mapping. Une modification directe sur G2G contourne
ces protections ; elles ne garantissent pas l'état global du compte ni une
fermeture si l'API G2G échoue. Vérifier le résultat et les logs. Le cron reste
quotidien : il ne remplace pas une surveillance en temps réel.

### Sécurisation en cours — vente désactivée

Le format réel des codes FazerCards n'est pas encore vérifié : aucune extraction
par heuristique ne doit être envoyée à G2G. Les commandes déjà achetées sont
orientées vers une intervention manuelle et une alerte, sans livraison
automatique. L'activation `api_qty > 0` par l'admin et l'achat depuis le webhook
sont bloqués dans cette version, même si le coupe-circuit est armé. Maintenir
`G2G_AUTO_DELIVERY` désarmé et tous les stocks à 0 sur G2G : un changement
manuel sur G2G contourne l'admin et pourrait laisser une commande payée sans
livraison. Ne pas relancer un achat au résultat incertain sans rapprochement
manuel. Une préparation locale de clé d'idempotence ne permet pas de reprendre automatiquement un achat ambigu et ne couvre pas les achats historiques.

Cette version n'est pas une livraison automatisée opérationnelle. Avant le
pilote il faut valider le contrat réel des codes, sécuriser les reprises et
l'idempotence, et effectuer des tests d'intégration sans dépenses.

Les nouveaux événements sont réservés et inscrits dans le journal de livraison
dans une transaction. Si le traitement s'interrompt, une ligne `planned`
ancienne est signalée pour rapprochement manuel après dix minutes ; aucun
réachat automatique n'est tenté. Les alertes Telegram sont au mieux : si
Telegram est indisponible, consulter les échecs dans le panneau admin. Les
événements historiques déjà réservés sans ligne de livraison ne sont pas
récupérés automatiquement par ce mécanisme.
