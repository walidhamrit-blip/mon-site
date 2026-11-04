"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Validation de la recette par le client.
 *
 * Deux garde-fous avant l'envoi : un nom (qui signe) et une case cochée
 * (qui évite un clic accidentel engageant la fin de la période de recette).
 * L'appel ne transmet que la référence et le jeton — jamais d'identifiant
 * devinable.
 */
export function AcceptDelivery({
  reference,
  token,
}: {
  reference: string;
  token: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 1 && confirmed && !busy;

  async function accept() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/deliveries/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: reference, token, name: name.trim() }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || data.ok !== true) {
        setError(
          data.message ??
            "L’acceptation n’a pas pu être enregistrée. Réessayez ou contactez-nous. / Acceptance failed, please retry or contact us.",
        );
        return;
      }
      router.refresh();
    } catch {
      setError(
        "Impossible de joindre le serveur. / Cannot reach the server.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
      <h2 className="text-lg font-black">
        اعتماد الاستلام — <span className="text-[var(--muted-foreground)]">Accept delivery</span>
      </h2>
      <p className="text-sm text-[var(--muted-foreground)]">
        بتأكيدك، تُفعّل فترة الضمان ويُرسل إليك إيصال بالبريد الإلكتروني.
        <br />
        Confirming starts the warranty period and e-mails you a receipt.
      </p>

      <div className="space-y-2">
        <label htmlFor="delivery-accept-name" className="block text-sm font-bold">
          الاسم الكامل — <span className="text-[var(--muted-foreground)]">Full name</span>
        </label>
        <input
          id="delivery-accept-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
          placeholder="مثال / e.g. Ahmed Ali"
        />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="delivery-accept-confirm"
          name="confirm"
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1 h-5 w-5 min-h-[24px] min-w-[24px] accent-[var(--accent)]"
        />
        <label htmlFor="delivery-accept-confirm" className="text-sm">
          لقد راجعت الموقع والروابط والعناصر المسلّمة وأقبل التسليم.
          <br />
          <span className="text-[var(--muted-foreground)]">
            I have reviewed the site, the links and the delivered items, and I accept the delivery.
          </span>
        </label>
      </div>

      <button
        type="button"
        onClick={accept}
        disabled={!canSubmit}
        className="rounded-2xl bg-[var(--accent)] px-6 py-3 font-bold text-[var(--accent-foreground)] disabled:opacity-50"
      >
        {busy ? "…" : "اعتماد الاستلام / Accept delivery"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </section>
  );
}

/** Impression du procès-verbal (le reçu reste consultable après validation). */
export function PrintReceipt() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-2xl border border-[var(--border)] px-5 py-2 text-sm font-bold"
    >
      طباعة الإيصال / Print receipt
    </button>
  );
}
