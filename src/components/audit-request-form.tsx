"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n";

type Status = "idle" | "sending" | "sent" | "error";

const FIELD =
  "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)]";

/**
 * Demande d'audit — réutilise `/api/lead`, sans nouveau circuit.
 *
 * L'URL du site à auditer part dans `message` ; `need=audit` porte la source
 * côté base, et l'événement `audit_request` la porte côté mesure. Aucune
 * donnée personnelle n'est envoyée à l'analytics.
 */
export function AuditRequestForm() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();

    const website = value("website");
    const name = value("name");
    const phone = value("phone");
    const email = value("email");
    const note = value("note");

    setStatus("sending");
    setError("");

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business: "Audit de site",
          sector: "audit",
          need: "audit",
          budget: "à définir",
          deadline: "24-48h",
          name,
          phone,
          email,
          message: `Site à auditer : ${website}${note ? `\n\n${note}` : ""}`,
          utm: "source=audit-form",
          locale,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      trackEvent({ name: "audit_request", source: "audit-form" });
      setStatus("sent");
    } catch {
      setStatus("error");
      setError(
        ar
          ? "تعذّر الإرسال. أعد المحاولة أو راسلنا على واتساب."
          : "Envoi impossible. Réessayez ou écrivez-nous sur WhatsApp.",
      );
    }
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-6 text-sm leading-6"
      >
        <p className="font-black">
          {ar ? "وصل طلب التدقيق." : "Demande d'audit reçue."}
        </p>
        <p className="mt-2 opacity-75">
          {ar
            ? "سنفحص العنوان ونرد خلال 24 إلى 48 ساعة بعرض واضح: ما سنصلحه، وما لن نصلحه، والسعر النهائي."
            : "Nous vérifions l'adresse et revenons sous 24 à 48 h avec un périmètre clair : ce qui sera corrigé, ce qui ne le sera pas, et le prix final."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-bold sm:col-span-2">
        {ar ? "عنوان الموقع" : "Adresse du site"}
        <input
          name="website"
          type="url"
          required
          placeholder="https://exemple.com"
          dir="ltr"
          className={FIELD}
        />
      </label>

      <label className="text-sm font-bold">
        {ar ? "الاسم" : "Nom"}
        <input name="name" required minLength={2} maxLength={200} className={FIELD} />
      </label>

      <label className="text-sm font-bold">
        {ar ? "الهاتف / واتساب" : "Téléphone / WhatsApp"}
        <input
          name="phone"
          type="tel"
          required
          minLength={6}
          maxLength={50}
          placeholder="+218 …"
          dir="ltr"
          className={FIELD}
        />
      </label>

      <label className="text-sm font-bold sm:col-span-2">
        {ar ? "البريد الإلكتروني (اختياري)" : "E-mail (facultatif)"}
        <input name="email" type="email" maxLength={200} dir="ltr" className={FIELD} />
      </label>

      <label className="text-sm font-bold sm:col-span-2">
        {ar ? "ما الذي يقلقك؟ (اختياري)" : "Qu'est-ce qui vous inquiète ? (facultatif)"}
        <textarea name="note" rows={3} maxLength={1000} className={FIELD} />
      </label>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 text-sm font-black text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          {status === "sending"
            ? ar
              ? "جارٍ الإرسال…"
              : "Envoi…"
            : ar
              ? "اطلب تدقيق موقعي"
              : "Demander l'audit"}
        </button>
        {status === "error" && (
          <p role="alert" className="mt-3 text-sm font-bold text-red-500">
            {error}
          </p>
        )}
        <p className="mt-3 text-xs opacity-55">
          {ar
            ? "لا نشارك بياناتك. نستعملها فقط للرد على طلبك."
            : "Vos données ne servent qu'à répondre à votre demande."}
        </p>
      </div>
    </form>
  );
}
