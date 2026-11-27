"use client";

/** Opt-in DevTools diagnostics: /tg?perf=1. No beacon, cookies or user data. */
export function startMiniAppDiagnostics(): () => void {
  if (new URLSearchParams(location.search).get("perf") !== "1") return () => {};
  performance.mark("tg_hydrated");
  const vitals: Record<string, number> = {};
  const observers: PerformanceObserver[] = [];
  for (const type of ["paint", "largest-contentful-paint", "longtask"]) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (type === "paint") vitals[entry.name] = entry.startTime;
          if (type === "largest-contentful-paint") vitals.lcpMs = entry.startTime;
          if (type === "longtask") vitals.longTasksMs = (vitals.longTasksMs ?? 0) + entry.duration;
        }
      });
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch { /* Old WebViews do not implement every observer type. */ }
  }
  const snapshot = () => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const resources = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .filter((entry) => ["img", "script", "link", "css", "fetch"].includes(entry.initiatorType))
      .map((entry) => {
        const url = new URL(entry.name);
        const image = entry.initiatorType === "img" || /\.(webp|png|jpe?g|avif)$/.test(url.pathname);
        return {
          // Strip queries and remote paths: never expose signed URLs or tokens.
          resource: url.origin === location.origin ? url.pathname : url.hostname,
          kind: image ? "image" : entry.initiatorType,
          durationMs: entry.duration, startMs: entry.startTime,
          bytes: entry.transferSize, responseEndMs: entry.responseEnd,
        };
      });
    return {
      version: 1,
      navigation: nav ? {
        ttfbMs: nav.responseStart - nav.startTime,
        serverWaitMs: nav.responseStart - nav.requestStart,
        dnsMs: nav.domainLookupEnd - nav.domainLookupStart,
        connectMs: nav.connectEnd - nav.connectStart,
        downloadMs: nav.responseEnd - nav.responseStart,
        domContentLoadedMs: nav.domContentLoadedEventEnd,
        loadMs: nav.loadEventEnd,
        transferBytes: nav.transferSize,
      } : null,
      hydratedMs: performance.getEntriesByName("tg_hydrated")[0]?.startTime,
      telegramReadyMs: performance.getEntriesByName("tg_sdk_ready")[0]?.startTime,
      vitals: { ...vitals },
      serverTiming: document.querySelector('meta[name="nokhba-tg-server-timing"]')?.getAttribute("content"),
      resources,
      slowest: [...resources].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10),
      // Zero transferSize may mean browser cache OR cross-origin timing restrictions.
      note: "Client clock only. Zero bytes does not prove a cache hit. Server stages may overlap.",
    };
  };
  const target = window as Window & { nokhbaTgPerformance?: typeof snapshot };
  target.nokhbaTgPerformance = snapshot;
  return () => {
    observers.forEach((observer) => observer.disconnect());
    delete target.nokhbaTgPerformance;
  };
}
