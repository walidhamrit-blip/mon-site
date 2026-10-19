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
  /** Référence interne affichée au client (ex. NKH-LZ3K9XAB12CD). */
  ref: text("ref").notNull().unique(),
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
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
