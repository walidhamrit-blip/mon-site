"use client";

import Image from "next/image";
import { imageOptimizationProps } from "@/lib/image-source";
import { useI18n } from "@/lib/i18n";
import { useSiteContent } from "@/components/site-provider";

/** Same quiet, image-led banner language across the two business journeys. */
export function EditorialVisual({ kind }: { kind: "web" | "store" }) {
  const { locale } = useI18n();
  const { visuals } = useSiteContent();
  const web = kind === "web";
  const image = web ? visuals.webBanner : visuals.storeBanner;
  return (
    <div className="editorial-visual">
      <Image
        src={image.src}
        {...imageOptimizationProps(image.src)}
        alt={locale === "ar" ? image.altAr : image.altEn}
        fill
        sizes="(max-width: 1280px) 95vw, 1240px"
        quality={90}
        className={web ? "editorial-visual-image is-web" : "editorial-visual-image"}
      />
    </div>
  );
}
