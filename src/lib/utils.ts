import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Lien WhatsApp (wa.me) — point de construction unique.
 *
 * wa.me exige un numéro en chiffres seuls (format international sans
 * « + », espaces ni tirets) : avec un « + », WhatsApp affiche « numéro
 * invalide ». La valeur stockée dans /admin peut contenir un « + » ou
 * des espaces — on normalise donc systématiquement ici.
 */
export function whatsappLink(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
