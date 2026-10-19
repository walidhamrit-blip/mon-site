"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME_ID, isThemeId } from "@/lib/themes";

// Deux réglages indépendants :
//  - `palette` : le thème de couleurs (or, bleu, زمردي...) — 8 thèmes.
//  - `mode`    : clair ou sombre — piloté par UN BOUTON DÉDIÉ (barre du haut).
// Chaque thème existe en version claire ET en version sombre : les deux
// notions sont donc totalement séparées, comme demandé.
// L'admin choisit l'apparence PRINCIPALE (thème + mode) depuis /admin →
// Réglages ; elle sert de défaut aux visiteurs qui n'ont pas encore choisi.

export type ThemeMode = "light" | "dark";

const MODE_KEY = "nukhba-mode";
const PALETTE_KEY = "nukhba-palette";
// Ancienne clé : elle stockait le mode clair/sombre avant l'arrivée des thèmes.
const LEGACY_MODE_KEY = "nukhba-theme";

interface ThemeContextValue {
  /** Mode d'affichage — clair ou sombre (bouton dédié). */
  mode: ThemeMode;
  /** Thème de couleurs appliqué. */
  palette: string;
  setPalette: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
  /** Bascule clair ⇄ sombre (bouton dédié). */
  toggle: () => void;
}

const ThemeCtx = createContext<ThemeContextValue | null>(null);

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
  const [palette, setPaletteState] = useState<string>(
    isThemeId(defaultPalette) ? (defaultPalette as string) : DEFAULT_THEME_ID,
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Priorité : choix mémorisé du visiteur > apparence principale (admin)
    // > préférence système.
    const savedMode = localStorage.getItem(MODE_KEY) ?? localStorage.getItem(LEGACY_MODE_KEY);
    if (savedMode === "dark" || savedMode === "light") {
      setModeState(savedMode);
    } else if (defaultMode === "dark" || defaultMode === "light") {
      setModeState(defaultMode);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setModeState(prefersDark ? "dark" : "light");
    }

    const savedPalette = localStorage.getItem(PALETTE_KEY);
    if (isThemeId(savedPalette)) setPaletteState(savedPalette);
    else setPaletteState(isThemeId(defaultPalette) ? (defaultPalette as string) : DEFAULT_THEME_ID);
  }, [defaultMode, defaultPalette]);

  // Application sur <html> : l'attribut data-theme choisit la palette,
  // la classe .dark choisit le mode (clair / sombre).
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.setAttribute("data-theme", palette);
    localStorage.setItem(MODE_KEY, mode);
    localStorage.setItem(PALETTE_KEY, palette);
  }, [mode, palette, mounted]);

  const setPalette = (id: string) => setPaletteState(isThemeId(id) ? id : DEFAULT_THEME_ID);
  const setMode = (next: ThemeMode) => setModeState(next);
  const toggle = () => setModeState((t) => (t === "light" ? "dark" : "light"));

  return (
    <ThemeCtx.Provider value={{ mode, palette, setPalette, setMode, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme missing");
  return ctx;
}
