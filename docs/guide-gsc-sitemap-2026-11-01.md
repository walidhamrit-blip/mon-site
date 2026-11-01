# Configurer le sitemap dans Google Search Console — pas à pas

- **Site concerné :** `nokhba.net.ly`
- **Guide vérifié le :** 1er novembre 2026
- **URL du sitemap :** **https://nokhba.net.ly/sitemap.xml**
- **Durée de manipulation indicative :** 15–30 minutes, hors propagation DNS et traitement par Google.

> **Le sitemap existe déjà.** Il est généré par Next.js dans `src/app/sitemap.ts` et annoncé dans le robots public. Tu n’as pas besoin d’un plugin SEO, d’un générateur externe ou d’un nouveau fichier dans `public/`.
>
> Ce guide explique la procédure ; aucune propriété GSC n’a été créée, aucun sitemap soumis et aucun réglage de production modifié pendant l’audit. Pour le diagnostic du site : [audit complet SEO/GEO du 1er novembre](./audit-seo-geo-2026-11-01.md).

## Les valeurs à utiliser

| Champ | Valeur pour ton site |
|---|---|
| Propriété **Domaine**, méthode recommandée | `nokhba.net.ly` |
| Propriété **Préfixe de l’URL**, alternative | `https://nokhba.net.ly/` |
| Adresse complète du sitemap | `https://nokhba.net.ly/sitemap.xml` |
| Si le champ affiche déjà `https://nokhba.net.ly/` | Saisir seulement `sitemap.xml` |
| Déclaration à retrouver dans robots.txt | `Sitemap: https://nokhba.net.ly/sitemap.xml` |

**Attention à l’orthographe :** le domaine est `nokhba.net.ly`, même si la marque peut aussi s’écrire Nukhba. Ne pas soumettre le domaine d’un aperçu d’hébergement.

## Étape 1 — Vérifier le sitemap public

Ouvre ces deux liens dans une fenêtre privée :

1. https://nokhba.net.ly/sitemap.xml
2. https://nokhba.net.ly/robots.txt

Pour le sitemap, tu dois voir du XML avec des URL du site, pas une page d’accueil, une connexion, une protection anti-bot ou une erreur. Une mention du navigateur comme « ce fichier XML ne semble pas avoir d’informations de style » est normale.

Dans robots.txt, retrouve :

```text
Sitemap: https://nokhba.net.ly/sitemap.xml
```

**Constat de l’audit :** les deux ressources étaient accessibles ; des fiches produits fournisseur étaient présentes dans les extraits du sitemap. Cela ne prouve pas encore sa soumission ni sa lecture dans ton compte GSC.

Ne vise pas un nombre historique fixe comme « 450 URL ». Le catalogue public affichait **788 produits** lors de l’audit, mais le sitemap ne contient que les fiches éligibles, plus les autres pages. Son total exact est à relever ; le nombre de produits affichés n’est pas celui des pages indexées.

## Étape 2 — Ouvrir Search Console et choisir la bonne propriété

Va sur : **https://search.google.com/search-console/**

Connecte-toi au compte Google qui doit gérer le site.

### Si la propriété existe déjà

Dans le sélecteur en haut à gauche, choisis :

- `nokhba.net.ly` pour une propriété Domaine ; ou
- `https://nokhba.net.ly/` pour la propriété Préfixe correspondante.

Si elle est déjà validée et que tu disposes des droits nécessaires, passe à l’étape 4. Ne crée pas plusieurs variantes par réflexe.

### Si elle n’existe pas

