"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";

const accents = [
  { name: "ذهبي", hex: "#C6A664" },
  { name: "زمردي", hex: "#0F766E" },
  { name: "ليلي", hex: "#1E3A5F" },
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

export function Customizer() {
  const { locale, t } = useI18n();
  const [accent, setAccent] = useState(accents[0]);
  const [font, setFont] = useState(fonts[0]);
  const [style, setStyle] = useState(styles[0]);

  return (
    <section className="py-16 lg:py-20 bg-[var(--primary)] text-[var(--primary-foreground)] relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute -top-20 -end-20 w-[600px] h-[600px] rounded-full blur-[80px]" style={{ background: accent.hex }} />
      </div>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 relative">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em]" style={{ color: accent.hex }}>
              <span className="h-px w-8" style={{ background: accent.hex }} />
              {locale === "ar" ? "المخصص المباشر" : "LIVE CUSTOMIZER"}
            </div>
            <h2 className="mt-3 text-[30px] lg:text-[40px] font-black tracking-tight leading-none">{t.customizer.title}</h2>
            <p className="mt-3 opacity-60 max-w-[52ch]">{t.customizer.subtitle}</p>
          </div>
          <div className="text-xs opacity-50 hidden lg:block">
            {locale === "ar" ? "كل شيء يتغير فوراً — هذه قوة نظامنا" : "Everything updates instantly — that's our system power"}
          </div>
        </div>

        <div className="grid lg:grid-cols-[420px_1fr] gap-6">
          {/* Controls */}
          <div className="rounded-[24px] bg-white/5 backdrop-blur border border-white/10 p-6 space-y-6">
            <div>
              <div className="text-sm font-bold opacity-80 mb-3">{t.customizer.accent}</div>
              <div className="flex flex-wrap gap-3">
                {accents.map((a) => (
                  <button
                    key={a.hex}
                    onClick={() => setAccent(a)}
                    className={`h-10 w-10 rounded-full border-2 transition-all cursor-pointer ${accent.hex === a.hex ? "border-white scale-110 shadow-lg" : "border-white/20 hover:scale-105"}`}
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
                    onClick={() => setFont(f)}
                    className={`px-4 py-3 rounded-full text-sm font-semibold border transition-colors text-start cursor-pointer ${font.id === f.id ? "bg-white text-black border-white" : "bg-white/10 border-white/20 hover:bg-white/15 text-white"}`}
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
                    onClick={() => setStyle(s)}
                    className={`flex-1 px-3 py-2.5 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${style.id === s.id ? "bg-white text-black border-white" : "bg-white/10 border-white/20 text-white hover:bg-white/15"}`}
                  >
                    {locale === "ar" ? s.labelAr : s.labelEn}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white text-black p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-black">{locale === "ar" ? "جاهز للطلب؟" : "Ready to order?"}</div>
                <div className="text-xs opacity-60">{locale === "ar" ? "نطبق هذا على موقعك فوراً" : "We apply this to your site instantly"}</div>
              </div>
              <button
                onClick={() => document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" })}
                className="h-9 px-4 rounded-full text-white text-sm font-bold cursor-pointer"
                style={{ background: accent.hex }}
              >
                {locale === "ar" ? "اطلب الآن" : "Order now"}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div
            className={`rounded-[24px] bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] overflow-hidden shadow-2xl transition-all duration-300 ${style.id === "sharp" ? "[&_*]:!rounded-none" : style.id === "playful" ? "[&_img]:rounded-[20px]" : ""}`}
            style={{ fontFamily: font.family }}
          >
            <div className="h-12 flex items-center justify-between px-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ms-3 text-xs opacity-60 hidden sm:inline">preview.nukhba.ly</span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: accent.hex }}>
                {locale === "ar" ? "معاينة حية" : "Live preview"}
              </span>
            </div>

            <div className="relative">
              <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80&auto=format&fit=crop" alt="" className="w-full aspect-[16/9] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 p-6 sm:p-8 text-white">
                <div className="inline-flex px-3 py-1 rounded-full text-xs font-bold" style={{ background: accent.hex }}>
                  {locale === "ar" ? "طرابلس • منذ 2019" : "Tripoli • Since 2019"}
                </div>
                <h3 className="mt-3 text-2xl sm:text-3xl font-black leading-none">{t.customizer.previewTitle}</h3>
                <p className="mt-2 text-sm opacity-80 max-w-[36ch]">{t.customizer.previewDesc}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="h-9 px-5 rounded-full text-sm font-bold text-white" style={{ background: accent.hex }}>
                    {t.customizer.previewBtn}
                  </button>
                  <button className="h-9 px-5 rounded-full bg-white/15 backdrop-blur border border-white/30 text-sm font-semibold text-white">
                    {locale === "ar" ? "القائمة" : "View menu"}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 p-5">
              {[
                { title: locale === "ar" ? "قائمة ذكية" : "Smart Menu", desc: locale === "ar" ? "QR + طلب واتساب" : "QR + WhatsApp order" },
                { title: locale === "ar" ? "حجز فوري" : "Instant Booking", desc: locale === "ar" ? "تأكيد تلقائي" : "Auto confirmation" },
                { title: locale === "ar" ? "تقييمات حية" : "Live Reviews", desc: locale === "ar" ? "ثقة العملاء" : "Customer trust" },
              ].map((c) => (
                <div key={c.title} className="rounded-2xl border border-[var(--border)] p-4 bg-[var(--secondary)]/50">
                  <div className="h-8 w-8 rounded-full grid place-items-center text-white text-sm font-bold" style={{ background: accent.hex }}>
                    ✓
                  </div>
                  <div className="mt-3 font-bold text-sm">{c.title}</div>
                  <div className="text-xs opacity-60">{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
