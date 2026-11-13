import { boolean, pgTable, serial, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import type { PhoneCardQuoteReference } from "@/lib/phone-card-pricing-core";

// Tables du panneau d'administration.
// Note : `src/db/index.ts` crée aussi ces tables automatiquement
// (CREATE TABLE IF NOT EXISTS) au premier accès — inutile d'exécuter
// `drizzle-kit push` pour que le site fonctionne sur Vercel.
// Si vous modifiez ce schéma, mettez à jour le DDL de ensureSchema() en conséquence.

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  name: text("name").notNull(),
  business: text("business").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  sector: text("sector").notNull(),
  need: text("need").notNull(),
  budget: text("budget").notNull(),
  deadline: text("deadline").notNull(),
  message: text("message"),
  utm: text("utm"),
  locale: text("locale"),
  status: text("status").notNull().default("new"),
  notes: text("notes"),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Setting = typeof settings.$inferSelect;

// Images importées depuis l'admin. Le contenu WebP est stocké en base pour
// survivre aux déploiements serverless (le système de fichiers Vercel est
// éphémère). Les URLs publiques sont immuables : /api/media/<uuid>.
export const mediaAssets = pgTable("media_assets", {
  id: text("id").primaryKey(),
  mimeType: text("mime_type").notNull(),
  data: text("data").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  originalName: text("original_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MediaAsset = typeof mediaAssets.$inferSelect;

// Commandes payées en crypto via NOWPayments.
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Référence interne affichée au client (ex. NKH-9F2C…). */
  ref: text("ref").notNull().unique(),
  /**
   * SHA-256 du jeton de suivi public (jamais le jeton en clair).
   * `null` sur les commandes créées avant cette protection.
   */
  trackingTokenHash: text("tracking_token_hash"),
  /** « plan » = formule complète ; « reservation » = acompte prioritaire 1 $. */
  kind: text("kind").notNull().default("plan"),
  /** Site du portfolio concerné par une réservation. */
  demoSlug: text("demo_slug"),
  planId: text("plan_id").notNull(),
  planName: text("plan_name").notNull(),
  /** Colonne historique (ancien montant LYD). Devise unique USD : on y écrit désormais le montant USD ; plus aucun affichage ne la lit. */
  amountLyd: text("amount_lyd").notNull(),
  /** Montant facturé à NOWPayments (devise fiat, ex. USD). */
  amountUsd: text("amount_usd").notNull(),
  currency: text("currency").notNull().default("usd"),
  /** Nombre total de tranches du plan de paiement (1 = paiement total). */
  installments: integer("installments").notNull().default(1),
  /** Numéro de la tranche que représente cette commande (1…installments). */
  installmentIndex: integer("installment_index").notNull().default(1),
  /** Référence commune à toutes les tranches d'un même plan. */
  groupRef: text("group_ref"),
  clientName: text("client_name"),
  email: text("email"),
  phone: text("phone"),
  /** Identifiant du paiement chez NOWPayments. */
  paymentId: text("payment_id").unique(),
  payAddress: text("pay_address"),
  payCurrency: text("pay_currency"),
  payAmount: text("pay_amount"),
  paymentUrl: text("payment_url"),
  /** pending | paid | failed | expired (statut interne). */
  status: text("status").notNull().default("pending"),
  /** Statut brut renvoyé par NOWPayments (waiting, confirming, finished…). */
  ipnStatus: text("ipn_status"),
  /** Canal d'encaissement : NOWPayments ou carte de recharge téléphonique à vérifier. */
  paymentMethod: text("payment_method").notNull().default("nowpayments"),
  utm: text("utm"),
  locale: text("locale"),
  /** Abonné auquel appartient ce paiement (null = paiement ponctuel). */
  subscriptionId: integer("subscription_id").references(() => subscriptions.id),
  /**
   * Commande digitale (codes / cartes cadeaux achetés à la commande).
   * Renseigné pour les commandes `kind = "digital"` : c'est le lien vers
   * la fiche de livraison (produit, destinataire, codes reçus).
   */
  digitalOrderId: integer("digital_order_id").references(() => digitalOrders.id),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

/**
 * Paiement par carte de recharge téléphonique, vérifié manuellement.
 *
 * Le code est chiffré en AES-256-GCM et son empreinte HMAC, unique, empêche
 * de le soumettre sur deux commandes. Aucun code n'apparaît dans les journaux,
 * les e-mails ou les réponses publiques de suivi.
 */
export const phoneCardPayments = pgTable("phone_card_payments", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  orderRef: text("order_ref")
    .notNull()
    .unique()
    .references(() => orders.ref, { onDelete: "cascade" }),
  operator: text("operator").notNull(),
  cardValueLyd: text("card_value_lyd").notNull(),
  /** Devis accepté par le client ; null sur les commandes antérieures au devis. */
  quoteAmountUsdt: text("quote_amount_usdt"),
  quoteRateLyd: text("quote_rate_lyd"),
  quoteTotalLyd: text("quote_total_lyd"),
  quoteMarkupPercent: integer("quote_markup_percent"),
  quoteSource: text("quote_source"),
  quoteRateUpdatedAt: timestamp("quote_rate_updated_at", { withTimezone: true }),
  quoteFetchedAt: timestamp("quote_fetched_at", { withTimezone: true }),
  /** Liens et valeurs figés des publications utilisées pour une médiane Telegram. */
  quoteReferences: jsonb("quote_references").$type<PhoneCardQuoteReference[]>(),
  codeCipher: text("code_cipher").notNull(),
  codeFingerprint: text("code_fingerprint").notNull().unique(),
  codeHint: text("code_hint").notNull(),
  /** pending | approved | rejected — seul approved autorise la livraison. */
  status: text("status").notNull().default("pending"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNote: text("review_note"),
});

export type PhoneCardPayment = typeof phoneCardPayments.$inferSelect;
export type NewPhoneCardPayment = typeof phoneCardPayments.$inferInsert;

// Plans d'abonnement (mensuel / annuel), synchronisés avec NOWPayments.
export const subscriptionPlans = pgTable("subscription_plans", {
  /** Identifiant local stable, ex. `vitrine-monthly`. */
  id: text("id").primaryKey(),
  /** Identifiant du plan chez NOWPayments (renseigné après création). */
  nowpaymentsPlanId: text("nowpayments_plan_id").unique(),
  tier: text("tier").notNull(),
  cycle: text("cycle").notNull(),
  title: text("title").notNull(),
  /** Montant par cycle en USD (texte pour éviter les arrondis). */
  priceUsd: text("price_usd").notNull(),
  intervalDay: integer("interval_day").notNull(),
  graceDays: integer("grace_days").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Abonnés. Le statut est dérivé des événements NOWPayments (IPN).
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  /** Référence lisible, ex. ABO-…. */
  ref: text("ref").notNull().unique(),
  /** SHA-256 du jeton de l'espace abonné (jamais le jeton en clair). */
  trackingTokenHash: text("tracking_token_hash"),
  planId: text("plan_id").notNull().references(() => subscriptionPlans.id),
  email: text("email").notNull(),
  clientName: text("client_name"),
  phone: text("phone"),
  nowpaymentsSubscriptionId: text("nowpayments_subscription_id").unique(),
  /**
   * Identifiant de la première facture (iid NOWPayments) rattachée à
   * l'abonnement. Les IPN d'abonnement ne portent aucun identifiant
   * d'abonnement : c'est cet iid (ou une réconciliation d'API) qui permet
   * de rattacher le paiement à l'abonné.
   */
  firstInvoiceId: text("first_invoice_id"),
  /** inactive (facture en attente) | active — grace/expired dérivés de la date. */
  status: text("status").notNull().default("inactive"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  lastPaymentId: text("last_payment_id"),
  /** Renouvellement annulé par le client (accès jusqu'à la fin de période). */
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  /** Échéance pour laquelle chaque relance a déjà été envoyée (anti-doublon). */
  reminderFor: timestamp("reminder_for", { withTimezone: true }),
  overdueNoticeFor: timestamp("overdue_notice_for", { withTimezone: true }),
  expiredNoticeFor: timestamp("expired_notice_for", { withTimezone: true }),
});

export type SubscriptionPlanRow = typeof subscriptionPlans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;

/* ---------- Catalogue digital (codes logiciels & cartes cadeaux) ---------- */

// Fiches produits du catalogue digital : codes d'activation, cartes cadeaux
// gaming, recharges de monnaie de jeu, codes d'abonnement.
// La fiche porte son contenu bilingue ; les « dénominations » (le prix
// concret de chaque code) vivent dans la table `digital_denominations`,
// une ligne par montant et par région.

export const digitalProducts = pgTable("digital_products", {
  /** Identifiant stable (ex. « steam-wallet »). */
  id: text("id").primaryKey(),
  /** Slug d'URL — `/codes/<slug>`. */
  slug: text("slug").notNull().unique(),
  /** software_key | gift_card | game_topup | subscription_code. */
  kind: text("kind").notNull(),
  /** draft | coming_soon | available | archived. */
  status: text("status").notNull().default("coming_soon"),
  /** Plateforme / marque (« Steam », « PlayStation », « Roblox »…). */
  platform: text("platform").notNull().default(""),
  /** Couleur de la carte (hex). */
  color: text("color").notNull().default("#C6A664"),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionAr: text("description_ar").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  /** Visuel de la carte (URL absolue ou chemin `/...`). */
  image: text("image").notNull().default(""),
  /** Régions couvertes (jsonb : ["global","US"]…). */
  regions: jsonb("regions").notNull().default([]),
  featuresAr: jsonb("features_ar").notNull().default([]),
  featuresEn: jsonb("features_en").notNull().default([]),
  deliveryNoteAr: text("delivery_note_ar").notNull().default(""),
  deliveryNoteEn: text("delivery_note_en").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),

  /* ---------- Livraison à la commande (fournisseur Reloadly) ---------- */

  /**
   * Mode de livraison :
   *  - `manual`   : le client paie, l'agence achète le code à la main dans
   *    le tableau Reloadly puis le transmet (aucun débit automatique) ;
   *  - `auto`     : le serveur achète et livre le code dès le paiement
   *    confirmé (le produit Reloadly doit être renseigné ci-dessous).
   */
  fulfillment: text("fulfillment").notNull().default("manual"),
  /** Identifiant du produit chez Reloadly (ex. 1234). */
  reloadlyProductId: integer("reloadly_product_id"),
  /** Pays du produit Reloadly (ISO 2 lettres, ex. « US »). */
  reloadlyCountryCode: text("reloadly_country_code").notNull().default(""),
  /**
   * Marge NETTE visée sur cette fiche, en % du prix payé (texte décimal,
   * vide = prix saisis à la main). Sert à recalculer les prix de vente à
   * partir du coût réel chez Reloadly.
   */
  marginPercent: text("margin_percent"),
  /**
   * Frais (`senderFeePercentage`) et remise (`discountPercentage`) publiés par
   * Reloadly pour ce produit, mémorisés au moment de la révision. Sans eux, un
   * prix inférieur à la valeur faciale pouvait être pris à tort pour une perte
   * alors qu'une remise le rend rentable.
   */
  supplierFeePercent: text("supplier_fee_percent"),
  supplierDiscountPercent: text("supplier_discount_percent"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const digitalDenominations = pgTable("digital_denominations", {
  id: serial("id").primaryKey(),
  /** Fiche parente. */
  productId: text("product_id")
    .notNull()
    .references(() => digitalProducts.id, { onDelete: "cascade" }),
  /** Libellé affiché (« $10 », « 500 Robux »). */
  label: text("label").notNull(),
  /** Valeur faciale (« 10 USD »). */
  faceValue: text("face_value").notNull().default(""),
  /** Région de validité du code (« global », « US »…). */
  region: text("region").notNull().default("global"),
  /** Prix de vente en USD (texte pour éviter les arrondis). */
  priceUsd: text("price_usd").notNull(),
  noteAr: text("note_ar"),
  noteEn: text("note_en"),
  /** Disponible à la vente. */
  available: integer("available").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  /**
   * Valeur faciale à transmettre à Reloadly (`unitPrice`) : par exemple
   * 50 pour une carte « 50 USD ». Vide = déduite de `faceValue`.
   */
  reloadlyUnitPrice: text("reloadly_unit_price"),
  /**
   * Devise de la valeur faciale (« USD », « TRY », « EGP »…). Vide = USD.
   * Une face en livres turques n'est pas un montant en dollars.
   */
  faceCurrency: text("face_currency"),
  /**
   * Coût réel en USD lu chez Reloadly pour ce montant (texte). C'est la
   * seule base de calcul fiable quand la face n'est pas en dollars.
   */
  supplierCostUsd: text("supplier_cost_usd"),
});

export type DigitalProductRow = typeof digitalProducts.$inferSelect;
export type DigitalDenominationRow = typeof digitalDenominations.$inferSelect;

/* ------------------- Commandes digitales (livrées à la commande) ------------------- */

/**
 * Une commande de code / carte cadeau.
 *
 * Cycle : `pending` (facture crypto émise) → `paid` (paiement confirmé,
 * livraison à faire) → `delivered` (code transmis au client).
 * `manual` = paiement reçu mais livraison humaine requise (Reloadly non
 * configuré, plafond dépassé, produit non relié, échec fournisseur) ;
 * `failed` = achat refusé définitivement.
 *
 * Les codes eux-mêmes ne sont JAMAIS stockés en clair : `codes_cipher`
 * contient un JSON chiffré (AES-256-GCM) déchiffrable uniquement côté
 * serveur, avec la clé dérivée de `DIGITAL_CODES_SECRET`/`SESSION_SECRET`.
 */
export const digitalOrders = pgTable("digital_orders", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  /** Référence publique (ex. DGC-…), identique au `ref` de la table orders. */
  ref: text("ref").notNull().unique(),
  /** SHA-256 du jeton de suivi (jamais le jeton en clair). */
  trackingTokenHash: text("tracking_token_hash"),

  productId: text("product_id").notNull(),
  productSlug: text("product_slug").notNull().default(""),
  /** Instantané du libellé (le catalogue peut changer après la vente). */
  productTitle: text("product_title").notNull(),
  kind: text("kind").notNull().default("gift_card"),
  platform: text("platform").notNull().default(""),
  denominationId: text("denomination_id").notNull().default(""),
  denominationLabel: text("denomination_label").notNull().default(""),
  region: text("region").notNull().default("global"),
  faceValue: text("face_value").notNull().default(""),
  quantity: integer("quantity").notNull().default(1),

  unitPriceUsd: text("unit_price_usd").notNull(),
  totalUsd: text("total_usd").notNull(),

  recipientEmail: text("recipient_email").notNull().default(""),
  recipientName: text("recipient_name"),
  recipientPhone: text("recipient_phone"),
  locale: text("locale").notNull().default("ar"),

  /** pending | paid | manual | delivered | failed */
  status: text("status").notNull().default("pending"),
  /** manual | auto */
  fulfillment: text("fulfillment").notNull().default("manual"),

  reloadlyProductId: integer("reloadly_product_id"),
  reloadlyUnitPrice: text("reloadly_unit_price"),
  reloadlyCountryCode: text("reloadly_country_code").notNull().default(""),
  reloadlyTransactionId: text("reloadly_transaction_id").unique(),
  reloadlyStatus: text("reloadly_status"),
  /** Réponse normalisée du fournisseur (jamais de code carte). */
  reloadlyResponse: jsonb("reloadly_response"),

  /** JSON chiffré des codes livrés ([{cardNumber,pinCode,redemptionUrl}]). */
  codesCipher: text("codes_cipher"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  /** Identifiant du message chez le fournisseur (Resend / SMTP). */
  emailProviderId: text("email_provider_id"),
  /** Motif du dernier échec d'envoi des codes (diagnostic admin). */
  emailLastError: text("email_last_error"),
  /**
   * Livraison effectuée HORS du système (WhatsApp, téléphone, e-mail direct) :
   * canal utilisé + note libre. Non nul = la commande a été livrée sans que le
   * code soit stocké ici ; l'admin doit alors savoir où le code a été remis.
   */
  deliveryChannel: text("delivery_channel"),
  deliveryNote: text("delivery_note"),

  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),

  /**
   * Statut granulaire de fulfillment (file de livraison) :
   * `pending_payment` | `paid_fulfilling` | `delivered` | `manual_review`.
   *
   * Vue granulaire de `status` (voir `fulfillmentStatusFromLegacy` dans
   * `delivery-queue-core.ts`) : les deux colonnes sont écrites ensemble.
   * `paid_fulfilling` couvre l'achat fournisseur ET les retries programmés ;
   * `manual_review` = retries épuisés ou échec permanent (humain requis).
   */
  fulfillmentStatus: text("fulfillment_status")
    .notNull()
    .default("pending_payment"),
  /** Fournisseur qui livre (`fazercards` | `reloadly`) — dénormalisé pour la file. */
  supplier: text("supplier").notNull().default("fazercards"),
  /**
   * Clé d'idempotence stricte de la commande (= `ref`, ex. `DGC-…`).
   * UNIQUE : un double IPN / cron / clic admin ne peut jamais produire
   * deux achats chez le fournisseur.
   */
  idempotencyKey: text("idempotency_key"),
  /** Prochaine tentative automatique (file de livraison). */
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  /**
   * Dernière alerte Telegram d'échec de livraison envoyée (anti-spam :
   * la même erreur répétée ne renvoie pas d'alerte).
   */
  telegramAlertedAt: timestamp("telegram_alerted_at", { withTimezone: true }),
});

export type DigitalOrder = typeof digitalOrders.$inferSelect;
export type NewDigitalOrder = typeof digitalOrders.$inferInsert;

/**
 * Livraison d'un projet web : le « procès-verbal de remise » remis au client.
 *
 * Une ligne = un projet livré. Le client ouvre `/livraison/<ref>?t=<jeton>`,
 * consulte le récapitulatif (liens, éléments livrés, garantie) et valide la
 * recette d'un clic. La validation est horodatée : elle met fin à la
 * discussion sur ce qui était attendu et ouvre la période de garantie.
 *
 * Aucune donnée sensible ici : les mots de passe ne passent jamais par cette
 * table (voir docs/livraison-site-apres-paiement-2026-11-04.md §6).
 */
export const siteDeliveries = pgTable("site_deliveries", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Référence lisible (LIV-…) — seul identifiant public du dossier. */
  ref: text("ref").notNull().unique(),
  /** SHA-256 du jeton de validation ; le jeton en clair n'est jamais stocké. */
  trackingTokenHash: text("tracking_token_hash").notNull(),
  /**
   * Jeton chiffré (AES-256-GCM) — uniquement pour renvoyer le lien au client.
   * `null` si aucun secret d'environnement n'est configuré.
   */
  trackingTokenCipher: text("tracking_token_cipher"),
  clientName: text("client_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  /** Intitulé du projet, tel qu'il figure au devis. */
  projectTitle: text("project_title").notNull(),
  /** Montant encaissé (total ou solde), en USD — texte : pas d'arrondi flottant. */
  amountUsd: text("amount_usd").notNull().default(""),
  /** Liens remis : [{ label, url }] — site, admin, dépôt, dossier, vidéo… */
  links: jsonb("links").notNull().default([]),
  /** Éléments livrés, repris du devis : [{ label }]. */
  checklist: jsonb("checklist").notNull().default([]),
  /** Jours de garantie annoncés au client (défaut : 30). */
  warrantyDays: integer("warranty_days").notNull().default(30),
  /** « delivered » = remis, en attente de validation ; « accepted » = validé. */
  status: text("status").notNull().default("delivered"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  /** Nom de la personne qui valide (tracé, affiché sur le reçu). */
  acceptedByName: text("accepted_by_name"),
  locale: text("locale"),
  /** Notes internes (jamais affichées au client). */
  notes: text("notes"),
});

export type SiteDelivery = typeof siteDeliveries.$inferSelect;
export type NewSiteDelivery = typeof siteDeliveries.$inferInsert;

/**
 * Solde dû à un client (trop-perçu d'une carte de recharge, geste commercial…).
 *
 * Un client règle 30,00 LYD avec une carte alors que le devis accepté est de
 * 17,96 LYD : les 12,04 LYD restants lui appartiennent. On garde donc un
 * **solde** par personne, alimenté par des mouvements (trop-perçu, utilisation,
 * remboursement, ajustement) — jamais un simple champ « note ».
 *
 * `clientKey` = `email:…` ou `phone:…` (voir `normalizeClientKey`), pour
 * rapprocher les commandes successives d'un même client.
 */
export const clientCredits = pgTable("client_credits", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  clientKey: text("client_key").notNull().unique(),
  clientName: text("client_name"),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  /** Solde courant en LYD (texte : pas d'arrondi flottant sur de l'argent). */
  balanceLyd: text("balance_lyd").notNull().default("0.00"),
  note: text("note"),
});

export type ClientCredit = typeof clientCredits.$inferSelect;
export type NewClientCredit = typeof clientCredits.$inferInsert;

/**
 * Mouvement de solde — la seule source de vérité. `balance_lyd` n'en est que
 * la somme, recalculée à chaque écriture.
 *
 * `amount_lyd` est signé : + pour un trop-perçu ou un ajustement positif,
 * − pour une utilisation ou un remboursement.
 */
export const clientCreditMovements = pgTable("client_credit_movements", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  creditId: integer("credit_id")
    .notNull()
    .references(() => clientCredits.id, { onDelete: "cascade" }),
  /** overpayment | use | refund | adjustment */
  kind: text("kind").notNull(),
  amountLyd: text("amount_lyd").notNull(),
  /** Commande concernée (trop-perçu ou utilisation), si applicable. */
  orderRef: text("order_ref"),
  balanceAfterLyd: text("balance_after_lyd").notNull().default("0.00"),
  note: text("note"),
});

export type ClientCreditMovement = typeof clientCreditMovements.$inferSelect;
export type NewClientCreditMovement = typeof clientCreditMovements.$inferInsert;

/**
 * Demande d'utilisation d'un solde par le CLIENT lui-même.
 *
 * Le client voit son solde sur le suivi de sa commande (lien privé) et
 * demande à l'utiliser. **L'argent ne bouge pas à ce moment-là** : la
 * demande attend la validation de l'admin (`approved` → mouvement `use`).
 * C'est la protection contre l'usurpation : il n'y a pas de compte client,
 * donc seule l'équipe décide du débit.
 *
 * L'index unique `(order_ref, status)` empêche deux demandes en attente sur
 * la même commande (et une double validation).
 */
export const clientCreditRequests = pgTable("client_credit_requests", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  creditId: integer("credit_id")
    .notNull()
    .references(() => clientCredits.id, { onDelete: "cascade" }),
  orderRef: text("order_ref").notNull(),
  /** Montant demandé (le solde disponible au moment de la demande). */
  amountLyd: text("amount_lyd").notNull(),
  /** pending | approved | rejected */
  status: text("status").notNull().default("pending"),
  clientNote: text("client_note"),
  adminNote: text("admin_note"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export type ClientCreditRequest = typeof clientCreditRequests.$inferSelect;
export type NewClientCreditRequest = typeof clientCreditRequests.$inferInsert;

/**
 * Abonnés du bot Telegram.
 *
 * Une ligne = un chat privé qui a démarré le bot (`/start`). Le consentement
 * marketing est explicite (`marketing_opt_in`) : démarrer le bot n'abonne à
 * aucune campagne. `status = "blocked"` est posé automatiquement quand
 * Telegram répond « bot was blocked by the user » — on cesse alors de lui
 * écrire, sans supprimer la ligne (historique conservé).
 */
export const telegramSubscribers = pgTable("telegram_subscribers", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  /** Identifiant du chat privé (toujours positif pour un utilisateur). */
  chatId: text("chat_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  /** ar | en | fr — langue choisie dans le bot. */
  language: text("language").notNull().default("ar"),
  /** Origine du premier /start (paramètre du lien t.me/…?start=…). */
  source: text("source"),
  /** active | blocked */
  status: text("status").notNull().default("active"),
  /** Consentement explicite aux offres marketing. */
  marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
  optedInAt: timestamp("opted_in_at", { withTimezone: true }),
  /** Dernier message reçu du client (support), pour l'admin. */
  lastMessage: text("last_message"),
});

export type TelegramSubscriber = typeof telegramSubscribers.$inferSelect;
export type NewTelegramSubscriber = typeof telegramSubscribers.$inferInsert;

/** Journal des campagnes marketing envoyées depuis /admin/telegram. */
export const telegramCampaigns = pgTable("telegram_campaigns", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  /** Nombre de destinataires ciblés / servis / refusés. */
  audience: integer("audience").notNull().default(0),
  sent: integer("sent").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  blocked: integer("blocked").notNull().default(0),
  /** sent | partial | failed */
  status: text("status").notNull().default("sent"),
});

export type TelegramCampaign = typeof telegramCampaigns.$inferSelect;

/* ----------------- File de livraison & idempotence webhooks ----------------- */

/**
 * File de livraison (file d'attente en base, sans service externe).
 *
 * Une ligne = une commande payée dont l'achat fournisseur doit être tenté.
 * Le worker (`delivery-queue.ts`, déclenché par l'IPN, le suivi client et
 * le cron) réclame les jobs dus avec un bail (`claimed_at` + `claim_token`),
 * puis appelle la livraison habituelle. En cas d'échec transitoire, le job
 * est reprogrammé (`next_retry_at` + backoff) ; après `max_attempts`
 * échecs ou un échec permanent, il passe en `dead_letter` et la commande
 * en `manual_review` (alerte Telegram immédiate).
 *
 * `order_ref` et `idempotency_key` sont UNIQUES : mettre la commande en
 * file deux fois (double IPN, double cron) ne crée jamais deux jobs.
 */
export const deliveryJobs = pgTable("delivery_jobs", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  /** Référence publique de la commande (`DGC-…`). */
  orderRef: text("order_ref").notNull().unique(),
  digitalOrderId: integer("digital_order_id"),
  /** fazercards | reloadly */
  supplier: text("supplier").notNull().default("fazercards"),
  /** Clé d'idempotence stricte (= `order_ref`), UNIQUE. */
  idempotencyKey: text("idempotency_key").notNull().unique(),
  /** queued | processing | done | failed | dead_letter */
  status: text("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(6),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  lastError: text("last_error"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  claimToken: text("claim_token"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type DeliveryJob = typeof deliveryJobs.$inferSelect;
export type NewDeliveryJob = typeof deliveryJobs.$inferInsert;

/**
 * Journal d'idempotence des webhooks entrants.
 *
 * Une ligne = un événement déjà reçu (`event_key` UNIQUE, ex.
 * `nowpayments:pay_123:finished`). L'IPN insère la ligne AVANT de traiter :
 * si l'insertion échoue en conflit, l'événement est un doublon et la
 * route répond `200` sans rien retraiter (pas de double achat, pas de
 * double e-mail). `payload_hash` (SHA-256) permet de détecter un même
 * identifiant avec un corps différent (anomalie à investiguer).
 */
export const webhookEvents = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** nowpayments | fazercards | reloadly … */
  provider: text("provider").notNull(),
  /** Clé d'idempotence de l'événement, UNIQUE. */
  eventKey: text("event_key").notNull().unique(),
  /** SHA-256 du corps brut reçu (jamais le corps lui-même). */
  payloadHash: text("payload_hash"),
  /** Statut brut porté par l'événement (finished, waiting…). */
  eventStatus: text("event_status"),
  /** received | processed | ignored | failed */
  outcome: text("outcome").notNull().default("received"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
