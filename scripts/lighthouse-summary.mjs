#!/usr/bin/env node
/** Résumé lisible d'un rapport Lighthouse JSON (outil interne temporaire). */
import { readFileSync } from "node:fs";

const report = JSON.parse(readFileSync(process.argv[2] ?? "lh.json", "utf8"));
const categories = report.categories ?? {};
const audits = report.audits ?? {};
const pct = (score) => (typeof score === "number" ? Math.round(score * 100) : "n/a");

const lines = [];
lines.push(`URL : ${report.finalDisplayedUrl ?? report.finalUrl ?? "?"}`);
lines.push(`Date : ${new Date().toISOString()}`);
lines.push("");
lines.push("## Scores");
for (const key of ["performance", "accessibility", "best-practices", "seo"]) {
  if (categories[key]) lines.push(`- ${key} : **${pct(categories[key].score)}**`);
}

lines.push("");
lines.push("## Métriques");
for (const id of ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index"]) {
  const a = audits[id];
  if (a) lines.push(`- ${a.title} : ${a.displayValue ?? "n/a"} (score ${pct(a.score)})`);
}

lines.push("");
lines.push("## Opportunités (gain estimé)");
const opportunities = Object.values(audits)
  .filter((a) => a.details?.type === "opportunity" && typeof a.numericValue === "number" && a.numericValue > 0)
  .sort((a, b) => b.numericValue - a.numericValue)
  .slice(0, 10);
for (const a of opportunities) {
  lines.push(`- ${a.title} — ${a.displayValue ?? ""} (score ${pct(a.score)})`);
}
if (opportunities.length === 0) lines.push("- aucune");

lines.push("");
lines.push("## Diagnostics en échec (accessibilité / SEO / bonnes pratiques)");
for (const ref of [...(categories.accessibility?.auditRefs ?? []), ...(categories.seo?.auditRefs ?? []), ...(categories["best-practices"]?.auditRefs ?? [])]) {
  const a = audits[ref.id];
  if (a && a.score !== null && a.score < 1 && a.scoreDisplayMode !== "notApplicable" && a.scoreDisplayMode !== "manual") {
    lines.push(`- [${ref.id}] ${a.title}${a.displayValue ? ` — ${a.displayValue}` : ""}`);
    const items = a.details?.items ?? [];
    for (const item of items.slice(0, 3)) {
      const node = item.node;
      if (node?.snippet) lines.push(`  - \`${node.snippet.slice(0, 200)}\``);
      else if (item.url) lines.push(`  - ${item.url}`);
    }
  }
}

console.log(lines.join("\n"));
