# Runbook — sauvegardes et restauration

> Ce document décrit ce qui est réellement sauvegardé, comment le restaurer,
> et ce qui reste à la charge du propriétaire du compte.

## 1. Ce qui est couvert

| Donnée | Sauvegarde | Où |
|---|---|---|
| Table `leads` (demandes entrantes) | `npm run backup:leads` | fichier JSON local, `backups/`, ignoré par Git |
| Reste de la base (réglages, commandes) | sauvegardes du fournisseur Postgres | tableau de bord Neon / Supabase |
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

## 4. Preuve que ça marche

`.github/workflows/sauvegardes.yml` démarre un vrai PostgreSQL 16 à chaque
pull request et à chaque push sur `main` : il crée la table, sauvegarde trois
lignes, **vide la table**, restaure, puis vérifie que les 3 lignes sont
revenues, que les identifiants sont intacts et que la séquence repart à 4.

Si ce workflow est rouge, la restauration n'est pas fiable : ne pas s'appuyer
dessus en cas d'incident.

## 5. Limites assumées

- **Pas de copie hors site automatique** : le fichier reste sur la machine qui
  lance la commande. Une copie chiffrée sur un stockage externe reste à faire.
- **Sauvegardes du fournisseur non vérifiées** : la rétention et le
  point-in-time recovery de Neon/Supabase doivent être confirmés dans leur
  tableau de bord, pas supposés.
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
