import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("all fixed homepage and journey images have editable defaults", () => {
  const types = read("src/lib/site-types.ts");
  const defaults = read("src/lib/content.ts");
  for (const id of ["homeHero", "webBanner", "storeBanner", "gatewayWebsites", "gatewayGiftCards", "gatewayTopUps"]) {
    assert.match(types, new RegExp(`"${id}"`));
    assert.match(defaults, new RegExp(`${id}: \\{`));
  }
  assert.match(read("src/lib/store.ts"), /visuals: resolveVisuals\(map\.get\(KEY_VISUALS\)\)/);
  assert.match(read("src/lib/store.ts"), /visuals: KEY_VISUALS/);
  assert.match(read("src/lib/validation.ts"), /visuals: siteVisualsSchema/);
  assert.match(read("src/app/admin/actions.ts"), /visuals: SETTINGS_KEYS\.visuals/);
});

test("public banners and section cards consume the saved visuals", () => {
  // La bannière d'accueil défile désormais sur TOUS les visuels enregistrés :
  // `homeHero` doit rester en tête (c'est le visuel choisi dans /admin → Médias)
  // et chaque tuile garde son texte alternatif AR/EN.
  const hero = read("src/components/sections/hero.tsx");
  assert.match(hero, /const ordered = \[visuals\.homeHero,/);
  assert.match(hero, /src=\{visual\.src\}/);
  assert.match(hero, /alt=\{ar \? visual\.altAr : visual\.altEn\}/);

  const gateway = read("src/components/sections/home-gateway.tsx");
  for (const id of ["gatewayWebsites", "gatewayGiftCards", "gatewayTopUps"]) {
    assert.match(gateway, new RegExp(`visual: visuals\\.${id}`));
  }
  assert.match(gateway, /src=\{item\.visual\.src\}/);

  const editorial = read("src/components/editorial-visual.tsx");
  assert.match(editorial, /visuals\.webBanner : visuals\.storeBanner/);
  assert.match(editorial, /src=\{image\.src\}/);
});

test("the visual editor supports upload, URL, preview, alt text and reset", () => {
  assert.ok(existsSync("src/app/admin/(panel)/media/page.tsx"));
  const editor = read("src/app/admin/(panel)/media/visuals-editor.tsx");
  assert.match(editor, /type="file"/);
  assert.match(editor, /fetch\("\/api\/admin\/media"/);
  assert.match(editor, /Importer une photo/);
  assert.match(editor, /URL de la photo ou chemin local/);
  assert.match(editor, /Description de l’image \(arabe\)/);
  assert.match(editor, /saveContentSection\("visuals", visuals\)/);
  assert.match(editor, /resetContentSection\("visuals"\)/);
  assert.match(read("src/app/admin/(panel)/admin-nav.tsx"), /href: "\/admin\/media"/);
  for (const alias of ["codes", "creation-sites"]) {
    assert.ok(existsSync(`src/app/admin/(panel)/${alias}/page.tsx`));
    assert.match(read(`src/app/admin/(panel)/${alias}/page.tsx`), /redirect\("\/admin\/media"\)/);
  }
});

test("uploaded media is authenticated, same-origin, optimized and persistent", () => {
  const upload = read("src/app/api/admin/media/route.ts");
  assert.match(upload, /enforceSameOrigin\(request\)/);
  assert.match(upload, /isAdminAuthenticated\(\)/);
  assert.match(upload, /sharp\(source/);
  assert.match(upload, /\.webp\(\{ quality: 82 \}\)/);
  assert.match(upload, /db\.insert\(mediaAssets\)/);
  assert.match(upload, /4 Mo maximum/);

  const serve = read("src/app/api/media/[id]/route.ts");
  assert.match(serve, /UUID_PATTERN\.test\(id\)/);
  assert.match(serve, /Cache-Control/);
  assert.match(serve, /immutable/);
  assert.match(read("src/db/index.ts"), /CREATE TABLE IF NOT EXISTS media_assets/);
  assert.match(read("next.config.ts"), /pathname: "\/api\/media\/\*\*"/);
});
