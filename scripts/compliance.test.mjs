import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("professional contact defaults match the supplied details", () => {
  const config = read("src/lib/config.ts");
  assert.ok(config.includes("contact@${DEFAULT_SITE_DOMAIN}"));
  assert.ok(config.includes('phone: "+218 91 344 2640"'));
  assert.ok(config.includes('whatsapp: "218913442640"'));
  assert.ok(config.includes('whatsapp: "https://wa.me/218913442640"'));
});

test("legal pages are discoverable in the footer, sitemap and payment information", () => {
  for (const path of ["/conditions", "/remboursement"]) {
    assert.ok(read("src/components/footer.tsx").includes(path));
    assert.ok(read("src/app/sitemap.ts").includes(path));
    assert.ok(read("src/components/legal-links.tsx").includes(path));
  }
  assert.ok(read("src/components/payment-guarantee.tsx").includes("<LegalLinks />"));
});

test("legal and contact pages expose professional communication channels", () => {
  for (const path of [
    "src/app/(site)/conditions/conditions-client.tsx",
    "src/app/(site)/remboursement/refund-client.tsx",
    "src/app/(site)/contact/contact-client.tsx",
  ]) assert.ok(read(path).includes("<ProfessionalContact />"));
  const contact = read("src/components/professional-contact.tsx");
  assert.ok(contact.includes("mailto:${config.email}"));
  assert.ok(contact.includes("whatsappLink(config.whatsapp)"));
});

test("refund policy preserves existing deposit and subscription rules in both languages", () => {
  const policy = read("src/app/(site)/remboursement/refund-client.tsx");
  for (const text of ["unless Nukhba is clearly at fault", "The current period is not refunded", "إلا في حال تقصير ثابت من نخبة", "ولا تُسترد قيمة الفترة الجارية"]) {
    assert.ok(policy.includes(text));
  }
});
