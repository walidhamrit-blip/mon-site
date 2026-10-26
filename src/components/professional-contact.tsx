"use client";

import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { whatsappLink } from "@/lib/utils";

export function ProfessionalContact() {
  const config = useSiteConfig();
  const { locale } = useI18n();
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-xl font-black">{locale === "ar" ? "قنوات التواصل المهنية" : "Professional communication channels"}</h2>
      <ul className="space-y-3 text-sm break-words">
        <li>E-mail: <a className="underline" dir="ltr" href={`mailto:${config.email}`}>{config.email}</a></li>
        <li>WhatsApp: <a className="underline" dir="ltr" href={whatsappLink(config.whatsapp)} target="_blank" rel="noopener noreferrer">{whatsappLink(config.whatsapp)}</a></li>
        <li>{locale === "ar" ? "الهاتف" : "Phone"}: <a className="underline" dir="ltr" href={`tel:${config.phone.replace(/\s/g, "")}`}>{config.phone}</a></li>
      </ul>
    </section>
  );
}
