/**
 * Vérification d'une livraison de code — logique pure (sans base, testable).
 *
 * Une commande de code n'est « livrée » que si TROIS faits sont vrais :
 *   1. le paiement est encaissé (`status` ≠ pending) ;
 *   2. un code a été reçu du fournisseur et enregistré (chiffré) ;
 *   3. le client peut le voir : e-mail accepté par le fournisseur d'e-mail
 *      et/ou page `/codes/commande`.
 *
 * Le badge « Livré » de l'admin ne prouve que le point 2 : une commande peut
 * être livrée en base avec un e-mail jamais parti (`email_sent_at` null +
 * `email_last_error`). Ce module traduit une ligne `digital_orders` en
 * verdict lisible et en actions concrètes.
 *
 * Les recharges de jeu (`kind = "game_topup"`) sont livrées SANS code : le
 * crédit part sur le compte du joueur. Elles ne doivent donc pas être
 * signalées comme « livrées sans code ».
 */

export const DELIVERY_STATUSES = ["pending", "paid", "manual", "delivered", "failed"];

/** Statut normalisé (valeur inconnue → pending, comme côté application). */
export function normalizeStatus(value) {
  const status = String(value ?? "").trim().toLowerCase();
  return DELIVERY_STATUSES.includes(status) ? status : "pending";
}

export const PHONE_CARD_STATUSES = ["pending", "approved", "rejected"];

/**
 * Statut de vérification d'une carte téléphonique.
 * `null` = commande qui n'est pas payée par carte téléphonique.
 */
export function normalizePhoneCardStatus(value) {
  const status = String(value ?? "").trim().toLowerCase();
  return PHONE_CARD_STATUSES.includes(status) ? status : null;
}

/** Masque une adresse e-mail : `w•••@gmail.com` (jamais d'adresse en clair). */
export function maskEmail(value) {
  const email = String(value ?? "").trim();
  const at = email.lastIndexOf("@");
  if (at <= 0) return email ? "•••" : "—";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dots = "•".repeat(Math.max(2, Math.min(6, local.length - 1)));
  return `${local.slice(0, 1)}${dots}@${domain}`;
}

