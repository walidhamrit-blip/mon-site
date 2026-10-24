import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { orders } from "@/db/schema";
import { siteConfig } from "@/lib/config";
import { getSiteData } from "@/lib/store";
import { resolveDemoClassification, resolvePlanPriceBreakdown } from "@/lib/classification";
import { collectAllDemos } from "@/lib/site-types";
import {
  createInvoice,
  isNowPaymentsError,
  nowPaymentsConfigured,
  type CreatedInvoice,
} from "@/lib/nowpayments";
import {
  isInstallmentCount,
  splitAmount,
  trancheRef,
} from "@/lib/installments";
import { siteBaseUrl } from "@/lib/site-url";
import {
  createTrackingToken,
  newOrderReference,
  trackingAccess,
  trackingQuery,
} from "@/lib/order-tracking";
import { checkRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/csrf";

/* Limite la cadence de création de factures crypto par IP+UA. Bloque
 * les bots qui tentent de générer des dizaines de liens de paiement
 * (chaque appel consomme potentiellement du quota NOWPayments). */
const PAYMENT_LIMIT = {
  windowMs: 10 * 60 * 1000,
  max: 6,
  minIntervalMs: 1500,
  prefix: "payment",
} as const;

/**
 * Crée une commande + une facture NOWPayments (page de paiement
 * hébergée `invoice_url` vers laquelle le client est redirigé).
 * Appelée depuis le dialogue de paiement crypto (pricing).
 * Le montant est calculé côté serveur d'après l'ID de la
 * formule : le client ne peut pas forcer le prix.
 *
 * Deux modes :
 *  - nouveau paiement (`planId`) : une commande par tranche est
 *    créée (1, 2 ou 3), seul le 1er versement est facturé tout de suite ;
 *  - tranche suivante (`orderRef`) : crée une nouvelle facture pour
 *    une tranche déjà planifiée (lien renvoyé au client).
 */

const createPaymentSchema = z
  .object({
    /**
     * « flex » = paiement flexible « 1 $ ou plus » : le client choisit
     * son montant (borné par la configuration serveur).
     */
    kind: z.enum(["plan", "flex"]).optional(),
    /** Montant libre en USD (mode flex uniquement). */
    amountUsd: z.number().positive().optional(),
    /** Description libre du paiement flexible (acompte, solde…). */
    description: z.string().max(120).optional(),
    planId: z.string().min(1).max(64).optional(),
    /** Site du portfolio acheté ; son éventuel prix modèle spécifique est recalculé côté serveur. */
    demoSlug: z.string().min(1).max(100).optional(),
    /** Jeton de suivi, exigé pour refacturer une commande protégée. */
    trackingToken: z.string().max(200).optional(),
    /** Référence d'une tranche existante à régler (2e, 3e versement…). */
    orderRef: z.string().min(3).max(80).optional(),
    /** 1 = paiement total, 2 ou 3 = paiement en tranches. */
    installments: z.number().int().min(1).max(3).optional(),
    name: z.string().max(120).optional(),
    email: z.string().email().max(254).optional(),
    phone: z.string().max(40).optional(),
    locale: z.enum(["ar", "en"]).optional(),
    utm: z.string().max(500).optional(),
  })
  .refine(
    (data) =>
      Boolean(data.planId || data.orderRef) ||
      (data.kind === "flex" && data.amountUsd != null),
    {
      message: "planId, orderRef ou (kind=flex + amountUsd) requis",
    },
  );

/** Cause exacte d'un échec, remontée telle quelle au dialogue de paiement. */
interface ErrorDetail {
  /** Origine : config serveur, base de données, passerelle ou saisie. */
  source: "config" | "database" | "nowpayments" | "input";
  /** Code HTTP renvoyé par NOWPayments (null si non applicable). */
  status: number | null;
  /** Message exact (corps NOWPayments ou erreur serveur). */
  message: string;
}

function errorResponse(error: string, httpStatus: number, detail: ErrorDetail) {
  return NextResponse.json({ ok: false, error, detail }, { status: httpStatus });
}

/** Message d'erreur exploitable depuis une exception. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Détail standard pour une erreur NOWPayments. */
function gatewayDetail(error: unknown): ErrorDetail {
  return {
    source: "nowpayments",
    status: isNowPaymentsError(error) ? error.status : null,
    message: errorMessage(error),
  };
}

/** Détail standard pour une erreur de base de données. */
function databaseDetail(error: unknown): ErrorDetail {
  return {
    source: "database",
    status: null,
    message: errorMessage(error),
  };
}

/** Paramètres de paiement communs (retour NOWPayments → nos pages). */
function paymentUrls(req: Request, ref: string, trackingToken?: string | null) {
  const baseUrl = siteBaseUrl(req);
  const query = trackingQuery(ref, trackingToken);
  return {
    ipnCallbackUrl: `${baseUrl}/api/payments/ipn`,
    successUrl: `${baseUrl}/pay/success?${query}`,
    cancelUrl: `${baseUrl}/pay/cancel?${query}`,
  };
}

/**
 * Facture une tranche existante (2e/3e versement) et met à jour
 * les informations de paiement de la commande.
 */
async function payExistingOrder(
  orderRef: string,
  trackingToken: string | undefined,
  req: Request,
) {
  await ensureSchema();
  const wanted = orderRef.trim().toUpperCase();
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.ref, wanted))
    .limit(1);
  const order = rows[0];

  if (!order) {
    return errorResponse("order_not_found", 404, {
      source: "input",
      status: null,
      message: `Aucune commande « ${wanted} »`,
    });
  }

  // Les commandes protégées exigent leur jeton pour générer une nouvelle
  // facture ; les anciennes commandes (sans empreinte) restent relançables
  // par référence, comme avant, afin de ne pas bloquer les plans en cours.
  const access = trackingAccess(order.trackingTokenHash, trackingToken);
  if (access === "denied") {
    return errorResponse("order_not_found", 404, {
      source: "input",
      status: null,
      message: `Aucune commande « ${wanted} »`,
    });
  }

  if (order.status === "paid") {
    return errorResponse("order_already_paid", 409, {
      source: "input",
      status: null,
      message: `La commande « ${order.ref} » est déjà payée`,
    });
  }

  const amount = Number(order.amountUsd);
  if (!Number.isFinite(amount) || amount <= 0) {
    return errorResponse("invalid_amount", 400, {
      source: "input",
      status: null,
      message: `Montant invalide pour « ${order.ref} » : ${order.amountUsd}`,
    });
  }

  const { config } = await getSiteData();
  const label =
    order.installments > 1
      ? `${config.name} — ${order.planName} (${order.installmentIndex}/${order.installments})`
      : `${config.name} — ${order.planName} plan`;

  let invoice: CreatedInvoice;
  try {
    invoice = await createInvoice({
      priceAmount: amount,
      // Order_id unique à chaque facture (suffixe « -R… ») : une émission
      // précédente n'interfère jamais, et l'IPN retombe quand même sur
      // notre `ref` (voir refCandidates dans ipn/route.ts).
      orderId: `${order.ref}-R${Date.now().toString(36).toUpperCase()}`,
      orderDescription: label,
      ...paymentUrls(req, order.ref, access === "granted" ? trackingToken : null),
    });
  } catch (error) {
    console.error(
      "[payments] NOWPayments refusé (tranche) :",
      errorMessage(error),
    );
    // Aucune facture créée : la commande existe déjà, inutile de la
    // supprimer — le client pourra réessayer depuis la page de suivi.
    return errorResponse("gateway_error", 502, gatewayDetail(error));
  }

  try {
    // Relance explicite, mais jamais au détriment d'un paiement confirmé
    // entre la lecture initiale et la création de cette facture.
    const relaunched = await db
      .update(orders)
      .set({
        status: "pending",
        ipnStatus: null,
        // Le payment_id est (ré)écrit par l'IPN dès que le client engage
        // le règlement : un identifiant précédent (expiré) ne doit pas
        // polluer le polling de statut.
        paymentId: null,
        payAddress: null,
        payCurrency: null,
        payAmount: null,
        paymentUrl: invoice.invoice_url,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, order.id), ne(orders.status, "paid")))
      .returning({ id: orders.id });

    if (relaunched.length === 0) {
      return errorResponse("order_already_paid", 409, {
        source: "input",
        status: null,
        message: `La commande « ${order.ref} » est déjà payée`,
      });
    }
  } catch (error) {
    console.error(
      "[payments] lien commande impossible :",
      error instanceof Error ? error.message : error,
    );
  }

  return NextResponse.json({
    ok: true,
    orderRef: order.ref,
    groupRef: order.groupRef ?? order.ref,
    installments: order.installments,
    installmentIndex: order.installmentIndex,
    trancheAmountUsd: amount,
    paymentUrl: invoice.invoice_url,
    priceAmount: invoice.price_amount,
    priceCurrency: invoice.price_currency,
  });
}

