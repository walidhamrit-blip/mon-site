# Incident recharge AFK Journey — message à envoyer à FazerCards

Copier le message ci-dessous dans le support FazerCards (dashboard
`reseller.fazercards.com` → Support, ou l'e-mail indiqué sur le site).
Compléter les trois champs entre crochets avant l'envoi.

## Ce qu'on demande (par ordre de préférence)

1. **Annulation / remboursement** du top-up si le crédit n'a pas encore été
   appliqué (ou si le compte cible n'existe pas).
2. Sinon, l'**identifiant exact du compte crédité** et la date de crédit, pour
   prouver au client où la recharge est partie.
3. En dernier recours, un **geste commercial** (recharge de remplacement sur un
   identifiant vérifié).

## Message (anglais — langue du support)

> Subject: Wrong player ID on top-up order — [ORDER_ID] — refund or transfer request
>
> Hello,
>
> On [DATE] we placed a game top-up order for **AFK Journey** (order ID
> `[ORDER_ID]`, category `[CATEGORY_ID]`, offer `[OFFER_ID]`, amount `[AMOUNT]
> USD`). The order was completed and the credit was applied.
>
> Our customer entered, by mistake, the **guest ID of his 8 Ball Pool
> account** in the Account ID field (`[PLAYER_ID_ENTERED]`). That ID does not
> belong to his AFK Journey account, so the credit went to a third-party
> account.
>
> Could you please:
> 1. confirm which account was credited (account ID, and whether the account
>    existed before our order);
> 2. check whether the credit can be **reversed and refunded** to our reseller
>    balance, since the credit was applied to an unrelated account;
> 3. if a reversal is not possible, let us know whether a **transfer of the
>    credit** to the correct account (`[CORRECT_PLAYER_ID]`) can be arranged.
>
> We have already blocked this class of error on our side: every order is now
> checked with `POST /topups/validate-id` before payment and again before
> purchase. This incident predates that protection.
>
> Thank you for your help — our customer is waiting for a resolution.

## Pendant l'attente — ce qu'on peut faire côté boutique

- La commande concernée est en statut `Livré` (le fournisseur a bien livré,
  mais sur le mauvais compte) : **ne pas la relancer**, cela achèterait une
  seconde recharge.
- Tenir le client informé avec la référence de commande et le numéro de
  dossier FazerCards.
- Si FazerCards refuse : remboursement ou recharge de remplacement est une
  décision commerciale (montant concerné : 21 Dragon Crystals).
