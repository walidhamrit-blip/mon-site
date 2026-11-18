# Études de cas — modèle à remplir

**But :** remplacer les promesses générales par des preuves vérifiables, sans
inventer de chiffre ni publier un client sans son accord.

**Règle absolue :** un chiffre sans mesure réelle ne se publie pas. Si le
résultat n'a pas été mesuré, écrire « résultat qualitatif » et décrire le
changement observé, sans pourcentage.

---

## 1. Ce qu'il faut fournir pour chaque cas (5 minutes par cas)

Copier ce bloc, le remplir, et le renvoyer. Trois cas suffisent pour lancer la
section ; un seul cas solide vaut mieux que trois vagues.

```text
CAS 1
- Nom du client ou secteur : …
- Ville / pays : …
- Type de site : vitrine | boutique | réservation | refonte | autre
- URL publique (ou « non publiée ») : …
- Problème de départ (1 phrase, mesurable si possible) : …
- Ce qui a été fait (2–3 puces maximum) : …
- Résultat mesuré (avec la source et la date) : …
  ex. « LCP mobile 4,8 s → 2,1 s (PageSpeed Insights, 12/10/2026) »
- Durée / délai de livraison : …
- Citation du client (facultative, texte exact) : …
- Accord de publication : oui | nom masqué | secteur seulement | non
- Capture avant/après disponible : oui | non
```

### Sources de résultat acceptées

| Résultat | Source exigée |
|---|---|
| Vitesse / Core Web Vitals | Capture PageSpeed Insights ou Lighthouse, avec date |
| Trafic / clics | Search Console ou analytics, période comparée |
| Commandes / leads | Tableau de bord du client, période et volume |
| Position Google | Capture Search Console (requête + pays) |
| Conversion | Nombre de demandes avant/après, même canal |
| Qualitatif | « Le client a cessé de recevoir des appels pour des prix » (citation) |

> Un pourcentage sans période ni point de départ n'est pas une preuve. Il sera
> reformulé ou retiré.

---

## 2. Trois niveaux de publication

| Niveau | Ce qui apparaît | Quand l'utiliser |
|---|---|---|
| **Nom + lien** | Nom, logo, URL, citation | Accord écrit explicite |
| **Secteur anonymisé** | « Clinique dentaire, Tripoli » | Accord verbal ou client sensible |
| **Agrégé** | « 12 sites livrés en 2026 » | Aucun accord individuel — seulement si le chiffre est exact |

Le niveau choisi pour chaque cas doit être noté dans le fichier de données,
pas deviné au moment du rendu.

---

## 3. Où les cas apparaîtront

1. **Accueil** — section « Résultats de nos interventions » : 3 cartes
   (problème → action → résultat mesuré), lien vers l'étude complète.
2. **Fix & Optimize** — un cas de réparation, avec le rapport avant/après
   (C-06) ; c'est la preuve la plus pertinente pour cette offre à 90 USD.
3. **`/demos/[slug]`** — le cas complet : contexte, contraintes, captures,
   délai, citation.
4. **`llms.txt` / données structurées** — uniquement les faits vérifiés,
   jamais une note inventée.

---

## 4. Contrôles avant publication (à cocher)

- [ ] Chaque chiffre a une source et une date.
- [ ] L'accord de publication est écrit (niveau 1 ou 2) ou le cas est agrégé.
- [ ] Aucune donnée personnelle (e-mail, téléphone, nom de contact).
- [ ] Aucune capture ne montre un tableau de bord client sans masquage.
- [ ] La mention « exemple » est absente : ce sont de vrais cas.
- [ ] Le texte arabe et le texte anglais disent la même chose.
- [ ] Le lien vers le site client fonctionne (ou le cas est anonymisé).
- [ ] Le test `trust-reviews` passe (aucune note inventée).

---

## 5. Une fois les cas fournis

L'agent peut, sans autre décision :

1. créer le fichier de données typé (`src/lib/case-studies.ts`) ;
2. construire la section d'accueil et la page d'étude de cas ;
3. ajouter le cas « réparation » sur Fix & Optimize ;
4. brancher les liens depuis les pages services concernées ;
5. ajouter le garde-fou de test (source obligatoire, pas de note inventée) ;
6. relire les textes AR/EN et vérifier le rendu mobile.
