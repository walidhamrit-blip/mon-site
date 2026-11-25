#!/usr/bin/env node
/**
 * A05 (audit SEO/GEO 2026-11-01) & redirections SEO des anciennes URLs `/codes/[slug]` :
 *  - panne déclarée → page temporaire 200 + noindex (jamais de 404) ;
 *  - aucune panne → redirection 308 si le slug est une ancienne fiche indexée
 *    (`spotify-premium`, `steam-wallet`…), sinon 404 classique.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const { productPageFallback, resolveLegacyDigitalSlugRedirect } = await import(
  "../src/lib/digital-fallback.ts"
);

test("panne déclarée → « unavailable » (page temporaire, pas de 404)", () => {
  assert.equal(productPageFallback(true), "unavailable");
});

test("aucune panne → « not_found » (404 classique)", () => {
  assert.equal(productPageFallback(false), "not_found");
});

test("resolveLegacyDigitalSlugRedirect redirige spotify-premium vers la fiche active ou le rayon", () => {
  const catalog = [
    { slug: "fzr-giftcard-spotify-us", platform: "Spotify", status: "available" },
    { slug: "fzr-giftcard-steam-global", platform: "Steam", status: "available" },
  ];
  assert.equal(
    resolveLegacyDigitalSlugRedirect("spotify-premium", catalog),
    "/codes/fzr-giftcard-spotify-us",
  );
  assert.equal(
    resolveLegacyDigitalSlugRedirect("spotify-premium", []),
    "/codes/category/subscription_code",
  );
  assert.equal(
    resolveLegacyDigitalSlugRedirect("unknown-random-slug", catalog),
    null,
  );
});
