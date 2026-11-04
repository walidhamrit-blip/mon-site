import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  DELIVERY_WARRANTY_DAYS,
  deliveryAcceptUrl,
  deliveryAmountLabel,
  sanitizeDeliveryChecklist,
  sanitizeDeliveryLinks,
  sanitizeWarrantyDays,
  deliveryWarrantyEndsAt,
} from "../src/lib/delivery-kit.ts";
import {
  buildDeliveryAcceptedEmail,
  buildDeliveryAcceptedNotification,
  buildDeliveryLinkEmail,
} from "../src/lib/delivery-emails.ts";

const site = {
  siteUrl: "https://nokhba.net.ly",
  siteName: "Nukhba",
  siteNameAr: "نخبة",
  supportEmail: "contact@nokhba.net.ly",
  supportWhatsapp: "218913442640",
};

const baseData = {
  ref: "LIV-9F2C1A",
  clientName: "Ahmed Ali",
  projectTitle: "Site vitrine — clinique Al Noor",
  amountUsd: "510",
  acceptUrl: "https://nokhba.net.ly/livraison/LIV-9F2C1A?t=abc123",
  links: [{ label: "Site en ligne", url: "https://alnoor.ly" }],
  items: [{ label: "Formulaire de contact testé" }],
  warrantyDays: 30,
  ...site,
};

/* ---------------------------- Kit de livraison ---------------------------- */

test("only http(s) links are kept — a javascript: URL must never reach the delivery page", () => {
  const links = sanitizeDeliveryLinks([
    { label: "Site", url: "https://alnoor.ly" },
    { label: "XSS", url: "javascript:alert(1)" },
    { label: "Data", url: "data:text/html,<script>" },
    { label: "Vide", url: "" },
    { label: "Local", url: "/admin" },
  ]);
  assert.deepEqual(links, [{ label: "Site", url: "https://alnoor.ly" }]);
});

test("links are bounded in number and length", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ label: "L", url: `https://a${i}.com` }));
  assert.equal(sanitizeDeliveryLinks(many).length, 12);
  assert.equal(sanitizeDeliveryChecklist(null).length, 0);
  assert.equal(sanitizeDeliveryChecklist(["  ", "SEO de base"]).length, 1);
  assert.equal(sanitizeDeliveryLinks("pas un tableau").length, 0);
});

test("warranty stays a bounded, positive number of days", () => {
  assert.equal(sanitizeWarrantyDays(undefined), DELIVERY_WARRANTY_DAYS);
  assert.equal(sanitizeWarrantyDays(0), 1);
  assert.equal(sanitizeWarrantyDays(-10), 1);
  assert.equal(sanitizeWarrantyDays(4000), 365);
  assert.equal(sanitizeWarrantyDays("45"), 45);
});

test("the acceptance URL carries the token and never a guessable id alone", () => {
  const url = deliveryAcceptUrl("https://nokhba.net.ly/", "LIV-1", "tok_123");
  assert.equal(url, "https://nokhba.net.ly/livraison/LIV-1?t=tok_123");
});

test("warranty ends N days after delivery, never before", () => {
  const delivered = new Date("2026-11-04T10:00:00.000Z");
  const ends = deliveryWarrantyEndsAt(delivered, 30);
  assert.equal(ends.getTime() - delivered.getTime(), 30 * 86400000);
});

test("amounts are displayed as money, blanks stay blank", () => {
  assert.equal(deliveryAmountLabel("510"), "$510");
  assert.equal(deliveryAmountLabel("510.50"), "$510.50");
  assert.equal(deliveryAmountLabel(""), "");
  assert.equal(deliveryAmountLabel(null), "");
});

/* ------------------------------- E-mails -------------------------------- */

test("the delivery e-mail gives the client the acceptance link, in both languages", () => {
  const mail = buildDeliveryLinkEmail(baseData);
  assert.match(mail.subject, /LIV-9F2C1A/);
  assert.ok(mail.html.includes(baseData.acceptUrl.replace(/&/g, "&amp;")));
  assert.ok(mail.text.includes(baseData.acceptUrl));
  // Bilinguisme réel : arabe ET anglais dans le corps.
  assert.match(mail.html, /مرحباً/);
  assert.match(mail.html, /Hello/);
  // Aucun secret : le mot de passe ne doit jamais passer par un e-mail archivé.
  assert.doesNotMatch(mail.html, /mot de passe/i);
  assert.doesNotMatch(mail.text, /password/i);
});

