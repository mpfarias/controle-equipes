"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AlterarSenhaPrimeiroAcessoForm({ firstAccess = false }: { firstAccess?: boolean }) {
  const router = useRouter();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaNova2, setSenhaNova2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (senhaNova !== senhaNova2) {
      setError("As novas senhas não coincidem.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ senhaAtual, senhaNova }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Não foi possível alterar a senha.");
        return;
      }
      router.replace("/app/dashboard");
      router.refresh();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4">
      <p className="text-sm leading-relaxed text-slate-600">
        {firstAccess ? (
          <>
            Utilizou uma senha provisória (por exemplo <span className="font-mono text-slate-800">123456</span>). Defina a
            sua nova senha para continuar.
          </>
        ) : (
          <>Informe a senha atual e defina uma nova senha quando quiser.</>
        )}
      </p>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Senha atual</label>
        <input
          type="password"
          autoComplete="current-password"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none ring-violet-500/30 focus:ring-2"
          value={senhaAtual}
          onChange={(ev) => setSenhaAtual(ev.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nova senha</label>
        <input
          type="password"
          autoComplete="new-password"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none ring-violet-500/30 focus:ring-2"
          value={senhaNova}
          onChange={(ev) => setSenhaNova(ev.target.value)}
          minLength={6}
          required
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Confirmar nova senha</label>
        <input
          type="password"
          autoComplete="new-password"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none ring-violet-500/30 focus:ring-2"
          value={senhaNova2}
          onChange={(ev) => setSenhaNova2(ev.target.value)}
          minLength={6}
          required
        />
      </div>
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "A guardar…" : "Guardar nova senha"}
      </button>
    </form>
  );
}
