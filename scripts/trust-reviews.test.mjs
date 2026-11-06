#!/usr/bin/env node
/**
 * Tests des avis clients : validation des profils, demandes d'avis et
 * identité légale.
 *
 * Ce que ces tests protègent :
 *   1. **aucun lien d'avis hors plateforme** — un champ administrable finit
 *      dans un `href` public et dans des e-mails clients ; une faute de
 *      frappe ne doit pas envoyer un client chez un tiers ;
 *   2. **aucune note inventée** — ni `aggregateRating`, ni « 5 étoiles »
 *      dans une demande d'avis (les conditions de Trustpilot et de Google
 *      l'interdisent) ;
 *   3. **rien ne part tant que rien n'est configuré** — les valeurs par
 *      défaut désactivent à la fois les liens et les e-mails ;
 *   4. **compatibilité ascendante** — une configuration enregistrée avant
 *      l'ajout des blocs `trust` / `legal` doit toujours s'enregistrer.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "trust-reviews-"));

const aliasPlugin = {
  name: "alias-at-src",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => {
      const base = join(srcRoot, args.path.slice(2));
      const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
      const found = candidates.find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
      );
      return { path: found ?? base };
    });
  },
};

async function compile(entry, name) {
  const outfile = join(outDir, `${name}.mjs`);
  await build({
    entryPoints: [join(srcRoot, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    plugins: [aliasPlugin],
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const trust = await compile("lib/trust.ts", "trust");
const reviewEmails = await compile("lib/review-emails.ts", "review-emails");
const deliveryEmails = await compile("lib/delivery-emails.ts", "delivery-emails");
const validation = await compile("lib/validation.ts", "validation");
const configModule = await compile("lib/config.ts", "config");

test.after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ */
/* 1. Validation des URL de profils                                    */
/* ------------------------------------------------------------------ */

test("les URL de profils invalides sont rejetées", () => {
  const { normalizeReviewUrl } = trust;
  const rejected = [
    "",
    "   ",
    "trustpilot.com/review/nokhba.net.ly", // pas de schéma
    "http://fr.trustpilot.com/review/nokhba.net.ly", // pas https
    "https://trustpilot.com.evil.example/review/nokhba.net.ly", // suffixe piégé
    "https://evil-trustpilot.com/review/nokhba.net.ly", // préfixe piégé
    "https://fr.fr.trustpilot.com/review/x", // sous-domaine imbriqué
    "https://user:pass@fr.trustpilot.com/review/nokhba.net.ly",
    "javascript:alert(1)",
    "https://www.scamadviser.com.evil.io/check-website/nokhba.net.ly",
    "https://example.com/review",
  ];
  for (const value of rejected) {
    assert.equal(normalizeReviewUrl("trustpilot", value), "", `aurait dû être rejeté : ${value}`);
  }
});

test("les URL de profils valides sont normalisées", () => {
  const { normalizeReviewUrl } = trust;
  assert.equal(
    normalizeReviewUrl("trustpilot", " https://fr.trustpilot.com/review/nokhba.net.ly/ "),
    "https://fr.trustpilot.com/review/nokhba.net.ly",
  );
  assert.equal(
    normalizeReviewUrl("trustpilot", "https://www.trustpilot.com/review/nokhba.net.ly"),
    "https://www.trustpilot.com/review/nokhba.net.ly",
  );
  assert.equal(
    normalizeReviewUrl("scamadviser", "https://www.scamadviser.com/check-website/nokhba.net.ly"),
    "https://www.scamadviser.com/check-website/nokhba.net.ly",
  );
  assert.equal(
    normalizeReviewUrl("google", "https://g.page/r/abc123/review"),
    "https://g.page/r/abc123/review",
  );
  assert.equal(
    normalizeReviewUrl("google", "https://maps.app.goo.gl/xyz"),
    "https://maps.app.goo.gl/xyz",
  );
});

