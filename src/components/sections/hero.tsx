"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import { useSiteContent } from "@/components/site-provider";

/** A single edge-to-edge visual. The visible navigation follows immediately. */
export function Hero() {
  const { locale } = useI18n();
  const { visuals } = useSiteContent();
  const image = visuals.homeHero;
  const ar = locale === "ar";
  return (
    <section className="panoramic-hero">
      <h1 className="sr-only">
        {ar ? "نخبة — إنشاء مواقع وبطاقات رقمية وألعاب وشحن" : "Nukhba — Website creation, digital gift cards, gaming & top-ups"}
      </h1>
      <Image
        src={image.src}
        alt={ar ? image.altAr : image.altEn}
        fill
        preload
        sizes="100vw"
        quality={90}
        className="panoramic-hero-image"
      />
    </section>
  );
}
