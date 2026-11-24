import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolvePayGateProcessorRedirect } from "@/lib/paygate";
import { buildFirstPartyPayGateUrl } from "@/lib/paygate-core";
import { siteConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

const GO_LIMIT = {
  windowMs: 5 * 60 * 1000,
  max: 24,
  minIntervalMs: 600,
  prefix: "paygate-go",
} as const;

function requestOrigin(req: Request): string {
  const envUrl = process.env.SITE_URL?.trim();
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    return envUrl.replace(/\/+$/, "");
  }
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.trim();
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (host) return `${proto}://${host}`;
  return siteConfig.url.replace(/\/+$/, "");
}

/**
 * Redirection serveur anti-blocage antivirus :
 * Le navigateur du client appelle `/api/payments/paygate/go` sur VOTRE domaine,
 * et notre serveur résout l'URL HTTPS finale du processeur agréé (Wert, MoonPay,
 * Guardarian, Ramp, Transak…) puis renvoie un 302 direct sans jamais exposer
 * `*.paygate.to` ni `*.paygate.sbs` au poste client.
 */
export async function GET(req: Request) {
  const decision = checkRateLimit(GO_LIMIT, req);
  if (!decision.allow) {
    return new NextResponse("Too many requests. Please wait a few seconds.", {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, decision.retryAfterSec)),
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const url = new URL(req.url);
  const ref = (url.searchParams.get("ref") ?? "").trim().toUpperCase();
  const token = (url.searchParams.get("k") ?? "").trim();
  const provider = (url.searchParams.get("provider") ?? "auto").trim();
  const lang = url.searchParams.get("lang") === "en" ? "en" : url.searchParams.get("lang") === "ar" ? "ar" : null;

  if (!ref || !token) {
    return new NextResponse("Invalid payment session link.", {
      status: 400,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  const buyerCountry =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    "XX";
  const buyerIp =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "";

  const resolved = await resolvePayGateProcessorRedirect({
    orderRef: ref,
    checkoutToken: token,
    requestedProvider: provider,
    buyerCountry,
    buyerIp,
    userAgent: req.headers.get("user-agent"),
    acceptLanguage: req.headers.get("accept-language"),
  });

  if (resolved.ok) {
    return new NextResponse(null, {
      status: 302,
      headers: {
        Location: resolved.redirectUrl,
        "Cache-Control": "no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  if (resolved.code === "forbidden" || resolved.code === "not_found") {
    return new NextResponse("Payment session not found or expired.", {
      status: resolved.code === "forbidden" ? 403 : 404,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  const backBase = buildFirstPartyPayGateUrl({
    baseOrigin: requestOrigin(req),
    orderRef: ref,
    checkoutToken: token,
    locale: lang,
  });
  const suffix =
    resolved.code === "already_paid"
      ? "&paid=1"
      : `&err=provider_unavailable&tried=${encodeURIComponent(provider)}`;

  return NextResponse.redirect(`${backBase}${suffix}`, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
