import { demos } from "@/lib/content";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Check, Smartphone, Monitor, Sparkles } from "lucide-react";

export function generateStaticParams() {
  return demos.map((d) => ({ slug: d.slug }));
}

export default async function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const demo = demos.find((d) => d.slug === slug);
  if (!demo) notFound();

  return (
    <div className="pt-[96px]">
      <section className="py-8">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <Link href="/demos" className="inline-flex items-center gap-1 text-sm opacity-60 hover:opacity-100">
            ← الرجوع للمعارض
          </Link>

          <div className="mt-4 grid lg:grid-cols-[1.2fr_0.8fr] gap-8">
            <div className="rounded-[24px] overflow-hidden bg-black p-3 shadow-2xl">
              <div className="rounded-[16px] overflow-hidden bg-white relative">
                <img src={demo.image} alt={demo.title} className="w-full aspect-[16/11] object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-0 p-6 text-white">
                  <span className="px-3 py-1 rounded-full bg-[var(--accent)] text-black text-xs font-bold">{demo.sectorAr}</span>
                  <h1 className="mt-2 text-3xl font-black">{demo.title}</h1>
                  <p className="opacity-80">{demo.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mt-3 text-white/70 text-xs">
                <Monitor className="h-4 w-4" /> متجاوب 100% — موبايل وحاسوب <Smartphone className="h-4 w-4" />
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[24px] bg-[var(--card)] border border-[var(--border)] p-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent)] text-black text-xs font-bold">
                  <Sparkles className="h-3.5 w-3.5" /> معرض حي — قابل للتخصيص
                </div>
                <h2 className="mt-3 text-2xl font-black">{demo.title} — {demo.sectorAr}</h2>
                <p className="mt-2 opacity-70 leading-7">{demo.description} — كل شيء قابل للتعديل: ألوان، خطوط، صور، وأقسام في دقائق.</p>

                <ul className="mt-4 space-y-2">
                  {demo.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <span className="h-5 w-5 rounded-full bg-green-500 text-white grid place-items-center flex-shrink-0"><Check className="h-3 w-3" /></span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <a href="#lead-form" className="h-11 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] grid place-items-center font-bold hover:opacity-90">
                    اطلب مثل هذا
                  </a>
                  <a href={`https://wa.me/218912345678?text=${encodeURIComponent(`أريد معرض ${demo.title}`)}`} target="_blank" className="h-11 rounded-full bg-[#25D366] text-white grid place-items-center font-bold">
                    واتساب
                  </a>
                </div>
              </div>

              <div className="rounded-[24px] bg-[var(--secondary)] border border-[var(--border)] p-6">
                <h3 className="font-bold">ماذا يشمل؟</h3>
                <ul className="mt-3 grid grid-cols-1 gap-2 text-sm opacity-70">
                  <li>✓ تصميم حصري على هويتك</li>
                  <li>✓ سريع — Lighthouse 90+</li>
                  <li>✓ SEO + خرائط + حجز</li>
                  <li>✓ تدريب + دعم واتساب</li>
                </ul>
                <Link href="/pricing" className="mt-4 inline-flex items-center gap-1 text-sm font-bold underline decoration-[var(--accent)] underline-offset-4">
                  شاهد الباقات <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="rounded-[24px] bg-[var(--card)] border border-[var(--border)] p-4">
                <div className="text-xs opacity-60">استبدل الصورة الحقيقية هنا</div>
                <img src={demo.image} alt="" className="mt-3 w-full rounded-xl object-cover aspect-video" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="lead-form" className="py-10">
        <div className="mx-auto max-w-[720px] px-4 sm:px-6">
          <div className="rounded-[24px] bg-[var(--primary)] text-[var(--primary-foreground)] p-6 text-center">
            <h3 className="text-xl font-black">أعجبك هذا النمط؟ نطبقه على نشاطك في أيام</h3>
            <a href="/contact" className="mt-4 inline-flex h-11 px-6 rounded-full bg-[var(--accent)] text-black font-bold items-center gap-2">
              اطلب عرضك المجاني <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
