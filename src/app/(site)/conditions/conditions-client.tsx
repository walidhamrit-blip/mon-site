"use client";

import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";

interface Section {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

const CONTENT: Record<"ar" | "en", { title: string; updated: string; intro: string; sections: Section[]; contactTitle: string; contactText: string }> = {
  ar: {
    title: "شروط الخدمة",
    updated: "آخر تحديث: 24/10/2026",
    intro:
      "تحدد هذه الشروط الأحكام التي تنظم العلاقة بين نخبة Nukhba Studio («نخبة») وكل عميل يطلب موقعاً إلكترونياً أو يشترك في إحدى باقاتنا عبر هذا الموقع.",
    sections: [
      {
        title: "1. الأسعار والدفع",
        items: [
          "الأسعار معروضة بالدولار الأمريكي (USD).",
          "يتم الدفع بالعملات الرقمية عبر بوابة NOWPayments، وتُحتسب المبالغ بالدولار وتُدفع بنفس القيمة بـ USDT (1 USD = 1 USDT) أو بعملات أخرى يدعمها البوابة.",
          "يُعتبر الطلب مؤكداً بعد استلام الدفعة المطلوبة (العربون أو أول دفعة للاشتراك).",
        ],
      },
      {
        title: "2. الحجز والعربون",
        items: [
          "الحجز يتطلب دفع عربون يُخصم من إجمالي المشروع.",
          "لا يُسترد العربون بعد بدء العمل، إلا في حال تقصير ثابت من نخبة.",
        ],
      },
      {
        title: "3. الاشتراكات",
        items: [
          "الاشتراك الشهري يتجدد كل 30 يوماً، والاشتراك السنوي كل 365 يوماً.",
          "يصلك بالبريد الإلكتروني رابط الدفع لكل تجديد، ونرسل لك تذكيراً قبل ثلاثة أيام من موعده.",
          "فترة السماح بعد موعد الاستحقاق لا تتجاوز 5 أيام، وفق قواعد بوابة الدفع. بعد انتهائها يُعلَّق الاشتراك، ويمكنك الاشتراك من جديد في أي وقت.",
          "يمكنك إلغاء اشتراكك في أي وقت من صفحة متابعة الاشتراك. يبقى الوصول مفتوحاً حتى نهاية الفترة المدفوعة، دون استرداد للفترة الجارية.",
        ],
      },
      {
        title: "4. النطاق والاستضافة",
        paragraphs: [
          "تحدد عروض الأسعار والاتفاق الكتابي من يملك اسم النطاق (الدومين) والاستضافة، ومن يدفع تكلفة تجديدهما.",
        ],
      },
      {
        title: "5. الملكية الفكرية",
        items: [
          "تنتقل ملكية الموقع إلى العميل بعد السداد الكامل للمستحقات. قبل ذلك، تحتفظ نخبة بحقوق الموقع وكوده.",
          "يحق لنخبة الإشارة إلى المشروع في مراجعها، ما لم يُتفق على خلاف ذلك كتابياً.",
        ],
      },
      {
        title: "6. التزامات العميل",
        items: [
          "تزويد نخبة بالمحتوى اللازم (النصوص والصور والشعار والبيانات) في الوقت المتفق عليه.",
          "يضمن العميل أن المحتوى الذي يقدمه لا ينتهك حقوق الغير.",
        ],
      },
      {
        title: "7. المراجعة والتسليم",
        items: [
          "تُعرض على العميل نسخة تجريبية للمراجعة، وتُنفَّذ التعديلات المتفق عليها في عرض السعر.",
          "يُعتبر الموقع مقبولاً إذا لم يرسل العميل ملاحظاته خلال 7 أيام من عرض النسخة التجريبية.",
        ],
      },
      {
        title: "8. حدود المسؤولية",
        paragraphs: [
          "تبذل نخبة عنايتها المعقولة في تقديم الخدمة، ولا تتحمل الخسائر غير المباشرة. وتقتصر مسؤوليتها على المبلغ المدفوع عن الخدمة المعنية.",
        ],
      },
      {
        title: "9. البيانات الشخصية",
        paragraphs: [
          "نستخدم بياناتك (الاسم والبريد الإلكتروني والهاتف) لتقديم الخدمة والتواصل معك بشأنها فقط، ولا نبيعها لأي طرف ثالث.",
        ],
      },
      {
        title: "10. تعديل الشروط",
        paragraphs: [
          "قد نحدّث هذه الشروط. يسري التعديل عند نشره على هذه الصفحة.",
        ],
      },
      {
        title: "11. القانون المطبق والاختصاص",
        paragraphs: [
          "تخضع هذه الشروط للقانون الليبي، ويكون الاختصاص لمحاكم طرابلس.",
        ],
      },
    ],
    contactTitle: "12. التواصل",
    contactText: "للاستفسار عن هذه الشروط راسلنا على البريد الإلكتروني أو عبر واتساب.",
  },
  en: {
    title: "Terms of Service",
    updated: "Last updated: October 24, 2026",
    intro:
      "These terms set out the rules that govern the relationship between Nukhba Studio (\"Nukhba\") and each client who orders a website or subscribes to one of our plans through this site.",
    sections: [
      {
        title: "1. Prices and payment",
        items: [
          "Prices are shown in US dollars (USD).",
          "Payments are made in cryptocurrency through the NOWPayments gateway; amounts are priced in USD and paid at the same value in USDT (1 USD = 1 USDT) or another supported coin.",
          "An order is confirmed once the required payment (deposit or first subscription payment) is received.",
        ],
      },
      {
        title: "2. Booking and deposit",
        items: [
          "Booking requires a deposit, which is deducted from the total project price.",
          "The deposit is not refunded once work has started, unless Nukhba is clearly at fault.",
        ],
      },
      {
        title: "3. Subscriptions",
        items: [
          "Monthly subscriptions renew every 30 days, and annual subscriptions every 365 days.",
          "A payment link for each renewal is sent to you by e-mail, and we send you a reminder three days before the renewal date.",
          "The grace period after the due date lasts at most 5 days, in line with the payment gateway's rules. After it ends, the subscription is suspended, and you can subscribe again at any time.",
          "You can cancel your subscription at any time from the subscription tracking page. Access remains open until the end of the paid period. The current period is not refunded.",
        ],
      },
      {
        title: "4. Domain name and hosting",
        paragraphs: [
          "The quote and the written agreement state who owns the domain name and the hosting, and who pays for their renewal.",
        ],
      },
      {
        title: "5. Intellectual property",
        items: [
          "Ownership of the website passes to the client once all amounts due have been paid in full. Until then, Nukhba keeps the rights to the website and its code.",
          "Nukhba may mention the project in its portfolio, unless otherwise agreed in writing.",
        ],
      },
      {
        title: "6. Client obligations",
        items: [
          "The client provides the content Nukhba needs (texts, images, logo and information) on the agreed timeline.",
          "The client warrants that the content provided does not infringe the rights of third parties.",
        ],
      },
      {
        title: "7. Review and delivery",
        items: [
          "The client reviews a test version of the website, and the changes agreed in the quote are carried out.",
          "The website is deemed accepted if the client sends no feedback within 7 days of the test version being shared.",
        ],
      },
      {
        title: "8. Limitation of liability",
        paragraphs: [
          "Nukhba takes reasonable care in providing its services and is not liable for indirect losses. Its liability is limited to the amount paid for the service concerned.",
        ],
      },
      {
        title: "9. Personal data",
        paragraphs: [
          "We use your data (name, e-mail and phone number) only to provide the service and to contact you about it. We do not sell it to any third party.",
        ],
      },
      {
        title: "10. Changes to these terms",
        paragraphs: [
          "We may update these terms. Changes take effect when they are published on this page.",
        ],
      },
      {
        title: "11. Governing law and jurisdiction",
        paragraphs: [
          "These terms are governed by Libyan law, and the courts of Tripoli have jurisdiction.",
        ],
      },
    ],
    contactTitle: "12. Contact",
    contactText: "For questions about these terms, contact us by e-mail or on WhatsApp.",
  },
};

export function ConditionsClient() {
  const { locale } = useI18n();
  const siteConfig = useSiteConfig();
  const ar = locale === "ar";
  const content = CONTENT[ar ? "ar" : "en"];

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-black">{content.title}</h1>
        <p className="text-sm text-[var(--muted-foreground)]">{content.updated}</p>
        <p className="text-[var(--muted-foreground)] leading-relaxed">{content.intro}</p>
      </header>

      {content.sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-xl font-black">{section.title}</h2>
          {section.paragraphs?.map((p) => (
            <p key={p} className="leading-relaxed">
              {p}
            </p>
          ))}
          {section.items && (
            <ul className="list-disc space-y-2 ps-6 leading-relaxed">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-xl font-black">{content.contactTitle}</h2>
        <p className="leading-relaxed">{content.contactText}</p>
        <ul className="space-y-1 text-sm">
          <li>
            E-mail: <a href={`mailto:${siteConfig.email}`} dir="ltr" className="underline">{siteConfig.email}</a>
          </li>
          <li>
            {ar ? "الهاتف" : "Phone"}:{" "}
            <a href={`tel:${siteConfig.phone.replace(/\s/g, "")}`} dir="ltr" className="underline">
              {siteConfig.phone}
            </a>
          </li>
        </ul>
      </section>
    </article>
  );
}
