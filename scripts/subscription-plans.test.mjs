#!/usr/bin/env node
/** Tests du catalogue d'abonnements, des règles de période, grâce, statut, relances et gabarits. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const outDir = mkdtempSync(join(tmpdir(), "subscription-plans-"));
const outfile = join(outDir, "subscriptions.mjs");

const aliasPlugin = {
  name: "alias-at-src",
  setup(builder) {
    builder.onResolve({ filter: /^@\// }, (args) => {
      const base = join(srcRoot, args.path.slice(2));
      const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
      const found = candidates.find((c) => existsSync(c) && statSync(c).isFile());
      return { path: found ?? base };
    });
  },
};

// Modules purs bundlés ensemble : aucune base ni réseau n'est nécessaire.
await build({
  stdin: {
    contents: `export * from "./src/lib/subscription-plans.ts";
export * from "./src/lib/subscription-lifecycle.ts";
export * from "./src/lib/subscription-emails.ts";`,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  plugins: [aliasPlugin],
});
const mod = await import(outfile);
test.after(() => rmSync(outDir, { recursive: true, force: true }));

const DAY = 24 * 60 * 60 * 1000;
const END = new Date("2026-11-20T00:00:00Z");
const at = (days) => new Date(END.getTime() + days * DAY);

/* ---------- Catalogue ---------- */

test("catalogue : 3 offres × (mensuel 30 j + annuel 365 j)", () => {
  assert.equal(mod.SUBSCRIPTION_PLANS.length, 6);
  const expected = {
    "vitrine-monthly": [10, 30],
    "vitrine-annual": [69, 365],
    "vitrine-plus-monthly": [12, 30],
    "vitrine-plus-annual": [89, 365],
    "boutique-monthly": [25, 30],
    "boutique-annual": [199, 365],
  };
  for (const [id, [price, interval]] of Object.entries(expected)) {
    const plan = mod.getSubscriptionPlan(id);
    assert.ok(plan, `plan ${id} manquant`);
    assert.equal(plan.priceUsd, price, `prix ${id}`);
    assert.equal(plan.intervalDay, interval, `intervalle ${id}`);
    assert.equal(plan.graceDays, 5, `grâce ${id}`);
  }
});

test("grâce = 5 jours, plafond passerelle = 5 jours", () => {
  assert.equal(mod.SUBSCRIPTION_GRACE_DAYS, 5);
  assert.equal(mod.GATEWAY_MAX_GRACE_DAYS, 5);
});

test("identifiants uniques ; plan inconnu → undefined", () => {
  const ids = mod.SUBSCRIPTION_PLANS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(mod.getSubscriptionPlan("vitrine"), undefined);
  assert.equal(mod.getSubscriptionPlan("test-monthly"), undefined);
  assert.equal(mod.getSubscriptionPlan("../../etc"), undefined);
});

test("formatage du montant : deux décimales", () => {
  assert.equal(mod.formatUsdAmount(10), "10.00");
  assert.equal(mod.formatUsdAmount(199), "199.00");
  assert.equal(mod.formatUsdAmount(12.005), "12.01");
});

/* ---------- Périodes et accès ---------- */

test("fin de période = début + intervalle en jours", () => {
  const start = new Date("2026-10-21T00:00:00Z");
  assert.equal(mod.computePeriodEnd(start, 30).getTime(), start.getTime() + 30 * DAY);
  assert.equal(mod.computePeriodEnd(start, 365).getTime(), start.getTime() + 365 * DAY);
});

test("accès : courant, grâce de 5 jours, puis expiré", () => {
  assert.equal(mod.accessEndsAt(END, 5).getTime(), END.getTime() + 5 * DAY);
  assert.equal(mod.accessStateAt(END, at(-1), 5), "current");
  assert.equal(mod.accessStateAt(END, END, 5), "current");
  assert.equal(mod.accessStateAt(END, at(1), 5), "grace");
  assert.equal(mod.accessStateAt(END, at(5), 5), "grace");
  assert.equal(mod.accessStateAt(END, at(6), 5), "expired");
});

test("paiement après expiration : nouvelle période à partir de maintenant", () => {
  const paidAt = at(20);
  const period = mod.nextBillingPeriod(END, paidAt, 30);
  assert.equal(period.periodStart.getTime(), paidAt.getTime());
  assert.equal(period.periodEnd.getTime(), paidAt.getTime() + 30 * DAY);
});

test("paiement anticipé : la période est prolongée depuis l'échéance", () => {
  const period = mod.nextBillingPeriod(END, at(-3), 30);
  assert.equal(period.periodStart.getTime(), END.getTime());
  assert.equal(period.periodEnd.getTime(), END.getTime() + 30 * DAY);
});

test("premier paiement : la période démarre au paiement", () => {
  const paidAt = new Date("2026-10-21T10:00:00Z");
  const period = mod.nextBillingPeriod(null, paidAt, 365);
  assert.equal(period.periodStart.getTime(), paidAt.getTime());
  assert.equal(period.periodEnd.getTime(), paidAt.getTime() + 365 * DAY);
});

/* ---------- Statut affiché ---------- */

