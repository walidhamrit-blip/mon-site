"use client";

import { useState } from "react";
import Image from "next/image";
import { Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getProjectPreview } from "@/lib/project-previews";
import type { Demo } from "@/lib/site-types";

/** A lightweight image, never an embedded website. Broken images keep a useful
 * project card instead of a spinner or an empty device. */
export function ProjectPreview({ demo, mode = "desktop", priority = false, label = false }: {
  demo: Demo;
  mode?: "desktop" | "mobile";
  priority?: boolean;
  label?: boolean;
}) {
  const { locale } = useI18n();
  const { src, screenshot } = getProjectPreview(demo, mode);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const title = locale === "ar" ? demo.title : demo.titleEn;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--secondary)]">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-[var(--foreground)]" dir={locale === "ar" ? "rtl" : "ltr"}>
        <Globe className="h-8 w-8 text-[var(--accent)]" />
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs opacity-60">{locale === "ar" ? "اكتشف الموقع عبر رابط الزيارة" : "Explore the website using the visit link"}</p>
      </div>
      {src && failedSrc !== src && (
        <Image
          key={src}
          src={src}
          alt={title}
          fill
          // Local WebP files are already resized. Remote admin images remain
          // supported without depending on an image proxy or host allowlist.
          unoptimized
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className={`object-cover ${screenshot ? "object-top" : "object-center"}`}
          onError={() => setFailedSrc(src)}
        />
      )}
      {label && !screenshot && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-8 text-white" dir={locale === "ar" ? "rtl" : "ltr"}>
          <p className="text-[10px] opacity-80">{locale === "ar" ? "صورة من المشروع" : "Project visual"}</p>
          <p className="text-xs font-bold">{title}</p>
        </div>
      )}
    </div>
  );
}
