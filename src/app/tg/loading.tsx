/** Standalone loading state: never depends on the agency Tailwind bundle. */
export default function TelegramLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" style={{ minHeight: "100dvh", background: "#0b1020", color: "#b0bdd3", padding: "24px 16px", boxSizing: "border-box", fontFamily: "Cairo, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 528, margin: "0 auto" }}>
        <div aria-hidden="true" style={{ height: 64, background: "#151f36", border: "1px solid #3c365b", borderRadius: 20 }} />
        <div aria-hidden="true" style={{ height: 170, marginTop: 16, background: "linear-gradient(120deg, #17213d, #281d4d)", borderRadius: 22 }} />
        <p style={{ textAlign: "center", fontSize: 14 }}>جارٍ تحميل المتجر… <span lang="en" dir="ltr">Loading the store…</span></p>
      </div>
    </div>
  );
}
