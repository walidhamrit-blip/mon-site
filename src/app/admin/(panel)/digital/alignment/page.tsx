import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { siteConfig } from "@/lib/config";
import { getAdminBoutiqueCatalog } from "@/lib/digital-store";
import {
  alignPrice,
  netMarginUsd,
  summariseAlignment,
  type AlignmentOptions,
  type AlignmentResult,
} from "@/lib/competitor-pricing";
import { benchmarkForDenomination } from "@/lib/competitor-prices";
import {
  readAlignmentLog,
  recordAlignmentSnapshot,
} from "@/lib/competitor-alignment-log";
import { AlignmentTable, type AlignmentRow } from "./alignment-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Alignement marché — Administration",
  robots: { index: false, follow: false },
};

const money = (value: number | null | undefined) =>
  value == null ? "—" : `${value.toFixed(2)} $`;

/**
 * Écran d'alignement marché.
 *
 * Il ne modifie RIEN : il montre ce que la formule
 * (`src/lib/competitor-pricing.ts`) applique déjà au catalogue servi, et
 * journalise les changements constatés depuis le dernier relevé.
 *
 * Un prix « bloqué » n'est pas une erreur technique : c'est un montant dont
 * le marché est **sous** le plancher de rentabilité (coût + frais + profit
 * minimal). La décision est commerciale : bundle, délistage, ou renégociation
 * du coût fournisseur.
 */
