"use client";

import { ArrowRight, Check, ClipboardCheck, FileText, Gauge, ShieldCheck, Smartphone } from "lucide-react";
import { LocalizedLink as Link } from "@/components/localized-link";
import { AuditRequestForm } from "@/components/audit-request-form";
import { AUDIT_CATEGORIES, AUDIT_ITEM_COUNT } from "@/lib/audit-checklist";
import { useI18n } from "@/lib/i18n";

/** Mesures réelles — Lighthouse 12 mobile, 3 runs, médiane, 20/11/2026. */
const BEFORE = { performance: 82, accessibility: 96, bestPractices: 75, seo: 100 };
/**
 * « Après » = build local du correctif, même page, même jour. La performance
 * n'est pas comparable entre un runner local et la production : elle est donc
 * affichée « n.c. » plutôt que présentée comme un gain.
 */
const AFTER = { performance: null, accessibility: 100, bestPractices: 75, seo: 100 };

const FINDINGS = [
  {
    severity: { ar: "متوسط", en: "Medium" },
    finding: {
      ar: "روابط بلا اسم واضح (أيقونات فقط تحت 640 بكسل)",
      en: "Links without a discernible name (icon-only below 640 px)",
    },
    cause: {
      ar: "نص الرابط مخفي على الهاتف، فبقي للقارئ الآلي أيقونة فقط.",
      en: "The link text was hidden on mobile, leaving screen readers with an icon only.",
    },
    action: {
      ar: "إضافة aria-label عربية/إنجليزية للروابط والأزرار.",
      en: "Added Arabic/English aria-labels to the links and buttons.",
    },
    status: "fixed" as const,
  },
  {
    severity: { ar: "متوسط", en: "Medium" },
    finding: { ar: "195 كيلوبايت من JavaScript غير مستخدم", en: "195 KiB of unused JavaScript" },
    cause: {
      ar: "حزمة إطار العمل تُحمّل كاملة في هذه الصفحة.",
      en: "The framework bundle is shipped whole on this page.",
    },
    action: {
      ar: "لم يُصلح في هذه الجولة: يحتاج تقسيم الحزمة وإعادة بناء، خارج نطاق التدقيق السريع.",
      en: "Not fixed in this pass: it needs bundle splitting and a rebuild, outside a quick audit.",
    },
    status: "open" as const,
  },
  {
    severity: { ar: "متوسط", en: "Medium" },
    finding: { ar: "LCP 3.2 ثانية على الهاتف", en: "LCP 3.2 s on mobile" },
    cause: {
      ar: "صورة البطل داخل إطار المعاينة تُحمّل متأخرة.",
      en: "The hero image inside the preview frame loads late.",
    },
    action: {
      ar: "لم يُصلح: يتطلب تغيير تحميل الإطار. موصى به: preload للصورة وتحديد أبعادها.",
      en: "Not fixed: it requires changing how the frame loads. Recommended: preload the image and set its dimensions.",
    },
    status: "open" as const,
  },
  {
    severity: { ar: "منخفض", en: "Low" },
    finding: { ar: "كوكي طرف ثالث من صور Pexels", en: "Third-party cookie from Pexels images" },
    cause: {
      ar: "الصور تُستضاف عند طرف خارجي.",
      en: "Images are hosted by an external provider.",
    },
    action: {
      ar: "لم يُصلح: استضافة الصور داخلياً قرار منتج. موصى به لاحقاً.",
      en: "Not fixed: self-hosting images is a product decision. Recommended later.",
    },
    status: "open" as const,
  },
  {
    severity: { ar: "منخفض", en: "Low" },
    finding: { ar: "أخطاء في وحدة التحكم من التطبيق المضمّن", en: "Console errors from the embedded demo app" },
    cause: {
      ar: "التطبيق التجريبي يستدعي موارد غير موجودة.",
      en: "The demo app requests resources that do not exist.",
    },
    action: {
      ar: "لم يُصلح: يخص تطبيق العرض لا صفحة التدقيق. موثّق في التقرير.",
      en: "Not fixed: it belongs to the demo app, not the audited page. Documented in the report.",
    },
    status: "open" as const,
  },
  {
    severity: { ar: "لا مشكلة", en: "No issue" },
    finding: {
      ar: "SEO 100/100: canonical وrobots وsitemap صحيحة",
      en: "SEO 100/100: canonical, robots and sitemap correct",
    },
    cause: { ar: "لا شيء.", en: "None." },
    action: { ar: "تم التحقق فقط.", en: "Verified only." },
    status: "checked" as const,
  },
];

const BEFORE_METRICS = [
  { label: { ar: "LCP", en: "LCP" }, value: "3,18 s" },
  { label: { ar: "TBT", en: "TBT" }, value: "359 ms" },
  { label: { ar: "CLS", en: "CLS" }, value: "0" },
  { label: { ar: "Speed Index", en: "Speed Index" }, value: "4,28 s" },
];