/** Nombre de codes attendus d'après la quantité (indicatif, jamais bloquant). */
export function expectedCodes(order = {}) {
  if (String(order.kind ?? "") === "game_topup") return 0;
  const quantity = Number(order.quantity ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? Math.trunc(quantity) : 1;
}

/**
 * Verdict d'une livraison.
 *
 * @param {object} order ligne `digital_orders` (ou équivalent sérialisé)
 * @param {string} [order.status] pending | paid | manual | delivered | failed
 * @param {string} [order.kind] gift_card | software_key | game_topup | …
 * @param {boolean} [order.hasCodesCipher] `codes_cipher` non null en base
 * @param {string} [order.deliveredAt] date ISO de livraison
 * @param {string} [order.emailSentAt] date ISO d'envoi accepté des codes
 * @param {string} [order.emailLastError] dernier échec d'envoi
 * @param {string} [order.paymentMethod] nowpayments | phone_card
 * @param {string} [order.phoneCardStatus] pending | approved | rejected
 * @returns {{ level: "ok"|"warn"|"fail", code: string, headline: string, detail: string, actions: string[] }}
 */
export function deliveryVerdict(order = {}) {
  const status = normalizeStatus(order.status);
  const kind = String(order.kind ?? "").trim();
  const hasCodesCipher = Boolean(order.hasCodesCipher ?? order.codesCipher);
  const emailSentAt = order.emailSentAt ?? null;
  const emailLastError = order.emailLastError ?? null;
  const deliveredAt = order.deliveredAt ?? null;
  const isTopup = kind === "game_topup";
  const paymentMethod = String(order.paymentMethod ?? "").trim().toLowerCase();
  const phoneCardStatus = normalizePhoneCardStatus(order.phoneCardStatus);

  // Carte téléphonique : l'acceptation de la carte n'achète RIEN. Elle débloque
  // seulement la livraison manuelle (`digital_orders.status = manual`), et le
  // cron de reprise ne touche jamais une commande `manual`. Sans cette branche,
  // une carte acceptée serait classée « payée non livrée » — donc laissée à
  // l'abandon en croyant que le système allait livrer.
  if (paymentMethod === "phone_card" && status !== "delivered") {
    if (phoneCardStatus === "rejected") {
      return {
        level: "fail",
        code: "phone_card_rejected",
        headline: "CARTE REFUSÉE — aucune livraison",
        detail:
          "La carte téléphonique a été refusée : la commande est marquée comme " +
          "non payée. Aucun code ne doit être acheté ni envoyé.",
        actions: [
          "Prévenir le client avec le motif du refus (note de vérification).",
          "Ne rien livrer ; proposer un autre moyen de paiement.",
        ],
      };
    }

    if (phoneCardStatus === "approved") {
      return {
        level: "fail",
        code: "phone_card_approved_not_delivered",
        headline: "CARTE ACCEPTÉE — code PAS encore livré",
        detail:
          "La carte est vérifiée et le paiement est encaissé, mais aucun code " +
          "n'a été acheté ni saisi : rien ne part automatiquement. Aucun e-mail " +
          "avec code n'a été envoyé au client.",
        actions: [
          "Acheter le code chez le fournisseur (FazerCards), au montant et à la région de la commande.",
          "Admin → la ligne de la commande → « Saisir les codes manuellement » → « Enregistrer et envoyer au client ».",
          "Pour une recharge de jeu (game_topup) : créditer le Player ID puis « Clôturer sans code ».",
          "Vérifier ensuite : badge « Livré », « E-mail codes » daté, puis npm run delivery:check -- <REF>.",
        ],
      };
    }

    return {
      level: "warn",
      code: "phone_card_unverified",
      headline: "CARTE TÉLÉPHONIQUE À VÉRIFIER — livraison verrouillée",
      detail:
        "Le client a soumis une carte de recharge : elle doit être contrôlée à la " +
        "main (crédit réellement reçu) avant toute livraison. Tant que la carte " +
        "n'est pas acceptée, la saisie des codes est verrouillée.",
      actions: [
        "Vérifier la carte, puis l'accepter ou la refuser dans la zone « Cartes téléphoniques à vérifier ».",
        "L'acceptation n'achète rien : il faudra ensuite saisir le code à la main.",
      ],
    };
  }

  if (status === "failed") {
    return {
      level: "fail",
      code: "failed",
      headline: "ÉCHEC — aucun code livré",
      detail:
        "La commande est marquée `failed` : l'achat fournisseur a été refusé " +
        "définitivement. Le client doit être remboursé ou livré à la main.",
      actions: [
        "Lire le motif dans la commande (`last_error`).",
        "Livrer manuellement depuis le tableau du fournisseur, ou rembourser.",
        "Prévenir le client par WhatsApp avec la référence.",
      ],
    };
  }

  if (status === "pending") {
    return {
      level: "warn",
      code: "awaiting_payment",
      headline: "PAS ENCORE PAYÉ — rien à livrer",
      detail:
        "Aucun encaissement confirmé : la commande est en attente. Une facture " +
        "NOWPayments non réglée n'a pas à déclencher d'achat de code.",
      actions: [
        "Vérifier l'IPN NOWPayments et le statut dans /admin/orders.",
        "Ne jamais acheter le code avant `paid` confirmé.",
      ],
    };
  }

  if (status === "delivered") {
    if (isTopup) {
      return {
        level: "ok",
        code: "topup_delivered",
        headline: "LIVRÉ — recharge créditée (aucun code attendu)",
        detail:
          "Recharge de jeu : le crédit part directement sur le compte du joueur, " +
          "il n'y a pas de code à envoyer. Le suivi client affiche « créditée ».",
        actions: [
          "Confirmer le crédit côté fournisseur (identifiant transaction).",
          "Faire vérifier l'identifiant joueur par le client si contestation.",
        ],
      };
    }

    if (!hasCodesCipher) {
      return {
        level: "fail",
        code: "delivered_without_codes",
        headline: "INCOHÉRENT — « Livré » mais aucun code enregistré",
        detail:
          "La commande est marquée livrée alors qu'aucun code n'est stocké : " +
          "le client ne peut ni recevoir ni consulter son code. C'est le faux " +
          "positif classique du badge de statut.",
        actions: [
          "Ouvrir la commande dans /admin/digital/orders et vérifier la section « Codes livrés ».",
          "Acheter le code chez le fournisseur puis le saisir en livraison manuelle.",
        ],
      };
    }

    if (!emailSentAt) {
      return {
        level: "warn",
        code: "delivered_no_email",
        headline: "CODE EN BASE — e-mail des codes NON parti",
        detail:
          "Le code est livré et consultable sur /codes/commande, mais l'envoi " +
          "e-mail n'a jamais réussi. Le client ne le verra que s'il ouvre son " +
          "lien de suivi." +
          (emailLastError ? ` Dernière erreur : ${emailLastError}` : ""),
        actions: [
          "Dans /admin/digital/orders : « Renvoyer l'e-mail ».",
          "Tester le canal (carte « Envoi des e-mails ») : domaine non vérifié, SPF/DKIM.",
          "Joindre le code au client par WhatsApp/e-mail manuel en attendant.",
        ],
      };
    }

    return {
      level: "ok",
      code: "delivered",
      headline: "LIVRÉ — code remis au client",
      detail: `Code enregistré (chiffré) et e-mail accepté le ${emailSentAt}${
        deliveredAt ? `, livraison du ${deliveredAt}` : ""
      }. Reste à confirmer que le client a pu l'utiliser.`,
      actions: [
        "Vérifier que le client a bien racheté/utilisé le code (preuve finale).",
        "Conserver l'e-mail et fournir une capture si contestation.",
      ],
    };
  }

  return {
    level: "fail",
    code: "paid_not_delivered",
    headline: "PAYÉ — CODE NON LIVRÉ",
    detail:
      "Le paiement est encaissé mais aucun code n'a encore été enregistré. " +
      "La livraison est en attente (livraison manuelle ou incident fournisseur).",
    actions: [
      "Ouvrir /admin/digital/orders : la commande figure dans « À traiter ».",
      "Acheter le code (solde fournisseur suffisant ?) puis livrer.",
      "Si le fournisseur est en panne : prévenir le client, jamais de silence.",
    ],
  };
}
