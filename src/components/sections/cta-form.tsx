"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, Send, CheckCircle2, ShieldCheck, Clock, Headset } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSectionHeading, useSiteConfig } from "@/components/site-provider";
import { whatsappLink } from "@/lib/utils";

const schema = z.object({
  business: z.string().min(2, "Required"),
  sector: z.string().min(2),
  need: z.string().min(2),
  budget: z.string().min(1),
  deadline: z.string().min(1),
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  message: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function CTAForm() {
  const siteConfig = useSiteConfig();
  const heading = useSectionHeading("cta");
  const { locale, t } = useI18n();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const totalSteps = 3;

  const { register, handleSubmit, watch, trigger, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { sector: "restaurant", need: "vitrine", budget: "1500-2500", deadline: "7-14" },
  });

  const onSubmit = async (data: FormData) => {
    // Stocke les UTM et envoie la demande en base (visible dans /admin)
    const utm = typeof window !== "undefined" ? window.location.search : "";
    setSubmitError(false);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, utm, locale }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitted(true);
      // Reset after
      setTimeout(() => setStep(1), 2000);
    } catch (error) {
      console.error("Envoi de la demande impossible :", error);
      setSubmitError(true);
    }
  };

  const next = async () => {
    const fieldsByStep: Record<number, (keyof FormData)[]> = {
      1: ["business", "sector"],
      2: ["need", "budget", "deadline"],
      3: ["name", "phone"],
    };
    const ok = await trigger(fieldsByStep[step]);
    if (ok) setStep((s) => Math.min(s + 1, totalSteps));
  };

  const whatsappMsg = locale === "ar"
    ? `مرحبا نخبة 👋\nأريد عرض سعر لموقع.\nالنشاط: ${watch("business") || "—"}\nالقطاع: ${watch("sector")}\nالباقة: ${watch("need")}\nالميزانية: ${watch("budget")}\nالهاتف: ${watch("phone") || "—"}`
    : `Hello Nukhba 👋 I want a quote.\nBusiness: ${watch("business") || "—"}\nSector: ${watch("sector")}\nNeed: ${watch("need")}\nBudget: ${watch("budget")}\nPhone: ${watch("phone") || "—"}`;

  return (
    <section id="lead-form" className="section">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-lg)] lg:grid-cols-[1.05fr_1.15fr]">
          {/* Left copy */}
          <div className="relative overflow-hidden p-7 sm:p-9 lg:p-10">
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute -top-20 -end-20 w-[500px] h-[500px] rounded-full blur-[60px] bg-[var(--accent)]" />
            </div>
            <div className="relative">
              <div className="inline-flex px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold tracking-widest">
                {locale === "ar" ? "استشارة مجانية" : "FREE CONSULT"}
              </div>
              <h2 className="mt-4 text-[clamp(1.75rem,1.2rem+1.9vw,2.6rem)] font-black leading-[1.04] tracking-[-0.025em]">
                {heading.title}
                <span className="mt-1.5 block text-[0.72em] font-light italic opacity-75">
                  {heading.subtitle}
                </span>
              </h2>

              <div className="mt-7 space-y-2.5">
                {[
                  { icon: Clock, title: locale === "ar" ? "رد خلال ساعتين" : "Reply in 2 hours", desc: locale === "ar" ? "حتى في المساء وعطلة نهاية الأسبوع" : "Even evenings & weekends" },
                  { icon: ShieldCheck, title: locale === "ar" ? "بدون التزام" : "No commitment", desc: locale === "ar" ? "عرض سعر مجاني وشفاف" : "Free & transparent quote" },
                  { icon: Headset, title: locale === "ar" ? "دعم واتساب مباشر" : "Direct WhatsApp", desc: siteConfig.phone },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3 rounded-[var(--radius-sm)] border border-white/10 bg-white/[0.06] p-3.5">
                    <item.icon className="h-5 w-5 mt-0.5 text-[var(--accent)] flex-shrink-0" />
                    <div>
                      <div className="text-[13.5px] font-bold">{item.title}</div>
                      <div className="mt-0.5 text-[11.5px] opacity-65">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href={whatsappLink(siteConfig.whatsapp, whatsappMsg)} target="_blank" className="h-11 px-5 rounded-full bg-[#25D366] text-white inline-flex items-center gap-2 font-bold hover:brightness-95">
                  {locale === "ar" ? "تحدث واتساب الآن" : "Chat on WhatsApp"}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <div className="text-xs opacity-60 flex items-center">
                  {heading.note || t.cta.guarantee}
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-[var(--card)] p-5 text-[var(--foreground)] sm:p-7 lg:p-8">
            {!submitted ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-lg">{t.cta.formTitle}</h3>
                  <div className="flex items-center gap-1.5">
                    {[1,2,3].map(n=> (
                      <span key={n} className={`h-1.5 rounded-full transition-all ${n===step ? "w-8 bg-[var(--accent)]" : n<step ? "w-6 bg-[var(--primary)]" : "w-6 bg-[var(--border)]"}`} />
                    ))}
                    <span className="ms-2 text-xs opacity-60">{step}/{totalSteps}</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                  {step === 1 && (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                      <div>
                        <label className="text-sm font-semibold">{locale === "ar" ? "اسم النشاط" : "Business name"} *</label>
                        <input {...register("business")} placeholder={locale === "ar" ? "مثال: مطعم السرايا" : "e.g. Saraya Restaurant"} className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--secondary)]/50 px-4 outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--card)]" />
                        {errors.business && <p className="text-xs text-red-500 mt-1">{errors.business.message}</p>}
                      </div>
                      <div>
                        <label className="text-sm font-semibold">{locale === "ar" ? "القطاع" : "Sector"} *</label>
                        <select {...register("sector")} className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--secondary)]/50 px-4 outline-none transition-colors focus:border-[var(--accent)]">
                          <option value="restaurant">{locale === "ar" ? "مطعم / مقهى" : "Restaurant / Café"}</option>
                          <option value="clinic">{locale === "ar" ? "عيادة / مركز" : "Clinic"}</option>
                          <option value="boutique">{locale === "ar" ? "متجر / بوتيك" : "Shop / Boutique"}</option>
                          <option value="realestate">{locale === "ar" ? "عقارات" : "Real Estate"}</option>
                          <option value="education">{locale === "ar" ? "تعليم / تدريب" : "Education"}</option>
                          <option value="hotel">{locale === "ar" ? "فندق / شقق" : "Hotel"}</option>
                          <option value="other">{locale === "ar" ? "أخرى" : "Other"}</option>
                        </select>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                      <div>
                        <label className="text-sm font-semibold">{locale === "ar" ? "ماذا تحتاج؟" : "What do you need?"} *</label>
                        <select {...register("need")} className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--secondary)]/50 px-4 outline-none transition-colors focus:border-[var(--accent)]">
                          <option value="vitrine">{locale === "ar" ? "موقع واجهة" : "Vitrine site"}</option>
                          <option value="vitrine-plus">{locale === "ar" ? "واجهة بلس + حجز" : "Vitrine+ + booking"}</option>
                          <option value="shop">{locale === "ar" ? "متجر / حجز كامل" : "Full shop / booking"}</option>
                          <option value="redesign">{locale === "ar" ? "إعادة تصميم" : "Redesign"}</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-semibold">{locale === "ar" ? "الميزانية" : "Budget"}</label>
                          <select {...register("budget")} className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--secondary)]/50 px-4 outline-none transition-colors focus:border-[var(--accent)]">
                            <option value="under-300">{locale === "ar" ? "أقل من 300 $" : "Under $300"}</option>
                            <option value="300-600">$300–600</option>
                            <option value="600-1000">$600–1,000</option>
                            <option value="1000+">{locale === "ar" ? "أكثر من 1000 $" : "$1,000+"}</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-semibold">{locale === "ar" ? "الموعد" : "Deadline"}</label>
                          <select {...register("deadline")} className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--secondary)]/50 px-4 outline-none transition-colors focus:border-[var(--accent)]">
                            <option value="urgent">{locale === "ar" ? "مستعجل (أسبوع)" : "Urgent (1 week)"}</option>
                            <option value="7-14">{locale === "ar" ? "7-14 يوم" : "7-14 days"}</option>
                            <option value="flexible">{locale === "ar" ? "مرن" : "Flexible"}</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-semibold">{locale === "ar" ? "الاسم" : "Name"} *</label>
                          <input {...register("name")} placeholder={locale === "ar" ? "الاسم الكامل" : "Full name"} className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--secondary)]/50 px-4 outline-none transition-colors focus:border-[var(--accent)]" />
                          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                        </div>
                        <div>
                          <label className="text-sm font-semibold">{locale === "ar" ? "واتساب / هاتف" : "WhatsApp / Phone"} *</label>
                          <input {...register("phone")} placeholder="+218 9X XXX XXXX" className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--secondary)]/50 px-4 outline-none transition-colors focus:border-[var(--accent)]" dir="ltr" />
                          {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold">{locale === "ar" ? "البريد (اختياري)" : "Email (optional)"}</label>
                        <input {...register("email")} placeholder="you@example.com" className="mt-2 h-11 w-full rounded-full border border-[var(--border)] bg-[var(--secondary)]/50 px-4 outline-none transition-colors focus:border-[var(--accent)]" dir="ltr" />
                      </div>
                      <div>
                        <label className="text-sm font-semibold">{locale === "ar" ? "تفاصيل إضافية" : "Extra details"}</label>
                        <textarea {...register("message")} rows={3} placeholder={locale === "ar" ? "أخبرنا أكثر عن فكرتك..." : "Tell us more..."} className="mt-2 w-full resize-none rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--secondary)]/50 px-4 py-3 outline-none transition-colors focus:border-[var(--accent)]" />
                      </div>
                    </motion.div>
                  )}

                  <div className="flex flex-wrap gap-3 pt-2">
                    {submitError && (
                      <div className="w-full rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs text-red-500 text-center">
                        {locale === "ar"
                          ? "تعذّر إرسال الطلب — أعد المحاولة أو"
                          : "Sending failed — try again or"}{" "}
                        <a
                          href={whatsappLink(siteConfig.whatsapp, whatsappMsg)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-bold"
                        >
                          {locale === "ar"
                            ? "تواصل معنا على واتساب"
                            : "contact us on WhatsApp"}
                        </a>
                      </div>
                    )}
                    {step > 1 && (
                      <button type="button" onClick={() => setStep(s => s - 1)} className="h-11 px-6 rounded-full border border-[var(--border)] bg-[var(--card)] font-semibold hover:bg-[var(--secondary)] cursor-pointer">
                        {locale === "ar" ? "رجوع" : "Back"}
                      </button>
                    )}
                    {step < totalSteps ? (
                      <button type="button" onClick={next} className="flex-1 h-11 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer">
                        {locale === "ar" ? "التالي" : "Next"} <ArrowUpRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button type="submit" className="flex-1 h-11 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold inline-flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] cursor-pointer">
                        <Send className="h-4 w-4" /> {locale === "ar" ? "إرسال الطلب" : "Send request"}
                      </button>
                    )}
                  </div>

                  <p className="text-xs opacity-50 text-center">
                    {locale === "ar" ? "بإرسالك توافق على تواصلنا عبر واتساب وهاتف • نحترم خصوصيتك" : "By sending you agree to WhatsApp/phone contact • We respect privacy"}
                  </p>
                </form>
              </>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
                <div className="h-16 w-16 rounded-full bg-green-500 text-white grid place-items-center mx-auto">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-xl font-black">{locale === "ar" ? "تم الإرسال بنجاح!" : "Sent successfully!"}</h3>
                <p className="mt-2 text-sm opacity-60 max-w-[32ch] mx-auto">
                  {locale === "ar" ? "سنرد عليك عبر واتساب خلال ساعتين. شكراً لثقتك بنخبة." : "We'll reply on WhatsApp within 2 hours. Thanks for trusting Nukhba."}
                </p>
                <a href={whatsappLink(siteConfig.whatsapp, whatsappMsg)} target="_blank" className="mt-6 inline-flex h-10 px-5 rounded-full bg-[#25D366] text-white font-bold items-center gap-2">
                  {locale === "ar" ? "متابعة على واتساب" : "Continue on WhatsApp"}
                </a>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
