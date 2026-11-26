"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Clipboard, Compass, MessageCircle, RotateCcw } from "lucide-react";
import { LocalizedLink as Link } from "@/components/localized-link";
import { Price } from "@/components/price";
import { useSiteConfig } from "@/components/site-provider";
import { useI18n } from "@/lib/i18n";
import { whatsappLink } from "@/lib/utils";
import { WEBSITE_CONTENT_FROM_USD, WEBSITE_LANGUAGE_PRICE_USD, websiteOptions } from "@/lib/website-offer";
import {
  buildWebsiteGuideMessage, DEFAULT_WEBSITE_GUIDE, estimateWebsiteGuide,
  MAX_GUIDE_LANGUAGES, MAX_GUIDE_NOTE, type WebsiteGuideSelection,
} from "@/lib/website-guide";

const fieldClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const choiceClass = "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-4 text-start transition-colors focus-within:ring-2 focus-within:ring-[var(--accent)]";

/** No checkout state or payment request: this guide only builds a scoped enquiry. */
export function WebsiteChoiceGuide() {
  const { locale } = useI18n();
  const config = useSiteConfig();
  const ar = locale === "ar";
  const pick = (a: string, e: string) => ar ? a : e;
  const [selection, setSelection] = useState<WebsiteGuideSelection>({ ...DEFAULT_WEBSITE_GUIDE });
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const estimate = estimateWebsiteGuide(selection);
  const message = buildWebsiteGuideMessage(selection, locale);
  const patch = (next: Partial<WebsiteGuideSelection>) => {
    setSelection(current => ({ ...current, ...next }));
    setCopyState("idle");
  };
  const selectedStyle = (active: boolean) => active
    ? "border-[var(--accent)] bg-[var(--accent)]/8"
    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]/50";
  const canWhatsApp = config.whatsapp.replace(/\D/g, "").length > 0;

  return (
    <section id="website-guide" aria-labelledby="website-guide-title" className="section scroll-mt-40" dir={ar ? "rtl" : "ltr"}>
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <p className="section-eyebrow justify-center"><Compass className="h-4 w-4" aria-hidden="true" />{pick("دليل الاختيار والتقدير", "CHOICE GUIDE & ESTIMATE")}</p>
          <h2 id="website-guide-title" className="section-title">{pick("ماذا يحتاج موقعك فعلاً؟", "What does your website actually need?")}</h2>
          <p className="section-lead">{pick("اختر ما يناسبك، وافهم المشمول والإضافات، ثم احصل على فكرة عن الميزانية. إذا لم تجد طلبك، انتقل مباشرة إلى الفريق مع ملخص اختياراتك.", "Choose what you need, understand what is included and get a budget indication. If your request is not covered, go straight to our team with a summary of your choices.")}</p>
          <Link href="/demos" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--accent)] underline underline-offset-4">{pick("ابدأ باختيار نموذج — التصميم لا يغير السعر الأساسي", "Start by choosing a model — design does not change the base price")}<ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" /></Link>
        </header>

        <div className="mx-auto mt-8 grid max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-6">
            <fieldset className="rounded-2xl border border-[var(--border)] p-5 sm:p-6">
              <legend className="px-2 text-lg font-black">{pick("1. كيف تريد تحديث المحتوى بعد التسليم؟", "1. How will you update content after delivery?")}</legend>
              <p className="mb-4 text-sm leading-7 text-[var(--muted-foreground)]">{pick("إدخال شعارك ونصوصك وصورك المقدمة قبل التسليم الأول مشمول مجاناً داخل النموذج. السؤال هنا عن الإدارة الذاتية بعد ذلك.", "Inserting your supplied logo, texts and images into the model before initial delivery is already free. This question is about self-service editing afterwards.")}</p>
              <div className="space-y-3">
                {([
                  ["code", pick("لا أحتاج لوحة إدارة", "I do not need an admin panel"), pick("محتوى ثابت؛ التعديلات اللاحقة تتم في الكود أو باتفاق منفصل.", "Static content; later changes are made in code or by separate agreement.")],
                  ["admin", pick("أريد تعديل المحتوى بنفسي", "I want to edit content myself"), pick(`إدارة محتوى من $${WEBSITE_CONTENT_FROM_USD} إضافية، مع قاعدة البيانات والإدارة اللازمة حسب النطاق.`, `Content management from an extra $${WEBSITE_CONTENT_FROM_USD}, including the required database and admin tools for an agreed scope.`)],
                  ["unsure", pick("لست متأكداً — ساعدوني في الاختيار", "I am not sure — help me choose"), pick("نعرض الجزء المعروف فقط ونحدد الإدارة المناسبة معك قبل التسعير النهائي.", "We show only the known portion and confirm the right management scope before final pricing.")],
                ] as const).map(([value, title, description]) => (
                  <label key={value} className={`${choiceClass} ${selectedStyle(selection.updates === value)}`}>
                    <input type="radio" name="website-guide-updates" value={value} checked={selection.updates === value} onChange={() => patch({ updates: value })} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
                    <span><span className="block text-sm font-bold">{title}</span><span className="mt-1 block text-xs leading-6 text-[var(--muted-foreground)]">{description}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="rounded-2xl border border-[var(--border)] p-5 sm:p-6">
              <legend className="px-2 text-lg font-black">{pick("2. اختر اللغات والوظائف", "2. Choose languages & functions")}</legend>
              <label htmlFor="guide-extra-languages" className="block text-sm font-bold">{pick("كم لغة إضافية تحتاج؟", "How many additional languages do you need?")}</label>
              <p id="guide-language-help" className="my-2 text-xs leading-6 text-[var(--muted-foreground)]">{pick(`لغة واحدة مشمولة. كل لغة إضافية $${WEBSITE_LANGUAGE_PRICE_USD}، والترجمة تقدمها أنت. للغات أكثر أو مساعدة في الترجمة تواصل معنا.`, `One language is included. Each extra language is $${WEBSITE_LANGUAGE_PRICE_USD}, with translation supplied by you. Contact us for more languages or translation help.`)}</p>
              <select id="guide-extra-languages" aria-describedby="guide-language-help" className={fieldClass} value={selection.extraLanguages} onChange={e => patch({ extraLanguages: Number(e.target.value) })}>
                {Array.from({ length: MAX_GUIDE_LANGUAGES + 1 }, (_, count) => <option key={count} value={count}>{count === 0 ? pick("لا إضافات — لغة واحدة إجمالاً", "None — one language in total") : pick(`${count} إضافية — ${count + 1} لغات إجمالاً`, `${count} extra — ${count + 1} languages in total`)}</option>)}
              </select>
              <p className="my-4 rounded-xl bg-[var(--secondary)]/60 p-3 text-xs leading-6">{pick("روابط واتساب والهاتف مشمولة. رسالة لطلب موعد أو منتج تعالج يدوياً ليست نظاماً لإدارة الحجوزات أو الطلبات.", "WhatsApp and phone links are included. A manually handled appointment or product request is not a booking or order-management system.")}</p>
              <div className="space-y-3">
                {websiteOptions.filter(option => ["booking", "store", "payment"].includes(option.id)).map(option => {
                  const id = option.id as "booking" | "store" | "payment";
                  return <label key={id} className={`${choiceClass} ${selectedStyle(selection[id])}`}>
                    <input type="checkbox" checked={selection[id]} onChange={e => patch({ [id]: e.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
                    <span><span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm font-bold">{ar ? option.nameAr : option.nameEn}<span className="text-xs text-[var(--accent)]">{pick("بعرض سعر", "On quote")}</span></span><span className="mt-1 block text-xs leading-6 text-[var(--muted-foreground)]">{ar ? option.detailAr : option.detailEn}</span></span>
                  </label>;
                })}
              </div>
              {estimate.hasConnectedModule && <p className="mt-4 text-xs leading-6 text-[var(--muted-foreground)]">{pick("الوحدات المتصلة تشمل البنية اللازمة لوظائفها ضمن عرضها. نحدد إدارة المحتوى معها ولا نضيف رسوم قاعدة بيانات أو إدارة أساسية مرتين. الدفع وحده يحتاج تحديد مسار الطلب أولاً.", "Connected modules are quoted with the foundation their functions need. Content management is scoped with them: we do not add the database or basic admin fee twice. Payment alone first needs an agreed ordering flow.")}</p>}
            </fieldset>

            <fieldset className="rounded-2xl border border-[var(--border)] p-5 sm:p-6">
              <legend className="px-2 text-lg font-black">{pick("3. هل تحتاج شيئاً آخر؟", "3. Need something else?")}</legend>
              <div className="space-y-3">
                {([
                  ["contentHelp", pick("أحتاج كتابة أو ترجمة أو تجهيز محتوى", "I need copywriting, translation or content preparation")],
                  ["customDomain", pick("أريد دوميناً خاصاً أو مساعدة في ربطه", "I need a custom domain or help connecting it")],
                  ["customRequest", pick("أحتاج صفحات جديدة أو تغيير الهيكل أو طلباً غير موجود", "I need new pages, structural changes or something not listed")],
                ] as const).map(([id, label]) => <label key={id} className={`${choiceClass} ${selectedStyle(selection[id])}`}>
                  <input type="checkbox" checked={selection[id]} onChange={e => patch({ [id]: e.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" /><span className="text-sm leading-6">{label}<span className="ms-2 text-xs font-bold text-[var(--accent)]">{pick("يحتاج تأكيد التكلفة", "Cost to confirm")}</span></span>
                </label>)}
              </div>
              <label htmlFor="guide-custom-note" className="mb-2 mt-5 block text-sm font-bold">{pick("لم تجد التخصيص الذي تريده؟ صف الإضافة هنا", "Cannot find your customization? Describe the extra here")}</label>
              <textarea id="guide-custom-note" value={selection.note} maxLength={MAX_GUIDE_NOTE} rows={3} onChange={e => patch({ note: e.target.value })} aria-describedby="guide-note-help" className={fieldClass} placeholder={pick("مثال: ربط نظام خارجي أو صفحة إضافية...", "For example: connecting another system or adding a page...")} />
              <p id="guide-note-help" className="mt-2 text-xs leading-6 text-[var(--muted-foreground)]">{pick("أي إضافة تصفها هنا تُراجع بعرض منفصل. لا تضع كلمات مرور أو بيانات حساسة. لا تُرسل اختياراتك تلقائياً.", "Extras described here are reviewed separately. Do not include passwords or sensitive data. Your choices are not sent automatically.")}</p>
            </fieldset>
          </div>

          <aside aria-labelledby="guide-estimate-title" className="min-w-0 rounded-2xl border border-[var(--accent)]/50 bg-[var(--card)] p-5 shadow-[var(--shadow-md)] sm:p-6 lg:sticky lg:top-40">
            <div className="flex items-center justify-between gap-4">
              <h3 id="guide-estimate-title" className="text-lg font-black">{pick("ملخص اختياراتك", "Your selection summary")}</h3>
              <button type="button" onClick={() => { setSelection({ ...DEFAULT_WEBSITE_GUIDE }); setCopyState("idle"); }} className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-[var(--muted-foreground)] hover:text-[var(--accent)]"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />{pick("إعادة البدء", "Reset")}</button>
            </div>
            <dl className="mt-4 divide-y divide-[var(--border)]">
              {estimate.lines.map(line => <div key={line.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-3 text-sm">
                <dt className="max-w-[70%] leading-6">{ar ? line.ar : line.en}</dt>
                <dd className="font-bold text-end">{line.kind === "quote" ? <span className="text-[var(--accent)]">{pick("بعرض سعر", "On quote")}</span> : line.kind === "bundled" ? <span className="text-xs text-[var(--muted-foreground)]">{pick("يحدد مع عرض الوحدات", "Scoped with module quote")}</span> : <>{line.kind === "from" && pick("من ", "From ")}<Price usd={line.amountUsd ?? 0} /></>}</dd>
              </div>)}
            </dl>
            <div className="mt-4 rounded-xl bg-[var(--secondary)]/60 p-4" aria-live="polite" aria-atomic="true">
              <p className="text-xs font-bold text-[var(--muted-foreground)]">{estimate.hasUnpricedOptions ? pick("الجزء المعروف فقط — ليس إجمالي المشروع", "Known portion only — not the project total") : estimate.hasStartingPrice ? pick("تقدير يبدأ من", "Indicative starting estimate") : pick("التقدير الإرشادي", "Indicative estimate")}</p>
              <p className="mt-2 text-3xl font-black text-[var(--accent)]">{estimate.hasStartingPrice && <span className="me-2 text-sm">{pick("من", "From")}</span>}<Price usd={estimate.knownSubtotalUsd} /></p>
              {estimate.hasUnpricedOptions && <p className="mt-2 text-sm font-bold">{pick("+ تكلفة الخيارات غير المسعرة أعلاه", "+ the unpriced options listed above")}</p>}
              <p className="mt-3 text-xs leading-6 text-[var(--muted-foreground)]">{pick("المبالغ بالدولار؛ التحويلات المعروضة تقريبية. هذا ليس عرض سعر نهائياً. المدة والنطاق والسعر النهائي تؤكد قبل الدفع. لا يتم إنشاء طلب أو احتساب إضافات هنا.", "Amounts are in USD; display conversions are indicative. This is not a final quote. Scope, timing and the final price are confirmed before payment. No order is placed and no extras are charged here.")}</p>
            </div>
            <p className="mt-4 text-xs leading-6 text-[var(--muted-foreground)]">{pick("نشر vercel.app يخضع لأهلية وحدود Vercel، وليس ضمان استضافة مجانية مدى الحياة. الدومين المخصص والتكاليف الخارجية والمتكررة ورسوم مزودي الدفع غير محتسبة.", "vercel.app deployment is subject to Vercel eligibility and limits, not a lifetime free-hosting promise. Custom domains, external and recurring costs, and payment-provider fees are not counted.")}</p>
            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <h4 className="font-bold">{estimate.requiresQuote ? pick("لنحدد طلبك معاً", "Let’s scope your request together") : pick("هل تناسبك هذه الخيارات؟", "Do these choices fit your needs?")}</h4>
              <p className="mt-2 text-xs leading-6 text-[var(--muted-foreground)]">{pick("أرسل الاختيارات للفريق، أو اسأل مباشرة إذا لم تجد الإجابة. يمكنك أيضاً نسخ الملخص واستخدام وسيلة تواصل أخرى.", "Send your choices to our team, or ask directly if you have not found the answer. You can also copy the summary and use another contact method.")}</p>
              {canWhatsApp && <a href={whatsappLink(config.whatsapp, message)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-center text-sm font-black text-[var(--accent-foreground)]"><MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{pick("تواصل مباشرة وأرسل اختياراتك", "Contact us directly with my choices")}</a>}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(message); setCopyState("copied"); } catch { setCopyState("failed"); } }} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold">{copyState === "copied" ? <Check className="h-4 w-4" aria-hidden="true" /> : <Clipboard className="h-4 w-4" aria-hidden="true" />}{copyState === "copied" ? pick("تم النسخ", "Copied") : pick("انسخ ملخص الطلب", "Copy request summary")}</button>
                <Link href="/contact" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-[var(--accent)] underline underline-offset-4">{pick("وسائل تواصل أخرى", "Other ways to contact us")}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
              <p role="status" className="text-xs leading-6">{copyState === "failed" ? pick("تعذر النسخ التلقائي. افتح الملخص أدناه وانسخه يدوياً.", "Automatic copy is unavailable. Open the summary below and copy it manually.") : copyState === "copied" ? pick("يمكنك لصق الملخص في رسالة أو نموذج التواصل.", "You can paste the summary into a message or contact form.") : ""}</p>
              <details className="mt-3 text-xs">
                <summary className="min-h-11 cursor-pointer py-3 font-bold">{pick("شاهد النص الذي سترسله", "Preview the message you will send")}</summary>
                <textarea readOnly value={message} aria-label={pick("ملخص طلبك للنسخ", "Your request summary to copy")} rows={9} className={`${fieldClass} mt-2`} />
              </details>
            </div>
          </aside>
        </div>
        <noscript><p className="mt-5 text-center">{pick("فعّل JavaScript لتغيير الاختيارات وحساب التقدير، أو تواصل معنا مباشرة.", "Enable JavaScript to change choices and calculate the estimate, or contact us directly.")} <Link href="/contact">{pick("تواصل معنا", "Contact us")}</Link></p></noscript>
      </div>
    </section>
  );
}
