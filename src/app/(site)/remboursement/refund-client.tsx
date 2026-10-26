"use client";

import { useI18n } from "@/lib/i18n";
import { LegalLinks } from "@/components/legal-links";
import { ProfessionalContact } from "@/components/professional-contact";

const content = {
  ar: {
    title: "سياسة الاسترداد",
    updated: "آخر تحديث: 26 أكتوبر 2026",
    intro: "توضح هذه السياسة قواعد استرداد المدفوعات لدى نخبة، وتُقرأ مع الشروط العامة للبيع والاتفاق الكتابي الخاص بطلبك.",
    sections: [
      ["الحجز والعربون", "يُخصم العربون من إجمالي سعر المشروع. لا يُسترد بعد بدء العمل، إلا في حال تقصير ثابت من نخبة."],
      ["الاشتراكات والإلغاء", "يمكنك إلغاء الاشتراك في أي وقت من صفحة متابعة الاشتراك. يبقى الوصول متاحاً حتى نهاية الفترة المدفوعة، ولا تُسترد قيمة الفترة الجارية."],
      ["عدم تقديم الخدمة المتفق عليها", "إذا لم تُقدَّم الخدمة وفق المواصفات المتفق عليها، تنطبق ضمانة الاسترداد الكامل المعلنة على الموقع. تواصل معنا مع تفاصيل الاتفاق والمشكلة حتى نراجع الطلب."],
      ["كيفية تقديم طلب", "راسلنا عبر البريد الإلكتروني أو واتساب أدناه مع مرجع الطلب، والبريد المستخدم للشراء، وتاريخ الدفع، والمبلغ، ومرجع المعاملة وسبب طلب الاسترداد. لا ترسل كلمات مرور أو مفاتيح خاصة أو عبارة استرداد محفظتك."],
      ["مراجعة الطلب وإعادة المبلغ", "نراجع الطلب استناداً إلى الاتفاق وحالة تنفيذ الخدمة، ونبلغك بالنتيجة عبر قنوات التواصل المهنية. عند الموافقة، نؤكد معك طريقة إعادة المبلغ والمدة المتوقعة وفق وسيلة الدفع وبوابة الدفع. لا تحدد الشروط الحالية مهلة ثابتة للمعالجة."],
    ],
  },
  en: {
    title: "Refund policy",
    updated: "Last updated: October 26, 2026",
    intro: "This policy explains Nukhba’s existing refund rules. Read it alongside our terms and conditions of sale and the written agreement for your order.",
    sections: [
      ["Bookings and deposits", "Your deposit is deducted from the total project price. It is not refundable once work has started, unless Nukhba is clearly at fault."],
      ["Subscriptions and cancellation", "You can cancel at any time from your subscription tracking page. Access remains available until the end of the paid period. The current period is not refunded."],
      ["Failure to deliver the agreed service", "If the service is not delivered to the agreed specifications, the full-refund guarantee advertised on this site applies. Contact us with the agreement and details of the issue so we can review your request."],
      ["How to request a refund", "Contact us by e-mail or WhatsApp below. Include your order reference, purchase e-mail, payment date, amount, transaction reference and reason for requesting a refund. Never send passwords, private keys or a wallet recovery phrase."],
      ["Review and repayment", "We review requests against the agreement and the service’s delivery status, and communicate the outcome through our professional channels. If approved, we confirm the refund method and expected timing with you based on the payment method and gateway. The existing terms do not specify a fixed processing deadline."],
    ],
  },
};

export function RefundClient() {
  const { locale } = useI18n();
  const copy = content[locale === "ar" ? "ar" : "en"];
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-black">{copy.title}</h1>
        <p className="text-sm text-[var(--muted-foreground)]">{copy.updated}</p>
        <p className="leading-relaxed">{copy.intro}</p>
      </header>
      <LegalLinks />
      {copy.sections.map(([title, text]) => (
        <section key={title} className="space-y-3">
          <h2 className="text-xl font-black">{title}</h2>
          <p className="leading-relaxed">{text}</p>
        </section>
      ))}
      <ProfessionalContact />
    </article>
  );
}
