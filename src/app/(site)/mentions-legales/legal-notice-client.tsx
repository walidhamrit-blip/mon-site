"use client";

import { useI18n } from "@/lib/i18n";
import { LegalLinks } from "@/components/legal-links";
import type { LegalRow } from "@/lib/trust";

interface Props {
  rows: LegalRow[];
  supportEmail: string;
}

/**
 * Page /mentions-legales.
 *
 * Les lignes arrivent déjà filtrées par `legalRows()` : un champ vide côté
 * admin est **absent** ici, jamais remplacé par une valeur inventée. La page
 * n'a donc rien à décider — elle affiche ce qui est vrai et vérifiable.
 */
export function LegalNoticeClient({ rows, supportEmail }: Props) {
  const { locale } = useI18n();
  const ar = locale === "ar";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent,#C6A664)]">
          {ar ? "معلومات قانونية" : "Legal information"}
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
          {ar ? "المعلومات القانونية" : "Legal notice"}
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-[var(--muted-foreground)]">
          {ar
            ? "من ينشر هذا الموقع، وكيف يمكن التحقق منه والاتصال به. المعلومات أدناه مطابقة لما هو مُصرَّح به رسمياً."
            : "Who publishes this site, and how to verify and contact them. The details below match what is actually declared."}
        </p>
      </header>

      <dl className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        {rows.map((row, index) => (
          <div
            key={`${row.labelEn}-${index}`}
            className={`grid gap-1 px-4 py-3.5 sm:grid-cols-[220px_1fr] sm:gap-4 ${
              index > 0 ? "border-t border-[var(--border)]" : ""
            }`}
          >
            <dt className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              {ar ? row.labelAr : row.labelEn}
            </dt>
            <dd className="text-sm font-medium" dir={isArabicValue(row.value) ? "rtl" : undefined}>
              {row.href ? (
                <a
                  className="underline underline-offset-4"
                  href={row.href}
                  {...(row.href.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-lg font-black tracking-tight">
          {ar ? "المسؤولية والبيانات" : "Liability & data"}
        </h2>
        <ul className="mt-3 space-y-2 text-[13px] leading-6 text-[var(--muted-foreground)]">
          <li>
            {ar
              ? "محتوى هذا الموقع (النصوص، الصور، الأكواد) ملك لنخبة، ولا يجوز نسخه دون إذن كتابي."
              : "The content of this site (text, visuals, code) belongs to Nukhba and may not be reproduced without written permission."}
          </li>
          <li>
            {ar
              ? "لا نطلب أي معلومة بنكية على هذا الموقع: الدفع يتم عبر بوابة دفع خارجية، ولا تُخزَّن بيانات البطاقة عندنا."
              : "No bank details are requested on this site: payment goes through an external gateway and no card data is stored on our side."}
          </li>
          <li>
            {ar
              ? "لطلب الوصول إلى بياناتك أو حذفها، اكتب إلينا وسنرد خلال 7 أيام."
              : "To access or delete your data, write to us and we will reply within 7 days."}{" "}
            <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          </li>
        </ul>
      </section>

      <div className="border-t border-[var(--border)] pt-5">
        <LegalLinks />
      </div>
    </div>
  );
}

/** Valeur arabe → direction RTL, sans dépendre de la langue de l'interface. */
function isArabicValue(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}
