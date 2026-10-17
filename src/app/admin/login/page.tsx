import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");

  const configured = Boolean(process.env.ADMIN_PASSWORD);

  return (
    <div dir="ltr" className="min-h-screen bg-[#0A0A0F] grid place-items-center px-4">
      <div className="w-full max-w-[420px]">
        <div className="text-center">
          <div className="h-14 w-14 rounded-2xl bg-[#C6A664] text-black grid place-items-center font-black text-2xl mx-auto">
            N
          </div>
          <h1 className="mt-4 text-2xl font-black text-white">Panneau d’administration</h1>
          <p className="mt-1 text-sm text-zinc-500">Nukhba — accès réservé</p>
        </div>

        {!configured && (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <strong className="font-bold">Variable manquante :</strong> ajoutez{" "}
            <code className="px-1.5 py-0.5 rounded bg-black/30">ADMIN_PASSWORD</code> dans
            Vercel (Settings → Environment Variables), puis redéployez le projet.
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-white/10 bg-[#121218] p-6 shadow-2xl">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-zinc-500 hover:text-white transition-colors">
            ← Retour au site
          </Link>
        </p>
      </div>
    </div>
  );
}
