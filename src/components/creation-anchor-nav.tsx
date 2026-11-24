"use client";

import { LocalizedLink as Link } from "@/components/localized-link";
import { useI18n } from "@/lib/i18n";

const STEPS = [
  { href: "#website-guide", ar: "١. دليل الاختيار", en: "1. Choice guide" },
  { href: "#pricing", ar: "٢. العروض", en: "2. Offers" },
  { href: "#demos", ar: "٣. النماذج", en: "3. Examples" },
  { href: "#website-process", ar: "٤. الخطوات", en: "4. Process" },
  { href: "#lead-form", ar: "٥. طلب عرض", en: "5. Get a quote" },
] as const;

/**
 * Nav d'ancres collante sous le header public : le visiteur garde un
 * repère stable pendant les ~13 écrans de la page création de site.
 */
export function CreationAnchorNav() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <nav
      aria-label={ar ? "خطوات مشروعك" : "Your project journey"}
      className="creation-anchor-nav sticky top-[var(--public-header-height,4.25rem)] z-40 border-y border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-md"
    >
      <div className="site-container scroll-x flex gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        {STEPS.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-[13px] font-bold transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {ar ? step.ar : step.en}
          </Link>
        ))}
      </div>
    </nav>
  );
}
