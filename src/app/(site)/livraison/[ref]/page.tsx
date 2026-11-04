import type { Metadata } from "next";
import { LocalizedLink as Link } from "@/components/localized-link";
import { pageLocale } from "@/lib/locale-server";
import type { LocalePageProps } from "@/lib/locale";
import { getSiteDataCached } from "@/lib/store";
import { pageMetadata } from "@/lib/seo";
import { resolveMarket } from "@/lib/market";
import { findDeliveryForTracking } from "@/lib/deliveries";
import { DELIVERY_STATUS_LABELS, deliveryAmountLabel } from "@/lib/delivery-kit";
import { AcceptDelivery, PrintReceipt } from "./accept-delivery";

export const dynamic = "force-dynamic";

/**
 * Page de remise d'un projet web — le « procès-verbal de livraison ».
 *
 * Privée par nature : elle n'est joignable qu'avec la référence ET le jeton
 * remis au client, n'apparaît dans aucun sitemap et porte `noindex`.
 * Démarche complète : docs/livraison-site-apres-paiement-2026-11-04.md
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
} & LocalePageProps): Promise<Metadata> {
  const { ref } = await params;
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  return pageMetadata(config, {
    path: `/livraison/${ref}`,
    locale,
    title: locale === "ar" ? "تسليم المشروع" : "Project delivery",
    description:
      locale === "ar"
        ? "ملخص التسليم والروابط والعناصر المسلّمة واعتماد الاستلام."
        : "Delivery summary, links, delivered items and acceptance.",
    noindex: true,
  });
}

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function DeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
} & LocalePageProps) {
  const { ref } = await params;
  const query = await searchParams;
  const { config } = await getSiteDataCached();
  const locale = await pageLocale(config, searchParams);
  const ar = locale === "ar";
  const market = resolveMarket(config.market);

  // Sans base (déploiement dégradé, quota épuisé…) on n'affiche JAMAIS
  // « lien invalide » : ce serait un mensonge qui ferait douter le client
  // d'un dossier parfaitement valide. On dit que le service est indisponible.
  let view: Awaited<ReturnType<typeof findDeliveryForTracking>> = null;
  let dbError = false;
  try {
    view = await findDeliveryForTracking(ref, first(query.t) ?? first(query.token));
  } catch (error) {
    dbError = true;
    console.error(
      "[livraison] lecture impossible :",
      error instanceof Error ? error.message : error,
    );
  }

  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: market.timezone,
  });
  const format = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");
  const whatsapp = `https://wa.me/${config.whatsapp.replace(/\D/g, "")}`;

  if (!view) {
    return (
      <main className="pt-6 min-h-[70vh]">
        <div className="mx-auto max-w-[720px] px-4 py-16 space-y-4 text-center">
          <h1 className="text-2xl font-black">
            {dbError
              ? ar
                ? "الخدمة غير متاحة مؤقتاً"
                : "Temporarily unavailable"
              : ar
                ? "رابط غير صالح"
                : "Invalid link"}
          </h1>
          <p className="text-[var(--muted-foreground)]">
            {dbError
              ? ar
                ? "لا يمكننا عرض ملف التسليم الآن. أعد المحاولة بعد قليل أو تواصل معنا."
                : "We cannot display this delivery record right now. Please retry shortly or contact us."
              : ar
                ? "رابط التسليم غير صحيح أو منتهٍ. تحقق من الرابط الذي وصلك، أو تواصل معنا."
                : "This delivery link is invalid or expired. Check the link you received, or contact us."}
          </p>
          <Link href="/contact" className="inline-block underline">
            {ar ? "اتصل بنا" : "Contact us"}
          </Link>
        </div>
      </main>
    );
  }

  const accepted = view.status === "accepted";
  const status = DELIVERY_STATUS_LABELS[view.status];

  return (
    <main className="pt-6 min-h-[70vh]">
      <div className="mx-auto max-w-[820px] px-4 sm:px-6 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-sm text-[var(--muted-foreground)]" dir="ltr">
            {view.ref}
          </p>
          <h1 className="text-3xl font-black">{view.projectTitle}</h1>
          <p className={`text-lg font-bold ${accepted ? "text-emerald-500" : "text-amber-500"}`}>
            {ar ? status.ar : status.en}
          </p>
        </header>

        <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-[var(--muted-foreground)]">{ar ? "العميل" : "Client"}</div>
            <div className="font-bold">{view.clientName}</div>
          </div>
          {view.amountUsd && (
            <div>
              <div className="text-[var(--muted-foreground)]">{ar ? "المبلغ" : "Amount"}</div>
              <div className="font-bold" dir="ltr">
                {deliveryAmountLabel(view.amountUsd)}
              </div>
            </div>
          )}
          <div>
            <div className="text-[var(--muted-foreground)]">{ar ? "تاريخ التسليم" : "Delivered on"}</div>
            <div className="font-bold">{format(view.deliveredAt)}</div>
          </div>
          <div>
            <div className="text-[var(--muted-foreground)]">
              {ar ? `الضمان (${view.warrantyDays} يوماً)` : `Warranty (${view.warrantyDays} days)`}
            </div>
            <div className="font-bold">
              {ar ? "حتى" : "until"} {format(view.warrantyEndsAt)}
            </div>
          </div>
          {view.emailMasked && (
            <div className="sm:col-span-2">
              <div className="text-[var(--muted-foreground)]">{ar ? "البريد الإلكتروني" : "E-mail"}</div>
              <div className="font-bold" dir="ltr">
                {view.emailMasked}
              </div>
            </div>
          )}
        </section>

        {view.links.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-black">
              {ar ? "الروابط المسلّمة" : "Delivered links"}
            </h2>
            <ul className="space-y-2">
              {view.links.map((link, index) => (
                <li
                  key={`${link.url}-${index}`}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--secondary)]/30 p-3 text-sm"
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-bold text-[var(--accent)] underline underline-offset-4 break-all"
                  >
                    {link.label || link.url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {view.checklist.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-black">
              {ar ? "العناصر المسلّمة" : "Delivered items"}
            </h2>
            <ul className="space-y-2 text-sm">
              {view.checklist.map((item, index) => (
                <li key={`${item.label}-${index}`} className="flex gap-3">
                  <span aria-hidden className="text-[var(--accent)]">
                    ✓
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {accepted ? (
          <section className="rounded-[24px] border border-emerald-500/40 bg-emerald-500/10 p-6 space-y-3">
            <h2 className="text-lg font-black text-emerald-500">
              {ar ? "تم اعتماد الاستلام" : "Delivery accepted"}
            </h2>
            <p className="text-sm">
              {ar ? "اعتمد الاستلام" : "Accepted by"} <strong>{view.acceptedByName ?? view.clientName}</strong>{" "}
              {ar ? "بتاريخ" : "on"} <strong>{format(view.acceptedAt)}</strong>.
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              {ar
                ? `الضمان ساري حتى ${format(view.warrantyEndsAt)} : نصلّح أي خلل في ما تم تسليمه دون تكلفة إضافية.`
                : `Warranty runs until ${format(view.warrantyEndsAt)}: any defect in what was delivered is fixed at no extra cost.`}
            </p>
            <PrintReceipt />
          </section>
        ) : (
          <AcceptDelivery reference={view.ref} token={first(query.t) ?? first(query.token) ?? ""} />
        )}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--secondary)]/30 p-4 text-sm space-y-2">
          <p>
            {ar
              ? "سؤال أو تعديل؟ راسلنا على واتساب مع ذكر المرجع، أو اتصل بنا."
              : "A question or a change? Message us on WhatsApp with your reference, or call us."}
          </p>
          <p className="text-[var(--muted-foreground)]">
            {ar ? "المرجع" : "Reference"}: <span dir="ltr">{view.ref}</span> · {config.email}
          </p>
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center rounded-2xl border border-[var(--border)] px-4 py-2 font-bold"
          >
            {ar ? "واتساب" : "WhatsApp"}
          </a>
        </section>
      </div>
    </main>
  );
}
