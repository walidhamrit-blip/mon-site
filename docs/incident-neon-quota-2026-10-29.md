# Incident du 29/10/2026 — quota Neon épuisé, boutique fermée sans le dire

**Résumé en une phrase :** le quota de calcul du forfait gratuit Neon a été
épuisé ; la base a été suspendue ; le site a continué d'afficher **8 fiches de
démonstration** comme si c'était le catalogue, a publié ces 8 URLs dans son
sitemap, et a répondu **500** au formulaire de contact **sans envoyer
d'e-mail** — donc en perdant les demandes.

Durée : environ **3 jours** (jusqu'à la réinitialisation du quota, ou passage
au plan Launch). Aucune donnée perdue côté base.

---

## 1. Chronologie

| Moment | Événement |
|---|---|
| 29/10/2026, avant 08:00 UTC | Le site de production ne sert plus que 8 produits ; les ~390 fiches `/codes/fzr-*` renvoient **404** |
| 08:23 UTC | `/api/health` : `database.connected: false` — `Failed query: select 1 / params:` ; `fazercards.catalog.products: 0` |
| ~08:30 UTC | L'e-mail d'alerte Neon est identifié : **limite du forfait gratuit atteinte** |
| — | Le projet Neon passe au plafond **0,25 CU** (au lieu de 2 CU) pour que le quota dure 8 fois plus longtemps |
| — | Test de la boîte `contact@nokhba.net.ly` : rejet **`550 5.1.1`** — la boîte n'a jamais existé |
| 10:08 UTC | La sonde corrigée donne la cause exacte : `Your account or project has exceeded the quota. Upgrade your plan to increase limits. | code=53000` |
| 10:08 UTC | Elle révèle aussi que `LEAD_NOTIFICATION_EMAIL` vaut littéralement **`LEAD_NOTIFICATION_EMAIL`** (le nom collé à la place de la valeur) : les notifications partaient vers une adresse inexistante |

---

## 2. Pourquoi le site n'a pas dit qu'il était en panne

Trois replis silencieux se cumulaient :

1. **`getStoredCatalog()`** — si la base ne répond pas, elle renvoie
   `defaultDigitalProducts` (8 fiches codées en dur). C'est un bon garde-fou
   pour un site vitrine, désastreux pour une boutique : le visiteur voit un
   catalogue crédible, sans rien pour acheter.
2. **`getDigitalProductBySlug()`** — les 390 slugs du fournisseur ne sont pas
   dans ce repli : ils deviennent des 404.
3. **`/api/lead`** — l'insertion en base précède l'envoi des e-mails. Base
   indisponible ⇒ exception ⇒ `500` ⇒ **aucun e-mail**. La demande n'existait
   nulle part.

Le diagnostic était tout aussi muet : `/api/health` affichait le message
générique de Drizzle (`Failed query: select 1`), qui ne dit pas si la base est
suspendue, si le mot de passe est refusé ou si la machine est introuvable.

---

## 3. Correctifs livrés (PR « boutique en panne »)

| Fichier | Correctif |
|---|---|
| `src/lib/digital-store.ts` | `digitalCatalogStatus()` : état `degraded` + cause + horodatage. Enregistré **seulement si `DATABASE_URL` est configurée** (le repli local/CI n'est pas une panne) et effacé dès qu'une lecture réussit. Mémo public de 2 min (`PUBLIC_CATALOG_TTL_MS`), invalidé à chaque écriture admin, jamais alimenté par un repli de panne. |
| `src/components/store-status-notice.tsx` | Bandeau serveur « boutique en maintenance » + CTA WhatsApp ; page d'attente pour une fiche produit. Sans `"use client"` : lisible même si l'hydratation échoue. |
| `src/app/(site)/codes/page.tsx` | Bandeau, grille masquée, `ItemList` et offres `Store` **non émis** pendant la panne (on n'apprend pas à Google que la boutique vend 8 produits). |
| `src/app/(site)/codes/[slug]/not-found.tsx` | 404 distingué : « maintenance » pendant une panne, « produit retiré » sinon — avec WhatsApp dans les deux cas. |
| `src/app/sitemap.ts` | Aucune fiche produit pendant la panne : le sitemap ne propose plus de 404 au crawl. |
| `src/app/api/lead/route.ts` | Les e-mails partent **même si l'insertion échoue**. Réponse `503` + `fallback: "whatsapp"` uniquement si la base **et** l'e-mail ont échoué. `{ ok: true, saved: false }` si la demande n'a survécu que par e-mail. |
| `src/components/sections/cta-form.tsx` | Message d'erreur bilingue + lien WhatsApp pré-rempli (il était en français uniquement). |
| `src/app/api/health/route.ts` | `describeError()` remonte la chaîne `cause` (message + `code` Postgres), `redact()` masque toute chaîne de connexion, `databaseHint()` traduit la cause en une phrase actionnable, `catalog` (état) et `warnings[]` (ce qui bloque aujourd'hui). |
| `src/lib/mailer.ts` | `EMAIL_REPLY_TO` : adresse de réponse par défaut des e-mails transactionnels. Aucune valeur inventée — sans variable, comportement inchangé. |
| `scripts/store-degraded.test.mjs` | 10 tests de non-régression sur tout ce qui précède (ajoutés à `npm run test:digital`). |

---

## 4. Ce qui reste à faire par le propriétaire

1. **Vérifier la consommation Neon** : `console.neon.tech → Billing` indique
   laquelle des trois jauges est à 100 % (compute, transfert, stockage) et la
   **date de réinitialisation**.
2. **Ne pas remonter le plafond de calcul** (Settings → Compute → 0,25 CU) :
   c'est ce réglage qui évite la récidive.
3. **Créer les boîtes `contact@` et `no-reply@`** dans Zoho, puis définir sur
   Vercel `EMAIL_REPLY_TO` et `LEAD_NOTIFICATION_EMAIL`
   (voir `docs/apres-deploiement.md` § 6).
4. **Corriger `LEAD_NOTIFICATION_EMAIL`** sur Vercel : la valeur actuelle
   n'est pas une adresse e-mail (c'est le nom de la variable). Depuis le
   correctif, elle est ignorée par sécurité et `/api/health` le signale.
5. **Au retour de la base** : `/api/health` → `database.connected: true` et
   `catalog.degraded: false`, puis `/codes` doit réafficher les ~399 produits
   dans la minute (le mémo de panne n'est jamais mis en cache).

---

## 5. Prévention : ce qui consomme le quota

| Poste | Consommation | Réglage appliqué |
|---|---|---|
| Taille du calcul | 2 CU = quota épuisé en ~50 h ; 0,25 CU = ~400 h | **0,25 CU** |
| Mise en veille | 5 min d'inactivité (forfait gratuit, non modifiable) | conservée |
| `/codes` | rendu par requête (`force-dynamic`) | mémo de 2 min |
| Fiches produit | ISR 60 s | inchangé (correction d'un catalogue périmé trop coûteuse à relâcher) |
| Sitemap | rendu par requête | inchangé (une lecture légère, quelques fois par jour) |
| Cron catalogue | 1×/jour (`vercel.json` : `0 4 * * *`) | inchangé |
| `getSiteData()` | 1 lecture de `settings` par page | déjà mémorisé par requête (`cache()`) |

**Ordre de grandeur :** à 0,25 CU, 100 CU-heures couvrent ~400 heures de base
éveillée — soit ~13 h/jour en moyenne. Une boutique qui vend quelques commandes
par jour reste largement dessous. Le dépassement venait du plafond à 2 CU, pas
du trafic.
