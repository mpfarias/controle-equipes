"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "./actions";

const initial: LoginFormState = { error: null };

type LoginUserOption = { email: string; nomeCompleto: string };

export default function LoginForm({ defaultNext, users }: { defaultNext: string; users: LoginUserOption[] }) {
  const [state, formAction, isPending] = useActionState(loginAction, initial);

  return (
    <div className="relative min-h-full overflow-hidden bg-[#06060f]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/80 via-[#0a0618] to-fuchsia-950/70" />
        <div className="absolute -left-1/4 top-0 h-[60vh] w-[70vw] rounded-full bg-fuchsia-600/25 blur-[100px]" />
        <div className="absolute -right-1/4 bottom-0 h-[50vh] w-[60vw] rounded-full bg-violet-600/25 blur-[100px]" />
        <div className="absolute left-1/3 top-1/3 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px]" />
      </div>

      <div className="relative z-10 flex min-h-full items-center justify-center px-4 py-12">
        <div className="shine-border-wrap w-full max-w-md">
          <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-br from-slate-950/85 via-slate-900/70 to-slate-950/85 p-8 shadow-2xl backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0">
              <span className="shine-sweep" />
            </div>

            <div className="relative">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-lg font-bold text-white shadow-lg shadow-fuchsia-500/40 ring-1 ring-white/30">
                  CM
                </div>
                <h1 className="text-gradient-brand text-2xl font-bold tracking-tight">COPOM Mulher</h1>
                <p className="mt-1 text-sm font-medium text-slate-300">PMDF — acesso ao sistema</p>
              </div>

              <form action={formAction} className="space-y-4">
                <input type="hidden" name="next" value={defaultNext} />
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Utilizador ativo
                  </label>
                  <select
                    className="input-glass mt-1.5"
                    name="email"
                    autoComplete="username"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Selecione o utilizador
                    </option>
                    {users.map((u) => (
                      <option key={u.email} value={u.email}>
                        {u.nomeCompleto}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Senha</label>
                  <input
                    className="input-glass mt-1.5"
                    type="password"
                    name="senha"
                    autoComplete="current-password"
                    placeholder="•••"
                    required
                  />
                </div>
                {state.error ? <p className="text-sm font-medium text-rose-300">{state.error}</p> : null}
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-aurora relative z-[1] mt-2 w-full disabled:cursor-not-allowed"
                >
                  {isPending ? "Entrando…" : "Entrar"}
                </button>
              </form>

              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-[11px] leading-relaxed text-slate-400">
                <p className="font-semibold text-slate-300">Três perfis</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li>
                    <span className="font-mono text-slate-300">ADMINISTRADOR</span> — utilizadores, auditoria, importação
                    Excel, ocorrências.
                  </li>
                  <li>
                    <span className="font-mono text-slate-300">ATENDENTE</span> — cadastro e gestão de ocorrências,
                    auditoria.
                  </li>
                  <li>
                    <span className="font-mono text-slate-300">CONSULTA</span> — painel BI e consulta de ocorrências.
                  </li>
                </ul>
                <p className="mt-3 text-center text-slate-500">
                  Login no servidor (sessão segura). Utilizador <span className="font-mono text-slate-400">rafael</span>{" "}
                  + senha definida pelo administrador.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
