# E-mail de demande de remboursement — FazerCards

À envoyer au support FazerCards (dashboard `reseller.fazercards.com` → Support,
ou l'adresse de support indiquée sur leur site). Langue : **anglais** — c'est
la langue de traitement de leurs dossiers.

**À compléter avant l'envoi** (7 champs) :

| Champ | Où le trouver |
|---|---|
| `[ORDER_ID]` | FazerCards → Orders → identifiant de la commande (`ord-…`) |
| `[ORDER_DATE]` | même écran (date/heure UTC) |
| `[CATEGORY_ID]` | catégorie AFK Journey dans l'API/le dashboard |
| `[OFFER_NAME]` | libellé de l'offre (ex. « 21 Dragon Crystals ») |
| `[AMOUNT_USD]` | montant débité du solde marchand |
| `[PLAYER_ID_ENTERED]` | l'ID saisi par le client (son ID invité 8 Ball Pool) |
| `[CORRECT_PLAYER_ID]` | l'ID de son compte AFK Journey (à demander au client) |

**À joindre (facultatif mais efficace)** : capture de la commande dans le
dashboard FazerCards, capture du champ « Account ID » saisi à la caisse, et la
référence de commande de la boutique (`DGC-…`).

---

## Version à copier

**Subject**

```
Refund request — top-up credited to an unrelated account — order [ORDER_ID]
```

**Body**

```
Hello FazerCards Support,

I am writing as a reseller (account e-mail: [YOUR_ACCOUNT_EMAIL]) to request a
refund on one of my orders.

ORDER DETAILS
- Order ID: [ORDER_ID]
- Date (UTC): [ORDER_DATE]
- Product: game top-up — AFK Journey (category [CATEGORY_ID])
- Offer: [OFFER_NAME]
- Amount debited from my reseller balance: [AMOUNT_USD] USD
- Order status: completed

WHAT HAPPENED
The end customer who placed this order entered the wrong identifier in the
account ID field. The value submitted was [PLAYER_ID_ENTERED], which is the
guest ID of his 8 Ball Pool account — not his AFK Journey account. His AFK
Journey account ID is [CORRECT_PLAYER_ID].

Because that identifier is a valid and existing account, the top-up was
accepted and delivered, but the credit was applied to an account that does not
belong to our customer. He never received the value he paid for.

WHAT I AM ASKING FOR
1. Please confirm which account was actually credited by order [ORDER_ID], and
   at what time (UTC) the credit was applied.
2. If the credit was applied to an account unrelated to our customer, please
   reverse the transaction and refund the amount to my reseller balance. The
   receiving account has no relationship with the buyer, so this is not a
   consumed product on our side.
3. If a reversal is not possible, please tell me whether the credit can be
   transferred to the correct account ([CORRECT_PLAYER_ID]), and what
   information you need from us to do so.

CONTEXT ON MY SIDE
I am not disputing your delivery — your system behaved exactly as documented.
This was a customer input error on our checkout, and we are asking for your
help to recover the value. I have already added a safeguard on my side: every
top-up order is now validated with the `POST /topups/validate-id` endpoint
before the invoice is created and again immediately before purchase, so this
class of mistake can no longer reach your order endpoint from our store.

The affected customer is waiting for a resolution, so I would appreciate an
answer within your usual support timeframe, even if it is a preliminary "under
review" reply with the credited account details.

Thank you for your help.

Best regards,
[YOUR_NAME]
[YOUR_STORE_NAME] — [YOUR_WEBSITE]
[YOUR_ACCOUNT_EMAIL]
```

---

## Version courte (si le support demande d'abord un résumé)

```
Hello,

Order [ORDER_ID] (AFK Journey top-up, offer [OFFER_NAME], [AMOUNT_USD] USD,
completed on [ORDER_DATE]) was credited to the wrong account: our customer
submitted [PLAYER_ID_ENTERED], the guest ID of his 8 Ball Pool account, instead
of his AFK Journey account [CORRECT_PLAYER_ID].

Could you please confirm which account was credited, and reverse the credit to
my reseller balance if that account is unrelated to our customer? If a
reversal is not possible, could the credit be transferred to the correct
account?

Your delivery worked as documented — this is a customer input error on our
side, and I am asking for help to recover the value.

Thank you,
[YOUR_NAME] — [YOUR_STORE_NAME]
```

---

## Relance si aucune réponse sous 3 jours ouvrés

```
Hello,

I am following up on my refund request sent on [SEND_DATE] regarding order
[ORDER_ID] (AFK Journey top-up, [AMOUNT_USD] USD), credited to an account that
does not belong to my customer.

Could you confirm whether the reversal is possible, and if so, when the amount
will be returned to my reseller balance? If the request needs more information
from me, please let me know exactly what is missing and I will send it the same
day.

Thank you,
[YOUR_NAME] — [YOUR_STORE_NAME]
```

---

## Conduite à tenir côté boutique (pour mémoire)

- **Ne pas relancer la livraison** de cette commande dans l'admin : elle est
  déjà livrée chez le fournisseur, une relance achèterait une seconde recharge
  (la clé d'idempotence couvre la même référence, mais aucune raison de
  solliciter le fournisseur pendant le litige).
- Si FazerCards rembourse : le solde marchand revient chez eux ; le client
  doit être remboursé ou rechargé à la main par l'équipe.
- Si FazerCards refuse : décision commerciale (remboursement partiel en USDT,
  recharge de remplacement sur l'ID vérifié, ou avoir). Le préjudice est réel
  côté client, même si l'erreur vient de la saisie.
- Dans tous les cas, garder la trace du numéro de dossier dans la conversation
  de support et l'ajouter au motif de la commande dans l'admin.

---

## Annexe — message à envoyer au client pour obtenir son UID AFK Journey

Pour remplir `[CORRECT_PLAYER_ID]`, il faut l'UID du compte AFK Journey du
client : c'est ce qui permet de demander un transfert de crédit si le
remboursement est refusé.

**Ce que le client doit faire (AFK Journey)**

1. Ouvrir **AFK Journey** (mobile ou PC), connecté à **son** compte.
2. Toucher son **avatar** en **haut à gauche** de l'écran d'accueil → la page
   de profil / « Character Center » s'ouvre.
3. Lire l'**UID** affiché en **bas à droite** (sous le nom du personnage) et
   toucher l'icône **copier** à côté.
4. Noter aussi le **nom du serveur** (ex. `G623`) affiché au même endroit : il
   confirme qu'il s'agit du bon personnage.
5. Envoyer l'UID **en texte** (pas une capture d'écran) pour éviter une erreur
   de recopie.

**Message à copier (français)**

```
Bonjour,

Nous faisons suite à votre commande de recharge AFK Journey. Pour retrouver
votre paiement auprès de notre fournisseur, nous avons besoin de l'identifiant
(UID) de VOTRE compte AFK Journey — celui de votre personnage, et non un
identifiant d'un autre jeu.

Pour le trouver :
1. Ouvrez AFK Journey sur votre téléphone ou votre PC, connecté à votre compte.
2. Touchez votre avatar en haut à gauche de l'écran d'accueil.
3. L'UID est affiché en bas à droite de la page de profil : touchez l'icône
   « copier » à côté.
4. Notez aussi le nom du serveur affiché juste à côté (ex. G623).

Envoyez-nous l'UID en texte et le nom du serveur, ainsi que le nom de votre
personnage. Dès réception, nous relançons la demande de remboursement ou de
transfert du crédit.

Merci de votre patience.
```

**Message à copier (arabe)**

```
مرحباً،

بخصوص طلب شحن AFK Journey الخاص بك: نحتاج إلى معرّف حسابك (UID) في لعبة
AFK Journey نفسها — وليس معرّف لعبة أخرى — لمتابعة طلب استرداد المبلغ لدى
المورّد.

للعثور عليه:
1. افتح لعبة AFK Journey على هاتفك أو حاسوبك وأنت مسجّل الدخول بحسابك.
2. اضغط على صورة حسابك في أعلى يسار الشاشة الرئيسية.
3. يظهر معرّف UID في أسفل يمين صفحة الملف الشخصي: اضغط أيقونة النسخ بجانبه.
4. دوّن أيضاً اسم السيرفر الظاهر بجانبه (مثال: G623).

أرسل لنا المعرّف واسم السيرفر كرسالة نصية، مع اسم شخصيتك. بعد ذلك نتابع طلب
الاسترداد أو نقل الرصيد.

شكراً لتفهّمك.
```

**Ne pas confondre les deux identifiants vus dans cet incident**

| Jeu | Où le joueur le trouve | Forme typique |
|---|---|---|
| AFK Journey (`account_id`) | avatar en haut à gauche → UID en bas à droite du profil | nombre + serveur `Gxxx` |
| 8 Ball Pool (`user_id`) | miniclip.com, profil → « Unique ID » (ou dans le jeu : profil) | nombre à 8-10 chiffres |

Le champ « Account ID » de la boutique correspond au **jeu de la fiche** : un
ID d'un autre jeu ne crédite jamais le bon compte, et la recharge n'est pas
récupérable.