test("the acceptance receipt is dated and states the warranty", () => {
  const acceptedAt = new Date("2026-11-05T09:30:00.000Z");
  const mail = buildDeliveryAcceptedEmail({
    ...baseData,
    acceptedAt,
    acceptedByName: "Ahmed Ali",
  });
  assert.match(mail.subject, /LIV-9F2C1A/);
  assert.match(mail.html, /Ahmed Ali/);
  assert.match(mail.text, /Warranty: 30 days/);
  assert.match(mail.html, /اعتماد/);
});

test("the internal notification is in French and quotes the client e-mail", () => {
  const mail = buildDeliveryAcceptedNotification({
    ...baseData,
    clientEmail: "ahmed@example.com",
    acceptedAt: new Date("2026-11-05T09:30:00.000Z"),
  });
  assert.match(mail.subject, /Recette validée/);
  assert.match(mail.text, /ahmed@example\.com/);
});

/* ------------------------- Câblage (fichiers) ---------------------------- */

const page = "src/app/(site)/livraison/[ref]/page.tsx";
const client = "src/app/(site)/livraison/[ref]/accept-delivery.tsx";
const api = "src/app/api/deliveries/accept/route.ts";

test("the public delivery page exists, is private and token-gated", () => {
  assert.ok(existsSync(page), `${page} manquant`);
  const source = readFileSync(page, "utf8");
  assert.match(source, /findDeliveryForTracking\(/);
  assert.match(source, /noindex: true/);
  assert.match(source, /force-dynamic/);
  // Pas de lien interne devinable : la page ne liste jamais les dossiers.
  assert.doesNotMatch(source, /listDeliveries/);
});

test("acceptance is a POST to the API, with the token, not a link", () => {
  const source = readFileSync(client, "utf8");
  assert.match(source, /fetch\("\/api\/deliveries\/accept"/);
  assert.match(source, /method: "POST"/);
  assert.match(source, /role="alert"/);
  // Deux garde-fous : un nom qui signe et une case à cocher.
  assert.match(source, /delivery-accept-name/);
  assert.match(source, /delivery-accept-confirm/);
});

test("the API validates input, checks the origin and rate-limits", () => {
  const source = readFileSync(api, "utf8");
  assert.match(source, /enforceSameOrigin\(req\)/);
  assert.match(source, /checkRateLimit\(ACCEPT_LIMIT, req\)/);
  assert.match(source, /acceptSchema\.safeParse/);
  assert.match(source, /acceptDelivery\(/);
  // Un reçu n'est envoyé qu'une seule fois.
  assert.match(source, /if \(!result\.alreadyAccepted\)/);
});

test("the table and its columns are created without a manual migration", () => {
  const ddl = readFileSync("src/db/index.ts", "utf8");
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS site_deliveries/);
  assert.match(ddl, /tracking_token_hash text NOT NULL/);
  assert.match(ddl, /ALTER TABLE site_deliveries ADD COLUMN IF NOT EXISTS tracking_token_cipher/);
  assert.match(ddl, /warranty_days integer NOT NULL DEFAULT 30/);
  const schema = readFileSync("src/db/schema.ts", "utf8");
  assert.match(schema, /export const siteDeliveries = pgTable\("site_deliveries"/);
});

test("delivery pages stay out of the index and out of the sitemap", () => {
  const robots = readFileSync("src/app/robots.ts", "utf8");
  assert.match(robots, /"\/livraison"/);
  const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
  assert.doesNotMatch(sitemap, /livraison/);
});

test("the admin owns the handover: creation, link, resend, deletion", () => {
  assert.ok(existsSync("src/app/admin/(panel)/livraisons/page.tsx"));
  const manager = readFileSync("src/app/admin/(panel)/livraisons/deliveries-manager.tsx", "utf8");
  assert.match(manager, /createDeliveryAction\(/);
  assert.match(manager, /deliveryLinkAction\(/);
  assert.match(manager, /sendDeliveryLinkAction\(/);
  assert.match(manager, /deleteDeliveryAction\(/);
  // Rappel de sécurité affiché dans le formulaire.
  assert.match(manager, /N’écrivez jamais de mot de passe/);
  const actions = readFileSync("src/app/admin/actions.ts", "utf8");
  for (const name of [
    "export async function createDeliveryAction",
    "export async function deliveryLinkAction",
    "export async function sendDeliveryLinkAction",
    "export async function deleteDeliveryAction",
  ]) {
    assert.ok(actions.includes(name), `${name} manquant`);
  }
  assert.match(actions, /await requireAdmin\(\)/);
  const nav = readFileSync("src/app/admin/(panel)/admin-nav.tsx", "utf8");
  assert.match(nav, /href: "\/admin\/livraisons"/);
});

test("the documented process backs the feature", () => {
  assert.ok(existsSync("docs/livraison-site-apres-paiement-2026-11-04.md"));
});