test("une URL Google n'est pas acceptée pour Trustpilot (et inversement)", () => {
  const { normalizeReviewUrl } = trust;
  assert.equal(normalizeReviewUrl("trustpilot", "https://g.page/r/abc/review"), "");
  assert.equal(normalizeReviewUrl("google", "https://fr.trustpilot.com/review/x"), "");
});

/* ------------------------------------------------------------------ */
/* 2. Liens publics + interrupteur d'envoi                             */
/* ------------------------------------------------------------------ */

test("reviewLinks : seuls les profils configurés sortent, dans un ordre stable", () => {
  const { reviewLinks } = trust;
  assert.deepEqual(reviewLinks(undefined), []);
  assert.deepEqual(reviewLinks({ trustpilotUrl: "", scamadviserUrl: "", googleReviewUrl: "", reviewInvites: true }), []);

  const links = reviewLinks({
    trustpilotUrl: "https://fr.trustpilot.com/review/nokhba.net.ly",
    scamadviserUrl: "https://www.scamadviser.com/check-website/nokhba.net.ly",
    googleReviewUrl: "https://g.page/r/abc/review",
    reviewInvites: true,
  });
  assert.deepEqual(
    links.map((link) => link.platform),
    ["trustpilot", "google", "scamadviser"],
  );
  for (const link of links) {
    assert.ok(link.labelAr.length > 0 && link.labelEn.length > 0);
    assert.ok(link.url.startsWith("https://"));
  }
  assert.equal(links[0].kind, "profile", "/review/ = fiche publique");
});

test("les demandes d'avis sont désactivées par défaut et exigent une cible", () => {
  const { reviewInvitesEnabled, reviewLinks } = trust;
  const base = {
    trustpilotUrl: "",
    trustpilotReviewUrl: "",
    googleReviewUrl: "",
    scamadviserUrl: "",
    reviewInvites: false,
  };
  assert.equal(reviewInvitesEnabled(base), false);
  assert.equal(reviewInvitesEnabled(undefined), false);
  // Activé mais aucun profil : rien à envoyer.
  assert.equal(reviewInvitesEnabled({ ...base, reviewInvites: true }), false);
  // Scamadviser seul ne suffit pas : le client y lit une fiche, il n'y écrit pas.
  assert.equal(
    reviewInvitesEnabled({
      ...base,
      reviewInvites: true,
      scamadviserUrl: "https://www.scamadviser.com/check-website/nokhba.net.ly",
    }),
    false,
  );
  assert.equal(
    reviewInvitesEnabled({
      ...base,
      reviewInvites: true,
      trustpilotUrl: "https://fr.trustpilot.com/review/nokhba.net.ly",
    }),
    true,
  );
  assert.equal(reviewLinks({ ...base, reviewInvites: true }).length, 0);
});

/* ------------------------------------------------------------------ */
/* 3. Contenu des demandes d'avis                                      */
/* ------------------------------------------------------------------ */

const INVITE_LINKS = [
  {
    platform: "trustpilot",
    url: "https://fr.trustpilot.com/review/nokhba.net.ly",
    labelAr: "اقرأ واكتب تقييماً على Trustpilot",
    labelEn: "Read & write a review on Trustpilot",
  },
];

test("reviewPromptForConfig : rien tant que l'envoi est désactivé", () => {
  const { reviewPromptForConfig } = reviewEmails;
  const config = {
    name: "Nukhba",
    nameAr: "نخبة",
    url: "https://nokhba.net.ly",
    email: "contact@nokhba.net.ly",
    trust: { trustpilotUrl: "", googleReviewUrl: "", scamadviserUrl: "", reviewInvites: false },
  };
  assert.equal(reviewPromptForConfig(config, { kind: "digital", orderRef: "D-1" }), null);
  assert.equal(
    reviewPromptForConfig({ ...config, trust: { ...config.trust, reviewInvites: true } }, { kind: "digital" }),
    null,
    "activé sans profil = aucun bloc",
  );
});

