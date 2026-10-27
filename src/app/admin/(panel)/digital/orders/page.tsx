import Link from "next/link";
import { ArrowLeft, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  digitalOrderSupplier,
  listDigitalOrders,
  type AdminDigitalOrder,
} from "@/lib/digital-orders";
import { nowPaymentsSandbox } from "@/lib/nowpayments";
import { checkReloadlyCredentials, reloadlyConfigured, reloadlyMaxOrderUsd } from "@/lib/reloadly";
import { mailDiagnostics } from "@/lib/mailer";
import { storedBuyerFields } from "@/lib/fazercards-orders";
import {
  DigitalOrdersTable,
  type AdminDigitalOrderRow,
} from "./digital-orders-table";
import { MailTestCard } from "./mail-test-card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Commandes de codes — Administration",
  robots: { index: false, follow: false },
};

/**
 * Commandes de codes / cartes cadeaux.
 *
 * C'est ici que se pilote la livraison à la commande : état de la
 * connexion Reloadly, solde marchand, commandes payées à livrer, erreurs
 * fournisseur et relance en un clic.
 */
export default async function AdminDigitalOrdersPage() {
  let orders: AdminDigitalOrder[] = [];
  let dbError: string | null = null;
  try {
    orders = await listDigitalOrders(200);
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
  }

  const reloadly = await checkReloadlyCredentials().catch((error) => ({
    configured: reloadlyConfigured(),
    mode: "sandbox" as const,
    valid: null,
    balance: null,
    error: error instanceof Error ? error.message : String(error),
  }));

  const mail = mailDiagnostics();

  const toDeliver = orders.filter((order) =>
    ["paid", "manual"].includes(order.normalizedStatus),
  ).length;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/digital"
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-stone-500 hover:text-stone-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Catalogue des codes
        </Link>
        <h1 className="mt-2 text-xl font-black tracking-tight text-stone-900">
          Commandes de codes &amp; cartes cadeaux
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Vente à la commande : le code est acheté chez le fournisseur de la fiche
          (FazerCards pour le catalogue actuel, Reloadly pour les fiches historiques){" "}
          <strong>après</strong> confirmation du paiement, puis envoyé au client. Aucun
          stock n&apos;est acheté d&apos;avance.
        </p>
      </div>

      {/* Diagnostic fournisseur */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-black text-stone-900">
              Connexion Reloadly <span className="font-bold text-stone-500">(ancien fournisseur)</span>
            </h2>
            <p className="mt-1 text-[12.5px] text-stone-600">
              Identifiants serveur (<code>RELOADLY_CLIENT_ID</code> /{" "}
              <code>RELOADLY_CLIENT_SECRET</code>) — jamais exposés au navigateur.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-bold ${
              reloadly.valid
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : reloadly.configured
                  ? "border-orange-200 bg-orange-50 text-orange-800"
                  : "border-stone-200 bg-stone-50 text-stone-600"
            }`}
          >
            {reloadly.valid ? <ShieldCheck className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
            {reloadly.valid
              ? "Connecté"
              : reloadly.configured
                ? "Identifiants refusés / injoignable"
                : "Non configuré"}
          </span>
        </div>

        <dl className="mt-4 grid gap-3 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-stone-200 bg-[#FAF9F6] p-3">
            <dt className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
              Environnement
            </dt>
            <dd className="mt-1 font-black text-stone-900">
              {reloadly.mode === "live" ? "🟢 Live (argent réel)" : "🧪 Sandbox (test)"}
            </dd>
            <dd className="mt-0.5 text-[11px] text-stone-500">
              {reloadly.mode === "live"
                ? "Chaque livraison débite le solde réel."
                : "Aucun argent réel dépensé. Passez RELOADLY_SANDBOX=false pour vendre."}
            </dd>
          </div>
          <div className="rounded-xl border border-stone-200 bg-[#FAF9F6] p-3">
            <dt className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
              Solde marchand
            </dt>
            <dd className="mt-1 font-black text-stone-900">
              {reloadly.balance
                ? `${reloadly.balance.balance.toFixed(2)} ${reloadly.balance.currencyCode}`
                : "—"}
            </dd>
            <dd className="mt-0.5 text-[11px] text-stone-500">
              {reloadly.balance
                ? "Solde disponible pour acheter les codes."
                : reloadly.error ?? "Renseignez les identifiants pour l'afficher."}
            </dd>
          </div>
          <div className="rounded-xl border border-stone-200 bg-[#FAF9F6] p-3">
            <dt className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
              Plafond automatique
            </dt>
            <dd className="mt-1 font-black text-stone-900">{reloadlyMaxOrderUsd()} $</dd>
            <dd className="mt-0.5 text-[11px] text-stone-500">
              Au-delà : livraison manuelle (variable <code>RELOADLY_MAX_ORDER_USD</code>).
            </dd>
          </div>
          <div className="rounded-xl border border-stone-200 bg-[#FAF9F6] p-3">
            <dt className="text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
              À livrer
            </dt>
            <dd className="mt-1 font-black text-stone-900">{toDeliver}</dd>
            <dd className="mt-0.5 text-[11px] text-stone-500">
              Commandes payées qui attendent un code.
            </dd>
          </div>
        </dl>

        {!nowPaymentsSandbox() && reloadly.mode === "sandbox" && (
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[12.5px] leading-6 text-amber-950">
            <strong>Attention — environnement mixte :</strong> NOWPayments encaisse en{" "}
            <strong>production réelle</strong>, mais Reloadly est encore en{" "}
            <strong>Sandbox (codes de test)</strong>. Pour livrer de vrais codes :
            passez le dashboard Reloadly sur <strong>LIVE</strong>, créditez le solde USD,
            remplacez <code>RELOADLY_CLIENT_ID</code> et <code>RELOADLY_CLIENT_SECRET</code>{" "}
            par les clés LIVE et définissez <code>RELOADLY_SANDBOX=false</code> sur Vercel,
            puis redéployez.
          </p>
        )}

        {!reloadly.configured && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12.5px] leading-6 text-amber-900">
            Sans identifiants Reloadly, les fiches en <strong>livraison manuelle</strong>{" "}
            restent vendables : la commande est encaissée puis signalée ici pour achat
            manuel. Les fiches en <strong>livraison automatique</strong> refusent la vente
            tant que la connexion n&apos;est pas configurée.
          </p>
        )}
      </section>

      <MailTestCard
        provider={mail.provider}
        from={mail.from}
        fromExplicit={mail.fromExplicit}
        domain={mail.domain}
      />

      {dbError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Base de données inaccessible : {dbError}
        </div>
      )}

      <DigitalOrdersTable rows={orders.map(toRow)} />
    </div>
  );
}

/** Aplatit la ligne pour le composant client (dates sérialisées). */
function toRow(order: AdminDigitalOrder): AdminDigitalOrderRow {
  return {
    ref: order.ref,
    createdAt: order.createdAt.toISOString(),
    productTitle: order.productTitle,
    platform: order.platform,
    denominationLabel: order.denominationLabel,
    region: order.region,
    quantity: order.quantity,
    unitPriceUsd: order.unitPriceUsd,
    totalUsd: order.totalUsd,
    recipientEmail: order.recipientEmail,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    status: order.normalizedStatus,
    kind: order.kind,
    supplier: digitalOrderSupplier(order),
    // Identifiant réellement transmis au fournisseur (recharges : user_id…).
    buyerFields: storedBuyerFields(order),
    fulfillment: order.fulfillment,
    reloadlyProductId: order.reloadlyProductId,
    reloadlyUnitPrice: order.reloadlyUnitPrice,
    reloadlyTransactionId: order.reloadlyTransactionId,
    reloadlyStatus: order.reloadlyStatus,
    deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
    emailSentAt: order.emailSentAt ? order.emailSentAt.toISOString() : null,
    emailProviderId: order.emailProviderId,
    emailLastError: order.emailLastError,
    attempts: order.attempts,
    lastError: order.lastError,
    codes: order.codes,
  };
}
