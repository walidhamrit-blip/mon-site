import type { MetadataRoute } from "next";
import { getSiteDataCached } from "@/lib/store";

/**
 * Robots d'exploration.
 *
 * Stratégie « référencement IA » : tous les crawlers génériques et ceux des
 * assistants (ChatGPT/OpenAI, Claude/Anthropic, Perplexity, Google AI,
 * Amazon, Apple, ByteDance…) sont explicitement AUTORISÉS sur le contenu
 * public, tandis que l'admin et les API restent fermés.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
  "Amazonbot",
  "Applebot-Extended",
  "Bytespider",
  "Diffbot",
  "ImagesiftBot",
  "cohere-ai",
  "Meta-ExternalAgent",
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { config } = await getSiteDataCached();
  const disallow = ["/api/", "/admin", "/admin/login", "/pay/"];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow,
      },
      {
        // Les assistants IA peuvent lire tout le contenu public indexable.
        userAgent: AI_CRAWLERS,
        allow: "/",
        disallow,
      },
    ],
    sitemap: `${config.url.replace(/\/+$/, "")}/sitemap.xml`,
    host: config.url.replace(/\/+$/, ""),
  };
}