test("le bloc de demande d'avis est bilingue et ne dicte aucune note", () => {
  const { reviewInviteBlock } = reviewEmails;
  const block = reviewInviteBlock({
    siteName: "Nukhba",
    siteNameAr: "نخبة",
    siteUrl: "https://nokhba.net.ly",
    orderRef: "D-2026-0042",
    kind: "digital",
    links: INVITE_LINKS,
    supportEmail: "contact@nokhba.net.ly",
  });
  assert.ok(block, "un bloc est attendu");
  assert.match(block.html, /[\u0600-\u06FF]/, "version arabe attendue");
  assert.match(block.html, /How was your experience|Your review helps|How did we do/i);
  assert.ok(block.html.includes("https://fr.trustpilot.com/review/nokhba.net.ly"));
  assert.ok(block.text.join("\n").includes("https://fr.trustpilot.com/review/nokhba.net.ly"));
  assert.ok(block.html.includes("D-2026-0042"));

  // Aucune consigne de note, aucune promesse de contrepartie.
  const forbidden = [/5\s*(étoiles|stars|نجوم)/i, /\b5\s*\/\s*5\b/, /⭐/, /★/, /remise de|discount code|coupon/i];
  for (const pattern of forbidden) {
    assert.doesNotMatch(block.html, pattern, `formulation interdite : ${pattern}`);
    assert.doesNotMatch(block.text.join("\n"), pattern, `formulation interdite : ${pattern}`);
  }
  // La porte de sortie (support) est présente dans le même bloc.
  assert.ok(block.html.includes("mailto:contact@nokhba.net.ly"));

  // Prénom échappé (le nom vient d'une commande, donc d'une saisie client).
  const withName = reviewInviteBlock({
    siteName: "Nukhba",
    siteNameAr: "نخبة",
    siteUrl: "https://nokhba.net.ly",
    clientName: '<script>alert(1)</script>',
    kind: "digital",
    links: INVITE_LINKS,
  });
  assert.ok(withName);
  assert.ok(!withName.html.includes("<script>"), "le prénom doit être échappé");
  assert.ok(withName.html.includes("&lt;script&gt;"));
  assert.match(withName.html, /مرحباً/);
});

test("l'e-mail autonome de demande d'avis porte la référence et les liens", () => {
  const { buildReviewInviteEmail } = reviewEmails;
  const email = buildReviewInviteEmail({
    siteName: "Nukhba",
    siteNameAr: "نخبة",
    siteUrl: "https://nokhba.net.ly",
    orderRef: "SITE-77",
    kind: "website",
    links: INVITE_LINKS,
  });
  assert.ok(email);
  assert.ok(email.subject.includes("SITE-77"));
  assert.ok(email.html.includes("https://fr.trustpilot.com/review/nokhba.net.ly"));
  assert.ok(email.text.includes("https://fr.trustpilot.com/review/nokhba.net.ly"));
  assert.equal(
    buildReviewInviteEmail({
      siteName: "Nukhba",
      siteNameAr: "نخبة",
      siteUrl: "https://nokhba.net.ly",
      kind: "website",
      links: [],
    }),
    null,
  );
});

