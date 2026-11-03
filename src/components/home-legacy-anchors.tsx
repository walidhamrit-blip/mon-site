"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { localizedPath } from "@/lib/locale";

/** Preserve inbound links and existing CTAs after moving web content. */
export function HomeLegacyAnchors() {
  const router = useRouter();
  const { locale, defaultLocale } = useI18n();
  useEffect(() => {
    const forward = () => {
      const hash = window.location.hash;
      if (["#lead-form", "#pricing", "#demos", "#process"].includes(hash)) {
        const target = `/creation-sites${hash === "#process" ? "#website-process" : hash}`;
        router.replace(localizedPath(target, locale, defaultLocale));
      }
    };
    forward();
    window.addEventListener("hashchange", forward);
    return () => window.removeEventListener("hashchange", forward);
  }, [router, locale, defaultLocale]);
  return null;
}
