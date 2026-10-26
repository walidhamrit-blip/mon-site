"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function LegalLinks() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <nav aria-label={ar ? "معلومات الشراء" : "Purchase information"} className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      <Link className="underline underline-offset-4" href="/conditions">{ar ? "الشروط العامة للبيع" : "Terms & conditions of sale"}</Link>
      <Link className="underline underline-offset-4" href="/remboursement">{ar ? "سياسة الاسترداد" : "Refund policy"}</Link>
      <Link className="underline underline-offset-4" href="/contact">{ar ? "التواصل المهني" : "Professional contact"}</Link>
    </nav>
  );
}
