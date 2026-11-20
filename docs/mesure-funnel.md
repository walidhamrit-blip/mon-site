# Mesurer le funnel — guide pas à pas

> C-09 · Dernière mise à jour : 18 novembre 2026
>
> Objectif : savoir **où les visiteurs s'arrêtent** avant de modifier l'accueil
> (C-08). Trois chiffres suffisent au départ : visites, clics dans le parcours,
> demandes. Le reste est du diagnostic.

---

## 1. Ce qui est mesuré (et ce qui ne l'est jamais)

| Événement | Déclenché quand | Propriété | Question à laquelle il répond |
|---|---|---|---|
| `gateway_click` | clic sur une des 3 cartes de l'accueil | `path` (`/creation-sites`, `/codes?kind=…`) | Quelle porte les visiteurs choisissent-ils ? |
| `service_view` | ouverture d'une fiche service | `id` (identifiant public du service) | Quels services sont réellement consultés ? |
| `whatsapp_click` | clic sur un CTA WhatsApp (après confirmation) | `source` (`float`, `footer`, `navbar-desktop`, `navbar-mobile`, `contact`, `how-it-works`, `mid-page-cta`, `chatbot`) | WhatsApp est-il le vrai canal de contact ? Depuis où ? |
| `lead_submit` | formulaire de contact accepté par `/api/lead` | `source` (`cta-form`) | Combien de demandes abouties ? |
| `checkout_start` | ouverture d'un dialogue d'achat | `kind` (`website`, `gift_card`, `game_topup`, `software_key`, …) | Quelle intention d'achat sans passage à l'acte ? |
| `audit_request` | formulaire de la page `/audit` | `source` (`audit-form`) | Demandes d'audit reçues |

**Jamais collecté** : e-mail, téléphone, nom, message, référence de commande,
montant saisi, adresse. Le module `src/lib/analytics.ts` n'accepte que les clés
`path`, `id`, `source` et `kind` ; toute autre clé est ignorée à l'exécution.
Un test le vérifie à chaque `npm test`.

Un événement est envoyé **une seule fois par action** : `service_view` et
`checkout_start` au montage du composant, les clics au clic réel.

---

## 2. Vérifier en preview (10 minutes, une fois)

1. Ouvrir la preview Vercel de la branche (pas la production).
2. Ouvrir les DevTools du navigateur → onglet **Réseau**, filtre `insights`.
3. Cliquer sur une carte de l'accueil.
   → une requête vers `/_vercel/insights/event` doit apparaître.
   → dans **Payload / Requête**, vérifier `"name":"gateway_click"` et
   `"path":"/creation-sites"` (ou `/codes?kind=…`).
4. Répéter pour : une fiche `/services/<id>` (`service_view`), le bouton
   WhatsApp flottant (`whatsapp_click`, `source: float`), le formulaire
   (`lead_submit`), l'ouverture d'un achat (`checkout_start`).
5. Désactiver le bloqueur de publicités si rien n'apparaît : il bloque
   légitimement la mesure.

**Tableau de bord** : Vercel → projet `walid-website/mon-site` → onglet
**Analytics** → filtre **Events**. Les événements personnalisés peuvent mettre
quelques minutes à apparaître. Deux limites à connaître :

- les **événements personnalisés** ne sont pas inclus dans tous les plans
  Vercel ; si l'onglet reste vide alors que le payload réseau est correct,
  vérifier le plan avant de conclure à un bug ;
