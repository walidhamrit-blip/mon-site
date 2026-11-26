"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { universeForPath, universeShowsAgencySchema, type Universe } from "@/lib/universes";

/** Univers de la page courante (rendu serveur compris : `usePathname` est disponible au SSR). */
export function useUniverse(): Universe {
  return universeForPath(usePathname());
}

/**
 * Enveloppe publique : expose l'univers courant via `data-universe` pour que
 * le style (src/app/universes.css) et les composants communs s'adaptent sans
 * changer d'URL. Les données structurées « agence » ne sont émises que hors
 * boutique : une fiche produit Steam n'a pas à décrire un ProfessionalService.
 */
export function UniverseShell({
  className,
  agencySchema,
  children,
}: {
  className: string;
  agencySchema: ReadonlyArray<unknown>;
  children: ReactNode;
}) {
  const universe = useUniverse();
  return (
    <div className={className} data-universe={universe}>
      {children}
      {universeShowsAgencySchema(universe) && agencySchema.length > 0 ? <JsonLd data={agencySchema} /> : null}
    </div>
  );
}
