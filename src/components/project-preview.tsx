"use client";

import { useState } from "react";
import Image from "next/image";
import { Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getProjectPreview } from "@/lib/project-previews";
import type { Demo } from "@/lib/site-types";

/**
 * Aperçu d'un projet : une image légère, jamais un site embarqué.
 *
 * Trois cas, dans cet ordre :
 *  1. une capture locale (`public/previews/*.webp`) si le manifeste la connaît ;
 *  2. sinon l'image du projet (URL distante) — elle peut échouer (hébergeur
 *     injoignable, réseau filtré, image supprimée) ;
 *  3. dans ce cas, un visuel de repli **dessiné** : mini-fenêtre de navigateur
 *     teintée avec la couleur du projet, monogramme et nom du secteur. L'ancien
 *     repli (globe + titre sur fond gris) donnait huit cartes identiques et
 *     vides dans la galerie ; celui-ci reste lisible et différencié.
 */
export function ProjectPreview({
  demo,
  mode = "desktop",
  priority = false,
  label = false,
}: {
  demo: Demo;
  mode?: "desktop" | "mobile";
  priority?: boolean;
  label?: boolean;
}) {
  const { locale } = useI18n();
  const { src, screenshot } = getProjectPreview(demo, mode);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const title = locale === "ar" ? demo.title : demo.titleEn;
  const failed = !src || failedSrc === src;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--secondary)]">
      {failed && (
        // Repli vectoriel : il doit rester lisible aussi bien dans une
        // vignette de 120 px que dans l'aperçu 16/9 — les tailles suivent donc
        // le conteneur (`cqmin`) au lieu d'être fixes.
        <div
          className="@container absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 85% 0%, color-mix(in srgb, ${demo.color} 24%, transparent) 0%, transparent 62%), linear-gradient(160deg, var(--card) 0%, var(--secondary) 100%)`,
          }}
        >
          <div className="absolute inset-x-0 top-0 flex items-center gap-[0.4cqmin] px-[3cqmin] pt-[3cqmin]">
            <span className="h-[1.6cqmin] min-h-[3px] w-[1.6cqmin] min-w-[3px] rounded-full bg-[var(--foreground)]/15" />
            <span className="h-[1.6cqmin] min-h-[3px] w-[1.6cqmin] min-w-[3px] rounded-full bg-[var(--foreground)]/15" />
            <span className="h-[1.6cqmin] min-h-[3px] w-[1.6cqmin] min-w-[3px] rounded-full bg-[var(--foreground)]/15" />
          </div>

          <div className="absolute inset-x-0 top-[41%] flex -translate-y-1/2 flex-col items-center gap-[1.6cqmin] px-[5cqmin] text-center">
            <span
              className="grid place-items-center rounded-[1.6cqmin] font-black text-white shadow-[var(--shadow-sm)]"
              style={{
                backgroundColor: demo.color,
                width: "clamp(22px, 20cqmin, 46px)",
                height: "clamp(22px, 20cqmin, 46px)",
                fontSize: "clamp(10px, 9cqmin, 20px)",
              }}
              aria-hidden="true"
            >
              {title.trim().charAt(0)}
            </span>
            <span
              className="line-clamp-2 font-bold leading-snug text-[var(--foreground)]/85"
              style={{ fontSize: "clamp(8px, 6.6cqmin, 12.5px)" }}
            >
              {title}
            </span>
          </div>

        </div>
      )}

      {src && !failed && (
        <Image
          key={src}
          src={src}
          alt={title}
          fill
          // Les WebP locaux sont déjà dimensionnés. Les images distantes
          // restent prises en charge sans dépendre d'un proxy d'images.
          unoptimized
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className={`object-cover ${screenshot ? "object-top" : "object-center"}`}
          onError={() => setFailedSrc(src)}
        />
      )}

      {label && !screenshot && !failed && (
        <div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-8 text-white"
          dir={locale === "ar" ? "rtl" : "ltr"}
        >
          <p className="text-[10px] opacity-80">
            {locale === "ar" ? "صورة من المشروع" : "Project visual"}
          </p>
          <p className="text-xs font-bold">{title}</p>
        </div>
      )}
    </div>
  );
}
