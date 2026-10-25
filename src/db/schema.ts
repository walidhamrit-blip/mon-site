import { pgTable, serial, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

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

  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
});

export type DigitalOrder = typeof digitalOrders.$inferSelect;
export type NewDigitalOrder = typeof digitalOrders.$inferInsert;
