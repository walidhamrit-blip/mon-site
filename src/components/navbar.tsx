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
import { whatsappLink } from "@/lib/utils";

/**
 * Barre de navigation flottante.
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
  const { locale, t } = useI18n();
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

  /**
   * Liens de la barre haute.
   *
   * `hideBelow` indique la largeur à partir de laquelle le lien s'affiche :
   * la barre défile horizontalement sur les écrans étroits (pas de
   * débordement de la page), et les liens secondaires n'apparaissent que
   * lorsqu'il y a la place — ils restent accessibles dans le pied de page
   * et dans le menu mobile.
   */
  const links = [
    { href: "/services", label: ar ? "خدمات سريعة" : "Open services" },
    { href: "/compare", label: ar ? "مقارنات" : "Comparisons" },
    { href: "/demos", label: t.nav.demos },
    {
      // La boutique est le second métier du site (clés de jeux, codes
      // logiciels, cartes cadeaux) : le lien reste visible à TOUTES les
      // largeurs. Il était masqué sous 1280 px — donc absent du haut de page
      // sur la majorité des portables et sur tous les mobiles.
      href: "/codes",
      label: ar ? "المتجر الرقمي" : "Digital store",
    },
    {
      href: "/products",
      label: ar ? "منتجاتنا" : "Products",
      soon: true,
      hideBelow: "xl",
    },
    {
      href: "/apps",
      label: ar ? "تطبيقاتنا" : "Apps",
      soon: true,
      hideBelow: "2xl",
    },
    { href: "/blog", label: ar ? "أدلة" : "Guides" },
    { href: "/#pricing", label: t.nav.pricing },
    {
      href: "/abonnements",
      label: ar ? "الاشتراكات" : "Subscriptions",
      hideBelow: "2xl",
    },
    { href: "/contact", label: t.nav.contact },
  ];


  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const whatsappMsg = ar
    ? `مرحبا نخبة 👋 أريد موقع لنشاطي. هل يمكننا التحدث؟`
    : `Hello Nukhba 👋 I want a website for my business. Can we talk?`;

  const quote = () => {
    setOpen(false);
    if (pathname === "/") {
      document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push("/#lead-form");
    }
  };

  return (
    <>
      <header className="relative z-50 py-4">
        <div className="site-container px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 rounded-full border border-[var(--border)]/60 bg-[var(--card)]/70 px-3 py-2.5 backdrop-blur-md sm:px-4">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label={siteConfig.name}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--primary)] text-sm font-black text-[var(--primary-foreground)] transition-transform group-hover:scale-105">
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
                    ? `${marketText.city} · مواقع فاخرة`
                    : `${marketText.city} · Premium sites`}
                </span>
              </span>
            </Link>

            <nav
              aria-label={ar ? "التنقل الرئيسي" : "Main navigation"}
              className="hidden min-w-0 items-center gap-0 overflow-x-auto rounded-full bg-[var(--secondary)]/80 p-1 lg:flex xl:gap-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {links.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1.5 text-[12.5px] font-medium transition-colors xl:px-2.5 xl:text-[13px] ${
                      link.hideBelow === "xl"
                        ? "max-xl:hidden"
                        : link.hideBelow === "2xl"
                          ? "max-2xl:hidden"
                          : ""
                    } ${
                      active
                        ? "bg-[var(--card)] font-bold text-[var(--foreground)] shadow-[var(--shadow-xs)]"
                        : "text-[var(--foreground)]/75 hover:bg-[var(--card)]/80 hover:text-[var(--foreground)]"
                    }`}
                  >
                    {link.label}
                    {link.soon && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                        aria-label={ar ? "قريباً" : "Soon"}
                      />
                    )}
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
                      {link.soon ? (
                        <span className="rounded-full bg-[var(--accent)]/15 px-2.5 py-0.5 text-[10.5px] font-black text-[var(--accent)]">
                          {ar ? "قريباً" : "Soon"}
                        </span>
                      ) : (
                        <ArrowUpRight className="h-4 w-4 opacity-30 rtl:rotate-180" />
                      )}
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
