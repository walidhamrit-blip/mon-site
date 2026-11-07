# Soldes dus aux clients — mode d'emploi

_Dernière mise à jour : 2026-11-08._

## Le problème

Un client peut payer **plus que le montant dû** avec une carte de recharge
(téléphone). Cas réel :

| Élément | Montant |
| --- | --- |
| Carte Libyana déclarée par le client | **30,00 LYD** |
| Devis accepté de sa commande | **17,96 LYD** |
| **Solde dû au client** | **12,04 LYD** |

Avant, l'écran affichait bien « +12,04 LYD par rapport à la carte déclarée »,
mais **rien n'était enregistré** : le gérant devait s'en souvenir. L'argent dû
au client pouvait être oublié ou contesté.

## Ce qui se passe maintenant

1. Le gérant **accepte** la carte dans `/admin/digital/orders`, zone
   « Cartes téléphoniques à vérifier ».
2. Le site calcule l'écart (carte − devis) et **crée automatiquement** un solde
   au nom du client. Le message de confirmation l'indique.
3. La zone de la carte affiche en clair : **« Reste dû au client : 12,04 LYD
   (carte 30,00 − devis 17,96) »**, avec un bouton
   **« Enregistrer le solde dû (12,04 LYD) »**.
   Ce bouton sert à **rattraper** une carte acceptée avant la mise en place du
   suivi. Un second clic ne crédite jamais deux fois : le site répond
   « déjà enregistré ».
4. Le solde apparaît dans **`/admin/soldes`** (menu : « Soldes clients »).

## L'écran « Soldes clients »

- **Total dû aux clients** en haut de page, pour savoir combien d'argent est dû
  au total.
- **Une fiche par client**, avec son solde actuel et son historique.
- Trois gestes par fiche :
  - **Utilisé sur une commande** (ex. : le client l'utilise sur une prochaine
    commande) ;
  - **Remboursé au client** (l'argent lui est rendu) ;
  - **Ajustement manuel** (correction, dans les deux sens).
- Chaque geste **exige une note** ; un débit peut aussi pointer la commande
  concernée. Le solde ne change **jamais sans mouvement enregistré**.

## Le client peut demander à utiliser son solde (option B)

Rien n'est automatique : le client **demande**, vous **validez**.

1. Le client ouvre le suivi de sa commande (`/codes/commande`, lien privé reçu par e-mail).
2. Il voit **« Votre solde chez nous : 12,04 LYD disponible »** et peut cliquer
   **« Utiliser mon solde (12,04 LYD) »** (message facultatif).
3. La demande arrive dans **Admin → Soldes clients → « Demandes des clients »**
   (et par e-mail si le service d'e-mail est configuré). **Aucun montant n'est débité à ce stade.**
4. Vous cliquez **« Valider l'utilisation »** → le solde est débité par un mouvement
   « Utilisé sur une commande » portant la référence de la commande.
   **« Refuser »** ne touche à rien : le solde reste dû au client.
5. Le client voit immédiatement le statut sur son suivi : *en attente*, *validé*, *refusé*.

### Ce que le site ne fait pas (volontairement)

- Il ne **réduit pas** automatiquement le prix de la commande : c'est vous qui
  confirmez le montant restant à payer au client (le site n'a pas de compte client,
  donc aucune preuve d'identité suffisante pour débiter sans vous).
- Il n'accepte **aucun montant** venant du navigateur : la demande porte sur le
  solde réel enregistré en base, et la validation applique exactement ce montant.
- Une seule demande en attente par commande (index unique `order_ref, status`), et
  jamais deux débits sur la même commande (index unique du journal des mouvements).

## Règles de sécurité

- Un débit **supérieur au solde est refusé** (message clair, rien n'est écrit).
- Le solde ne peut **jamais devenir négatif**.
- Un trop-perçu **manuel** n'est pas autorisé : il vient uniquement d'une carte
  acceptée, pour éviter les doublons.
- Aucune valeur n'est devinée : si la valeur de la carte ou le devis est
  illisible, **aucun solde n'est créé** et le site explique pourquoi.
- Sans e-mail ni téléphone valides, le client ne peut pas être identifié :
  pas de solde créé, message explicite.
- Aucune migration manuelle : les tables sont créées automatiquement au
  démarrage du site.

## Vérifier que tout va bien

```bash
npm run typecheck
npm test          # inclut scripts/client-credits.test.mjs (8 tests)
npm run lint
```

Tests couverts : trop-perçu 30 / 17,96 = 12,04 ; carte 15 / 17,96 = 0 ;
valeur illisible = pas de crédit ; débit supérieur au solde refusé ; ajustement
négatif ; identité client (e-mail prioritaire, sinon téléphone) ;
`scripts/client-credit-requests.test.mjs` : la demande du client ne débite rien,
le montant ne vient jamais du navigateur, jeton de suivi obligatoire, validation
réservée à l'admin, table créée sans migration manuelle.
