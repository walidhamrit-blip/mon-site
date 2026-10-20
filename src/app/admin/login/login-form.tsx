"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { login, type ActionResult } from "@/app/admin/actions";

const initialState: ActionResult = { ok: false };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="password"
          className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2"
        >
          Mot de passe administrateur
        </label>
        <div className="relative">
          <Lock className="h-4 w-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            placeholder="••••••••••••"
            className="w-full h-11 rounded-xl bg-[#FAF9F6] border border-stone-300 pl-10 pr-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-[#B8923F] focus:ring-2 focus:ring-[#C6A664]/20"
          />
        </div>
      </div>

      {state.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full h-11 rounded-xl bg-stone-900 text-white font-semibold text-sm hover:bg-stone-800 disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
      >
        {pending ? "Connexion en cours…" : "Accéder au panneau"}
      </button>
    </form>
  );
}
