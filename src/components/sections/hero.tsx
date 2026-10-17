"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, Play, Sparkles, Star, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { whatsappLink } from "@/lib/utils";
import { useRef } from "react";

export function Hero() {
  const siteConfig = useSiteConfig();
  const { locale, t, dir } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
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

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-6 items-center py-10 lg:py-16">
          {/* Left */}
          <motion.div style={{ opacity }} className="relative">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/80 backdrop-blur px-4 py-2 text-sm shadow-sm"
            >
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              {t.hero.badge}
              <span className="hidden sm:inline-flex items-center gap-1 ms-2 ps-2 border-s border-[var(--border)]">
                <Star className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" />
                {t.hero.rating}
              </span>
            </motion.div>

            <h1 className="mt-6 text-[38px] sm:text-[52px] lg:text-[62px] font-black leading-[0.95] tracking-[-0.03em] text-balance">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                className="block"
              >
                {t.hero.title1}
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="block"
              >
                <span className="relative inline-block">
                  {t.hero.title2}
                  <span className="absolute -bottom-2 start-0 end-0 h-[8px] bg-[var(--accent)]/30 -z-10 rounded-full hidden sm:block" />
                </span>{" "}
                <span className="font-light italic opacity-80">{t.hero.title3}</span>
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mt-6 text-[17px] sm:text-[19px] leading-8 opacity-70 max-w-[56ch] text-balance"
            >
              {t.hero.subtitle}
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
                {t.hero.ctaPrimary}
                <ArrowUpRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => document.getElementById("demos")?.scrollIntoView({ behavior: "smooth" })}
                className="h-[52px] px-7 rounded-full bg-[var(--card)] border border-[var(--border)] font-semibold inline-flex items-center gap-2 hover:bg-[var(--secondary)] transition-colors cursor-pointer shadow-sm"
              >
                <Play className="h-4 w-4 fill-current" />
                {t.hero.ctaSecondary}
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
              <p className="text-sm opacity-60">{t.hero.trusted}</p>
              <a
                href={whatsappLink(siteConfig.whatsapp, whatsappMsg)}
                target="_blank"
                className="ms-auto sm:ms-0 inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[#25D366] text-white text-sm font-semibold hover:brightness-95 transition"
              >
                <span className="h-2 w-2 bg-white rounded-full animate-pulse" />
                {locale === "ar" ? "تحدث عبر واتساب" : "Chat on WhatsApp"}
              </a>
            </motion.div>

            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              {[
                locale === "ar" ? "✓ تسليم 7 أيام" : "✓ 7-day delivery",
                locale === "ar" ? "✓ بدون دفعة كبيرة" : "✓ No big upfront",
                locale === "ar" ? "✓ دعم واتساب" : "✓ WhatsApp support",
              ].map((item) => (
                <span
                  key={item}
                  className="px-3 py-1.5 rounded-full bg-[var(--secondary)] border border-[var(--border)] font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right — Device mockups */}
          <motion.div style={{ y }} className="relative lg:h-[560px] flex items-center justify-center">
            {/* Glow */}
            <div className="absolute inset-0 -z-10 flex items-center justify-center">
              <div className="w-[420px] h-[420px] rounded-full bg-[var(--accent)]/15 blur-[60px]" />
            </div>

            {/* Desktop mockup */}
            <motion.div
              initial={{ opacity: 0, y: 30, rotate: -2 }}
              animate={{ opacity: 1, y: 0, rotate: -1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative w-full max-w-[520px] hidden sm:block"
            >
              <div className="rounded-[20px] bg-[var(--card)] border border-[var(--border)] shadow-[0_24px_64px_rgba(0,0,0,0.12)] overflow-hidden">
                <div className="h-9 flex items-center gap-1.5 px-4 border-b border-[var(--border)] bg-[var(--secondary)]/50">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400" />
                  <span className="h-3 w-3 rounded-full bg-green-400" />
                  <div className="ms-3 flex-1 max-w-[320px] h-6 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center px-3 text-xs opacity-60">
                    <span className="truncate">nukhba.ly — {locale === "ar" ? "معاينة حية" : "Live preview"}</span>
                  </div>
                </div>
                <div className="relative aspect-[16/10] overflow-hidden bg-white">
                  <img
                    src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80&auto=format&fit=crop"
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-5 text-white">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-semibold">
                      <Sparkles className="h-3 w-3" />
                      {locale === "ar" ? "تصميم فاخر • سريع • متجاوب" : "Luxury • Fast • Responsive"}
                    </div>
                    <h3 className="mt-2 text-xl font-black">{locale === "ar" ? "مطعم الديوان — طرابلس" : "Al-Diwan — Tripoli"}</h3>
                    <p className="text-sm opacity-80">{locale === "ar" ? "قائمة • حجز • طلب واتساب" : "Menu • Booking • WhatsApp order"}</p>
                  </div>
                </div>
              </div>

              {/* Floating card */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-6 -start-6 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xl p-4 flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-full bg-green-500 grid place-items-center text-white">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold">{locale === "ar" ? "تم الحجز بنجاح ✓" : "Booking confirmed ✓"}</div>
                  <div className="text-xs opacity-60">{locale === "ar" ? "طاولة لشخصين — 8 مساءً" : "Table for 2 — 8 PM"}</div>
                </div>
              </motion.div>
            </motion.div>

            {/* Phone mockup */}
            <motion.div
              initial={{ opacity: 0, y: 30, rotate: 3 }}
              animate={{ opacity: 1, y: 0, rotate: 2 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="absolute -end-2 bottom-6 sm:bottom-0 sm:end-2 w-[150px] sm:w-[180px] hidden sm:block"
            >
              <div className="rounded-[28px] bg-black p-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                <div className="rounded-[22px] overflow-hidden bg-white relative aspect-[9/19]">
                  <img
                    src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80&auto=format&fit=crop"
                    alt="Mobile"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-white">
                    <div className="text-xs font-bold">{locale === "ar" ? "اطلب الآن" : "Order now"}</div>
                    <div className="mt-1 h-7 rounded-full bg-[var(--accent)] grid place-items-center text-xs font-bold text-black">
                      {locale === "ar" ? "واتساب" : "WhatsApp"}
                    </div>
                  </div>
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-12 bg-black rounded-full" />
                </div>
              </div>
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                className="absolute -start-10 top-10 bg-[var(--card)] rounded-full shadow-lg px-3 py-2 flex items-center gap-2 border border-[var(--border)]"
              >
                <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold">{locale === "ar" ? "متصل" : "Online"}</span>
              </motion.div>
            </motion.div>

            {/* Mobile fallback */}
            <div className="sm:hidden w-full max-w-[360px] rounded-[20px] bg-[var(--card)] border border-[var(--border)] shadow-xl overflow-hidden">
              <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80&auto=format&fit=crop" alt="" className="w-full aspect-[4/3] object-cover" />
              <div className="p-4">
                <div className="text-sm font-bold">{locale === "ar" ? "تصميم يبيع — جاهز للهاتف أولاً" : "Design that sells — mobile first"}</div>
                <div className="text-xs opacity-60 mt-1">{locale === "ar" ? "سريع، أنيق، ومحسّن لجوجل" : "Fast, elegant, Google-optimized"}</div>
              </div>
            </div>
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
