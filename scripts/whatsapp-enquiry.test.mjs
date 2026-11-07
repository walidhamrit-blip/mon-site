import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicEnquiryPage, buildEnquiryMessage } from "../src/lib/whatsapp-enquiry.ts";
import { whatsappLink } from "../src/lib/utils.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

/**
 * Retire les commentaires avant d'inspecter du code : une explication qui cite
 * `form-action 'self'` (par exemple pour raconter le bug) ne doit pas faire
 * échouer un test de configuration. Même précaution que dans
 * scripts/security-headers.test.mjs.
 */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

test("public pages include the viewed product or service, in both languages", () => {
  const page = publicEnquiryPage("/codes/steam-card", "Steam Card | Nukhba");
  assert.deepEqual(page, { path: "/codes/steam-card", title: "Steam Card | Nukhba" });
  assert.match(buildEnquiryMessage("en", "  Is it available?  ", page), /Is it available\?[\s\S]*Steam Card[\s\S]*\/codes\/steam-card/);
  assert.match(buildEnquiryMessage("ar", "كم السعر؟", page), /كم السعر؟[\s\S]*Steam Card/);
  assert.equal(publicEnquiryPage("/services/web-design", "Web design").path, "/services/web-design");
});

test("private and unknown pages are not included", () => {
  for (const path of ["/codes/commande", "/abonnements/suivi", "/livraison/SECRET", "/pay/success", "/admin", "/codes/commande/secret", "/codes/foo?token=secret"]) {
    assert.equal(publicEnquiryPage(path, "secret"), null, path);
  }
  const text = buildEnquiryMessage("en", "Need help with my order", null);
  assert.doesNotMatch(text, /secret|Page path/);
});

/* ──────── Régression : le bouton WhatsApp ne doit plus être un formulaire ─── */

test("le lien WhatsApp est une URL wa.me complète et encodée", () => {
  const message = "Hello Nukhba 👋\nPage : /codes/steam-card";
  const link = whatsappLink("+218 91-234-5678", message);
  assert.match(link, /^https:\/\/wa\.me\/218912345678\?text=/);
  assert.equal(decodeURIComponent(link.split("?text=")[1]), message);
  // Le « + » et les espaces du numéro sont normalisés, sinon WhatsApp affiche
  // « numéro invalide ».
  assert.equal(whatsappLink("218912345678"), "https://wa.me/218912345678");
  assert.doesNotMatch(link, / /, "le message doit être encodé, sans espace brut");
});

test("la fenêtre WhatsApp ouvre un lien, jamais un formulaire", () => {
  // Commentaires retirés : le fichier raconte le bug et cite donc `<form …>`.
  const component = code(read("src/components/whatsapp-enquiry.tsx"));
  // Cause du bug : `<form action="https://wa.me/…" method="get">` est bloqué
  // par `form-action 'self'` — le clic ne faisait plus rien, sans message.
  assert.doesNotMatch(component, /<form\b/, "un <form> vers wa.me est bloqué par la CSP");
  assert.doesNotMatch(component, /action=\{whatsappLink/, "l'action de formulaire doit rester un lien");
  assert.match(component, /href=\{link\}/);
  assert.match(component, /target="_blank"/);
  assert.match(component, /rel="noopener noreferrer"/);
});

test("aucun formulaire du site ne poste vers un domaine externe", () => {
  const offenders = [];
  for (const file of walk(join(root, "src"))) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const source = code(readFileSync(file, "utf8"));
    const externalAction =
      /<form[^>]*\baction=\{[^}]*(https?:|wa\.me|whatsapp)/i.test(source) ||
      /<form[^>]*\baction="https?:\/\//i.test(source) ||
      /<form[^>]*\baction=\{`https?:/i.test(source);
    if (externalAction) offenders.push(file.slice(root.length));
  }
  assert.deepEqual(
    offenders,
    [],
    "formulaire vers un domaine externe : bloqué silencieusement par `form-action 'self'`",
  );
});

test("le durcissement CSP n'est pas assoupli pour réparer WhatsApp", () => {
  const config = code(read("next.config.ts"));
  assert.match(config, /"form-action 'self'"/);
  assert.doesNotMatch(config, /form-action[^"]*(wa\.me|whatsapp)/i);
});
