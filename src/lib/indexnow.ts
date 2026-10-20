import { siteConfig } from "@/lib/config";
import { notifyGoogleSitemap } from "@/lib/google-indexing";
import { blogArticles } from "@/lib/blog-articles";

/**
 * IndexNow — notification de contenu nouveau/modifié aux moteurs qui
 * supportent le protocole (Bing, Yandex, Seznam, Naver ; Google travaille à
 * sa prise en charge). Le ping est déclenché automatiquement après chaque
 * enregistrement dans /admin, en parallèle de la revalidation ISR.
 *
 * Clé publique : elle doit être servie sur https://<domaine>/<clé>.txt
 * (fichier présent dans public/). Surcharge possible via INDEXNOW_KEY.
 */
const DEFAULT_INDEXNOW_KEY = "496dc8c7fd1cb72cb39630115e74bdde";
const ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Ne notifie que sur un déploiement Vercel de production — jamais en local,
 * jamais sur les déploiements preview (les URLs de preview ne correspondent
 * pas au domaine vérifié par IndexNow).
 */
function isProductionHost(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/**
 * Envoie la liste des URLs modifiées. Tolérant aux pannes : un échec réseau
 * ne doit jamais faire échouer une action d'administration.
 */
export async function notifyIndexNow(
  urls: string[],
  baseUrl: string = siteConfig.url,
): Promise<void> {
  if (!isProductionHost()) return;

  const key = process.env.INDEXNOW_KEY?.trim() || DEFAULT_INDEXNOW_KEY;
  const origin = baseUrl.replace(/\/+$/, "");
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    console.warn("[indexnow] URL de base invalide :", baseUrl);
    return;
  }

  const urlList = Array.from(
    new Set(
      urls
        .filter(Boolean)
        .map((u) => (u.startsWith("http") ? u : `${origin}${u.startsWith("/") ? "" : "/"}${u}`)),
    ),
  ).filter((u) => {
    try {
      return new URL(u).host === host;
    } catch {
      return false;
    }
  });

  if (urlList.length === 0) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${origin}/${key}.txt`,
        urlList,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn("[indexnow] réponse non-OK :", res.status);
    }
  } catch (error) {
    console.warn(
      "[indexnow] ping ignoré :",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Ping Bing Sitemap (complément IndexNow, même endpoint Google-like pour Bing). */
export async function notifyBingSitemap(baseUrl: string = siteConfig.url): Promise<void> {
  if (!isProductionHost()) return;
  const origin = baseUrl.replace(/\/+$/, "");
  const sitemapUrl = `${origin}/sitemap.xml`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) console.warn("[bing-ping] réponse non-OK :", res.status);
  } catch (error) {
    console.warn("[bing-ping] ping ignoré :", error instanceof Error ? error.message : error);
  }
}

/** URLs publiques principales + fichiers IA/sitemap + toutes les fiches réalisations. */
export async function pingAllPublicPages(): Promise<void> {
  // Import différé pour éviter tout cycle au chargement du module.
  const { getAllKnownDemos, getSiteDataCached } = await import("@/lib/store");
  const { config, content } = await getSiteDataCached();
  const base = config.url.replace(/\/+$/, "");
  const { sectorIds } = await import("@/lib/sectors");
  const sectorUrls = sectorIds.map((id) => `${base}/sectors/${id}`);
  const urls = [
    `${base}/`,
    `${base}/demos`,
    `${base}/apps`,
    `${base}/products`,
    `${base}/sectors`,
    `${base}/services`,
    `${base}/blog`,
    `${base}/pricing`,
    `${base}/contact`,
    `${base}/badge`,
    `${base}/llms.txt`,
    `${base}/llms-full.txt`,
    `${base}/sitemap.xml`,
    ...sectorUrls,
    ...config.standaloneServices.map((service) => `${base}/services/${service.id}`),
    ...blogArticles.map((article) => `${base}/blog/${article.slug}`),
    ...getAllKnownDemos(content).map((d) => `${base}/demos/${d.slug}`),
  ];
  await Promise.allSettled([
    notifyIndexNow(urls, config.url),
    notifyGoogleSitemap(config.url),
    notifyBingSitemap(config.url),
  ]);
}

/** Re-validation + ping unifié (IndexNow + Google) — appelé après chaque save admin. */
export async function notifyAllSearchEngines(): Promise<void> {
  await pingAllPublicPages();
}
