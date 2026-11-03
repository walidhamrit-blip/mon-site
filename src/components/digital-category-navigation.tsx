import { LocalizedLink as Link } from "@/components/localized-link";
import { categoryHref, digitalCategories } from "@/lib/digital-categories";
import type { DigitalKind } from "@/lib/digital-types";

export function DigitalCategoryNavigation({ ar, current }: { ar: boolean; current?: DigitalKind }) {
  return (
    <nav aria-label={ar ? "تصفح فئات الأكواد" : "Browse code categories"} className="site-container flex flex-wrap gap-2 px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/codes" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold">{ar ? "كل المنتجات" : "All products"}</Link>
      {digitalCategories.map((category) => (
        <Link key={category.kind} href={categoryHref(category.kind)} aria-current={current === category.kind ? "page" : undefined} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold hover:underline">
          {ar ? category.ar : category.en}
        </Link>
      ))}
    </nav>
  );
}
