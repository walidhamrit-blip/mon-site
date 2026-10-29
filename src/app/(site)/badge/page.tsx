import type { Metadata } from "next";
import Link from "next/link";
import { getSiteDataCached } from "@/lib/store";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata, siteLocale } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";
import { BadgeSnippet } from "@/components/badge-snippet";
import { BadgeGrid } from "@/components/badge-grid";
import {
  BADGE_ANCHOR_AR,
  BADGE_ANCHOR_EN,
  BADGE_ASSET,
  BADGE_HEIGHT,
  BADGE_WIDTH,
  badgeCanonical,
  badgeHtmlSnippet,
  badgeReactSnippet,
  badgeStats,
  linkedClients,
} from "@/lib/badge";
import { resolveSiteOrigin } from "@/lib/site-identity";

export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteDataCached();
  const locale = siteLocale(config);
  const origin = resolveSiteOrigin({ url: config.url, domain: config.domain });
  return pageMetadata(config, {
    path: "/badge",
    title:
      locale === "ar"
        ? "شارة «Website by Nukhba» للمواقع المنجزة"
        : "“Website by Nukhba” Client Badge",
    description:
      locale === "ar"
        ? `رمز HTML وReact لشارة «Website by Nukhba» — رابط موثّق نحو ${origin} في تذييل المواقع المنجزة. جاهز للنسخ بالعربية والإنجليزية.`
        : `Copy-paste HTML and React snippets for the “Website by Nukhba” badge — a verified link to ${origin} in the footer of delivered client sites. Bilingual AR/EN.`,
    image: "/badge/nukhba-badge.svg",
    keywords: [
      "شارة نخبة",
      "badge Nukhba",
      "Website by Nukhba",
      "netlinking {country}",
      "رابط تصميم موقع {city}",
    ],
  });
}

