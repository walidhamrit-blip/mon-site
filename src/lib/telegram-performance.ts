/** Server-only timings. Never record IDs, update bodies, SQL, URLs or credentials. */
import { AsyncLocalStorage } from "node:async_hooks";

export interface TelegramTiming {
  name: string;
  ms: number;
  failed: boolean;
}
export interface TelegramTrace {
  scope: "webhook" | "mini_app";
  started: number;
  spans: TelegramTiming[];
}
const traces = new AsyncLocalStorage<TelegramTrace>();
const round = (ms: number) => Math.round(ms * 10) / 10;

export async function measureTelegram<T>(name: string, work: () => T | PromiseLike<T>): Promise<T> {
  const trace = traces.getStore();
  if (!trace) return await work();
  const started = performance.now();
  let failed = false;
  try {
    return await work();
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (trace.spans.length < 100) trace.spans.push({ name, ms: round(performance.now() - started), failed });
  }
}

export function telegramServerTiming(trace: TelegramTrace): string {
  const grouped = new Map<string, number>();
  for (const span of trace.spans) grouped.set(span.name, (grouped.get(span.name) ?? 0) + span.ms);
  return [...grouped].map(([name, ms]) => `${name.replace(/[^a-zA-Z0-9_-]/g, "_")};dur=${round(ms)}`).join(", ");
}

export async function traceTelegram<T>(
  scope: TelegramTrace["scope"],
  work: (trace: TelegramTrace) => Promise<T>,
): Promise<T> {
  const trace: TelegramTrace = { scope, started: performance.now(), spans: [] };
  return traces.run(trace, async () => {
    let failed = false;
    try { return await work(trace); }
    catch (error) { failed = true; throw error; }
    finally {
      if (process.env.TELEGRAM_PERF_LOG === "1" || process.env.VERCEL_ENV === "preview") {
        console.info(JSON.stringify({
          source: "telegram.performance", scope,
          durationMs: round(performance.now() - trace.started), failed,
          spans: trace.spans,
        }));
      }
    }
  });
}
