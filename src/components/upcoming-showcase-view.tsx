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
    <div className="pt-6">
      {/* Hero éditorial dans la même esthétique Nukhba */}
      <section className="section-tight relative overflow-hidden border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 start-1/2 -translate-x-1/2 h-72 w-[620px] rounded-full blur-3xl opacity-20"
          style={{ background: "var(--accent)" }}
        />

        <div className="site-container px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-[56rem]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-1.5 text-xs font-black shadow-sm sm:text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
              <span className="text-[var(--accent)]">
                {ar ? page.statusBadgeAr : page.statusBadgeEn}
              </span>
            </div>

            <h1 className="mt-4 max-w-[22ch] text-[clamp(1.9rem,1.2rem+2.6vw,3.1rem)] font-black leading-[1.06] tracking-[-0.03em] text-balance">
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

            <p className="mt-4 max-w-[62ch] text-[15.5px] leading-8 text-[var(--muted-foreground)]">
              {ar ? page.subtitleAr : page.subtitleEn}
            </p>
          </div>

          {/* Barre utilitaire : recherche, compteur et rappel du CTA sur la
              même ligne. En colonne à droite, elle creusait un grand vide
              sous le titre. */}
          <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="relative w-full lg:max-w-[320px]">
              <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-40" />
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
                className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--card)] pe-4 ps-10 text-[13.5px] outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex items-center gap-2 text-[11.5px] text-[var(--muted-foreground)] lg:order-last">
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

            {(ar ? page.bannerNoteAr : page.bannerNoteEn) && (
              <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)]/90 p-3 shadow-[var(--shadow-xs)] sm:flex-row sm:items-center sm:justify-between lg:ms-auto lg:max-w-[540px] lg:p-2.5 lg:ps-4">
                <div className="flex items-start gap-2.5 text-[12.5px] leading-6">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[var(--muted-foreground)]">
                    {ar ? page.bannerNoteAr : page.bannerNoteEn}
                  </span>
                </div>
                <a
                  href={whatsappLink(siteConfig.whatsapp, headerWhatsappMsg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-[12px] font-black text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-hover)]"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  {ar ? page.ctaLabelAr : page.ctaLabelEn}
                </a>
              </div>
            )}
          </div>

          {categories.length > 1 && (
            <div className="scroll-x mt-7 flex gap-2 pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`chip shrink-0 cursor-pointer transition-colors ${
                  selectedCategory === "all"
                    ? "!border-[var(--primary)] !bg-[var(--primary)] !text-[var(--primary-foreground)]"
                    : "hover:border-[var(--accent)]"
                }`}
              >
                {ar ? "الكل" : "All"}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`chip shrink-0 cursor-pointer transition-colors ${
                    selectedCategory === cat.id
                      ? "!border-[var(--primary)] !bg-[var(--primary)] !text-[var(--primary-foreground)]"
                      : "hover:border-[var(--accent)]"
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
      <section className="section">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          {filteredItems.length === 0 ? (
            <div className="card-surface p-12 text-center">
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
            <div className="grid gap-6 md:grid-cols-2 lg:gap-7">
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
                    className="card-surface card-interactive group flex flex-col justify-between overflow-hidden"
                  >
                    <div>
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <ShowcaseImage
                          src={item.image}
                          alt={ar ? item.titleAr : item.titleEn}
                          title={ar ? item.titleAr : item.titleEn}
                          color={item.color}
                          priority={idx < 2}
                        />

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

                      <div className="p-6 sm:p-7">
                        <h2 className="text-[19px] font-black leading-snug tracking-[-0.02em] sm:text-[21px]">
                          {ar ? item.titleAr : item.titleEn}
                        </h2>
                        <p className="mt-2.5 text-[13.5px] leading-7 text-[var(--muted-foreground)]">
                          {ar ? item.descriptionAr : item.descriptionEn}
                        </p>

                        {typeof item.progress === "number" && item.progress > 0 && (
                          <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--secondary)]/60 p-3">
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


/**
 * Visuel d'une application / produit à venir.
 *
 * Les photos viennent d'un hébergeur externe (Unsplash) : si l'image échoue
 * (hébergeur en panne, réseau filtré, visuel supprimé côté admin), la carte
 * affichait un rectangle gris vide. On affiche alors un aplat teinté avec
 * l'initiale et le nom du produit, lisible et cohérent avec le reste du site.
 */
function ShowcaseImage({
  src,
  alt,
  title,
  color,
  priority,
}: {
  src: string;
  alt: string;
  title: string;
  color?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className="absolute inset-0 grid place-items-center"
        style={{
          background: `radial-gradient(115% 90% at 80% 0%, color-mix(in srgb, ${color || "var(--accent)"} 30%, transparent) 0%, transparent 62%), linear-gradient(160deg, var(--card) 0%, var(--secondary) 100%)`,
        }}
      >
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <span
            className="grid h-11 w-11 place-items-center rounded-2xl text-lg font-black text-white shadow-[var(--shadow-sm)]"
            style={{ backgroundColor: color || "var(--accent)" }}
            aria-hidden="true"
          >
            {title.trim().charAt(0)}
          </span>
          <span className="line-clamp-2 max-w-[24ch] text-[12.5px] font-bold text-[var(--foreground)]/80">
            {title}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        onError={() => setFailed(true)}
      />
      {/* Voile de lisibilité, uniquement sur une vraie photo : sur le visuel
          de repli, il assombrissait inutilement le bas de la carte. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
    </>
  );
}
