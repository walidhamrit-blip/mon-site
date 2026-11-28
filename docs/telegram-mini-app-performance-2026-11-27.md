# Mini App `/tg` — identité Nokhba et performances mesurées

Date : 27 novembre 2026. **Preview uniquement ; aucune fusion ni publication en production pour cette intervention.**

## 1. Résultat visuel

- Bleu nuit `#0b1020` sur toute l’application ; surfaces `#151f36`, recherche et éléments surélevés `#1c2944`.
- Accents violets lisibles `#b29aff`, filtres actifs violets, prix et actions importantes citron `#d8fc52`.
- En-tête, accueil, catégories, marques, régions, cartes produits, recherche, états vides et chargement cohérents.
- Le bleu nuit devient le défaut **sans choix enregistré** conformément à la nouvelle demande. Un choix clair explicite existant n’est pas effacé. Le sélecteur, CloudStorage et le repli localStorage restent fonctionnels.
- Navigation arabe RTL et anglaise LTR conservée ; 12 parcours testés (320/360/390 px × AR/EN × clair/sombre).

Captures du **catalogue synthétique de test**, pas de produits/prix ajoutés au catalogue réel : [accueil](benchmarks/telegram-2026-11-27/fixture-home-dark.png), [régions et produits en RTL](benchmarks/telegram-2026-11-27/fixture-regions-rtl.png).

## 2. Mesures avant / après — ce qui est réellement établi

L’instrumentation a été ajoutée et la référence mesurée **avant les optimisations**, au commit `4a1b7dc`. Version applicative finale mesurée : `09d355d`.

### A. Ouverture de la vraie route `/tg`, build Next.js de production local

Chromium, écran 360 × 740, DPR 2, CPU ralenti ×4, latence réseau 100 ms, téléchargement 200 000 octets/s, upload 93 750 octets/s. Cache navigateur désactivé. 7 navigations indépendantes ; médiane des 6 après la première, moyenne des deux valeurs centrales pour un effectif pair. Même machine et mêmes conditions. La première navigation **n’est pas assimilée à un cold start Vercel**.

**Limites : pas de `DATABASE_URL` locale ; catalogue de repli/caché sans produits sur ces ouvertures. SDK Telegram remplacé par un double fixe. Ce sont des résultats de laboratoire, pas des chiffres du bot ou du catalogue de production.**

| Indicateur | Avant | Après | Conclusion locale |
|---|---:|---:|---|
| Hydratation de la Mini App, depuis le début de navigation | 3 833 ms | 1 896 ms | −50,5 % |
| JavaScript transféré (`transferSize`, en-têtes inclus) | 367 890 octets | 159 989 octets | −56,5 % |
| HTML **rendu**, sérialisation du DOM (pas octets réseau) | 115 779 octets | 12 789 octets | −89,0 % |
| LCP observé, contenu local de repli | 834 ms | 602 ms | −27,8 % ; à refaire avec catalogue réel |
| TTFB navigateur, incluant le réseau bridé | 103,15 ms | 103,25 ms | Stable ; aucun gain revendiqué |
| Étape `catalog_load`, lecture du repli/cache local | 2,9 ms | 1,9 ms | Trop courte et sans base : pas de gain DB revendiqué |

**Goulot identifié :** `/tg` recevait le contenu éditorial et les providers de l’agence (thème du site, traduction globale, devise, animations), alors qu’elle ne les utilise pas. Ils entraînaient aussi le chargement des styles et de polices inutiles. Le retrait du seul JSX n’a pas suffi : un essai intermédiaire transférait encore environ 369 Ko de JS. Un point de découpage **client**, puis l’isolation effective des CSS et des deux seuls sous-ensembles Cairo nécessaires, ont produit les gains finaux. Les essais intermédiaires non concluants ne sont pas présentés comme des améliorations.

Le site principal garde le même arbre de providers, ses données et ses styles ; seul leur chargement est différé hors de `/tg`. Le signal interne utilisé par le layout est effacé puis recalculé par le proxy : un visiteur ne peut pas obtenir le document Telegram sur une page du site en forgeant cet en-tête.

### B. Images — vrai composant et `next/image`, catalogue de test fixe

26 produits synthétiques, 4 catégories, mêmes images locales et mêmes conditions réseau/CPU. Pas de base ni de requête Telegram. Optimiseur Next local, cache navigateur désactivé, première navigation exclue. Le composant/CSS de référence est chargé depuis `4a1b7dc`, sans changer de branche.

| Indicateur | Avant | Après |
|---|---:|---:|
| Images de catégories visibles effectivement chargées (`complete` et `naturalWidth > 0`), depuis navigation | 1 391 ms | 633 ms |
| Jaquettes produits préchargées sur l’accueil | 6 | 0 |

