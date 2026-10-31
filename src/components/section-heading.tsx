import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * En-tête de section partagé.
 *
 * Avant, chaque section réinventait son en-tête : tailles de titre 28/30/32/
 * 38/42/44 px, étiquette tantôt soulignée, tantôt centrée, tantôt collée à
 * gauche, sous-titres en `opacity-60` sur fond clair (contraste insuffisant
 * et rendu incohérent d'une section à l'autre). Ce composant applique la
 * même hiérarchie partout : étiquette → titre fluide → phrase d'accroche.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "start",
  note,
  aside,
  className,
  as: Heading = "h2",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  align?: "start" | "center";
  note?: ReactNode;
  aside?: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "gaming-section-heading flex flex-col gap-6",
        centered
          ? "items-center text-center"
          : "lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className={cn("min-w-0", centered && "max-w-[720px]")}>
        {eyebrow ? (
          <span className={cn("section-eyebrow", centered && "is-centered justify-center")}>
            {eyebrow}
          </span>
        ) : null}
        <Heading className="section-title">{title}</Heading>
        {lead ? (
          <p className={cn("section-lead", centered && "mx-auto")}>{lead}</p>
        ) : null}
        {note ? (
          <p className="mt-3 text-[12.5px] text-[var(--muted-foreground)]">{note}</p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}
