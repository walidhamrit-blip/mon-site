"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Retour en haut discret : apparaît après un défilement significatif,
 * du côté opposé aux flotteurs WhatsApp / assistant. Il reste masqué
 * quand le menu mobile est ouvert (voir globals.css).
 */
export function BackToTop() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 640);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label={ar ? "العودة إلى الأعلى" : "Back to top"}
      title={ar ? "العودة إلى الأعلى" : "Back to top"}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`back-to-top fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] start-5 z-[65] grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-[var(--shadow-md)] transition-opacity duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)] print:hidden ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
