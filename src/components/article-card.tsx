"use client";

import Link from "next/link";
import { ArrowUpRight, Calendar, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatArticleDate } from "@/lib/blog";

/**
 * Carte d'article de blog (liste).
 *
 * Composant client : la date et le temps de lecture s'affichent dans la
 * langue choisie par le visiteur. Le rendu HTML initial reste complet
 * (le serveur rend la locale par défaut), donc rien n'est perdu côté SEO.
 */
export function ArticleCard({
  slug,
  categoryAr,
  categoryEn,
  titleAr,
  titleEn,
  excerptAr,
  excerptEn,
  updatedAt,
  readingMinutes,
}: {
  slug: string;
  categoryAr: string;
  categoryEn?: string;
  titleAr: string;
  titleEn: string;
  excerptAr: string;
  excerptEn: string;
  updatedAt: string;
  readingMinutes: number;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";

  return (
    <article className="card-surface card-interactive group flex flex-col p-6">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
        <span className="rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-[var(--accent)]">
          {ar ? categoryAr : categoryEn || categoryAr}
        </span>
        <span className="inline-flex items-center gap-1 text-[var(--muted-foreground)]">
          <Calendar className="h-3 w-3" />
          {formatArticleDate(updatedAt, locale)}
        </span>
        <span className="inline-flex items-center gap-1 text-[var(--muted-foreground)]">
          <Clock className="h-3 w-3" />
          {readingMinutes} {ar ? "د" : "min"}
        </span>
      </div>

      <h3 className="mt-4 text-[19px] font-black leading-snug tracking-tight">
        <Link href={`/blog/${slug}`} className="transition-colors hover:text-[var(--accent)]">
          {ar ? titleAr : titleEn}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-3 flex-1 text-[13.5px] leading-7 text-[var(--muted-foreground)]">
        {ar ? excerptAr : excerptEn}
      </p>

      <Link
        href={`/blog/${slug}`}
        className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--accent)]"
      >
        {ar ? "اقرأ الدليل" : "Read the guide"}
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
      </Link>
    </article>
  );
}
