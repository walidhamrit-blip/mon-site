import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  digitalOrderSupplier,
  listDigitalOrders,
  type AdminDigitalOrder,
} from "@/lib/digital-orders";
import { mailDiagnostics } from "@/lib/mailer";
import { storedBuyerFields, storedPlayerIdCheck } from "@/lib/fazercards-orders";
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
 * connexion fournisseur, solde marchand, commandes payées à livrer, erreurs
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
          Vente à la commande : le code est acheté chez FazerCards
          <strong> après</strong> confirmation du paiement, puis envoyé au client. Aucun
          stock n&apos;est acheté d&apos;avance.
        </p>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm">
        <p><strong>À traiter : {dbError ? "indisponible" : toDeliver}</strong> commande(s) payée(s) ou manuelle(s).</p>
        <p className="mt-2 text-stone-600">Le fournisseur actif est FazerCards. Les commandes historiques sont conservées sans achat automatique chez leur ancien fournisseur. Consultez le solde et les disponibilités dans le catalogue avant toute relance.</p>
        <Link href="/admin/digital" className="mt-3 inline-block font-bold underline">Catalogue & solde FazerCards</Link>
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
    // Résultat du contrôle d'identifiant fait à la caisse (null = antérieur).
    playerIdCheck: storedPlayerIdCheck(order),
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
