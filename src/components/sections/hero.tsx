"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";

/** A single edge-to-edge visual. The visible navigation follows immediately. */
export function Hero() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <section className="panoramic-hero">
      <h1 className="sr-only">
        {ar ? "نخبة — إنشاء مواقع وبطاقات رقمية وألعاب وشحن" : "Nukhba — Website creation, digital gift cards, gaming & top-ups"}
      </h1>
      <Image
        src="/visuals/futuristic-gaming-hero.webp"
        alt={ar ? "مشهد توضيحي واقعي لمحطة حاسوب وألعاب مستقبلية بإضاءة زرقاء وبنفسجية" : "Photorealistic illustration of a futuristic computing and gaming workstation with blue and violet lighting"}
        fill
        preload
        sizes="100vw"
        quality={90}
        className="panoramic-hero-image"
      />
    </section>
  );
}
