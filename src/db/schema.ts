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
  /** Montant affiché sur le site (Livre libyenne, texte pour éviter les arrondis). */
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
