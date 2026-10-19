"use client";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Play, Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig, useSiteContent } from "@/components/site-provider";
import { whatsappLink } from "@/lib/utils";
import { useRef } from "react";
import { HeroShowcase } from "@/components/sections/hero-showcase";

export function Hero() {
  const siteConfig = useSiteConfig();
  const { hero } = useSiteContent();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const whatsappMsg = locale === "ar"
    ? "مرحبا نخبة 👋 أريد موقع احترافي لنشاطي. سمعت عنكم من موقعكم. هل يمكننا البدء؟"
    : "Hello Nukhba 👋 I want a pro website for my business. Can we start?";

  return (
    <section ref={ref} className="relative overflow-hidden pt-[96px]">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[var(--background)]" />
        <div className="absolute inset-0 gradient-mesh" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-[var(--accent)]/10 via-transparent to-transparent blur-[80px] rounded-full pointer-events-none" />
      </div>

      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-10 lg:gap-10 xl:gap-14 items-center py-10 lg:py-16">
          {/* Left */}
          <motion.div style={{ opacity: reducedMotion ? 1 : opacity }} className="relative min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/80 backdrop-blur px-4 py-2 text-sm shadow-sm"
            >
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              {ar ? hero.badgeAr : hero.badgeEn}
              <span className="hidden sm:inline-flex items-center gap-1 ms-2 ps-2 border-s border-[var(--border)]">
                <Star className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" />
                {ar ? hero.ratingAr : hero.ratingEn}
              </span>
            </motion.div>

            <h1 className="mt-6 text-[38px] sm:text-[52px] lg:text-[62px] font-black leading-[0.95] tracking-[-0.03em] text-balance">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                className="block hero-shine"
              >
                {ar ? hero.title1Ar : hero.title1En}
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="block"
              >
                <span className="relative inline-block hero-shine">
                  {ar ? hero.title2Ar : hero.title2En}
                  <span className="absolute -bottom-2 start-0 end-0 h-[8px] bg-[var(--accent)]/30 -z-10 rounded-full hidden sm:block" />
                </span>{" "}
                <span className="hero-shine font-light italic">
                  {ar ? hero.title3Ar : hero.title3En}
                </span>
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mt-6 text-[17px] sm:text-[19px] leading-8 opacity-70 max-w-[56ch] text-balance"
            >
              {ar ? hero.subtitleAr : hero.subtitleEn}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <button
                onClick={() => document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" })}
                className="h-[52px] px-8 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] font-bold inline-flex items-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] shadow-lg cursor-pointer"
              >
                {ar ? hero.ctaPrimaryAr : hero.ctaPrimaryEn}
                <ArrowUpRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => document.getElementById("demos")?.scrollIntoView({ behavior: "smooth" })}
                className="h-[52px] px-7 rounded-full bg-[var(--card)] border border-[var(--border)] font-semibold inline-flex items-center gap-2 hover:bg-[var(--secondary)] transition-colors cursor-pointer shadow-sm"
              >
                <Play className="h-4 w-4 fill-current" />
                {ar ? hero.ctaSecondaryAr : hero.ctaSecondaryEn}
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 flex items-center gap-4 flex-wrap"
            >
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {[1, 2, 3].map((i) => (
                  <img
                    key={i}
                    src={`https://i.pravatar.cc/100?img=${10 + i}`}
                    alt=""
                    className="h-8 w-8 rounded-full border-2 border-[var(--card)] object-cover"
                  />
                ))}
                <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] grid place-items-center text-xs font-bold border-2 border-[var(--card)]">
                  +120
                </div>
              </div>
              <p className="text-sm opacity-60">{ar ? hero.trustedAr : hero.trustedEn}</p>
              <a
                href={whatsappLink(siteConfig.whatsapp, whatsappMsg)}
                target="_blank"
                className="ms-auto sm:ms-0 inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[#25D366] text-white text-sm font-semibold hover:brightness-95 transition"
              >
                <span className="h-2 w-2 bg-white rounded-full animate-pulse" />
                {ar ? "تحدث عبر واتساب" : "Chat on WhatsApp"}
              </a>
            </motion.div>

            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              {(ar ? hero.chipsAr : hero.chipsEn).map((item) => (
                <span
                  key={item}
                  className="px-3 py-1.5 rounded-full bg-[var(--secondary)] border border-[var(--border)] font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div style={{ y: reducedMotion ? 0 : y }} className="relative min-w-0">
            <HeroShowcase />
          </motion.div>
        </div>

        {/* Trust band inside hero bottom */}
        <div className="pb-8">
          <div className="rounded-[20px] bg-[var(--primary)] text-[var(--primary-foreground)] px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-6 sm:gap-10">
              {[
                { k: siteConfig.stats.sitesDelivered, l: locale === "ar" ? "موقع" : "sites" },
                { k: siteConfig.stats.delivery, l: locale === "ar" ? "تسليم" : "delivery" },
                { k: siteConfig.stats.satisfaction, l: locale === "ar" ? "رضا" : "satisfaction" },
              ].map((s) => (
                <div key={s.k} className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[var(--accent)]">{s.k}</span>
                  <span className="text-sm opacity-70">{s.l}</span>
                </div>
              ))}
            </div>
            <div className="text-xs opacity-60 hidden sm:block">
              {locale === "ar" ? "أمثلة قابلة للتخصيص — استبدل بالشعارات الحقيقية" : "Customizable examples — replace with real logos"}
            </div>
            <div className="flex items-center gap-3 text-xs font-bold tracking-widest opacity-80">
              <span>SARAYA</span> <span className="opacity-30">•</span> <span>NOOR</span> <span className="opacity-30">•</span> <span>DAR</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
