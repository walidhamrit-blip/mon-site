import Image from "next/image";

/** Same quiet, image-led banner language across the two business journeys. */
export function EditorialVisual({ kind }: { kind: "web" | "store" }) {
  const web = kind === "web";
  return (
    <div className="editorial-visual">
      <Image
        src={web ? "/previews/al-manhaj-company-desktop.webp" : "/visuals/futuristic-gaming-hero.webp"}
        alt={web ? "Website design example — نموذج تصميم موقع إلكتروني" : "Futuristic computing and gaming illustration — مشهد حاسوب وألعاب مستقبلي"}
        fill
        sizes="(max-width: 1280px) 95vw, 1240px"
        quality={90}
        className={web ? "editorial-visual-image is-web" : "editorial-visual-image"}
      />
    </div>
  );
}
