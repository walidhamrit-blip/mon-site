import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الصفحة غير موجودة — Page not found (404)",
  robots: { index: false, follow: false },
};

/** Page 404 dédiée : garde le visiteur dans le site plutôt qu'un écran nu. */
export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center px-4 pt-24 pb-16">
      <div className="max-w-[520px] text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] grid place-items-center text-2xl font-black">
          404
        </div>
        <h1 className="mt-6 text-3xl sm:text-4xl font-black tracking-tight">
          الصفحة غير موجودة
        </h1>
        <p className="mt-3 text-sm sm:text-base opacity-60 leading-7">
          يبدو أن الرابط الذي تتبعه لم يعد متاحاً أو تغيّر. لا تقلق — كل
          أعمالنا وباقاتنا لا تبعد سوى نقرة واحدة.
        </p>
        <p lang="en" dir="ltr" className="mt-1 text-xs opacity-50">
          The page you are looking for doesn’t exist or has moved.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="h-11 px-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold text-sm inline-flex items-center hover:bg-[var(--accent-hover)] transition-colors"
          >
            العودة للرئيسية
          </Link>
          <Link
            href="/demos"
            className="h-11 px-6 rounded-full border border-[var(--border)] font-bold text-sm inline-flex items-center hover:bg-[var(--secondary)] transition-colors"
          >
            تصفّح المعارض
          </Link>
        </div>
      </div>
    </main>
  );
}
