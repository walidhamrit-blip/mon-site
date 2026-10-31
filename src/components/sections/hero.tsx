"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles, Code2, Gift, Gamepad2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { HeroVisual } from "@/components/hero-visual";

export function Hero() {
  const config = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const reduced = useReducedMotion();
  return (
    <section className="home-intro">
      <div className="site-container home-intro-layout px-4 sm:px-6 lg:px-8">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className="home-intro-copy">
          <p className="hero-eyebrow"><Sparkles className="h-4 w-4" />{config.name} · {ar ? "خدمات ومنتجات رقمية" : "YOUR DIGITAL POSSIBILITIES"}</p>
          <h1>{ar ? "مواقع. ألعاب. بطاقات." : "Websites. Games. Gift cards."}<br /><span className="hero-accent-text">{ar ? "عالم من الإمكانيات." : "A world of possibilities."}</span></h1>
          <p className="hero-description">{ar ? "موقع يُبرز نشاطك، أو بطاقة تفتح لك عالماً جديداً. إنشاء مواقع، بطاقات هدايا، مفاتيح ألعاب وشحن — اختر ما يناسبك." : "A website that brings your business to life. A card that unlocks a new world. Websites, gift cards, game keys and top-ups — find your next move."}</p>
          <div className="hero-actions">
            <Link href="/codes" className="vivid-button">{ar ? "اكتشف المتجر" : "Explore the store"}<ArrowUpRight className="h-4 w-4 rtl:rotate-[-90deg]" /></Link>
            <Link href="/creation-sites" className="vivid-button is-secondary">{ar ? "لننشئ موقعك" : "Let’s build your website"}<Code2 className="h-4 w-4" /></Link>
          </div>
          <div className="hero-topics">
            {[[Code2, ar ? "إنشاء مواقع" : "Web creation"], [Gift, ar ? "بطاقات رقمية" : "Digital cards"], [Gamepad2, ar ? "ألعاب وشحن" : "Games & top-ups"]].map(([Icon, label], i) => { const TopicIcon = Icon as typeof Code2; return <motion.span key={i} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}><TopicIcon className="h-4 w-4" />{label as string}</motion.span>; })}
          </div>
        </motion.div>
        <HeroVisual />
      </div>
    </section>
  );
}
