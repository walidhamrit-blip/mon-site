# Audit & plan de correction — Portée mondiale + catalogue digital

**Date :** 24 octobre 2026
**Périmètre :** site public Nukhba (`nokhba.net.ly`), panneau `/admin`, API, SEO/GEO
**Objectif :** (1) faire passer le site d'une portée « Libye » à une portée mondiale
réglable ; (2) préparer le socle du catalogue « codes logiciels & cartes cadeaux
gaming ».

---

## 1. Synthèse

| Axe | Avant | Après |
| --- | --- | --- |
| Géographie | Tripoli / Libye figés dans le code (≈ 45 fichiers) | un profil de **marché** unique, éditable dans `/admin` |
| Devises | USD + équivalent LYD calculé par formule ad hoc | 6 devises, taux pilotables, sélecteur en barre supérieure |
| Devise de facturation | USD | USD (inchangée — NOWPayments n'encaisse qu'en USD) |
| SEO local | `ar-LY` / `Tripoli` / `Libya` écrits en dur | dérivés du marché ; `globalReach` ouvre la zone au monde |
| Catalogue digital | inexistant | domaine, base, API publique, vitrine `/codes`, admin |
| Contrôles | 107 tests | 126 tests (+ 19 nouveaux sur le marché, les devises, le catalogue) |
| Build | OK | OK — 72 pages statiques |
| Audit SEO live | — | **0 erreur, 0 avertissement** (63 pages/ressources) |

**Décisions prises (validées) :**

1. **Marché configurable** — le domaine `.net.ly` est conservé ; Tripoli/Libye
   devient le *marché par défaut*, pas une constante. On peut passer à Dubaï,
   Riyad, Le Caire, Casablanca, Tunis ou « monde » en un clic dans
   `/admin → Réglages → Marché & Devises`.
2. **Sélecteur de devise** — USD par défaut, plus EUR, SAR, AED, EGP, LYD.
3. **Catalogue digital = périmètre « catalogue »** — les fiches sont publiées et
   détaillées (prix, régions, montants), mais **la caisse n'existe pas encore** :
   le CTA appelle la liste d'attente. Aucune brique n'est un prototype jetable.

---

## 2. Audit — constats et corrections

### 2.1 Critique — le site était verrouillé sur Tripoli / Libye

| # | Constat | Impact | Correction |
| --- | --- | --- | --- |
| C-1 | `src/lib/seo.ts` : `addressLocality: "Tripoli"`, `addressCountry: "LY"`, `geo` en dur, `areaServed` = {Tripoli, Libya}, `slogan` « Tripoli, Libya » | Données structurées incohérentes dès qu'on vise l'étranger ; Google ne peut pas associer l'entité à une zone plus large | Tout dérive de `resolveMarket(config.market)` ; `areaServed` passe à « Worldwide » quand `globalReach` est actif |
| C-2 | `inLanguage: ["ar-LY","en"]` figé dans 5 schémas | Un marché `ar-AE` ou `ar` se déclarait `ar-LY` | `marketLanguages(market)` — déduit du marché, toujours accompagné de `en` |
| C-3 | `pageMetadata()` : `locale: "ar_LY"`, `alternateLocale: ["en_US"]` en dur | Balise OG incohérente dès que le marché change | `ogLocale(market.locale)` (convertit `ar-LY` → `ar_LY`, format attendu par les graphes sociaux) |
| C-4 | `src/app/layout.tsx` : `metadata` **statique**, figé sur les valeurs code | Changer de marché ne changeait ni le titre, ni la description, ni les mots-clés racine | `export async function generateMetadata()` branché sur la config **vive** (`/admin`) |
| C-5 | Titres/descriptions de 10 pages publiques avec « طرابلس / ليبيا » en dur | Aucun classement sur « website pricing Dubai », « web agency Riyadh »… | Jetons `{city}` `{country}` `{cityEn}` `{countryEn}` résolus par `applyMarketTokens()` dans `pageMetadata()` — les chaînes restent lisibles dans le code |
| C-6 | `Africa/Tripoli` codé en dur sur les dates d'échéance des abonnements (`/abonnements/suivi`) | Un abonné à l'étranger lisait des dates décalées | Fuseau issu du marché, dans les deux pages (serveur + client) |
| C-7 | `contact-client.tsx` : recherche Google Maps codée sur « Al Jumhouriya Street, Tripoli, Libya » | Le lien Maps menait à Tripoli quel que soit le marché | `siteConfig.addressEn` (donc éditable) |
| C-8 | `navbar.tsx` (« Tripoli · Premium sites »), `footer.tsx` (« Tripoli · Premium Web Agency ») | Libellés figés | Libellés de marché ; le pied de page utilise désormais des jetons `{place}` / `{city}` |
| C-9 | `llms.txt` : titre « Premium Web Agency in Tripoli, Libya » et corps « for Libyan businesses » | Les moteurs IA (ChatGPT, Perplexity, Gemini) recevaient un profil strictement libyen | Introduction et corps de `llms.txt` adossés au marché + mention du positionnement international |

