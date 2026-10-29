import Link from "next/link";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/utils";

/**
 * Bandeau affiché quand la boutique est **techniquement indisponible**.
 *
 * Incident du 29/10/2026 : quota de calcul Neon épuisé → base suspendue →
 * le catalogue retombait silencieusement sur 8 fiches de démonstration
 * périmées, présentées comme le catalogue réel. Un visiteur ne pouvait rien
 * acheter (les commandes ne s'enregistrent pas sans base) et n'en était pas
 * informé : il repartait en croyant la boutique vide.
 *
 * Ce bandeau est rendu côté serveur (aucun JavaScript requis) : il reste
 * utile même si l'hydratation échoue.
 */
export function StoreUnavailableNotice({
  ar,
  phone,
  compact = false,
}: {
  ar: boolean;
  phone: string;
  /** Version resserrée, pour les pages produit. */
  compact?: boolean;
}) {
  const message = ar
    ? "مرحبا نخبة 👋\nالمتجر في صيانة تقنية مؤقتة — أريد إتمام طلب."
    : "Hello Nukhba 👋\nThe store is under short maintenance — I would like to complete an order.";

  return (
    <div
      role="status"
      className={
        compact
          ? "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--secondary)]/60 p-4"
          : "border-b border-[var(--border)] bg-[var(--secondary)]/60"
      }
    >
      <div
        className={
          compact
            ? "flex flex-col gap-3"
            : "site-container flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
          <div>
            <p className="text-[13.5px] font-black leading-6">
              {ar
                ? "المتجر متوقف مؤقتاً للصيانة"
                : "The store is temporarily under maintenance"}
            </p>
            <p className="mt-1 text-[12.5px] leading-6 text-[var(--muted-foreground)]">
              {ar
                ? "لا يمكن إتمام الطلب من الموقع الآن. اكتب لنا على واتساب وسنكمل طلبك يدوياً خلال اليوم — التسليم يبقى فورياً بعد الدفع."
                : "Orders cannot be completed on the site right now. Message us on WhatsApp and we will complete your order manually today — delivery stays instant after payment."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <a
            href={whatsappLink(phone, message)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-[12.5px] font-black text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {ar ? "اطلب على واتساب" : "Order on WhatsApp"}
          </a>
          <Link
            href="/contact"
            className="inline-flex h-9 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-3.5 text-[12.5px] font-bold transition-colors hover:border-[var(--accent)]"
          >
            {ar ? "قنوات التواصل" : "Contact channels"}
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Page affichée à la place d'une fiche produit pendant la panne.
 *
 * Volontairement rendue en **404** (comportement déjà en place) : une fiche
 * absente ne doit pas répondre 200 avec un contenu différent, Google
 * interpréterait cela comme une page remplacée. Le message, lui, explique
 * la situation au visiteur et l'envoie vers WhatsApp.
 */
export function StoreUnavailableProduct({
  ar,
  phone,
}: {
  ar: boolean;
  phone: string;
}) {
  const message = ar
    ? "مرحبا نخبة 👋\nأريد منتجاً من المتجر، لكن الرابط لا يعمل."
    : "Hello Nukhba 👋\nI want a product from the store, but the link does not work.";

  return (
    <div className="site-container px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[46rem]">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
          {ar ? "صيانة مؤقتة" : "Temporary maintenance"}
        </p>
        <h1 className="mt-3 text-[clamp(1.6rem,1.1rem+2vw,2.4rem)] font-black leading-[1.1] tracking-[-0.03em]">
          {ar
            ? "هذا المنتج غير متاح للحظة — المتجر في صيانة"
            : "This product is unavailable for now — the store is under maintenance"}
        </h1>
        <p className="mt-4 text-[14px] leading-7 text-[var(--muted-foreground)]">
          {ar
            ? "المنتج موجود في كتالوجنا، لكن الطلب من الموقع متوقف مؤقتاً (صيانة تقنية). اكتب لنا على واتساب مع اسم المنتج والمبلغ والمنطقة، وسنكمل الطلب يدوياً ونرسل الكود إلى بريدك بعد الدفع."
            : "The product is still in our catalogue, but ordering on the site is paused for a short technical maintenance. Message us on WhatsApp with the product, amount and region — we will complete the order manually and email the code after payment."}
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <a
            href={whatsappLink(phone, message)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[13px] font-black text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {ar ? "اطلب على واتساب" : "Order on WhatsApp"}
          </a>
          <Link
            href="/codes"
            className="inline-flex h-10 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-5 text-[13px] font-bold transition-colors hover:border-[var(--accent)]"
          >
            {ar ? "تصفّح المتجر" : "Browse the store"}
          </Link>
        </div>
      </div>
    </div>
  );
}
