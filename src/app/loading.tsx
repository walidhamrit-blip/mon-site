/**
 * État de chargement global.
 *
 * Les pages publiques sont rendues à la demande (données en cache, HTML
 * dynamique) : un squelette discret évite l'écran figé pendant l'attente,
 * sans ajouter de dépendance ni de JavaScript client.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="min-h-[60vh] grid place-items-center px-6 py-20"
    >
      <div className="w-full max-w-[420px] text-center">
        <div className="mx-auto h-10 w-10 animate-pulse rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
        <p className="mt-5 text-sm font-bold text-[var(--muted-foreground)]">
         جارٍ التحميل…
        </p>
        <p
          dir="ltr"
          className="mt-1 text-xs text-[var(--muted-foreground)]"
        >
          Loading…
        </p>
      </div>
    </div>
  );
}
