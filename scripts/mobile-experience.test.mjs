import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("viewport couvre les encoches et empêche le zoom forcé iOS sur les champs", () => {
  const layout = read("src/app/layout.tsx");
  const css = read("src/app/globals.css");

  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
  assert.match(css, /font-size:\s*max\(16px,\s*1rem\)/);
  assert.match(css, /html\[data-dialog="open"\]\s*\.whatsapp-float/);
  assert.match(css, /html\[data-dialog="open"\]\s*\.site-chatbot/);
  assert.match(css, /html\[data-dialog="open"\]\s*\.back-to-top/);
});

test("les feuilles d'achat et modales publiques utilisent un portail, 92dvh et safe-area", () => {
  const checkout = read("src/components/checkout-dialog.tsx");
  const buy = read("src/components/digital-buy-dialog.tsx");
  const reserve = read("src/components/reservation-dialog.tsx");
  const whatsapp = read("src/components/whatsapp-enquiry.tsx");

  for (const [name, source] of [
    ["CheckoutDialog", checkout],
    ["DigitalBuyDialog", buy],
    ["ReservationDialog", reserve],
  ]) {
    assert.match(source, /createPortal\(/, `${name} doit être rendu via createPortal`);
    assert.match(source, /z-\[10000\]/, `${name} doit passer au-dessus du viewer plein écran`);
    assert.match(source, /data-dialog/, `${name} doit masquer les flotteurs via data-dialog`);
    assert.match(source, /max-h-\[92dvh\]/, `${name} doit borner sa hauteur en dvh sur mobile`);
    assert.match(source, /env\(safe-area-inset-bottom\)/, `${name} doit respecter la barre d'accueil iOS`);
    assert.doesNotMatch(source, /bg-black\/30/, `${name} ne doit pas utiliser un fond de champ illisible en mode clair`);
  }

  assert.doesNotMatch(checkout, /aria-label="Fermer"/);
  assert.match(checkout, /min-\[420px\]:grid-cols-3/);
  assert.match(buy, /grid-cols-1 gap-2 min-\[360px\]:grid-cols-2/);
  assert.match(whatsapp, /max-h-\[90dvh\]/);
  assert.match(whatsapp, /h-11 w-11/);
});

test("l'assistant mobile reste dans l'écran dynamique et n'impose pas le clavier tactile à l'ouverture", () => {
  const chatbot = read("src/components/site-chatbot.tsx");
  const localeSwitcher = read("src/components/locale-switcher.tsx");

  assert.match(chatbot, /env\(safe-area-inset-bottom\)/);
  assert.match(chatbot, /100dvh/);
  assert.match(chatbot, /min-h-0 flex-1/);
  assert.match(chatbot, /\(pointer:\s*fine\)/);
  assert.match(localeSwitcher, /max-w-\[calc\(100vw-6\.5rem\)\]/);
});

test("les grilles denses passent sur une colonne sur les petits téléphones", () => {
  assert.match(
    read("src/app/(site)/demos/demos-client.tsx"),
    /grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3/,
  );
  assert.match(
    read("src/app/(site)/blog/blog-client.tsx"),
    /grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4/,
  );
  assert.match(
    read("src/components/sections/digital-showcase.tsx"),
    /grid grid-cols-1 gap-3 min-\[360px\]:grid-cols-2 lg:grid-cols-3/,
  );
  assert.match(
    read("src/app/(site)/codes/category/[kind]/page.tsx"),
    /grid grid-cols-1 gap-3 min-\[380px\]:grid-cols-2 sm:gap-4 lg:grid-cols-4/,
  );
  assert.match(
    read("src/components/sections/cta-form.tsx"),
    /grid grid-cols-1 gap-3 sm:grid-cols-2/,
  );
});

test("le viewer plein écran, le suivi de commande et le tiroir admin sont adaptés au tactile et au mode sombre", () => {
  const viewer = read("src/components/live-site-frames.tsx");
  const status = read("src/app/(site)/codes/commande/digital-order-status.tsx");
  const adminNav = read("src/app/admin/(panel)/admin-nav.tsx");

  assert.match(viewer, /h-dvh w-full/);
  assert.match(viewer, /env\(safe-area-inset-top\)/);
  assert.match(viewer, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(viewer, /w-screen h-screen/);

  assert.match(status, /dark:bg-emerald-950\/50/);
  assert.match(status, /dark:bg-amber-950\/50/);
  assert.match(status, /dark:bg-red-950\/50/);
  assert.match(status, /Also receive your code on Telegram/);
  assert.doesNotMatch(status, /Recevez aussi le code sur Telegram/);

  assert.match(adminNav, /h-dvh/);
  assert.match(adminNav, /env\(safe-area-inset-bottom\)/);
});
