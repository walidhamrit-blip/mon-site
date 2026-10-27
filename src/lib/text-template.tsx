import type { ReactNode } from "react";

/**
 * Découpe un gabarit sur ses `{jetons}` et intercale des fragments React.
 *
 * Utilisé par les pages bilingues pour slipped des prix (composant <Price>)
 * ou des compteurs dans un texte : la valeur reste du JSX, donc un vrai
 * <strong> ou un vrai composant — un simple `String.replace` l'aurait
 * converti en texte.
 */
export function renderTemplate(
  template: string,
  values: Record<string, ReactNode>,
): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\{(\w+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push(template.slice(lastIndex, match.index));
    }
    const key = match[1];
    parts.push(<strong key={key}>{values[key]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < template.length) parts.push(template.slice(lastIndex));
  return parts;
}

/**
 * Remplace les jetons par du texte simple (mots, nombres) — sans JSX.
 * Le remplacement passe par une fonction pour que le `$` d'un montant ne
 * soit pas interprété comme une référence de groupe de capture.
 */
export function fillTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, () => String(value)),
    template,
  );
}
