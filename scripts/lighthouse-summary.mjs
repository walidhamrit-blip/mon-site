#!/usr/bin/env node
/** Résumé lisible de plusieurs rapports Lighthouse JSON (outil interne temporaire). */
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
const reports = files.map((file) => JSON.parse(readFileSync(file, "utf8")));
const first = reports[0];
const categories = first.categories ?? {};
const audits = first.audits ?? {};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const pct = (score) => (typeof score === "number" ? Math.round(score * 100) : "n/a");
const medianScore = (key) =>
  pct(median(reports.map((r) => r.categories?.[key]?.score).filter((s) => typeof s === "number")));

const lines = [];
lines.push(`URL : ${first.finalDisplayedUrl ?? first.finalUrl ?? "?"}`);
lines.push(`Date : ${new Date().toISOString()}`);
lines.push(`Runs : ${reports.length} (médiane)`);
lines.push("");
lines.push("## Scores (médiane)");
for (const key of ["performance", "accessibility", "best-practices", "seo"]) {
  if (categories[key]) lines.push(`- ${key} : **${medianScore(key)}**`);
}
lines.push("");
lines.push("## Scores par run");
for (const r of reports) {
  lines.push(
    `- ${["performance", "accessibility", "best-practices", "seo"]
      .map((k) => `${k} ${pct(r.categories?.[k]?.score)}`)
      .join(" · ")}`,
  );
}

lines.push("");
lines.push("## Métriques (médiane)");
for (const id of ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index"]) {
  const values = reports.map((r) => r.audits?.[id]).filter(Boolean);
  if (values.length === 0) continue;
  const numeric = values.map((a) => a.numericValue).filter((n) => typeof n === "number");
  const a = values[0];
  const value = numeric.length ? median(numeric) : null;
  lines.push(`- ${a.title} : ${value === null ? "n/a" : `${Math.round(value)} ms`} (score ${pct(median(values.map((v) => v.score).filter((s) => typeof s === "number")))})`);
}

lines.push("");
lines.push("## Opportunités (gain estimé, 1er run)");
const opportunities = Object.values(audits)
  .filter((a) => a.details?.type === "opportunity" && typeof a.numericValue === "number" && a.numericValue > 0)
  .sort((a, b) => b.numericValue - a.numericValue)
  .slice(0, 10);
for (const a of opportunities) lines.push(`- ${a.title} — ${a.displayValue ?? ""} (score ${pct(a.score)})`);
if (opportunities.length === 0) lines.push("- aucune");

lines.push("");
lines.push("## Diagnostics en échec (accessibilité / SEO / bonnes pratiques)");
for (const ref of [...(categories.accessibility?.auditRefs ?? []), ...(categories.seo?.auditRefs ?? []), ...(categories["best-practices"]?.auditRefs ?? [])]) {
  const a = audits[ref.id];
  if (a && a.score !== null && a.score < 1 && a.scoreDisplayMode !== "notApplicable" && a.scoreDisplayMode !== "manual") {
    lines.push(`- [${ref.id}] ${a.title}${a.displayValue ? ` — ${a.displayValue}` : ""}`);
    for (const item of (a.details?.items ?? []).slice(0, 3)) {
      if (item.node?.snippet) lines.push(`  - \`${item.node.snippet.slice(0, 200)}\``);
      else if (item.url) lines.push(`  - ${item.url}`);
    }
  }
}

console.log(lines.join("\n"));
