"use client";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Play, Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig, useSiteContent } from "@/components/site-provider";
import { useRef } from "react";
import { HeroShowcase } from "@/components/sections/hero-showcase";

/**
 * Hero — composition éditoriale en deux colonnes.
 *
 * Simplifié par rapport à la version précédente : l'accroche, la promesse,
 * deux boutons et UNE ligne de preuve sociale. Les éléments qui
 * concurrençaient le message (bouton WhatsApp vert, rangée de pastilles,
 * avatars importés depuis un domaine tiers) ont été retirés : le CTA
 * WhatsApp reste accessible juste en dessous, la promesse est répétée par
 * le ruban de services, et les avatars sont désormais générés localement
 * (initiales + dégradé), donc plus de requêtes externes ni d'images
 * cassées si un CDN est bloqué.
 */
export function Hero() {
  const siteConfig = useSiteConfig();
  const { hero } = useSiteContent();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  // Fondu léger du texte au défilement. La maquette, elle, reste dans le flux :
  // une translation (parallaxe) la faisait glisser sur la bande de garanties.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.35]);

  const clients = ar ? ["سارة", "محمد", "ليلى"] : ["Sara", "Mohamed", "Layla"];
  const avatars = [
    { initials: ar ? "س" : "S", tone: "from-[#C6A664] to-[#8C7138]" },
    { initials: ar ? "م" : "M", tone: "from-[#4F6D7A] to-[#243943]" },
    { initials: ar ? "ل" : "L", tone: "from-[#8C6A7A] to-[#4A3441]" },
  ];

  return (
    <section ref={ref} className="relative overflow-hidden">
      {/* Décor : halo + trame discrète, entièrement dérivés du thème actif. */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 gradient-mesh" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in srgb, var(--foreground) 6%, transparent) 1px, transparent 1px)",
            backgroundSize: "72px 100%",
            maskImage: "radial-gradient(70% 60% at 50% 0%, black, transparent)",
            WebkitMaskImage: "radial-gradient(70% 60% at 50% 0%, black, transparent)",
          }}
        />
      </div>

      <div className="site-container px-4 pb-10 pt-[calc(var(--header-h)+2rem)] sm:px-6 lg:px-8 lg:pb-14 lg:pt-[calc(var(--header-h)+3rem)]">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-12 xl:gap-16">
          {/* ── Colonne texte ─────────────────────────────────────────── */}
          <motion.div style={{ opacity: reducedMotion ? 1 : opacity }} className="relative min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="inline-flex flex-wrap items-center gap-2.5 rounded-full border border-[var(--border)] bg-[var(--card)]/80 px-3 py-1.5 text-[12.5px] font-semibold shadow-[var(--shadow-xs)] backdrop-blur"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[var(--muted-foreground)]">{ar ? hero.badgeAr : hero.badgeEn}</span>
              <span className="hidden h-3.5 w-px bg-[var(--border)] sm:block" />
              <span className="hidden items-center gap-1 sm:inline-flex">
                <Star className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" />
                {ar ? hero.ratingAr : hero.ratingEn}
              </span>
            </motion.div>

            <h1 className="mt-6 text-[clamp(2.35rem,1.6rem+3.1vw,4rem)] font-black leading-[0.98] tracking-[-0.035em] text-balance">
              <motion.span
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="block hero-shine"
              >
                {ar ? hero.title1Ar : hero.title1En}
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="block"
              >
                <span className="relative inline-block">
                  {ar ? hero.title2Ar : hero.title2En}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-[0.08em] -z-10 h-[0.28em] rounded-full bg-[var(--accent)]/25"
                  />
                </span>{" "}
                <span className="font-light italic text-[var(--muted-foreground)]">
                  {ar ? hero.title3Ar : hero.title3En}
                </span>
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24, duration: 0.55 }}
              className="mt-6 max-w-[54ch] text-[clamp(1rem,0.95rem+0.25vw,1.12rem)] leading-[1.9] text-[var(--muted-foreground)] text-pretty"
            >
              {ar ? hero.subtitleAr : hero.subtitleEn}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.55 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <button
                onClick={() => document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" })}
                className="group inline-flex h-[52px] items-center gap-2 rounded-full bg-[var(--primary)] px-7 text-[15px] font-bold text-[var(--primary-foreground)] shadow-[var(--shadow-md)] transition-all hover:opacity-92 active:scale-[0.985] cursor-pointer"
              >
                {ar ? hero.ctaPrimaryAr : hero.ctaPrimaryEn}
                <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </button>
              <button
                onClick={() => document.getElementById("demos")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex h-[52px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/80 px-6 text-[15px] font-semibold backdrop-blur transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--card)] cursor-pointer"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                  <Play className="h-3 w-3 fill-current" />
                </span>
                {ar ? hero.ctaSecondaryAr : hero.ctaSecondaryEn}
              </button>
            </motion.div>

            {/* Preuve sociale : une seule ligne, alignée sur les CTA. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.6 }}
              className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3"
            >
              <div className="flex -space-x-2.5 rtl:space-x-reverse">
                {avatars.map((avatar) => (
                  <span
                    key={avatar.initials}
                    aria-hidden="true"
                    className={`grid h-9 w-9 place-items-center rounded-full border-2 border-[var(--background)] bg-gradient-to-br ${avatar.tone} text-[11px] font-black text-white shadow-sm`}
                  >
                    {avatar.initials}
                  </span>
                ))}
                <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-[var(--background)] bg-[var(--accent)] text-[10px] font-black text-[var(--accent-foreground)]">
                  +120
                </span>
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1 text-[var(--accent)]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                  <span className="ms-1 text-[12px] font-bold text-[var(--foreground)]" dir="ltr">
                    4.9/5
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-[var(--muted-foreground)]">
                  {ar ? hero.trustedAr : hero.trustedEn}
                </p>
              </div>
              <span className="hidden text-[12.5px] text-[var(--muted-foreground)] sm:block">
                · {clients.join(" · ")}
              </span>
            </motion.div>
          </motion.div>

          {/* ── Colonne maquettes ────────────────────────────────────── */}
          <div className="relative min-w-0">
            <HeroShowcase />
          </div>
        </div>
      </div>

      {/* ── Bande de garanties (remplace l'ancien bandeau « logos ») ── */}
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
          {[
            {
              value: siteConfig.stats.sitesDelivered,
              label: ar ? "موقع منجز" : "websites delivered",
            },
            {
              value: siteConfig.stats.delivery,
              label: ar ? "متوسط التسليم" : "average delivery",
            },
            {
              value: siteConfig.stats.satisfaction,
              label: ar ? "رضا العملاء" : "client satisfaction",
            },
          ].map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-2.5 bg-[var(--card)] px-6 py-5">
              <span className="text-[26px] font-black leading-none tracking-tight text-[var(--accent)]">
                {stat.value}
              </span>
              <span className="text-[12.5px] text-[var(--muted-foreground)]">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 py-5 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--muted-foreground)]/70">
          <span>{ar ? "يثق بنا" : "Trusted by"}</span>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
            <span>SARAYA</span>
            <span className="opacity-40">•</span>
            <span>NOOR</span>
            <span className="opacity-40">•</span>
            <span>DAR</span>
            <span className="opacity-40">•</span>
            <span>AL-MANHAJ</span>
          </div>
        </div>
      </div>
    </section>
  );
}
