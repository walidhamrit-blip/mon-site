"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BellRing,
  Check,
  Clock,
  ExternalLink,
  Layers,
  Search,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useSiteConfig, useSiteContent } from "@/components/site-provider";
import { useI18n } from "@/lib/i18n";
import { whatsappLink } from "@/lib/utils";
import type { LaunchStatus, UpcomingCatalogItem } from "@/lib/site-types";

function isExternalUrl(url?: string): boolean {
  return Boolean(url && url !== "#" && /^https?:\/\//i.test(url.trim()));
}

function statusPillClasses(status: LaunchStatus): string {
  switch (status) {
    case "available":
      return "bg-emerald-500 text-white";
    case "in_preparation":
      return "bg-amber-500 text-zinc-950";
    case "coming_soon":
    default:
      return "bg-[var(--accent)] text-[var(--accent-foreground)]";
  }
}

function defaultStatusLabel(status: LaunchStatus, ar: boolean): string {
  if (status === "available") return ar ? "متاح الآن" : "Available Now";
  if (status === "in_preparation") return ar ? "قيد التحضير" : "In Preparation";
  return ar ? "قريباً" : "Coming Soon";
}

export function UpcomingShowcaseView({
  kind,
}: {
  kind: "apps" | "products";
}) {
  const siteConfig = useSiteConfig();
  const content = useSiteContent();
  const { locale } = useI18n();
  const ar = locale === "ar";

  const page = kind === "apps" ? content.appsPage : content.productsPage;
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    const map = new Map<string, { id: string; ar: string; en: string }>();
    for (const item of page.items) {
      const key = (item.categoryEn || item.categoryAr || "general").toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          ar: item.categoryAr || item.categoryEn,
          en: item.categoryEn || item.categoryAr,
        });
      }
    }
    return Array.from(map.values());
  }, [page.items]);

  const filteredItems = useMemo(() => {
    return page.items.filter((item) => {
      const catKey = (item.categoryEn || item.categoryAr || "general").toLowerCase().trim();
      const matchesCat = selectedCategory === "all" || catKey === selectedCategory;
      const hay = `${item.titleAr} ${item.titleEn} ${item.descriptionAr} ${item.descriptionEn} ${item.categoryAr} ${item.categoryEn}`.toLowerCase();
      const matchesQ = !query.trim() || hay.includes(query.trim().toLowerCase());
      return matchesCat && matchesQ;
    });
  }, [page.items, query, selectedCategory]);

  const headerWhatsappMsg = ar
    ? kind === "apps"
      ? "مرحبا نخبة 👋 أرغب في الانضمام لقائمة الإطلاق المبكر لتطبيقات نخبة الجديدة."
      : "مرحبا نخبة 👋 أرغب في الانضمام لقائمة الإطلاق المبكر للمنتجات الرقمية والبرامج."
    : kind === "apps"
      ? "Hello Nukhba 👋 I would like early launch notifications for your upcoming applications."
      : "Hello Nukhba 👋 I would like early launch notifications for your digital products & software.";

  const itemWhatsappMsg = (item: UpcomingCatalogItem) =>
    ar
      ? `مرحبا نخبة 👋 أودّ استلام إشعار فور إطلاق «${item.titleAr}» ومعرفة تفاصيل الحجز المبكر.`
      : `Hello Nukhba 👋 Please notify me as soon as "${item.titleEn}" launches and share early-access details.`;

  return (
    <div className="pt-[96px]">
      {/* Hero éditorial dans la même esthétique Nukhba */}
      <section className="relative overflow-hidden py-12 lg:py-16 bg-[var(--secondary)]/35 border-b border-[var(--border)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 start-1/2 -translate-x-1/2 h-72 w-[620px] rounded-full blur-3xl opacity-20"
          style={{ background: "var(--accent)" }}
        />

        <div className="site-container px-4 sm:px-6 lg:px-8 relative">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-xs sm:text-sm font-black shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
                <span className="text-[var(--accent)]">
                  {ar ? page.statusBadgeAr : page.statusBadgeEn}
                </span>
              </div>

              <h1 className="mt-4 text-[34px] sm:text-[44px] lg:text-[52px] font-black tracking-tight leading-[1.08]">
                {ar ? page.titleAr : page.titleEn}
                {(ar ? page.highlightAr : page.highlightEn) && (
                  <>
                    {" "}
                    <span className="text-[var(--accent)]">
                      — {ar ? page.highlightAr : page.highlightEn}
                    </span>
                  </>
                )}
              </h1>

              <p className="mt-4 text-base sm:text-lg opacity-70 max-w-[60ch] leading-relaxed">
                {ar ? page.subtitleAr : page.subtitleEn}
              </p>

              {(ar ? page.bannerNoteAr : page.bannerNoteEn) && (
                <div className="mt-6 rounded-2xl bg-[var(--card)]/90 border border-[var(--border)] px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3 text-sm">
                    <span className="h-8 w-8 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] grid place-items-center shrink-0 mt-0.5 sm:mt-0">
                      <Clock className="h-4 w-4" />
                    </span>
                    <span className="opacity-85 leading-snug">
                      {ar ? page.bannerNoteAr : page.bannerNoteEn}
                    </span>
                  </div>
                  <a
                    href={whatsappLink(siteConfig.whatsapp, headerWhatsappMsg)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-5 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs sm:text-sm font-black inline-flex items-center justify-center gap-1.5 hover:bg-[var(--accent-hover)] transition-colors shrink-0 shadow-sm"
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    {ar ? page.ctaLabelAr : page.ctaLabelEn}
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:items-end gap-3 shrink-0">
              <div className="relative w-full sm:w-[270px]">
                <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    ar
                      ? kind === "apps"
                        ? "ابحث في التطبيقات القادمة..."
                        : "ابحث في البرامج والمنتجات..."
                      : kind === "apps"
                        ? "Search upcoming apps..."
                        : "Search digital products..."
                  }
                  className="h-10 ps-10 pe-4 rounded-full border border-[var(--border)] bg-[var(--card)] text-sm w-full outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div className="flex items-center gap-2 text-xs opacity-65">
                {kind === "apps" ? (
                  <Smartphone className="h-3.5 w-3.5 text-[var(--accent)]" />
                ) : (
                  <Layers className="h-3.5 w-3.5 text-[var(--accent)]" />
                )}
                <span>
                  {ar
                    ? `${page.items.length} ${kind === "apps" ? "تطبيقات قيد التحضير" : "منتجات وبرامج قادمة"}`
                    : `${page.items.length} ${kind === "apps" ? "upcoming apps" : "upcoming software products"}`}
                </span>
              </div>
            </div>
          </div>

          {categories.length > 1 && (
            <div className="mt-7 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                  selectedCategory === "all"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                    : "bg-[var(--card)] border-[var(--border)] hover:bg-[var(--secondary)]"
                }`}
              >
                {ar ? "الكل" : "All"}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                    selectedCategory === cat.id
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                      : "bg-[var(--card)] border-[var(--border)] hover:bg-[var(--secondary)]"
                  }`}
                >
                  {ar ? cat.ar : cat.en}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Grille des applications / produits numériques */}
      <section className="py-12 lg:py-16">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          {filteredItems.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-12 text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] grid place-items-center">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-black">
                {ar
                  ? "الإصدارات الجديدة قيد التحضير حالياً"
                  : "New releases are currently in preparation"}
              </h2>
              <p className="mt-2 text-sm opacity-65 max-w-md mx-auto">
                {ar
                  ? "تواصل معنا عبر واتساب لاستلام إشعار الإطلاق أو لطلب تطوير تطبيق أو برنامج خاص بمشروعك."
                  : "Message us on WhatsApp to be notified at launch or request a bespoke application for your business."}
              </p>
              <a
                href={whatsappLink(siteConfig.whatsapp, headerWhatsappMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-black inline-flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-colors"
              >
                <BellRing className="h-4 w-4" />
                {ar ? page.ctaLabelAr : page.ctaLabelEn}
              </a>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
              {filteredItems.map((item, idx) => {
                const badgeText = ar
                  ? item.badgeAr || defaultStatusLabel(item.status, true)
                  : item.badgeEn || defaultStatusLabel(item.status, false);
                const features = ar ? item.featuresAr : item.featuresEn;
                const hasDemoLink = isExternalUrl(item.demoUrl);

                return (
                  <motion.article
                    key={item.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.35, delay: Math.min(idx * 0.06, 0.24) }}
                    className="group rounded-[24px] overflow-hidden bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/50 hover:shadow-xl transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <Image
                          src={item.image}
                          alt={ar ? item.titleAr : item.titleEn}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          loading={idx < 2 ? "eager" : "lazy"}
                          decoding="async"
                          className="object-cover group-hover:scale-[1.04] transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                        <div className="absolute top-3.5 start-3.5 end-3.5 flex items-center justify-between gap-2">
                          <span className="px-3 py-1 rounded-full bg-white/95 text-zinc-900 text-xs font-bold shadow">
                            {ar ? item.categoryAr : item.categoryEn}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-black inline-flex items-center gap-1.5 shadow ${statusPillClasses(item.status)}`}
                          >
                            <span className="h-2 w-2 rounded-full bg-current opacity-80 animate-pulse" />
                            {badgeText}
                          </span>
                        </div>

                        {item.platforms.length > 0 && (
                          <div
                            dir="ltr"
                            className="absolute bottom-3.5 start-3.5 end-3.5 flex flex-wrap items-center gap-1.5"
                          >
                            {item.platforms.map((platform) => (
                              <span
                                key={platform}
                                className="px-2.5 py-1 rounded-full bg-black/65 backdrop-blur text-white text-[11px] font-semibold border border-white/15"
                              >
                                {platform}
                              </span>
                            ))}
                            {typeof item.priceHintUsd === "number" && item.priceHintUsd > 0 && (
                              <span className="ms-auto px-3 py-1 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-black">
                                {ar ? `ابتداءً من $${item.priceHintUsd}` : `From $${item.priceHintUsd}`}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="p-6">
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
                          {ar ? item.titleAr : item.titleEn}
                        </h2>
                        <p className="mt-2.5 text-sm sm:text-[15px] opacity-70 leading-relaxed">
                          {ar ? item.descriptionAr : item.descriptionEn}
                        </p>

                        {typeof item.progress === "number" && item.progress > 0 && (
                          <div className="mt-4 rounded-xl bg-[var(--secondary)]/70 border border-[var(--border)] p-3">
                            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                              <span className="opacity-75">
                                {ar ? "مرحلة الإعداد والاختبار" : "Development & QA readiness"}
                              </span>
                              <span className="text-[var(--accent)]" dir="ltr">
                                {item.progress}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, Math.max(5, item.progress))}%`,
                                  backgroundColor: item.color || "var(--accent)",
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {features.length > 0 && (
                          <ul className="mt-4 grid sm:grid-cols-2 gap-2">
                            {features.map((feat) => (
                              <li
                                key={feat}
                                className="flex items-center gap-2 text-xs sm:text-sm font-medium"
                              >
                                <span className="h-5 w-5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] grid place-items-center shrink-0">
                                  <Check className="h-3 w-3" />
                                </span>
                                <span className="opacity-85">{feat}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="px-6 pb-6 pt-3 border-t border-[var(--border)]/60 flex flex-wrap items-center gap-2.5">
                      <a
                        href={whatsappLink(siteConfig.whatsapp, itemWhatsappMsg(item))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 h-10 px-4 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                      >
                        <BellRing className="h-3.5 w-3.5" />
                        {ar ? page.ctaLabelAr : page.ctaLabelEn}
                      </a>
                      {hasDemoLink && (
                        <a
                          href={item.demoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-10 px-4 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-xs sm:text-sm font-black inline-flex items-center justify-center gap-1.5 hover:bg-[var(--accent-hover)] transition-colors"
                        >
                          {ar ? "معاينة تجريبية" : "Live Preview"}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}

          {/* Bandeau projet sur mesure */}
          <div className="mt-14 rounded-[26px] border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-black tracking-wider uppercase text-[var(--accent)]">
                <Sparkles className="h-3.5 w-3.5" />
                {ar ? "تطوير مخصّص حسب الطلب" : "BESPOKE DEVELOPMENT"}
              </div>
              <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
                {ar
                  ? kind === "apps"
                    ? "هل تريد تطبيقاً خاصاً يحمل اسم وهوية نشاطك الآن؟"
                    : "هل تحتاج برنامجاً إدارياً أو منتجاً رقمياً مفصّلاً على عملك؟"
                  : kind === "apps"
                    ? "Need a custom branded mobile or web app right now?"
                    : "Need bespoke software or a custom digital platform today?"}
              </h2>
              <p className="mt-2 text-sm sm:text-base opacity-65 max-w-[58ch]">
                {ar
                  ? "فريق نخبة يصمّم ويبرمج تطبيقك أو نظامك السحابي من الصفر على مقاس عملياتك — تواصل معنا لجلسة استشارية مجانية."
                  : "Our engineering team designs and builds custom applications & software around your exact workflow — book a free discovery session."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href="/demos"
                className="h-11 px-5 rounded-full border border-[var(--border)] bg-[var(--secondary)] text-sm font-bold inline-flex items-center gap-1.5 hover:border-[var(--accent)] transition-colors"
              >
                {ar ? "شاهد مواقعنا الحية" : "Explore live sites"}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-black inline-flex items-center gap-1.5 hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
              >
                {ar ? "اطلب استشارة مجانية" : "Request free quote"}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
