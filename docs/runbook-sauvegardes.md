# Runbook — sauvegardes et restauration

> Ce document décrit ce qui est réellement sauvegardé, comment le restaurer,
> et ce qui reste à la charge du propriétaire du compte.

## 1. Ce qui est couvert

| Donnée | Sauvegarde | Où |
|---|---|---|
| Table `leads` (demandes entrantes) | `npm run backup:leads` | fichier JSON local, `backups/`, ignoré par Git |
| **Base entière** (schéma + toutes les tables) | `npm run backup:db` | dump SQL compressé local, `backups/`, ignoré par Git |
| Sauvegardes du fournisseur | **aucune sur le plan Free** | constat du 26/11/2026 : « No backups » |
| Code et contenu du site | Git + GitHub | dépôt `walidhamrit-blip/mon-site` |

La table `leads` contient des **données personnelles** (nom, téléphone,
e-mail). Un fichier de sauvegarde ne se committe jamais, ne s'envoie pas par
messagerie et ne se dépose pas dans un dossier public.

## 2. Sauvegarder

```bash
DATABASE_URL='postgresql://…' npm run backup:leads
# ou vers un autre dossier :
DATABASE_URL='…' node scripts/backup-leads.mjs --out /chemin/vers/dossier
```

Le script affiche le nombre de lignes et l'empreinte SHA-256 du fichier.
Conserver l'empreinte à côté du fichier permet de vérifier plus tard qu'il
n'a pas été altéré.

**Rythme** : une fois par semaine, et juste avant toute opération risquée
(migration, changement de fournisseur, restauration).

### Base entière

```bash
DATABASE_URL='postgresql://…' npm run backup:db
# → backups/db-2026-11-26T08-15-00-000Z.sql.gz
```

Le script s'appuie sur `pg_dump` (fourni avec le client PostgreSQL) et produit
un dump **schéma + données**, compressé, lisible par `psql`. C'est la seule
protection possible aujourd'hui : le projet Supabase est sur le plan **Free**,
et son tableau de bord affiche « No backups » (constat du 26/11/2026).

Conserver ces dumps **chiffrés** : ils contiennent les commandes, les clients
et les réglages. Les codes numériques restent chiffrés par l'application, mais
les noms et téléphones, eux, sont en clair.

## 3. Restaurer

Le script refuse un fichier incohérent (version inconnue, compte faux,
identifiant dupliqué, colonne obligatoire vide) avant de toucher à la base.

```bash
# 1. Simulation : aucune écriture, on voit ce qui serait fait
node scripts/restore-leads.mjs --file backups/leads-2026-11-20T19-30-00-000Z.json

# 2. Écriture réelle
node scripts/restore-leads.mjs --file backups/leads-….json --confirm
```

- Seules les lignes **absentes** sont réinsérées : rien n'est écrasé.
- Les identifiants d'origine sont préservés, et la séquence `id` est
  réavancée pour que les prochaines demandes ne collisionnent pas.
- En cas d'erreur en cours d'écriture, la transaction est annulée.

### Restaurer un dump complet

```bash
# 1. Simulation : affiche la cible et la taille, n'écrit rien
node scripts/restore-db.mjs --file backups/db-….sql.gz

# 2. Restauration réelle (remplace le contenu de la base cible)
node scripts/restore-db.mjs --file backups/db-….sql.gz --confirm
```

⚠️ Le dump contient des `DROP … IF EXISTS` : la restauration **remplace** les
tables existantes. Ne jamais la lancer sur la production sans avoir vérifié la
cible affichée.

## 4. Preuve que ça marche

`.github/workflows/sauvegardes.yml` démarre un vrai PostgreSQL 16 à chaque
pull request et à chaque push sur `main` : il crée la table, sauvegarde trois
lignes, **vide la table**, restaure, puis vérifie que les 3 lignes sont
revenues, que les identifiants sont intacts et que la séquence repart à 4.

Le second job, « base-complete », fait le même exercice avec un dump complet :
il crée une table, l'insère dans trois lignes, sauvegarde **toute la base**,
la supprime, restaure, puis vérifie que les trois lignes sont revenues.

Si ce workflow est rouge, la restauration n'est pas fiable : ne pas s'appuyer
dessus en cas d'incident.

## 5. Limites assumées

- **Pas de copie hors site automatique** : le fichier reste sur la machine qui
  lance la commande. Une copie chiffrée sur un stockage externe reste à faire.
- **Aucune sauvegarde fournisseur** : le projet Supabase `g2g-test` est sur le
  plan Free et affiche « No backups » (26/11/2026). Il n'y a donc ni rétention
  ni point-in-time recovery à espérer : nos exports sont l'unique filet.
- **Sauvegarde non automatique** : rien ne déclenche `backup:db` tout seul.
  Tant que ce n'est pas planifié, la perte maximale reste celle du dernier
  export manuel.
- **RPO/RTO** : visés à 7 jours de perte maximale (sauvegarde hebdomadaire) et
  1 heure de remise en service. À réévaluer si le volume de commandes augmente.
- **Restauration partielle seulement** : seule `leads` est couverte par nos
  scripts. Les autres tables dépendent du fournisseur.

## 6. Exercice trimestriel

À faire dans cet ordre, en cochant la date :

- [ ] Lancer `npm run backup:leads` et vérifier le nombre de lignes attendu.
- [ ] Restaurer cette sauvegarde dans une base vide ou une branche Neon.
- [ ] Vérifier l'empreinte SHA-256 du fichier utilisé.
- [ ] Noter la durée réelle de restauration : ______ min.
- [ ] Vérifier dans le tableau de bord du fournisseur que les sauvegardes
      automatiques existent et que la rétention est celle annoncée.
