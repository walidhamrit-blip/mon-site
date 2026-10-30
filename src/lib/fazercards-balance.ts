// Garde-fou de SOLDE du fournisseur — côté serveur (réseau + base).
//
// Complément du correctif de livraison : celui-ci empêchait une commande de
// rester bloquée ; celui-ci empêche la CAUSE — accepter une vente que le solde
// fournisseur ne permet pas d'honorer. Le client paie, la caisse tente l'achat,
// le solde ne couvre pas → livraison manuelle et remboursement.
//
// Deux usages :
//   • l'administration (`/admin/digital`) affiche la couverture en clair ;
//   • un cron quotidien envoie une alerte e-mail quand le plafond n'est plus
//     couvert, avec le montant de recharge conseillé.
//
// ⚠️ Le solde n'est JAMAIS exposé sur une route publique (`/api/health`
// l'occulte volontairement) : c'est une donnée financière.

import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { settings } from "@/db/schema";
import {
  assessFazercardsBalance,
  shouldSendBalanceAlert,
  type BalanceAlertState,
  type BalanceAssessment,
} from "@/lib/fazercards-balance-core";
import {
  fazercardsBalance,
  fazercardsConfigured,
  fazercardsErrorMessage,
  fazercardsMaxOrderUsd,
} from "@/lib/fazercards";
import { sendEmail } from "@/lib/mailer";
import { escapeHtml } from "@/lib/emails";
import { getSiteData } from "@/lib/store";

/** Clé `settings` qui mémorise la dernière alerte envoyée. */
export const FAZERCARDS_BALANCE_ALERT_KEY = "fazercards:balance-alert";

/** Durée de vie du cache mémoire du solde (ms) : évite un appel par rendu. */
export const BALANCE_CACHE_TTL_MS = 5 * 60 * 1000;

/** Délai avant de répéter une alerte sur un solde durablement bas (heures). */
export function balanceAlertResendHours(): number {
  const raw = Number(process.env.FAZERCARDS_BALANCE_ALERT_RESEND_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : 24;
}

export interface FazercardsBalanceStatus {
  configured: boolean;
  assessment: BalanceAssessment;
  /** Date de lecture du solde (ISO), null si illisible. */
  fetchedAt: string | null;
  error: string | null;
}

interface BalanceCacheEntry {
  status: FazercardsBalanceStatus;
  readAt: number;
}

let cache: BalanceCacheEntry | null = null;

/** Vide le cache (après un changement de clé ou une vérification forcée). */
export function invalidateFazercardsBalanceCache(): void {
  cache = null;
}

/**
 * Solde + évaluation de la couverture du plafond de vente.
 *
 * Ne lève jamais : une passerelle muette donne `level: "unknown"` avec le
 * motif, ce qui est exactement ce que l'administration doit voir.
 */
export async function getFazercardsBalanceStatus(
  options: { fresh?: boolean; timeoutMs?: number } = {},
): Promise<FazercardsBalanceStatus> {
  const maxOrderUsd = fazercardsMaxOrderUsd();

  if (!options.fresh && cache && Date.now() - cache.readAt < BALANCE_CACHE_TTL_MS) {
    return withCurrentCap(cache.status, maxOrderUsd);
  }

  if (!fazercardsConfigured()) {
    const status: FazercardsBalanceStatus = {
      configured: false,
      assessment: assessFazercardsBalance({ balanceUsd: null, maxOrderUsd }),
      fetchedAt: null,
      error: "FAZERCARDS_API_KEY absent : aucun achat automatique possible.",
    };
    cache = { status, readAt: Date.now() };
    return status;
  }

  try {
    const balance = await fazercardsBalance({ timeoutMs: options.timeoutMs ?? 6000 });
    const parsed = Number(balance.balance);
    const status: FazercardsBalanceStatus = {
      configured: true,
      assessment: assessFazercardsBalance({
        balanceUsd: Number.isFinite(parsed) ? parsed : null,
        maxOrderUsd,
      }),
      fetchedAt: new Date().toISOString(),
      error: null,
    };
    cache = { status, readAt: Date.now() };
    return status;
  } catch (error) {
    const status: FazercardsBalanceStatus = {
      configured: true,
      assessment: assessFazercardsBalance({ balanceUsd: null, maxOrderUsd }),
      fetchedAt: null,
      error: fazercardsErrorMessage(error),
    };
    cache = { status, readAt: Date.now() };
    return status;
  }
}

/**
 * Une valeur en cache a été calculée avec un plafond qui a pu changer
 * (variable d'environnement) : on réévalue l'évaluation sans relire le solde.
 */
function withCurrentCap(
  status: FazercardsBalanceStatus,
  maxOrderUsd: number,
): FazercardsBalanceStatus {
  if (status.assessment.maxOrderUsd === maxOrderUsd) return status;
  return {
    ...status,
    assessment: assessFazercardsBalance({
      balanceUsd: status.assessment.balanceUsd,
      maxOrderUsd,
    }),
  };
}

/* ------------------------------- Alerte ------------------------------- */

async function readAlertState(): Promise<BalanceAlertState | null> {
  try {
    await ensureSchema();
    const rows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, FAZERCARDS_BALANCE_ALERT_KEY))
      .limit(1);
    const raw = rows[0]?.value as Partial<BalanceAlertState> | undefined;
    if (!raw || typeof raw !== "object") return null;
    const level = raw.level;
    const sentAt = Number(raw.sentAt);
    if (!level || !Number.isFinite(sentAt)) return null;
    return {
      level,
      sentAt,
      balanceUsd:
        raw.balanceUsd != null && Number.isFinite(Number(raw.balanceUsd))
          ? Number(raw.balanceUsd)
          : null,
    };
  } catch {
    return null;
  }
}

