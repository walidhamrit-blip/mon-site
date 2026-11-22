# Livraison d'un audit (test de service) par dossier — 22 novembre 2026

- **Site :** Nukhba / Nokhba — نخبة (création de sites et boutiques, Tripoli)
- **Branche :** `arena/3f951237-mon-site`
- **Nature :** procédure de livraison (aucun changement de code depuis la
  page `/livraison/[ref]`, aucun nouveau champ)

## Le principe

La livraison d'un projet web après paiement utilise déjà le **dossier de
livraison** : `/livraison/<ref>?t=<jeton>`, avec acceptation par le client,
e-mail de reçu et notification interne
(voir `docs/livraison-site-apres-paiement-2026-11-04.md`). Le même dossier
sert à livrer un **audit** — les deux sont des livraisons d'un service
terminé.

Ce n'est **pas** un nouveau mécanisme, ni un nouveau champ : on réutilise le
dossier existant, en y mettant les éléments que l'audit envoie (rapport,
mesures datées, findings).

## Ce qui est affiché au client (public, token-gated, `noindex`)

Le dossier public ne contient QUE :

- référence + titre du projet + statut (`livré` / `accepté`) ;
- nom du client, montant, date de remise, durée de garantie ;
- liens livrés (http/https uniquement) ;
- éléments livrés (checklist) ;
- e-mail masque (`c***@`).

**Non affiché** : les notes internes, le montant brut, les e-mails complets,
et aucun identifiant ou mot de passe. Ne mettez **rien** de chiffré ni de
négociable dans la checklist publique — les scores et les findings vont dans
les notes internes (admin uniquement).

## Ce qui est interne (admin uniquement)

Les notes (`notes`, texte libre ≤ 2000 caractères) et les liens internes sont
visibles depuis `/admin` → « Livraisons & recette ». C'est ici que vont
les détails du test : scores avant/après, métriques, findings, statuts.

## Procédure de création

### Étape 1 — Préparer le dossier

`/admin` → « Livraisons & recette » → formulaire de création :

| Champ | Valeur |
|---|---|
| **Client** | Nom du client du test (à transmettre par l'opérateur) |
| **Projet** | `Audit 46 points — <nom du site audité>` |
| **E-mail** | E-mail du client (pour l'envoi du lien, facultatif) |
| **Téléphone** | Téléphone / WhatsApp du client (facultatif) |
| **Montant** | Prix du test négocié (ou vide) |
| **Garantie (jours)** | Suggestion : 14 jours (le service indique « 14 jours de suivi ») — à valider |
| **Notes** | Scores avant/après, métriques, findings, statut de chaque point, le site audité, le jour de l'audit, l'outil (Lighthouse 12, 3 runs, médiane) |
| **Liens** | Voir ci-dessous (http/https uniquement) |
| **Checklist** | Voir ci-dessous (≤ 30 éléments, ≤ 120 caractères) |

### Étape 2 — Liens (liste « الروابط المسلّمة » / « Delivered links »)

Seulement des URL http(s). Suggestions typiques pour un audit :

- le site audité en production (`Site en ligne`) ;
- la page/le rapport publics si le client en a reçu un en avance
  (`Dossier & documents`) ;
- **ne pas** lier des fichiers privés ou des journaux — la page publique ne
  peut rien faire d'autre que rediriger vers la URL.

### Étape 3 — Checklist (éléments livrés, visibles au client)

Suggestions (texte court, factuel) :

- « Rapport d'audit 46 points — daté et signé par Nukhba »
- « Scores Lighthouse avant/après — mesurés sur mobile (Lighthouse 12, 3 runs) »
- « Métriques LCP / TBT / CLS / Speed Index — datées »
- « Findings : aria-labels vérifiés ; [points restants à adresser] »
- « Suivi 14 jours — corrections ou avertissements post-audit »
- « Patchs appliqués le jour J (fixes) — à énumérer »
- « **Ce qui n'a PAS été corrigé et pourquoi** — explication »

Rien n'est livré sans que cela soit vérifié : ne cochez/notez que ce qui
vraiment existe.

### Étape 4 — Créer le dossier

Le formulaire appelle `createDeliveryAction` :

- la référence `LIV-<24 caractères hexadécimaux, ex. LIV-AB12CD…>` est créée en base ;
- le jeton n'existe que dans la réponse et dans l'URL publique — la base
  ne conserve que son empreinte SHA-256 et une copie chiffrée (AES-256-GCM) ;
- la page `/livraison/<ref>?t=<jeton>` est créée immédiatement, `noindex`,
  absents du sitemap.

**L'envoi est automatique** : dès la création du dossier, le lien part au
client par e-mail (`sendDeliveryLinkEmail`, au mieux — l'échec de l'envoi
ne bloque jamais la création, il est signalé dans l'interface). Sans e-mail
client, le lien reste à transmettre manuellement par WhatsApp.

Le message de retour de l'action confirme l'envoi :
« Dossier LIV-… créé — lien envoyé à <email> », ou
« … — envoi impossible ; transmettez le lien (WhatsApp) ».

Ne pas l'envoyer par e-mail « en vrac » par un autre canal : les e-mails
de recette sont déjà datés/horodatés, et un reçu part à la première
acceptation.

### Étape 5 — Première transmission au client

- **Par défaut** : e-mail automatique envoyé à la création du dossier.
- **Fallback** : copiez le lien affiché (« Copier le lien » ou `Lien` dans
  la liste) et transmettez-le par WhatsApp.
- **Renvoi manuel** : bouton `Envoyer` dans la liste des dossiers
  → `sendDeliveryLinkAction` (pour relancer un envoi raté). Aucun
  mot de passe ou secret n'est jamais ajouté dans un e-mail.

### Étape 6 — Acceptation client

Le client ouvre le lien, lit le dossier et clique « Valider la livraison ».
La base enregistre `status = accepted` + horodatage + nom du signataire ; un
e-mail de reçu part au client **une seule fois** (jamais de double envoi) ;
une notification interne part à l'équipe.

### Étape 7 — Ne pas écraser

Si le client se plaint du dossier, ne le supprimez pas : corrigez le dossier
par l'admin (recréer si nécessaire et garder une trace). Le dossier est
l'épreuve de livraison — il doit rester lisible.

## Sécurité (ne rien désactiver)

- Jeton = secret de session uniquement : la base ne stocke jamais le jeton en clair.
- Liens = `http(s)` uniquement (`javascript:`, `data:`, `file:` écartés).
- Page `noindex`, jamais dans le sitemap, bloquée dans `robots.ts`.
- E-mail : aucun mot de passe ni jeton en clair.
- Confidentialité : nom/e-mail/téléphone du client ne figurent que dans la base
  et le dossier — **jamais dans le dépôt, ni dans un commit, ni dans un rapport
  public**.

## Ce qui reste manuel (important pour ne pas promettre plus que ce qui existe)

- Le dossier ne contient pas l'audit complet (ni le PDF, ni les findings) —
  **il pointe vers ce qui est livré et montre les éléments livrés**. Le
  rapport détaillé va dans les notes internes et dans le canal de suivi
  (chat WhatsApp / e-mail du client).
- La fabrication d'un PDF public du rapport n'est pas implémentée : ne
  prétendez pas que le client en reçoit un s'il ne reçoit que le dossier
  et les liens.
- Le montant et la durée de garantie sont des décisions métier — à valider
  avec l'opérateur, jamais inventés ici.
- Le contenu exact du test (scores, métriques, findings) doit être
  transféré par l'opérateur. **Ce document ne contient aucune valeur inventée.**
