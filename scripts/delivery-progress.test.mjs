import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DELIVERY_STEPS,
  confirmationEtaSeconds,
  deliveryProgress,
  deliveryProgressMessage,
  deliveryStepHint,
  deliveryStepLabel,
} from "../src/lib/delivery-progress-core.ts";
import {
  ORDER_START_PREFIX,
  orderRefFromStartPayload,
  orderStartPayload,
  telegramOrderUrl,
  trackingUrlFor,
} from "../src/lib/telegram-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");
/** Retire les commentaires : on veut tester le code, pas la prose. */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/* ------------------------------- 3 étapes -------------------------------- */

test("la progression expose exactement trois étapes, dans l'ordre du parcours", () => {
  assert.deepEqual([...DELIVERY_STEPS], ["confirmation", "issuing", "delivered"]);
});

test("trois libellés distincts et non vides dans les trois langues", () => {
  for (const locale of ["fr", "en", "ar"]) {
    const labels = DELIVERY_STEPS.map((step) => deliveryStepLabel(step, locale));
    assert.equal(labels.length, 3);
    for (const label of labels) {
      assert.ok(label.trim().length > 3, `${locale} : libellé trop court (${label})`);
    }
    assert.equal(new Set(labels).size, 3, `${locale} : libellés dupliqués`);
  }
});

test("une carte téléphonique n'affiche pas d'étape « réseau »", () => {
  const label = deliveryStepLabel("confirmation", "fr", "phone_card");
  assert.match(label, /carte/i);
  assert.doesNotMatch(label, /réseau/i);
  // Les autres étapes restent identiques : seule la 1re change de nature.
  assert.equal(
    deliveryStepLabel("issuing", "fr", "phone_card"),
    deliveryStepLabel("issuing", "fr"),
  );
});

test("chaque étape a une aide courte, utile, dans les trois langues", () => {
  for (const locale of ["fr", "en", "ar"]) {
    for (const step of DELIVERY_STEPS) {
      const hint = deliveryStepHint(step, locale);
      assert.ok(hint.length > 15 && hint.length < 160, `${locale}/${step} : ${hint.length} car.`);
    }
  }
});

/* ----------------------------- Machine d'état ---------------------------- */

const states = (progress) => progress.steps.map((step) => step.state);

test("commande non payée, aucun paiement vu : première étape en cours", () => {
  const progress = deliveryProgress({ status: "pending" });
  assert.equal(progress.stage, "awaiting_payment");
  assert.equal(progress.currentIndex, 0);
  assert.deepEqual(states(progress), ["current", "todo", "todo"]);
  assert.ok(progress.percent > 0 && progress.percent < 40);
});

test("transfert vu par le réseau : même étape, avancement plus marqué", () => {
  const waiting = deliveryProgress({ status: "pending" });
  const confirming = deliveryProgress({ status: "pending", ipnStatus: "confirming" });
  assert.equal(confirming.stage, "awaiting_network");
  assert.equal(confirming.currentIndex, 0, "le client est toujours à l'étape 1");
  assert.ok(confirming.percent > waiting.percent);
  assert.deepEqual(states(confirming), ["current", "todo", "todo"]);
});

test("`finished` sans statut payé reste présenté comme une confirmation en cours", () => {
  const progress = deliveryProgress({ status: "pending", ipnStatus: "finished" });
  assert.equal(progress.stage, "awaiting_network");
});

test("commande payée : étape 2 en cours, étape 1 validée", () => {
  const progress = deliveryProgress({ status: "paid" });
  assert.equal(progress.stage, "issuing");
  assert.equal(progress.currentIndex, 1);
  assert.deepEqual(states(progress), ["done", "current", "todo"]);
});

test("commande livrée : 100 %, toutes les étapes validées", () => {
  const progress = deliveryProgress({ status: "delivered" });
  assert.equal(progress.percent, 100);
  assert.equal(progress.tone, "done");
  assert.deepEqual(states(progress), ["done", "done", "done"]);
});

test("livraison terminale : un statut de file retardataire ne la rétrograde pas", () => {
  const progress = deliveryProgress({
    status: "delivered",
    fulfillmentStatus: "paid_fulfilling",
  });
  assert.equal(progress.stage, "delivered");
  assert.equal(progress.percent, 100);
});

