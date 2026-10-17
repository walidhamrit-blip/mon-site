import { defineConfig } from "drizzle-kit";

// Utilisation locale uniquement : sur Vercel les tables sont créées
// automatiquement par ensureSchema() (src/db/index.ts).
//   DATABASE_URL=postgresql://… npx drizzle-kit push
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});
