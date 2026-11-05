import { test } from "node:test";
import assert from "node:assert/strict";
import { publicEnquiryPage, buildEnquiryMessage } from "../src/lib/whatsapp-enquiry.ts";

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
