import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db, ensureSchema } from "@/db";
import { leads } from "@/db/schema";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/site-types";

export const dynamic = "force-dynamic";

const BOM = "\uFEFF";

function cell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Exporte toutes les demandes en CSV (séparateur « ; » pour Excel FR). */
export async function GET() {
  await requireAdmin();

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
