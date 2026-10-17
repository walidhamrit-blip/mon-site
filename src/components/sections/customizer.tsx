"use client";
import { useState } from "react";
import { Maximize2, ExternalLink, Eye, Sliders } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ScaledLiveIframe, FullscreenLiveViewer } from "@/components/live-site-frames";
import type { Demo } from "@/lib/site-types";

const accents = [
  { name: "ذهبي", hex: "#C6A664" },
  { name: "أزرق ملكي", hex: "#1E3A8A" },
  { name: "زمردي", hex: "#0F766E" },
  { name: "خمري", hex: "#8B2C2C" },
  { name: "فحمي", hex: "#1A1A1E" },
];

const fonts = [
  { id: "cairo", label: "Cairo • عصري", family: "Cairo, system-ui" },
  { id: "plex", label: "IBM Plex • أنيق", family: "'IBM Plex Sans Arabic', system-ui" },
  { id: "tajawal", label: "Tajawal • دافئ", family: "Tajawal, system-ui" },
];

const styles = [
  { id: "soft", labelAr: "ناعم", labelEn: "Soft" },
  { id: "sharp", labelAr: "حازم", labelEn: "Sharp" },
  { id: "playful", labelAr: "مرح", labelEn: "Playful" },
];

const AL_MASSA_DEMO: Demo = {
  slug: "al-massa-mattresses",
  sector: "furniture",
  sectorAr: "مراتب ومفروشات فاخرة",
  sectorEn: "Mattresses & Bedding",
  title: "الماسة الزرقاء — للمراتب والمفروشات الفاخرة",
  titleEn: "Al-Massa Blue Diamond — Luxury Mattresses",
  description:
    "معرض الماسة الزرقاء في طرابلس (الوكيل المعتمد لشركة الفراشة) — مراتب طبية وفندقية، أسرّة حسب المقاس، وأطقم مفروشات فندقية",
  descriptionEn:
    "Blue Diamond showroom in Tripoli (Al-Farasha authorized dealer) — orthopedic & hotel mattresses, custom velvet beds & luxury bedding",
  image: "https://al-massa.vercel.app/images/product-diamond-mattress.jpg",
  color: "#1E3A8A",
  features: ["مراتب طبية وأسرّة حسب المقاس", "سلة مرتبطة بواتساب", "معرض صور حقيقي ومدونة", "ضمان الوكيل المعتمد"],
  featuresEn: ["Custom Beds & Mattresses", "WhatsApp Smart Cart", "Real Showroom & Blog", "Authorized Dealer Warranty"],
  previewUrl: "https://al-massa.vercel.app/",
};