export default async function AdminAlignmentPage() {
  const catalog = await getAdminBoutiqueCatalog();
  const options: AlignmentOptions = {
    ...siteConfig.pricingAlignment,
    lockedProductIds: siteConfig.pricingAlignment.lockedProductIds ?? [],
  };
  const locked = new Set(options.lockedProductIds ?? []);

  const rows: AlignmentRow[] = [];
  const results: AlignmentResult[] = [];

  for (const product of catalog.products) {
    const base = catalog.baseById[product.id] ?? product;
    const title = product.titleEn || product.titleAr || product.slug;
    for (const denomination of product.denominations) {
      const baseDenom =
        base.denominations.find((item) => item.id === denomination.id) ?? denomination;
      const benchmark = benchmarkForDenomination(product.platform, baseDenom);
      const computed = alignPrice(
        {
          currentUsd: baseDenom.priceUsd,
          costUsd: baseDenom.supplierCostUsd ?? denomination.supplierCostUsd ?? null,
          benchmark,
        },
        options,
      );
      const result: AlignmentResult = locked.has(product.id)
        ? { ...computed, status: "locked", recommendedUsd: null }
        : computed;
      results.push(result);

      const cost = baseDenom.supplierCostUsd ?? denomination.supplierCostUsd ?? null;
      const margin = netMarginUsd(denomination.priceUsd, cost, options);

      rows.push({
        key: `${product.id}:${denomination.id}`,
        product: title,
        platform: product.platform,
        denomination: denomination.label || denomination.faceValue,
        region: denomination.region,
        catalogUsd: Number.isFinite(baseDenom.priceUsd) ? baseDenom.priceUsd : null,
        servedUsd: denomination.priceUsd,
        costUsd: cost ?? null,
        benchmarkUsd: result.benchmark?.usd ?? null,
        channel: result.benchmark?.channel ?? null,
        observedAt: result.benchmark?.observedAt ?? null,
        confidence: result.benchmark?.confidence ?? null,
        targetUsd: result.targetUsd,
        floorUsd: result.floorUsd,
        status: result.status,
        currentVsBenchmarkPercent: result.currentVsBenchmarkPercent,
        netMarginUsd: margin,
        netMarginPercent:
          margin != null && denomination.priceUsd > 0
            ? Math.round((margin / denomination.priceUsd) * 1000) / 10
            : null,
      });
    }
  }

  const summary = summariseAlignment(results);

  // Journal : alimenté uniquement ici (jamais au rendu public).
  let log = await readAlignmentLog();
  try {
    log = await recordAlignmentSnapshot(
      rows.map((row) => ({
        product: row.product,
        denomination: `${row.denomination}${row.region ? ` · ${row.region}` : ""}`,
        servedUsd: row.servedUsd,
        benchmarkUsd: row.benchmarkUsd,
        channel: row.channel,
      })),
    );
  } catch {
    // Un journal indisponible ne doit jamais empêcher l'affichage.
  }
  const changes = log.entries.filter((entry) => Math.abs(entry.from - entry.to) > 0.004).slice(0, 20);

  const cards = [
    { label: "Montants suivis", value: summary.total, tone: "text-stone-900" },
    { label: "Alignés", value: summary.aligned, tone: "text-emerald-700" },
    { label: "Prix ajustés", value: summary.lowered + summary.raised, tone: "text-sky-700" },
    {
      label: "Marché sous plancher → marge nette 1,5 %",
      value: summary.costMargin,
      tone: "text-amber-700",
    },
    { label: "Bloqués (inchangés)", value: summary.blocked, tone: "text-rose-700" },
    {
      label: "Vendus sous le plancher",
      value: rows.filter((row) => row.floorUsd != null && row.servedUsd < row.floorUsd - 0.004).length,
      tone: "text-rose-700",
    },
    { label: "Sans référence", value: summary.noBenchmark + summary.noCost, tone: "text-stone-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/digital"
            className="mb-1 inline-flex items-center gap-1 text-[11px] font-bold text-stone-500 hover:text-stone-800"
          >
            <ArrowLeft size={12} aria-hidden /> Boutique digitale
          </Link>
          <h1 className="text-2xl font-black text-stone-900">Alignement marché</h1>
          <p className="max-w-3xl text-sm text-stone-600">
            Chaque montant est comparé à son prix de marché, puis aligné à{" "}
            <strong>−{options.undercutPercent} % sous la référence revendeur</strong>, sans jamais
            descendre sous le plancher de rentabilité (coût + frais + {money(options.minProfitUsd)}
            &nbsp;de profit), ni relever un prix au-dessus d’une valeur faciale.
          </p>
        </div>
        <div className="rounded-xl bg-stone-900 px-3 py-2 text-[11px] font-bold text-white">
          Application : {options.enabled ? "automatique" : "désactivée"}
          <div className="text-[10px] font-medium text-stone-300">
            décote {options.undercutPercent} % · frais {options.feePercent} % +{" "}
            {money(options.fixedFeeUsd)} · variation max {options.maxStepPercent} %
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-stone-200 bg-white px-3 py-2">
            <div className={`text-xl font-black tabular-nums ${card.tone}`}>{card.value}</div>
            <div className="text-[10px] uppercase tracking-wide text-stone-500">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          Les prix affichés et facturés sont ceux de la colonne <strong>Prix servi</strong> : la
          caisse relit le même catalogue, donc le montant vu est le montant payé. Une référence
          « plafond » (valeur faciale) ne fait jamais <em>monter</em> un prix — elle empêche
          seulement de vendre plus cher que la plateforme elle-même.
        </p>
        <p className="mt-1">
          Quand le marché passe <em>sous</em> le plancher, le prix est calculé à rebours pour
          laisser <strong>{options.blockedMarginPercent ?? 0} % de marge nette</strong> (décision
          du 5 novembre) : prix = (coût + frais fixes) / (1 − commission − marge). La colonne
          « Marge nette » affiche donc un montant positif, mais le prix passe alors au-dessus du
          marché — c&apos;est le prix de la rentabilité sur un petit montant.
        </p>
      </div>

      <AlignmentTable rows={rows} />

      <section className="rounded-xl border border-stone-200 bg-white">
        <header className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
          <h2 className="text-sm font-black text-stone-900">Journal des changements</h2>
          <span className="text-[10px] text-stone-500">
            {log.updatedAt ? `dernier relevé : ${new Date(log.updatedAt).toLocaleString("fr-FR")}` : "aucun relevé"}
          </span>
        </header>
        {changes.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-stone-500">
            Aucun changement de prix depuis le dernier relevé.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 text-xs">
            {changes.map((entry, index) => (
              <li key={`${entry.at}-${entry.product}-${entry.denomination}-${index}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-bold text-stone-900">
                  {entry.product} · {entry.denomination}
                </span>
                <span className="tabular-nums text-stone-600">
                  {entry.from.toFixed(2)} $ → <strong className="text-stone-900">{entry.to.toFixed(2)} $</strong>
                  {entry.channel ? ` · réf. ${entry.channel}` : ""}
                </span>
                <span className="text-[10px] text-stone-400">
                  {new Date(entry.at).toLocaleString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
