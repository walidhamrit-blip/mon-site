"use client";
import { useEffect, useRef, useState } from "react";
import { LocalizedLink as Link } from "@/components/localized-link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "framer-motion";
import { ArrowUpRight, ChevronDown, Menu, Moon, Sun, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "./theme-provider";
import { ThemeSwitcher, ThemeList } from "./theme-switcher";
import { LocaleSwitcher } from "./locale-switcher";
import { CurrencySwitcher } from "./currency-switcher";
import { useSiteConfig } from "@/components/site-provider";
import { marketLabels, resolveMarket } from "@/lib/market";
import { primaryNavigation } from "@/lib/site-hierarchy";
import {
  universeBrands,
  universeNavigation,
  universePrimaryAction,
  universeSwitcher,
  universeUsesVisitorPalette,
} from "@/lib/universes";
import { useUniverse } from "@/components/universe-shell";
import { WhatsAppEnquiry } from "@/components/whatsapp-enquiry";

/**
 * En-tête adapté à l'univers courant (src/lib/universes.ts) :
 *
 * - accueil / pages communes : quatre destinations principales ;
 * - boutique : catégories du catalogue + « Suivre ma commande » ;
 * - studio web : offres, exemples, tarifs + « Demander un devis ».
 *
 * Une barre de marque discrète (au-dessus, non collante) rappelle que les
 * deux univers sont des services Nukhba et permet de passer de l'un à l'autre.
 *
 * - un seul lien actif surligné (`usePathname`) ;
 * - menu mobile en panneau plein écran, défilement de la page verrouillé ;
 * - fermeture au clavier (Échap) et au changement de page ;
 * - barre collante compacte : elle reste visible pendant le défilement.
 */
export function Navbar() {
  const pathname = usePathname();
  const universe = useUniverse();
  const siteConfig = useSiteConfig();
  const { locale } = useI18n();
  const { mode, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  // Sous-menu « المنتجات الرقمية » (ordinateur) : motif « disclosure », pas
  // de rôle ARIA menu — ce sont de simples liens de navigation.
  const [submenu, setSubmenu] = useState<string | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const hoverOpened = useRef(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  // Les barres collantes secondaires (ancres création, filtres boutique)
  // se calent sur la hauteur réelle du header, qui varie selon la langue
  // et la largeur d'écran.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        "--public-header-height",
        `${Math.ceil(header.getBoundingClientRect().height)}px`,
      );
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
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
    if (submenu) setSubmenu(null);
  }

  // Sous-menu ouvert : fermeture par Échap (focus rendu au bouton) ou clic extérieur.
  useEffect(() => {
    if (!submenu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSubmenu(null);
      submenuRef.current?.querySelector<HTMLButtonElement>("button[aria-expanded]")?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!submenuRef.current?.contains(event.target as Node)) setSubmenu(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [submenu]);

  // Ordre de lecture : sites → applications (bientôt) → produits numériques
  // (une catégorie, ses rayons en sous-menu) → contact.
  const hubLinks = primaryNavigation.map((link) => ({
    href: link.href,
    label: ar ? link.ar : link.en,
    soon: Boolean(link.soon),
    children: (link.children ?? []).map((child) => ({ href: child.href, label: ar ? child.ar : child.en })),
  }));
  const links =
    universe === "hub"
      ? hubLinks
      : universeNavigation[universe].map((link) => ({
          href: link.href,
          label: ar ? link.ar : link.en,
          soon: Boolean(link.soon),
          children: [] as { href: string; label: string }[],
        }));
  const soonLabel = ar ? "قريباً" : "Soon";
  const brand = universeBrands[universe];
  const tagline = (ar ? brand.taglineAr : brand.taglineEn).replace("{city}", marketText.city);
  // Le sélecteur de palette ne concerne que la boutique : le studio et
  // l'accueil gardent une identité sobre et fixe (le mode clair/sombre reste).
  const showPalette = universeUsesVisitorPalette(universe);

  // Un lien est actif sur son chemin exact ; l'accueil d'univers (`/codes`,
  // `/creation-sites`) l'est aussi sur ses sous-pages non listées au menu.
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (pathname === href) return true;
    if (!pathname.startsWith(`${href}/`)) return false;
    return !links.some((link) => link.href !== href && link.href.startsWith(`${href}/`) && (pathname === link.href || pathname.startsWith(`${link.href}/`)));
  };

  // Action principale : un vrai lien (Ctrl/Cmd+clic, clic du milieu, menu
  // contextuel), localisé par LocalizedLink comme le reste de la navigation.
  // Devis sur l'accueil et le studio, suivi de commande dans la boutique.
  const primaryAction = universePrimaryAction[universe];
  const quoteHref = primaryAction.href;
  const quoteLabel = ar ? primaryAction.ar : primaryAction.en;

  return (
    <>
      <nav
        aria-label={ar ? "خدمات نخبة" : "Nukhba services"}
        className="universe-bar border-b border-[var(--border)] bg-[var(--secondary)] text-[12px]"
      >
        <div className="site-container flex items-center gap-1 overflow-x-auto px-4 sm:px-6">
          {universeSwitcher.map((item) => (
            <Link
              key={item.universe}
              href={item.href}
              aria-current={item.universe === universe ? "true" : undefined}
              data-universe-link={item.universe}
              className="universe-bar-link inline-flex min-h-9 shrink-0 items-center whitespace-nowrap px-3 font-semibold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              {ar ? item.ar : item.en}
            </Link>
          ))}
        </div>
      </nav>
      <header ref={headerRef} className="public-header sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 py-3 backdrop-blur-md">
        <div className="site-container px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 px-1 py-2 sm:px-4">
            <Link href={brand.home} className="group flex min-h-11 min-w-0 items-center gap-2.5">
              <span className="gaming-brand grid h-9 w-9 shrink-0 place-items-center bg-[var(--primary)] text-sm font-black text-[var(--primary-foreground)] transition-transform group-hover:scale-105">
                {ar ? "ن" : "N"}
              </span>
              <span className="min-w-0 leading-none">
                <span className="flex items-center gap-1.5 text-[16px] font-black tracking-tight">
                  <span className="truncate">{universe === "hub" ? siteConfig.name : ar ? brand.nameAr : brand.nameEn}</span>
                  {universe === "hub" ? (
                    <span className="hidden text-[10px] font-normal tracking-[0.2em] text-[var(--muted-foreground)] sm:inline">
                      {ar ? "نخبة" : "NUKHBA"}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 hidden text-[10.5px] text-[var(--muted-foreground)] sm:block">{tagline}</span>
              </span>
            </Link>

            <nav
              aria-label={ar ? "التنقل الرئيسي" : "Main navigation"}
              className="primary-menu hidden min-w-0 items-center gap-1 lg:flex"
            >
              {links.map((link) => {
                const active = isActive(link.href);
                const item = (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-medium transition-colors ${active ? "bg-[var(--card)] font-bold text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                  >
                    {link.label}
                    {link.soon ? <span className="nav-soon-badge">{soonLabel}</span> : null}
                  </Link>
                );
                if (link.children.length === 0) return item;
                const submenuId = `submenu-${link.href.replace(/\W+/g, "") || "root"}`;
                const expanded = submenu === link.href;
                return (
                  <div
                    key={link.href}
                    ref={submenuRef}
                    className="nav-dropdown relative flex items-center"
                    onMouseEnter={() => {
                      if (submenu !== link.href) hoverOpened.current = true;
                      setSubmenu(link.href);
                    }}
                    onMouseLeave={() => {
                      hoverOpened.current = false;
                      setSubmenu((value) => (value === link.href ? null : value));
                    }}
                  >
                    {item}
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={submenuId}
                      aria-label={ar ? `فئات ${link.label}` : `${link.label} categories`}
                      onClick={() => {
                        // Ouvert par le survol juste avant : le clic confirme au lieu de refermer.
                        if (hoverOpened.current) { hoverOpened.current = false; return; }
                        setSubmenu((value) => (value === link.href ? null : link.href));
                      }}
                      className="nav-dropdown-toggle -ms-2 grid h-11 w-7 cursor-pointer place-items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    <div id={submenuId} hidden={!expanded} className="nav-dropdown-panel absolute top-full z-50 min-w-60 pt-2 [inset-inline-start:0]">
                      <ul className="rounded-xl border border-[var(--border)] bg-[var(--popover)] p-2 text-[var(--popover-foreground)] shadow-[var(--shadow-lg)]">
                        <li>
                          <Link href={link.href} className="flex min-h-11 items-center rounded-lg px-3 text-[13px] font-bold hover:bg-[var(--secondary)]">
                            {ar ? "كل المنتجات الرقمية" : "All digital products"}
                          </Link>
                        </li>
                        {link.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              aria-current={pathname === child.href ? "page" : undefined}
                              className="flex min-h-11 items-center rounded-lg px-3 text-[13px] font-semibold text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
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
                className="grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-[var(--secondary)] transition-colors hover:bg-[var(--muted)]"
              >
                {mode === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
              </button>
              {/* Sélecteur des 6 thèmes classés : visible dès `lg`, sinon dans
                  le menu mobile — il ne doit jamais être inaccessible. */}
              {showPalette ? (
                <div className="hidden lg:block">
                  <ThemeSwitcher />
                </div>
              ) : null}
              <WhatsAppEnquiry
                source="navbar-desktop"
                className="hidden h-11 items-center gap-1.5 rounded-full bg-[var(--secondary)] px-4 text-[12.5px] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] 2xl:inline-flex"
              >
                WhatsApp
              </WhatsAppEnquiry>
              <Link
                href={quoteHref}
                className="hidden h-11 items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-[12.5px] font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 sm:inline-flex"
              >
                {quoteLabel}
                <ArrowUpRight className="h-3.5 w-3.5 rtl:rotate-[-90deg]" aria-hidden="true" />
              </Link>

              <button
                ref={toggleRef}
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-haspopup="dialog"
                aria-label={open ? (ar ? "إغلاق القائمة" : "Close menu") : ar ? "فتح القائمة" : "Open menu"}
                className="grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] lg:hidden"
              >
                {open ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <m.div
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
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="site-container flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-lg)] sm:p-6">
                <nav aria-label={ar ? "قائمة الجوال" : "Mobile menu"} className="flex flex-col gap-1">
                  {links.map((link) => (
                    <div key={link.href}>
                      <Link
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className={`flex min-h-11 items-center justify-between rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors hover:bg-[var(--secondary)] ${
                          isActive(link.href) ? "bg-[var(--secondary)] font-bold" : ""
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          {link.label}
                          {link.soon ? <span className="nav-soon-badge">{soonLabel}</span> : null}
                        </span>
                        <ArrowUpRight className="h-4 w-4 opacity-30 rtl:rotate-[-90deg]" aria-hidden="true" />
                      </Link>
                      {link.children.length > 0 ? (
                        <ul className="mb-1 ms-4 border-s border-[var(--border)] ps-2">
                          {link.children.map((child) => (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={() => setOpen(false)}
                                className="flex min-h-11 items-center rounded-lg px-3 text-[14px] font-medium text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </nav>

                {/* Actions commerciales avant les préférences secondaires. */}
                <div className="mt-5 grid gap-2.5">
                  <Link
                    href={quoteHref}
                    onClick={() => setOpen(false)}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-[14px] font-bold text-[var(--primary-foreground)]"
                  >
                    {quoteLabel}
                    <ArrowUpRight className="h-4 w-4 rtl:rotate-[-90deg]" aria-hidden="true" />
                  </Link>
                  <WhatsAppEnquiry
                    source="navbar-mobile"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#0B6B3A] px-4 text-[14px] font-bold text-white"
                  >
                    WhatsApp
                  </WhatsAppEnquiry>
                </div>

                <details className="group mt-5 border-t border-[var(--border)] pt-5">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-4 py-3 text-[14px] font-bold transition-colors hover:bg-[var(--secondary)] [&::-webkit-details-marker]:hidden">
                    {ar ? "تخصيص العرض" : "Customize display"}
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="mt-4 space-y-5">
                    <LocaleSwitcher variant="list" />
                    {showPalette ? <ThemeList /> : null}
                    <CurrencySwitcher variant="list" />
                  </div>
                </details>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
