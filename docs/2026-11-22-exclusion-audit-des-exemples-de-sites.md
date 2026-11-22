# Exclusion du service audit des exemples de modèles de sites — 22 novembre 2026

- **Site :** Nukhba / Nokhba — نخبة (création de sites et boutiques, Tripoli)
- **Branche :** `arena/3f951237-mon-site`
- **Nature :** correction de contenu (aucune donnée métier modifiée)

## Problème

Le service audit (`fix-optimize`, page `/audit`) — une offre à part entière —
apparaissait comme un « exemple de modèle de site » dans la galerie
« Exemples & réalisations » (`/demos`). Une fiche portant le slug
`audit-de-site` y était listée (`/demos/audit-de-site?lang=en`), aux côtés
des autres fiches :

- sur `/demos` (et son schema `CollectionPage` / `ItemList`) ;
- sur `/demos/audit-de-site` (fiche « exemple ») ;
- dans `/sitemap.xml`, `/llms.txt` et la liste des fiches du panneau
  d'administration (`/admin` → « Exemples & réalisations »).

C'est faux : l'audit est un service, pas un modèle de site. Les modèles
sont les sites qu'on montre et que le visiteur personnalise (`myphone-tripoli`,
`tulin-magazin`, …).

## Constat

- La fiche fautive n'existe **pas dans le dépôt** : `src/lib/content.ts` ne
  contient que les 13 modèles + 8 applications. Le dépôt est propre.
- La fiche vit dans la base (`settings`, clé `content_demos`), écrite depuis
  l'admin. C'est donc une **erreur de contenu de production**, pas un bug
  de code.
- Dès que la fiche est retirée de la base, `/demos` et `/demos/audit-de-site`
  sont conformes : la page de la fiche fautive renverra 404, comme toute
  fiche qui n'existe plus.

## Correctif en deux temps

### 1. Retirer la fiche (choix de l'opérateur)

**Option A — script (recommandée si la base est accessible depuis une machine
appartenant au site) :**

```bash
npm run demos:prune-audit          # simulation : affiche ce qui sera retiré
npm run demos:prune-audit -- --apply   # écrit en base
```

Écriture : `settings.content_demos` en upsert idempotent. Aucune donnée
secrète n'est lue ni affichée (slugs et titres publics uniquement).

**Option B — admin (aucune donnée sensible, interface) :**

`/admin` → « Exemples & réalisations » → supprimer la fiche `audit-de-site`
→ enregistrer.

### 2. Revalider les pages publiques

L'application invalidate elle-même les caches quand l'admin enregistre une
modification ; le script écrit directement en base, donc :

- soit via l'admin (enregistrer quelque chose de cosmétique, ou utiliser
  l'Option B), ce qui déclenche `revalidatePath` ;
- soit par un redéploiement.

Sinon, le site affichera l'ancienne liste le temps du TTL (quelques minutes).

## Points de rejet

- Pas de filtre codé en dur sur le slug dans la galerie : cela masquerait la
  fiche sans réellement corriger la donnée, et masquerait aussi une fiche
  légitime si elle était ajoutée à nouveau.
- Aucun changement de schéma : `Demo` reste « site modèle » et ne connaît
  pas « service » (et ne doit pas le faire).
- Le service audit reste commercialisé comme tel : `/audit`, `/services`,
  `/services/fix-optimize`, llms.txt (section services) et son schéma
  `Service`/`Offer` sont inchangés.

## Vérification

- `npm run test:ops` / `node --test scripts/remove-audit-service-demo.test.mjs`
  (logique de retrait : 7 cas).
- Visuellement : `/demos` ne liste plus `audit-de-site`, et
  `/demos/audit-de-site` renvoie 404.
