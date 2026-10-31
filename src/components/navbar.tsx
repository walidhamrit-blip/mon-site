"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Menu, Moon, Sun, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "./theme-provider";
import { ThemeSwitcher, ThemeList } from "./theme-switcher";
import { LocaleSwitcher } from "./locale-switcher";
import { CurrencySwitcher } from "./currency-switcher";
import { useSiteConfig } from "@/components/site-provider";
import { marketLabels, resolveMarket } from "@/lib/market";
import { primaryNavigation } from "@/lib/site-hierarchy";
import { whatsappLink } from "@/lib/utils";

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
  const { locale } = useI18n();
  const { mode, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const ar = locale === "ar";
  // Marché de référence : la mention sous le logo suit le réglage /admin.
  const market = resolveMarket(siteConfig.market);
  const marketText = marketLabels(market, locale);

  // Panneau mobile : verrouille le fond et laisse Échap fermer.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
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
    router.push("/creation-sites#lead-form");
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
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls="mobile-menu"
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 flex flex-col bg-[var(--background)]/95 pt-[84px] backdrop-blur-xl lg:hidden"
          >
            <div className="site-container flex-1 overflow-y-auto px-4 pb-10 sm:px-6">
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-lg)] sm:p-6">
                <nav aria-label={ar ? "قائمة الجوال" : "Mobile menu"} className="flex flex-col gap-1">
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors hover:bg-[var(--secondary)] ${
                        isActive(link.href) ? "bg-[var(--secondary)] font-bold" : ""
                      }`}
                    >
                      <span>{link.label}</span>
                      <ArrowUpRight className="h-4 w-4 opacity-30 rtl:rotate-180" />
                    </Link>
                  ))}
                </nav>

                <div className="mt-5 border-t border-[var(--border)] pt-5">
                  <LocaleSwitcher variant="list" />
                </div>

                <div className="mt-5 border-t border-[var(--border)] pt-5">
                  <ThemeList />
                </div>

                <div className="mt-5 border-t border-[var(--border)] pt-5 lg:hidden">
                  <CurrencySwitcher variant="list" />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  <a
                    href={whatsappLink(siteConfig.whatsapp, whatsappMsg)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-11 place-items-center rounded-full bg-[#25D366] text-[13.5px] font-bold text-white"
                  >
                    WhatsApp
                  </a>
                  <button
                    onClick={quote}
                    className="h-11 cursor-pointer rounded-full bg-[var(--primary)] text-[13.5px] font-bold text-[var(--primary-foreground)]"
                  >
                    {ar ? "طلب عرض" : "Get quote"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
