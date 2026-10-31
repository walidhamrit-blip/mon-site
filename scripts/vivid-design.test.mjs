import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { build } from "esbuild";

const { outputFiles } = await build({ entryPoints: ["src/lib/themes.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const themes = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

test("all palettes share a white/black neutral canvas", () => {
  for (const theme of themes.THEMES) {
    assert.equal(theme.light.background, "#FFFFFF");
    assert.equal(theme.dark.background, "#000000");
    assert.equal(theme.light.card, "#FFFFFF");
    assert.equal(theme.dark.card, "#10131B");
    assert.ok(themes.themeCss().includes(`html[data-theme="${theme.id}"]{--background:#FFFFFF;`));
  }
  assert.ok(new Set(themes.THEMES.map((theme) => theme.light.accent)).size > 3);
});

test("carousel uses local assets and exposes pause, keyboard buttons and reduced motion", () => {
  const source = readFileSync("src/components/hero-visual.tsx", "utf8");
  const assets = [...source.matchAll(/src: "([^"]+)"/g)].map((match) => match[1]);
  assert.ok(assets.length >= 3);
  for (const asset of assets) assert.ok(existsSync(`public${asset}`), asset);
  assert.match(source, /useReducedMotion/);
  assert.match(source, /document\.hidden/);
  assert.match(source, /setPaused\(true\)/);
  assert.match(source, /clearInterval/);
  assert.match(source, /onFocusCapture/);
  assert.match(source, /data-playing=\{playing\}/);
  assert.match(readFileSync("src/app/globals.css", "utf8"), /prefers-reduced-motion: reduce/);
});

test("homepage artwork is allowed by the image optimizer and is not an old carousel", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /pathname: "\/visuals\/\*\*"/);
  assert.ok(existsSync("public/visuals/futuristic-gaming-hero.webp"));
  const hero = readFileSync("src/components/sections/hero.tsx", "utf8");
  assert.match(hero, /panoramic-hero/);
  assert.doesNotMatch(hero, /HeroVisual/);
  assert.match(readFileSync("src/app/(site)/layout.tsx", "utf8"), /public-shell/);
  for (const path of ["src/components/website-creation-view.tsx", "src/app/(site)/codes/page.tsx"]) {
    assert.match(readFileSync(path, "utf8"), /EditorialVisual/);
    assert.doesNotMatch(readFileSync(path, "utf8"), /HeroVisual/);
  }
});

function luminance(hex) {
  const channels = hex.replace("#", "").match(/.{2}/g).map((v) => parseInt(v, 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("all six day and night palettes have readable action and body color pairs", () => {
  for (const theme of themes.THEMES) for (const mode of ["light", "dark"]) {
    const p = theme[mode];
    for (const [foreground, background] of [["foreground", "background"], ["card-foreground", "card"], ["muted-foreground", "background"], ["muted-foreground", "secondary"], ["accent-foreground", "accent"], ["accent-foreground", "accent-hover"], ["accent", "background"], ["accent", "secondary"]]) {
      assert.ok(contrast(p[foreground], p[background]) >= 4.5, `${theme.id}/${mode} ${foreground} on ${background}: ${contrast(p[foreground], p[background]).toFixed(2)}`);
    }
  }
});

test("gaming system scopes public pages and includes day-aware footer and form styling", () => {
  const css = readFileSync("src/app/gaming.css", "utf8");
  assert.match(readFileSync("src/app/layout.tsx", "utf8"), /import "\.\/gaming\.css"/);
  assert.match(css, /\.public-shell \.public-footer\.gaming-footer/);
  assert.match(css, /input,textarea,select/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(readFileSync("src/components/footer.tsx", "utf8"), /gaming-footer-grid/);
});