async function writeAlertState(state: BalanceAlertState): Promise<void> {
  try {
    await ensureSchema();
    await db
      .insert(settings)
      .values({ key: FAZERCARDS_BALANCE_ALERT_KEY, value: state, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: state, updatedAt: new Date() },
      });
  } catch (error) {
    // Une écriture impossible ne doit pas empêcher l'alerte d'exister.
    console.warn(
      "[fazercards][solde] mémorisation de l'alerte impossible :",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Destinataire des alertes internes (jamais un client).
 * Exporté pour que la recharge automatique utilise exactement la même règle.
 */
export function adminRecipient(siteEmail?: string): string {
  const from = (value: string | undefined) => value?.match(/[^\s<>]+@[^\s<>]+/)?.[0]?.trim() ?? "";
  return (
    from(process.env.LEAD_NOTIFICATION_EMAIL) ||
    from(siteEmail) ||
    from(process.env.EMAIL_FROM) ||
    ""
  );
}

const LEVEL_LABELS: Record<string, string> = {
  critical: "CRITIQUE",
  low: "BAS",
  unknown: "ILLISIBLE",
  ok: "OK",
};

function alertEmail(input: {
  kind: "alert" | "recovery";
  assessment: BalanceAssessment;
  siteName: string;
  siteUrl: string;
}): { subject: string; text: string; html: string } {
  const { assessment, siteName, siteUrl } = input;
  const recovery = input.kind === "recovery";
  const level = LEVEL_LABELS[assessment.level] ?? assessment.level;

  const subject = recovery
    ? `✅ Solde fournisseur rétabli — ${assessment.balanceUsd?.toFixed(2) ?? "?"} $`
    : `⚠️ Solde fournisseur ${level} — recharge de ${assessment.recommendedTopUpUsd} $ conseillée`;

  const lines = [
    recovery
      ? `Le solde fournisseur couvre de nouveau le plafond d'achat automatique.`
      : `Le solde du compte fournisseur ne couvre pas le plafond de vente configuré.`,
    ``,
    `Solde lu : ${assessment.balanceUsd != null ? `${assessment.balanceUsd.toFixed(2)} $` : "illisible"}`,
    `Plafond de vente (FAZERCARDS_MAX_ORDER_USD) : ${assessment.maxOrderUsd.toFixed(2)} $`,
    `Coût fournisseur de ce plafond : ${assessment.costCeilingUsd.toFixed(2)} $`,
    ...(assessment.coveredSaleUsd != null
      ? [`Vente maximale encore payable : ${assessment.coveredSaleUsd.toFixed(2)} $`]
      : []),
    ...(assessment.recommendedTopUpUsd > 0
      ? [`Recharge conseillée : ${assessment.recommendedTopUpUsd.toFixed(2)} $ (marge incluse)`]
      : []),
    ``,
    assessment.summary,
    ``,
    recovery
      ? `Aucune action requise.`
      : `Deux options, dans cet ordre : recharger le solde, ou baisser FAZERCARDS_MAX_ORDER_USD pour rester dans la couverture actuelle.`,
    ``,
    `Administration : ${siteUrl.replace(/\/+$/, "")}/admin/digital`,
    ``,
    `— ${siteName}`,
  ];

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1e">
      <div style="font-size:13px;letter-spacing:.12em;color:#C6A664;font-weight:700">${escapeHtml(siteName.toUpperCase())} — BOUTIQUE DIGITALE</div>
      <h1 style="font-size:21px;font-weight:900;margin:8px 0 12px">
        ${recovery ? "Solde fournisseur rétabli ✅" : `Solde fournisseur ${escapeHtml(level)} ⚠️`}
      </h1>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700;width:200px">Solde lu</td><td style="padding:6px 10px">${assessment.balanceUsd != null ? `${assessment.balanceUsd.toFixed(2)} $` : "illisible"}</td></tr>
        <tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700">Plafond de vente</td><td style="padding:6px 10px">${assessment.maxOrderUsd.toFixed(2)} $</td></tr>
        <tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700">Coût fournisseur du plafond</td><td style="padding:6px 10px">${assessment.costCeilingUsd.toFixed(2)} $</td></tr>
        ${
          assessment.coveredSaleUsd != null
            ? `<tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700">Vente encore payable</td><td style="padding:6px 10px">${assessment.coveredSaleUsd.toFixed(2)} $</td></tr>`
            : ""
        }
        ${
          assessment.recommendedTopUpUsd > 0
            ? `<tr><td style="padding:6px 10px;background:#f6f3ec;font-weight:700">Recharge conseillée</td><td style="padding:6px 10px;font-weight:700">${assessment.recommendedTopUpUsd.toFixed(2)} $</td></tr>`
            : ""
        }
      </table>
      <p style="font-size:13px;color:#444;margin-top:16px">${escapeHtml(assessment.summary)}</p>
      <p style="font-size:13px;color:#444">
        ${
          recovery
            ? "Aucune action requise."
            : "Deux options : recharger le solde, ou baisser <code>FAZERCARDS_MAX_ORDER_USD</code> pour rester dans la couverture actuelle."
        }
      </p>
      <p style="font-size:12px;color:#999;margin-top:20px">${escapeHtml(siteName)} — ${escapeHtml(siteUrl)}</p>
    </div>`;

  return { subject, text: lines.join("\n"), html };
}

export interface BalanceCheckReport {
  level: BalanceAssessment["level"];
  balanceUsd: number | null;
  maxOrderUsd: number;
  costCeilingUsd: number;
  coveredSaleUsd: number | null;
  recommendedTopUpUsd: number;
  decision: "alert" | "recovery" | "silent";
  emailed: boolean;
  emailError: string | null;
  recipient: string | null;
  summary: string;
}

/**
 * Relit le solde et envoie l'alerte si nécessaire.
 *
 * @param options.dryRun  n'envoie rien et ne mémorise rien (diagnostic)
 * @param options.fresh   ignore le cache mémoire
 */
export async function checkFazercardsBalance(
  options: { dryRun?: boolean; fresh?: boolean; now?: number } = {},
): Promise<BalanceCheckReport> {
  const status = await getFazercardsBalanceStatus({ fresh: options.fresh ?? true });
  const assessment = status.assessment;
  const now = options.now ?? Date.now();
  const previous = await readAlertState();

  const decision = shouldSendBalanceAlert({
    level: assessment.level,
    previous,
    now,
    resendHours: balanceAlertResendHours(),
  });

  const base = {
    level: assessment.level,
    balanceUsd: assessment.balanceUsd,
    maxOrderUsd: assessment.maxOrderUsd,
    costCeilingUsd: assessment.costCeilingUsd,
    coveredSaleUsd: assessment.coveredSaleUsd,
    recommendedTopUpUsd: assessment.recommendedTopUpUsd,
    decision,
    summary: assessment.summary,
  };

  if (decision === "silent") {
    return { ...base, emailed: false, emailError: null, recipient: null };
  }

  const { config } = await getSiteData();
  const recipient = adminRecipient(config.email);
  if (!recipient) {
    return {
      ...base,
      emailed: false,
      emailError: "aucun destinataire : LEAD_NOTIFICATION_EMAIL / e-mail du site absent",
      recipient: null,
    };
  }

  if (options.dryRun) {
    return { ...base, emailed: false, emailError: null, recipient };
  }

  const message = alertEmail({
    kind: decision,
    assessment,
    siteName: config.name,
    siteUrl: config.url,
  });

  const result = await sendEmail({ to: recipient, ...message });
  // L'état n'est mémorisé QUE si l'envoi a réussi : sinon le prochain passage
  // doit réessayer (un serveur SMTP en panne ne doit pas faire taire l'alerte
  // pendant 24 h).
  if (result.ok) {
    await writeAlertState({
      level: assessment.level,
      sentAt: now,
      balanceUsd: assessment.balanceUsd,
    });
  } else {
    console.warn("[fazercards][solde] alerte non envoyée :", result.error);
  }

  return {
    ...base,
    emailed: result.ok,
    emailError: result.ok ? null : (result.error ?? "échec d'envoi"),
    recipient,
  };
}
