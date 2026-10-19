"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Moon, Sun, Globe, ArrowUpRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "./theme-provider";
import { ThemeSwitcher, ThemeList } from "./theme-switcher";
import { useSiteConfig } from "@/components/site-provider";
import { Button } from "./ui/button";
import { whatsappLink } from "@/lib/utils";

export function Navbar() {
  const siteConfig = useSiteConfig();
  const { locale, t, toggleLocale, dir } = useI18n();
  const { mode, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#demos", label: t.nav.demos },
    { href: "#pricing", label: t.nav.pricing },
    { href: "#services", label: t.nav.services },
    { href: "/demos", label: locale === "ar" ? "كل المعارض" : "All demos" },
    { href: "/contact", label: t.nav.contact },
  ];

  const whatsappMsg = locale === "ar"
    ? `مرحبا نخبة 👋 أريد موقع لنشاطي. هل يمكننا التحدث؟`
    : `Hello Nukhba 👋 I want a website for my business. Can we talk?`;

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? "py-3" : "py-5"
        }`}
      >
        <div className="site-container px-4 sm:px-6">
          <div
            className={`flex items-center justify-between rounded-full px-4 sm:px-6 py-3 transition-all duration-300 ${
              scrolled
                ? "bg-[var(--card)]/80 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-[var(--border)]"
                : "bg-[var(--card)]/60 backdrop-blur-md border border-[var(--border)]/50"
            }`}
          >
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-9 w-9 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] grid place-items-center font-black text-sm tracking-tight">
                ن
              </div>
              <div className="leading-none">
                <div className="font-black text-[17px] tracking-tight flex items-center gap-1.5">
                  {siteConfig.name}
                  <span className="font-normal text-[11px] tracking-[0.2em] opacity-60 hidden sm:inline">
                    {locale === "ar" ? "نخبة" : "NUKHBA"}
                  </span>
                </div>
                <div className="text-[11px] opacity-60 hidden sm:block">
                  {locale === "ar" ? "طرابلس • مواقع فاخرة" : "Tripoli • Premium Sites"}
                </div>
              </div>
            </Link>

            <nav aria-label={locale === "ar" ? "التنقل الرئيسي" : "Main navigation"} className="hidden lg:flex items-center gap-1 bg-[var(--secondary)] rounded-full p-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-4 py-1.5 rounded-full text-sm font-medium hover:bg-[var(--card)] transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleLocale}
                aria-label="Toggle language"
                className="h-9 px-3 rounded-full bg-[var(--secondary)] flex items-center gap-1.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors cursor-pointer"
              >
                <Globe className="h-3.5 w-3.5" />
                {locale === "ar" ? "EN" : "عربي"}
              </button>
              {/* Bouton dédié au mode clair / sombre (indépendant du thème) */}
              <button
                onClick={toggle}
                aria-label={locale === "ar" ? "تبديل الوضع الفاتح والداكن" : "Toggle light / dark mode"}
                title={locale === "ar" ? "فاتح / داكن" : "Light / dark"}
                className="h-9 w-9 rounded-full bg-[var(--secondary)] grid place-items-center hover:bg-[var(--muted)] transition-colors cursor-pointer"
              >
                {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              {/* Bouton dédié au thème de couleurs */}
              <div className="hidden sm:block">
                <ThemeSwitcher />
              </div>
              <a
                href={whatsappLink(siteConfig.whatsapp, whatsappMsg)}
                target="_blank"
                rel="noopener"
                className="hidden sm:inline-flex h-9 px-5 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] items-center gap-1.5 text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors"
              >
                {locale === "ar" ? "واتساب" : "WhatsApp"}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <Button
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" })}
              >
                {locale === "ar" ? "طلب عرض" : "Get quote"}
              </Button>

              <button
                onClick={() => setOpen((v) => !v)}
                className="lg:hidden h-9 w-9 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] grid place-items-center cursor-pointer"
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
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 lg:hidden pt-[92px] px-4"
          >
            <div className="bg-[var(--card)] rounded-[24px] border border-[var(--border)] p-6 shadow-2xl">
              <nav aria-label={locale === "ar" ? "قائمة الجوال" : "Mobile menu"} className="flex flex-col gap-2">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="px-4 py-3 rounded-xl hover:bg-[var(--secondary)] font-medium"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-6">
                <div className="mb-2 text-xs font-black opacity-60">
                  {locale === "ar" ? "ثيمات الموقع" : "Site themes"}
                </div>
                <ThemeList />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <a
                  href={whatsappLink(siteConfig.whatsapp, whatsappMsg)}
                  target="_blank"
                  className="h-11 rounded-full bg-[#25D366] text-white grid place-items-center font-semibold"
                >
                  WhatsApp
                </a>
                <button
                  onClick={() => {
                    setOpen(false);
                    document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="h-11 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold"
                >
                  {locale === "ar" ? "طلب عرض" : "Quote"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
