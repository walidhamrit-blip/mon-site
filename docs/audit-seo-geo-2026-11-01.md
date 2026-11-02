# Audit SEO, GEO et référencement local — 1er novembre 2026

- **Site :** https://nokhba.net.ly/
- **Projet :** Nukhba / Nokhba — نخبة, création de sites et boutique de produits numériques
- **Code examiné :** branche `arena/861ed63e-mon-site`, base `c942c2f`
- **Nature de la mission :** audit et recommandations ; aucune modification du code applicatif, du DNS, de la production ou de Search Console.

> **Conclusion : le socle technique est fonctionnel, mais les contenus ne sont pas encore suffisamment cohérents pour un bon SEO/GEO.** Le sitemap public existe. Les priorités sont les variantes produits, les informations commerciales contradictoires, la cohérence de l’entité et la mesure réelle de l’indexation — pas l’ajout de nouveaux robots ou de nouveaux schémas.
>
> Pour configurer le sitemap dans Google Search Console : **[guide pas à pas adapté à ce site](./guide-gsc-sitemap-2026-11-01.md)**.

## Sommaire

1. [Périmètre et niveau de preuve](#1-périmètre-et-niveau-de-preuve)
2. [Résultats des contrôles](#2-résultats-des-contrôles)
3. [Priorités](#3-priorités)
4. [SEO technique et sitemap](#4-seo-technique-et-sitemap)
5. [Produits, contenu et intentions de recherche](#5-produits-contenu-et-intentions-de-recherche)
6. [Données structurées](#6-données-structurées)
7. [GEO : visibilité dans les réponses génératives](#7-geo--visibilité-dans-les-réponses-génératives)
8. [Référencement local et international](#8-référencement-local-et-international)
9. [Performance et expérience mobile](#9-performance-et-expérience-mobile)
10. [Autorité, liens et confiance](#10-autorité-liens-et-confiance)
11. [Plan d’action et critères de recette](#11-plan-daction-et-critères-de-recette)
12. [Mesure et informations restant à obtenir](#12-mesure-et-informations-restant-à-obtenir)

## 1. Périmètre et niveau de preuve

Dans ce document :

- **Public confirmé** : contenu effectivement récupéré sur le domaine publié le jour de l’audit.
- **Local confirmé** : résultat obtenu sur un build de production local, **sans base de données ni catalogue fournisseur**.
- **Code confirmé** : comportement présent dans les fichiers examinés, pas nécessairement déclenché en production pendant l’audit.
- **À vérifier** : point nécessitant un accès ou une mesure non disponibles.

### Ce qui a été examiné

- Routage Next.js, métadonnées, canoniques, directives robots, sitemap, erreurs et redirections.
- Pages publiques, catalogue, fiches produits, services, secteurs, blog et comparatifs.
- JSON-LD, flux `llms.txt`, automatisations d’indexation et suivi des citations IA.
- Sources de langue, coordonnées, prix, éléments de confiance, images et architecture du catalogue.
- **19 URL/ressources publiques consultées** : accueil, `/codes`, deux variantes Free Fire, une carte Steam, création de sites, tarifs, contact, applications, produits à venir, deux articles, un comparatif, une réalisation, robots, sitemap, les deux flux IA et le fichier de vérification Google. Plusieurs ressources longues ont été lues par extraits ; ce n’est pas un crawl exhaustif des fiches de production.
- Installation des dépendances, tests automatisés, build, TypeScript, deux scripts d’audit et exploration locale des **63 URL du sitemap de repli**, plus routes de contrôle.

### Ce que cet audit ne permet pas d’affirmer

- Aucun accès aux rapports privés Google Search Console : nombre de pages indexées, impressions, clics, canonique choisie par Google, actions manuelles et statistiques de crawl **inconnus**.
- Aucun relevé CrUX, PageSpeed Insights ou Lighthouse de production effectué ; les Core Web Vitals réels ne sont pas mesurés ici.
- Aucun inventaire exhaustif des backlinks, aucun classement concurrentiel ni volume de recherche mesuré.
- Aucun appel payant à un moteur génératif ; aucune citation réelle de la marque n’est démontrée par cet audit.
- Le connecteur Vercel a renvoyé une liste de projets vide et un refus d’accès aux équipes. Configuration des domaines, protections d’aperçu, logs et variables de production non vérifiés.
- La récupération publique fournit une extraction de contenu, pas un dump complet des en-têtes HTTP. Les statuts, types MIME et redirections indiqués comme **locaux** ne doivent pas être confondus avec des mesures HTTP de production.

**Il n’est donc pas justifié d’attribuer un score global de référencement de type « 99/100 ».** Un score de complétude du code ne mesure ni le classement, ni l’autorité, ni les citations IA.

## 2. Résultats des contrôles

| Contrôle | Résultat | Portée |
|---|---|---|
| `npm ci --no-audit --no-fund` | Réussi, lockfile conservé | Local |
| `npm run test:seo` | **181 tests réussis, 0 échec** après installation | Local, tests du dépôt |
| `DATABASE_URL='' npm run build` | Réussi | Local, contenu de repli |
| `npm run typecheck` | Réussi | Local |
| `npm run seo:check` | **0 erreur, 2 avertissements**, 74 validations de pages/ressources annoncées par le script | Local |
| `npm run audit:catalog` | **8 fiches publiques contrôlées sur 8**, conforme aux règles du script | Catalogue local de repli |
| Exploration complémentaire du sitemap | **63 URL distinctes, toutes HTTP 200, un H1 chacune, pas de title dupliqué** | Local uniquement |
| XML du sitemap | `application/xml`, namespace sitemap correct, 11 872 octets, 16 `lastmod`, 29 références d’images | Local uniquement |
| `/robots.txt` public | Accessible ; annonce le bon sitemap ; contenu public autorisé | Public confirmé |
| `/sitemap.xml` public | Accessible ; présence de fiches `fzr-topup-*`, `fzr-giftcard-*` et de pages institutionnelles | Public confirmé par extraits |
| Catalogue public | **788 produits affichés** : 293 recharges, 121 cartes cadeaux, 374 codes logiciels | Observation ponctuelle de `/codes` |
| Fichier Google historique | Accessible avec son contenu de vérification | Public confirmé ; ne prouve pas l’accès GSC de ton compte |

Les deux avertissements du script concernent `/codes/spotify-premium` et `/codes/nvidia-redeem`, comptés respectivement à 389 et 397 mots par son extracteur. **Le seuil interne de 400 mots n’est pas une exigence Google.** Il faut ajouter de l’information utile, pas du remplissage.

Le nombre **63** décrit l’environnement local sans base. Le nombre **788** décrit l’affichage du catalogue publié à cet instant. Aucun de ces nombres n’est le nombre de pages indexées par Google. Le total exact des URL du sitemap de production reste à relever sur son XML brut ; ne pas réutiliser l’ancien objectif fixe « environ 450 ».

## 3. Priorités

**P1 :** à traiter en premier, cette semaine. **P2 :** chantier important dans le mois. **P3 :** amélioration de cohérence ou de maintenance. Il ne s’agit pas d’une affirmation de pénalité Google.

| ID | Priorité | Constat | Preuve | Action / critère de réussite |
|---|---|---|---|---|
| A01 | P1 | Deux variantes Free Fire ont exactement le même title et H1 | Public + code | Inclure la région/compatibilité utile ; aucune collision sur les variantes destinées à être indexées |
| A02 | P1 | Région, livraison par e-mail et recharge directe se contredisent | Public | Valider la compatibilité fournisseur ; texte adapté à chaque nature de produit |
| A03 | P1 | Prix statiques des articles/comparatifs différents des prix actuels | Public | Une source tarifaire ou une datation historique explicite, frais de personnalisation inclus/clarifiés |
| A04 | P1 | Le flux IA décrit encore l’anglais comme langue principale et nie l’activité de revente logicielle | Public + code | Aligner toutes les descriptions de l’entité sur les deux activités réelles |
| A05 | P1 | En cas de perte de toutes les sources du catalogue, une fiche connue peut devenir une 404 | Chemin de code, pas panne observée | Conserver un dernier catalogue valide ; distinguer indisponibilité temporaire et suppression réelle |
| A06 | P1 mesure | Le « taux de citation IA » compte de simples mentions et accepte des faux positifs | Tests de fonctions + code | Séparer mention, citation d’URL vérifiée et visite/conversion |
| A07 | P2 | Catalogue très plat, sans pagination serveur ni véritables pages de catégories SEO | Code + catalogue public | Pages de catégories utiles, pagination accessible par liens, sans casser la découverte des fiches |
| A08 | P2 | Pas de version anglaise à URL propre | Code | Si l’international est prioritaire : vraies routes EN et `hreflang` réciproques |
| A09 | P2 | Horaires divergents : 22 h, 18 h et 23 h selon la source | Public + code | Un horaire structuré unique, rendu AR/EN et JSON-LD concordants |
| A10 | P2 | `AggregateOffer` représente les montants/options d’un même vendeur | Code | Revoir les offres et variantes ; tester l’éligibilité snippets séparément des fiches marchand |
| A11 | P2 | Chiffres de confiance et promesses sans preuve auditée ; réalisation avec texte de remplissage | Public | Justifier les chiffres, documenter les cas clients, remplacer les placeholders |
| A12 | P2 | Badges à ancres optimisées et stratégie dofollow systématique | Code et documentation | Crédit volontaire, ancre de marque ; qualification adaptée si lien commercial |
| A13 | P2 | Démo HTML secondaire indexable, sans canonical | Local + fichier public du dépôt | Si simple aperçu : `noindex` lisible par les robots, hors sitemap |
| A14 | P2 / P3 | Score admin et documents anciens surévaluent certains bénéfices ; détails JSON-LD à harmoniser | Code et docs | Corriger les règles de contrôle et distinguer schéma valide, éligibilité et résultat réel |

**Contrôles de publication prioritaires mais non tranchés :** propriété GSC, sitemap soumis et lu, redirections HTTP/HTTPS et www, protection des previews, couverture indexée et performance mobile. Leur absence de mesure n’est pas une preuve de défaillance.

## 4. SEO technique et sitemap

### 4.1 Points déjà bien construits

- Métadonnées centralisées dans `src/lib/seo.ts` : title, description, canonical, Open Graph et Twitter.
- Origine publique centralisée dans `src/lib/site-identity.ts`, avec surcharge admin/environnement.
- HTML initial et métadonnées alignés sur l’arabe pour le marché libyen.
- Liens de découverte vers le catalogue et des produits présents dans le rendu serveur de l’accueil.
- Sitemap dynamique (`src/app/sitemap.ts:24`), sans dépendance au catalogue fournisseur lors du build.
- Exclusion du sitemap des pages d’administration, paiement et suivi de commande.
- `noindex` explicite sur les pages de paiement/suivi et la connexion admin, confirmé localement.
- Images des réalisations présentes dans le sitemap local ; URL canoniques HTTPS.
- Anciens slugs d’articles et alias métiers redirigés. Next.js émet ici des **308 permanentes**, pas littéralement des 301 ; les deux sont utilisables pour une redirection permanente.

### 4.2 Le sitemap existe : il faut le déclarer, pas le recréer

**URL à envoyer à GSC :**

```text
https://nokhba.net.ly/sitemap.xml
```

**Déclaration effectivement vue dans le robots public :**

```text
Sitemap: https://nokhba.net.ly/sitemap.xml
```

Le générateur inclut 16 routes principales, les secteurs, services, articles, réalisations, comparatifs et produits publics sélectionnés. Les produits sont retenus si leur statut est `available` **ou** s’ils ont un prix disponible ; les brouillons/archives sont écartés en amont par la lecture publique. En mode de panne détectée, les produits sont retirés du sitemap.

À contrôler avec les données réelles :

1. Chaque URL soumise répond 200, décrit une vraie page, est indexable et porte sa propre canonical.
2. Le statut `available` doit correspondre à une fiche réellement exploitable ; un statut seul ne garantit pas un montant disponible.
3. Un produit avec un prix mais encore « coming soon » ne mérite pas automatiquement une priorité de crawl. Décider selon l’utilité réelle de la page.
4. Ne pas inclure de filtres, paramètres de suivi, anciennes redirections, commandes ou URL d’aperçu.
5. Ne pas inventer des dates de mise à jour. Les dates de capture d’image ne sont pas nécessairement les dates de modification significative de la page.
6. Suivre la stabilité du nombre d’URL et les différences avec le catalogue éligible, plutôt qu’une cible historique fixe.

Google ignore `priority` et `changefreq`. `lastmod` est utile lorsqu’il est fiable. Une limite de 50 000 URL ou 50 Mo non compressés s’applique par sitemap : le volume actuellement affiché ne justifie pas à lui seul un découpage. Un index par familles peut être utile pour le suivi, mais n’est pas nécessaire à la soumission initiale. [1](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

### 4.3 Disponibilité du catalogue : le risque résiduel important

Le chemin `getLiveCatalog()` → repli base → repli codé en dur existe dans `src/lib/digital-store.ts:365-427`. Si le fournisseur/copie persistée et la base sont tous indisponibles, un slug fournisseur connu peut être absent du repli. `getDigitalProductBySlug()` renvoie alors `null`, puis la page déclenche `notFound()`.

**Recommandation :** conserver une dernière copie publique valide. Si aucune copie n’est disponible et que la panne est temporaire, servir une indisponibilité temporaire adaptée, plutôt qu’assimiler l’absence de données à une suppression définitive. Prévoir des tests de panne et de retour à la normale, y compris l’ISR des fiches.

Retirer momentanément une URL d’un sitemap **ne la désindexe pas à lui seul**. Le risque vient surtout des réponses et contenus servis par les fiches pendant la panne. Aucune panne de production n’a été provoquée pour cet audit.

### 4.4 Canoniques, filtres et environnements

- `/codes?kind=gift_card` porte localement une canonical vers `/codes`. C’est cohérent si le filtre ne doit pas devenir une landing page distincte.
- Pour viser les requêtes de catégorie, créer de vraies pages autonomes et utiles, pas simplement ajouter des paramètres au sitemap.
- Vérifier sur l’hébergement une redirection permanente de `www` vers le domaine retenu et HTTP vers HTTPS. Le code n’établit pas à lui seul ces réglages de plateforme.
- Vérifier les URL publiques de preview. Le code racine est indexable par défaut ; aucune règle applicative générale de `noindex` des previews n’a été trouvée. La protection réellement appliquée par l’hébergeur reste inconnue.
- Les tests locaux de route inconnue renvoient bien 404. Une 404 produit contient aussi des métas `index` héritées en plus du `noindex` ajouté par Next : nettoyer ce mélange, sans le présenter comme une indexation constatée.

### 4.5 Démo secondaire et confidentialité

`public/live-demos/tulin-magazin/index.html` est servi localement en 200 avec `robots=index, follow`, sans canonical. Si ce document sert uniquement d’aperçu embarqué, prévoir `noindex` et conserver la fiche éditoriale `/demos/...` comme page indexable.

Ne pas confondre `Disallow`, `noindex` et contrôle d’accès : une règle robots ne protège aucune information privée. Les références et jetons de commande ne doivent jamais apparaître dans le sitemap, les liens publics ou les rapports partagés.

## 5. Produits, contenu et intentions de recherche

### 5.1 Doublon réellement confirmé sur les variantes Free Fire

Les pages suivantes ont le même title :

- https://nokhba.net.ly/codes/fzr-topup-free-fire-mena
- https://nokhba.net.ly/codes/fzr-topup-free-fire-eu

```text
شحن ألعاب Free Fire — من 1.50 دولار | نخبة
```

Leur H1 est également identique : `Free Fire`.

Cause identifiée : `productDisplayName()` supprime notamment les suffixes `(MENA)`, `(EU)`, `(SA)` et `(Global)`, puis `productSeoTitle()` réutilise ce nom sans réintroduire la région (`src/lib/digital-seo.ts:133-163,270-293`). Un prix identique ne distingue pas les variantes.

**À faire :** garder dans le title, le H1 et le nom structuré la compatibilité qui détermine réellement le choix : jeu + région/serveur + nature du produit. Exemple éditorial à valider : `شحن فري فاير MENA — الباقات والتوافق | نخبة`.

Conserver des URL séparées si elles répondent à de vrais besoins distincts. Ne pas les canonicaliser arbitrairement entre elles pour masquer les doublons. Ne pas renommer en masse les slugs existants : tout changement exigerait une correspondance de redirections et une recette.

### 5.2 Compatibilité et livraison : retirer les contradictions

Sur les deux fiches observées :

- le nom distingue MENA et EU ;
- la zone et la FAQ annoncent « mondial / valable sur tout compte » ;
- la page promet un code par e-mail ;
- les étapes expliquent pourtant une recharge directe sur le Player ID.

La compatibilité exacte doit être confirmée auprès du fournisseur. Une disponibilité à l’achat depuis plusieurs pays n’est pas équivalente à une compatibilité avec toutes les régions de compte.

Séparer les contenus selon le produit :

| Nature | Information centrale à afficher |
|---|---|
| Carte cadeau | Région et devise du compte, valeur faciale, code livré, lien officiel d’utilisation |
| Clé de jeu/logiciel | Plateforme, édition, région, conditions d’activation et de licence |
| Recharge de jeu | Jeu/serveur, Player ID et champs requis, crédit appliqué au compte, délai réaliste |
| Abonnement | Durée, région, mode d’activation, conditions de renouvellement |

Éviter « distributeur officiel », « instantané » ou « mondial » sans preuve correspondant exactement au produit. Rendre les FAQ, descriptions, métadonnées et flux IA cohérents avec ces mêmes faits.

### 5.3 Prix : contradiction commerciale et GEO prioritaire

Sur le [guide du prix d’un site](https://nokhba.net.ly/blog/website-cost-libya-2026), le premier paragraphe et les chiffres clés annoncent **300 / 510 / 880 $**. Plus bas, le tableau « prix actuels » annonce **60 / 100 / 299 $** pour le modèle, soit **66 / 110 / 328,90 $** avec 10 % de personnalisation.

Le [comparatif Wix](https://nokhba.net.ly/compare/wix) mélange également le prix actuel à partir de 60 $ et des paragraphes annonçant encore 300 $. Il affirme aussi « pas de renouvellement » alors que l’offre ne couvre l’hébergement gratuit que pour la première année.

**Recette souhaitée :**

- Utiliser les prix de la configuration vivante dans les résumés et tableaux, ou identifier explicitement un exemple historique daté.
- Distinguer systématiquement **prix du modèle**, **personnalisation**, **total** et **coûts récurrents éventuels**.
- Harmoniser accueil, tarifs, comparatifs, articles, offres structurées et flux IA.
- Mettre à jour la date éditoriale seulement après modification réelle du contenu.
- Citer les sources des prix concurrents et remplacer les généralisations non démontrées sur leurs performances.

### 5.4 Architecture et maillage

Le site a deux univers légitimes : agence et boutique. Le routage actuel les sépare déjà par `/creation-sites` et `/codes` ; conserver cette clarté. Il n’est pas nécessaire de créer un autre domaine sans étude préalable.

Le catalogue rend toutes les cartes filtrées avec `filtered.map(...)` (`src/components/digital-catalog.tsx:658`). Les filtres sont utiles aux visiteurs, mais ne remplacent pas une architecture éditoriale de catégories.

Chantier recommandé :

1. Créer quelques catégories utiles, par exemple cartes cadeaux, recharges, clés jeux/logiciels, puis des marques prioritaires.
2. Ajouter une pagination serveur de 24 à 48 produits avec liens HTML vers les pages suivantes ; ne pas cacher la découverte derrière un bouton JavaScript uniquement.
3. Donner à chaque page paginée une URL et une canonical cohérentes ; ne pas canonicaliser toutes les pages vers la première.
4. Préserver l’accès à toutes les fiches via catégories et pagination.
5. Sur une fiche, privilégier les recommandations vraiment proches : même jeu, même région ou alternative compatible. Le code actuel peut prendre simplement les quatre premières fiches du même type.
6. Sur les filtres non indexables, harmoniser le JSON-LD avec les produits réellement présentés : le hub construit actuellement son `ItemList` sur la liste complète avant le filtre de nature.

### 5.5 Ciblage sémantique : proposition, pas relevé de volumes

| Intention | Expressions candidates | Page cible |
|---|---|---|
| Agence locale | `تصميم مواقع طرابلس`, `شركة تصميم مواقع ليبيا` | `/creation-sites` |
| Prix d’un site | `سعر تصميم موقع في ليبيا`, `تكلفة متجر إلكتروني` | guide prix + `/pricing`, avec rôles distincts |
| Solution métier | `موقع عيادة حجز مواعيد`, `تصميم موقع مطعم طرابلس` | secteurs correspondants + cas client |
| Recharge Free Fire | `شحن فري فاير`, région/serveur réel | fiche ou catégorie appropriée |
| Recharge PUBG | `شحن ببجي UC`, mode/compatibilité | fiche PUBG prioritaire |
| Carte Steam | `بطاقة ستيم`, région et devise | catégorie Steam puis fiches |
| Carte PlayStation | `بطاقة بلايستيشن سعودية` | fiche réellement compatible SA |
| Marché anglophone | `web design Tripoli`, `Steam gift card USDT` | futures pages EN si décidées |

Valider ces hypothèses dans GSC et un outil de recherche de mots-clés. Associer une intention principale à chaque page, sans créer des dizaines de pages villes ou marques identiques. Les noms arabes usuels des jeux peuvent compléter les marques latines, naturellement, sans répétition artificielle.

## 6. Données structurées

### Points positifs

Présence de générateurs `Organization`, `WebSite`, `ProfessionalService`, offres, fil d’Ariane, pages, articles, FAQ, produits et collections. Les JSON-LD analysés localement sont parsables. Le générateur de l’entreprise n’émet plus d’avis auto-attribués.

### Points à corriger ou à remettre à leur juste place

1. **Offres des produits** — `src/app/(site)/codes/[slug]/page.tsx:170-200` utilise `AggregateOffer` avec le nombre de montants disponibles. Google précise de ne pas l’utiliser pour représenter un ensemble de variantes. Prévoir des offres réelles associées aux montants/SKU/compatibilités et, si le modèle s’y prête, un regroupement de variantes. Les snippets produits peuvent accepter `Offer` ou `AggregateOffer`, mais les expériences « fiches marchand » nécessitent un `Offer`. La validité JSON ne garantit aucune de ces éligibilités. [1](https://developers.google.com/search/docs/appearance/structured-data/product-snippet) [2](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
2. **Disponibilité** — `coming_soon` est traduit en `PreOrder`. Ne déclarer une précommande que si elle est réellement possible ; sinon représenter l’indisponibilité exacte.
3. **Images** — utiliser le visuel du produit. Le repli sur l’OG générique de l’agence ne représente pas toujours ce produit.
4. **Horaires** — fermeture à 23 h écrite en dur dans `src/lib/seo.ts:350-364`, alors que le contact public indique 22 h et le texte anglais 18 h. Structurer les horaires dans la configuration plutôt que parser des phrases.
5. **Langues des FAQ** — certaines FAQ d’articles et de services restent bilingues ou arabes dans le schéma indépendamment de la langue affichée. Aligner les questions/réponses structurées sur le contenu réellement présenté.
6. **Comptage d’article** — `articleWordCount()` additionne AR et EN (`src/lib/blog.ts:132-160`) pour une page qui présente une version linguistique à la fois. Calculer par langue ou omettre ce champ secondaire.
7. **FAQ / HowTo** — ne pas promettre de FAQ enrichies pour cette agence : Google les réserve essentiellement aux sites gouvernementaux et de santé faisant autorité. Les résultats enrichis HowTo ont été retirés. Ces structures peuvent rester sémantiquement utiles, sans être un levier garanti de visibilité. [1](https://developers.google.com/search/blog/2023/08/howto-faq-changes)
8. **Validation réelle** — tester des URL publiées dans Rich Results Test et les rapports GSC correspondants. Vérifier aussi les règles applicables aux produits numériques et au modèle commercial : ajouter une politique de retour ne suffit pas à garantir l’accès à Google Shopping.

Le score admin doit refléter ces distinctions : `src/lib/seo-audit.ts:278-284` annonce encore des schémas `Review` actifs alors que le générateur de l’entreprise les a volontairement retirés.

## 7. GEO : visibilité dans les réponses génératives

### 7.1 Le principe : les faits fiables avant les fichiers IA

Le site possède déjà des réponses directes, tableaux et FAQ, ainsi que deux flux textuels dynamiques. C’est une base éditoriale exploitable. En revanche, **l’existence de `llms.txt`, de 28 noms de robots ou de nombreux types de schémas ne prouve pas une citation**.

Pour les fonctionnalités IA de Google, il n’existe pas de fichier IA ni de schéma spécial obligatoire : la page doit notamment être indexée et éligible à un extrait dans Search. Google indique que les bonnes pratiques SEO restent applicables. [1](https://developers.google.com/search/docs/appearance/ai-features)

### 7.2 Contradictions confirmées dans les flux publics

Dans [llms-full.txt](https://nokhba.net.ly/llms-full.txt), la fin du document affirme :

```text
It is not an e-commerce marketplace, a hosting company or a software reseller.
Languages: English (en, primary) and Arabic (ar, full RTL)
```

Or le site présente une boutique de clés/produits numériques et sert d’abord l’arabe. La section « Entity disambiguation » nie une activité que le reste du document décrit. Ces phrases viennent de `src/lib/llms-txt.ts:586-593` et ne suivent pas complètement la configuration.

Le résumé public annonce aussi 120+ sites, 99 % de satisfaction, 4,9/5 sur 86 avis et un support 24/7. Ces chiffres ne sont pas vérifiés par une source indépendante dans cet audit. Il faut les justifier, les dater et les sourcer, ou les retirer. Le nombre de projets visibles au portfolio n’est pas, à lui seul, une preuve que le total annoncé est faux.

**Actions :**

- Définir une description unique des deux activités, une langue principale réelle et des horaires cohérents.
- Utiliser Nukhba/Nokhba comme variantes de nom explicites si nécessaire, sans alterner involontairement les identités.
- Corriger les faits dans le HTML en premier, puis leurs exports.
- Garder `llms.txt` comme un index réellement compact des pages de référence ; éviter d’y recopier tout le catalogue et ses montants.
- Ne pas insérer de promesses d’indexation ou d’instructions promotionnelles comme substitut à des preuves externes.

Le [guide GEO public](https://nokhba.net.ly/blog/get-cited-by-chatgpt-google-ai) présente encore une fenêtre de 4 à 12 semaines comme résultat attendu et donne à `llms.txt` un rôle trop central. Requalifier cette durée comme hypothèse non démontrée, non comme échéance prévisible, et ajouter des références officielles.

### 7.3 Robots de recherche et robots d’entraînement : deux décisions différentes

Le robots public autorise le contenu public pour les robots génériques et de nombreux agents IA. C’est compatible avec une politique d’ouverture.

Cependant :

- **OAI-SearchBot** sert la recherche ChatGPT ; **GPTBot** concerne les usages d’entraînement. Autoriser l’un n’impose pas d’autoriser l’autre.
- **ChatGPT-User** correspond à des actions déclenchées par les utilisateurs, pas au mécanisme déterminant l’inclusion dans Search. [1](https://platform.openai.com/docs/bots)
- **Google-Extended** ne détermine pas l’inclusion ni le classement dans Google Search. [1](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers)

Décider consciemment de la politique d’entraînement. Vérifier également que le pare-feu/CDN n’empêche pas les robots de recherche autorisés ; le robots seul ne prouve pas leur accès réseau réel.

### 7.4 Le tracker ne mesure pas encore un taux de citation fiable

`scripts/geo-citations.mjs` contient dix questions, toutes orientées vers l’agence. Le moteur OpenAI par défaut n’utilise pas la recherche web ; un indicateur `grounded` le signale, mais l’agrégat des résultats reste intitulé « taux de citation ».

Tests purs exécutés, sans réseau :

| Entrée | Résultat actuel |
|---|---|
| Phrase arabe contenant simplement « une élite de sociétés » avec le mot `نخبة` | `mentioned: true`, sans URL |
| URL sur un domaine ressemblant à la marque, mais dont le hostname est différent | L’extracteur accepte la chaîne comme URL de marque |
| Une mention sans source ni URL | `summarize()` retourne un taux de citation de 100 % sur cet unique exemple |

Il s’agit d’un **défaut de mesure**, pas d’une citation commerciale observée ni d’une faille de sécurité démontrée.

**Nouvelle mesure recommandée :**

1. `mention_rate` : nom de marque mentionné de façon non ambiguë.
2. `citation_rate` : URL dont le hostname vérifié correspond au domaine, présente dans les sources/citations retournées par le moteur.
3. `grounded_citation_rate` : uniquement sur les réponses où la recherche web a effectivement été utilisée.
4. Visites référentes et conversions : mesure séparée des mentions/citations.
5. Erreurs API et exécutions sans clés : états distincts, pas des réponses négatives.
6. Ajouter des questions boutique, en arabe et anglais ; conserver moteur, modèle, date, localisation et prompt. Répéter un petit jeu stable pour observer la variabilité.

Une réponse API n’est pas une reproduction exacte de l’interface grand public. Comparer les tendances sur un protocole stable, pas en déduire un classement absolu.

## 8. Référencement local et international

### Local : base présente, légitimité à confirmer

Le contact public indique une adresse à Tripoli, un téléphone et un e-mail professionnels cohérents entre les pages observées. Le code produit un `ProfessionalService`, une adresse, des coordonnées et une zone desservie.

À faire :

- Confirmer l’adresse réelle et les coordonnées GPS précises ; ne pas publier le centre d’une ville comme localisation d’un bureau si ce n’est pas le cas.
- Unifier les horaires AR/EN, le téléphone et le nom de marque dans le site, les flux et les profils externes.
- Vérifier les profils sociaux réellement actifs et leur lien vers le domaine.
- Créer/optimiser Google Business Profile **seulement si l’activité est éligible** : accueil de clients dans un lieu physique ou déplacements chez les clients. Ne pas créer une fausse implantation pour une activité uniquement en ligne. [1](https://support.google.com/business/answer/3038177?hl=en)
- Si éligible, demander des avis authentiques, sans récompense ni sélection des seuls avis positifs ; publier des photos et des réalisations vérifiables.

Le lien Maps actuel est une recherche cartographique ; il ne prouve pas l’existence d’une fiche d’établissement validée. Aucun statut de fiche ou classement local n’a été vérifié.

### International : l’anglais n’a pas de page autonome

L’anglais repose sur le sélecteur client et `localStorage`. `/en` et `/ar` redirigent localement vers `/` en 307 ; ce ne sont pas deux pages linguistiques indexables.

Cela ne bloque pas le SEO arabe. En revanche, ce n’est pas une architecture suffisante pour viser explicitement les recherches anglophones. Google recommande des URL différentes par langue, avec des annotations `hreflang` adaptées. [2](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)

Si cette cible est prioritaire :

1. Conserver les URL arabes existantes pour éviter une migration inutile.
2. Créer des URL anglaises, par exemple `/en/creation-sites` et `/en/codes/...`, **avant** de les déclarer.
3. Servir le contenu et les métadonnées anglais dès le HTML initial.
4. Prévoir une canonical propre à chaque version, pas toutes les EN vers les AR.
5. Ajouter des `hreflang` absolus, réciproques et incluant chaque version elle-même. [3](https://developers.google.com/search/docs/specialty/international/localized-versions)
6. Lier le sélecteur aux URL réelles et enrichir le sitemap après recette.

En attendant, l’absence de faux `hreflang` est préférable à des annotations pointant vers des redirections ou 404.

## 9. Performance et expérience mobile

### Ce que le code fait déjà correctement

- Polices auto-hébergées ; préchargement de la police arabe.
- Captures de réalisations et visuels locaux compressés.
- `next/image`, proportions de cartes, attributs `alt`, `sizes` et chargement prioritaire des premières cartes.
- Vercel Speed Insights intégré aux pages publiques ; présence dans le code ne prouve pas qu’un rapport contient déjà assez de données.

### Risques à mesurer

- 788 produits potentiellement rendus dans une longue grille : volume HTML/RSC, DOM, hydratation et coût des filtres/tri sur un mobile modeste.
- Le hub produit construit aussi un `ItemList` et un catalogue structuré sur la liste complète.
- Images et iframes : conserver le chargement différé et mesurer le coût d’une activation de démonstration.
- Vérifier que le chatbot et les éléments flottants ne masquent pas les actions importantes sur petit écran.

**Mesure indicative locale seulement :** avec huit fiches de repli, `/codes` représente environ **280 ko de HTML brut** et **49 ko après compression gzip simulée**. Ce n’est ni le poids total transféré, ni la compression réellement servie, ni la taille du catalogue de production. Ne pas extrapoler un score à partir de ce chiffre.

**Recette à effectuer :** trois mesures Lighthouse mobile par gabarit publié (accueil, `/codes`, recharge, carte cadeau, création, article), puis données terrain CrUX/GSC lorsqu’elles existent. Les seuils « bons » des Core Web Vitals sont LCP ≤ 2,5 s, INP ≤ 200 ms et CLS ≤ 0,1 au 75e percentile. [1](https://web.dev/articles/defining-core-web-vitals-thresholds)

Le site affirme par endroits « 90+ Lighthouse » comme facteur de classement direct. Corriger cette formulation : un score de laboratoire et les données terrain ne sont pas interchangeables, et aucune mesure actuelle ne valide ici cette promesse.

## 10. Autorité, liens et confiance

### Identité éditoriale et cas clients

- Les articles ont des dates et un auteur collectif, ce qui est préférable à un contenu anonyme sans contexte.
- Ajouter une page présentant l’entreprise et les personnes responsables, leur expérience réelle, les moyens de contact et les informations commerciales appropriées.
- Faire relire les guides techniques/commerciaux ; citer les sources officielles pertinentes et dater les éléments susceptibles de changer.
- La [réalisation `/demos/site-10`](https://nokhba.net.ly/demos/site-10) conserve littéralement une « description courte du site et de ses fonctionnalités ». Remplacer ce placeholder par le besoin client, le travail réalisé et des résultats démontrables, avec son accord.
- Distinguer clairement une démonstration, un modèle à personnaliser et une réalisation effectivement livrée à un client.
- Les pages `/apps` et `/products` annoncent honnêtement des offres à venir. Garder leur indexation si elles fournissent une information utile ; ne pas publier des sous-pages vides uniquement pour occuper des requêtes.

### Badges clients : changer le cadrage de la stratégie

`src/lib/badge.ts` propose des ancres riches en mots-clés et les anciens documents encouragent le dofollow systématique. Cela ne prouve pas une sanction, mais une diffusion à grande échelle de liens optimisés dans les pieds de page/templates présente un risque de liens artificiels selon les règles Google. [1](https://developers.google.com/search/docs/essentials/spam-policies#sneaky-redirects)

Privilégier un crédit de marque volontaire, non imposé, utile au visiteur. Si le lien fait partie d’une contrepartie commerciale, utiliser une qualification adaptée (`sponsored`, ou `nofollow` selon le cas). Ne pas exiger du dofollow ni organiser de rotations d’ancres pour manipuler les signaux.

L’audit n’a pas vérifié l’ensemble des liens entrants. Aucun volume de backlinks, score d’autorité ou gain de position n’est revendiqué.

## 11. Plan d’action et critères de recette

| Échéance indicative | Responsable | Travail | Recette |
|---|---|---|---|
| Aujourd’hui | Propriétaire | Valider la propriété GSC et soumettre le sitemap existant | Propriété correcte, lecture du sitemap réussie, date relevée |
| Jours 1–3 | Éditorial + développeur | Prix, horaires, identité IA, régions et livraison | Même information dans HTML, FAQ, métadonnées, JSON-LD et flux |
| Jours 1–5 | Développeur | Titles/H1 des variantes | Test sur le catalogue réel : aucune collision involontaire |
| Semaine 1 | Développeur | Recette panne catalogue et cache | Une panne temporaire ne transforme pas des fiches connues en suppressions |
| Semaine 1 | Propriétaire | Relevé GSC initial et examen de 5–10 URL représentatives | Statuts et canoniques Google documentés, sans demande massive |
| Semaine 2 | Développeur | Offres structurées, démo secondaire et protections preview | Validation sur URL publiées et non-indexation des aperçus appropriés |
| Semaines 2–4 | Éditorial | Enrichir les 10–20 fiches prioritaires et les cas clients | Informations exclusives utiles, compatibilité vérifiée, sources |
| Semaines 2–4 | Développeur | Catégories et pagination | Tous les produits découvrables, HTML réduit, canoniques cohérentes |
| Mois 1 | Marketing | Mesure GEO corrigée, questions agence + boutique | Citations d’URL distinguées des mentions et des erreurs API |
| Après décision marché | Développeur + traduction | Vraies pages EN | HTML, canonical, `hreflang` et sitemap correctement reliés |

Ces échéances organisent le travail ; elles ne prédisent pas une date d’indexation ou de progression du trafic.

### Tests à ajouter aux garde-fous existants

- Catalogue représentatif de la production, incluant deux régions d’un même jeu au même prix.
- Unicité des titles après troncature ; région/serveur conservés lorsqu’ils distinguent des fiches.
- Cohérence recharge directe / code livré par e-mail.
- Cohérence tarifs configurés / réponse directe des articles / comparatifs / JSON-LD.
- Cohérence des horaires et de la langue principale dans tous les exports.
- Comparaison sitemap / pages réellement éligibles, pas sitemap / toute page visible sans distinction.
- Panne des sources catalogue et reprise sans 404 durable sur produit existant.
- Validation de hostname des citations et séparation `mentioned` / `cited` / `grounded`.
- Contrôle du host canonique, des en-têtes et des directives d’indexation en production, pas seulement du chemin local.

## 12. Mesure et informations restant à obtenir

### Tableau de bord de référence

| Axe | Mesure | Interprétation |
|---|---|---|
| Découverte | URL éligibles du sitemap brut, dernière lecture GSC, erreurs de récupération | Google connaît-il le bon inventaire ? |
| Indexation | URL prioritaires indexées, motifs d’exclusion par famille, canonical choisie | Découverte et indexation restent distinctes |
| Recherche | Clics, impressions, CTR, requêtes, pays, mobile/desktop | Comparer des fenêtres de même durée et les pages équivalentes |
| Performance | LCP/INP/CLS terrain ; laboratoire en complément | Priorité aux utilisateurs mobiles réels |
| Commercial | Demandes qualifiées, clics WhatsApp, commandes et revenus attribuables | L’objectif est commercial, pas un score technique |
| GEO | Mentions non ambiguës, citations exactes, visites référentes, conversions | Mesures différentes, jamais agrégées sous un seul « score IA » |

Les apparitions dans les fonctionnalités IA de Google sont intégrées au trafic de recherche global du rapport Performances, type Web ; ne pas présenter ce total comme une mesure isolée et certaine d’AI Overviews. [1](https://developers.google.com/search/docs/appearance/ai-features)

### Éléments à relever pour compléter la partie privée

Sans partager d’identifiants, de clés ou de données clients :

1. Propriété GSC sélectionnée et état de validation.
2. Détails du sitemap : URL, statut, dernière lecture, pages découvertes et erreurs éventuelles.
3. Export des performances sur 3 mois, par pages et requêtes, avec pays/appareils si les données existent.
4. Motifs d’exclusion des pages ; inspection d’un produit de chaque nature et des pages agence prioritaires.
5. Rapports Core Web Vitals et résultats enrichis, s’ils sont disponibles.
6. Résultats des redirections HTTP/www et de l’accès des robots au niveau hébergement.
7. Preuves des avis/chiffres commerciaux et statut réel de l’établissement local, si applicable.

### Trois distinctions à retenir

- **Sitemap accessible ≠ sitemap soumis dans ton compte.**
- **Sitemap lu ≠ toutes les pages indexées.**
- **Page indexée ≠ position gagnée ou citation IA.**

Le dépôt contient déjà un client de soumission via l’API **Search Console Sitemaps**, malgré son nom `google-indexing.ts`. Ce n’est pas l’Indexing API réservée à certains contenus d’offres d’emploi et de vidéos en direct. La soumission manuelle est suffisante pour commencer. [2](https://developers.google.com/search/apis/indexing-api/v3/quickstart)

Attention à son commentaire de configuration : il mentionne un accès « Restreint ». Pour envoyer un sitemap, il faut un propriétaire ou un utilisateur avec **accès complet**, pas un accès limité. [1](https://support.google.com/webmasters/answer/7687615?hl=en)

---

**Prochaine action immédiate :** suivre le [guide GSC](./guide-gsc-sitemap-2026-11-01.md), noter les résultats réels, puis traiter A01 à A06. Le sitemap ne demande pas une reconstruction ; le site demande surtout des faits cohérents, des fiches différenciées et une mesure fiable.
