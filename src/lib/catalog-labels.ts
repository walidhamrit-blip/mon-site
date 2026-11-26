/**
 * Libellés de catalogue partagés (marques et régions), AR/EN.
 *
 * Module PUR (aucun import Node/Next) : importable par le bot
 * (`telegram-shop-core`), par la Mini App (`telegram-mini-app-core`) et par
 * les tests `node --test`.
 *
 * Règle de nommage des régions :
 *  - `REGION_NAMES` : le nom d'affichage complet, dans les deux langues
 *    («السعودية» / «Saudi Arabia»). Sert aux boutons et aux badges.
 *  - `REGION_NOTES` : pour les codes qui ne sont pas un pays (MENA, GLOBAL,
 *    EU…), l'ensemble des pays couverts, explicitement. Sert à la légende
 *    affichée sous les filtres (« MENA = quels pays ? »).
 */

/** Noms arabes des marques (retombe sur le nom d'origine si absent). */
export const BRAND_LABELS_AR: Record<string, string> = {
  amazon: "أمازون",
  steam: "ستيم",
  playstation: "بلايستيشن",
  "playstation store": "متجر بلايستيشن",
  "google play": "جوجل بلاي",
  google: "جوجل",
  itunes: "آيتونز",
  "app store": "آيتونز",
  apple: "آبل",
  netflix: "نتفليكس",
  xbox: "إكس بوكس",
  nintendo: "نينتندو",
  spotify: "سبوتيفاي",
  "razer gold": "ريزر جولد",
  pubg: "ببجي",
  "pubg mobile": "ببجي موبايل",
  "free fire": "فري فاير",
  "google tv": "جوجل تي في",
  shein: "شين",
  "playstation plus": "بلايستيشن بلس",
  hulu: "هولو",
  "amazon prime": "أمازون برايم",
  "google one": "جوجل ون",
  cashbill: "كاش بيل",
  mygoods: "ماي جودز",
};

/** Nom d'affichage bilingue d'une région/pays (clé = code en minuscules). */
export const REGION_NAMES: Record<string, { ar: string; en: string }> = {
  us: { ar: "أمريكا", en: "United States" },
  fr: { ar: "فرنسا", en: "France" },
  de: { ar: "ألمانيا", en: "Germany" },
  gb: { ar: "بريطانيا", en: "United Kingdom" },
  uk: { ar: "بريطانيا", en: "United Kingdom" },
  ae: { ar: "الإمارات", en: "United Arab Emirates" },
  sa: { ar: "السعودية", en: "Saudi Arabia" },
  qa: { ar: "قطر", en: "Qatar" },
  kw: { ar: "الكويت", en: "Kuwait" },
  bh: { ar: "البحرين", en: "Bahrain" },
  om: { ar: "عُمان", en: "Oman" },
  jo: { ar: "الأردن", en: "Jordan" },
  lb: { ar: "لبنان", en: "Lebanon" },
  eg: { ar: "مصر", en: "Egypt" },
  ma: { ar: "المغرب", en: "Morocco" },
  dz: { ar: "الجزائر", en: "Algeria" },
  tn: { ar: "تونس", en: "Tunisia" },
  ly: { ar: "ليبيا", en: "Libya" },
  sd: { ar: "السودان", en: "Sudan" },
  tr: { ar: "تركيا", en: "Türkiye" },
  eu: { ar: "أوروبا", en: "Europe (EU)" },
  global: { ar: "عالمية", en: "Global" },
  mena: { ar: "الشرق الأوسط وشمال إفريقيا", en: "MENA — Middle East & North Africa" },
  row: { ar: "باقي العالم", en: "Rest of World" },
  na: { ar: "أمريكا الشمالية", en: "North America" },
  latam: { ar: "أمريكا اللاتينية", en: "Latin America" },
  apac: { ar: "آسيا والمحيط الهادي", en: "Asia-Pacific" },
  asia: { ar: "آسيا", en: "Asia" },
  africa: { ar: "إفريقيا", en: "Africa" },
  ca: { ar: "كندا", en: "Canada" },
  au: { ar: "أستراليا", en: "Australia" },
  nz: { ar: "نيوزيلندا", en: "New Zealand" },
  it: { ar: "إيطاليا", en: "Italy" },
  es: { ar: "إسبانيا", en: "Spain" },
  nl: { ar: "هولندا", en: "Netherlands" },
  be: { ar: "بلجيكا", en: "Belgium" },
  at: { ar: "النمسا", en: "Austria" },
  ch: { ar: "سويسرا", en: "Switzerland" },
  pt: { ar: "البرتغال", en: "Portugal" },
  gr: { ar: "اليونان", en: "Greece" },
  ie: { ar: "إيرلندا", en: "Ireland" },
  pl: { ar: "بولندا", en: "Poland" },
  se: { ar: "السويد", en: "Sweden" },
  no: { ar: "النرويج", en: "Norway" },
  dk: { ar: "الدنمارك", en: "Denmark" },
  fi: { ar: "فنلندا", en: "Finland" },
  ro: { ar: "رومانيا", en: "Romania" },
  cz: { ar: "التشيك", en: "Czechia" },
  hu: { ar: "هنغاريا", en: "Hungary" },
  ru: { ar: "روسيا", en: "Russia" },
  ua: { ar: "أوكرانيا", en: "Ukraine" },
  br: { ar: "البرازيل", en: "Brazil" },
  mx: { ar: "المكسيك", en: "Mexico" },
  ar: { ar: "الأرجنتين", en: "Argentina" },
  cl: { ar: "تشيلي", en: "Chile" },
  co: { ar: "كولومبيا", en: "Colombia" },
  jp: { ar: "اليابان", en: "Japan" },
  kr: { ar: "كوريا", en: "South Korea" },
  in: { ar: "الهند", en: "India" },
  pk: { ar: "باكستان", en: "Pakistan" },
  ph: { ar: "الفلبين", en: "Philippines" },
  id: { ar: "إندونيسيا", en: "Indonesia" },
  my: { ar: "ماليزيا", en: "Malaysia" },
  ng: { ar: "نيجيريا", en: "Nigeria" },
};

