// Catalogue des thèmes du site.
//
// Le sélecteur expose **6 thèmes**, choisis parmi les palettes les plus
// appréciées du métier (agences web, studios, e-commerce premium). Le classement
// (`rank`) reflète la fréquence de demande observée sur ce type de projet :
//   1. noir & or      → signature « luxe » des agences haut de gamme
//   2. bleu roi       → couleur n°1 de la confiance (finance, SaaS, corporate)
//   3. graphite       → minimalisme éditorial (studios, portfolios)
//   4. émeraude       → croissance / santé / durabilité
//   5. violet         → tech, IA et marques créatives
//   6. bleu-vert lagon→ produit numérique, voyage, cliniques
// Les palettes « burgundy » et « copper » ne font plus partie du sélecteur :
// leurs identifiants restent mappés vers le thème signature (voir
// `RETIRED_THEMES`) pour que les visiteurs ayant mémorisé un ancien choix
// retombent sur une palette valide, sans erreur.
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
  /** Classement d'affection du métier — 1 = le plus demandé. */
  rank: number;
  /** Le thème signature (mis en avant « الأكثر طلباً » dans le sélecteur). */
  featured?: boolean;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  /** Secteurs où cette palette est la plus demandée (sous-titre du sélecteur). */
  usesAr: string;
  usesEn: string;
  light: ThemePalette;
  dark: ThemePalette;
}

export const DEFAULT_THEME_ID = "nukhba";

/** Nombre de thèmes proposés dans le sélecteur (métier = 6, classés). */
export const THEME_COUNT = 6;

export const THEMES: SiteTheme[] = [
  {
    id: "nukhba",
    rank: 1,
    featured: true,
    labelAr: "نخبة الذهبي",
    labelEn: "Nukhba Gold",
    descAr: "الهوية الأصلية — أسود عميق وذهبي فاخر",
    descEn: "The signature look — deep black & luxury gold",
    usesAr: "وكالات · علامات فاخرة · ضيافة راقية",
    usesEn: "Agencies · luxury brands · fine hospitality",
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
    rank: 2,
    labelAr: "أزرق ملكي",
    labelEn: "Royal Blue",
    descAr: "ثقة ومصداقية — مثالي للخدمات والوكالات",
    descEn: "Trust & credibility — ideal for agencies & services",
    usesAr: "خدمات مالية · SaaS · شركات",
    usesEn: "Finance · SaaS · corporate",
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
    id: "graphite",
    rank: 3,
    labelAr: "فحمي مينيمال",
    labelEn: "Graphite",
    descAr: "بساطة راقية — أزياء، تصميم وماركات عصرية",
    descEn: "Understated elegance — fashion, design & modern brands",
    usesAr: "استوديوهات · بورتفوليو · تصميم",
    usesEn: "Studios · portfolio · design",
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
    id: "emerald",
    rank: 4,
    labelAr: "زمردي أخضر",
    labelEn: "Emerald",
    descAr: "انتعاش وصحة — مثالي للعيادات والمنتجات الطبيعية",
    descEn: "Fresh & healthy — clinics & natural products",
    usesAr: "صحة · استدامة · متاجر إلكترونية",
    usesEn: "Health · sustainability · e-commerce",
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
    id: "violet",
    rank: 5,
    labelAr: "بنفسجي نبيل",
    labelEn: "Violet",
    descAr: "جرأة إبداعية — تقنيات، إبداع وعلامات عصرية",
    descEn: "Creative boldness — tech, studios & modern brands",
    usesAr: "تقنية · ذكاء اصطناعي · علامات إبداعية",
    usesEn: "Tech · AI · creative brands",
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
  {
    id: "teal",
    rank: 6,
    labelAr: "تركوازي بحري",
    labelEn: "Ocean Teal",
    descAr: "هدوء ونقاء — صحافة، سياحة وخدمات مائية",
    descEn: "Calm & clean — clinics, travel & water-related services",
    usesAr: "منتجات رقمية · سفر · عيادات",
    usesEn: "Digital products · travel · clinics",
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
];

// Palettes affect accents and actions, never the neutral page canvas.
for (const theme of THEMES) {
  Object.assign(theme.light, {
    background: "#FFFFFF", foreground: "#15151B", card: "#FFFFFF",
    "card-foreground": "#15151B", popover: "#FFFFFF", "popover-foreground": "#15151B",
    secondary: "#F6F6F8", "secondary-foreground": "#22222A", muted: "#F0F0F3",
    "muted-foreground": "#656571", border: "#E7E7EC", input: "#E7E7EC",
  });
  Object.assign(theme.dark, {
    background: "#000000", foreground: "#F5F5F7", card: "#101013",
    "card-foreground": "#F5F5F7", popover: "#101013", "popover-foreground": "#F5F5F7",
    secondary: "#151518", "secondary-foreground": "#F5F5F7", muted: "#202025",
    "muted-foreground": "#A5A5B0", border: "#28282E", input: "#28282E",
  });
}


/**
 * Anciens identifiants retirés du sélecteur (8 → 6 thèmes) : mappés vers le
 * thème signature pour que les choix mémorisés dans `localStorage` ou dans une
 * configuration admin plus ancienne restent valides.
 */
export const RETIRED_THEMES: Record<string, string> = {
  burgundy: "nukhba",
  copper: "nukhba",
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
  if (theme.featured) return locale === "ar" ? "الأكثر طلباً" : "Most requested";
  return locale === "ar" ? `رقم ${theme.rank} في المجال` : `No. ${theme.rank} in the field`;
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
  const palette = resolvedDefault ?? "";
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
