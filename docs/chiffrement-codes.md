# Chiffrement des codes livrés — clé dédiée et rotation

Les données les plus sensibles du site ne sont jamais stockées en clair :

| Colonne | Contenu | Module |
| --- | --- | --- |
| `digital_orders.codes_cipher` | JSON des codes achetés (n° de carte, PIN) | `src/lib/digital-codes.ts` |
| `phone_card_payments.code_cipher` | Code de recharge Libyana / Al Madar saisi par le client | `src/lib/digital-codes.ts` |
| `site_deliveries.tracking_token_cipher` | Jeton du lien de validation d'une livraison | `src/lib/delivery-tokens.ts` |

Chiffrement **AES-256-GCM**, format `iv.tag.chiffré` (base64url). La clé est
dérivée d'un secret d'environnement par SHA-256 :

```
codes   : sha256("nukhba-digital-codes:"   + secret)
jetons  : sha256("nukhba-delivery-token:"  + secret)
```

## Pourquoi une clé dédiée

Le repli historique est `SESSION_SECRET`. Il a un défaut grave : renouveler la
session — le geste d'incident le plus courant — **détruit** la clé qui déchiffre
les codes. Les cartes déjà achetées, livrées ou non, deviennent illisibles.

C'est pourquoi la clé de chiffrement des données est séparée (`DIGITAL_CODES_SECRET`).

## Le trousseau (key ring)

`digitalCodesKeyRing()` renvoie les clés **dans l'ordre de lecture** :

1. `DIGITAL_CODES_SECRET` — clé courante, seule utilisée pour **chiffrer** ;
2. `DIGITAL_CODES_SECRET_PREVIOUS` — anciennes clés, **lecture seule**
   (liste séparée par des virgules) ;
3. `SESSION_SECRET` — repli historique, lecture seule, désactivable.

Le déchiffrement essaie chaque clé jusqu'à ce que le tag GCM soit valide. Il en
résulte qu'**ajouter `DIGITAL_CODES_SECRET` ne casse rien** : les lignes déjà en
base restent lisibles par le repli, et les nouvelles utilisent la clé dédiée.

Sans aucun secret, le chiffrement est refusé : un achat de code est refusé
(`digital-orders.ts`) et la fenêtre « carte téléphonique » répond 503.

## Mise en place (première fois)

L'ordre compte. Le script ré-chiffre des lignes : il lit `.env.local` (ou les
variables exportées), donc `DATABASE_URL` doit pointer la base **réelle**.

```bash
# 1. Générer le secret
openssl rand -hex 32

# 2. Vercel → Settings → Environment Variables (Production + Preview)
#    DIGITAL_CODES_SECRET=<valeur>       puis REDÉPLOYER
#    (les variables sont lues au démarrage du serveur)

# 3. Couper le repli de session dans l'environnement local et simuler
#    (.env.local : DIGITAL_CODES_SECRET + DATABASE_URL + SESSION_SECRET réel)
npm run codes:rotate

# 4. Migrer réellement
npm run codes:rotate -- --apply

# 5. Vérifier : doit annoncer « 0 ligne à migrer »
npm run codes:rotate

# 6. Couper le repli historique
#    Vercel → DIGITAL_CODES_DROP_LEGACY_FALLBACK=true, puis REDÉPLOYER
```

Pendant la migration, l'application peut rester en ligne : les lignes non encore
migrées restent lisibles par le repli.

## Rotation suivante (clé compromise, ou hygiène annuelle)

```bash
# 1. L'ancienne clé passe en lecture seule, la nouvelle devient courante
DIGITAL_CODES_SECRET=<nouvelle>
DIGITAL_CODES_SECRET_PREVIOUS=<ancienne>
# (plusieurs anciennes : "ancienne, encore-plus-ancienne")

# 2. Redéployer, puis migrer
npm run codes:rotate
npm run codes:rotate -- --apply
npm run codes:rotate            # → 0 ligne à migrer

# 3. Retirer l'ancienne valeur de DIGITAL_CODES_SECRET_PREVIOUS, redéployer
```

## Ce que fait `npm run codes:rotate`

- **Simulation par défaut** ; rien n'est écrit sans `--apply` (transaction unique).
- Parcourt les trois colonnes ci-dessus, par lots de 200 lignes.
- Pour chaque ligne : identifie la clé qui la déchiffre ; si ce n'est pas la clé
  courante, la ré-chiffre avec elle.
- Pour les recharges téléphoniques, **recalcule `code_fingerprint`** (HMAC-SHA256
  de la clé courante) : sans cela, la détection de doublon se dégraderait après
  rotation. Une collision signifie que le même code a été soumis deux fois ; elle
  est signalée, la ligne n'est pas écrasée.
- Signale les lignes **illisibles** : un secret a alors été retiré trop tôt →
  le remettre dans `DIGITAL_CODES_SECRET_PREVIOUS`.
- N'affiche jamais un code en clair : uniquement des références de commande
  (`DGC-…`, `LIV-…`).

## Diagnostics

- `GET /api/health` (avec `?key=$CRON_SECRET`) expose un bloc `codes` :

  | Champ | Lecture |
  | --- | --- |
  | `keySource` | `dedicated` (clé dédiée), `session` (repli historique) ou `none` |
  | `keyCount` | clés acceptées en lecture (courante + anciennes + repli) |
  | `rotationPending` | **il peut rester des lignes hors clé courante** |
  | `legacyFallbackActive` | le repli de session est encore autorisé |

  `rotationPending` est le **seul signal fiable** : la simple présence de
  `DIGITAL_CODES_SECRET` ne prouve pas que la migration est faite (la variable
  a pu être ajoutée après des ventes). L'état idéal est
  `keySource: "dedicated"`, `keyCount: 1`, `rotationPending: false`.
  La route ajoute aussi un avertissement lisible dans les deux cas de dette.
- `npm run doctor` signale le repli de session actif et renvoie vers
  `npm run codes:rotate`.
- `npm run test:crypto` vérifie que les charges chiffrées **avant** la
  séparation restent lisibles et que le chiffrement n'utilise jamais une
  ancienne clé.

## À ne pas faire

- Ne **jamais** renouveler `SESSION_SECRET` tant que `codes.keySource` vaut
  `session` : tous les codes stockés deviendraient définitivement illisibles.
- Ne pas définir `DIGITAL_CODES_DROP_LEGACY_FALLBACK=true` avant que
  `codes:rotate` n'annonce 0 ligne à migrer.
- Ne pas supprimer une ancienne valeur de `DIGITAL_CODES_SECRET_PREVIOUS` avant
  d'avoir vérifié que plus aucune ligne ne dépend d'elle.
