// Catalogue des thèmes du site.
//
// Chaque thème définit sa palette CLAIRE et sa palette SOMBRE : la notion
// « clair / sombre » reste un réglage séparé (un bouton dédié dans la barre
// supérieure), donc n'importe quel thème peut être vu dans les deux modes.
//
// Les variables CSS sont générées depuis ce fichier (voir `themeCss()`) et
// injectées dans le <head> par `src/app/layout.tsx`. Le `data-theme` posé sur
// <html> (par un script inline, avant le premier rendu) sélectionne la palette.
//
// ⚠️ La palette « nukhba » est aussi reprise en repli dans `src/app/globals.css`
// (:root / .dark) pour que le site reste coloré si le JS est désactivé.

export const THEME_VARS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "accent-hover",
  "border",
  "input",
  "ring",
  "chart-1",
] as const;

export type ThemeVar = (typeof THEME_VARS)[number];
export type ThemePalette = Record<ThemeVar, string>;

export interface SiteTheme {
  id: string;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  light: ThemePalette;
  dark: ThemePalette;
}

export const DEFAULT_THEME_ID = "nukhba";

export const THEMES: SiteTheme[] = [
  {
    id: "nukhba",
    labelAr: "نخبة الذهبي",
    labelEn: "Nukhba Gold",
    descAr: "الهوية الأصلية — أسود عميق وذهبي فاخر",
    descEn: "The signature look — deep black & luxury gold",
    light: {
      background: "#FCFCF9",
      foreground: "#0C0C0F",
      card: "#FFFFFF",
      "card-foreground": "#0C0C0F",
      popover: "#FFFFFF",
      "popover-foreground": "#0C0C0F",
      primary: "#0C0C0F",
      "primary-foreground": "#FCFCF9",
      secondary: "#F2F0E8",
      "secondary-foreground": "#1A1A1E",
      muted: "#EDEBE3",
      "muted-foreground": "#6B6B76",
      accent: "#C6A664",
      "accent-foreground": "#0C0C0F",
      "accent-hover": "#B89652",
      border: "#E8E6DF",
      input: "#E8E6DF",
      ring: "#C6A664",
      "chart-1": "#C6A664",
    },
    dark: {
      background: "#08080A",
      foreground: "#F5F3EE",
      card: "#121214",
      "card-foreground": "#F5F3EE",
      popover: "#121214",
      "popover-foreground": "#F5F3EE",
      primary: "#F5F3EE",
      "primary-foreground": "#08080A",
      secondary: "#1A1A1E",
      "secondary-foreground": "#F5F3EE",
      muted: "#1E1E22",
      "muted-foreground": "#9A9AA3",
      accent: "#D4B978",
      "accent-foreground": "#08080A",
      "accent-hover": "#C6A664",
      border: "#232326",
      input: "#232326",
      ring: "#D4B978",
      "chart-1": "#D4B978",
    },
  },
  {
    id: "royal",
    labelAr: "أزرق ملكي",
    labelEn: "Royal Blue",
    descAr: "ثقة ومصداقية — مثالي للخدمات والوكالات",
    descEn: "Trust & credibility — ideal for agencies & services",
    light: {
      background: "#F5F7FC",
      foreground: "#0A1220",
      card: "#FFFFFF",
      "card-foreground": "#0A1220",
      popover: "#FFFFFF",
      "popover-foreground": "#0A1220",
      primary: "#102A5C",
      "primary-foreground": "#F5F7FC",
      secondary: "#E6ECF8",
      "secondary-foreground": "#12203C",
      muted: "#E9EEF8",
      "muted-foreground": "#5B6B85",
      accent: "#2563EB",
      "accent-foreground": "#FFFFFF",
      "accent-hover": "#1D4ED8",
      border: "#DAE2F2",
      input: "#DAE2F2",
      ring: "#2563EB",
      "chart-1": "#2563EB",
    },
    dark: {
      background: "#060A14",
      foreground: "#E7EDF9",
      card: "#0C1424",
      "card-foreground": "#E7EDF9",
      popover: "#0C1424",
      "popover-foreground": "#E7EDF9",
      primary: "#E7EDF9",
      "primary-foreground": "#060A14",
      secondary: "#131E36",
      "secondary-foreground": "#E7EDF9",
      muted: "#101A2E",
      "muted-foreground": "#8C9DBC",
      accent: "#6E9BFF",
      "accent-foreground": "#05122B",
      "accent-hover": "#8AB0FF",
      border: "#1C2841",
      input: "#1C2841",
      ring: "#6E9BFF",
      "chart-1": "#6E9BFF",
    },
  },
  {
    id: "emerald",
    labelAr: "زمردي أخضر",
    labelEn: "Emerald",
    descAr: "انتعاش وصحة — مثالي للعيادات والمنتجات الطبيعية",
    descEn: "Fresh & healthy — clinics & natural products",
    light: {
      background: "#F3FAF7",
      foreground: "#05201A",
      card: "#FFFFFF",
      "card-foreground": "#05201A",
      popover: "#FFFFFF",
      "popover-foreground": "#05201A",
      primary: "#0A3A2C",
      "primary-foreground": "#F3FAF7",
      secondary: "#E0F1EA",
      "secondary-foreground": "#0A2C22",
      muted: "#E6F3ED",
      "muted-foreground": "#4E6E62",
      accent: "#0E9F6E",
      "accent-foreground": "#FFFFFF",
      "accent-hover": "#0B8159",
      border: "#D4E9DF",
      input: "#D4E9DF",
      ring: "#0E9F6E",
      "chart-1": "#0E9F6E",
    },
    dark: {
      background: "#04100C",
      foreground: "#E1F1EB",
      card: "#0A1B16",
      "card-foreground": "#E1F1EB",
      popover: "#0A1B16",
      "popover-foreground": "#E1F1EB",
      primary: "#E1F1EB",
      "primary-foreground": "#04100C",
      secondary: "#122620",
      "secondary-foreground": "#E1F1EB",
      muted: "#0E1F19",
      "muted-foreground": "#8CAD9F",
      accent: "#3ED9A0",
      "accent-foreground": "#042118",
      "accent-hover": "#6FE7B8",
      border: "#172C24",
      input: "#172C24",
      ring: "#3ED9A0",
      "chart-1": "#3ED9A0",
    },
  },
  {
    id: "burgundy",
    labelAr: "خمري أنيق",
    labelEn: "Burgundy",
    descAr: "دفء الفخامة — مطاعم، أزياء وضيافة راقية",
    descEn: "Warm luxury — restaurants, fashion & premium hospitality",
    light: {
      background: "#FCF6F5",
      foreground: "#1B0B0F",
      card: "#FFFFFF",
      "card-foreground": "#1B0B0F",
      popover: "#FFFFFF",
      "popover-foreground": "#1B0B0F",
      primary: "#4A1220",
      "primary-foreground": "#FCF6F5",
      secondary: "#F6E6E7",
      "secondary-foreground": "#3A1119",
      muted: "#F4E8E9",
      "muted-foreground": "#7C5A60",
      accent: "#A81E3C",
      "accent-foreground": "#FFFFFF",
      "accent-hover": "#8C1730",
      border: "#EDDADC",
      input: "#EDDADC",
      ring: "#A81E3C",
      "chart-1": "#A81E3C",
    },
    dark: {
      background: "#120709",
      foreground: "#F4E6E6",
      card: "#1D0C11",
      "card-foreground": "#F4E6E6",
      popover: "#1D0C11",
      "popover-foreground": "#F4E6E6",
      primary: "#F4E6E6",
      "primary-foreground": "#120709",
      secondary: "#2A1218",
      "secondary-foreground": "#F4E6E6",
      muted: "#221015",
      "muted-foreground": "#B78F95",
      accent: "#F0839B",
      "accent-foreground": "#2A0910",
      "accent-hover": "#FFA3B6",
      border: "#32171F",
      input: "#32171F",
      ring: "#F0839B",
      "chart-1": "#F0839B",
    },
  },
  {
    id: "graphite",
    labelAr: "فحمي مينيمال",
    labelEn: "Graphite",
    descAr: "بساطة راقية — أزياء، تصميم وماركات عصرية",
    descEn: "Understated elegance — fashion, design & modern brands",
    light: {
      background: "#FAFAFA",
      foreground: "#111113",
      card: "#FFFFFF",
      "card-foreground": "#111113",
      popover: "#FFFFFF",
      "popover-foreground": "#111113",
      primary: "#151517",
      "primary-foreground": "#FAFAFA",
      secondary: "#EFEFF0",
      "secondary-foreground": "#1C1C1F",
      muted: "#EDEDEE",
      "muted-foreground": "#6C6C72",
      accent: "#1F1F23",
      "accent-foreground": "#FFFFFF",
      "accent-hover": "#000000",
      border: "#E3E3E5",
      input: "#E3E3E5",
      ring: "#1F1F23",
      "chart-1": "#1F1F23",
    },
    dark: {
      background: "#0A0A0B",
      foreground: "#F2F2F3",
      card: "#121214",
      "card-foreground": "#F2F2F3",
      popover: "#121214",
      "popover-foreground": "#F2F2F3",
      primary: "#F2F2F3",
      "primary-foreground": "#0A0A0B",
      secondary: "#1A1A1D",
      "secondary-foreground": "#F2F2F3",
      muted: "#171719",
      "muted-foreground": "#93939B",
      accent: "#EDEDF0",
      "accent-foreground": "#101012",
      "accent-hover": "#FFFFFF",
      border: "#242427",
      input: "#242427",
      ring: "#EDEDF0",
      "chart-1": "#EDEDF0",
    },
  },
  {
    id: "copper",
    labelAr: "نحاسي دافئ",
    labelEn: "Copper",
    descAr: "حرارة المقاهي والمطاعم — طابع handmade دافئ",
    descEn: "Café & kitchen warmth — a handcrafted, sunny character",
    light: {
      background: "#FFF9F3",
      foreground: "#1D1207",
      card: "#FFFFFF",
      "card-foreground": "#1D1207",
      popover: "#FFFFFF",
      "popover-foreground": "#1D1207",
      primary: "#3B1E0C",
      "primary-foreground": "#FFF9F3",
      secondary: "#F8E8D9",
      "secondary-foreground": "#33190B",
      muted: "#F7EBDF",
      "muted-foreground": "#7C6350",
      accent: "#B45309",
      "accent-foreground": "#FFFFFF",
      "accent-hover": "#94430A",
      border: "#EEDCCD",
      input: "#EEDCCD",
      ring: "#B45309",
      "chart-1": "#B45309",
    },
    dark: {
      background: "#110A04",
      foreground: "#F6EADC",
      card: "#1C1009",
      "card-foreground": "#F6EADC",
      popover: "#1C1009",
      "popover-foreground": "#F6EADC",
      primary: "#F6EADC",
      "primary-foreground": "#110A04",
      secondary: "#29180D",
      "secondary-foreground": "#F6EADC",
      muted: "#22140A",
      "muted-foreground": "#B9997C",
      accent: "#F0A868",
      "accent-foreground": "#2A1505",
      "accent-hover": "#F7C08F",
      border: "#33210F",
      input: "#33210F",
      ring: "#F0A868",
      "chart-1": "#F0A868",
    },
  },
  {
    id: "teal",
    labelAr: "تركوازي بحري",
    labelEn: "Ocean Teal",
    descAr: "هدوء ونقاء — صحافة، سياحة وخدمات مائية",
    descEn: "Calm & clean — clinics, travel & water-related services",
    light: {
      background: "#F1FAFB",
      foreground: "#04242A",
      card: "#FFFFFF",
      "card-foreground": "#04242A",
      popover: "#FFFFFF",
      "popover-foreground": "#04242A",
      primary: "#06414A",
      "primary-foreground": "#F1FAFB",
      secondary: "#DEEFF2",
      "secondary-foreground": "#053038",
      muted: "#E2F0F2",
      "muted-foreground": "#4E6D73",
      accent: "#0C8A9C",
      "accent-foreground": "#FFFFFF",
      "accent-hover": "#0A7285",
      border: "#D2E6EA",
      input: "#D2E6EA",
      ring: "#0C8A9C",
      "chart-1": "#0C8A9C",
    },
    dark: {
      background: "#03181C",
      foreground: "#E0F2F5",
      card: "#09242A",
      "card-foreground": "#E0F2F5",
      popover: "#09242A",
      "popover-foreground": "#E0F2F5",
      primary: "#E0F2F5",
      "primary-foreground": "#03181C",
      secondary: "#0E2E34",
      "secondary-foreground": "#E0F2F5",
      muted: "#0A262B",
      "muted-foreground": "#87AEB4",
      accent: "#4CCBD6",
      "accent-foreground": "#032025",
      "accent-hover": "#7DDCE5",
      border: "#13373D",
      input: "#13373D",
      ring: "#4CCBD6",
      "chart-1": "#4CCBD6",
    },
  },
  {
    id: "violet",
    labelAr: "بنفسجي نبيل",
    labelEn: "Violet",
    descAr: "جرأة إبداعية — تقنيات، إبداع وعلامات عصرية",
    descEn: "Creative boldness — tech, studios & modern brands",
    light: {
      background: "#F8F6FE",
      foreground: "#15092F",
      card: "#FFFFFF",
      "card-foreground": "#15092F",
      popover: "#FFFFFF",
      "popover-foreground": "#15092F",
      primary: "#2E1065",
      "primary-foreground": "#F8F6FE",
      secondary: "#EDE7FB",
      "secondary-foreground": "#241050",
      muted: "#F0EBFC",
      "muted-foreground": "#645B80",
      accent: "#7C3AED",
      "accent-foreground": "#FFFFFF",
      "accent-hover": "#6D28D9",
      border: "#E2DAF6",
      input: "#E2DAF6",
      ring: "#7C3AED",
      "chart-1": "#7C3AED",
    },
    dark: {
      background: "#0A0616",
      foreground: "#ECE7FB",
      card: "#140E26",
      "card-foreground": "#ECE7FB",
      popover: "#140E26",
      "popover-foreground": "#ECE7FB",
      primary: "#ECE7FB",
      "primary-foreground": "#0A0616",
      secondary: "#1E1637",
      "secondary-foreground": "#ECE7FB",
      muted: "#161029",
      "muted-foreground": "#A699C9",
      accent: "#A78BFA",
      "accent-foreground": "#17093A",
      "accent-hover": "#BFA6FB",
      border: "#241A44",
      input: "#241A44",
      ring: "#A78BFA",
      "chart-1": "#A78BFA",
    },
  },
];

export function isThemeId(value: unknown): value is string {
  return typeof value === "string" && THEMES.some((t) => t.id === value);
}

export function getTheme(id: string): SiteTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
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
 */
export function themeBootScript(
  defaults: { mode?: "light" | "dark" | ""; palette?: string } = {},
): string {
  const mode = defaults.mode === "dark" || defaults.mode === "light" ? defaults.mode : "";
  const palette = isThemeId(defaults.palette) ? defaults.palette : "";
  const validIds = THEMES.map((t) => t.id);
  return `(function(){try{
var d=document.documentElement;
localStorage.removeItem("nukhba-mode");
localStorage.removeItem("nukhba-palette");
localStorage.removeItem("nukhba-theme");
var m=localStorage.getItem("nukhba-mode-choice");
var p=localStorage.getItem("nukhba-palette-choice");
var valid=${JSON.stringify(validIds)};
if(valid.indexOf(p)===-1)p="";
var defM=${JSON.stringify(mode)};
var defP=${JSON.stringify(palette)};
if(m!=="dark"&&m!=="light")m=defM;
if(m==="dark"||(m!=="light"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)){d.classList.add("dark")}
if(p||defP){d.setAttribute("data-theme",p||defP)}
}catch(e){}})();`;
}
