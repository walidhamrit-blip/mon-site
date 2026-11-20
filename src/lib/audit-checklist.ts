/**
 * Référentiel de l'audit « Fix & Optimize » — 46 points, 8 catégories.
 *
 * Les poids servent uniquement à prioriser le rapport : ils ne constituent
 * pas une note de classement. Toute mesure publiée doit être datée et
 * rattachée à un outil (Lighthouse, script interne, inspection manuelle).
 */
export type AuditItem = { ar: string; en: string };

export type AuditCategory = {
  id: string;
  titleAr: string;
  titleEn: string;
  /** Poids indicatif, la somme des catégories fait 100. */
  weight: number;
  items: readonly AuditItem[];
};

export const AUDIT_CATEGORIES: readonly AuditCategory[] = [
  {
    id: "disponibilite",
    titleAr: "التوفر والبنية",
    titleEn: "Availability & infrastructure",
    weight: 10,
    items: [
      { ar: "استجابة HTTP 200 للصفحة الرئيسية والصفحات التجارية", en: "HTTP 200 on the homepage and commercial pages" },
      { ar: "شهادة TLS صالحة لأكثر من 14 يوماً", en: "TLS certificate valid for more than 14 days" },
      { ar: "زمن استجابة الخادم أقل من 800 مللي ثانية", en: "Server response time under 800 ms" },
      { ar: "صفحات خطأ مخصّصة (404 و500)", en: "Custom error pages (404 and 500)" },
      { ar: "نسخة احتياطية قابلة للاسترجاع ومُختبرة", en: "A backup that has actually been restored and tested" },
    ],
  },
  {
    id: "performance",
    titleAr: "السرعة",
    titleEn: "Performance",
    weight: 20,
    items: [
      { ar: "LCP أقل من 2.5 ثانية على الهاتف", en: "LCP under 2.5 s on mobile" },
      { ar: "INP أقل من 200 مللي ثانية", en: "INP under 200 ms" },
      { ar: "CLS أقل من 0.1 (بدون قفزات)", en: "CLS under 0.1 (no layout jumps)" },
      { ar: "وزن الصفحة أقل من 1 ميغابايت", en: "Page weight under 1 MB" },
      { ar: "صور WebP/AVIF بأبعاد محددة", en: "WebP/AVIF images with explicit dimensions" },
      { ar: "تقليل JavaScript غير المستخدم", en: "Reduced unused JavaScript" },
      { ar: "تخزين مؤقت وCDN للصفحات الثابتة", en: "Caching and CDN for static pages" },
      { ar: "ضغط Brotli أو Gzip مفعّل", en: "Brotli or Gzip compression enabled" },
    ],
  },
  {
    id: "mobile",
    titleAr: "الهاتف والتخطيط",
    titleEn: "Mobile & layout",
    weight: 15,
    items: [
      { ar: "وسم viewport صحيح", en: "Correct viewport meta tag" },
      { ar: "لا تمرير أفقي على الهاتف", en: "No horizontal scrolling on mobile" },
      { ar: "أهداف لمس بقياس 44 بكسل على الأقل", en: "Touch targets at least 44 px" },
      { ar: "نص مقروء دون تكبير", en: "Text readable without zooming" },
      { ar: "قائمة الهاتف قابلة للاستخدام بلوحة المفاتيح", en: "Mobile menu usable with a keyboard" },
      { ar: "المحتوى نفسه على الهاتف والحاسوب", en: "Same content on mobile and desktop" },
    ],
  },
  {
    id: "seo",
    titleAr: "SEO تقني",
    titleEn: "Technical SEO",
    weight: 15,
    items: [
      { ar: "عنوان فريد لكل صفحة (50–60 حرفاً)", en: "Unique title per page (50–60 characters)" },
      { ar: "وصف Meta بين 120 و160 حرفاً", en: "Meta description between 120 and 160 characters" },
      { ar: "عنوان H1 واحد وتسلسل عناوين صحيح", en: "One H1 and a correct heading order" },
      { ar: "رابط Canonical صحيح", en: "Correct canonical URL" },
      { ar: "robots.txt وsitemap.xml صالحان", en: "Valid robots.txt and sitemap.xml" },
      { ar: "روابط مفهومة وقابلة للقراءة", en: "Readable, human-friendly URLs" },
      { ar: "hreflang عند تعدد اللغات", en: "hreflang when the site is multilingual" },
    ],
  },
  {
    id: "contenu",
    titleAr: "المحتوى والفهرسة",
    titleEn: "Content & indexing",
    weight: 10,
    items: [
      { ar: "محتوى فريد لكل صفحة", en: "Unique content on every page" },
      { ar: "لا صفحات فارغة أو مكرّرة", en: "No empty or duplicated pages" },
      { ar: "صفحات 404 حقيقية وليست إعادة توجيه صامتة", en: "Real 404 pages, not silent redirects" },
      { ar: "بيانات منظمة صالحة (Schema.org)", en: "Valid structured data (Schema.org)" },
      { ar: "وسوم Open Graph وTwitter", en: "Open Graph and Twitter tags" },
    ],
  },
  {
    id: "liens",
    titleAr: "الروابط وإعادة التوجيه",
    titleEn: "Links & redirects",
    weight: 10,
    items: [
      { ar: "لا روابط داخلية مكسورة (404)", en: "No broken internal links (404)" },
      { ar: "الروابط الخارجية تعمل", en: "External links resolve" },
      { ar: "إعادة توجيه 301 نظيفة", en: "Clean 301 redirects" },
      { ar: "لا سلاسل إعادة توجيه", en: "No redirect chains" },
      { ar: "كل روابط sitemap تعمل", en: "Every sitemap URL resolves" },
    ],
  },
  {
    id: "securite",
    titleAr: "الأمان والترويسات",
    titleEn: "Security & headers",
    weight: 10,
    items: [
      { ar: "HTTPS في كل الصفحات", en: "HTTPS on every page" },
      { ar: "HSTS مفعّل", en: "HSTS enabled" },
      { ar: "سياسة CSP مضبوطة", en: "A tightened Content-Security-Policy" },
      { ar: "X-Content-Type-Options وReferrer-Policy", en: "X-Content-Type-Options and Referrer-Policy" },
      { ar: "حماية النماذج (CSRF وتحديد المعدل)", en: "Form protection (CSRF and rate limiting)" },
    ],
  },
  {
    id: "accessibilite",
    titleAr: "الوصولية والبيانات",
    titleEn: "Accessibility & data",
    weight: 10,
    items: [
      { ar: "تباين ألوان كافٍ", en: "Sufficient colour contrast" },
      { ar: "نص بديل لكل صورة مفيدة", en: "Alt text on every meaningful image" },
      { ar: "أسماء واضحة للروابط والأزرار", en: "Discernible names on links and buttons" },
      { ar: "معالم الصفحة (main وnav)", en: "Page landmarks (main, nav)" },
      { ar: "بيانات JSON-LD للنشاط المحلي", en: "JSON-LD for the local business" },
    ],
  },
] as const;

export const AUDIT_ITEM_COUNT = AUDIT_CATEGORIES.reduce(
  (total, category) => total + category.items.length,
  0,
);

export const AUDIT_WEIGHT_TOTAL = AUDIT_CATEGORIES.reduce(
  (total, category) => total + category.weight,
  0,
);
