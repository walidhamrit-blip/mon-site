"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export interface BadgeSnippetTab {
  id: string;
  label: string;
  language: string;
  code: string;
}

/**
 * Onglets d'extraits copiables pour la page `/badge`.
 *
 * Le code est généré côté serveur (`src/lib/badge.ts`) et passé en props : le
 * client ne fait que l'afficher et le copier, ce qui garde la page statique et
 * évite de dupliquer la logique de génération.
 */
export function BadgeSnippet({ tabs }: { tabs: BadgeSnippetTab[] }) {
  const { locale } = useI18n();
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const [copied, setCopied] = useState(false);

  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  if (!current) return null;

  const labels =
    locale === "ar"
      ? { copy: "نسخ الرمز", copied: "تم النسخ ✓", hint: "الصق هذا الرمز في تذييل موقعك — قبل وسم </body>." }
      : {
          copy: "Copy code",
          copied: "Copied ✓",
          hint: "Paste this snippet in the site footer, right before </body>.",
        };

  async function copy() {
    try {
      await navigator.clipboard.writeText(current.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div id="snippet" className="mt-10 min-w-0 scroll-mt-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black">
          {locale === "ar" ? "رمز جاهز للنسخ" : "Snippet prêt à copier"}
        </h2>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-9 items-center rounded-full border border-[var(--border)] px-4 text-xs font-bold hover:bg-[var(--secondary)] transition"
          aria-live="polite"
        >
          {copied ? labels.copied : labels.copy}
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Snippet variants"
        className="mt-4 flex flex-wrap gap-2 border-b border-[var(--border)] pb-2"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === current.id}
            onClick={() => {
              setActive(tab.id);
              setCopied(false);
            }}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              tab.id === current.id
                ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "hover:bg-[var(--secondary)] opacity-70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <pre
        dir="ltr"
        className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[#0C0C0F] p-4 text-[11.5px] leading-6 text-[#E8E6DF]"
      >
        <code data-language={current.language}>{current.code}</code>
      </pre>
      <p className="mt-2 text-xs opacity-50">{labels.hint}</p>
    </div>
  );
}
