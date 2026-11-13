# Point 2 — Rendu et temps de chargement (Vercel / Neon)

> **Le risque** : chaque visite du catalogue relisait PostgreSQL (Neon) et
> reconstruisait les ~280 fiches. Sur Vercel, une instance serverless froide
> repartait de zéro : TTFB élevé, et consommation de quota de calcul Neon
> proportionnelle au trafic (robot d'indexation compris).
>
> **L'amélioration** : cache natif de Next.js sur les pages de catégories et
> de produits, et vérification en temps réel du stock **au moment du panier**.

## Ce qui est en cache, ce qui ne l'est pas

| Donnée | Avant | Maintenant | Fraîcheur |
| --- | --- | --- | --- |
| Catalogue public (fiches, dénominations, surcharges admin) | relu en base + reconstruit à **chaque** requête, mémo par instance seulement | `unstable_cache` **partagé**, tag `digital-catalog`, TTL 60 s | invalidation immédiate à chaque écriture, 60 s max sinon |
| Réglages / contenu éditorial (`settings`) | 1 requête Neon par requête HTTP, mémo par instance (`react cache`) | `unstable_cache` **partagé**, tag `site-data`, TTL 300 s | invalidation immédiate (admin), 5 min max sinon |
| HTML des pages catalogue | `force-dynamic` (comportement conservé) | `force-dynamic` **conservé** + données en cache | voir ci-dessous |
| Prix, disponibilité, solde fournisseur au **panier** | temps réel | **temps réel, inchangé** | aucune mise en cache |
| Commandes, codes, factures, statuts de livraison | temps réel | **temps réel** | jamais mis en cache |

### Pourquoi les pages restent `force-dynamic`

Le rendu statique a déjà causé un incident (documenté en tête de
`src/app/(site)/codes/page.tsx`) : au build, le fournisseur est
volontairement indisponible, la page était pré-rendue avec **10 fiches de
repli** au lieu des 280, et restait figée tant qu'une revalidation n'avait pas
lieu. On garde donc le rendu à la demande — mais la **donnée** qui l'alimente
est maintenant partagée entre instances et entre requêtes, ce qui supprime
l'essentiel du coût (les lectures répétées vers Neon).

Conséquence concrète : une instance froide qui sert 200 visiteurs ne fait
**plus** 200 lectures du catalogue — elle fait une lecture (ou zéro si le
cache de données est déjà chaud) puis sert depuis le cache Next.

## Chaîne de cache

```
Requête → Page /codes, /codes/category/[kind], /codes/[slug], /
            │
            ├─ getSiteDataCachedShared()   tag "site-data"     TTL 300 s
            └─ getPublicCatalogCached()    tag "digital-catalog" TTL 60 s
                   └─ getDigitalCatalog() → copie fournisseur (noSync) + surcharges admin
                          └─ mémo mémoire d'instance (2 min) → Neon
```

Deux niveaux cohabitent volontairement :

1. **cache de données Next** (`unstable_cache`) — partagé, invalidé par tag ;
2. **mémo mémoire d'instance** (déjà présent dans `digital-store.ts`) — sert
   les rafales dans une même instance sans repasser par le cache de données.

## Invalidation (le point qui casse tout si on l'oublie)

Un cache sans invalidation correcte = prix périmé = litige. Chaque écriture
purge **les deux niveaux et le HTML** :

| Écriture | Fonction | Effet |
| --- | --- | --- |
| Fiche / prix / dénomination / masquage admin / synchro fournisseur | `clearPublicCatalogCache()` | mémo instance + tag `digital-catalog` + `revalidatePath("/codes", "layout")` |
| Réglages, textes, visuels (`upsertSetting`, `deleteSetting`) | `invalidateSiteCaches()` | tags `site-data` **et** `digital-catalog` + `revalidatePath("/", "layout")` |

`revalidatePath("/codes", "layout")` couvre `/codes/[slug]` et
`/codes/category/[kind]` sans énumérer 280 chemins.

Dans une **Server Action** (l'admin), l'invalidation utilise `updateTag`
(Next 16) pour garantir le *read-your-own-writes* : l'administrateur qui
enregistre un prix le voit immédiatement. Hors Server Action (cron, route,
script), `revalidateTag(tag, { expire: 0 })` prend le relais. Les deux sont
« best effort » : hors contexte Next, ils journalisent et continuent — une
invalidation ratée ne doit jamais faire échouer une écriture.

## Le contrepoint indispensable : le panier reste en temps réel

Le cache ne sert **que l'affichage**. À la caisse, le serveur ne fait jamais
confiance à la page :

| Contrôle | Où | Ce qu'il empêche |
| --- | --- | --- |
| Relecture de la fiche en base (`getDigitalProductBySlug`) | `createDigitalCheckout` | vendre un produit dépublié ou un prix modifié |
| Valeur faciale acceptée par le fournisseur (`supplierPriceIssue` → `checkSupplierUnitPrice`) | `createDigitalCheckout` | encaisser puis découvrir `WRONG_PRODUCT_PRICE` |
| Dénomination disponible + quantité ≤ maximum | `createFazercardsCheckout` | vendre un montant retiré du catalogue |
| Solde fournisseur suffisant (`balanceGate`) | `createFazercardsCheckout` | encaisser une vente non finançable |
| Devise / mode fournisseur (sandbox vs réel) | `createDigitalCheckout` | livrer un code de test à un client payant |

Aucun de ces contrôles n'est mis en cache : ils lisent la base et le
fournisseur à chaque commande. Un prix affiché 60 secondes en retard ne peut
donc jamais devenir un prix **facturé** erroné : le total est recalculé côté
serveur et la commande est refusée avant paiement si quoi que ce soit a changé.

## En-têtes HTTP

- `/api/digital/products` : `Cache-Control: public, s-maxage=300,
  stale-while-revalidate=3600` (réponse catalogue, jamais utilisée pour
  facturer) et lecture via le cache de données partagé.
- `/api/fazercards/catalog` : `public, max-age=60, stale-while-revalidate=300`
  (inchangé ; le checkout, lui, lit la source pour vérifier disponibilité et
  solde).

## Réglages et diagnostic

- `DIGITAL_CATALOG_REVALIDATE_SECONDS = 60` et
  `SITE_DATA_REVALIDATE_SECONDS = 300` sont définis dans
  `src/lib/cache-tags.ts` — bornes de sécurité, pas la fraîcheur attendue.
- Un `console.warn` `[cache] invalidation « … » impossible hors requête Next`
  signale une purge tentée hors contexte (script, test) : normal, sans effet.
- `npm run doctor` reste le diagnostic de référence (base, crons, file de
  livraison).

## Vérifier le gain

1. **TTFB / cache** — `curl -sI https://nokhba.net.ly/codes | grep -i cache`
   puis deux requêtes successives : la seconde ne doit déclencher aucune
   lecture Neon (vérifiable dans la console Neon : « queries per minute »
   doit devenir quasi plat sur `/codes`).
2. **Invalidation** — changer un prix dans `/admin/digital`, recharger
   `/codes` : le nouveau prix doit apparaître sans redéploiement ni attente.
3. **Panne** — couper la base (`DATABASE_URL` invalide en preview) : le
   bandeau « boutique momentanément indisponible » doit apparaître, et
   **disparaître** dès le retour (le snapshot de panne n'est jamais mémorisé
   comme un catalogue).

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/lib/cache-tags.ts` | noyau pur : tags, TTL, plan d'invalidation |
| `src/lib/catalog-cache.ts` | enveloppes `unstable_cache` (catalogue public, réglages) |
| `src/lib/cache-invalidate.ts` | `revalidateTag`/`updateTag` + `revalidatePath`, best effort |
| `src/lib/digital-store.ts` | `clearPublicCatalogCache()` purge mémo + cache partagé + HTML |
| `src/lib/store.ts` | `buildSiteData()` (pur, testable) + invalidation dans `upsertSetting`/`deleteSetting` |
| `src/app/(site)/codes/**`, `src/app/(site)/page.tsx` | lisent `getPublicCatalogCached()` |
| `src/app/api/digital/products/route.ts` | catalogue API via cache partagé + en-têtes CDN |
| `scripts/catalog-cache.test.mjs` | 12 tests : noyau + câblage + contrepartie temps réel |