### 2.2 Majeur — prix et devises

| # | Constat | Impact | Correction |
| --- | --- | --- | --- |
| M-1 | Le prix LYD était recalculé par formule ad hoc (`plan.price / plan.priceUsd`) dans `classification.ts`, `installments.ts`, `api/payments/create` | Trois sources de vérité, divergentes au centime | Le **taux de change devient une donnée** (`siteConfig.currency.rates`), pilotable depuis l'admin |
| M-2 | Aucun choix de devise : un client de Dubaï voit « $1 490 ≈ 1 490 د.ل » | Le dinar libyen n'est utile qu'au client libyen | Sélecteur de devise (USD/EUR/SAR/AED/EGP/LYD) en barre supérieure + menu mobile ; mémorisé sur l'appareil (`nukhba-currency`) |
| M-3 | Les prix affichés venaient de `formatMainPrice(x, "$")` disséminé dans 13 fichiers | Impossible d'afficher une devise autre que le dollar sans retoucher chaque composant | Composant unique `<Price usd={…} />` (client) utilisable depuis un composant **serveur** comme **client** ; le total facturé reste en USD explicite dans le checkout |
| M-4 | `currenciesAccepted: "USD, LYD"` en dur | Idem | Dérivé du marché |
| M-5 | Le taux LYD implicite (4,97) ne correspondait pas au taux réel | Écart visible avec le prix affiché | Taux explicite dans la configuration, avec repli sur 1 (prix en USD) si le taux est absent ou invalide |

### 2.3 Mineur — robustesse et cohérence

| # | Constat | Correction |
| --- | --- | --- |
| m-1 | `formatLyd`/`lydLabel` : le « LYD » était présenté comme la devise du site | Remplacé par la devise **du marché** (`MarketPrice`), le dinar n'étant plus qu'un équivalent local |
| m-2 | `resolveMarket` : un champ vide (ex. `cityEn: ""`) écrasait la valeur par défaut | Les valeurs vides ou invalides sont ignorées (repli sur Tripoli) |
| m-3 | Aucun test ne couvrait la géographie ni les devises | 19 tests dédiés (`scripts/global-catalog.test.mjs`), dont des contrôles **statiques** garantissant qu'aucun « Tripoli » / « Africa/Tripoli » ne revient dans le SEO, le contact ou les abonnements |
| m-4 | `npm run test:seo` ne couvrait pas les nouveaux modules | Ajoutés à la suite `test:seo` (exécutée par le workflow CI `seo.yml`) |

---

## 3. Socle du catalogue digital (codes & cartes cadeaux)

### 3.1 Modèle de données

Deux tables, créées automatiquement au premier accès (même mécanisme que le
reste du schéma — aucun `drizzle-kit push` requis) :

- **`digital_products`** — la fiche : `slug`, `kind`, `status`, `platform`,
  `color`, titres/descriptions AR+EN, `regions`, `features`, note de livraison,
  `sort_order`.
- **`digital_denominations`** — les montants vendables : `label`, `face_value`,
  **`region`**, **`price_usd`**, `available`, `sort_order`.

### 3.2 Décisions structurantes

- **La devise de référence est l'USD** — c'est celle facturée par la
  passerelle ; l'affichage se convertit ensuite dans la devise du visiteur.
- **Chaque montant porte sa région.** Une carte Steam européenne n'est pas
  interchangeable avec une carte américaine : c'est le premier motif de litige
  sur ce type de produit. Les régions gérées : `global, US, CA, UK, EU, TR,
  SA, AE, EG, LY, MA, DZ, TN`.
