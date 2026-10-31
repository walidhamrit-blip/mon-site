"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const slides = [
  { src: "/visuals/digital-universe.webp", ar: "عالمك الرقمي، بلا حدود", en: "Your digital world, unlocked", categoryAr: "ألعاب · بطاقات · شحن", categoryEn: "Games · Gift cards · Top-ups", href: "/codes", altAr: "تصميم توضيحي لوحدة تحكم ألعاب وبطاقات رقمية مضيئة", altEn: "Illustration of a game controller and luminous digital cards", type: "store" },
  { src: "/previews/hala-perfumes-desktop.webp", ar: "من فكرة إلى تجربة متكاملة", en: "From an idea to a complete experience", categoryAr: "نماذج مواقع · متاجر إلكترونية", categoryEn: "Website examples · Online stores", href: "/demos", altAr: "معاينة نموذج متجر هالة للعطور", altEn: "Hala Perfumes online store example", type: "web" },
  { src: "/digital-products/steam-wallet.jpg", ar: "اختر عالمك. اكتشف بطاقاتك.", en: "Choose your world. Explore digital cards.", categoryAr: "اكتشف المتجر الرقمي", categoryEn: "Explore the digital store", href: "/codes?kind=gift_card", altAr: "رسم توضيحي لبطاقة Steam الرقمية", altEn: "Steam digital gift card illustration", type: "store" },
  { src: "/previews/al-manhaj-company-desktop.webp", ar: "حضور احترافي لنشاطك", en: "A professional presence for your business", categoryAr: "تصميم مواقع · هوية رقمية", categoryEn: "Web design · Digital identity", href: "/creation-sites", altAr: "معاينة نموذج موقع شركة المنهج", altEn: "Al Manhaj company website example", type: "web" },
];

/** Local imagery, no API/database dependency; explicit pause and reduced motion. */
export function HeroVisual({ variant = "mixed", compact = false }: { variant?: "mixed" | "web" | "store"; compact?: boolean }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const items = slides.filter((slide) => variant === "mixed" || slide.type === variant);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [visible, setVisible] = useState(true);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const current = index % items.length;
  const slide = items[current];
  const playing = !paused && !interacting && !reduced && visible && inView;
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    update();
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % items.length), 6500);
    return () => window.clearInterval(timer);
  }, [playing, items.length, current]);
  const move = (delta: number) => { setPaused(true); setIndex((value) => (value + delta + items.length) % items.length); };
  return (
    <div ref={ref} className={`hero-visual ${compact ? "is-compact" : ""}`} data-playing={playing} role="region" aria-roledescription={ar ? "عرض شرائح" : "carousel"} aria-label={ar ? "اكتشف خدماتنا ومنتجاتنا" : "Explore our services and products"} onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocusCapture={() => setInteracting(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}>
      <div className="hero-visual-stage">
        <AnimatePresence initial={false} mode="sync">
          <motion.div key={slide.src} className="hero-visual-frame" initial={{ opacity: 0, x: reduced ? 0 : 35 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : -35 }} transition={{ duration: reduced ? 0 : 0.65 }}>
            <Image src={slide.src} alt={ar ? slide.altAr : slide.altEn} fill sizes={compact ? "(max-width: 768px) 92vw, 70vw" : "(max-width: 1024px) 92vw, 52vw"} preload={variant === "mixed" && current === 0} className={`hero-visual-image ${slide.type === "web" ? "is-website" : ""}`} />
          </motion.div>
        </AnimatePresence>
        <div className="hero-visual-shade" />
        <span className="hero-visual-label"><span />{ar ? "اكتشف الإمكانيات" : "EXPLORE THE POSSIBILITIES"}</span>
        <div className="hero-visual-caption" aria-live={paused ? "polite" : "off"}>
          <p>{ar ? slide.categoryAr : slide.categoryEn}</p>
          <Link href={slide.href}>{ar ? slide.ar : slide.en}<ArrowUpRight aria-hidden="true" className="h-6 w-6 shrink-0 rtl:rotate-[-90deg]" /></Link>
          <span className="hero-visual-disclaimer">{ar ? "صور توضيحية ونماذج — التوفر في المتجر" : "Illustrations & examples · Check store availability"}</span>
        </div>
      </div>
      <div className="hero-visual-controls" dir="ltr">
        <span className="hero-visual-counter">0{current + 1}<span> / 0{items.length}</span></span>
        <div className="hero-visual-dots">
          {items.map((item, i) => <button key={item.src} onClick={() => { setPaused(true); setIndex(i); }} aria-label={`${ar ? "الشريحة" : "Slide"} ${i + 1}`} aria-pressed={i === current} className={i === current ? "is-active" : ""} />)}
        </div>
        <div className="flex gap-1">
          <button onClick={() => move(-1)} aria-label={ar ? "الشريحة السابقة" : "Previous slide"}><ChevronLeft /></button>
          <button onClick={() => setPaused((value) => !value)} aria-label={paused ? ar ? "تشغيل العرض" : "Play slideshow" : ar ? "إيقاف العرض" : "Pause slideshow"} aria-pressed={paused}>{paused || reduced ? <Play /> : <Pause />}</button>
          <button onClick={() => move(1)} aria-label={ar ? "الشريحة التالية" : "Next slide"}><ChevronRight /></button>
        </div>
      </div>
    </div>
  );
}