test("le reçu de recette intègre la demande d'avis quand elle est fournie", () => {
  const { buildDeliveryAcceptedEmail } = deliveryEmails;
  const { reviewInviteBlock } = reviewEmails;
  const data = {
    ref: "SITE-77",
    clientName: "Walid",
    projectTitle: "Site vitrine",
    amountUsd: "250.00",
    acceptUrl: "",
    links: [],
    items: [],
    warrantyDays: 90,
    siteUrl: "https://nokhba.net.ly",
    siteName: "Nukhba",
    siteNameAr: "نخبة",
    supportEmail: "contact@nokhba.net.ly",
    supportWhatsapp: "",
    acceptedAt: new Date("2026-11-06T10:00:00Z"),
  };
  const withoutReview = buildDeliveryAcceptedEmail(data);
  const review = reviewInviteBlock({
    siteName: "Nukhba",
    siteNameAr: "نخبة",
    siteUrl: "https://nokhba.net.ly",
    orderRef: "SITE-77",
    kind: "website",
    links: INVITE_LINKS,
  });
  const withReview = buildDeliveryAcceptedEmail({ ...data, review });

  assert.ok(!withoutReview.html.includes("trustpilot.com"), "sans config : aucun lien d'avis");
  assert.ok(withReview.html.includes("https://fr.trustpilot.com/review/nokhba.net.ly"));
  assert.ok(withReview.text.includes("https://fr.trustpilot.com/review/nokhba.net.ly"));
});

/* ------------------------------------------------------------------ */
/* 3 bis. Vérification de domaine Trustpilot                           */
/* ------------------------------------------------------------------ */

test("le jeton de vérification Trustpilot n'est émis que s'il est sain", () => {
  const { trustpilotVerificationToken, trustpilotVerificationMeta, TRUSTPILOT_META_NAME } = trust;

  assert.equal(TRUSTPILOT_META_NAME, "trustpilot-one-time-domain-verification-id");
  assert.equal(trustpilotVerificationToken(""), "");
  assert.equal(trustpilotVerificationToken(null), "");
  assert.equal(trustpilotVerificationToken("abc"), "", "trop court");
  assert.equal(
    trustpilotVerificationToken('a1b2c3d4"><script>alert(1)</script>'),
    "",
    "caractères hors [A-Za-z0-9._-] refusés",
  );
  assert.equal(trustpilotVerificationToken("a1b2c3d4-e5f6_7890.abc"), "a1b2c3d4-e5f6_7890.abc");
  assert.deepEqual(trustpilotVerificationMeta(""), {});
  assert.deepEqual(trustpilotVerificationMeta("a1b2c3d4-e5f6"), {
    "trustpilot-one-time-domain-verification-id": "a1b2c3d4-e5f6",
  });
});

/* ------------------------------------------------------------------ */
/* 3 ter. Widget Trustpilot                                            */
/* ------------------------------------------------------------------ */

const TRUSTPILOT_PAGE = `<!doctype html><html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Nokhba","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.7","reviewCount":"23"}}</script>
</head><body></body></html>`;

