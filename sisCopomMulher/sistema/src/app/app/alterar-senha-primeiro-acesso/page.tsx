import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { AlterarSenhaPrimeiroAcessoForm } from "./alterar-senha-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AlterarSenhaPrimeiroAcessoPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login?next=/app/alterar-senha-primeiro-acesso");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Definir nova senha</h1>
      <p className="mt-1 text-sm text-slate-500">
        {session.mustChangePassword ? "Primeiro acesso — senha provisória" : "Segurança da conta"}
      </p>
      <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <AlterarSenhaPrimeiroAcessoForm firstAccess={session.mustChangePassword} />
      </div>
    </div>
  );
}
