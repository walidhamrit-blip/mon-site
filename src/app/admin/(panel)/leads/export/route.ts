import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db, ensureSchema } from "@/db";
import { leads } from "@/db/schema";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/site-types";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const BOM = "\uFEFF";

function cell(value: unknown): string {
  // Échappement CSV conforme RFC 4180 : tout champ entouré de `"` voit
  // ses guillemets doublés. Les retours à la ligne et le séparateur « ; »
  // sont neutralisés par les guillemets englobants.
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/* Limite la fréquence de téléchargement des données personnelles (PII :
 * nom, e-mail, téléphone). Bloque les tentatives d'exfiltration massive
 * depuis un compte admin compromis. */
const EXPORT_LIMIT = {
  windowMs: 60 * 60 * 1000,
  max: 10,
  minIntervalMs: 5000,
  prefix: "leads-export",
} as const;

/** Exporte toutes les demandes en CSV (séparateur « ; » pour Excel FR). */
export async function GET(request: Request) {
  await requireAdmin();

  // Rate-limit post-`requireAdmin` : on veut que les administrateurs
  // légitimes puissent exporter fréquemment, mais qu'un compte admin
  // compromis ne puisse pas automatiser des téléchargements en masse.
  const decision = checkRateLimit(EXPORT_LIMIT, request);
  if (!decision.allow) {
    return new Response(
      "Téléchargement trop fréquent. Réessayez dans quelques minutes.",
      {
        status: 429,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Retry-After": String(Math.max(1, decision.retryAfterSec)),
        },
      },
    );
  }

  try {
    await ensureSchema();
    const rows = await db.select().from(leads).orderBy(desc(leads.createdAt));

    const header = [
      "Date",
      "Nom",
      "Activité",
      "Téléphone",
      "Email",
      "Secteur",
      "Besoin",
      "Budget",
      "Délai",
      "Message",
      "Statut",
      "Notes",
      "UTM",
      "Langue",
    ];

    const lines = rows.map((r) => {
      const statusKey = (Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).find(
        (s) => s === r.status,
      );
      return [
        r.createdAt instanceof Date
          ? r.createdAt.toISOString().replace("T", " ").slice(0, 16)
          : String(r.createdAt),
        r.name,
        r.business,
        r.phone,
        r.email,
        r.sector,
        r.need,
        r.budget,
        r.deadline,
        r.message,
        statusKey ? LEAD_STATUS_LABELS[statusKey] : r.status,
        r.notes,
        r.utm,
        r.locale,
      ]
        .map(cell)
        .join(";");
    });

    const csv = BOM + [header.map(cell).join(";"), ...lines].join("\r\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nukhba-demandes.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin/export]", error);
    return new Response("Export impossible (base de données inaccessible).", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
