"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Preserve inbound links and existing CTAs after moving web content. */
export function HomeLegacyAnchors() {
  const router = useRouter();
  useEffect(() => {
    const forward = () => {
      const hash = window.location.hash;
      if (["#lead-form", "#pricing", "#demos", "#process"].includes(hash)) {
        router.replace(`/creation-sites${hash === "#process" ? "#website-process" : hash}`);
      }
    };
    forward();
    window.addEventListener("hashchange", forward);
    return () => window.removeEventListener("hashchange", forward);
  }, [router]);
  return null;
}
