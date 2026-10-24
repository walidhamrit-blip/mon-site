// Libellés lisibles des champs du formulaire de demande.
//
// Le formulaire public envoie des identifiants techniques (« restaurant »,
// « vitrine-plus », « 4500+ »…). On les traduit ici en arabe et en anglais
// pour les e-mails, et on réutilise ces libellés côté administration.

export type LeadLocale = "ar" | "en";

export type LeadField = "sector" | "need" | "budget" | "deadline";

type Labels = { ar: string; en: string };

const SECTOR: Record<string, Labels> = {
  restaurant: { ar: "مطعم / مقهى", en: "Restaurant / Café" },
  clinic: { ar: "عيادة / مركز", en: "Clinic / Center" },
  boutique: { ar: "متجر / بوتيك", en: "Shop / Boutique" },
  realestate: { ar: "عقارات", en: "Real Estate" },
  education: { ar: "تعليم / تدريب", en: "Education / Training" },
  hotel: { ar: "فندق / شقق", en: "Hotel / Apartments" },
  other: { ar: "أخرى", en: "Other" },
};

const NEED: Record<string, Labels> = {
  vitrine: { ar: "موقع واجهة", en: "Vitrine site" },
  "vitrine-plus": { ar: "واجهة بلس + حجز", en: "Vitrine+ with booking" },
  shop: { ar: "متجر / حجز كامل", en: "Full shop / booking" },
  redesign: { ar: "إعادة تصميم", en: "Redesign" },
};

const BUDGET: Record<string, Labels> = {
  "under-300": { ar: "أقل من 300 $", en: "Under $300" },
  "300-600": { ar: "300–600 $", en: "$300–600" },
  "600-1000": { ar: "600–1000 $", en: "$600–1,000" },
  "1000+": { ar: "أكثر من 1000 $", en: "$1,000+" },
  // Anciennes clés (demandes reçues avant le passage USD uniquement) :
  // conservées pour afficher correctement l'historique en administration.
  "1000-1500": { ar: "1000-1500 (قديم)", en: "1000-1500 (legacy)" },
  "1500-2500": { ar: "1500-2500 (قديم)", en: "1500-2500 (legacy)" },
  "2500-4500": { ar: "2500-4500 (قديم)", en: "2500-4500 (legacy)" },
  "4500+": { ar: "4500+ (قديم)", en: "4500+ (legacy)" },
};

const DEADLINE: Record<string, Labels> = {
  urgent: { ar: "مستعجل (أسبوع)", en: "Urgent (1 week)" },
  "7-14": { ar: "7-14 يوم", en: "7-14 days" },
  flexible: { ar: "مرن", en: "Flexible" },
};

const FIELDS: Record<LeadField, Record<string, Labels>> = {
  sector: SECTOR,
  need: NEED,
  budget: BUDGET,
  deadline: DEADLINE,
};

/** Libellé d'un champ de demande, avec repli sur la valeur brute. */
export function leadFieldLabel(
  field: LeadField,
  value: string,
  locale: LeadLocale = "en",
): string {
  const entry = FIELDS[field][value.trim().toLowerCase()];
  if (!entry) return value;
  return entry[locale];
}

/** Noms lisibles des champs (utilisés dans les e-mails et l'administration). */
export const LEAD_FIELD_TITLES: Record<LeadField, { ar: string; en: string }> = {
  sector: { ar: "القطاع", en: "Sector" },
  need: { ar: "ما تحتاجه", en: "What you need" },
  budget: { ar: "الميزانية", en: "Budget" },
  deadline: { ar: "المدة", en: "Deadline" },
};
