"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  BellRing,
  Check,
  ChevronLeft,
  Clock,
  Globe2,
  ShieldCheck,
  ShoppingBag,
  Tag,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSiteConfig } from "@/components/site-provider";
import { Price } from "@/components/price";
import { whatsappLink } from "@/lib/utils";
import {
  DIGITAL_KIND_LABELS,
  DIGITAL_STATUS_LABELS,
  denominationLabel,
  isSellable,
  regionLabel,
  type DigitalProduct,
} from "@/lib/digital-types";
import { DigitalBuyDialog } from "@/components/digital-buy-dialog";
import { RegionalAlert } from "@/components/regional-alert";
import { gamePlatformSummary } from "@/lib/digital-platform-core";
import { productVisual } from "@/lib/game-covers";

/**
 * Fiche d'un produit du catalogue digital.
 *
 * Une fiche `available` est VENDABLE À LA COMMANDE : le client choisit un
 * montant, paie en crypto, et le code est acheté chez notre fournisseur
 * puis livré dès la confirmation du paiement (aucun stock acheté
 * d'avance). Les fiches `coming_soon` restent en liste d'attente.
 */
export function DigitalProductDetails({ product }: { product: DigitalProduct }) {
  const siteConfig = useSiteConfig();
  const { locale } = useI18n();
  const ar = locale === "ar";
  const features = ar ? product.featuresAr : product.featuresEn;
  const available = product.denominations.filter((denomination) => denomination.available);
  const sellable = isSellable(product);
  const [buyDenomination, setBuyDenomination] = useState<string | null>(null);
  // Plateforme du jeu + identifiant demandé (fiches de recharge uniquement).
  // Jaquette : l'image de la fiche (admin) sinon la couverture locale du jeu.
  const visual = productVisual(product);
  const platformSummary = gamePlatformSummary({
    name: product.platform,
    platform: product.platform,
    fields:
      product.denominations.find((denomination) => denomination.fields?.length)?.fields ??
      null,
  });

  const waitlistMessage = ar
    ? `مرحبا نخبة 👋 أرغب في «${product.titleAr}» (${product.platform}). أرجو إشعارني عند فتح البيع أو إرسال طلب مخصص.`
    : `Hello Nukhba 👋 I'd like "${product.titleEn}" (${product.platform}). Please notify me when sales open, or prepare a custom order.`;

  return (
    <div className="pt-6">
      <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <Link
            href="/codes"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--muted-foreground)] transition-colors hover:text-[var(--accent)]"
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {ar ? "كل الأكواد والبطاقات" : "All codes & cards"}
          </Link>

          <div className="mt-5 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div>
              {visual && (
                <div className="relative mb-6 aspect-[16/9] max-h-[380px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[#0b1220] shadow-[var(--shadow-sm)]">
                  <Image
                    src={visual}
                    alt={ar ? `صورة ${product.titleAr}` : `${product.titleEn} product visual`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 58vw"
                    quality={88}
                    priority
                    className="object-cover"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10"
                  />
                  <span className="absolute bottom-4 start-4 rounded-full border border-white/25 bg-black/55 px-3 py-1 text-[11px] font-black text-white backdrop-blur-md">
                    {product.platform}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="grid h-14 w-14 place-items-center rounded-2xl text-[17px] font-black text-white shadow-[var(--shadow-sm)]"
                  style={{ backgroundColor: product.color }}
                >
                  {product.platform.slice(0, 2).toUpperCase()}
                </span>
                <span className="chip chip-accent">
                  <Tag className="h-3 w-3" />
                  {ar ? DIGITAL_KIND_LABELS[product.kind].ar : DIGITAL_KIND_LABELS[product.kind].en}
                </span>
                <span className="chip">
                  <Clock className="h-3 w-3" />
                  {ar
                    ? DIGITAL_STATUS_LABELS[product.status].ar
                    : DIGITAL_STATUS_LABELS[product.status].en}
                </span>
              </div>

              <h1 className="mt-5 text-[clamp(1.7rem,1.1rem+2.2vw,2.6rem)] font-black leading-[1.1] tracking-[-0.03em] text-balance">
                {ar ? product.titleAr : product.titleEn}
              </h1>
              <p className="mt-1.5 text-[13.5px] font-bold text-[var(--muted-foreground)]">
                {product.platform}
              </p>
              <p className="mt-4 max-w-[62ch] text-[15px] leading-8 text-[var(--muted-foreground)]">
                {ar ? product.descriptionAr : product.descriptionEn}
              </p>

              {/* Recharge : la fiche doit dire sur quelle plateforme la recharge
                  s'applique et quel identifiant saisir. Un identifiant d'un
                  autre jeu crédite un inconnu, sans retour possible. */}
              {product.kind === "game_topup" && (
                <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-[10.5px] font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                        {ar ? "المنصة" : "Platform"}
                      </div>
                      <div className="mt-1 text-[14px] font-black">
                        {platformSummary.platform[locale]}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-black uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                        {ar ? "المعرّف المطلوب" : "ID required"}
                      </div>
                      <div className="mt-1 text-[14px] font-black" dir="ltr">
                        {platformSummary.accountFields.length > 0
                          ? platformSummary.accountFields.join(" / ")
                          : "—"}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-[12.5px] leading-6 text-[var(--muted-foreground)]">
                    {ar
                      ? `الشحن يُطبَّق مباشرة على حساب اللاعب في « ${platformSummary.platform.ar} ». معرّف لعبة أو منصة أخرى لا يمكن استرجاعه بعد الشحن.`
                      : `The top-up is applied directly to your player account in ${platformSummary.platform.en}. An ID from another game or platform cannot be reversed once credited.`}
                  </p>
                </div>
              )}

              {features.length > 0 && (
                <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm leading-6">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="opacity-85">{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Carte strictement régionale : avertissement en tête de fiche,
                  avant les montants et avant tout achat. */}
              <RegionalAlert regions={product.regions} className="mt-5" />

              {product.regions.length > 0 && (
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--muted-foreground)]">
                    <Globe2 className="h-3.5 w-3.5 text-[var(--accent)]" />
                    {ar ? "المناطق المتاحة" : "Available regions"}
                  </span>
                  {product.regions.map((region) => (
                    <span
                      key={region}
                      className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-bold text-[var(--muted-foreground)]"
                    >
                      {regionLabel(region, locale)}
                    </span>
                  ))}
                </div>
              )}

              {(product.deliveryNoteAr || product.deliveryNoteEn) && (
                <p className="mt-6 flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4 text-[13px] leading-6 text-[var(--muted-foreground)]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                  {ar ? product.deliveryNoteAr : product.deliveryNoteEn}
                </p>
              )}
            </div>

            {/* Panneau des dénominations */}
            <aside className="card-surface p-6">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                {ar ? "المبالغ المتاحة" : "Available amounts"}
              </div>

              <RegionalAlert regions={product.regions} compact className="mt-3" />

              {available.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {available.map((denomination) => (
                    <li
                      key={denomination.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 px-4 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block text-[14px] font-black" dir="ltr">
                          {denominationLabel(denomination, locale)}
                        </span>
                        <span className="block text-[11px] text-[var(--muted-foreground)]">
                          {regionLabel(denomination.region, locale)}
                          {/* Carte non-USD : on écrit la valeur faciale réelle,
                              sinon « TRY 500 » ressemble à 500 dollars. */}
                          {denomination.faceCurrency &&
                            denomination.faceCurrency.toUpperCase() !== "USD" && (
                              <span className="ms-1.5 font-bold text-[var(--foreground)]">
                                · {denomination.faceValue}
                              </span>
                            )}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2.5">
                        <span className="text-[15px] font-black text-[var(--accent)]">
                          <Price usd={denomination.priceUsd} />
                        </span>
                        {sellable && (
                          <button
                            type="button"
                            onClick={() => setBuyDenomination(denomination.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--accent)] px-3 text-[11.5px] font-black text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
                          >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            {ar ? "شراء" : "Buy"}
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[13px] text-[var(--muted-foreground)]">
                  {ar
                    ? "المبالغ ستُعلن عند فتح البيع."
                    : "Amounts will be announced when sales open."}
                </p>
              )}

              {sellable ? (
                <button
                  type="button"
                  onClick={() => setBuyDenomination(available[0]?.id ?? null)}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-black text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-hover)]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {ar ? "اشترِ الآن — تسليم إلكتروني" : "Buy now — instant delivery"}
                </button>
              ) : (
                <a
                  href={whatsappLink(siteConfig.whatsapp, waitlistMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-black text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-hover)]"
                >
                  <BellRing className="h-4 w-4" />
                  {ar ? "أخبرني عند فتح البيع" : "Notify me when it opens"}
                </a>
              )}

              <p className="mt-3 text-center text-[11px] leading-5 text-[var(--muted-foreground)]">
                {ar
                  ? "البيع بالدولار الأمريكي · التسليم إلكتروني بعد تأكيد الدفع."
                  : "Priced in USD — electronic delivery right after payment confirmation."}
              </p>
              {sellable && (
                <p className="mt-2 text-center text-[11px] leading-5 text-[var(--muted-foreground)]">
                  {ar
                    ? "تنبيه: رمز البطاقة صالح فقط في المنطقة المذكورة."
                    : "Note: the code is only valid in the region shown."}
                </p>
              )}

              <Link
                href="/contact"
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-[var(--border)] text-[13px] font-bold transition-colors hover:border-[var(--accent)]"
              >
                {ar ? "اطلب عرض سعر مخصص" : "Request a custom quote"}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </aside>
          </div>
        </div>
      </section>

      {buyDenomination && (
        <DigitalBuyDialog
          product={product}
          denominationId={buyDenomination}
          onClose={() => setBuyDenomination(null)}
        />
      )}
    </div>
  );
}
