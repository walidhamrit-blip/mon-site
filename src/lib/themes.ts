/** Gaming palettes: explicit day/night colors with migration of old choices. */
export const THEME_VARS = [
  "background", "foreground", "card", "card-foreground", "popover", "popover-foreground",
  "primary", "primary-foreground", "secondary", "secondary-foreground", "muted", "muted-foreground",
  "accent", "accent-foreground", "accent-hover", "border", "input", "ring", "chart-1",
] as const;
export type ThemeVar = (typeof THEME_VARS)[number];
export type ThemePalette = Record<ThemeVar, string>;
export interface SiteTheme {
  id: string;
  rank: number;
  featured?: boolean;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  usesAr: string;
  usesEn: string;
  light: ThemePalette;
  dark: ThemePalette;
}
export const DEFAULT_THEME_ID = "cyber-violet";
export const THEME_COUNT = 6;

function palette(mode: "light" | "dark", accent: string, hover: string): ThemePalette {
  const dark = mode === "dark";
  return {
    background: dark ? "#000000" : "#FFFFFF",
    foreground: dark ? "#F1F5FB" : "#111827",
    card: dark ? "#10131B" : "#FFFFFF",
    "card-foreground": dark ? "#F1F5FB" : "#111827",
    popover: dark ? "#10131B" : "#FFFFFF",
    "popover-foreground": dark ? "#F1F5FB" : "#111827",
    primary: accent,
    "primary-foreground": dark ? "#080C14" : "#FFFFFF",
    secondary: dark ? "#151B27" : "#F3F5FA",
    "secondary-foreground": dark ? "#F1F5FB" : "#1F293B",
    muted: dark ? "#202938" : "#EAF0F7",
    "muted-foreground": dark ? "#A8B5CB" : "#526078",
    accent,
    "accent-foreground": dark ? "#080C14" : "#FFFFFF",
    "accent-hover": hover,
    border: dark ? "#2C3648" : "#D9E0EB",
    input: dark ? "#3E4C63" : "#C4CEDD",
    ring: accent,
    "chart-1": accent,
  };
}

const definitions = [
  { id: "cyber-violet", ar: "سايبر بنفسجي", en: "Cyber Violet", day: "#7036D3", hover: "#5424A8", night: "#BE9AFF", descAr: "بنفسجي تقني، وهوية نخبة الجديدة", descEn: "Electric violet, the new Nukhba signature", usesAr: "تقنية · ألعاب · عوالم رقمية", usesEn: "Tech · gaming · digital worlds" },
  { id: "electric-blue", ar: "أزرق كهربائي", en: "Electric Blue", day: "#1D52D6", hover: "#153DAA", night: "#86ADFF", descAr: "أزرق واضح نهاراً ومضيء ليلاً", descEn: "Precision blue by day, luminous blue by night", usesAr: "حاسوب · تطوير · أداء", usesEn: "Computing · development · performance" },
  { id: "neon-lime", ar: "ليموني نيون", en: "Neon Lime", day: "#3C6B12", hover: "#2D510C", night: "#B5F65C", descAr: "أخضر قوي في الوضع الفاتح وليموني نيون في الداكن", descEn: "Rich green in light mode, neon lime in dark mode", usesAr: "ألعاب · منافسة · طاقة", usesEn: "Gaming · competition · energy" },
  { id: "plasma-rose", ar: "بلازما وردي", en: "Plasma Rose", day: "#B51E69", hover: "#901653", night: "#FF8CC7", descAr: "وردي بلازما لهوية جريئة ومبدعة", descEn: "Plasma pink for a bold, creative identity", usesAr: "إبداع · بث · مجتمعات", usesEn: "Creativity · streaming · community" },
  { id: "solar-orange", ar: "برتقالي شمسي", en: "Solar Orange", day: "#B8450C", hover: "#913407", night: "#FFAD69", descAr: "برتقالي مشبع مع لمسة شمسية دافئة", descEn: "Saturated orange with a warm solar glow", usesAr: "متجر · عروض · اكتشاف", usesEn: "Store · offers · discovery" },
  { id: "arctic-cyan", ar: "سماوي قطبي", en: "Arctic Cyan", day: "#006D87", hover: "#005368", night: "#66DFEF", descAr: "سماوي بارد مستوحى من أجهزة المستقبل", descEn: "Cool cyan inspired by next-generation hardware", usesAr: "أجهزة · شبكات · مستقبل", usesEn: "Hardware · networks · future" },
];
export const THEMES: SiteTheme[] = definitions.map((theme, index) => ({
  id: theme.id, rank: index + 1, featured: index === 0,
  labelAr: theme.ar, labelEn: theme.en,
  descAr: theme.descAr, descEn: theme.descEn, usesAr: theme.usesAr, usesEn: theme.usesEn,
  light: palette("light", theme.day, theme.hover),
  dark: palette("dark", theme.night, "#E3EAF8"),
}));

