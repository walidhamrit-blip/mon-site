import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";

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
