"use client";

import { LocalizedLink as Link } from "@/components/localized-link";
import { useEffect } from "react";

/**
 * Frontière d'erreur des pages publiques.
 *
 * Elle garde l'identité du site, propose une reprise (`reset`) et un chemin de
 * secours (accueil, contact). Le message technique n'est jamais rendu : seul
 * le `digest` est affiché. L'erreur est aussi transmise à Sentry (C-04),
 * désactivé tant qu'aucun DSN n'est configuré.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Trace locale minimale : nom + digest, jamais le contenu de la requête.
    console.error(
      `[site] rendu en erreur${error.digest ? ` (digest ${error.digest})` : ""}`,
    );
    // Sentry ajoute le contexte technique (pile, route) ; sans DSN, no-op.
    // Sans DSN, on ne télécharge même pas le SDK pour la page d'erreur.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import("@sentry/nextjs")
        .then(({ captureException }) => captureException(error))
        .catch(() => {
          // Sentry indisponible : la trace console suffit.
        });
    }
  }, [error]);

  return (
    <div className="min-h-[70vh] grid place-items-center px-4 py-16">
      <main className="w-full max-w-[560px] rounded-[22px] border border-[var(--border)] bg-[var(--card)] p-7 sm:p-9 text-center shadow-sm">
        <p className="text-xs font-black tracking-[0.12em] text-[var(--accent)]">
          NUKHBA · خطأ غير متوقع
        </p>
        <h1 className="mt-4 text-2xl font-black leading-tight">
          تعذّر عرض هذه الصفحة
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
          حدث خطأ أثناء التحميل. أعد المحاولة، أو تواصل معنا إن استمرت المشكلة.
        </p>
        <p
          dir="ltr"
          className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]"
        >
          Something went wrong. Try again, or contact us if it persists.
        </p>

        {error.digest ? (
          <p
            dir="ltr"
            className="mt-4 text-xs text-[var(--muted-foreground)]"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-full bg-[var(--primary)] px-6 text-sm font-bold text-[var(--primary-foreground)]"
          >
            إعادة المحاولة · Try again
          </button>
          <Link
            href="/"
            className="h-11 rounded-full border border-[var(--border)] px-6 inline-flex items-center text-sm font-bold"
          >
            الرئيسية · Home
          </Link>
          <Link
            href="/contact"
            className="h-11 rounded-full border border-[var(--border)] px-6 inline-flex items-center text-sm font-bold"
          >
            تواصل معنا · Contact
          </Link>
        </div>
      </main>
    </div>
  );
}