/** Preserve saved visitor choices and old admin configuration without a reset. */
export const RETIRED_THEMES: Record<string, string> = {
  nukhba: "cyber-violet", royal: "electric-blue", graphite: "arctic-cyan",
  emerald: "neon-lime", violet: "cyber-violet", teal: "arctic-cyan",
  burgundy: "plasma-rose", copper: "solar-orange",
};

/** Résout un identifiant (y compris retiré) vers un thème existant, sinon null. */
export function resolveThemeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = RETIRED_THEMES[value] ?? value;
  return THEMES.some((t) => t.id === id) ? id : null;
}

export function isThemeId(value: unknown): value is string {
  return resolveThemeId(value) !== null;
}

export function getTheme(id: string): SiteTheme {
  return THEMES.find((t) => t.id === resolveThemeId(id)) ?? THEMES[0];
}

/** Libellé du classement du thème (« Le plus demandé », « n°3 du métier »…). */
export function themeRankLabel(theme: SiteTheme, locale: "ar" | "en"): string {
  if (theme.featured) return locale === "ar" ? "الهوية الأساسية" : "Signature";
  return locale === "ar" ? `لوحة ${theme.rank}` : `Palette ${theme.rank}`;
}

function paletteBlock(selector: string, palette: ThemePalette) {
  const body = THEME_VARS.map((v) => `--${v}:${palette[v]};`).join("");
  return `${selector}{${body}}`;
}

/**
 * CSS complet des palettes : chaque thème a son bloc clair
 * (`html[data-theme="x"]`) et son bloc sombre (`html.dark[data-theme="x"]`).
 * Les sélecteurs sont volontairement plus spécifiques que `:root` / `.dark`
 * de globals.css pour que l'ordre de chargement des feuilles n'importe pas.
 */
export function themeCss(): string {
  return THEMES.map((theme) =>
    [
      paletteBlock(`html[data-theme="${theme.id}"]`, theme.light),
      paletteBlock(`html.dark[data-theme="${theme.id}"]`, theme.dark),
    ].join("\n"),
  ).join("\n");
}

/**
 * Script inline exécuté avant le premier rendu : applique le thème et le mode
 * choisis explicitement par le visiteur (localStorage) ou, à défaut,
 * l'apparence principale choisie dans l'admin (`/admin` → Réglages), ce qui
 * évite tout clignotement de couleurs.
 * Les clés doivent rester synchronisées avec `theme-provider.tsx` : seules
 * les clés `-choice` (écrites uniquement lors d'un clic du visiteur sur les
 * boutons thème / mode) sont lues. Les anciennes clés (`nukhba-mode`,
 * `nukhba-palette`, `nukhba-theme`) étaient écrites automatiquement à chaque
 * visite — même pour le simple défaut admin — et figeaient donc l'ancien
 * défaut à vie ; elles sont ignorées et supprimées.
 * Les identifiants retirés (`burgundy`, `copper`) sont traduits vers le thème
 * signature avant la validation.
 */
export function themeBootScript(
  defaults: { mode?: "light" | "dark" | ""; palette?: string } = {},
): string {
  const mode = defaults.mode === "dark" || defaults.mode === "light" ? defaults.mode : "";
  const resolvedDefault = resolveThemeId(defaults.palette);
  const palette = resolvedDefault ?? DEFAULT_THEME_ID;
  const validIds = THEMES.map((t) => t.id);
  return `(function(){try{
var d=document.documentElement;
localStorage.removeItem("nukhba-mode");
localStorage.removeItem("nukhba-palette");
localStorage.removeItem("nukhba-theme");
var m=localStorage.getItem("nukhba-mode-choice");
var p=localStorage.getItem("nukhba-palette-choice");
var valid=${JSON.stringify(validIds)};
var retired=${JSON.stringify(RETIRED_THEMES)};
if(p&&retired[p])p=retired[p];
if(valid.indexOf(p)===-1)p="";
var defM=${JSON.stringify(mode)};
var defP=${JSON.stringify(palette)};
if(m!=="dark"&&m!=="light")m=defM;
if(m==="dark"||(m!=="light"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)){d.classList.add("dark")}
if(p||defP){d.setAttribute("data-theme",p||defP)}
}catch(e){}})();`;
}
