"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Check,
  ExternalLink,
  ImagePlus,
  Loader2,
  RotateCcw,
  Upload,
} from "lucide-react";
import { resetContentSection, saveContentSection } from "@/app/admin/actions";
import { defaultVisuals } from "@/lib/content";
import type {
  SiteVisualImage,
  SiteVisuals,
  VisualImageId,
} from "@/lib/site-types";
import { ADMIN_INPUT_CLS } from "../site-item-editor";

interface SlotMeta {
  id: VisualImageId;
  title: string;
  location: string;
  description: string;
  ratio: string;
  href: string;
}

const GROUPS: { title: string; description: string; slots: SlotMeta[] }[] = [
  {
    title: "Bannières principales",
    description: "Les grandes photos affichées en haut des parcours publics.",
    slots: [
      {
        id: "homeHero",
        title: "Bannière de l’accueil",
        location: "Page / · tout en haut",
        description: "Photo panoramique sans texte ni boutons incrustés.",
        ratio: "Format conseillé : 2400 × 1000 px",
        href: "/",
      },
      {
        id: "storeBanner",
        title: "Bannière de la boutique",
        location: "Page /codes · sous l’introduction",
        description: "Visuel principal du catalogue de cartes et codes digitaux.",
        ratio: "Format conseillé : 2400 × 1000 px",
        href: "/codes",
      },
      {
        id: "webBanner",
        title: "Bannière Création de sites",
        location: "Page /creation-sites · sous l’introduction",
        description: "Capture ou photo qui présente votre activité de création web.",
        ratio: "Format conseillé : 2400 × 1000 px",
        href: "/creation-sites",
      },
    ],
  },
  {
    title: "Photos des sections d’accueil",
    description: "Les trois cartes qui permettent aux visiteurs de choisir leur parcours.",
    slots: [
      {
        id: "gatewayWebsites",
        title: "Section Sites & boutiques en ligne",
        location: "Accueil · carte 1",
        description: "Visuel de la carte vers les offres de création de sites.",
        ratio: "Format conseillé : 1200 × 800 px",
        href: "/",
      },
      {
        id: "gatewayGiftCards",
        title: "Section Cartes cadeaux & clés",
        location: "Accueil · carte 2",
        description: "Visuel de la carte vers les cartes cadeaux et codes digitaux.",
        ratio: "Format conseillé : 1200 × 800 px",
        href: "/",
      },
      {
        id: "gatewayTopUps",
        title: "Section Recharges de jeux",
        location: "Accueil · carte 3",
        description: "Visuel de la carte vers les recharges et monnaies de jeux.",
        ratio: "Format conseillé : 1200 × 800 px",
        href: "/",
      },
    ],
  },
];

function cloneDefaults(): SiteVisuals {
  return Object.fromEntries(
    Object.entries(defaultVisuals).map(([id, image]) => [id, { ...image }]),
  ) as SiteVisuals;
}

function previewableSource(value: string): boolean {
  const src = value.trim();
  if (src.startsWith("/")) return !src.startsWith("//") && !src.includes("\\");
  try {
    return new URL(src).protocol === "https:";
  } catch {
    return false;
  }
}

