"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import { useSiteContent } from "@/components/site-provider";

/**
 * Bannière d'accueil DÉFILANTE : les visuels défilent en boucle horizontale
 * infinie (deux copies identiques → boucle parfaite à -50 %), sur le même
 * principe que le ruban de services.
 *
 * Mise en page : la section fait 100vw, la piste fait `width: max-content` et
 * chaque tuile a `height: 100%; width: auto` — chaque image garde son ratio
 * et le bandeau s'adapte ainsi ENTIÈrement à toutes les largeurs d'écran.
 * Format conseillé par image : 1920×720 (2,67:1) ou 1280×720 (16:9),
 * WebP qualité 80-85, < 250 Ko, 8 images maximum.
 */
export function Hero() {
  const { locale } = useI18n();
  const { visuals } = useSiteContent();
  const ar = locale === "ar";
  // homeHero en tête, puis les autres visuels de bannière, sans doublon de src.
  const ordered = [visuals.homeHero, ...Object.values(visuals).filter((v) => v.src !== visuals.homeHero.src)];
  const items = ordered.filter((visual, index, all) => all.findIndex((v) => v.src === visual.src) === index);
  return (
    <section className="panoramic-hero" aria-label={ar ? "شريط صور نخبة" : "Nukhba visuals marquee"}>
      <h1 className="sr-only">
        {ar ? "نخبة — إنشاء مواقع وبطاقات رقمية وألعاب وشحن" : "Nukhba — Website creation, digital gift cards, gaming & top-ups"}
      </h1>
      <div className="hero-marquee-window" dir="ltr">
        <div className="hero-marquee-track" style={{ animationDirection: ar ? "reverse" : "normal" }}>
          {[0, 1].map((copy) => (
            <ul key={copy} aria-hidden={copy === 1 ? true : undefined} className="hero-marquee-group">
              {items.map((visual, index) => (
                <li key={`${visual.src}-${index}`} className="hero-marquee-item">
                  <Image
                    src={visual.src}
                    alt={ar ? visual.altAr : visual.altEn}
                    width={1920}
                    height={720}
                    preload={copy === 0 && index === 0}
                    sizes="(max-width: 640px) 100vw, 45vw"
                    quality={85}
                    className="hero-marquee-image"
                  />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
