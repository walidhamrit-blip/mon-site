# Livraison d'un site après paiement — la démarche idéale

Date : 4 novembre 2026 · Contexte : Nukhba (`mon-site`), création de sites et boutiques en Libye, paiement crypto (NOWPayments / USDT), hébergement Vercel, base Postgres.

---

## 1. Le principe qui évite 90 % des problèmes

> **On ne remet les clés qu'après le solde.** Avant le paiement final, le client voit le site terminé sur une URL de prévisualisation ; il ne reçoit ni le dépôt de code, ni l'accès admin en écriture, ni le domaine.

C'est déjà ce que disent les CGU du site (article 5 — *Ownership of the website passes to the client once all amounts due have been paid in full*, et acompte non remboursable une fois le travail commencé). La démarche ci-dessous n'est que la mise en pratique de cette règle.

Conséquence directe : **la livraison n'est pas un instant, c'est un protocole en 4 temps** — Pré-livraison (QA) → Paiement du solde → Transfert (domaine, code, accès) → Recette + garantie.

---

## 2. Échéancier de paiement recommandé

| Moment | Montant | Effet |
|---|---|---|
| Réservation (démo personnalisée) | acompte 1 $ (déjà en place sur `/demos/[slug]`) | débloque la priorité, déduit du total |
| Démarrage (après la session de découverte) | **40 %** | le projet entre en production |
| Avant mise en ligne (J-1) | **60 %** (le solde) | déclenche la livraison |

Règles à afficher et à répéter :
- Le devis écrit (WhatsApp + e-mail) vaut contrat : périmètre, prix, délais, 2 rounds de révisions inclus, ce qui est hors périmètre.
- Tout ajout hors périmètre = avenant chiffré, pas un « petit changement gratuit ».
- Le solde est exigible **avant** la bascule DNS, pas « dans la semaine qui suit ».

---

## 3. J-3 à J-1 : la pré-livraison (ne sautez jamais cette étape)

Le client paie un site qui marche, pas une promesse. Checklist à valider **avant** de réclamer le solde :

**Fonctionnel**
- [ ] Formulaire de contact / devis testé en réel : le lead arrive bien dans `/admin/leads` **et** par e-mail (`LEAD_NOTIFICATION_EMAIL` reçoit vraiment).
- [ ] E-mails transactionnels reçus (domaine vérifié SPF/DKIM), `EMAIL_REPLY_TO` renseigné.
- [ ] Si boutique : un paiement réel de bout en bout + livraison du code/produit + e-mail de livraison.
- [ ] Tous les liens du menu et du pied de page testés, aucune page 404, aucun lien `localhost`.
- [ ] Versions **arabe ET anglaise** relues (RTL, polices, textes tronqués, dates).

**Technique / prod**
- [ ] `npm run doctor` vert, `/api/health` OK en production.
- [ ] Variables d'environnement posées sur Vercel (Production), aucune secret côté client.
- [ ] HTTPS actif, `www → apex` et `http → https`, certificat valide.
- [ ] `sitemap.xml` + `robots.txt` accessibles, Search Console : propriété créée, sitemap soumis.
- [ ] Balises : titres/descriptions uniques, canonique, image OG, JSON-LD (LocalBusiness / FAQ / HowTo).
- [ ] Lighthouse mobile ≥ 90 (perf, SEO, accessibilité), images en WebP, pas de décalage de mise en page.
- [ ] En-têtes de sécurité en place, mot de passe admin fort, `SESSION_SECRET` défini.
- [ ] Sauvegarde : dump de la base + export du contenu admin (JSON), archivés.