function Score({ label, before, after }: { label: string; before: number; after: number | null }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
      <p className="text-xs font-bold opacity-55">{label}</p>
      <p className="mt-2 text-sm opacity-60">
        <span className="line-through">{before}</span> <ArrowRight className="inline h-3 w-3" />{" "}
        <span className="text-2xl font-black text-[var(--accent)]">{after ?? "n.c."}</span>
      </p>
    </div>
  );
}

export function AuditClient() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const t = (arText: string, enText: string) => (ar ? arText : enText);

  return (
    <div className="pt-6">
      {/* Hero */}
      <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">
            {t("تدقيق وإصلاح", "Audit & fix")}
          </p>
          <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
            {t(
              "تدقيق موقعك في 46 نقطة — وتقرير واضح قبل/بعد",
              "Your site audited across 46 points — with a clear before/after report",
            )}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 opacity-75">
            {t(
              "من 90 دولاراً. تقرير مفهوم، إصلاحات فورية لما يمكن إصلاحه، وقائمة صريحة بما لم يُصلح ولماذا. خلال 24 إلى 48 ساعة.",
              "From $90. A plain-language report, immediate fixes where possible, and an explicit list of what was not fixed and why. Within 24–48 hours.",
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-3 print:hidden">
            <a
              href="#demande"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-black text-[var(--accent-foreground)]"
            >
              {t("اطلب تدقيقاً", "Request an audit")}
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#checklist"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--border)] px-6 text-sm font-bold"
            >
              {t("اطّلع على 46 نقطة", "See the 46 points")}
            </a>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: "46", v: t("نقطة فحص", "checkpoints") },
              { k: "8", v: t("فئات", "categories") },
              { k: "90 $", v: t("السعر", "price") },
              { k: "24–48 h", v: t("التسليم", "delivery") },
            ].map((item) => (
              <div key={item.v} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                <dt className="text-2xl font-black">{item.k}</dt>
                <dd className="text-xs font-bold opacity-55">{item.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Ce que vous recevez */}
      <section className="section-tight">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black sm:text-3xl">{t("ما تحصل عليه", "What you receive")}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: FileText,
                title: t("تقرير قابل للطباعة", "A printable report"),
                body: t(
                  "ملف HTML يُطبع كـ PDF من المتصفح: النتائج، الأدلة، الأولويات، وما لم يُصلح.",
                  "An HTML report you print to PDF from the browser: results, evidence, priorities and what was not fixed.",
                ),
              },
              {
                icon: ClipboardCheck,
                title: t("46 نقطة موثّقة", "46 documented points"),
                body: t(
                  "كل نقطة مصنّفة: ناجحة، فاشلة، أو غير منطبقة. لا نقاط مخفية.",
                  "Every point is classified: pass, fail, or not applicable. No hidden items.",
                ),
              },
              {
                icon: Gauge,
                title: t("قياسات مؤرخة", "Dated measurements"),
                body: t(
                  "Lighthouse للهاتف قبل وبعد، مع اسم الأداة والتاريخ. لا أرقام بلا مصدر.",
                  "Mobile Lighthouse before and after, with tool name and date. No unsourced numbers.",
                ),
              },
              {
                icon: ShieldCheck,
                title: t("متابعة 14 يوماً", "14-day follow-up"),
                body: t(
                  "مكالمة شرح 30 دقيقة، ثم 14 يوماً لتصحيح أي انحدار بعد التعديلات.",
                  "A 30-minute walkthrough, then 14 days to catch any regression after the changes.",
                ),
              },
            ].map((card) => (
              <article key={card.title} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
                <card.icon className="h-5 w-5 text-[var(--accent)]" />
                <h3 className="mt-3 text-sm font-black">{card.title}</h3>
                <p className="mt-2 text-xs leading-5 opacity-65">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Checklist */}
      <section id="checklist" className="section-tight bg-[var(--secondary)]/25">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black sm:text-3xl">
            {t(`${AUDIT_ITEM_COUNT} نقطة، 8 فئات`, `${AUDIT_ITEM_COUNT} points, 8 categories`)}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 opacity-65">
            {t(
              "الوزن يخدم ترتيب الأولويات في التقرير، وليس نقطة مدرسية. كل بند يُفحص بأداة أو بفحص يدوي موثّق.",
              "Weights prioritise the report; they are not a school grade. Every item is checked with a tool or a documented manual inspection.",
            )}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {AUDIT_CATEGORIES.map((category) => (
              <article key={category.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-base font-black">{ar ? category.titleAr : category.titleEn}</h3>
                  <span className="rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-[11px] font-black text-[var(--accent)]">
                    {category.weight}%
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {category.items.map((item) => (
                    <li key={item.en} className="flex items-start gap-2 text-xs leading-5 opacity-75">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                      <span>{ar ? item.ar : item.en}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Rapport exemple */}
      <section className="section-tight">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black sm:text-3xl">{t("تقرير مثال حقيقي", "A real sample report")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 opacity-65">
            {t(
              "تدقيق موقع العرض «تولين ماغازين» (موقعنا التجريبي، لا عميل). القياسات مسجّلة في 20/11/2026 بـ Lighthouse 12 للهاتف، 3 تشغيلات والمتوسط.",
              "Audit of the “Tulin Magazin” demo (our own demo, not a client). Measured on 20/11/2026 with mobile Lighthouse 12, 3 runs, median.",
            )}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Score label={t("الأداء", "Performance")} before={BEFORE.performance} after={AFTER.performance} />
            <Score label={t("الوصولية", "Accessibility")} before={BEFORE.accessibility} after={AFTER.accessibility} />
            <Score label={t("الممارسات", "Best practices")} before={BEFORE.bestPractices} after={AFTER.bestPractices} />
            <Score label={t("SEO", "SEO")} before={BEFORE.seo} after={AFTER.seo} />
          </div>

          <ul className="mt-4 grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
            {BEFORE_METRICS.map((metric) => (
              <li key={metric.label.en} className="flex items-baseline justify-between gap-2">
                <span className="font-bold">{ar ? metric.label.ar : metric.label.en}</span>
                <span className="opacity-70">{metric.value}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] opacity-55">
            {t(
              "هذه أرقام الإنتاج قبل التدقيق. القياس «بعد» أُجري على بناء محلي: الوصولية قابلة للمقارنة، أما الأداء فغير قابل للمقارنة بين بيئتين — لذلك لا ندّعي تحسناً في السرعة.",
              "These are production figures before the audit. The “after” run was a local build: accessibility is comparable, performance is not comparable across environments — so no speed improvement is claimed.",
            )}
          </p>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="w-full min-w-[760px] text-start text-xs">
              <thead className="bg-[var(--secondary)]/50 text-[11px] uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5 text-start">{t("الخطورة", "Severity")}</th>
                  <th className="px-4 py-2.5 text-start">{t("ما وُجد", "Finding")}</th>
                  <th className="px-4 py-2.5 text-start">{t("السبب", "Cause")}</th>
                  <th className="px-4 py-2.5 text-start">{t("الإجراء", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {FINDINGS.map((finding) => (
                  <tr key={finding.finding.en} className="border-t border-[var(--border)] align-top">
                    <td className="px-4 py-3 font-bold whitespace-nowrap">
                      <span
                        className={
                          finding.status === "fixed"
                            ? "text-emerald-500"
                            : finding.status === "checked"
                              ? "opacity-55"
                              : "text-amber-500"
                        }
                      >
                        {ar ? finding.severity.ar : finding.severity.en}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold">{ar ? finding.finding.ar : finding.finding.en}</td>
                    <td className="px-4 py-3 opacity-70">{ar ? finding.cause.ar : finding.cause.en}</td>
                    <td className="px-4 py-3 opacity-70">{ar ? finding.action.ar : finding.action.en}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-xs leading-5 opacity-75">
              <h3 className="text-sm font-black opacity-100">{t("ما لم يُصلح ولماذا", "What was not fixed, and why")}</h3>
              <p className="mt-2">
                {t(
                  "JavaScript غير المستخدم وLCP يخصّان بنية الإطار والحزمة: تغييرهما في نفس اليوم يخاطر بموقع العميل. الكوكي والأخطاء يأتيان من تطبيق العرض الخارجي. التقرير يفصل بين «أُصلح الآن» و«موصى به لاحقاً».",
                  "Unused JavaScript and LCP belong to the frame and bundle architecture: changing them the same day risks the client site. The cookie and console errors come from the external demo app. The report separates “fixed now” from “recommended later”.",
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-xs leading-5 opacity-75">
              <h3 className="text-sm font-black opacity-100">{t("حدود هذا المثال", "Limits of this example")}</h3>
              <p className="mt-2">
                {t(
                  "صفحة واحدة، محاكاة هاتف، بدون بيانات ميدانية (CrUX) أو تحليلات العميل. ثلاث تشغيلات تُظهر تبايناً: الأداء تراوح بين 69 و86. المتوسط هو المعروض، وليس أفضل نتيجة. القياس «بعد» أُجري على بناء محلي، لذلك لا تُقارن السرعة بين البيئتين.",
                  "One page, emulated mobile, no field data (CrUX) and no client analytics. Three runs show variance: performance ranged from 69 to 86. The median is reported, not the best run. The “after” run used a local build, so speed is not compared across environments.",
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Formulaire */}
      <section id="demande" className="section-tight bg-[var(--secondary)]/25">
        <div className="site-container max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-2xl font-black">{t("اطلب تدقيق موقعك", "Request your audit")}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 opacity-65">
            {t(
              "أرسل العنوان. نتحقق منه ونرد خلال 24 إلى 48 ساعة بمدى واضح وسعر نهائي. لا التزام قبل الموافقة.",
              "Send the address. We check it and reply within 24–48 h with a clear scope and final price. No commitment before you approve.",
            )}
          </p>
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
            <AuditRequestForm />
          </div>
          <p className="mt-4 text-xs opacity-55">
            {t("تفضّل واتساب؟", "Prefer WhatsApp?")}{" "}
            <Link href="/contact" className="font-bold text-[var(--accent)] hover:underline">
              {t("تواصل معنا", "Contact us")}
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