test("revue manuelle : alerte sur l'étape de génération, pas une roue infinie", () => {
  const progress = deliveryProgress({ status: "manual" });
  assert.equal(progress.stage, "manual_review");
  assert.equal(progress.tone, "alert");
  assert.deepEqual(states(progress), ["done", "alert", "todo"]);
  // Le message doit dire qu'un humain agit ET rassurer sur le paiement.
  const message = deliveryProgressMessage(progress, "fr");
  assert.match(message, /équipe/i);
  assert.match(message, /ne payez pas deux fois/i);
});

test("échec : jamais présenté comme une attente", () => {
  const progress = deliveryProgress({ status: "failed" });
  assert.equal(progress.stage, "failed");
  assert.equal(progress.tone, "failed");
  assert.deepEqual(states(progress), ["done", "alert", "todo"]);
  const message = deliveryProgressMessage(progress, "fr");
  assert.doesNotMatch(message, /en cours|patientez/i);
  assert.match(message, /remplaçons|remboursons|refund|replace/i);
});

test("carte téléphonique en attente : vérification humaine, pas de blockchain", () => {
  const progress = deliveryProgress({
    status: "pending",
    paymentMethod: "phone_card",
    phoneCardStatus: "pending",
  });
  assert.equal(progress.stage, "awaiting_phone_card");
  assert.equal(progress.confirmationEtaSeconds, null, "aucun délai réseau à annoncer");
  const message = deliveryProgressMessage(progress, "fr");
  assert.match(message, /carte/i);
  assert.match(message, /autre carte/i);
});

test("les statuts inconnus ne cassent pas la progression", () => {
  for (const status of ["", "weird", "PENDING", " paid "]) {
    const progress = deliveryProgress({ status });
    assert.equal(progress.steps.length, 3);
    assert.ok(progress.percent >= 0 && progress.percent <= 100);
  }
});

test("l'avancement ne recule jamais quand le statut progresse", () => {
  const chain = [
    deliveryProgress({ status: "pending" }),
    deliveryProgress({ status: "pending", ipnStatus: "confirming" }),
    deliveryProgress({ status: "paid" }),
    deliveryProgress({ status: "delivered" }),
  ];
  for (let index = 1; index < chain.length; index += 1) {
    assert.ok(
      chain[index].percent > chain[index - 1].percent,
      `${chain[index - 1].percent} → ${chain[index].percent}`,
    );
  }
});

/* --------------------------- Estimation de délai -------------------------- */

test("les délais annoncés suivent l'ordre de grandeur des réseaux", () => {
  const trc = confirmationEtaSeconds("usdttrc20");
  const btc = confirmationEtaSeconds("btc");
  assert.ok(trc > 0 && trc <= 180, "TRC-20 : quelques minutes au plus");
  assert.ok(btc > trc, "Bitcoin est plus lent que TRC-20");
});

test("aucun délai inventé pour une devise inconnue", () => {
  assert.equal(confirmationEtaSeconds(""), null);
  assert.equal(confirmationEtaSeconds(null), null);
  assert.equal(confirmationEtaSeconds("USDT-TRC20"), confirmationEtaSeconds("usdttrc20"));
  // Piège classique : une clé du prototype ne doit pas ressortir comme durée.
  assert.equal(confirmationEtaSeconds("constructor"), null);
  assert.equal(confirmationEtaSeconds("__proto__"), null);
});

test("le message d'attente réseau cite un délai seulement s'il est connu", () => {
  const known = deliveryProgressMessage(
    deliveryProgress({ status: "pending", ipnStatus: "confirming", payCurrency: "usdttrc20" }),
    "fr",
  );
  assert.match(known, /environ \d+ min/);
  const unknown = deliveryProgressMessage(
    deliveryProgress({ status: "pending", ipnStatus: "confirming" }),
    "fr",
  );
  assert.doesNotMatch(unknown, /min/);
});

