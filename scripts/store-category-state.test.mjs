import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync("src/components/digital-store-view.tsx", "utf8");
const catalog = readFileSync("src/components/digital-catalog.tsx", "utf8");

test("store family is controlled by the URL and shared by nav, chips and rail", () => {
  assert.match(view, /const \[kind, setKind\] = useState<DigitalKind \| "all">\(initialKind\)/);
  assert.match(view, /url\.searchParams\.set\("kind", next\)/);
  assert.match(view, /url\.searchParams\.delete\("kind"\)/);
  assert.match(view, /window\.history\.replaceState\(null, "", url\)/);
  assert.match(view, /aria-current=\{kind === category\.kind \? "page" : undefined\}/);
  assert.match(view, /<DigitalCatalog products=\{products\} kind=\{kind\} onKindChange=\{selectKind\} \/>/);
  assert.match(catalog, /kind: DigitalKind \| "all"; onKindChange: \(kind: DigitalKind \| "all"\) => void/);
  assert.match(catalog, /const setKind = onKindChange/);
  assert.doesNotMatch(catalog, /useState<DigitalKind \| "all">\(initialKind\)/);
});