**Contenu**
- [ ] Textes, prix, horaires, téléphone/WhatsApp, adresse, réseaux sociaux : validés par le client **par écrit**.
- [ ] Mentions légales, conditions, politique de remboursement publiées.
- [ ] Favicon, logo, photos du client (pas de stock générique sur la page d'accueil).

---

## 4. Jour J : la livraison, dans cet ordre

1. **Demande du solde** avec le lien de paiement (page `/pay`, référence de commande) : « le solde de X USDT déclenche la mise en ligne ».
2. **Paiement confirmé** (IPN NOWPayments → commande `paid`) — ne pas se fier à une capture d'écran du client.
3. **Bascule en production** : domaine connecté sur Vercel, DNS chez le registrar, attente de propagation (15 min à 24 h), vérification sur mobile 4G, pas seulement sur le Wi-Fi du bureau.
4. **Transfert de propriété** — c'est le point que les clients oublient et qui crée les conflits. Voir §5.
5. **Envoi du kit de livraison** (§6) + prise de rendez-vous de formation.
6. **Formation** (appel de 30 min, enregistré) : modifier un texte, ajouter un produit/article, lire les leads, ajouter une image.
7. **Ouverture de la période de recette** : 7 jours calendaires, 2 rounds de révisions inclus.

---

## 5. Transfert de propriété : qui garde quoi ?

Deux modèles, à choisir **et à écrire noir sur blanc** dans le devis :

**A. Le client repart avec tout (projet au forfait, sans maintenance)**
- Domaine : transféré ou compte registrar au nom du client (il en est propriétaire, pas vous).
- Vercel : `Settings → Transfer` du projet vers son équipe, ou invitation en **Owner** puis retrait de votre accès.
- GitHub : `Settings → Transfer ownership` du dépôt (le code est à lui, article 5 des CGU).
- Postgres (Neon/Vercel) : transfert du projet ou invitation Owner ; lui remettre aussi un dump.
- Emails (Resend/SMTP) : domaine vérifié **dans son compte** — sinon ses e-mail s casseront au bout de 30 jours quand vous couperez votre clé.
- Search Console, GA4, Google Business Profile : l'ajouter en **propriétaire**, pas en simple utilisateur.
- Réseaux sociaux / WhatsApp Business / pixel Meta : identifiants remis ou compte créé avec son e-mail.

**B. Vous gardez l'infra (abonnement de maintenance — le modèle à privilégier)**
- Le client est **propriétaire du code** (dépôt GitHub à son nom, ou accès lecture + copie remise) et **locataire de l'infra** (Vercel, base, emails, domaine gérés par vous).
- Vous lui donnez un accès Vercel *Viewer* et un accès admin au site, jamais les clés de l'infra.
- Écrit explicitement : « en cas d'arrêt de l'abonnement, le code et un dump de la base vous sont remis sous 7 jours ».

⚠️ Règle d'or : **le domaine doit être au nom du client**, toujours. C'est son actif. Vous pouvez en garder la gestion technique, jamais la propriété.

---

## 6. Le kit de livraison (à envoyer en un seul message, archivé)

Un dossier (Drive / ZIP) contenant :

1. **Liens** : site en production, interface d'administration, page de suivi de commande/abonnement.
2. **Accès** : identifiants admin + e-mails de service, transmis par un canal différent du lien (ou gestionnaire de mots de passe). Jamais de mot de passe en clair dans WhatsApp.
3. **Code** : lien du dépôt Git + `README` (installer, lancer, déployer) + licence d'utilisation.
4. **Formation** : vidéo de 10-15 min (Loom) + guide PDF 2-4 pages en arabe et en anglais.
5. **Documents** : devis signé, facture finale, attestation de livraison, conditions de la garantie.
6. **Support** : ce qui est inclus (30 jours de correction de bugs), les délais de réponse, le canal (WhatsApp pro), et ce qui devient payant.

---

## 7. Recette, révisions, clôture

- **Grille de recette** : reprendre le périmètre du devis ligne par ligne, cocher « conforme / à corriger ». C'est ce document qui met fin aux discussions « je croyais que… ».
- **7 jours** pour signaler, **2 rounds** de révisions inclus (cohérent avec l'étape 04 du process affiché sur `/creation-sites`).
- Après 7 jours sans retour : **livraison réputée acceptée** (à écrire dans le devis), clôture du projet.
- Au-delà du périmètre : devis complémentaire, pas de débat.
- **Validation tracée** : un « validé » par e-mail ou WhatsApp suffit juridiquement, mais une page `/livraison/[ref]` avec un bouton « Valider la livraison » (horodatage + e-mail de confirmation) est bien plus propre — et c'est implémentable dans `mon-site` (voir §10).

---

## 8. Les 30 jours qui suivent (là où se joue la recommandation)

| Quand | Action |
|---|---|
| J+1 | Message de contrôle : « tout fonctionne ? » + vérifier que les leads arrivent bien |
| J+7 | Clôture de la recette, demande d'avis Google / témoignage |
| J+15 | Point sur les statistiques (Search Console, vues, leads) |
| J+30 | Fin de garantie : proposer l'abonnement maintenance/support (page `/abonnements`) |
| J+90 | Étude de cas : avant/après, publication sur `/demos` + article de blog + badge/netlinking |

Le client qui a été accompagné 30 jours après la mise en ligne recommande ; celui qu'on abandonne le jour de la livraison ne rappelle jamais.

---

## 9. Sécurité anti-impayé (à activer avant d'en avoir besoin)

- Prévisualisation sur URL Vercel ou sous-domaine de démo, **avec filigrane** tant que le solde n'est pas payé.
- Pas d'accès admin en écriture, pas de dépôt, pas d'export avant paiement complet.
- Si le domaine a été acheté par vos soins : il reste sous votre contrôle jusqu'au solde (mais au nom du client dans le registrar).
- Relance automatique J+2 / J+5 / J+7 après l'envoi du lien de solde.
- Au-delà de 10 jours sans solde : mise en pause du site (page maintenance), acompte conservé — conforme aux CGU article 2.
- Toujours un écrit : devis, avenants, validations. WhatsApp suffit, capturez et archivez.

---

## 10. Modèles de messages

### Demande du solde (FR)
> Bonjour [Prénom], votre site est terminé et visible ici : [lien de prévisualisation].
> Comme prévu au devis, le solde de **[montant] USDT** déclenche la mise en ligne sur votre domaine : [lien de paiement].
> Dès réception, je connecte le domaine, je vous envoie vos accès et je planifie la formation de 30 min.

### Demande du solde (AR)
> مرحباً [الاسم]، موقعك جاهز ويمكنك معاينته هنا: [الرابط].
> وكما هو متفق في عرض السعر، المبلغ المتبقي **[المبلغ] USDT** يُفعّل النشر على نطاقك: [رابط الدفع].
> فور الاستلام سأربط النطاق وأرسل لك بيانات الدخول وأحدد موعد التدريب (30 دقيقة).

### Livraison (FR)
> C'est en ligne : **[url]**.
> Vos accès : [lien admin] · identifiant [email] · mot de passe envoyé séparément.
> Votre code et vos données : [lien dépôt] + [lien dossier].
> Vidéo de formation (12 min) : [lien].
> Vous avez 7 jours et 2 séries de retours inclus pour les ajustements ; je corrige tout bug gratuitement pendant 30 jours.
> On se fait la formation [jour] à [heure] ?

### Clôture (FR)
> Le projet est validé et clos. Récapitulatif : [périmètre livré], garantie 30 jours jusqu'au [date], support WhatsApp [numéro].
> Si le site vous a rendu service, un avis Google ici m'aide beaucoup : [lien].
> Je repasse vers vous dans 30 jours pour les statistiques et, si vous le souhaitez, la maintenance mensuelle.

---

## 11. Ce qui est déjà en place dans `mon-site`

**La page de livraison est implémentée** (novembre 2026). Elle remplace le PV de recette papier :

| Brique | Fichier |
|---|---|
| Page client `/livraison/<ref>?t=<jeton>` | `src/app/(site)/livraison/[ref]/page.tsx` |
| Bouton « Valider la livraison » (nom + case à cocher) | `src/app/(site)/livraison/[ref]/accept-delivery.tsx` |
| API de validation (horodatage, origine, limite de débit) | `src/app/api/deliveries/accept/route.ts` |
| Table `site_deliveries` (créée automatiquement) | `src/db/schema.ts` + `ensureSchema()` dans `src/db/index.ts` |
| Accès base (création, lecture par jeton, validation, suppression) | `src/lib/deliveries.ts` |
| Règles partagées (liens http(s) uniquement, garantie, URL) | `src/lib/delivery-kit.ts` |
| E-mails : lien de livraison, reçu de recette, notification | `src/lib/delivery-emails.ts` + `src/lib/delivery-notifications.ts` |
| Jeton chiffré (renvoi du lien sans stockage en clair) | `src/lib/delivery-tokens.ts` |
| Écran admin « Livraisons & recette » | `src/app/admin/(panel)/livraisons/` |
| Tests (16 assertions) | `scripts/delivery-handover.test.mjs` (`npm run test:deliveries`) |

Sécurité appliquée :
- le jeton n'existe qu'en clair dans l'URL ; la base ne garde que son SHA-256,
  et une copie chiffrée (AES-256-GCM) pour permettre le renvoi ;
- seules les URL `http(s)` sont enregistrées (`javascript:` écarté) ;
- la page est `noindex`, absente du sitemap et bloquée dans `robots.ts` ;
- aucun mot de passe n'est stocké ni envoyé par e-mail ;
- référence + jeton faux → « lien invalide », sans jamais révéler l'existence du dossier.

## 12. Ce qui reste à industrialiser

1. **E-mail automatique du kit complet** : aujourd'hui l'admin crée le dossier puis transmet le lien (copié ou envoyé par e-mail) ; les identifiants restent à envoyer par un canal séparé, volontairement.
2. **Étape 06 « Livraison & garantie »** dans `processSteps` (`src/lib/content.ts`) et sur `/creation-sites`, pour vendre la rigueur avant même le premier contact.
3. **Relances de solde automatiques** (J+2, J+5, J+7) depuis la table des commandes, sur le modèle du cron `src/app/api/cron/digital-orders`.
4. **Espace client projet** : avancement, documents, factures, tickets de support — le meilleur argument contre « vous avez disparu après le paiement ».