/**
 * Paiement flexible « 1 $ ou plus » : le client choisit son montant —
 * utile pour un acompte, un solde, un soutien, et pour contourner les
 * limites minimales imposées par certaines plateformes de crypto (si
 * une pièce refuse un montant trop bas, il suffit d'augmenter).
 *
 * Le montant reste borné côté serveur (configuration « vivante » :
 * `flexiblePayment.minUsd` / `maxUsd`) — le navigateur ne peut ni
 * payer 0 $, ni dépasser le maximum autorisé.
 */
async function createFlexibleOrder(
  req: Request,
  data: {
    amountUsd: number;
    description?: string;
    name?: string;
    email?: string;
    phone?: string;
    locale?: "ar" | "en";
    utm?: string;
  },
) {
  const { config } = await getSiteData();

  // Type lâche : la configuration « vivante » vient de la base (valeurs
  // admin) et n'a pas les types littéraux de `as const`.
  const flex = (config.flexiblePayment ??
    siteConfig.flexiblePayment) as unknown as {
    enabled: boolean;
    minUsd: number;
    maxUsd: number;
    suggested: readonly number[];
  };

  if (flex.enabled === false) {
    return errorResponse("flex_disabled", 403, {
      source: "config",
      status: null,
      message: "Le paiement flexible est désactivé (Configuration → site).",
    });
  }

  const minUsd = Number(flex.minUsd) > 0 ? Number(flex.minUsd) : 1;
  const maxUsd = Number(flex.maxUsd) > 0 ? Number(flex.maxUsd) : 5000;

  const amount = Math.round(Number(data.amountUsd) * 100) / 100;
  if (!Number.isFinite(amount) || amount < minUsd || amount > maxUsd) {
    return errorResponse("invalid_amount", 400, {
      source: "input",
      status: null,
      message: `Montant flexible hors limites : ${data.amountUsd} (attendu ${minUsd}–${maxUsd} USD)`,
    });
  }

  // Devise unique : USD (= USDT au paiement). La colonne historique
  // `amount_lyd` (NOT NULL, commandes anciennes) reçoit le montant USD ;
  // elle n'est plus affichée nulle part.

  const ref = newOrderReference("NKH");
  const tracking = createTrackingToken();
  const label = data.description?.trim() || "Flexible payment";

  // 1) Commande en attente — trace immédiate dans /admin/orders.
  let orderId: number;
  try {
    await ensureSchema();
    const inserted = await db
      .insert(orders)
      .values({
        ref,
        trackingTokenHash: tracking.hash,
        groupRef: ref,
        kind: "flex",
        planId: "flexible",
        planName: label.slice(0, 190),
        amountLyd: String(amount),
        amountUsd: String(amount),
        currency: "usd",
        installments: 1,
        installmentIndex: 1,
        clientName: data.name?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        utm: data.utm || null,
        locale: data.locale ?? null,
      })
      .returning({ id: orders.id });
    orderId = inserted[0]?.id ?? 0;
  } catch (error) {
    console.error(
      "[payments] création commande flexible impossible :",
      errorMessage(error),
    );
    return errorResponse("save_failed", 500, databaseDetail(error));
  }

  // 2) Facture NOWPayments (page de paiement hébergée).
  let invoice: CreatedInvoice;
  try {
    invoice = await createInvoice({
      priceAmount: amount,
      orderId: ref,
      orderDescription: `${config.name} — ${label}`.slice(0, 190),
      ...paymentUrls(req, ref, tracking.token),
    });
  } catch (error) {
    console.error(
      "[payments] NOWPayments refusé (flexible) :",
      errorMessage(error),
    );
    // Aucune facture → on retire la ligne orpheline.
    await db.delete(orders).where(eq(orders.id, orderId)).catch(() => null);
    return errorResponse("gateway_error", 502, gatewayDetail(error));
  }

  // 3) Lien facture ↔ commande (le payment_id arrivera via l'IPN).
  try {
    await db
      .update(orders)
      .set({ paymentUrl: invoice.invoice_url, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
  } catch (error) {
    console.error(
      "[payments] lien commande flexible impossible :",
      error instanceof Error ? error.message : error,
    );
  }

  return NextResponse.json({
    ok: true,
    orderRef: ref,
    trackingToken: tracking.token,
    groupRef: ref,
    installments: 1,
    installmentIndex: 1,
    trancheAmountUsd: amount,
    paymentUrl: invoice.invoice_url,
    priceAmount: invoice.price_amount,
    priceCurrency: invoice.price_currency,
  });
}

export async function POST(req: Request) {
  // Anti-CSRF : la création d'une facture déclenche un paiement crypto
  // réel chez NOWPayments (coût d'API + éventuellement facturation
  // échouée côté marchand). On refuse les POST cross-origin non
  // explicitement autorisés.
  if (!enforceSameOrigin(req)) {
    return errorResponse("csrf", 403, {
      source: "input",
      status: null,
      message: "Origine non autorisée.",
    });
  }

  const decision = checkRateLimit(PAYMENT_LIMIT, req);
  if (!decision.allow) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", detail: { retryAfterSec: decision.retryAfterSec } },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, decision.retryAfterSec)),
        },
      },
    );
  }

  if (!nowPaymentsConfigured()) {
    return errorResponse("gateway_not_configured", 503, {
      source: "config",
      status: null,
      message:
        "NOWPAYMENTS_API_KEY absente du serveur (variable d'environnement non définie, ou non appliquée à l'environnement Production — après ajout sur Vercel, redéployer)",
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid_json", 400, {
      source: "input",
      status: null,
      message: "Corps JSON invalide",
    });
  }

  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("invalid_input", 400, {
      source: "input",
      status: null,
      message: parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "?"}: ${issue.message}`)
        .join(" ; "),
    });
  }

  const data = parsed.data;

  // ── Mode « tranche suivante » : commande déjà planifiée ──
  if (data.orderRef) {
    try {
      return await payExistingOrder(data.orderRef, data.trackingToken, req);
    } catch (error) {
      console.error(
        "[payments] paiement d'une tranche impossible :",
        errorMessage(error),
      );
      return errorResponse("save_failed", 500, databaseDetail(error));
    }
  }

  // ── Mode « paiement flexible » : montant libre 1 $ ou plus ──
  if (data.kind === "flex") {
    try {
      return await createFlexibleOrder(req, {
        amountUsd: data.amountUsd ?? 0,
        description: data.description,
        name: data.name,
        email: data.email,
        phone: data.phone,
        locale: data.locale,
        utm: data.utm,
      });
    } catch (error) {
      console.error(
        "[payments] paiement flexible impossible :",
        errorMessage(error),
      );
      return errorResponse("save_failed", 500, databaseDetail(error));
    }
  }

  // ── Mode « nouveau paiement » : total ou plan en tranches ──
  // Le plan est lu depuis la configuration « vivante » (admin), pas la
  // valeur codée : le montant facturé suit toujours le prix affiché.
  const { config, content } = await getSiteData();
  const plan = config.pricing.plans.find((p) => p.id === data.planId);
  if (!plan) {
    return errorResponse("plan_not_payable", 400, {
      source: "input",
      status: null,
      message: `Formule « ${data.planId} » absente de la configuration.`,
    });
  }

  const demos = collectAllDemos(content);
  const demo = data.demoSlug ? demos.find((item) => item.slug === data.demoSlug) : null;
  if (data.demoSlug && !demo) {
    return errorResponse("demo_not_found", 404, {
      source: "input",
      status: null,
      message: `Site « ${data.demoSlug} » introuvable dans le catalogue.`,
    });
  }
  const demoClassification = demo
    ? resolveDemoClassification(demo, config.pricing.plans)
    : null;
  if (demoClassification && demoClassification.planId !== plan.id) {
    return errorResponse("plan_not_payable", 400, {
      source: "input",
      status: null,
      message: `Le site « ${data.demoSlug} » ne correspond pas à la formule « ${plan.id} ».`,
    });
  }

  const modelPriceUsd = demoClassification?.priceUsd ?? plan.priceUsd;
  if (typeof modelPriceUsd !== "number" || !Number.isFinite(modelPriceUsd) || modelPriceUsd <= 0) {
    return errorResponse("plan_not_payable", 400, {
      source: "input",
      status: null,
      message: `Le prix USD du modèle « ${plan.id} » n'est pas configuré.`,
    });
  }

  // Recalcul partagé avec l'affichage public : le navigateur ne peut pas
  // modifier le prix du modèle, le pourcentage ni le total facturé.
  const priceBreakdown = resolvePlanPriceBreakdown(plan, modelPriceUsd);
  const customizationUsd = priceBreakdown.customizationUsd;
  const grossTotalUsd = priceBreakdown.totalPriceUsd;
  if (customizationUsd == null || grossTotalUsd == null) {
    return errorResponse("customization_quote_required", 400, {
      source: "config",
      status: null,
      message: `Le taux de personnalisation de la formule « ${plan.id} » doit être renseigné dans Réglages → Tarifs avant tout paiement.`,
    });
  }

  const count =
    data.installments && isInstallmentCount(data.installments)
      ? data.installments
      : 1;

  // Prix final : jamais fait confiance au montant envoyé par le
  // navigateur — le total est recalculé ici, à partir du prix admin.
  const totalUsd = grossTotalUsd;
  const projectName = demo?.titleEn || plan.nameEn;
  const priceDetails = `model $${modelPriceUsd} + customization $${customizationUsd}`;
  const planLabel = `${projectName} (${priceDetails})`.slice(0, 190);

  const usdTranches = splitAmount(totalUsd, count);

  const baseRef = newOrderReference("NKH");
  // Un même jeton pour toutes les tranches du groupe : le lien reçu au
  // premier paiement suit l'ensemble du plan.
  const tracking = createTrackingToken();

  // 1) Une commande par tranche (statut « en attente »).
  //    Seule la première est facturée immédiatement ; les autres
  //    restent planifiées et payables depuis la page de suivi.
  let firstOrderId: number;
  try {
    await ensureSchema();
    const inserted = await db
      .insert(orders)
      .values(
        usdTranches.map((usd, index) => ({
          ref: trancheRef(baseRef, index + 1),
          trackingTokenHash: tracking.hash,
          groupRef: baseRef,
          planId: plan.id,
          planName: planLabel,
          // Colonne historique NOT NULL : montant USD (devise unique).
          amountLyd: String(usd),
          amountUsd: String(usd),
          currency: "usd",
          installments: count,
          installmentIndex: index + 1,
          demoSlug: demo?.slug ?? null,
          clientName: data.name || null,
          email: data.email || null,
          phone: data.phone || null,
          utm: data.utm || null,
          locale: data.locale ?? null,
        })),
      )
      .returning({ id: orders.id, ref: orders.ref });
    firstOrderId =
      inserted.find((row) => row.ref === baseRef)?.id ?? inserted[0]?.id ?? 0;
  } catch (error) {
    console.error(
      "[payments] création commande impossible :",
      errorMessage(error),
    );
    return errorResponse("save_failed", 500, databaseDetail(error));
  }

  // 2) Facture NOWPayments pour la première tranche : le client est
  //    redirigé vers la page hébergée (invoice_url).
  let invoice: CreatedInvoice;
  try {
    invoice = await createInvoice({
      priceAmount: usdTranches[0],
      orderId: baseRef,
      orderDescription:
        count > 1
          ? `${config.name} — ${planLabel} (1/${count})`
          : `${config.name} — ${planLabel} plan`,
      ...paymentUrls(req, baseRef, tracking.token),
    });
  } catch (error) {
    console.error("[payments] NOWPayments refusé :", errorMessage(error));
    // Aucune facture : on retire tout le groupe de tranches pour ne
    // pas laisser de lignes orphelines.
    await db.delete(orders).where(eq(orders.groupRef, baseRef)).catch(() => null);
    return errorResponse("gateway_error", 502, gatewayDetail(error));
  }

  // 3) Lien facture ↔ commande (le payment_id arrivera via l'IPN).
  try {
    await db
      .update(orders)
      .set({
        paymentUrl: invoice.invoice_url,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, firstOrderId));
  } catch (error) {
    console.error("[payments] lien commande impossible :", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({
    ok: true,
    orderRef: baseRef,
    trackingToken: tracking.token,
    groupRef: baseRef,
    installments: count,
    installmentIndex: 1,
    trancheAmountUsd: usdTranches[0],
    paymentUrl: invoice.invoice_url,
    priceAmount: invoice.price_amount,
    priceCurrency: invoice.price_currency,
  });
}
