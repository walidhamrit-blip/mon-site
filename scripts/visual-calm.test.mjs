import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("chatbot welcome bubble is shown once per session, dismissible, and never loops", () => {
  const source = read("src/components/site-chatbot.tsx");
  assert.doesNotMatch(source, /setInterval\(show, 26000\)/);
  assert.match(source, /nukhba-chat-greeted/);
  assert.match(source, /dismissBubble/);
  assert.match(source, /aria-label=\{ar \? "إغلاق رسالة الترحيب" : "Dismiss welcome message"\}/);
});

test("WhatsApp float has no fake notification dot", () => {
  const source = read("src/components/whatsapp-float.tsx");
  assert.doesNotMatch(source, /bg-red-500/);
  assert.doesNotMatch(source, /-top-0\.5 -end-0\.5/);
});

test("open chatbot hides competing floats and reduced motion stops decorative pulses", () => {
  const css = read("src/app/globals.css");
  const source = read("src/components/site-chatbot.tsx");
  assert.match(source, /data-chatbot/);
  assert.match(css, /html\[data-chatbot="open"\] \.whatsapp-float/);
  assert.match(css, /html\[data-chatbot="open"\] \.back-to-top/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.animate-pulse,\s*\.animate-ping,\s*\.animate-bounce/);
});
