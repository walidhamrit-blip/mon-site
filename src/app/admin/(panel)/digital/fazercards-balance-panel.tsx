import { CircleAlert, Landmark, TriangleAlert } from "lucide-react";
import type { FazercardsBalanceStatus } from "@/lib/fazercards-balance";

/**
 * Couverture du plafond de vente par le solde du fournisseur.
 *
 * Panneau volontairement en lecture seule : aucun virement, aucun achat.
 * Il répond à une seule question — « puis-je honorer la vente la plus chère
 * que ma caisse accepte ? » — et affiche la recharge conseillée.
 *
 * ⚠️ Ce composant est rendu exclusivement dans l'administration : le solde ne
 * doit jamais apparaître sur une page publique.
 */
export function FazercardsBalancePanel({ status }: { status: FazercardsBalanceStatus }) {
  const { assessment, error, fetchedAt } = status;

  const palette =
    assessment.level === "ok"
      ? { box: "border-emerald-300 bg-emerald-50", text: "text-emerald-900" }
      : assessment.level === "low"
        ? { box: "border-amber-300 bg-amber-50", text: "text-amber-900" }
        : { box: "border-red-300 bg-red-50", text: "text-red-800" };

  const title =
    assessment.level === "ok"
      ? "Solde fournisseur : couvre tout le plafond de vente"
      : assessment.level === "low"
        ? "Solde fournisseur : couvre seulement une partie du plafond"
        : assessment.level === "critical"
          ? "Solde fournisseur : insuffisant pour le plafond de vente"
          : "Solde fournisseur : illisible";

  const Icon =
    assessment.level === "ok" ? Landmark : assessment.level === "low" ? TriangleAlert : CircleAlert;

  return (
    <div className={`rounded-2xl border px-4 py-3 ${palette.box}`}>
      <p className={`inline-flex items-center gap-2 text-[13.5px] font-black ${palette.text}`}>
        <Icon className="h-4 w-4" />
        {title}
      </p>

      <div className="mt-2 grid gap-x-6 gap-y-1 text-[12px] leading-5 sm:grid-cols-2 lg:grid-cols-4">
        <p className={palette.text}>
          <span className="font-bold">Solde lu :</span>{" "}
          {assessment.balanceUsd != null ? `${assessment.balanceUsd.toFixed(2)} $` : "—"}
        </p>
        <p className={palette.text}>
          <span className="font-bold">Plafond de vente :</span>{" "}
          {assessment.maxOrderUsd.toFixed(2)} $
        </p>
        <p className={palette.text}>
          <span className="font-bold">Coût fournisseur du plafond :</span>{" "}
          {assessment.costCeilingUsd.toFixed(2)} $
        </p>
        <p className={palette.text}>
          <span className="font-bold">Vente encore payable :</span>{" "}
          {assessment.coveredSaleUsd != null ? `${assessment.coveredSaleUsd.toFixed(2)} $` : "—"}
        </p>
      </div>

      <p className={`mt-2 text-[12px] leading-5 ${palette.text}`}>{assessment.summary}</p>

      {assessment.recommendedTopUpUsd > 0 && (
        <p className={`mt-1 text-[12px] leading-5 ${palette.text}`}>
          <span className="font-bold">Recharge conseillée :</span>{" "}
          {assessment.recommendedTopUpUsd.toFixed(2)} $ (marge de sécurité incluse) — à créditer
          dans le hub fournisseur, puis{" "}
          <span className="font-bold">redéployer si vous changez le plafond</span>.
        </p>
      )}

      <p className={`mt-1 text-[11.5px] leading-5 ${palette.text}`}>
        Le solde est débité du <span className="font-bold">coût fournisseur</span>, jamais du prix
        de vente : un plafond de vente haut avec un solde bas fait encaisser des commandes
        impossibles à honorer. Alerte e-mail quotidienne si le plafond n&apos;est plus couvert
        (variable <code>FAZERCARDS_BALANCE_ALERT_RESEND_HOURS</code> pour l&apos;espacement).
      </p>

      {error && (
        <p className={`mt-1 text-[11.5px] leading-5 ${palette.text}`}>
          <span className="font-bold">Erreur de lecture :</span> {error}
        </p>
      )}

      <p className={`mt-1 text-[11px] ${palette.text} opacity-80`}>
        {fetchedAt ? `Solde lu le ${new Date(fetchedAt).toLocaleString("fr-FR")}.` : "Solde non lu."}{" "}
        Cette information reste interne : elle n&apos;est jamais exposée sur une route publique.
      </p>
    </div>
  );
}
