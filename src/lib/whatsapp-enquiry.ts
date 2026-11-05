/** Only public catalogue/editorial routes may be included in an enquiry.
 * Never include query strings, fragments, order references or tracking pages. */
export function publicEnquiryPage(pathname: string, title: string): { path: string; title: string } | null {
  const path = pathname.replace(/\/$/, "") || "/";
  const staticPages = new Set(["/", "/codes", "/services", "/pricing", "/creation-sites", "/demos", "/sectors", "/blog", "/compare", "/apps", "/products", "/abonnements", "/contact", "/badge"]);
  const detail = /^\/(services|demos|sectors|blog|compare|codes)\/([a-zA-Z0-9-]+)$/.exec(path);
  const reserved = new Set(["commande", "suivi", "checkout", "order", "orders", "tracking"]);
  if (!staticPages.has(path) && !(detail && !reserved.has(detail[2].toLowerCase()))) return null;
  return { path, title: title.trim().slice(0, 200) };
}

export function buildEnquiryMessage(locale: "ar" | "en", subject: string, page: { path: string; title: string } | null): string {
  const question = subject.trim();
  if (locale === "ar") {
    return `مرحباً نخبة 👋\nأريد الاستفسار عن: ${question}${page ? `\nالصفحة التي كنت أتصفحها: ${page.title || page.path}\nمسار الصفحة: ${page.path}` : ""}`;
  }
  return `Hello Nukhba 👋\nI'd like to ask about: ${question}${page ? `\nPage I was viewing: ${page.title || page.path}\nPage path: ${page.path}` : ""}`;
}