test("statut dérivé : en attente, actif, grâce, expiré", () => {
  assert.equal(mod.displayStatus({ currentPeriodEnd: null }, at(0)), "inactive");
  assert.equal(mod.displayStatus({ currentPeriodEnd: END }, at(-1)), "active");
  assert.equal(mod.displayStatus({ currentPeriodEnd: END }, at(2)), "grace");
  assert.equal(mod.displayStatus({ currentPeriodEnd: END }, at(6)), "expired");
});

test("annulation : accès jusqu'à la fin de période, sans grâce", () => {
  const canceledAt = at(-5);
  assert.equal(mod.displayStatus({ currentPeriodEnd: END, canceledAt }, at(-1)), "active");
  assert.equal(mod.displayStatus({ currentPeriodEnd: END, canceledAt }, at(1)), "expired");
});

test("accès et réabonnement", () => {
  assert.equal(mod.hasAccess("active"), true);
  assert.equal(mod.hasAccess("grace"), true);
  assert.equal(mod.hasAccess("expired"), false);
  assert.equal(mod.blocksNewSubscription("grace"), true);
  assert.equal(mod.blocksNewSubscription("inactive"), true, "facture en attente = pas de doublon");
  assert.equal(mod.blocksNewSubscription("expired"), false);
});

test("revenu mensuel ramené à 30 jours", () => {
  assert.equal(mod.monthlyEquivalentUsd(10, 30), 10);
  assert.equal(mod.monthlyEquivalentUsd(69, 365), 5.67);
  assert.equal(mod.monthlyEquivalentUsd(199, 365), 16.36);
  assert.equal(mod.monthlyEquivalentUsd(10, 0), 0);
});

/* ---------- Relances ---------- */

const base = { currentPeriodEnd: END, canceledAt: null, reminderFor: null, overdueNoticeFor: null, expiredNoticeFor: null };

test("relance avant échéance : une fois, à moins de 3 jours", () => {
  assert.equal(mod.noticeToSend(base, at(-4)), null, "trop tôt");
  assert.equal(mod.noticeToSend(base, at(-2)), "reminder");
  assert.equal(mod.noticeToSend({ ...base, reminderFor: END }, at(-2)), null, "déjà envoyée");
});

test("avis en retard puis suspendu, une seule fois chacun", () => {
  assert.equal(mod.noticeToSend(base, at(1)), "overdue");
  assert.equal(mod.noticeToSend({ ...base, overdueNoticeFor: END }, at(1)), null);
  assert.equal(mod.noticeToSend({ ...base, overdueNoticeFor: END }, at(6)), "expired");
  assert.equal(mod.noticeToSend({ ...base, overdueNoticeFor: END, expiredNoticeFor: END }, at(9)), null);
});

test("abonnement annulé ou en attente : aucune relance", () => {
  assert.equal(mod.noticeToSend({ ...base, canceledAt: at(-5) }, at(-2)), null);
  assert.equal(mod.noticeToSend({ ...base, canceledAt: at(-5) }, at(3)), null);
  assert.equal(mod.noticeToSend({ ...base, currentPeriodEnd: null }, at(0)), null);
});

test("une nouvelle échéance réarme les relances", () => {
  const nextEnd = at(30);
  assert.equal(mod.noticeToSend({ ...base, currentPeriodEnd: nextEnd, reminderFor: END }, at(28)), "reminder");
});

/* ---------- Charge utile IPN ---------- */

test("identifiant d'abonnement lu dans l'IPN", () => {
  assert.equal(mod.subscriptionIdFromPayload({ subscription_id: 4821 }), "4821");
  assert.equal(mod.subscriptionIdFromPayload({ subscription_id: " 77 " }), "77");
  assert.equal(mod.subscriptionIdFromPayload({ recurring_payment_id: "abc" }), "abc");
  assert.equal(mod.subscriptionIdFromPayload({ payment_id: "1" }), null);
  assert.equal(mod.subscriptionIdFromPayload({ subscription_id: "  " }), null);
  assert.equal(mod.subscriptionIdFromPayload({ subscription_id: null }), null);
});

test("identifiant d'abonnement : variantes camelCase et imbriquées", () => {
  assert.equal(
    mod.subscriptionIdFromPayload({ subscriptionId: "9001" }),
    "9001",
  );
  assert.equal(
    mod.subscriptionIdFromPayload({ recurringPaymentId: "9002" }),
    "9002",
  );
  assert.equal(
    mod.subscriptionIdFromPayload({
      subscription: { id: "9003" },
    }),
    "9003",
  );
  assert.equal(
    mod.subscriptionIdFromPayload({
      recurring_payment: { subscription_id: "9004" },
    }),
    "9004",
  );
  assert.equal(
    mod.subscriptionIdFromPayload({ recurringPayment: { id: 9005 } }),
    "9005",
  );
  // Variante vue sur la facture hébergée NOWPayments (paramètre d'URL
  // subscriptionPaymentId) et sa forme snake_case d'IPN probable.
  assert.equal(
    mod.subscriptionIdFromPayload({
      subscriptionPaymentId: "5214662227",
    }),
    "5214662227",
  );
  assert.equal(
    mod.subscriptionIdFromPayload({
      subscription_payment_id: "5214662228",
    }),
    "5214662228",
  );
  // Un objet imbriqué sans identifiant exploitable ne doit pas faire de faux positif.
  assert.equal(
    mod.subscriptionIdFromPayload({ subscription: { status: "active" } }),
    null,
  );
  // Une charge utile de paiement ponctuel classique ne doit jamais être détournée.
  assert.equal(
    mod.subscriptionIdFromPayload({
      payment_id: "1",
      payment_status: "finished",
      order_id: "RSV-1",
    }),
    null,
  );
});

