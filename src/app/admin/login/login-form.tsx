"use client";
import { useActionState, useState } from "react";
import { Loader2, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { login, type ActionResult } from "@/app/admin/actions";

const initialState: ActionResult = { ok: false };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-zinc-300">
          Mot de passe
        </label>
        <div className="relative mt-2">
          <Lock className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoFocus
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-12 w-full ps-10 pe-12 rounded-2xl border border-white/10 bg-black/40 text-white outline-none focus:border-[#C6A664] transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {state.error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-2xl bg-[#C6A664] text-black font-bold inline-flex items-center justify-center gap-2 hover:bg-[#B89652] transition-colors disabled:opacity-60 cursor-pointer"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Connexion…
          </>
        ) : (
          "Se connecter"
        )}
      </button>

      <p className="text-xs text-zinc-600 text-center">
        Session sécurisée valable 7 jours.
      </p>
    </form>
  );
}
