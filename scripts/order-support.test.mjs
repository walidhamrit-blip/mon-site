import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mainMenuKeyboard, botCopy } from "../src/lib/telegram-core.ts";

const file = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

test("le bot expose une rubrique support et une consigne en trois langues", () => {
  for (const lang of ["ar", "en", "fr"]) {
    const menu = mainMenuKeyboard(lang, { store: "https://example.com/codes", site: "https://example.com", whatsapp: "https://wa.me/123" });
    assert.ok(menu.flat().some((item) => item.callback_data === "menu:support"));
    assert.match(botCopy(lang).supportPrompt, /support/);
  }
});

test("aide disponible dans la caisse, le suivi et le retour de paiement", () => {
  assert.match(file("src/components/digital-buy-dialog.tsx"), /<OrderSupport/);
  assert.match(file("src/app/(site)/codes/commande/digital-order-status.tsx"), /<OrderSupport reference=/);
  const cancel = file("src/app/(site)/pay/cancel/page.tsx");
  assert.match(cancel, /\/codes\/commande/);
  assert.match(cancel, /query\.set\("t", validToken\)/);
  assert.doesNotMatch(cancel, /No amount was charged|لم يتم خصم أي مبلغ/);
  assert.match(cancel, /OrderSupport/);
});

test("le support reçoit une demande même avec une référence, sans jeton de suivi dans le lien Telegram", () => {
  const route = file("src/app/api/telegram/webhook/route.ts");
  assert.match(route, /ref && !wantsHuman\(text\)/);
  assert.match(route, /saveTelegramSupportRequest/);
  assert.match(route, /data === "menu:support"/);
  const ui = file("src/components/order-support.tsx");
  assert.match(ui, /\?start=support-/);
  assert.doesNotMatch(ui, /location\.href|trackingToken|initialToken/);
});

test("le cron alerte sans déclarer le paiement échoué et évite les doublons", () => {
  const src = file("src/lib/pending-payment-alerts.ts");
  assert.match(src, /30 \* 60_000/);
  assert.match(src, /pendingAlertSentAt/);
  assert.match(src, /pendingAlertClaimedAt/);
  assert.match(src, /ne prouve ni un échec ni l'absence de paiement/);
  assert.match(file("src/app/api/cron/digital-orders/route.ts"), /alertPendingDigitalPayments\(\{ dryRun \}\)/);
});

test("la réponse à la rubrique support exige une session admin et cible le chat enregistré", () => {
  assert.match(file("src/app/admin/(panel)/telegram/actions.ts"), /replySupportAction[\s\S]*await requireAdmin\(\)/);
  assert.match(file("src/lib/telegram-support.ts"), /sendTelegramMessage\(request\.chatId, message\)/);
  assert.match(file("src/app/admin/(panel)/telegram/page.tsx"), /<SupportInbox/);
});
