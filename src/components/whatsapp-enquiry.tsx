"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { whatsappLink } from "@/lib/utils";
import { buildEnquiryMessage, publicEnquiryPage } from "@/lib/whatsapp-enquiry";

/**
 * Fenêtre « Continuer vers WhatsApp ».
 *
 * ⚠️ Correctif : ce bloc était un `<form action="https://wa.me/…" method="get">`.
 * La politique de sécurité du site (`next.config.ts`) impose
 * `form-action 'self'` : un formulaire n'a le droit d'envoyer ses données que
 * vers le site lui-même. Le navigateur bloquait donc silencieusement l'envoi
 * vers wa.me — le bouton « Continuer vers WhatsApp » ne faisait plus rien
 * (bouton flottant, menu, pied de page, page contact, chatbot : tous touchés).
 *
 * On n'assouplit pas la CSP : WhatsApp est ouvert par un simple LIEN, dont
 * l'adresse est recalculée à chaque frappe (`href`). Une navigation n'est pas
 * concernée par `form-action`, et le lien reste « ouvrable dans un nouvel
 * onglet » au clic du milieu, ce qu'un formulaire ne permettait pas.
 */
export function WhatsAppEnquiry({ children, className, ariaLabel, initialSubject = "" }: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  initialSubject?: string;
}) {
  const { locale } = useI18n();
  const { whatsapp } = useSiteConfig();
  const ar = locale === "ar";
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const subjectId = useId();
  const [subject, setSubject] = useState(initialSubject);
  const [page, setPage] = useState<ReturnType<typeof publicEnquiryPage>>(null);

  function open() {
    setSubject(initialSubject);
    setPage(publicEnquiryPage(window.location.pathname, document.title));
    dialog.current?.showModal();
  }

  const blocked = !subject.trim();
  const link = whatsappLink(whatsapp, buildEnquiryMessage(locale, subject, page));

  return <>
    <button type="button" onClick={open} aria-label={ariaLabel} title={ariaLabel} className={className}>{children}</button>
    <dialog ref={dialog} aria-labelledby={titleId} onKeyDown={(event) => event.stopPropagation()} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-[var(--foreground)] shadow-2xl backdrop:bg-black/60">
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="text-lg font-bold">{ar ? "كيف يمكننا مساعدتك؟" : "How can we help?"}</h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label={ar ? "إغلاق" : "Close"} className="rounded p-1"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-4">
        <label htmlFor={subjectId} className="block text-sm font-semibold">{ar ? "ما المنتج أو الخدمة أو السؤال الذي تريد الاستفسار عنه؟" : "Which product, service or question would you like to ask about?"}</label>
        <textarea id={subjectId} maxLength={500} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={ar ? "مثال: سعر بطاقة ستيم أو إنشاء متجر إلكتروني..." : "For example: a Steam card price or an online store..."} className="mt-2 min-h-28 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--foreground)]" />
        <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{ar ? "لا ترسل كلمات المرور أو بيانات الدفع الحساسة." : "Please do not share passwords or sensitive payment details."} {page && (ar ? `ستُرفق الصفحة التي تتصفحها: ${page.title || page.path}` : `The page you are viewing will be included: ${page.title || page.path}`)}</p>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={blocked || undefined}
          onClick={(event) => {
            if (blocked) {
              event.preventDefault();
              return;
            }
            dialog.current?.close();
          }}
          className={`mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#0B6B3A] px-5 font-bold text-white ${blocked ? "pointer-events-none opacity-50" : ""}`}
        >
          {ar ? "متابعة إلى واتساب" : "Continue to WhatsApp"}
        </a>
      </div>
    </dialog>
  </>;
}
