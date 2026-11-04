"use client";
import { useEffect, useRef, useState } from "react";
import { LocalizedLink as Link } from "@/components/localized-link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ChevronDown, Menu, Moon, Sun, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "./theme-provider";
import { ThemeSwitcher, ThemeList } from "./theme-switcher";
import { LocaleSwitcher } from "./locale-switcher";
import { CurrencySwitcher } from "./currency-switcher";
import { useSiteConfig } from "@/components/site-provider";
import { marketLabels, resolveMarket } from "@/lib/market";
import { primaryNavigation } from "@/lib/site-hierarchy";
import { whatsappLink } from "@/lib/utils";
import { localizedPath } from "@/lib/locale";

/**
 * Quatre destinations principales, identiques sur ordinateur et mobile.
 *
 * - un seul lien actif surligné (`usePathname`) ;
 * - menu mobile en panneau plein écran, défilement de la page verrouillé ;
 * - fermeture au clavier (Échap) et au changement de page ;
 * - barre DANS LE FLUX de la page (elle défile avec le contenu).
 */
export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const siteConfig = useSiteConfig();
  const { locale, defaultLocale } = useI18n();
  const { mode, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const ar = locale === "ar";
  // Marché de référence : la mention sous le logo suit le réglage /admin.
  const market = resolveMarket(siteConfig.market);
  const marketText = marketLabels(market, locale);

  // Panneau mobile : dialogue modal, fond verrouillé, focus piégé et rendu
  // au bouton d'ouverture. Les widgets flottants sont masqués via CSS.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : toggleRef.current;
    document.body.style.overflow = "hidden";
    document.documentElement.setAttribute("data-mobile-menu", "open");

    const focusables = () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), summary, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => {
        if (element.offsetParent === null) return false;
        // Le contenu d'un <details> fermé ne doit pas entrer dans le cycle Tab.
        const details = element.closest("details");
        if (details && !details.open && element.tagName !== "SUMMARY") return false;
        return true;
      });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !menuRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !menuRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    const frame = window.requestAnimationFrame(() => focusables()[0]?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.documentElement.removeAttribute("data-mobile-menu");
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [open]);

  // Fermeture du panneau mobile au changement de page : ajustée pendant le
  // rendu (motif recommandé par React) plutôt que dans un effet.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    if (open) setOpen(false);
  }

  const links = primaryNavigation.map((link) => ({ href: link.href, label: ar ? link.ar : link.en }));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const whatsappMsg = ar
    ? `مرحبا نخبة 👋 أريد موقع لنشاطي. هل يمكننا التحدث؟`
    : `Hello Nukhba 👋 I want a website for my business. Can we talk?`;

  const quote = () => {
    setOpen(false);
    router.push(localizedPath("/creation-sites#lead-form", locale, defaultLocale));
  };

  return (
    <>
      <header className="public-header relative z-50 border-b border-[var(--border)] bg-[var(--background)] py-3">
        <div className="site-container px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 px-1 py-2 sm:px-4">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label={siteConfig.name}>
              <span className="gaming-brand grid h-9 w-9 place-items-center bg-[var(--primary)] text-sm font-black text-[var(--primary-foreground)] transition-transform group-hover:scale-105">
                {ar ? "ن" : "N"}
              </span>
              <span className="leading-none">
                <span className="flex items-center gap-1.5 text-[16px] font-black tracking-tight">
                  {siteConfig.name}
                  <span className="hidden text-[10px] font-normal tracking-[0.2em] opacity-55 sm:inline">
                    {ar ? "نخبة" : "NUKHBA"}
                  </span>
                </span>
                <span className="mt-1 hidden text-[10.5px] text-[var(--muted-foreground)] sm:block">
                  {ar
                    ? `${marketText.city} · خدمات رقمية`
                    : `${marketText.city} · Digital services`}
                </span>
              </span>
            </Link>

            <nav
              aria-label={ar ? "التنقل الرئيسي" : "Main navigation"}
              className="primary-menu hidden min-w-0 items-center gap-1 lg:flex"
            >
              {links.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-medium transition-colors ${active ? "bg-[var(--card)] font-bold text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                  >
                    {link.label}

                  </Link>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-1.5">
              {/* Langue : l'arabe est la langue principale, l'anglais reste à
                  un clic (choix mémorisé sur l'appareil du visiteur). */}
              <LocaleSwitcher />
              <div className="hidden xl:block">
                <CurrencySwitcher />
              </div>
              <button
                onClick={toggle}
                aria-label={ar ? "تبديل الوضع الفاتح والداكن" : "Toggle light / dark mode"}
                title={ar ? "فاتح / داكن" : "Light / dark"}
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-[var(--secondary)] transition-colors hover:bg-[var(--muted)]"
              >
                {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              {/* Sélecteur des 6 thèmes classés : visible dès `lg`, sinon dans
                  le menu mobile — il ne doit jamais être inaccessible. */}
              <div className="hidden lg:block">
                <ThemeSwitcher />
              </div>
              <a
                href={whatsappLink(siteConfig.whatsapp, whatsappMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden h-9 items-center gap-1.5 rounded-full bg-[var(--secondary)] px-4 text-[12.5px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] 2xl:inline-flex"
              >
                WhatsApp
              </a>
              <button
                onClick={quote}
                className="hidden h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-[12.5px] font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 sm:inline-flex"
              >
                {ar ? "طلب عرض" : "Get quote"}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>

              <button
                ref={toggleRef}
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-haspopup="dialog"
                aria-label={open ? (ar ? "إغلاق القائمة" : "Close menu") : ar ? "فتح القائمة" : "Open menu"}
                className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] lg:hidden"
              >
                {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-menu-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex flex-col bg-[var(--background)] lg:hidden"
          >
            <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-[var(--border)] px-4 sm:px-6">
              <span id="mobile-menu-title" className="text-[17px] font-black">
                {ar ? "القائمة" : "Menu"}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={ar ? "إغلاق القائمة" : "Close menu"}
                className="grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-[var(--secondary)] transition-colors hover:bg-[var(--muted)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="site-container flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-lg)] sm:p-6">
                <nav aria-label={ar ? "قائمة الجوال" : "Mobile menu"} className="flex flex-col gap-1">
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-11 items-center justify-between rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors hover:bg-[var(--secondary)] ${
                        isActive(link.href) ? "bg-[var(--secondary)] font-bold" : ""
                      }`}
                    >
                      <span>{link.label}</span>
                      <ArrowUpRight className="h-4 w-4 opacity-30 rtl:rotate-180" />
                    </Link>
                  ))}
                </nav>

                {/* Actions commerciales avant les préférences secondaires. */}
                <div className="mt-5 grid gap-2.5">
                  <button
                    type="button"
                    onClick={quote}
                    className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-[14px] font-bold text-[var(--primary-foreground)]"
                  >
                    {ar ? "طلب عرض" : "Get quote"}
                    <ArrowUpRight className="h-4 w-4 rtl:rotate-180" />
                  </button>
                  <a
                    href={whatsappLink(siteConfig.whatsapp, whatsappMsg)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#0B6B3A] px-4 text-[14px] font-bold text-white"
                  >
                    WhatsApp
                  </a>
                </div>

                <details className="group mt-5 border-t border-[var(--border)] pt-5">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-4 py-3 text-[14px] font-bold transition-colors hover:bg-[var(--secondary)] [&::-webkit-details-marker]:hidden">
                    {ar ? "تخصيص العرض" : "Customize display"}
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-4 space-y-5">
                    <LocaleSwitcher variant="list" />
                    <ThemeList />
                    <CurrencySwitcher variant="list" />
                  </div>
                </details>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