**Correction :** les images des catégories visibles passent avant les jaquettes sous la ligne de flottaison. Les autres images restent disponibles et chargées à la demande ; aucun produit n’est supprimé. Dans une catégorie, les deux premières jaquettes peuvent être prioritaires. Les attributs `sizes` correspondent maintenant à la vraie grille 2/3 colonnes et au cas d’un produit unique, au lieu d’annoncer systématiquement 33 vw sur petit écran.

Les JSON contiennent aussi le trafic observé jusqu’à « catégories prêtes + 400 ms ». Cette fenêtre se termine plus tôt après optimisation : ces octets **ne représentent pas une économie de bande passante totale**. Aucun gain total d’images sur l’intégralité d’une session n’est revendiqué.

### C. Webhook et callbacks — vrai handler, entrées/sorties simulées

Scénario `menu:orders`, authentifié, sans envoi réel. Délais fixes : résolution du secret 20 ms, ACK Telegram 120 ms, configuration 100 ms, lecture abonné 80 ms, édition du message 100 ms. 21 exécutions, première exclue.

| Indicateur | Avant | Après |
|---|---:|---:|
| Durée totale du handler webhook, médiane | 422,49 ms | 241,65 ms |
| Durée totale du handler, p95 (nearest rank, 20 observations) | 423,26 ms | 242,46 ms |
| Round trip d’acquittement simulé | 120 ms | 120 ms |

**Goulot identifié :** ACK → configuration → abonné formaient une chaîne séquentielle malgré leur indépendance. L’ACK est toujours lancé en premier, mais ces trois opérations sont maintenant attendues en parallèle. Le dispatch attend leur résolution ; aucune tâche métier n’est abandonnée après un `200`, aucun paiement n’est modifié. Les lectures indépendantes de configuration/abonné des messages sont aussi parallélisées, sans gain chiffré revendiqué pour ce chemin non benchmarké.

**Ces chiffres ne prouvent pas que votre bot réel répond en 242 ms.** Ils valident la réduction du chemin critique du handler avec des I/O contrôlées. Aucune baisse de latence de l’API Telegram ou de PostgreSQL n’a été mesurée.

## 3. Instrumentation livrée pour vérifier le système réel

### Serveur

- En-tête `Server-Timing` sur les réponses POST du webhook : `webhook_total`, `callback_total`, `callback_ack`, `auth_secret`, configuration, abonné et appels réseau Telegram.
- Traces structurées `source: "telegram.performance"` dans les logs Preview, ou avec `TELEGRAM_PERF_LOG=1` sur un environnement autorisé.
- Catalogue : résolution globale, initialisation/seed, lectures produits et dénominations ; configuration : schéma et requête settings. Les durées DB sont des durées d’opérations côté application, **pas des plans SQL ni des temps CPU PostgreSQL**.
- `/tg` expose les étapes serveur `site_settings`, `catalog_load`, `page_data` dans une méta `nokhba-tg-server-timing`. Les lectures sous-jacentes n’apparaissent que lorsqu’elles sont exécutées, pas lors d’un hit du cache partagé.
- Les spans peuvent s’imbriquer ou se chevaucher : ne pas additionner leurs durées pour reconstruire le total.
- Aucun chat ID, e-mail, corps de message, SQL, token ou URL Bot API n’est ajouté à ces traces. Maximum 100 spans par trace ; erreurs observées sans sérialiser leur contenu. Pas de nouvelle table.

### Navigateur / Android

Ouvrir `/tg?lang=ar&perf=1` ou `/tg?lang=en&perf=1`, puis dans DevTools (ou le débogage distant Android) :

```js
window.nokhbaTgPerformance()
// Dans Chromium DevTools, pour conserver l’observation :
copy(JSON.stringify(window.nokhbaTgPerformance(), null, 2))
```

La fonction restitue TTFB, DNS, connexion, téléchargement, FCP/LCP si supportés, tâches longues, hydratation, appel `Telegram.ready()`, ressources et images les plus lentes, octets et étapes serveur. Les requêtes optimisées d’images publiques locales sont identifiables sans recopier des URL signées. Aucun beacon ni envoi vers un service externe n’est ajouté. L’absence de `transferSize` peut être due au cache **ou** aux restrictions cross-origin ; ce n’est pas une preuve de hit.

Le moment `Telegram.ready()` n’est pas le temps écoulé depuis le tap du bouton dans le client Telegram : ce délai antérieur au début de navigation n’est pas accessible à la page.

### Ce qui reste à mesurer sur l’environnement réel

