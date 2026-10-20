import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <div
      style={{ colorScheme: "light" }}
      className="min-h-screen bg-[#F6F5F1] text-stone-900 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-stone-200/90 bg-white p-8 shadow-[0_12px_40px_rgba(28,25,23,0.06)]">
          <div className="text-center mb-7">
            <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-[#C6A664]/15 border border-[#C6A664]/35 text-[#8A6D2F] grid place-items-center text-xl font-black">
              ن
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-medium mb-3">
              <ShieldCheck className="h-3.5 w-3.5 text-[#9A7B38]" />
              Administration sécurisée
            </div>
            <h1 className="text-2xl font-black tracking-tight text-stone-900">
              Espace Nukhba
            </h1>
            <p className="mt-1.5 text-sm text-stone-500">
              Gérez vos sections, sites, applications, tarifs et demandes clients.
            </p>
          </div>

          <LoginForm />
        </div>

        <p className="mt-5 text-center text-xs text-stone-500">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 hover:text-stone-900 font-medium transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour au site public
          </Link>
        </p>
      </div>
    </div>
  );
}
