import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { ADMIN_PUBLIC_LINKS, activeAdminHref } from "../src/lib/admin-navigation.ts";

const panel = "src/app/admin/(panel)/";
const read = (path) => readFileSync(panel + path, "utf8");

test("admin shortcuts match the four public journeys and existing routes", () => {
  assert.deepEqual(ADMIN_PUBLIC_LINKS.map((link) => link.href), ["/", "/codes", "/creation-sites", "/contact"]);
  for (const link of ADMIN_PUBLIC_LINKS) {
    assert.ok(existsSync(`src/app/(site)${link.href === "/" ? "" : link.href}/page.tsx`));
  }
  for (const file of ["admin-nav.tsx", "page.tsx"]) assert.match(read(file), /ADMIN_PUBLIC_LINKS\.map/);
});

test("only the most specific admin entry is active", () => {
  const links = ["/admin", "/admin/digital", "/admin/digital/orders", "/admin/orders"];
  assert.equal(activeAdminHref("/admin", links), "/admin");
  assert.equal(activeAdminHref("/admin/digital/orders/123", links), "/admin/digital/orders");
  assert.equal(activeAdminHref("/admin/digital", links), "/admin/digital");
  assert.equal(activeAdminHref("/admin/orders", links), "/admin/orders");
  assert.equal(activeAdminHref("/admin/digital-other", links), undefined);
  assert.equal(activeAdminHref("/admin/unknown", links), undefined);
  assert.match(read("admin-nav.tsx"), /aria-current=\{active \? "page" : undefined\}/);
});

test("the dashboard promotes digital catalog and orders without fake counts", () => {
  const source = read("page.tsx");
  assert.match(source, /href: "\/admin\/digital"/);
  assert.match(source, /href: "\/admin\/digital\/orders"/);
  assert.match(source, /dbError \? "—" : value/);
  assert.match(source, /Demandes indisponibles/);
  assert.doesNotMatch(source, /Le site public fonctionne normalement/);
});

test("legacy controls no longer promise to change the fixed homepage", () => {
  assert.match(read("sections/sections-studio.tsx"), /ne pilotent plus l’accueil/);
  assert.doesNotMatch(read("sections/sections-studio.tsx"), /Sections affichées sur l’accueil/);
  assert.match(read("content/content-editor.tsx"), /photo fixe, sans texte ni boutons/);
  assert.match(read("content/content-editor.tsx"), /Seul le sous-titre/);
  assert.match(read("catalog/page.tsx"), /distinct de la boutique/);
});

test("health diagnostics are explicit, uncached, bounded and not delivery actions", () => {
  const source = read("system-health.tsx");
  assert.match(source, /onClick=\{check\}/);
  assert.match(source, /fetch\("\/api\/health", \{ cache: "no-store"/);
  assert.match(source, /controller\.abort\(\), 25000/);
  assert.match(source, /setSnapshot\(null\)/);
  assert.match(source, /typeof data\.database\?\.connected !== "boolean"/);
  assert.match(source, /value === false \? no : "Non vérifié"/);
  assert.doesNotMatch(source, /useEffect|deliverPaidDigitalOrder|method: "POST"/);
  assert.match(source, /Un accès fournisseur valide ne confirme ni le solde/);
});
