"use client";
import { useI18n } from "@/lib/i18n";
import { CTAForm } from "@/components/sections/cta-form";
import { useSiteConfig } from "@/components/site-provider";
import { marketLabels, resolveMarket } from "@/lib/market";
import { ArrowUpRight, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { whatsappLink } from "@/lib/utils";

/**
 * Carte de localisation dessinée localement.
 *
 * L'ancienne version chargeait une photo d'agence depuis Unsplash (souvent
 * bloquée ou lente) et affichait une note de développement « remplacer par
 * une iframe Google Maps ». On affiche désormais un plan schématique net,
 * généré en SVG, plus un lien direct vers Google Maps.
 */
function MapPanel({
  label,
  sublabel,
  address,
}: {
  label: string;
  sublabel: string;
  address: string;
}) {
  const query = encodeURIComponent(address);
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--secondary)]">
      <svg
        aria-hidden="true"
        viewBox="0 0 400 320"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="400" height="320" fill="var(--secondary)" />
        <g stroke="var(--border)" strokeWidth="10" strokeLinecap="round">
          <path d="M-20 90 L420 60" />
          <path d="M-20 210 L420 250" />
          <path d="M90 -20 L60 340" />
          <path d="M275 -20 L320 340" />
        </g>
        <g stroke="var(--accent)" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round">
          <path d="M-20 150 L420 150" />
          <path d="M180 -20 L180 340" />
        </g>
        <g fill="var(--background)" opacity="0.75">
          <rect x="110" y="105" width="45" height="30" rx="4" />
          <rect x="205" y="100" width="55" height="35" rx="4" />
          <rect x="215" y="175" width="40" height="25" rx="4" />
          <rect x="105" y="185" width="50" height="28" rx="4" />
        </g>
      </svg>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="relative flex h-12 w-12 items-center justify-center">
          <span className="absolute h-12 w-12 animate-ping rounded-full bg-[var(--accent)]/25" />
          <span className="relative grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[var(--shadow-md)]">
            <MapPin className="h-5 w-5" />
          </span>
        </span>
      </div>

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)]/95 p-3 backdrop-blur">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold">{label}</div>
          <div className="truncate text-[11.5px] text-[var(--muted-foreground)]">{sublabel}</div>
        </div>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${query}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--primary)] px-3.5 text-[12px] font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
        >
          Maps
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

export function ContactClient() {
  const siteConfig = useSiteConfig();
  const { locale, t } = useI18n();
  const marketText = marketLabels(resolveMarket(siteConfig.market), locale);
  const ar = locale === "ar";

  const details = [
    { icon: MapPin, label: ar ? siteConfig.address : siteConfig.addressEn },
    { icon: Phone, label: siteConfig.phone, ltr: true },
    { icon: Mail, label: siteConfig.email, ltr: true },
    { icon: Clock, label: ar ? siteConfig.hours : siteConfig.hoursEn },
  ];

  return (
    <div className="pt-6">
      <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
              <span className="section-eyebrow">{ar ? "تواصل" : "Contact"}</span>
              <h1 className="section-title">{t.contactPage.title}</h1>
              <p className="section-lead">{t.contactPage.subtitle}</p>

              <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
                {details.map(({ icon: Icon, label, ltr }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] p-3.5"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent)]/12 text-[var(--accent)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span
                      className="truncate text-[12.5px] font-semibold"
                      dir={ltr ? "ltr" : undefined}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <a
                  href={whatsappLink(
                    siteConfig.whatsapp,
                    ar ? "مرحبا نخبة 👋 أريد استشارة" : "Hello Nukhba 👋 I'd like a consult",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25D366] px-5 text-[13.5px] font-bold text-white transition-opacity hover:opacity-95"
                >
                  <MessageCircle className="h-4 w-4" />
                  {ar ? "واتساب مباشر" : "WhatsApp"}
                </a>
                <a
                  href={`tel:${siteConfig.phone.replace(/\s/g, "")}`}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-5 text-[13.5px] font-semibold transition-colors hover:border-[var(--accent)]"
                  dir="ltr"
                >
                  <Phone className="h-4 w-4" />
                  {siteConfig.phone}
                </a>
              </div>
            </div>

            <div className="h-[300px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow-sm)] sm:h-[360px]">
              <MapPanel
                label={marketText.place}
                sublabel={ar ? "مفتوح الآن · رد سريع" : "Open now · fast reply"}
                address={siteConfig.addressEn}
              />
            </div>
          </div>
        </div>
      </section>

      <CTAForm />
    </div>
  );
}
