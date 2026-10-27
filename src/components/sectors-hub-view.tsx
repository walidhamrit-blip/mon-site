"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { fillTemplate } from "@/lib/text-template";
import type { SectorSeo } from "@/lib/sectors";

/**
 * Hub des secteurs (/sectors) — composant client : la page suit la langue
 * du site (bouton AR/EN) comme les autres pages dynamiques.
 */
export function SectorsHubView({
  sectors,
  demoCounts,
}: {
  sectors: ReadonlyArray<SectorSeo>;
  demoCounts: Record<string, number>;
}) {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const s = t.sectors;
  const pick = <T,>(arValue: T, enValue: T): T => (ar ? arValue : enValue);

  return (
    <div className="pt-6" dir={ar ? "rtl" : "ltr"}>
      <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h1 className="text-[36px] lg:text-[44px] font-black tracking-tight leading-none">
            {pick(s.heroTitleAr, s.heroTitleEn)}
          </h1>
          <p className="mt-3 opacity-60 max-w-[60ch]">
            {pick(s.heroTextAr, s.heroTextEn)}
          </p>
        </div>
      </section>

      <section className="py-10">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sectors.map((sector) => {
              const count = demoCounts[sector.id] ?? 0;
              return (
                <Link
                  key={sector.id}
                  href={`/sectors/${sector.id}`}
                  className="group rounded-[22px] overflow-hidden bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/50 hover:shadow-lg transition-all p-6 flex flex-col"
                >
                  <div className="text-xs font-bold tracking-widest text-[var(--accent)] uppercase">
                    {pick(sector.labelAr, sector.labelEn)}
                  </div>
                  {ar && (
                    <div
                      className="mt-1 text-[11px] font-semibold normal-case tracking-normal opacity-55"
                      dir="ltr"
                    >
                      {sector.labelEn}
                    </div>
                  )}
                  <h2 className="mt-2 text-[18px] font-black leading-tight group-hover:text-[var(--accent)] transition-colors">
                    {pick(sector.h1Ar, sector.h1En)}
                  </h2>
                  <p className="mt-2 text-sm opacity-60 line-clamp-3">
                    {pick(sector.descriptionAr, sector.descriptionEn)}
                  </p>
                  {ar && (
                    <p className="mt-1 text-xs opacity-45 line-clamp-2" dir="ltr">
                      {sector.descriptionEn}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[var(--secondary)] border border-[var(--border)]">
                      {count === 1
                        ? pick(s.projectsOneAr, s.projectsOneEn)
                        : fillTemplate(pick(s.projectsAr, s.projectsEn), { count })}
                    </span>
                    <span className="text-sm font-bold text-[var(--accent)] group-hover:underline">
                      {pick(s.discoverAr, s.discoverEn)}
                      <span aria-hidden="true" className="ms-1">
                        {ar ? "←" : "→"}
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