export default async function BadgePage() {
  const { config } = await getSiteDataCached();
  const stats = badgeStats();
  // Origine canonique : suit le domaine configuré dans /admin.
  const origin = resolveSiteOrigin({ url: config.url, domain: config.domain });
  const canonical = badgeCanonical(origin);
  const linked = linkedClients();

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${absoluteUrl(config, "/badge")}#webpage`,
    name: "شارة نخبة — Badge « Website by Nukhba »",
    alternateName: "Nukhba Client Badge",
    description:
      "Page officielle de la شارة نخبة : extraits HTML et React, ancres bilingues et liste des sites clients validés.",
    url: absoluteUrl(config, "/badge"),
    inLanguage: ["en", "ar"],
    isPartOf: { "@id": absoluteUrl(config, "#website") },
    about: {
      "@type": "ImageObject",
      "@id": `${absoluteUrl(config, BADGE_ASSET)}#image`,
      contentUrl: absoluteUrl(config, BADGE_ASSET),
      width: BADGE_WIDTH,
      height: BADGE_HEIGHT,
      caption: `${BADGE_ANCHOR_AR} · ${BADGE_ANCHOR_EN}`,
    },
    ...(linked.length > 0
      ? {
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: linked.length,
            itemListElement: linked.map(({ url, entry }, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url,
              name: entry.titleEn || entry.title,
            })),
          },
        }
      : {}),
  };

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(config, [
            { name: "الرئيسية", path: "/" },
            { name: "شارة نخبة", path: "/badge" },
          ]),
          schema,
        ]}
      />

      <div className="pt-6">
        <section className="section-tight border-b border-[var(--border)] bg-[var(--secondary)]/35">
          <div className="site-container px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-black tracking-[0.2em] text-[var(--accent)] uppercase">
              Netlinking · شارة نخبة
            </p>
            <h1 className="mt-3 text-[34px] lg:text-[46px] font-black tracking-tight leading-tight">
              شارة « Website by Nukhba » للمواقع المنجزة
            </h1>
            <p className="mt-4 opacity-70 max-w-[68ch] leading-8">
              كل موقع نُنجزه يحمل في تذييله رابطاً حقيقياً إلى{" "}
              <span dir="ltr" className="font-bold">
                {origin.replace(/^https?:\/\//i, "")}
              </span>
              . هذه الشارة الرسمية: صورة واحدة خفيفة (SVG أقل من 4 كوبايت)، رابط
              متوافق مع محركات البحث، ووصف بديل ثنائي اللغة. انسخ الرمز المناسب لموقعك.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="#snippet"
                className="inline-flex h-11 items-center rounded-full bg-[var(--accent)] px-6 text-sm font-bold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition"
              >
                رمز جاهز للنسخ
              </Link>
              <Link
                href="/demos"
                className="inline-flex h-11 items-center rounded-full border border-[var(--border)] px-6 text-sm font-bold hover:bg-[var(--secondary)] transition"
              >
                المواقع المنجزة
              </Link>
            </div>
          </div>
        </section>

        <section className="section-tight">
          <div className="site-container grid gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:px-8">
            {/* min-w-0 : sans lui, le bloc de code (largeur intrinsèque
                élevée) élargissait la colonne et créait un débordement
                horizontal de la page entière. */}
            <div className="min-w-0">
              <h2 className="text-2xl font-black">الشارة</h2>
              <p className="mt-2 opacity-60 text-sm leading-7">
                نسختان: داكنة للتذييلات الفاتحة، وواضحة للتذييلات الداكنة. كلتاهما
                تستخدم نفس الرابط ونفس الوصف البديل، فلا داعي لتعديل شيء عند تغيير
                المظهر.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="card-surface p-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest opacity-45">
                    Dark · تذييل فاتح
                  </p>
                  <div className="mt-4 flex min-h-[70px] items-center justify-center rounded-xl bg-white p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={BADGE_ASSET}
                      alt={`${BADGE_ANCHOR_AR} | ${BADGE_ANCHOR_EN}`}
                      width={BADGE_WIDTH}
                      height={BADGE_HEIGHT}
                    />
                  </div>
                </div>
                <div className="card-surface p-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest opacity-45">
                    Light · تذييل داكن
                  </p>
                  <div className="mt-4 flex min-h-[70px] items-center justify-center rounded-xl bg-[#0C0C0F] p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/badge/nukhba-badge-light.svg"
                      alt={`${BADGE_ANCHOR_AR} | ${BADGE_ANCHOR_EN}`}
                      width={BADGE_WIDTH}
                      height={BADGE_HEIGHT}
                    />
                  </div>
                </div>
              </div>

              <BadgeSnippet
                tabs={[
                  {
                    id: "html",
                    label: "HTML",
                    language: "html",
                    code: badgeHtmlSnippet({ withText: true, origin }),
                  },
                  {
                    id: "react",
                    label: "React / Next.js",
                    language: "tsx",
                    code: badgeReactSnippet({ origin }),
                  },
                  {
                    id: "minimal",
                    label: "HTML — badge seul",
                    language: "html",
                    code: badgeHtmlSnippet({ origin }),
                  },
                ]}
              />

              <h2 className="mt-12 text-2xl font-black">قواعد الشارة</h2>
              <ul className="mt-3 space-y-2 text-sm opacity-70 leading-7">
                <li>— رابط <span dir="ltr" className="font-bold">{origin.replace(/^https?:\/\//i, "")}</span> ظاهر في تذييل كل صفحة (على الأقل الصفحة الرئيسية).</li>
                <li>— بدون <code dir="ltr">rel=&quot;nofollow&quot;</code>: الرابط يجب أن ينقل السلطة (dofollow).</li>
                <li>— وصف بديل ثنائي اللغة على الصورة، أو نص ظاهر «{BADGE_ANCHOR_AR}».</li>
                <li>— لا تعديل على الصورة أو نسبها لجهة أخرى، ولا وضعها في صفحات لا علاقة لها بالموقع.</li>
                <li>— عند إعادة تصميم الموقع، يبقى الرابط قائماً.</li>
              </ul>
              <p className="mt-4 text-xs opacity-50 leading-6">
                الشارة ليست شرطاً في العقد، لكنها ممارسة معتادة في الوكالات: التعريف
                بمن صمّم الموقع. إزالتها لا تُلغي أي حق، لكنها تُضعف إشارة الثقة
                المتبادلة.
              </p>
            </div>

            <aside className="min-w-0 space-y-6">
              <div className="card-surface p-6">
                <h2 className="text-lg font-black">حالة الارتباط</h2>
                <p className="mt-1 text-xs opacity-50">
                  يُحدَّث أسبوعياً آلياً عبر <code dir="ltr">npm run badge:audit</code>.
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-[11px] uppercase tracking-widest opacity-45">موثّق</dt>
                    <dd className="text-3xl font-black text-[var(--accent)]">{stats.verified}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-widest opacity-45">nofollow</dt>
                    <dd className="text-3xl font-black">{stats.nofollow}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-widest opacity-45">بانتظار الشارة</dt>
                    <dd className="text-3xl font-black">{stats.missing + stats.pending}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-widest opacity-45">إجمالي</dt>
                    <dd className="text-3xl font-black opacity-60">{stats.total}</dd>
                  </div>
                </dl>
                <p className="mt-5 text-xs opacity-50 leading-6">
                  الرابط الموثّق الوحيد هو{" "}
                  <span dir="ltr" className="font-bold text-[var(--accent)]">
                    {canonical}
                  </span>{" "}
                  — أي نطاق مشابه لا يُعدّ شارة رسمية.
                </p>
              </div>

              <BadgeGrid />
            </aside>
          </div>
        </section>
      </div>
    </>
  );
}
