"use client";

import Link from "next/link";

/**
 * Dernière frontière d'erreur : elle remplace le layout racine quand celui-ci
 * (ou un provider global) échoue. Les styles globaux pouvant ne pas être
 * chargés à ce stade, tout est en styles inline.
 *
 * Aucun message technique n'est affiché : seul le `digest` est montré, pour
 * qu'un client puisse le transmettre au support sans exposer la pile.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0f1115",
          color: "#f5f1e8",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif",
          padding: "24px",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "560px",
            border: "1px solid #2a2f3a",
            borderRadius: "20px",
            background: "#161a22",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#c6a664",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.12em",
            }}
          >
            NUKHBA · خطأ غير متوقع
          </p>
          <h1 style={{ margin: "14px 0 8px", fontSize: "24px", lineHeight: 1.3 }}>
            تعذّر عرض الصفحة
          </h1>
          <p
            dir="ltr"
            style={{ margin: 0, color: "#aab2c0", fontSize: "15px", lineHeight: 1.7 }}
          >
            Something went wrong while loading the page.
          </p>
          <p style={{ margin: "18px 0 0", color: "#aab2c0", fontSize: "14px" }}>
            أعد المحاولة، وإن تكرر الخطأ أرسل لنا المرجع أدناه.
          </p>

          {error.digest ? (
            <p
              dir="ltr"
              style={{
                margin: "14px 0 0",
                color: "#7f8794",
                fontSize: "12px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}

          <div
            style={{
              marginTop: "24px",
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                cursor: "pointer",
                border: 0,
                borderRadius: "999px",
                background: "#c6a664",
                color: "#14171d",
                padding: "12px 22px",
                fontSize: "14px",
                fontWeight: 800,
              }}
            >
              إعادة المحاولة · Try again
            </button>
            <Link
              href="/"
              style={{
                borderRadius: "999px",
                border: "1px solid #343b47",
                color: "#f5f1e8",
                padding: "12px 22px",
                fontSize: "14px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              الرئيسية · Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
