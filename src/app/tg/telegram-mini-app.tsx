"use client";

import Script from "next/script";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildMiniAppBrands,
  buildMiniAppRegionChips,
  filterMiniAppProducts,
  formatMiniAppUsd,
  miniAppBrandHeading,
  miniAppBrandLabel,
  miniAppInitials,
  miniAppOpensExternally,
  miniAppProductHref,
  miniAppRegionLabel,
  miniAppRegionNote,
  resolveMiniAppLocale,
  TELEGRAM_WEB_APP_SCRIPT,
  type MiniAppCategory,
  type MiniAppLocale,
  type MiniAppProduct,
} from "@/lib/telegram-mini-app-core";
import styles from "./telegram-mini-app.module.css";

/* ------------------------------------------------------------------ */
/* SDK Telegram : seul le sous-ensemble utilisé est typé.             */
/* ------------------------------------------------------------------ */

interface TelegramBottomButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    user?: { first_name?: string; language_code?: string; photo_url?: string };
  };
  platform?: string;
  colorScheme?: "light" | "dark";
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  openLink?(url: string): void;
  openTelegramLink?(url: string): void;
  onEvent?(event: string, cb: () => void): void;
  offEvent?(event: string, cb: () => void): void;
  BackButton?: TelegramBottomButton;
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    selectionChanged(): void;
  };
  /** Stockage persistant de la Mini App (préférence de thème, entre visites). */
  CloudStorage?: {
    getItem(key: string, callback: (error: string | null, value: string | null) => void): void;
    setItem(key: string, value: string, callback: (error: string | null) => void): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function telegramApp(): TelegramWebApp | null {
  const app = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  // Hors Telegram, le SDK se charge quand même mais `platform` vaut « unknown ».
  return app && app.platform && app.platform !== "unknown" ? app : null;
}

/* ------------------------------------------------------------------ */
/* Textes                                                             */
/* ------------------------------------------------------------------ */

const COPY = {
  ar: {
    hello: "مرحباً",
    welcome: "أهلاً بك 👋",
    badge: "تسليم فوري",
    heroTitle: "بطاقتك المثالية، في ثوانٍ.",
    heroCta: "استكشف المتجر",
    search: "ابحث عن بطاقة أو لعبة…",
    categories: "الفئات",
    results: "النتائج",
    products: "الأكثر طلباً",
    brands: "العلامات التجارية",
    backToCategories: "الفئات",
    allRegions: "كل المناطق",
    count: (n: number) => `${n} منتج`,
    brandsCount: (n: number) => `${n} علامة`,
    from: "ابتداءً من",
    empty: "لا توجد نتائج.\nجرّب كلمة أخرى.",
    more: "عرض المزيد",
    help: "تحتاج مساعدة؟",
    helpSub: "تواصل معنا مباشرة على واتساب",
    usd: "الأسعار بالدولار الأمريكي (1 USD = 1 USDT) — التسليم فور تأكيد الدفع.",
    degraded: "المتجر في صيانة قصيرة — قد لا تظهر كل المنتجات.",
    lang: "EN",
  },
  en: {
    hello: "Hi",
    welcome: "Welcome 👋",
    badge: "Instant delivery",
    heroTitle: "The perfect card, in seconds.",
    heroCta: "Explore the store",
    search: "Search a card or a game…",
    categories: "Categories",
    results: "Results",
    products: "Most popular",
    brands: "Brands",
    backToCategories: "Categories",
    allRegions: "All regions",
    count: (n: number) => `${n} product${n > 1 ? "s" : ""}`,
    brandsCount: (n: number) => `${n} brand${n > 1 ? "s" : ""}`,
    from: "From",
    empty: "No results.\nTry another word.",
    more: "Show more",
    help: "Need help?",
    helpSub: "Message us directly on WhatsApp",
    usd: "Prices in USD (1 USD = 1 USDT) — delivered as soon as payment is confirmed.",
    degraded: "The store is under short maintenance — some products may be missing.",
    lang: "ع",
  },
} as const;

const PAGE_SIZE = 24;

/* Icônes du sélecteur de thème (soleil / lune), en `currentColor`. */
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Thème clair/sombre : préférence mémorisée du visiteur.               */
/* Source autoritaire = CloudStorage de la Mini App Telegram (persiste  */
/* entre les visites). Repli localStorage lorsque celui-ci est absent. */
/* ------------------------------------------------------------------ */

type AppTheme = "light" | "dark";
const THEME_STORAGE_KEY = "nokhba-tg-theme";

/** Cache local ; la restauration se fait après hydratation. */
function readThemeCache(): AppTheme | null {
  try {
    const cached = typeof window !== "undefined" ? window.localStorage?.getItem(THEME_STORAGE_KEY) : null;
    return cached === "light" || cached === "dark" ? cached : null;
  } catch {
    return null;
  }
}

/** Source autoritaire : CloudStorage de la Mini App Telegram. */
function loadStoredTheme(onLoad: (theme: AppTheme) => void): void {
  const tg = telegramApp();
  if (!tg?.CloudStorage) return;
  try {
    tg.CloudStorage.getItem(THEME_STORAGE_KEY, (error, value) => {
      if (!error && (value === "light" || value === "dark")) onLoad(value);
    });
  } catch {
    /* stockage indisponible : on garde la valeur par défaut */
  }
}

/** Écrit la préférence (CloudStorage + localStorage) sans jamais bloquer. */
function saveStoredTheme(theme: AppTheme): void {
  try {
    window.localStorage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* localStorage indisponible : non bloquant */
  }
  const tg = telegramApp();
  try {
    tg?.CloudStorage?.setItem?.(THEME_STORAGE_KEY, theme, () => {});
  } catch {
    /* CloudStorage indisponible : non bloquant */
  }
}

/* ------------------------------------------------------------------ */

export interface TelegramMiniAppProps {
  siteName: string;
  products: MiniAppProduct[];
  categories: MiniAppCategory[];
  defaultLocale: MiniAppLocale;
  initialLocale: MiniAppLocale;
  /** `?lang=` reçu dans l'URL : prioritaire sur la langue Telegram. */
  explicitLocale: string | null;
  whatsapp: string | null;
  degraded: boolean;
}

export function TelegramMiniApp({
  siteName,
  products,
  categories,
  defaultLocale,
  initialLocale,
  explicitLocale,
  whatsapp,
  degraded,
}: TelegramMiniAppProps) {
  const [locale, setLocale] = useState<MiniAppLocale>(initialLocale);
  const [kind, setKind] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  /* Thème : clair par défaut (exigence), choix mémorisé par le visiteur. */
  const [theme, setTheme] = useState<AppTheme>("light");
  const themeInteracted = useRef(false);
  const cloudThemeRequested = useRef(false);
  const dark = theme === "dark";
  const [user, setUser] = useState<{ name: string; photo: string | null } | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLElement>(null);

  const copy = COPY[locale];
  const ar = locale === "ar";

  /* ---------- Intégration Telegram ---------- */
  /** Synchronise la couleur de la fenêtre Telegram avec le thème choisi. */
  const applyTelegramChrome = useCallback((isDark: boolean) => {
    const app = telegramApp();
    if (!app) return;
    const bg = isDark ? "#0b1020" : "#f3f4f8";
    try {
      app.setHeaderColor?.(bg);
      app.setBackgroundColor?.(bg);
    } catch {
      /* non bloquant */
    }
  }, []);

  const restoreCloudTheme = useCallback(() => {
    if (!telegramApp()?.CloudStorage || cloudThemeRequested.current) return;
    cloudThemeRequested.current = true;
    loadStoredTheme((stored) => {
      // Une réponse lente ne doit jamais annuler un choix fait entre-temps.
      if (themeInteracted.current) return;
      setTheme(stored);
      try { window.localStorage?.setItem(THEME_STORAGE_KEY, stored); } catch { /* facultatif */ }
    });
  }, []);

  const initTelegram = useCallback(() => {
    const app = telegramApp();
    if (!app) return;
    app.ready();
    app.expand();
    setPlatform(app.platform ?? null);
    const tgUser = app.initDataUnsafe?.user;
    if (tgUser?.first_name) setUser({ name: tgUser.first_name, photo: tgUser.photo_url ?? null });
    setLocale(resolveMiniAppLocale(explicitLocale, tgUser?.language_code, defaultLocale));
    applyTelegramChrome(theme === "dark");
    restoreCloudTheme();
  }, [defaultLocale, explicitLocale, theme, applyTelegramChrome, restoreCloudTheme]);

  /* Même rendu initial côté serveur/client ; restaure ensuite le cache. */
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const cached = readThemeCache();
      if (cached && !themeInteracted.current) setTheme(cached);
      restoreCloudTheme();
    });
    return () => { active = false; };
  }, [restoreCloudTheme]);

  /* Garde la couleur de la fenêtre Telegram alignée sur le thème choisi. */
  useEffect(() => {
    applyTelegramChrome(dark);
  }, [dark, applyTelegramChrome]);

  const saveTheme = useCallback((next: AppTheme) => {
    themeInteracted.current = true;
    setTheme(next);
    saveStoredTheme(next);
  }, []);

  const haptic = useCallback((style: "light" | "medium" = "light") => {
    try {
      telegramApp()?.HapticFeedback?.impactOccurred(style);
    } catch {
      /* haptique facultative */
    }
  }, []);

  /* ---------- Navigation : catégorie → marque → région → produits ---------- */
  const inKind = useMemo(
    () => (kind ? products.filter((product) => product.kind === kind) : products),
    [kind, products],
  );
  const brandEntries = useMemo(() => (kind ? buildMiniAppBrands(inKind) : []), [kind, inKind]);
  const regionChips = useMemo(
    () => (kind && brand ? buildMiniAppRegionChips(inKind.filter((p) => p.platform === brand)) : []),
    [kind, brand, inKind],
  );
  const visible = useMemo(
    () => filterMiniAppProducts(products, { kind, brand, region, query }),
    [products, kind, brand, region, query],
  );
  const shown = visible.slice(0, limit);
  const activeCategory = categories.find((category) => category.kind === kind) ?? null;

  const scrollToList = useCallback(() => {
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const pickKind = (next: string | null) => {
    haptic();
    setKind(next);
    setBrand(null);
    setRegion(null);
    setLimit(PAGE_SIZE);
    if (next) requestAnimationFrame(scrollToList);
  };

  const pickBrand = (next: string | null) => {
    try {
      telegramApp()?.HapticFeedback?.selectionChanged();
    } catch {
      /* facultatif */
    }
    setBrand(next);
    setRegion(null);
    setLimit(PAGE_SIZE);
    if (next) requestAnimationFrame(scrollToList);
  };

  const pickRegion = (next: string | null) => {
    try {
      telegramApp()?.HapticFeedback?.selectionChanged();
    } catch {
      /* facultatif */
    }
    setRegion((current) => (current === next ? null : next));
    setLimit(PAGE_SIZE);
  };

  /* ---------- Bouton retour natif : remonte d'un niveau ---------- */
  const filtered = Boolean(kind || brand || region || query);
  useEffect(() => {
    const app = telegramApp();
    const back = app?.BackButton;
    if (!back) return;
    const onBack = () => {
      if (query) setQuery("");
      else if (region) setRegion(null);
      else if (brand) setBrand(null);
      else setKind(null);
      setLimit(PAGE_SIZE);
    };
    if (filtered) back.show();
    else back.hide();
    back.onClick(onBack);
    return () => back.offClick(onBack);
  }, [filtered, query, region, brand]);

  /* ---------- Ouverture d'une fiche ---------- */
  const openProduct = (product: MiniAppProduct) => {
    haptic("medium");
    const href = miniAppProductHref(product.slug, locale, defaultLocale);
    const app = telegramApp();
    if (app && miniAppOpensExternally(platform) && app.openLink) {
      app.openLink(new URL(href, window.location.origin).toString());
      return;
    }
    window.location.assign(href);
  };

  const whatsappHref = useMemo(() => {
    const digits = (whatsapp ?? "").replace(/\D/g, "");
    if (!digits) return null;
    const text = ar ? "مرحباً نخبة 👋 أتواصل من متجر تيليجرام." : "Hi Nukhba 👋 I'm writing from the Telegram store.";
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }, [whatsapp, ar]);

  const openWhatsapp = () => {
    if (!whatsappHref) return;
    const app = telegramApp();
    if (app?.openLink) app.openLink(whatsappHref);
    else window.open(whatsappHref, "_blank", "noopener");
  };

  const title = (product: MiniAppProduct) => (ar ? product.titleAr : product.titleEn);

  const productsGrid = (
    <section className={`${styles.grid}${shown.length === 1 ? ` ${styles.gridSingle}` : ""}`}>
      {shown.length === 0 && <p className={styles.empty}>{copy.empty}</p>}
      {shown.map((product, index) => (
        <button
          key={product.slug}
          type="button"
          className={styles.product}
          style={{ animationDelay: `${Math.min(index % PAGE_SIZE, 12) * 30}ms` }}
          onClick={() => openProduct(product)}
        >
          <span
            className={styles.cover}
            style={{ background: `linear-gradient(145deg, ${product.color}, #141a26)` }}
          >
            {product.image ? (
              // Jaquette redimensionnée par l'optimiseur (~230 px, webp) :
              // les fichiers bruts font 24–140 Ko pour une vignette de ~100 px.
              <Image
                src={product.image}
                alt=""
                fill
                sizes="(max-width: 479px) 33vw, 25vw"
                quality={70}
                priority={index < 6}
                className={product.fit === "contain" ? styles.contain : undefined}
              />
            ) : (
              <span className={styles.initials}>{miniAppInitials(product.platform || product.titleEn)}</span>
            )}
            {product.regions[0] && (
              <span className={styles.region}>{miniAppRegionLabel(product.regions[0], locale)}</span>
            )}
          </span>
          <span className={styles.info}>
            <strong>{title(product)}</strong>
            <span>
              {copy.from} {formatMiniAppUsd(product.fromUsd, locale)}
            </span>
          </span>
        </button>
      ))}
    </section>
  );

  return (
    <div className={`${styles.app} ${dark ? styles.dark : ""}`} dir={ar ? "rtl" : "ltr"} lang={locale}>
      <Script src={TELEGRAM_WEB_APP_SCRIPT} strategy="afterInteractive" onReady={initTelegram} />

      <div className={styles.wrap}>
        {/* En-tête */}
        <header className={styles.top}>
          <div className={styles.hello}>
            <small>{user ? `${copy.hello}, ${user.name} 👋` : copy.welcome}</small>
            <strong>{siteName}</strong>
          </div>
          <div className={styles.topActions}>
            <button
              type="button"
              className={styles.themeToggle}
              onClick={() => {
                haptic();
                saveTheme(dark ? "light" : "dark");
              }}
              aria-label={ar ? "تبديل المظهر" : "Toggle theme"}
              aria-pressed={dark}
              title={dark ? (ar ? "المظهر الفاتح" : "Light theme") : ar ? "المظهر الداكن" : "Dark theme"}
            >
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              type="button"
              className={styles.lang}
              onClick={() => {
                haptic();
                setLocale(ar ? "en" : "ar");
              }}
              aria-label={ar ? "English" : "العربية"}
            >
              {copy.lang}
            </button>
            <span className={styles.avatar} aria-hidden="true">
              {user?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photo} alt="" />
              ) : user ? (
                user.name.slice(0, 1).toUpperCase()
              ) : (
                "🎁"
              )}
            </span>
          </div>
        </header>

        {/* Bandeau (accueil uniquement) */}
        {kind === null && (
          <section className={styles.hero}>
            <span className={styles.badge}>
              <i />
              {copy.badge}
            </span>
            <h1>{copy.heroTitle}</h1>
            <button
              type="button"
              className={styles.heroBtn}
              onClick={() => categoriesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              {copy.heroCta} {ar ? "←" : "→"}
            </button>
          </section>
        )}

        {degraded && <p className={styles.notice}>{copy.degraded}</p>}

        {/* Recherche */}
        <label className={styles.search}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            placeholder={copy.search}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(PAGE_SIZE);
            }}
          />
          {query && (
            <button type="button" className={styles.clear} onClick={() => setQuery("")} aria-label="×">
              ×
            </button>
          )}
        </label>

        {kind === null ? (
          /* ================= ACCUEIL : familles + populaires ================= */
          <>
            <section ref={categoriesRef} className={styles.section}>
              <div className={styles.head}>
                <h2>{copy.categories}</h2>
              </div>
              <div className={styles.cats}>
                {categories.map((category) => (
                  <button
                    key={category.kind}
                    type="button"
                    className={styles.cat}
                    onClick={() => pickKind(category.kind)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={category.image} alt="" width={400} height={400} />
                    <span className={styles.catLabel}>
                      <strong>{ar ? category.ar : category.en}</strong>
                      <small>{copy.count(category.count)}</small>
                    </span>
                    <span className={styles.enter} aria-hidden="true">
                      {ar ? "‹" : "›"}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <div ref={listRef} className={styles.head}>
              <h2>{query ? copy.results : copy.products}</h2>
              <span>{copy.count(visible.length)}</span>
            </div>
            {productsGrid}
            {visible.length > shown.length && (
              <button type="button" className={styles.more} onClick={() => setLimit((value) => value + PAGE_SIZE)}>
                {copy.more} ({visible.length - shown.length})
              </button>
            )}
          </>
        ) : (
          /* ============ NAVIGATION : catégorie → marque → région ============ */
          <>
            <nav className={styles.crumbs}>
              <button
                type="button"
                className={styles.crumb}
                onClick={() => (brand ? pickBrand(null) : pickKind(null))}
              >
                <span aria-hidden="true">{ar ? "→" : "←"}</span>
                {brand ? (ar ? activeCategory?.ar : activeCategory?.en) ?? copy.categories : copy.backToCategories}
              </button>
            </nav>

            {brand === null ? (
              /* --- Niveau 2 : les marques de la famille --- */
              <>
                <div ref={listRef} className={styles.head}>
                  <h2>{ar ? activeCategory?.ar : activeCategory?.en}</h2>
                  <span>{copy.brandsCount(brandEntries.length)}</span>
                </div>
                {query ? (
                  <>
                    <div className={styles.head}>
                      <h2>{copy.results}</h2>
                      <span>{copy.count(visible.length)}</span>
                    </div>
                    {productsGrid}
                    {visible.length > shown.length && (
                      <button
                        type="button"
                        className={styles.more}
                        onClick={() => setLimit((value) => value + PAGE_SIZE)}
                      >
                        {copy.more} ({visible.length - shown.length})
                      </button>
                    )}
                  </>
                ) : (
                <div className={styles.brands}>
                  {brandEntries.map((entry) => (
                    <button
                      key={entry.name}
                      type="button"
                      className={styles.brandCard}
                      onClick={() => pickBrand(entry.name)}
                    >
                      <span
                        className={styles.brandThumb}
                        style={
                          entry.image
                            ? undefined
                            : { background: `linear-gradient(145deg, ${entry.color}, #141a26)` }
                        }
                      >
                        {entry.image ? (
                          <Image
                            src={entry.image}
                            alt=""
                            fill
                            sizes="56px"
                            quality={70}
                            className={styles.brandThumbImg}
                          />
                        ) : (
                          <span className={styles.brandFallback} aria-hidden="true">
                            {miniAppInitials(entry.name)}
                          </span>
                        )}
                      </span>
                      <span className={styles.brandLabel}>
                        <strong>{miniAppBrandLabel(entry.name, locale)}</strong>
                        {locale === "ar" && <small>{entry.name}</small>}
                      </span>
                      <span className={styles.brandCount}>{copy.count(entry.count)}</span>
                      <span className={styles.brandEnter} aria-hidden="true">
                        {ar ? "‹" : "›"}
                      </span>
                    </button>
                  ))}
                </div>
                )}
              </>
            ) : (
              /* --- Niveau 3 : produits de la marque, filtre par région --- */
              <>
                <div ref={listRef} className={styles.head}>
                  <h2>{miniAppBrandHeading(brand, locale)}</h2>
                  <span>{copy.count(visible.length)}</span>
                </div>

                {regionChips.length > 1 && (
                  <nav className={styles.chips} aria-label="regions">
                    <button
                      type="button"
                      className={`${styles.chip} ${region === null ? styles.chipActive : ""}`}
                      onClick={() => pickRegion(null)}
                    >
                      {copy.allRegions}
                    </button>
                    {regionChips.map((code) => (
                      <button
                        key={code}
                        type="button"
                        className={`${styles.chip} ${region === code ? styles.chipActive : ""}`}
                        onClick={() => pickRegion(code)}
                      >
                        {miniAppRegionLabel(code, locale)}
                      </button>
                    ))}
                  </nav>
                )}

                {/* Légende : les pays couverts par chaque code non-pays (MENA, GLOBAL, EU…). */}
                {regionChips.some((code) => miniAppRegionNote(code, locale)) && (
                  <div className={styles.legend}>
                    {regionChips.map((code) => {
                      const note = miniAppRegionNote(code, locale);
                      if (!note) return null;
                      return (
                        <small key={code}>
                          🗺️ {miniAppRegionLabel(code, locale)} : {note}
                        </small>
                      );
                    })}
                  </div>
                )}

                {productsGrid}
                {visible.length > shown.length && (
                  <button type="button" className={styles.more} onClick={() => setLimit((value) => value + PAGE_SIZE)}>
                    {copy.more} ({visible.length - shown.length})
                  </button>
                )}
              </>
            )}
          </>
        )}

        {whatsappHref && (
          <button type="button" className={styles.support} onClick={openWhatsapp}>
            <span className={styles.supportIcon} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
              </svg>
            </span>
            <span>
              <strong>{copy.help}</strong>
              <small>{copy.helpSub}</small>
            </span>
            <span className={styles.arrow} aria-hidden="true">
              {ar ? "‹" : "›"}
            </span>
          </button>
        )}

        <p className={styles.footnote}>{copy.usd}</p>
      </div>
    </div>
  );
}
