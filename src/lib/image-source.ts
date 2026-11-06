/**
 * Hôtes distants dont on accepte de payer l'optimisation `next/image`.
 *
 * Cette liste est la SEULE source de vérité : `next.config.ts` en dérive
 * `images.remotePatterns`, et les composants s'en servent pour décider s'ils
 * peuvent passer par l'optimiseur.
 *
 * Pourquoi une liste fermée : avec `hostname: "**"`, `/_next/image` devient un
 * proxy d'images ouvert. N'importe qui peut demander
 * `/_next/image?url=https://attaquant.example/photo-8000x8000.jpg&w=3840&q=90`
 * et faire payer à ce déploiement le téléchargement, le décodage et le
 * transcodage d'une image arbitraire — sans jamais passer par une page du site.
 *
 * Un domaine non listé n'est PAS une impasse : les composants retombent sur
 * `unoptimized` (chargement direct par le navigateur, autorisé par la CSP
 * `img-src https:`). On perd le srcset, jamais l'image.
 */

/** Hôtes dont l'optimisation est assurée (contenu éditorial maîtrisé). */
export const OPTIMIZED_IMAGE_HOSTS = [
  "images.unsplash.com",
  "images.pexels.com",
  // Sites clients déployés sur Vercel, nommés un par un : `**.vercel.app`
  // suffisait à proxifier n'importe quel déploiement Vercel tiers.
  "demo-cabinet-medecin.vercel.app",
  "al-manhaj-company.vercel.app",
  "m-et-outillage-modele-3.vercel.app",
  "tulin-magazin.vercel.app",
  "pizzeria-demo1.vercel.app",
  "demo-meubles.vercel.app",
  "hala-dun.vercel.app",
  "demo-jouets.vercel.app",
  "al-massa.vercel.app",
  "al-bay.vercel.app",
  "alssadaka-sanitary.vercel.app",
  "smartphine-demo.vercel.app",
] as const;

const OPTIMIZED = new Set<string>(OPTIMIZED_IMAGE_HOSTS);

/**
 * Vrai si la source peut passer par l'optimiseur Next :
 *  - chemin local (`/visuals/…`, `/previews/…`, `/api/media/…`) ;
 *  - hôte explicitement listé ci-dessus.
 *
 * Tout le reste (domaine client ajouté depuis /admin, CDN inconnu) est chargé
 * directement, sans optimisation.
 */
export function isOptimizableImageSource(src: string): boolean {
  const value = src?.trim() ?? "";
  if (!value) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && OPTIMIZED.has(url.host.toLowerCase());
  } catch {
    return false;
  }
}

/** Props à étaler sur `<Image>` : désactive l'optimiseur pour un hôte inconnu. */
export function imageOptimizationProps(src: string): { unoptimized?: true } {
  return isOptimizableImageSource(src) ? {} : { unoptimized: true };
}
