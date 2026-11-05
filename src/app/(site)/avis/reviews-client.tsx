"use client";

import { ArrowUpRight, Ban, CheckCircle2, Clock, MessageSquareQuote, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LegalLinks } from "@/components/legal-links";
import type { ReviewLink } from "@/lib/trust";

interface Quote {
  name: string;
  nameEn: string;
  role: string;
  roleEn: string;
  text: string;
  textEn: string;
}

interface Props {
  links: ReviewLink[];
  invitesEnabled: boolean;
  testimonials: Quote[];
  supportEmail: string;
  whatsapp: string;
}

/**
 * Page /avis — transparence sur les avis (arabe + anglais, comme le reste
 * du site public).
 *
 * Elle ne publie **aucune note agrégée** : uniquement les profils réellement
 * configurés (Trustpilot / Google / Scamadviser) et les engagements de
 * traitement. C'est ce qui la rend crédible auprès d'un visiteur méfiant, et
 * c'est aussi la page que citent les e-mails de demande d'avis.
 */
export function ReviewsClient({ links, invitesEnabled, testimonials, supportEmail, whatsapp }: Props) {
  const { locale } = useI18n();
  const ar = locale === "ar";

  const commitments = ar
    ? [
        {
          icon: CheckCircle2,
          title: "نطلب التقييم من كل عميل تمّت خدمته",
          text: "لا نختار العملاء السعداء فقط: كل من استلم طلبه يتلقى نفس الرسالة، بلا استثناء.",
        },
        {
          icon: Ban,
          title: "لا شراء ولا استبدال ولا مكافأة",
          text: "لا خصم ولا كود ولا سحب على تقييم. التقييم مقابل أي مقابل يُحذف من المنصة ويضرّ بنا.",
        },
        {
          icon: Clock,
          title: "ردّ على كل تقييم خلال 48 ساعة",
          text: "بما في ذلك تقييمات النجمتين والنجمة: نردّ علناً، بالوقائع، ونقترح حلاً.",
        },
        {
          icon: ShieldCheck,
          title: "لا نطلب حذف تقييم عميل حقيقي",
          text: "إن كان هناك خلل نُصلحه أو نُعيد المبلغ. الحذف لا يُطلب إلا لتقييم مخالف (ليس عميلاً، أو محتوى مسيء).",
        },
        {
          icon: MessageSquareQuote,
          title: "الدرجة المعروضة تأتي من المنصة، لا منّا",
          text: "أي متوسط تقييم يُنشر على هذا الموقع يُقرأ من منصة خارجية. لا نكتب أي رقم بأيدينا.",
        },
      ]
    : [
        {
          icon: CheckCircle2,
          title: "We ask every served customer for a review",
          text: "Never only the happy ones: the same message goes out with every delivered order, with no sorting.",
        },
        {
          icon: Ban,
          title: "No review is bought, traded or rewarded",
          text: "No discount, no code, no prize draw. A review given in exchange for something is removed by the platform — and it hurts us.",
        },
        {
          icon: Clock,
          title: "A reply to every review within 48 hours",
          text: "Including one- and two-star reviews: we answer publicly, with facts, and offer a solution.",
        },
        {
          icon: ShieldCheck,
          title: "We never ask a real customer to delete their review",
          text: "If something is broken, we fix it or refund it. Only reviews that break the rules (not a customer, abusive content) are reported.",
        },
        {
          icon: MessageSquareQuote,
          title: "The rating shown comes from the platform, not from us",
          text: "Any average published on this site is read from a third-party platform. No number is ever typed in by hand.",
        },
      ];

  const steps = ar
    ? [
        "استلمت طلبك؟ يصلك رابط التقييم في بريد التسليم نفسه.",
        `لم تجد الرابط؟ اكتب لنا على ${supportEmail} ونرسله لك مرة أخرى.`,
        "واجهت مشكلة؟ أخبرنا أولاً: نُصلح أو نُعيد المبلغ، ثم يبقى القرار لك في التقييم.",
      ]
    : [
        "Received your order? The review link is in the delivery e-mail itself.",
        `Can't find the link? Write to ${supportEmail} and we will send it again.`,
        "Something wrong? Tell us first: we fix it or refund it — the review stays entirely your call.",
      ];

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent,#C6A664)]">
          {ar ? "تقييمات العملاء" : "Customer reviews"}
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
          {ar ? "أين تقرأ تقييماتنا وتكتب تقييمك" : "Where to read our reviews and leave yours"}
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-[var(--muted-foreground)]">
          {ar
            ? "نُفضّل أن تحكم بنفسك: نُشير إلى ملفاتنا العامة على منصات التقييم، ونشرح بدقة كيف نتعامل مع كل تقييم — الإيجابي والسلبي."
            : "We would rather you judge for yourself: here are our public profiles on review platforms, and exactly how we handle every review — positive or negative."}
        </p>
      </header>

      {links.length > 0 && (
        <section aria-labelledby="profils">
          <h2 id="profils" className="text-lg font-black tracking-tight">
            {ar ? "ملفاتنا العامة" : "Our public profiles"}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {ar
              ? "روابط مباشرة إلى المنصة نفسها — لا وسيط ولا نسخة منقولة."
              : "Direct links to the platform itself — no middleman, no re-hosted copy."}
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {links.map((link) => (
              <li key={link.platform}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3.5 transition-colors hover:border-[var(--accent,#C6A664)]"
                >
                  <span className="text-sm font-bold">{ar ? link.labelAr : link.labelEn}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="politique">
        <h2 id="politique" className="text-lg font-black tracking-tight">
          {ar ? "سياستنا في التقييمات" : "Our review policy"}
        </h2>
        <ul className="mt-4 space-y-3">
          {commitments.map((item) => (
            <li
              key={item.title}
              className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent,#C6A664)]" aria-hidden />
              <div>
                <p className="text-sm font-bold">{item.title}</p>
                <p className="mt-1 text-[13px] leading-6 text-[var(--muted-foreground)]">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="comment" className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 id="comment" className="text-lg font-black tracking-tight">
          {ar ? "كيف تكتب تقييماً؟" : "How to leave a review"}
        </h2>
        <ol className="mt-3 space-y-2 text-sm leading-7">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent,#C6A664)] text-[11px] font-black text-black">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {!invitesEnabled && (
          <p className="mt-3 text-[12px] text-[var(--muted-foreground)]">
            {ar
              ? "لم نُفعّل بعد إرسال طلبات التقييم الآلية. يمكنك دائماً الكتابة إلينا مباشرة."
              : "Automated review requests are not enabled yet. You can always write to us directly."}
          </p>
        )}
      </section>

      {testimonials.length > 0 && (
        <section aria-labelledby="temoignages">
          <h2 id="temoignages" className="text-lg font-black tracking-tight">
            {ar ? "شهادات منشورة" : "Published testimonials"}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {ar
              ? "نُشرت كما وردت، دون تعديل ودون اختيار. وليست درجة منصة تقييم."
              : "Published as received, without editing or selection. These are not platform ratings."}
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {testimonials.map((item) => (
              <li
                key={`${item.name}-${item.text.slice(0, 12)}`}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <blockquote className="text-[13px] leading-6">
                  “{ar ? item.text : item.textEn || item.text}”
                </blockquote>
                <p className="mt-2 text-[12px] font-bold">
                  {ar ? item.name : item.nameEn || item.name}
                  <span className="font-normal text-[var(--muted-foreground)]">
                    {" — "}
                    {ar ? item.role : item.roleEn || item.role}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-lg font-black tracking-tight">
          {ar ? "تواصل معنا" : "Contact us"}
        </h2>
        <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
          {ar
            ? "أي تقييم أو شكوى تصل إلينا مباشرة تُعالج بنفس الجدية: نجيب خلال 24 ساعة، ونُصلح أو نُعيد المبلغ إن كان الخلل من عندنا."
            : "Any review or complaint sent to us directly gets the same treatment: a reply within 24 hours, and a fix or refund if the fault is ours."}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
          <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
          <a
            className="underline underline-offset-4"
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
        </div>
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <LegalLinks />
        </div>
      </section>
    </div>
  );
}
