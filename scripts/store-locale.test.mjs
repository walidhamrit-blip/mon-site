import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { build } from "esbuild";

const root = process.cwd();
mkdirSync(join(root, ".scratch"), { recursive: true });
const outDir = mkdtempSync(join(root, ".scratch/store-locale-"));
after(() => rmSync(outDir, { recursive: true, force: true }));
const outfile = join(outDir, "view.cjs");
await build({
  stdin: { contents: `
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { I18nProvider } from "@/lib/i18n";
    import { DigitalStoreView } from "@/components/digital-store-view";
    export function render(locale, degraded) {
      return renderToStaticMarkup(createElement(I18nProvider, {defaultLocale:locale}, createElement(DigitalStoreView, {products:[], degraded, initialKind:"all"})));
    }`, resolveDir: root, loader: "tsx" },
  outfile, bundle: true, platform: "node", format: "cjs", packages: "external", jsx: "automatic",
});
const { render } = createRequire(import.meta.url)(outfile);

// Check rendered copy, not just the existence of ternaries in the source.
const textOf = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
for (const degraded of [false, true]) {
  test(`English shop copy renders in English (maintenance=${degraded})`, () => {
    const text = textOf(render("en", degraded));
    assert.match(text, /Game keys, gift cards/);
    assert.match(text, /How buying and delivery work/);
    assert.match(text, /Questions before you buy/);
    assert.match(text, /Gift cards/);
    assert.doesNotMatch(text, /[\u0600-\u06FF]/);
    if (degraded) assert.match(text, /temporarily under maintenance/);
  });
  test(`Arabic shop copy stays Arabic (maintenance=${degraded})`, () => {
    const text = textOf(render("ar", degraded));
    assert.match(text, /أكواد ألعاب وبرامج وبطاقات هدايا/);
    assert.match(text, /كيف يعمل الشراء والتسليم/);
    assert.doesNotMatch(text, /Questions before you buy/);
    if (degraded) assert.match(text, /المتجر متوقف مؤقتاً للصيانة/);
  });
}