export function VisualsEditor({ initial }: { initial: SiteVisuals }) {
  const router = useRouter();
  const [visuals, setVisuals] = useState<SiteVisuals>(initial);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState<VisualImageId[]>([]);
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "err" } | null>(null);
  const [pending, startTransition] = useTransition();

  const flash = (message: string, kind: "ok" | "err") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 4500);
  };

  const updateImage = (id: VisualImageId, patch: Partial<SiteVisualImage>) => {
    setVisuals((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
    setDirty(true);
  };

  const uploadImage = async (id: VisualImageId, file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      flash("Photo trop volumineuse : choisissez un fichier de 4 Mo maximum.", "err");
      return;
    }
    setUploading((current) => [...current, id]);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/media", { method: "POST", body });
      const result = await response.json() as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !result.ok || !result.url) {
        throw new Error(result.error || "Import impossible.");
      }
      updateImage(id, { src: result.url });
      flash("Photo importée et optimisée. Cliquez sur « Enregistrer » pour la publier.", "ok");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Import impossible.", "err");
    } finally {
      setUploading((current) => current.filter((item) => item !== id));
    }
  };

  const save = () => {
    startTransition(async () => {
      const result = await saveContentSection("visuals", visuals);
      if (result.ok) {
        setDirty(false);
        flash(result.message ?? "Photos enregistrées et publiées.", "ok");
        router.refresh();
      } else {
        flash(result.error ?? "Échec de l’enregistrement.", "err");
      }
    });
  };

  const resetAll = () => {
    if (!confirm("Restaurer toutes les photos et descriptions d’origine ?")) return;
    startTransition(async () => {
      const result = await resetContentSection("visuals");
      if (result.ok) {
        setVisuals(cloneDefaults());
        setDirty(false);
        flash("Photos d’origine restaurées.", "ok");
        router.refresh();
      } else {
        flash(result.error ?? "Réinitialisation impossible.", "err");
      }
    });
  };

  return (
    <div className="space-y-7 pb-24">
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-xl ${toast.kind === "ok" ? "bg-stone-900" : "bg-red-600"}`}
        >
          <Check className="h-4 w-4 shrink-0 text-[#E5CA87]" />
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#8A6D2F]">
            Personnalisation visuelle
          </span>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-stone-900 sm:text-3xl">
            Bannières & photos de sections
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-500">
            Remplacez les visuels fixes du site par vos propres photos. Importez un fichier ou collez une URL, vérifiez l’aperçu, puis enregistrez pour publier.
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          Voir le site <ExternalLink className="h-3.5 w-3.5 text-[#8A6D2F]" />
        </Link>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-900">
        <ImagePlus className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
        <p>
          JPG, PNG, WebP ou AVIF · 4 Mo maximum. Les imports sont convertis en WebP et conservés dans la base, donc ils restent disponibles après un déploiement. L’import seul ne publie rien : l’enregistrement ci-dessous applique toutes vos modifications.
        </p>
      </div>

      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-4">
          <div>
            <h2 className="text-base font-black text-stone-900">{group.title}</h2>
            <p className="mt-0.5 text-xs text-stone-500">{group.description}</p>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {group.slots.map((slot) => (
              <VisualCard
                key={slot.id}
                meta={slot}
                image={visuals[slot.id]}
                uploading={uploading.includes(slot.id)}
                disabled={pending}
                onChange={(patch) => updateImage(slot.id, patch)}
                onUpload={(file) => uploadImage(slot.id, file)}
                onReset={() => updateImage(slot.id, defaultVisuals[slot.id])}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="fixed bottom-4 left-4 right-4 z-30 lg:left-80 lg:right-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-300 bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
          <div className="text-xs text-stone-600" aria-live="polite">
            {uploading.length > 0 ? (
              <span className="inline-flex items-center gap-2 font-bold text-sky-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Optimisation de la photo…
              </span>
            ) : dirty ? (
              <span className="font-bold text-[#8A6D2F]">● Modifications visuelles en attente.</span>
            ) : (
              <span>Photos synchronisées avec le site public.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending || uploading.length > 0}
              onClick={resetAll}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Tout restaurer
            </button>
            <button
              type="button"
              disabled={pending || uploading.length > 0 || !dirty}
              onClick={save}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-stone-900 px-5 text-xs font-bold text-white shadow-xs hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin text-[#E5CA87]" /> : <Check className="h-4 w-4 text-[#E5CA87]" />}
              {pending ? "Publication…" : "Enregistrer & publier"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VisualCard({
  meta,
  image,
  uploading,
  disabled,
  onChange,
  onUpload,
  onReset,
}: {
  meta: SlotMeta;
  image: SiteVisualImage;
  uploading: boolean;
  disabled: boolean;
  onChange: (patch: Partial<SiteVisualImage>) => void;
  onUpload: (file: File) => Promise<void>;
  onReset: () => void;
}) {
  const preview = previewableSource(image.src) ? image.src : defaultVisuals[meta.id].src;
  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xs">
      <div className="relative aspect-[16/7] bg-stone-100">
        <Image
          key={preview}
          src={preview}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 1280px) 90vw, 540px"
          className="object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-stone-950/85 to-transparent px-4 pb-3 pt-10 text-white">
          <div>
            <h3 className="text-sm font-black">{meta.title}</h3>
            <p className="mt-0.5 text-[11px] text-white/75">{meta.location}</p>
          </div>
          <Link
            href={meta.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Voir la page de ${meta.title}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15 backdrop-blur hover:bg-white/25"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-stone-950/55 text-sm font-bold text-white backdrop-blur-sm">
            <span className="inline-flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Import & optimisation…</span>
          </div>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <p className="text-xs leading-5 text-stone-500">{meta.description}</p>
          <p className="mt-1 text-[11px] font-semibold text-stone-400">{meta.ratio}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={`upload-${meta.id}`}
            className={`inline-flex h-9 items-center gap-2 rounded-xl bg-stone-900 px-3.5 text-xs font-bold text-white ${disabled || uploading ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-stone-800"}`}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-[#E5CA87]" />}
            Importer une photo
          </label>
          <input
            id={`upload-${meta.id}`}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={disabled || uploading}
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void onUpload(file);
            }}
          />
          <button
            type="button"
            onClick={onReset}
            disabled={disabled || uploading}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Photo d’origine
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-stone-600">URL de la photo ou chemin local</span>
          <input
            dir="ltr"
            value={image.src}
            onChange={(event) => onChange({ src: event.target.value })}
            placeholder="/visuals/ma-photo.webp ou https://…"
            className={ADMIN_INPUT_CLS}
          />
          {!previewableSource(image.src) && (
            <span className="block text-[11px] font-semibold text-amber-700">URL à compléter — l’aperçu affiche temporairement la photo d’origine.</span>
          )}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">Description de l’image (arabe)</span>
            <input
              dir="rtl"
              value={image.altAr}
              onChange={(event) => onChange({ altAr: event.target.value })}
              className={ADMIN_INPUT_CLS}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-stone-600">Description de l’image (anglais)</span>
            <input
              value={image.altEn}
              onChange={(event) => onChange({ altEn: event.target.value })}
              className={ADMIN_INPUT_CLS}
            />
          </label>
        </div>
      </div>
    </article>
  );
}