- **Quatre natures de produit** : `software_key` (code d'activation),
  `gift_card` (carte cadeau), `game_topup` (recharge de monnaie de jeu),
  `subscription_code` (code d'abonnement).
- **Cycle de vie** : `draft` → `coming_soon` → `available` → `archived`.
  `coming_soon` permet de publier la fiche **avant** l'ouverture des ventes :
  la vitrine est en ligne, la caisse arrive plus tard, sur les mêmes données.

### 3.3 Ce qui est livré

| Brique | Emplacement | État |
| --- | --- | --- |
| Domaine (types, libellés, helpers) | `src/lib/digital-types.ts` | ✅ |
| Catalogue par défaut (8 plateformes) | `src/lib/digital-seed.ts` | ✅ |
| Accès base (lecture/écriture, repli propre) | `src/lib/digital-store.ts` | ✅ |
| Tables + DDL automatique | `src/db/schema.ts`, `src/db/index.ts` | ✅ |
| API publique catalogue | `GET /api/digital/products` | ✅ |
| API publique fiche | `GET /api/digital/products/[slug]` | ✅ |
| Vitrine catalogue (filtres, recherche, devise) | `/codes` | ✅ |
| Fiche produit (montants, régions, CTA) | `/codes/[slug]` | ✅ |
| Admin (édition des fiches + des montants) | `/admin/digital` | ✅ |
| SEO (CollectionPage, Product, sitemap, `llms.txt`) | — | ✅ |
| Validation Zod | `src/lib/validation.ts` | ✅ |

**Périmètre non couvert (assumé) :** ni paiement, ni stock de codes, ni
livraison automatique, ni réservation de quantité. Le CTA renvoie vers la liste
d'attente WhatsApp. C'est cohérent avec le périmètre « catalogue » validé.

### 3.4 Feuille de route pour la caisse (prochaines étapes)

1. `digital_codes` (stock de codes, un par ligne, `product_id` + `denomination_id`,
   `code` chiffré, `status: available|reserved|delivered`, `order_id`).
2. `digital_orders` + `digital_order_items` (ou extension de `orders` avec
   `kind = "digital"`).
3. Création de commande : ajouter `kind: "digital"` à
   `POST /api/payments/create` (le montant est **recalculé côté serveur** à
   partir de la dénomination — le client ne peut pas forcer le prix).
4. Réservation du code à la création de la commande (transaction + verrou) :
   `SELECT … FOR UPDATE SKIP LOCKED`, pour ne jamais vendre deux fois le même
   code.
5. Livraison dans le handler IPN (`/api/payments/ipn`) : envoi du code par
   e-mail + affichage dans l'espace de suivi de commande.
6. Pages : `/codes/checkout`, `/codes/orders/[ref]`, page de suivi du code.

---

## 4. Guide de prise en main

### 4.1 Changer de marché

`/admin → Réglages → Marché & Devises` :

- **Marché prédéfini** : Tripoli (défaut), Dubaï, Riyad, Le Caire,
  Casablanca, Tunis ou « Worldwide » — un clic remplit ville, pays, code ISO,
  fuseau, locale, devise, indicatif, coordonnées GPS et rayon de service.
- **Positionnement international** : à garder actif. Il ouvre la zone
  desservie à « Worldwide » dans les données structurées et ajoute la
  formulation internationale aux descriptions.
- Les champs libres permettent de Personnelnaliser au-delà des presets.

### 4.2 Régler les taux de change

`/admin → Réglages → Marché & Devises → Devises d'affichage` :

- cocher/décocher les devises proposées dans le sélecteur ;
- saisir le taux `1 USD = X` de chacune.

Un taux absent, nul ou négatif retombe sur **1** : le site n'affiche jamais un
prix converti faux (il affiche le prix en USD).

### 4.3 Gérer le catalogue digital

`/admin → Codes & Cartes cadeaux` :

- **Nouvelle fiche** : nature, plateforme, titres AR/EN, slug, statut, couleur,
  régions, description, note de livraison.
- **Montants & régions** : une ligne par montant, avec sa région, son prix en
  USD et sa disponibilité.
- Les fiches `coming_soon` apparaissent sur `/codes` avec un CTA de liste
  d'attente ; `draft` et `archived` restent invisibles du public.

---

## 5. Limites connues (non corrigées, par choix)

| Limite | Pourquoi |
| --- | --- |
| Le contenu éditorial des secteurs, du blog et des services reste libyen | C'est du **contenu**, pas du code : il se remplace depuis `/admin`. Écrire 10 pages pour 6 marchés n'a pas de sens tant que le marché cible n'est pas choisi. |
| La langue du site reste `ar` / `en` | Ajouter une 3ᵉ langue impose des URL dédiées (`/fr/...`) et une refonte du sélecteur de langue : chantier distinct. |
| Le domaine reste `nokhba.net.ly` | Un TLD national limite la confiance à l'international. Un `.com`/`.net` + redirection 301 du `.net.ly` est **le** levier SEO le plus fort restant — décision à prendre. |
| Pas de page `/fr` | La France est mentionnée dans `knowsLanguage` (déjà le cas avant cet audit) mais sans version linguistique dédiée. |
| Les prix des pages purement informatives (blog, fiches secteurs) sont convertis côté navigateur | Pages statiques (bon pour le SEO et la performance) : le HTML initial porte le prix en USD, la conversion s'applique à l'hydratation. |

---

## 6. Vérifications exécutées

```bash
npm run typecheck      # 0 erreur
npm run lint           # 0 erreur (1 avertissement pré-existant : react-hook-form)
npm run test:seo       # 126/126 ✓  (107 existants + 19 nouveaux)
npm run test:subscriptions  # 21/21 ✓
npm run build          # ✓ 72 pages statiques
npm run seo:check      # ✓ 63 pages/ressources, 0 erreur, 0 avertissement
```
