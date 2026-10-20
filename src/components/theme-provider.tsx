"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { DEFAULT_THEME_ID, isThemeId } from "@/lib/themes";

// Deux réglages indépendants :
//  - `palette` : le thème de couleurs (or, bleu, émeraude...) — 8 thèmes.
//  - `mode`    : clair ou sombre — piloté par UN BOUTON DÉDIÉ (barre du haut).
// Chaque thème existe en version claire ET en version sombre : les deux
// notions sont donc totalement séparées, comme demandé.
// L'admin choisit l'apparence PRINCIPALE (thème + mode) depuis /admin →
// Réglages ; elle sert de défaut aux visiteurs qui n'ont pas encore choisi.
//
// ⚠️ Règle de persistance (correctif) : seuls les choix EXPLICITES du
// visiteur (boutons thème / mode du site) sont écrits dans localStorage.
// Le défaut hérité de l'admin n'est JAMAIS enregistré : sinon, dès la
// première visite, le navigateur « mémorise » l'ancien défaut et tout
// nouveau réglage admin reste sans effet sur cet appareil (le choix
// mémorisé ayant la priorité). Pour la même raison, les clés ont été
// renommées (`-choice`) : les anciennes entrées, écrites automatiquement
// sans action du visiteur, sont ignorées et nettoyées.

export type ThemeMode = "light" | "dark";

const MODE_KEY = "nukhba-mode-choice";
const PALETTE_KEY = "nukhba-palette-choice";
// Anciennes clés : elles étaient écrites automatiquement à chaque visite
// (y compris pour le simple défaut admin) — elles ne prouvent donc pas un
// choix du visiteur et ne doivent plus être lues.
const LEGACY_KEYS = ["nukhba-mode", "nukhba-palette", "nukhba-theme"];

interface ThemeContextValue {
  /** Mode d'affichage — clair ou sombre (bouton dédié). */
  mode: ThemeMode;
  /** Thème de couleurs appliqué. */
  palette: string;
  setPalette: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
  /** Bascule clair ⇄ sombre (bouton dédié). */
  toggle: () => void;
  /**
   * Oublie le choix explicite mémorisé sur CET appareil et applique
   * l'apparence donnée (utilisé après l'enregistrement des réglages admin,
   * pour que le navigateur de l'admin reflète immédiatement le nouveau
   * défaut au lieu de garder son ancien choix personnel).
   */
  resetToSiteDefaults: (mode: ThemeMode, palette: string) => void;
}

const ThemeCtx = createContext<ThemeContextValue | null>(null);

function validPalette(id: string | null | undefined): string {
  return isThemeId(id) ? (id as string) : DEFAULT_THEME_ID;
}

export function ThemeProvider({
  children,
  defaultMode,
  defaultPalette,
}: {
  children: React.ReactNode;
  /** Mode principal choisi dans l'admin (défaut des visiteurs sans choix mémorisé). */
  defaultMode?: ThemeMode;
  /** Thème principal choisi dans l'admin (défaut des visiteurs sans choix mémorisé). */
  defaultPalette?: string;
}) {
  const [mode, setModeState] = useState<ThemeMode>(defaultMode ?? "light");
  const [palette, setPaletteState] = useState<string>(validPalette(defaultPalette));
  const [mounted, setMounted] = useState(false);
  // Le visiteur a-t-il fait un choix explicite (boutons du site) ?
  // Si non, l'apparence suit toujours le défaut admin courant — y compris
  // quand l'admin le modifie après coup.
  const explicitMode = useRef(false);
  const explicitPalette = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    // Nettoyage des anciennes clés auto-écrites (voir en-tête du fichier).
    try {
      for (const key of LEGACY_KEYS) localStorage.removeItem(key);
    } catch {
      /* localStorage indisponible */
    }
    // Priorité : choix explicite mémorisé du visiteur > apparence
    // principale (admin) > préférence système.
    let savedMode: string | null = null;
    let savedPalette: string | null = null;
    try {
      savedMode = localStorage.getItem(MODE_KEY);
      savedPalette = localStorage.getItem(PALETTE_KEY);
    } catch {
      /* localStorage indisponible */
    }

    if (savedMode === "dark" || savedMode === "light") {
      explicitMode.current = true;
      setModeState(savedMode);
    } else {
      explicitMode.current = false;
      if (defaultMode === "dark" || defaultMode === "light") {
        setModeState(defaultMode);
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setModeState(prefersDark ? "dark" : "light");
      }
    }

    if (isThemeId(savedPalette)) {
      explicitPalette.current = true;
      setPaletteState(savedPalette);
    } else {
      explicitPalette.current = false;
      setPaletteState(validPalette(defaultPalette));
    }
  }, [defaultMode, defaultPalette]);

  // Application sur <html> : l'attribut data-theme choisit la palette,
  // la classe .dark choisit le mode (clair / sombre).
  // ⚠️ Aucune écriture localStorage ici : enregistrer l'état courant
  // reviendrait à transformer le défaut admin en faux « choix du
  // visiteur », qui écraserait ensuite tout nouveau réglage admin.
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.setAttribute("data-theme", palette);
  }, [mode, palette, mounted]);

  const persist = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* localStorage indisponible */
    }
  };

  const setPalette = (id: string) => {
    const next = validPalette(id);
    explicitPalette.current = true;
    persist(PALETTE_KEY, next);
    setPaletteState(next);
  };
  const setMode = (next: ThemeMode) => {
    explicitMode.current = true;
    persist(MODE_KEY, next);
    setModeState(next);
  };
  const toggle = () => setMode(mode === "light" ? "dark" : "light");

  const resetToSiteDefaults = (nextMode: ThemeMode, nextPalette: string) => {
    explicitMode.current = false;
    explicitPalette.current = false;
    try {
      localStorage.removeItem(MODE_KEY);
      localStorage.removeItem(PALETTE_KEY);
    } catch {
      /* localStorage indisponible */
    }
    setModeState(nextMode === "dark" ? "dark" : "light");
    setPaletteState(validPalette(nextPalette));
  };

  return (
    <ThemeCtx.Provider
      value={{ mode, palette, setPalette, setMode, toggle, resetToSiteDefaults }}
    >
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme missing");
  return ctx;
}