/**
 * Pays couverts par chaque code qui n'est pas un pays (bilingue).
 * Affiché sous les filtres de région (bot et Mini App) : « MENA = … ».
 */
export const REGION_NOTES: Record<string, { ar: string; en: string }> = {
  MENA: {
    ar: "الشرق الأوسط وشمال إفريقيا — الخليج (السعودية، الإمارات، قطر، الكويت، عُمان، البحرين)، العراق، اليمن، مصر، الأردن، لبنان، والمغرب العربي (المغرب، الجزائر، تونس، ليبيا، موريتانيا)",
    en: "Middle East & North Africa — Gulf (Saudi Arabia, UAE, Qatar, Kuwait, Oman, Bahrain), Iraq, Yemen, Egypt, Jordan, Lebanon, and Maghreb (Morocco, Algeria, Tunisia, Libya, Mauritania)",
  },
  GLOBAL: {
    ar: "عالمية — تعمل في جميع الدول دون قيود إقليمية",
    en: "Worldwide — works in any country, no regional restriction",
  },
  EU: {
    ar: "أوروبا — الحساب يجب أن يكون مسجلاً في دولة أوروبية (فرنسا، ألمانيا، إيطاليا، إسبانيا، هولندا…)",
    en: "Europe — the account must be registered in a European country (France, Germany, Italy, Spain, Netherlands…)",
  },
  ROW: {
    ar: "باقي دول العالم — خارج أوروبا وأمريكا الشمالية غالباً",
    en: "Rest of World — usually outside Europe and North America",
  },
  LATAM: {
    ar: "أمريكا اللاتينية — المكسيك، البرازيل، الأرجنتين، تشيلي، كولومبيا، بيرو…",
    en: "Latin America — Mexico, Brazil, Argentina, Chile, Colombia, Peru…",
  },
  APAC: {
    ar: "آسيا والمحيط الهادي — اليابان، كوريا، الصين، الهند، أستراليا، نيوزيلندا، جنوب شرق آسيا…",
    en: "Asia-Pacific — Japan, Korea, China, India, Australia, New Zealand, Southeast Asia…",
  },
  NA: {
    ar: "أمريكا الشمالية — الولايات المتحدة وكندا",
    en: "North America — United States & Canada",
  },
  ASIA: {
    ar: "قارة آسيا — اليابان، كوريا، الصين، الهند، جنوب شرق آسيا…",
    en: "Asia — Japan, Korea, China, India, Southeast Asia…",
  },
  AFRICA: {
    ar: "قارة إفريقيا — مصر، المغرب، الجزائر، تونس، جنوب إفريقيا، نيجيريا، كينيا…",
    en: "Africa — Egypt, Morocco, Algeria, Tunisia, South Africa, Nigeria, Kenya…",
  },
};

/** Nom d'affichage d'une région : code en clair si inconnu (jamais vide). */
export function regionName(region: string, locale: "ar" | "en"): string {
  const name = REGION_NAMES[region.trim().toLowerCase()];
  if (!name) return region.trim().toUpperCase() || region;
  return locale === "ar" ? name.ar : name.en;
}
