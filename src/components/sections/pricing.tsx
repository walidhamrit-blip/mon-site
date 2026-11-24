"use client";

import { Check, Code2, Database, ArrowUpRight } from "lucide-react";
import { LocalizedLink as Link } from "@/components/localized-link";
import { useSiteConfig } from "@/components/site-provider";
import { useI18n } from "@/lib/i18n";
import { ModelPurchaseButton } from "@/components/model-purchase-button";
import { ModelPriceBreakdown } from "@/components/model-price-breakdown";
import { Price } from "@/components/price";
import { resolvePlanPriceBreakdown } from "@/lib/classification";
import { websiteOptions } from "@/lib/website-offer";
import { whatsappLink } from "@/lib/utils";

export function Pricing() {
  const config = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const plan = config.pricing.plans[0];
  if (!plan) return null;

  return <section id="pricing" className="section section-muted">
    <div className="site-container px-4 sm:px-6 lg:px-8">
      <header className="mx-auto max-w-3xl text-center">
        <p className="section-eyebrow justify-center">{ar ? "عرض واحد، خيارات حسب حاجتك" : "One base offer. Only the options you need."}</p>
        <h2 className="section-title">{ar ? "موقعك المخصص ابتداءً من " : "Your personalized website from "}<Price usd={plan.priceUsd ?? 35} /></h2>
        <p className="section-lead">{ar ? "كل التصاميم بنفس السعر. ما يغيّر المبلغ هو الوظائف التي تختارها، وليس مظهر الموقع." : "Every design costs the same. Your selected functions change the price — not the appearance of your site."}</p>
      </header>

      <div className="mx-auto mt-10 grid max-w-6xl items-start gap-6 lg:grid-cols-2">
        <article className="rounded-[var(--radius-lg)] border border-[var(--accent)] bg-[var(--card)] p-6 shadow-[var(--shadow-md)] sm:p-8">
          <Code2 className="h-7 w-7 text-[var(--accent)]" aria-hidden="true" />
          <h3 className="mt-4 text-2xl font-black">{ar ? "موقع بدون قاعدة بيانات" : "Website without a database"}</h3>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">{ar ? "دفعة واحدة — مثالي للتعريف بنشاطك وخدماتك أو عرض قائمة ومنتجات ثابتة." : "One-time payment — ideal for your business, services, a menu or a static product catalog."}</p>
          <div className="my-6 rounded-2xl bg-[var(--secondary)]/50 p-4"><ModelPriceBreakdown breakdown={resolvePlanPriceBreakdown(plan)} /></div>
          <ul className="space-y-3">{(ar ? plan.features : plan.featuresEn).map(feature => <li key={feature} className="flex gap-3 text-sm leading-6"><Check className="mt-1 h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" /><span>{feature}</span></li>)}</ul>
          <ModelPurchaseButton plan={plan} className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-center text-sm font-black text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]" />
          <Link href="/demos" className="mt-4 flex min-h-11 items-center justify-center gap-2 text-sm font-bold underline underline-offset-4">{ar ? "اختر تصميمك من المعرض" : "Choose your design in the gallery"}<ArrowUpRight className="h-4 w-4" /></Link>
        </article>

        <article id="website-options" className="scroll-mt-24 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
          <Database className="h-7 w-7 text-[var(--accent)]" aria-hidden="true" />
          <h3 className="mt-4 text-2xl font-black">{ar ? "أضف اللغات ووظائف الإدارة" : "Add languages and management tools"}</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{ar ? "وظائف الإدارة تستخدم قاعدة بيانات ولوحة إدارة آمنة مشتركة. كل وحدة تشمل شاشاتها اللازمة، دون احتساب البنية الأساسية مرتين. إضافة لغة وحدها لا تتطلب قاعدة بيانات." : "Management modules use a shared database and secure admin panel. Each module includes its required screens, without charging for the foundation twice. A language alone does not require a database."}</p>
          <ul className="mt-5 divide-y divide-[var(--border)]">{websiteOptions.map(option => <li key={option.id} className="py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="font-bold">{ar ? option.nameAr : option.nameEn}</h4><span className="font-black text-[var(--accent)]">{option.priceUsd == null ? (ar ? "بعرض سعر" : "On quote") : <>{option.from && (ar ? "من " : "From ")}+<Price usd={option.priceUsd} />{option.id === "language" && (ar ? " / لغة" : " / language")}</>}</span></div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{ar ? option.detailAr : option.detailEn}</p>
          </li>)}</ul>
          <a href={whatsappLink(config.whatsapp, ar ? "مرحباً، أريد إضافة خيارات إلى عرض الموقع الأساسي. أرجو تأكيد النطاق والسعر الإجمالي والتكاليف المتكررة قبل الدفع." : "Hello, I would like options for the base website offer. Please confirm the scope, total price and any recurring fees before payment.")} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--accent)] px-5 py-3 text-center text-sm font-bold">{ar ? "حدد خياراتك واطلب عرضاً" : "Discuss your options & get a quote"}</a>
          <p className="mt-3 text-xs leading-6 text-[var(--muted-foreground)]">{ar ? "الدفع المباشر يخص الموقع الأساسي فقط. الخيارات تؤكد في عرض مكتوب قبل فوترتها، ولا تضاف تلقائياً إلى الدفع." : "Direct checkout covers the base website only. Options are confirmed in a written quote before billing and are not automatically added to checkout."}</p>
        </article>
      </div>

      <aside className="mx-auto mt-6 max-w-6xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm leading-7 text-[var(--muted-foreground)]">
        <p className="font-bold text-[var(--foreground)]">{ar ? "الإجمالي = سعر الموقع الأساسي + اللغات الإضافية + الوظائف المختارة، دون تكرار البنية الأساسية." : "Total = base website + additional languages + selected modules, without duplicating the technical foundation."}</p>
        <p className="mt-2">{ar ? "التخصيص المجاني يخص المحتوى المقدم قبل التسليم الأول ضمن النموذج المختار. الصفحات الجديدة وتغيير الهيكل والتعديلات اللاحقة خدمات منفصلة بعد موافقتك. الوظائف الظاهرة في المعاينة، مثل السلة أو التقويم، ليست مفعّلة في العرض الثابت ما لم تُشترَ وحدتها." : "Free personalization covers supplied content before initial delivery within your chosen model. New pages, structural changes and later changes are separate services, subject to your approval. Functions shown in demos, such as carts or calendars, are not activated in the static offer unless the relevant module is purchased."}</p>
        <p className="mt-2">{ar ? "الدومين المخصص غير مشمول. عنوان vercel.app ليس دوميناً خاصاً. مجانية النشر تخضع لأهلية وحدود Vercel، وليست ضمان استضافة مجانية مدى الحياة. أي تكاليف خارجية أو متكررة للاستضافة وقاعدة البيانات والتخزين والإرسال والدفع توضّح قبل الموافقة." : "A custom domain is not included. A vercel.app address is not a custom domain. Free deployment depends on Vercel eligibility and plan limits, not a lifetime hosting guarantee. Any external or recurring hosting, database, storage, messaging and payment costs are disclosed before approval."}</p>
      </aside>
    </div>
  </section>;
}