test("parseTrustpilotAggregate lit aggregateRating, y compris dans @graph", () => {
  const { parseTrustpilotAggregate } = trust;

  assert.deepEqual(parseTrustpilotAggregate(TRUSTPILOT_PAGE), {
    reviewCount: 23,
    ratingValue: 4.7,
  });

  const graph = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [{ "@type": "WebSite" }, { "@type": "Organization", aggregateRating: { ratingValue: 3.9, reviewCount: 7 } }],
  })}</script>`;
  assert.deepEqual(parseTrustpilotAggregate(graph), { reviewCount: 7, ratingValue: 3.9 });

  // 0 avis est une information valide (ce n'est pas « inconnu »).
  const zero = `<script type="application/ld+json">{"aggregateRating":{"ratingValue":0,"reviewCount":0}}</script>`;
  assert.deepEqual(parseTrustpilotAggregate(zero), { reviewCount: 0, ratingValue: 0 });

  // Rien d'exploitable → null (on n'affiche pas de note plutôt qu'une fausse).
  assert.equal(parseTrustpilotAggregate(""), null);
  assert.equal(parseTrustpilotAggregate("<html><body>pas de json-ld</body></html>"), null);
  assert.equal(parseTrustpilotAggregate('<script type="application/ld+json">{oups</script>'), null);
  assert.equal(
    parseTrustpilotAggregate('<script type="application/ld+json">{"aggregateRating":{"ratingValue":"n/a"}}</script>'),
    null,
  );
});

test("compte Trustpilot et gabarit de widget sont validés", () => {
  const { trustpilotBusinessUnitId, trustpilotTemplateId, TRUSTPILOT_TEMPLATES } = trust;

  assert.equal(trustpilotBusinessUnitId("6aed0b0c0156593a344109f3"), "6aed0b0c0156593a344109f3");
  assert.equal(trustpilotBusinessUnitId("6AED0B0C0156593A344109F3"), "6aed0b0c0156593a344109f3");
  assert.equal(trustpilotBusinessUnitId(""), "");
  assert.equal(trustpilotBusinessUnitId("pas-un-id"), "");
  assert.equal(trustpilotBusinessUnitId('<script>'), "");

  assert.equal(trustpilotTemplateId("micro-combo"), TRUSTPILOT_TEMPLATES["micro-combo"]);
  assert.equal(trustpilotTemplateId("mini"), TRUSTPILOT_TEMPLATES.mini);
  assert.equal(trustpilotTemplateId(""), TRUSTPILOT_TEMPLATES["micro-combo"]);
  assert.equal(trustpilotTemplateId("gabarit-inconnu"), TRUSTPILOT_TEMPLATES["micro-combo"]);
  // Un identifiant déjà résolu reste accepté.
  assert.equal(trustpilotTemplateId(TRUSTPILOT_TEMPLATES.mini), TRUSTPILOT_TEMPLATES.mini);
});

test("le widget reste masqué sans avis (jamais de « 0,0 » public)", () => {
  const { shouldShowReviewWidget } = trust;
  const id = "6aed0b0c0156593a344109f3";

  assert.equal(shouldShowReviewWidget({ reviewCount: 0, businessUnitId: id, minReviews: 1 }), false);
  assert.equal(shouldShowReviewWidget({ reviewCount: 1, businessUnitId: id, minReviews: 1 }), true);
  assert.equal(shouldShowReviewWidget({ reviewCount: 0, businessUnitId: id, minReviews: 0 }), true);
  assert.equal(shouldShowReviewWidget({ reviewCount: 5, businessUnitId: "", minReviews: 0 }), false);
  assert.equal(shouldShowReviewWidget({ reviewCount: 12, businessUnitId: id, minReviews: 10 }), true);
  assert.equal(shouldShowReviewWidget({ reviewCount: 9, businessUnitId: id, minReviews: 10 }), false);
});

test("le widget pointe toujours vers la fiche, jamais vers le formulaire", () => {
  const { trustpilotProfileUrl, reviewProfileUrls } = trust;

  assert.equal(
    trustpilotProfileUrl({ trustpilotUrl: "https://www.trustpilot.com/review/nokhba.net.ly", trustpilotReviewUrl: "" }),
    "https://www.trustpilot.com/review/nokhba.net.ly",
  );
  assert.equal(
    trustpilotProfileUrl({
      trustpilotUrl: "",
      trustpilotReviewUrl: "https://www.trustpilot.com/evaluate/nokhba.net.ly",
    }),
    "https://www.trustpilot.com/review/nokhba.net.ly",
  );

  const urls = reviewProfileUrls({
    trustpilotUrl: "https://www.trustpilot.com/review/nokhba.net.ly",
    trustpilotReviewUrl: "",
    scamadviserUrl: "https://www.scamadviser.com/check-website/nokhba.net.ly",
    googleReviewUrl: "https://g.page/r/abc/review",
    reviewInvites: true,
  });
  assert.deepEqual(urls, [
    "https://www.trustpilot.com/review/nokhba.net.ly",
    "https://www.scamadviser.com/check-website/nokhba.net.ly",
  ]);
  // Une URL invalide ne pollue pas le JSON-LD.
  assert.deepEqual(reviewProfileUrls({ trustpilotUrl: "https://evil.example/x", scamadviserUrl: "" }), []);
});

test("le badge est câblé sur l'accueil, /avis et la boutique", () => {
  assert.match(read("src/app/(site)/page.tsx"), /<TrustpilotBadge config=\{config\}/);
  assert.match(read("src/app/(site)/avis/page.tsx"), /<TrustpilotBadge config=\{config\}/);
  assert.match(read("src/app/(site)/codes/page.tsx"), /<TrustpilotBadge config=\{config\}/);
  assert.match(read("src/components/sections/home-sections.tsx"), /trustBadge/);
  assert.match(read("src/components/digital-store-view.tsx"), /trustBadge/);
  assert.match(read("src/components/trustpilot-widget.tsx"), /widget\.trustpilot\.com\/bootstrap\/v5/);
  assert.match(read("src/lib/seo.ts"), /sameAs: sameAsLinks\(config\)/);
});

/* ------------------------------------------------------------------ */
/* 4. Identité légale                                                  */
/* ------------------------------------------------------------------ */

test("legalRows n'affiche jamais un champ vide", () => {
  const { legalRows } = trust;
  const rows = legalRows({
    name: "Nukhba",
    url: "https://nokhba.net.ly",
    email: "contact@nokhba.net.ly",
    phone: "+218 91 344 2640",
    address: "شارع الجمهورية، طرابلس، ليبيا",
    addressEn: "Al Jumhouriya Street, Tripoli, Libya",
    legal: {
      companyName: "",
      registrationNumber: "",
      registrationAuthority: "",
      publisherName: "",
      hostName: "Vercel Inc.",
      hostWebsite: "https://vercel.com",
    },
  });
  const labels = rows.map((row) => row.labelEn);
  assert.ok(labels.includes("Trading name"));
  assert.ok(labels.includes("Hosting"));
  assert.ok(!labels.includes("Commercial registration no."), "aucun registre inventé");
  const phone = rows.find((row) => row.labelEn === "Phone");
  assert.equal(phone.href, "tel:+218913442640");
});

test("legalRows publie le registre et le responsable quand ils sont renseignés", () => {
  const { legalRows } = trust;
  const rows = legalRows({
    name: "Nukhba",
    legal: {
      companyName: "Nukhba Studio SARL",
      registrationNumber: "12345",
      registrationAuthority: "Tripoli",
      publisherName: "Walid Hamrit",
      hostName: "Vercel Inc.",
      hostWebsite: "https://vercel.com",
    },
  });
  const registration = rows.find((row) => row.labelEn === "Commercial registration no.");
  assert.ok(registration);
  assert.equal(registration.value, "12345 — Tripoli");
  assert.ok(rows.some((row) => row.labelEn === "Publication manager" && row.value === "Walid Hamrit"));
  assert.ok(rows.some((row) => row.labelEn === "Legal name" && row.value === "Nukhba Studio SARL"));
});

/* ------------------------------------------------------------------ */
/* 5. Configuration & compatibilité ascendante                         */
/* ------------------------------------------------------------------ */

test("les valeurs par défaut exposent le profil revendiqué mais n'envoient rien", async () => {
  const { siteConfig } = configModule;
  const { reviewLinks, reviewInviteLinks, reviewInvitesEnabled } = trust;

  const links = reviewLinks(siteConfig.trust);
  assert.deepEqual(
    links.map((link) => [link.platform, link.url, link.kind]),
    [["trustpilot", "https://www.trustpilot.com/review/nokhba.net.ly", "profile"]],
  );
  // Le profil est publié, mais aucun e-mail n'est envoyé tant que ce n'est
  // pas activé dans l'admin, et l'identité légale n'est pas inventée.
  assert.equal(reviewInvitesEnabled(siteConfig.trust), false);
  assert.equal(reviewInviteLinks(siteConfig.trust).length, 1);
  assert.equal(siteConfig.legal.registrationNumber, "");
  assert.equal(siteConfig.legal.hostName, "Vercel Inc.");
});

test("le lien direct d'avis est prioritaire et porte le bon libellé", () => {
  const { reviewInviteLinks, reviewLinks } = trust;
  const base = {
    trustpilotUrl: "https://www.trustpilot.com/review/nokhba.net.ly",
    trustpilotReviewUrl: "",
    googleReviewUrl: "",
    scamadviserUrl: "https://www.scamadviser.com/check-website/nokhba.net.ly",
    reviewInvites: true,
  };

  // Sans lien direct : la fiche publique sert de cible (Trustpilot y affiche
  // « Écrire un avis »).
  assert.deepEqual(
    reviewInviteLinks(base).map((link) => [link.platform, link.kind]),
    [["trustpilot", "profile"]],
  );

  // Avec le formulaire direct : il passe devant, libellé « écrire ».
  const direct = reviewInviteLinks({
    ...base,
    trustpilotReviewUrl: "https://www.trustpilot.com/evaluate/nokhba.net.ly",
  });
  assert.equal(direct.length, 1);
  assert.equal(direct[0].url, "https://www.trustpilot.com/evaluate/nokhba.net.ly");
  assert.equal(direct[0].kind, "write");
  assert.match(direct[0].labelEn, /Write a Trustpilot review/);

  // Scamadviser n'entre jamais dans une demande d'avis.
  assert.ok(!reviewInviteLinks(base).some((link) => link.platform === "scamadviser"));
  // …mais reste affiché sur /avis.
  assert.ok(reviewLinks(base).some((link) => link.platform === "scamadviser"));

  // Un lien direct invalide ne casse pas l'invitation : on retombe sur la fiche.
  assert.equal(
    reviewInviteLinks({ ...base, trustpilotReviewUrl: "https://evil.example/evaluate/x" })[0].url,
    "https://www.trustpilot.com/review/nokhba.net.ly",
  );
});

test("une configuration enregistrée avant les blocs trust/legal reste valide", () => {
  const { siteConfigSchema } = validation;
  const { siteConfig } = configModule;
  const legacy = { ...siteConfig };
  delete legacy.trust;
  delete legacy.legal;

  const parsed = siteConfigSchema.safeParse(legacy);
  assert.ok(parsed.success, JSON.stringify(parsed.error?.issues ?? []));
  assert.equal(parsed.data.trust.reviewInvites, false);
  assert.equal(parsed.data.trust.trustpilotUrl, "");
  assert.equal(parsed.data.legal.hostName, "Vercel Inc.");
});

test("le schéma refuse un lien d'avis non https", () => {
  const { siteConfigSchema } = validation;
  const { siteConfig } = configModule;
  const parsed = siteConfigSchema.safeParse({
    ...siteConfig,
    trust: {
      trustpilotUrl: "http://fr.trustpilot.com/review/nokhba.net.ly",
      scamadviserUrl: "",
      googleReviewUrl: "",
      reviewInvites: false,
    },
  });
  assert.equal(parsed.success, false);
});

test("le schéma accepte un profil https et l'interrupteur d'envoi", () => {
  const { siteConfigSchema } = validation;
  const { siteConfig } = configModule;
  const parsed = siteConfigSchema.safeParse({
    ...siteConfig,
    trust: {
      trustpilotUrl: "https://fr.trustpilot.com/review/nokhba.net.ly",
      scamadviserUrl: "",
      googleReviewUrl: "",
      reviewInvites: true,
    },
  });
  assert.ok(parsed.success, JSON.stringify(parsed.error?.issues ?? []));
  assert.equal(parsed.data.trust.reviewInvites, true);
});

/* ------------------------------------------------------------------ */
/* 6. Pages publiques et garde-fous                                    */
/* ------------------------------------------------------------------ */

const read = (path) => readFileSync(join(root, path), "utf8");

test("les pages /avis et /mentions-legales existent et sont liées", () => {
  for (const path of [
    "src/app/(site)/avis/page.tsx",
    "src/app/(site)/avis/reviews-client.tsx",
    "src/app/(site)/mentions-legales/page.tsx",
    "src/app/(site)/mentions-legales/legal-notice-client.tsx",
  ]) {
    assert.ok(existsSync(join(root, path)), `${path} manquant`);
  }
  assert.match(read("src/components/footer.tsx"), /"\/avis"/);
  assert.match(read("src/components/footer.tsx"), /"\/mentions-legales"/);
  assert.match(read("src/components/legal-links.tsx"), /"\/avis"/);
  assert.match(read("src/components/legal-links.tsx"), /"\/mentions-legales"/);
  const sitemap = read("src/app/sitemap.ts");
  assert.match(sitemap, /\/avis`/);
  assert.match(sitemap, /\/mentions-legales`/);
});

/** Retire les commentaires pour ne pas confondre une règle et son explication. */
const code = (path) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

test("aucune note agrégée inventée dans les pages et les e-mails", () => {
  for (const path of [
    "src/lib/review-emails.ts",
    "src/app/(site)/avis/reviews-client.tsx",
    "src/app/(site)/mentions-legales/page.tsx",
    "src/app/(site)/mentions-legales/legal-notice-client.tsx",
    "src/components/trustpilot-widget.tsx",
  ]) {
    const source = code(path);
    assert.doesNotMatch(source, /aggregateRating/, `${path} ne doit pas déclarer de note agrégée`);
    assert.doesNotMatch(source, /ratingValue|reviewCount/, `${path} ne doit pas publier de note maison`);
  }
});

test("le badge ne sert qu'à décider de l'affichage, sans publier de chiffre", () => {
  const badge = code("src/components/trustpilot-badge.tsx");
  assert.doesNotMatch(badge, /aggregateRating/);
  // Le nombre d'avis ne sert qu'à la condition d'affichage ; il n'est jamais
  // rendu dans le HTML (c'est le widget Trustpilot qui l'affiche, à la source).
  assert.match(badge, /shouldShowReviewWidget\(\{[\s\S]*?reviewCount: stats\.reviewCount/);
  // Deux occurrences, toutes deux dans l'appel de condition :
  // `reviewCount: stats.reviewCount`.
  assert.equal((badge.match(/reviewCount/g) ?? []).length, 2);
  assert.doesNotMatch(badge, /ratingValue/);
});

test("le JSON-LD du site ne déclare jamais de note auto-attribuée", () => {
  // `seo.ts` ne fait que LIRE des avis via une plateforme tierce : il ne doit
  // jamais émettre `aggregateRating` (règle Google « self-serving reviews »).
  const seo = code("src/lib/seo.ts");
  assert.doesNotMatch(seo, /aggregateRating/);
  assert.doesNotMatch(seo, /["']@type["']:\s*["']AggregateRating/);

  // `trust.ts` est le seul module autorisé à manipuler ces champs : il les
  // parse depuis la fiche publique, il ne les fabrique jamais.
  const trustSource = code("src/lib/trust.ts");
  assert.match(trustSource, /parseTrustpilotAggregate/);
  assert.doesNotMatch(trustSource, /["']@type["']:\s*["']AggregateRating/);
  assert.doesNotMatch(trustSource, /["']aggregateRating["']\s*:/);
});

test("les e-mails de livraison passent bien par reviewPromptForConfig", () => {
  assert.match(read("src/lib/digital-orders.ts"), /reviewPromptForConfig\(config, \{ kind: "digital"/);
  assert.match(read("src/lib/fazercards-orders.ts"), /reviewPromptForConfig\(config, \{ kind: "digital"/);
  assert.match(read("src/app/api/deliveries/accept/route.ts"), /reviewPromptForConfig\(config, \{/);
  assert.match(read("src/lib/digital-emails.ts"), /review \? review\.html : ""/);
  assert.match(read("src/lib/digital-orders.ts"), /sendDigitalTopupDeliveredEmail\([\s\S]{0,200}reviewPromptForConfig/);
});
