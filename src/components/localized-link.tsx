"use client";

import Link, { type LinkProps } from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { localizedPath } from "@/lib/locale";

/** Convertit un href objet Next en chaîne sans perdre query ni ancre. */
function hrefToString(href: LinkProps["href"]): string | null {
  if (typeof href === "string") return href;
  if (!href.pathname) return null;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(href.query ?? {})) {
    if (value == null) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(key, String(item));
    }
  }
  const query = params.toString();
  return `${href.pathname}${query ? `?${query}` : ""}${href.hash ? `#${href.hash.replace(/^#/, "")}` : ""}`;
}

/**
 * Lien interne qui conserve la langue de l'URL courante.
 * Les liens externes, ancres seules, /admin, /api et ressources statiques
 * restent inchangés. Le href rendu est déjà localisé : il fonctionne sans JS
 * et reste crawlable, contrairement à un simple onClick.
 */
export function LocalizedLink({
  href,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: LinkProps["href"]; children?: ReactNode }) {
  const { locale, defaultLocale } = useI18n();
  const raw = hrefToString(href);
  const localized = raw == null ? href : raw.startsWith("#") ? raw : localizedPath(raw, locale, defaultLocale);
  return (
    <Link {...props} href={localized}>
      {children}
    </Link>
  );
}