test("normalisation de l'e-mail", () => {
  assert.equal(mod.normalizeEmail("  Client@Example.COM "), "client@example.com");
});

/* ---------- Factures (iid) et réconciliation ---------- */

test("invoiceIdFromUrl extrait l'iid des liens de facture", () => {
  assert.equal(
    mod.invoiceIdFromUrl("https://nowpayments.io/payment?iid=5267182715"),
    "5267182715",
  );
  assert.equal(
    mod.invoiceIdFromUrl(
      "https://nowpayments.io/payment?iid=5267182715&subscriptionPaymentId=5214662227",
    ),
    "5267182715",
  );
  assert.equal(
    mod.invoiceIdFromUrl("https://nowpayments.io/payment/?iid=99&foo=bar"),
    "99",
  );
  assert.equal(mod.invoiceIdFromUrl("https://example.com/sans-iid"), null);
  assert.equal(mod.invoiceIdFromUrl(null), null);
  assert.equal(mod.invoiceIdFromUrl(42), null);
});

test("invoiceIdFromSubscriptionRecord : champs directs, liens, imbrication, tableaux", () => {
  assert.equal(
    mod.invoiceIdFromSubscriptionRecord({ iid: 5267182715 }),
    "5267182715",
  );
  assert.equal(
    mod.invoiceIdFromSubscriptionRecord({
      invoice_id: "5267182715",
    }),
    "5267182715",
  );
  assert.equal(
    mod.invoiceIdFromSubscriptionRecord({
      payment_link: "https://nowpayments.io/payment?iid=5267182715",
    }),
    "5267182715",
  );
  // Réponse enveloppée dans un objet `result`.
  assert.equal(
    mod.invoiceIdFromSubscriptionRecord({
      result: { invoice_url: "https://nowpayments.io/payment?iid=4242" },
    }),
    "4242",
  );
  // Réponse sous forme de tableau.
  assert.equal(
    mod.invoiceIdFromSubscriptionRecord([
      { id: "1", link: "https://nowpayments.io/payment?iid=777" },
    ]),
    "777",
  );
  assert.equal(mod.invoiceIdFromSubscriptionRecord({ id: "abc" }), null);
  assert.equal(mod.invoiceIdFromSubscriptionRecord(null), null);
});

test("recordReferencesInvoiceId : directe, dans un lien, dans un tableau imbriqué", () => {
  assert.equal(
    mod.recordReferencesInvoiceId({ invoice_id: 5267182715 }, "5267182715"),
    true,
  );
  assert.equal(
    mod.recordReferencesInvoiceId(
      {
        id: "5214662227",
        payments: [
          { payment_id: "1", invoice_id: "111" },
          { payment_id: "2", invoice_id: "5267182715" },
        ],
      },
      "5267182715",
    ),
    true,
  );
  assert.equal(
    mod.recordReferencesInvoiceId(
      { payment_link: "https://nowpayments.io/payment?iid=5267182715" },
      "5267182715",
    ),
    true,
  );
  assert.equal(
    mod.recordReferencesInvoiceId(
      { id: "5214662227", payments: [{ invoice_id: "999" }] },
      "5267182715",
    ),
    false,
  );
  assert.equal(mod.recordReferencesInvoiceId(null, "5267182715"), false);
});

/* ---------- Gabarits d'e-mails ---------- */

const data = {
  ref: "ABO-TEST1",
  planName: "Vitrine — Mensuel",
  endsAt: END,
  accessEndsAt: at(5),
  graceDays: 5,
  subscribeUrl: "https://nokhba.net.ly/abonnements",
  siteName: "نخبة",
};

test("gabarits : objet, référence et date présents, sans jeton", () => {
  for (const kind of ["reminder", "overdue", "expired"]) {
    const mail = mod.buildNoticeEmail(kind, data);
    assert.ok(mail.subject.includes("Vitrine"), kind);
    assert.ok(mail.text.includes("ABO-TEST1"), kind);
    assert.ok(!/token|\bt=/i.test(mail.text + mail.html), `${kind} ne doit contenir aucun jeton`);
  }
  assert.ok(mod.buildNoticeEmail("overdue", data).text.includes("25/11/2026"), "date d'accès (fr-FR)");
});

test("gabarit HTML : données échappées", () => {
  const mail = mod.buildNoticeEmail("expired", { ...data, planName: "<script>x</script>" });
  assert.ok(!mail.html.includes("<script>x</script>"));
  assert.ok(mail.html.includes("&lt;script&gt;"));
});