Clique sur **Ajouter une propriété**, puis choisis une des deux méthodes ci-dessous. La propriété Domaine couvre les protocoles et sous-domaines ; la propriété Préfixe couvre uniquement l’adresse et le périmètre saisis. [1](https://support.google.com/webmasters/answer/9008080?hl=en)

## Étape 3A — Méthode recommandée : propriété Domaine et validation DNS

Cette méthode nécessite l’accès au gestionnaire DNS faisant autorité pour le domaine.

1. Dans **Domaine**, saisis exactement :

   ```text
   nokhba.net.ly
   ```

   Pas de `https://`, pas de `www`, pas de chemin.

2. Clique sur **Continuer**.
3. Google propose généralement un enregistrement TXT. Copie **la valeur exacte donnée pour ton compte**, qui commence par :

   ```text
   google-site-verification=...
   ```

4. Ouvre le panneau DNS de ton domaine. Il faut intervenir là où sont gérés les serveurs DNS autoritaires : ce n’est pas nécessairement chez l’hébergeur du site.
5. Ajoute un nouvel enregistrement :

   | Paramètre | À renseigner |
   |---|---|
   | Type | `TXT` |
   | Nom / Host | `@` ou vide **si la zone gérée est `nokhba.net.ly`** ; sinon le nom relatif approprié pour créer le TXT exactement sur `nokhba.net.ly` |
   | Valeur | La chaîne complète fournie par GSC |
   | TTL | Valeur par défaut du gestionnaire, par exemple 3 600 secondes |

6. Vérifie que le panneau n’a pas ajouté le domaine deux fois au nom de l’enregistrement.
7. Enregistre, attends la propagation, puis retourne dans GSC et clique sur **Valider**.
8. Si Google ne le voit pas immédiatement, laisse l’enregistrement en place et réessaie plus tard. Vérifie d’abord son nom et les serveurs DNS utilisés ; la propagation peut prendre du temps.
9. **Conserve le TXT après validation.** Google peut revérifier la propriété. [1](https://support.google.com/webmasters/answer/9008080?hl=en)

**Ne remplace pas** les enregistrements A/CNAME, MX, SPF, DKIM ou DMARC pour cette opération. Il s’agit d’ajouter un TXT de validation, pas de reconfigurer le site ou les e-mails. Si GSC te fournit une procédure CNAME spécifique, respecte ses noms et valeurs exacts au lieu d’inventer un TXT.

> La balise HTML et le fichier de validation ne valident pas une propriété **Domaine**. Pour celle-ci, utilise la validation DNS.

## Étape 3B — Alternative sans accès DNS : propriété Préfixe de l’URL

1. Dans **Préfixe de l’URL**, saisis :

   ```text
   https://nokhba.net.ly/
   ```

2. Clique sur **Continuer**.
3. Choisis **Balise HTML** parmi les méthodes proposées.
4. Google affiche une balise semblable à :

   ```html
   <meta name="google-site-verification" content="VALEUR_FOURNIE_PAR_GOOGLE" />
   ```

5. Le projet sait déjà générer cette balise. Dans les variables serveur de l’environnement **Production** chez l’hébergeur, renseigne :

   ```text
   GOOGLE_SITE_VERIFICATION=VALEUR_FOURNIE_PAR_GOOGLE
   ```

   Mets uniquement le contenu de `content`, sans balise HTML, sans le préfixe `google-site-verification=` du TXT DNS.

6. Redéploie pour que le déploiement de production prenne en compte la variable.
7. Affiche le **code source** de l’accueil publié et recherche `google-site-verification`. Confirme que la valeur est exactement celle de ton compte et qu’elle apparaît dans le `<head>` initial.
8. Retourne dans GSC et clique sur **Valider**. Garde ensuite la validation en place.

**Autre possibilité : fichier HTML.** Télécharge le fichier exact proposé par GSC, place-le dans `public/`, déploie et vérifie son accès à la racine avant de valider. Le fichier historique suivant existe déjà et était accessible :

```text
https://nokhba.net.ly/googleaf08e19c9e7d8550.html
```

Sa présence ne prouve pas que **ton compte** est validé. Utilise-le seulement si Google te demande exactement ce fichier ; sinon conserve la validation existante et ajoute celle de ton propre compte. Ne réutilise pas au hasard un ancien jeton. [1](https://support.google.com/webmasters/answer/9008080?hl=en)

## Étape 4 — Vérifier les autorisations

Pour envoyer un sitemap, utilise un compte **propriétaire** ou avec **accès complet** à la propriété. L’accès limité ne suffit pas. Le propriétaire peut attribuer les droits dans **Paramètres → Utilisateurs et autorisations**. [1](https://support.google.com/webmasters/answer/7687615?hl=en)

Le commentaire historique du fichier `src/lib/google-indexing.ts` mentionne à tort un accès « Restreint » pour l’automatisation : ne pas suivre cette indication.

## Étape 5 — Envoyer le sitemap

1. Confirme la propriété sélectionnée en haut à gauche.
2. Ouvre **Indexation → Sitemaps** dans le menu.
3. Dans **Ajouter un sitemap** :

   **Si le champ est entièrement vide**, saisis :

   ```text
   https://nokhba.net.ly/sitemap.xml
   ```

   **Si l’interface affiche déjà `https://nokhba.net.ly/` devant le champ**, saisis seulement :

   ```text
   sitemap.xml
   ```

4. Clique sur **Envoyer**.
5. Ouvre la ligne du sitemap pour consulter son état et la dernière lecture.
6. Note la date d’envoi, puis le statut et le nombre de pages découvertes lorsqu’ils sont disponibles.

**N’envoie pas :**

- l’accueil à la place du sitemap ;
- `robots.txt`, `llms.txt` ou `llms-full.txt` ;
- un sitemap local, de preview ou d’un ancien domaine ;
- `sitemap_index.xml`, sauf si ce fichier a réellement été créé — ce n’est pas le point d’entrée actuel du projet.

Si la ligne existe déjà et est correctement lue, il est inutile de la supprimer pour recommencer. Le rapport Sitemaps permet de suivre les récupérations et erreurs ; il ne garantit pas l’indexation des URL. [1](https://support.google.com/webmasters/answer/7451001?hl=en)

## Étape 6 — Lire le résultat sans confondre les étapes

| Ce que tu vois | Ce que cela signifie |
|---|---|
| Envoi accepté | GSC a enregistré l’adresse ; le traitement peut suivre |
| **Réussi** / **Opération effectuée** selon l’interface | Le sitemap a été récupéré et traité sans erreur signalée |
| Pages découvertes | URL connues via ce sitemap, pas nécessairement indexées |
| Dernière lecture | Dernière récupération connue par Google |
| Impossible de récupérer | Problème de récupération à diagnostiquer |
| Contient des erreurs | Fichier récupéré, avec erreurs détaillées à examiner |

Les libellés peuvent varier légèrement avec la langue et l’évolution de l’interface. Reviens vérifier le rapport après le traitement ; il n’existe pas de délai garanti pour l’indexation. [1](https://support.google.com/webmasters/answer/7451001?hl=en)

## Étape 7 — Inspecter quelques pages importantes

Dans la barre **Inspecter n’importe quelle URL**, contrôle par exemple :

1. `https://nokhba.net.ly/`
2. `https://nokhba.net.ly/creation-sites`
3. `https://nokhba.net.ly/codes`
4. `https://nokhba.net.ly/codes/fzr-topup-pubg-mobile-auto`
5. `https://nokhba.net.ly/codes/fzr-giftcard-steam-wallet-global`
6. `https://nokhba.net.ly/blog/website-cost-libya-2026`

Utilise les fiches encore publiées et utiles au moment de la manipulation. Pour chacune :

- relève si elle est connue et indexée ;
- compare la canonical déclarée et celle choisie par Google lorsqu’elles sont disponibles ;
- en cas de doute, lance **Tester l’URL publiée** pour contrôler l’accessibilité actuelle ;
- demande l’indexation d’une petite sélection de pages importantes après correction, si l’action est proposée.

**Le test en direct ne prouve pas qu’une page est déjà indexée.** Ne demande pas manuellement l’indexation de centaines de produits : conserve un sitemap fiable, des liens internes accessibles et des fiches utiles.

Les deux variantes Free Fire actuellement signalées dans l’audit méritent une correction de titre et de compatibilité avant d’en faire des modèles de soumission.

## Étape 8 — Diagnostiquer les erreurs fréquentes

| Message / situation | Vérification et action |
|---|---|
| **Impossible de récupérer** | Ouvre le sitemap en navigation privée ; vérifie DNS/TLS, réponse GET, absence de connexion, de 403/429/5xx et de challenge anti-bot. Consulte le détail GSC et le test en direct de l’URL du sitemap pour l’accessibilité |
| **Le sitemap est une page HTML** | Contrôle le corps retourné : page d’erreur, page d’accueil redirigée ou protection d’hébergement au lieu de XML |
| **URL non autorisée / hors propriété** | Vérifie protocole, `www`, domaine et éventuel sous-chemin de la propriété Préfixe. Vérifie aussi l’origine canonique générée par le site |
| **Erreur XML** | Examiner la ligne signalée, l’encodage UTF-8 et l’échappement des caractères spéciaux ; corriger le générateur, pas une copie manuelle du fichier |
| **Très peu de produits découverts** | Comparer sitemap brut et catalogue éligible. Vérifier base, copie fournisseur et état dégradé ; ne pas interpréter le catalogue local de repli comme celui de production |
| **Détectée, actuellement non indexée** | Examiner découverte, maillage et priorisation des pages. Le renvoi quotidien du sitemap ne corrige pas le problème |
| **Explorée, actuellement non indexée** | Examiner la qualité, les doublons, la différenciation des variantes et les canoniques ; le statut ne démontre pas à lui seul une cause unique |
| **Autre page avec balise canonique correcte** | Peut être normal pour un filtre ou un doublon volontaire. Vérifier que c’est bien l’URL cible souhaitée qui est indexable |
| **Exclue par noindex / bloquée par robots** | Pour une fiche publique à indexer : vérifier les directives effectives. Pour admin, paiement ou suivi : ne pas retirer les protections pour gonfler les chiffres |
| **Page avec redirection** | Soumettre et lier l’URL finale canonique, pas l’ancien alias |

La procédure officielle pour une erreur de récupération consiste notamment à ouvrir les détails du sitemap, puis utiliser le test en direct pour examiner l’accès à la ressource. [1](https://support.google.com/webmasters/answer/7451001?hl=en)

## Étape 9 — Contrôle technique facultatif depuis un terminal

À exécuter depuis ton poste ou un environnement pouvant joindre le domaine public. Les réponses HTTP de production n’ont pas été mesurées par ces commandes pendant l’audit.

```bash
curl -I https://nokhba.net.ly/sitemap.xml
curl -sS https://nokhba.net.ly/robots.txt
```

Pour contrôler une vraie réponse GET et compter les URL sans compter les images comme des pages :

```bash
python3 - <<'PY'
from urllib.request import urlopen
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

url = 'https://nokhba.net.ly/sitemap.xml'
with urlopen(url, timeout=30) as response:
    print('HTTP :', response.status)
    print('URL finale :', response.url)
    print('Content-Type :', response.headers.get('Content-Type'))
    xml = response.read()

root = ET.fromstring(xml)
ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
assert root.tag == '{' + ns['s'] + '}urlset', 'Racine XML inattendue'
urls = [node.text for node in root.findall('s:url/s:loc', ns)]
print('URL de pages :', len(urls))
print('URL uniques :', len(set(urls)))
print('Fiches produits :', sum(urlparse(u).path.startswith('/codes/') for u in urls))
print('Hôtes :', sorted({urlparse(u).hostname for u in urls}))
print('Taille non compressée :', len(xml), 'octets')
PY
```

Résultat attendu : XML lisible, URL uniques et hôte canonique prévu. Ce comptage ne teste pas l’indexation ni le statut de chaque page. Le type MIME conseillé est XML ; c’est le générateur Next.js existant qui doit le servir.

Google limite un sitemap à 50 000 URL ou 50 Mo non compressés et ignore les champs `priority`/`changefreq`. Il faut surtout publier les URL canoniques et des `lastmod` fiables. [1](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

## Étape 10 — Assurer le suivi

### Après la soumission

- Vérifie le statut et la dernière lecture.
- Note le nombre de pages découvertes, sans l’assimiler au nombre indexé.
- Contrôle les quelques URL prioritaires et leurs canoniques.
- Traite les erreurs d’accès ou de XML avant d’envoyer de nouvelles demandes.

### Chaque semaine au départ

Relève les mêmes indicateurs dans un petit tableau :

| Date | Dernière lecture / statut sitemap | URL découvertes | Pages indexées / exclusions importantes | Clics et impressions | Actions |
|---|---|---|---|---|---|
| À compléter | | | | | |

Dans **Performances**, examine ensuite les pages et requêtes, le pays et l’appareil. Compare des périodes de même durée ; si aucune donnée n’est disponible, attends le traitement sans inventer de référence de départ.

### À chaque ajout ou modification

Le sitemap du projet est dynamique et suit les sources de contenu. Pas besoin de l’envoyer à nouveau pour chaque produit. Vérifie plutôt que la fiche publiée apparaît dans le bon inventaire et reste accessible.

## Automatisation API : optionnelle, pas nécessaire pour démarrer

Le projet contient déjà un client de soumission du sitemap dans `src/lib/google-indexing.ts`. **Ne crée pas une clé privée uniquement pour cette première configuration** : la soumission manuelle suffit.

Si tu choisis ensuite cette automatisation :

1. Active l’API **Search Console** dans un projet Google Cloud.
2. Configure un compte de service adapté.
3. Ajoute son adresse comme utilisateur avec **accès complet** à la propriété GSC ; un accès restreint ne permet pas d’envoyer un sitemap. [1](https://support.google.com/webmasters/answer/7687615?hl=en)
4. Renseigne côté serveur, dans le gestionnaire sécurisé des variables Production :

   ```text
   GOOGLE_INDEXING_CLIENT_EMAIL=<adresse du compte de service>
   GOOGLE_INDEXING_PRIVATE_KEY=<clé privée conservée dans le gestionnaire de secrets>
   GOOGLE_INDEXING_SITE_URL=sc-domain:nokhba.net.ly
   ```

   Si tu utilises uniquement la propriété Préfixe, la dernière valeur doit correspondre exactement à cette propriété, ici `https://nokhba.net.ly/`.

5. Redéploie et vérifie une soumission autorisée dans GSC. Ne colle aucune clé privée dans le dépôt, les logs ou une conversation.
6. Garde les appels de notification désactivés hors production, sauf test explicitement maîtrisé.

Il s’agit de l’API **Sitemaps de Search Console**, pas de l’Indexing API. Cette dernière est réservée à des contenus particuliers d’offres d’emploi ou de vidéos en direct ; ce n’est pas une méthode d’indexation massive des fiches de cette boutique. [3](https://developers.google.com/webmaster-tools/v1/api_reference_index) [2](https://developers.google.com/search/apis/indexing-api/v3/quickstart)

## Checklist finale

- [ ] J’ai choisi `nokhba.net.ly` ou `https://nokhba.net.ly/`, pas une preview ni une mauvaise variante.
- [ ] La propriété est validée pour mon compte.
- [ ] Je suis propriétaire ou utilisateur avec accès complet.
- [ ] Le sitemap public s’ouvre sans authentification et contient du XML.
- [ ] Le robots annonce `https://nokhba.net.ly/sitemap.xml`.
- [ ] J’ai envoyé ce sitemap et relevé son état de traitement.
- [ ] Après traitement, je contrôle la dernière lecture et les erreurs éventuelles.
- [ ] J’ai inspecté quelques pages prioritaires et leurs canoniques.
- [ ] Je conserve la validation DNS/balise/fichier en place.
- [ ] Je distingue les URL découvertes, les pages indexées et les pages qui reçoivent du trafic.
- [ ] Je n’attends pas un nombre fixe d’URL ni une date garantie de classement.

**En une phrase :** valide la propriété du bon domaine, envoie **le sitemap existant**, puis surveille les pages réellement indexées et corrige la qualité du contenu — ne recrée pas un sitemap pour résoudre un problème d’indexation.