- les données de **preview** peuvent être séparées de la production (filtre
  d'environnement). La preuve réseau, elle, est immédiate et fiable.

> La preuve réseau suffit pour valider C-09. Le tableau de bord sert à lire
> les tendances, pas à recetter.

---

## 3. Établir la référence (7 jours, avant C-08)

Ne rien changer à l'accueil pendant cette période.

| Jour | Action | Durée |
|---|---|---|
| J0 | Vérifier la preview (§2), puis noter la date de début | 10 min |
| J1 à J6 | Ne rien modifier ; laisser le trafic naturel s'accumuler | — |
| J7 | Relever les 3 chiffres ci-dessous dans Analytics | 5 min |

**Les 3 chiffres de la semaine**

1. **Visites** — nombre de visiteurs uniques (Analytics → vue d'ensemble).
2. **Clics parcours** — total `gateway_click` (et répartition par `path`).
3. **Demandes** — `lead_submit` + `whatsapp_click` (les deux canaux, séparés).

Formules utiles :

- taux de clic parcours = `gateway_click` ÷ visites de l'accueil ;
- part WhatsApp = `whatsapp_click` ÷ (`whatsapp_click` + `lead_submit`) ;
- taux d'intention = `checkout_start` ÷ visites des pages concernées.

**Échantillon minimal** : ne pas interpréter une variation sous **100 visites**
ou **20 clics** sur le parcours. En dessous, c'est du bruit.

---

## 4. Routine hebdomadaire (5 minutes, chaque lundi)

Copier ce tableau dans `docs/suivi-mesure.md` et le remplir.

| Semaine | Visites | `gateway_click` | Clic n°1 | `whatsapp_click` | `lead_submit` | `checkout_start` | Décision |
|---|---|---|---|---|---|---|---|
| Réf. | | | | | | | aucune (référence) |

Puis, dans l'ordre :

1. **Analytics → Events** : les 6 événements sont-ils toujours présents ?
   Un événement qui disparaît = régression de code, pas baisse de trafic.
2. **Comparer à la semaine précédente** : une baisse de plus de 30 % des
   visites déclenche la lecture de `docs/runbook-surveillance.md` (§2 Better
   Stack, §3 Sentry), pas une modification du site.
3. **Lire le classement `gateway_click`** : quelle carte gagne ? L'écart est-il
   stable sur deux semaines ?
4. **Lire `whatsapp_click` par `source`** : le bouton flottant domine-t-il ?
   Si oui, le canal mérite d'être assumé visuellement.
5. **Noter une seule décision** dans la dernière colonne : « rien », « à
   revoir », « test C-08 ». Une semaine = une observation, pas un chantier.

---

## 5. Seuils de décision pour C-08 (hypothèses à recalibrer)

Ces seuils sont des **hypothèses de travail**, pas des références du marché.
Ils servent à décider quand agir, et seront révisés après deux semaines de
données réelles.

| Observation (≥ 200 visites, 14 jours) | Lecture | Action proposée |
|---|---|---|
| taux de clic parcours < 15 % | l'accueil n'oriente pas | C-08 : clarifier les 3 portes (ordre, texte, preuve) |
| une carte > 60 % des clics | parcours quasi unique | C-08 : assumer cette porte en premier, sans supprimer les autres |
| `whatsapp_click` > 3 × `lead_submit` | WhatsApp est le canal réel | rendre WhatsApp plus visible, formulaire en second |
| `checkout_start` élevé, `lead_submit` faible | intention sans demande | vérifier prix, garanties et délai de réponse |
| `service_view` concentré sur 2 fiches | catalogue peu exploré | retravailler les liens internes, pas le design |

Après C-08 : conserver **14 jours** de mesure avant de conclure, et comparer
au tableau de référence. Une amélioration doit être visible sur **deux
semaines consécutives**, pas sur un pic.

---

## 6. Rythme de lecture

| Fréquence | Quoi | Où | Durée |
|---|---|---|---|
| Chaque lundi | 3 chiffres + une décision | Vercel Analytics | 5 min |
| Chaque lundi | issue `liens` ouverte ? | GitHub → Issues, label `liens` | 1 min |
| Chaque mois | tendance Lighthouse (SEO, bonnes pratiques) | GitHub Actions → SEO & Lighthouse | 5 min |
| Chaque mois | audit des dépendances | CI (job `audit`) ou `node scripts/audit-prod.mjs` | 2 min |
| En cas d'alerte | disponibilité, TLS, erreurs | Better Stack puis Sentry | selon alerte |

---

## 7. Ce qu'il ne faut pas faire

- **Ne pas** ajouter d'e-mail, de téléphone ou de référence dans une propriété
  d'événement « pour mieux analyser » : c'est une donnée personnelle, et le
  module la rejetterait.
- **Ne pas** interpréter une semaine sous 100 visites.
- **Ne pas** modifier l'accueil et le suivi la même semaine : la référence
  disparaît.
- **Ne pas** se fier au seul tableau de bord si l'onglet Events est vide :
  vérifier d'abord le payload réseau, puis le plan Vercel.
- **Ne pas** bloquer la production avec ces mesures : `track()` est silencieux
  en cas d'échec et ne retarde aucun clic.
