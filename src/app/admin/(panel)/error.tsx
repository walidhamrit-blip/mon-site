"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Frontière d'erreur du panneau d'administration.
 *
 * Elle est volontairement distincte de la page publique ET de l'écran de
 * connexion : une erreur de rendu ne doit pas faire croire à une déconnexion
 * (l'admin risquerait de ressaisir son mot de passe et de perdre le contexte).
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      `[admin] rendu en erreur${error.digest ? ` (digest ${error.digest})` : ""}`,
    );
  }, [error]);

  return (
    <div className="min-h-[60vh] grid place-items-center px-6 py-16">
      <main className="w-full max-w-[560px] rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-black tracking-[0.12em] text-stone-500">
          NUKHBA · ADMIN
        </p>
        <h1 className="mt-4 text-xl font-black text-stone-900">
          Cette section n&apos;a pas pu s&apos;afficher
        </h1>
        <p className="mt-3 text-sm leading-7 text-stone-600">
          Vous êtes toujours connecté. Réessayez le rendu ; si l&apos;erreur
          persiste, revenez au tableau de bord et signalez le référence
          ci-dessous.
        </p>

        {error.digest ? (
          <p
            dir="ltr"
            className="mt-4 text-xs text-stone-500"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          >
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="h-10 rounded-xl bg-stone-900 px-5 text-sm font-bold text-white"
          >
            Réessayer
          </button>
          <Link
            href="/admin"
            className="h-10 rounded-xl border border-stone-300 px-5 inline-flex items-center text-sm font-bold text-stone-800"
          >
            Tableau de bord
          </Link>
        </div>
      </main>
    </div>
  );
}