1. Activer Supabase dans la conversation avant tout accès à cette application ; elle est actuellement désactivée. Le workspace n’a pas de `DATABASE_URL`, et l’accès réseau du sandbox est restreint. Aucun secret n’a été extrait ni copié.
2. Utiliser la Preview et, pour les POST réellement fonctionnels, un **bot de staging distinct** et des chats de test autorisés. Ne pas déplacer le webhook du bot de production ni envoyer de callbacks de test via son token.
3. Recueillir au moins 30 ouvertures et 30 callbacks par scénario (menu, catégories, marques/régions), distinguer cache chaud, cache expiré et vrai démarrage à froid ; calculer p50/p95 par groupe avant/après.
4. Comparer les spans `db_*`, `catalog_*` et `network_*` pour déterminer s’il faut agir ensuite sur la base, le fournisseur ou la région d’exécution. Pas de modification de pool, d’index ni de durée de cache sans ces données.
5. Valider dans Telegram sur un **appareil Android réel**, avec son réseau. Les tests livrés sont en émulation Chromium, pas une certification d’appareil réel.

Le hint CDN préexistant n’est pas présenté comme une accélération : le rendu `force-dynamic` peut le supplanter. Les règles existantes de fraîcheur du catalogue et le recalcul des prix au paiement sont inchangés.

## 4. Reproduction et données brutes

Build et serveur local :

```sh
npm ci
npx playwright install chromium
npm run build
TELEGRAM_PERF_LOG=1 npm start -- --hostname 0.0.0.0 --port 3950
```

Dans un autre terminal :

```sh
node scripts/telegram-performance.browser.cjs sample
node scripts/telegram-performance.webhook.cjs baseline 4a1b7dc
node scripts/telegram-performance.webhook.cjs sample
node scripts/telegram-performance.images.cjs baseline 4a1b7dc
TG_PERF_VERIFY=1 node scripts/telegram-performance.images.cjs sample
TG_THEME_TEST_URL=http://localhost:3950 node scripts/telegram-mini-app-theme.browser.cjs
node scripts/telegram-shell.browser.cjs
```

Les commandes webhook/images peuvent reconstruire la référence via `git show`, sans checkout ni changement de branche. Pour refaire **le build Next complet de référence**, utiliser une copie temporaire du commit `4a1b7dc` (par exemple `git archive`), les mêmes versions Node/Next et le même serveur/port après arrêt du serveur courant. Ne pas comparer un serveur dev à un build de production.

Variables optionnelles : `CHROMIUM_EXECUTABLE_PATH`, `CHROMIUM_ARGS` (tableau JSON), `TG_PERF_URL`, `TG_PERF_RUNS`. Le benchmark navigateur n’accepte une URL distante qu’avec `TG_PERF_ALLOW_REMOTE=1` explicite. Les sorties de travail vont dans `.scratch/telegram-performance/`, exclu de Git et d’ESLint. Le benchmark esbuild est explicitement déclaré à la version déjà présente dans le lockfile (`0.25.12`), sans mettre à jour les dépendances applicatives.

Données conservées : [avant navigateur](benchmarks/telegram-2026-11-27/baseline.browser.json), [après navigateur](benchmarks/telegram-2026-11-27/final.browser.json), [avant webhook](benchmarks/telegram-2026-11-27/baseline.webhook.json), [après webhook](benchmarks/telegram-2026-11-27/final.webhook.json), [avant images](benchmarks/telegram-2026-11-27/baseline.images.json), [après images](benchmarks/telegram-2026-11-27/final.images.json).

## 5. Non-régression et livraison

- Build Next.js et TypeScript : OK.
- ESLint : 0 erreur ; 1 avertissement préexistant dans `cta-form.tsx` (React Hook Form).
- Suite complète : **1 361 tests réussis** ; sous-suite Telegram : 125 tests.
- Tests navigateur : choix persisté, SDK tardif, réponse CloudStorage obsolète ignorée ; 320/360/390 px ; AR/EN et deux thèmes ; catégories/marques/régions/recherche/états vides ; absence de débordement et d’erreur d’hydratation.
- Vérification de `/`, `/codes` et `/tg`, styles/SSR/providers et nettoyage de l’en-tête interne, sans action d’achat.
- Aucun changement des montants, des liens produits, du checkout, de la création des commandes ou des passerelles.
- Travail sur la branche isolée imposée par Arena `arena/8d56dc50-mon-site` ; la session ne permet pas d’en créer/changer. Nouvelle PR : **#303**, non fusionnée.
- Preview : https://mon-site-git-arena-8d56dc50-mon-site-walid-website.vercel.app/tg