export function Customizer() {
  const { locale, t } = useI18n();
  const [accent, setAccent] = useState(accents[1]);
  const [font, setFont] = useState(fonts[0]);
  const [style, setStyle] = useState(styles[0]);
  const [tab, setTab] = useState<"custom" | "live">("custom");
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <section className="py-16 lg:py-20 bg-[var(--primary)] text-[var(--primary-foreground)] relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="absolute -top-20 -end-20 w-[600px] h-[600px] rounded-full blur-[80px]"
          style={{ background: accent.hex }}
        />
      </div>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 relative">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em]"
              style={{ color: accent.hex }}
            >
              <span className="h-px w-8" style={{ background: accent.hex }} />
              {locale === "ar" ? "المخصص المباشر • الماسة الزرقاء" : "LIVE CUSTOMIZER • AL-MASSA"}
            </div>
            <h2 className="mt-3 text-[30px] lg:text-[40px] font-black tracking-tight leading-none">
              {t.customizer.title}
            </h2>
            <p className="mt-3 opacity-60 max-w-[52ch]">{t.customizer.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="h-9 px-4 rounded-full text-xs font-black text-white inline-flex items-center gap-1.5 cursor-pointer shadow-md"
              style={{ background: accent.hex }}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              {locale === "ar"
                ? "فتح موقع الماسة بملء الشاشة (حاسوب / هاتف)"
                : "Open Al-Massa Fullscreen (Desktop / Mobile)"}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
          {/* Controls */}
          <div className="rounded-[24px] bg-white/5 backdrop-blur border border-white/10 p-6 space-y-6">
            <div>
              <div className="text-sm font-bold opacity-80 mb-3">{t.customizer.accent}</div>
              <div className="flex flex-wrap gap-3">
                {accents.map((a) => (
                  <button
                    key={a.hex}
                    type="button"
                    onClick={() => {
                      setAccent(a);
                      setTab("custom");
                    }}
                    className={`h-10 w-10 rounded-full border-2 transition-all cursor-pointer ${
                      accent.hex === a.hex
                        ? "border-white scale-110 shadow-lg"
                        : "border-white/20 hover:scale-105"
                    }`}
                    style={{ background: a.hex }}
                    aria-label={a.name}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold opacity-80 mb-3">{t.customizer.font}</div>
              <div className="grid gap-2">
                {fonts.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setFont(f);
                      setTab("custom");
                    }}
                    className={`px-4 py-3 rounded-full text-sm font-semibold border transition-colors text-start cursor-pointer ${
                      font.id === f.id
                        ? "bg-white text-black border-white"
                        : "bg-white/10 border-white/20 hover:bg-white/15 text-white"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold opacity-80 mb-3">{t.customizer.style}</div>
              <div className="flex gap-2">
                {styles.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setStyle(s);
                      setTab("custom");
                    }}
                    className={`flex-1 px-3 py-2.5 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                      style.id === s.id
                        ? "bg-white text-black border-white"
                        : "bg-white/10 border-white/20 text-white hover:bg-white/15"
                    }`}
                  >
                    {locale === "ar" ? s.labelAr : s.labelEn}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white text-black p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black">
                  {locale === "ar" ? "أعجبك موقع الماسة الزرقاء؟" : "Like the Al-Massa site?"}
                </div>
                <div className="text-xs opacity-60">
                  {locale === "ar"
                    ? "نطبق هذا المستوى على نشاطك فوراً"
                    : "We build this quality for your brand"}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" })
                }
                className="h-9 px-4 rounded-full text-white text-sm font-bold cursor-pointer flex-shrink-0"
                style={{ background: accent.hex }}
              >
                {locale === "ar" ? "اطلب الآن" : "Order now"}
              </button>
            </div>
          </div>

          {/* Preview — Al-Massa Blue Diamond */}
          <div
            className={`rounded-[24px] bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] overflow-hidden shadow-2xl transition-all duration-300 ${
              style.id === "sharp"
                ? "[&_*]:!rounded-none"
                : style.id === "playful"
                  ? "[&_img]:rounded-[20px]"
                  : ""
            }`}
            style={{ fontFamily: font.family }}
          >
            {/* Browser Bar */}
            <div className="min-h-12 py-2 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ms-2 text-xs opacity-60 hidden sm:inline" dir="ltr">
                  al-massa.vercel.app
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="inline-flex items-center rounded-full bg-[var(--secondary)] border border-[var(--border)] p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setTab("custom")}
                    className={`px-3 py-1 rounded-full font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                      tab === "custom" ? "text-white" : "opacity-70 hover:opacity-100"
                    }`}
                    style={tab === "custom" ? { background: accent.hex } : undefined}
                  >
                    <Sliders className="h-3 w-3" />
                    {locale === "ar" ? "تخصيص الهوية" : "Theme"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("live")}
                    className={`px-3 py-1 rounded-full font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                      tab === "live" ? "text-white" : "opacity-70 hover:opacity-100"
                    }`}
                    style={tab === "live" ? { background: accent.hex } : undefined}
                  >
                    <Eye className="h-3 w-3" />
                    {locale === "ar" ? "الموقع الحي" : "Live Site"}
                  </button>
                </div>

                <a
                  href="https://al-massa.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-full text-xs font-bold text-white inline-flex items-center gap-1"
                  style={{ background: accent.hex }}
                >
                  {locale === "ar" ? "زيارة الموقع" : "Visit Site"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {tab === "live" ? (
              <div className="w-full aspect-[16/10] bg-white relative">
                <ScaledLiveIframe
                  url="https://al-massa.vercel.app/"
                  title={locale === "ar" ? AL_MASSA_DEMO.title : AL_MASSA_DEMO.titleEn}
                  mode="desktop"
                />
              </div>
            ) : (
              <>
                <div className="relative">
                  <img
                    src="https://al-massa.vercel.app/images/product-diamond-mattress.jpg"
                    alt={t.customizer.previewTitle}
                    className="w-full aspect-[16/9] object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-6 sm:p-8 text-white">
                    <div
                      className="inline-flex px-3 py-1 rounded-full text-xs font-bold text-white"
                      style={{ background: accent.hex }}
                    >
                      {locale === "ar"
                        ? "الوكيل المعتمد لشركة الفراشة • طرابلس"
                        : "Authorized Al-Farasha Dealer • Tripoli"}
                    </div>
                    <h3 className="mt-3 text-2xl sm:text-3xl font-black leading-none">
                      {t.customizer.previewTitle}
                    </h3>
                    <p className="mt-2 text-sm opacity-85 max-w-[46ch]">
                      {t.customizer.previewDesc}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setFullscreen(true)}
                        className="h-9 px-5 rounded-full text-sm font-bold text-white cursor-pointer"
                        style={{ background: accent.hex }}
                      >
                        {t.customizer.previewBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("live")}
                        className="h-9 px-5 rounded-full bg-white/15 backdrop-blur border border-white/30 text-sm font-semibold text-white cursor-pointer hover:bg-white/25"
                      >
                        {locale === "ar" ? "تصفح الموقع الحي" : "Browse Live Site"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 p-5">
                  {[
                    {
                      title: locale === "ar" ? "مراتب طبية وفندقية" : "Orthopedic Mattresses",
                      desc:
                        locale === "ar"
                          ? "دياموند سيغنتشر وبريميوم كومفورت"
                          : "Diamond Signature & Premium Comfort",
                    },
                    {
                      title: locale === "ar" ? "أسرّة حسب المقاس" : "Custom Velvet Beds",
                      desc:
                        locale === "ar"
                          ? "تفصيل بالمليمتر وتوصيل مجاني بطرابلس"
                          : "Tailored to your size + free Tripoli delivery",
                    },
                    {
                      title: locale === "ar" ? "طلب مباشر عبر واتساب" : "Direct WhatsApp Cart",
                      desc:
                        locale === "ar"
                          ? "أضف للسلة وأرسل طلبك بضغطة واحدة"
                          : "Add to cart & send order in one click",
                    },
                  ].map((c) => (
                    <div
                      key={c.title}
                      className="rounded-2xl border border-[var(--border)] p-4 bg-[var(--secondary)]/50"
                    >
                      <div
                        className="h-8 w-8 rounded-full grid place-items-center text-white text-sm font-bold"
                        style={{ background: accent.hex }}
                      >
                        ✓
                      </div>
                      <div className="mt-3 font-bold text-sm">{c.title}</div>
                      <div className="text-xs opacity-60 mt-0.5">{c.desc}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {fullscreen && (
        <FullscreenLiveViewer
          demo={AL_MASSA_DEMO}
          initialMode="desktop"
          onClose={() => setFullscreen(false)}
        />
      )}
    </section>
  );
}