test("le message d'attente réseau proscrit un double paiement", () => {
  for (const locale of ["fr", "en", "ar"]) {
    const message = deliveryProgressMessage(
      deliveryProgress({ status: "pending", ipnStatus: "confirming" }),
      locale,
    );
    assert.match(message, /second paiement|second payment|دفعة ثانية/);
  }
});

test("le bot est proposé comme canal additionnel, jamais comme condition", () => {
  const progress = deliveryProgress({ status: "paid" });
  const withBot = deliveryProgressMessage(progress, "fr", { botUsername: "NokhbaGamebot" });
  assert.match(withBot, /@NokhbaGamebot/);
  assert.match(withBot, /aussi/i, "le canal est présenté en plus de l'e-mail");
  const withoutBot = deliveryProgressMessage(progress, "fr");
  assert.doesNotMatch(withoutBot, /Telegram/);
  assert.equal(
    withoutBot.replace(/\s+/g, " ").trim(),
    deliveryProgressMessage(progress, "fr", { botUsername: "  " }).replace(/\s+/g, " ").trim(),
  );
});

test("chaque étape a un message dans les trois langues, sans trou", () => {
  const cases = [
    { status: "pending" },
    { status: "pending", ipnStatus: "confirming" },
    { status: "paid" },
    { status: "manual" },
    { status: "delivered" },
    { status: "failed" },
    { status: "pending", paymentMethod: "phone_card" },
  ];
  for (const input of cases) {
    for (const locale of ["fr", "en", "ar"]) {
      const message = deliveryProgressMessage(deliveryProgress(input), locale);
      assert.ok(message.trim().length > 30, `${locale} ${JSON.stringify(input)}`);
      assert.doesNotMatch(message, /undefined|\[object/);
    }
  }
});

/* ---------------------------- Liens Telegram ----------------------------- */

test("le payload /start transporte la référence et reste conforme à Telegram", () => {
  const payload = orderStartPayload("DGC-1A2B3C4D5E6F");
  assert.equal(payload, "order-dgc-1a2b3c4d5e6f");
  assert.ok(payload.startsWith(ORDER_START_PREFIX));
  assert.match(payload, /^[A-Za-z0-9_-]+$/);
  assert.ok(payload.length <= 64);
});

test("une référence est relue depuis le payload, préfixe ou pas", () => {
  assert.equal(orderRefFromStartPayload("order-dgc-1a2b3c4d5e6f"), "DGC-1A2B3C4D5E6F");
  assert.equal(orderRefFromStartPayload("dgc-1a2b3c4d5e6f"), "DGC-1A2B3C4D5E6F");
  assert.equal(orderRefFromStartPayload("ORDER-DGC-1A2B3C4D5E6F"), "DGC-1A2B3C4D5E6F");
});

test("un payload qui n'est pas une référence ne produit pas de commande", () => {
  for (const payload of ["", null, undefined, "hello", "order-", "order-xyz", "promo2024"]) {
    assert.equal(orderRefFromStartPayload(payload), null, String(payload));
  }
});

test("sans nom de bot, aucun lien n'est fabriqué (pas de bouton mort)", () => {
  assert.equal(telegramOrderUrl("", "DGC-1A2B3C4D5E6F"), "");
  assert.equal(telegramOrderUrl(null, "DGC-1A2B3C4D5E6F"), "");
  assert.equal(telegramOrderUrl("NokhbaGamebot", ""), "");
});

test("le lien Telegram porte le handle et le payload attendus", () => {
  const url = telegramOrderUrl("@NokhbaGamebot", "DGC-1A2B3C4D5E6F");
  assert.equal(url, "https://t.me/NokhbaGamebot?start=order-dgc-1a2b3c4d5e6f");
});

test("l'URL de suivi n'expose jamais de jeton", () => {
  const url = trackingUrlFor("https://nokhba.net.ly/", "dgc-1a2b3c4d5e6f");
  assert.equal(url, "https://nokhba.net.ly/codes/commande?ref=DGC-1A2B3C4D5E6F");
  assert.doesNotMatch(url, /t=|token=/);
  assert.equal(trackingUrlFor("", "DGC-1"), "");
});

/* ------------------------- Câblage dans l'application --------------------- */

test("le payload public expose les champs nécessaires à la barre de progression", () => {
  const source = code(read("/src/lib/digital-orders.ts"));
  for (const field of ["ipnStatus:", "payCurrency:", "telegramUrl:"]) {
    assert.ok(source.includes(field), `champ manquant dans le payload public : ${field}`);
  }
  // La progression a besoin du statut brut du réseau, pas d'une adresse.
  assert.doesNotMatch(source, /payAddress:\s*payment\?\./);
});

test("la page de suivi affiche trois étapes et le canal Telegram", () => {
  const page = code(read("/src/app/(site)/codes/commande/digital-order-status.tsx"));
  assert.match(page, /deliveryProgress\(/);
  assert.match(page, /deliveryStepLabel\(/);
  assert.match(page, /role="progressbar"/);
  // Le bloc Telegram conditionne sur la présence de l'URL : bot non
  // configuré → aucun bouton, jamais un lien cassé.
  assert.match(page, /order\.telegramUrl && order\.status !== "delivered"/);
  // Plus de promesse « toutes les 15 s » (le client ne peut pas la vérifier).
  assert.doesNotMatch(page, /every 15 s/);
  assert.doesNotMatch(page, /كل 15 ثانية/);
});

test("le webhook du bot gère /prevenir et le payload de commande", () => {
  const webhook = code(read("/src/app/api/telegram/webhook/route.ts"));
  assert.match(webhook, /case "prevenir"/);
  assert.match(webhook, /orderRefFromStartPayload\(args\)/);
  assert.match(webhook, /watchOrderFromTelegram\(/);
});

test("les codes partent dans le chat sans parse_mode (aucune altération possible)", () => {
  const source = code(read("/src/lib/telegram-delivery.ts"));
  // Le message de livraison est construit en texte brut, puis envoyé sans
  // parseMode : un code contenant `<` ou `&` reste intact.
  assert.match(source, /formatDeliveredMessage/);
  const sendBlock = source.slice(source.indexOf("sendTelegramMessage(watch.chatId"));
  assert.doesNotMatch(sendBlock.slice(0, 400), /parseMode/);
});

test("la notification de livraison est idempotente et réservée aux commandes livrées", () => {
  const source = code(read("/src/lib/telegram-delivery.ts"));
  assert.match(source, /isNull\(telegramOrderWatches\.notifiedAt\)/);
  assert.match(source, /order\.status !== "delivered"/);
  // Réclamation avant envoi : l'UPDATE conditionnel passe avant la boucle.
  assert.ok(
    source.indexOf("isNull(telegramOrderWatches.notifiedAt)") <
      source.indexOf("sendTelegramMessage(watch.chatId"),
    "l'idempotence doit être réclamée avant l'envoi",
  );
});

test("la livraison déclenche le canal Telegram aux deux points de sortie", () => {
  const source = code(read("/src/lib/digital-orders.ts"));
  const calls = source.match(/notifyTelegramOrderDelivered\(/g) ?? [];
  assert.ok(calls.length >= 2, `appels trouvés : ${calls.length}`);
});

test("l'e-mail garde le code et propose Telegram en plus", () => {
  const source = code(read("/src/lib/digital-emails.ts"));
  assert.match(source, /telegramUrl\?: string \| null/);
  // Le paramètre est optionnel et en dernier : les appels existants
  // continuent de fonctionner sans modification.
  const signature = source.slice(
    source.indexOf("export async function sendDigitalCodesEmail"),
    source.indexOf("): Promise<DigitalEmailResult>"),
  );
  assert.ok(signature.indexOf("telegramUrl") > signature.indexOf("review"));
  assert.match(source, /en plus de cet e-mail/);
});

test("le schéma déclare la table de suivi avec une contrainte d'unicité", () => {
  const schema = code(read("/src/db/schema.ts"));
  assert.match(schema, /export const telegramOrderWatches/);
  assert.match(schema, /uniqueIndex\("telegram_order_watches_ref_chat_idx"\)/);
  // La table doit être créée au démarrage (ensureSchema), sinon la première
  // commande livrée échouerait en production.
  assert.match(read("/src/db/index.ts"), /CREATE TABLE IF NOT EXISTS telegram_order_watches/);
});
