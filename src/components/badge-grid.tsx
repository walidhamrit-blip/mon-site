import { badgeClientsFile, type BadgeStatus } from "@/lib/badge";

const statusStyle: Record<BadgeStatus, { dot: string; label: string }> = {
  verified: { dot: "bg-[var(--accent)]", label: "موثّق" },
  nofollow: { dot: "bg-amber-500", label: "nofollow" },
  missing: { dot: "bg-[var(--border)]", label: "بانتظار" },
  pending: { dot: "bg-[var(--border)]", label: "بانتظار" },
  down: { dot: "bg-red-500", label: "متوقف" },
};

/**
 * Liste des sites clients et de leur statut de badge (lecture de
 * `public/badge/clients.json`, alimenté par `npm run badge:audit`).
 *
 * Composant serveur : aucun JavaScript envoyé au navigateur.
 */
export function BadgeGrid() {
  const clients = Object.entries(badgeClientsFile.clients ?? {}).sort((a, b) =>
    String(a[1].slug).localeCompare(String(b[1].slug)),
  );

  if (clients.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
      <h2 className="text-lg font-black">المواقع المنجزة</h2>
      <p className="mt-1 text-xs opacity-50">
        آخر تحقق:{" "}
        <time dateTime={badgeClientsFile.generatedAt} dir="ltr">
          {new Date(badgeClientsFile.generatedAt).toISOString().slice(0, 10)}
        </time>
      </p>
      <ul className="mt-4 space-y-2.5">
        {clients.map(([url, entry]) => {
          const style = statusStyle[entry.status] ?? statusStyle.pending;
          return (
            <li key={url} className="flex items-center gap-3 text-xs">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                aria-hidden="true"
              />
              <a
                href={url}
                target="_blank"
                rel="noopener"
                className="min-w-0 flex-1 truncate font-bold hover:text-[var(--accent)] transition"
                dir="ltr"
              >
                {entry.titleEn || entry.title || entry.slug}
              </a>
              <span className="shrink-0 text-[10px] uppercase tracking-wider opacity-45">
                {style.label}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[11px] leading-5 opacity-40">
        الحالة تُحدَّد آلياً من HTML الصفحة الرئيسية لكل موقع: وجود الرابط، ثم
        <code dir="ltr" className="mx-1">rel</code>
        الخاص به.
      </p>
    </div>
  );
}
