#!/usr/bin/env node
/**
 * Comportement réel de `trackEvent` dans un navigateur simulé.
 *
 * Le bug corrigé : `track()` de Vercel ignore silencieusement un événement
 * quand `window.va` n'existe pas encore. Or `<Analytics />` installe `window.va`
 * dans un effet qui passe APRÈS les effets des pages. Les événements de montage
 * (`service_view`, `checkout_start`) doivent donc être mis en file `vaq`.
 *
 * Node 22 exécute directement le TypeScript sans build (type stripping).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const analytics = import("../src/lib/analytics.ts");

test("avant le script Vercel : l'événement est mis en file dans vaq", async () => {
  const { trackEvent } = await analytics;
  const w = {};
  globalThis.window = w;

  trackEvent({ name: "service_view", id: "fix-optimize" });

  assert.deepEqual(w.vaq, [
    ["event", { name: "service_view", data: { id: "fix-optimize" } }],
  ]);
  delete globalThis.window;
});

test("après le script Vercel : track() est appelé avec les bonnes données", async () => {
  const { trackEvent } = await analytics;
  const calls = [];
  globalThis.window = { va: (...args) => calls.push(args) };

  trackEvent({ name: "gateway_click", path: "/creation-sites" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "event");
  assert.equal(calls[0][1].name, "gateway_click");
  assert.deepEqual(calls[0][1].data, { path: "/creation-sites" });
  delete globalThis.window;
});
