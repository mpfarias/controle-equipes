"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AmbientBackground } from "./AmbientBackground";
import { navItemsForRole } from "@/lib/nav-copom";

type Role = "ADMINISTRADOR" | "ATENDENTE" | "CONSULTA";

export type AppShellUser = {
  nomeCompleto: string;
  email: string;
  role: Role;
  mustChangePassword?: boolean;
};

type Me = AppShellUser;

function navLinkClass(active: boolean) {
  if (active) {
    return "block rounded-xl px-3 py-2.5 text-sm font-semibold text-white bg-white/15 ring-1 ring-white/25 shadow-[0_0_20px_-4px_rgba(236,72,153,0.45)] backdrop-blur-sm transition";
  }
  return "block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-200/85 hover:bg-white/10 hover:text-white transition";
}

function pathActive(pathname: string, href: string) {
  if (href === "/app/ocorrencias") {
    return pathname === href || pathname.startsWith("/app/ocorrencias/");
  }
  if (href === "/app/central-vitima") {
    return pathname === href || pathname.startsWith("/app/central-vitima/");
  }
  if (href.startsWith("/app/admin")) {
    return pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith("/app/admin/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  initialUser = null,
  minimalNav = false,
}: {
  children: React.ReactNode;
  initialUser?: AppShellUser | null;
  /** Sem menu lateral até o utilizador sair do fluxo de senha provisória. */
  minimalNav?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(initialUser ?? null);

  useEffect(() => {
    setMe(initialUser ?? null);
  }, [initialUser?.email, initialUser?.role, initialUser?.nomeCompleto]);

  useEffect(() => {
    if (initialUser != null) return;
    const q = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${q}`);
  }, [initialUser, pathname, router]);

  const links = useMemo(() => (me && !minimalNav ? navItemsForRole(me.role) : []), [me, minimalNav]);

  async function logout() {
    // Navegação completa garante processamento do Set-Cookie de logout.
    window.location.assign("/api/auth/logout?next=/login");
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <AmbientBackground />
      <div className="relative z-0 flex h-full min-h-0 flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-stretch lg:gap-5 lg:p-6">
        <aside className="glass-nav shrink-0 lg:sticky lg:top-0 lg:max-h-full lg:w-72 lg:self-start lg:overflow-y-auto">
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="shine-sweep" />
          </div>
          <div className="relative flex flex-col items-center gap-3 px-4 py-4 text-center lg:block">
            <div className="w-full max-w-xs text-balance lg:max-w-none">
              <div className="text-sm font-bold tracking-tight text-white">COPOM Mulher</div>
              <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-fuchsia-200/90">
                PMDF · sistema web
              </div>
              <p className="mt-2 text-[11px] leading-snug text-slate-300/90">
                {minimalNav
                  ? "Defina a sua nova senha para aceder ao restante do sistema."
                  : "Ocorrências de violência doméstica contra mulheres, perfis de acesso e auditoria."}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="w-full max-w-xs shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 shadow-sm backdrop-blur-sm transition hover:border-white/25 hover:bg-white/10 lg:mt-4 lg:max-w-none lg:w-full"
            >
              Sair
            </button>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1.5 lg:px-3 lg:pb-5">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={navLinkClass(pathActive(pathname, l.href))} prefetch={false}>
                <span className="block">{l.label}</span>
                {l.description ? (
                  <span className="mt-0.5 block text-[10px] font-normal leading-tight text-slate-300/80">{l.description}</span>
                ) : null}
              </Link>
            ))}
          </nav>
          {me ? (
            <div className="hidden border-t border-white/10 px-4 py-4 text-center text-xs text-slate-300 lg:block">
              <div className="font-semibold text-white">{me.nomeCompleto}</div>
              <div className="mt-1 break-words text-slate-400">{me.email}</div>
              <div className="mt-2 inline-block rounded-lg bg-white/10 px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wide text-fuchsia-100">
                {me.role}
              </div>
            </div>
          ) : null}
        </aside>

        <main className="glass-panel--soft relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-3xl p-4 sm:p-6 lg:min-h-0 lg:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="relative z-20 w-full min-w-0 text-slate-900">{children}</div>
        </main>
      </div>
    </div>
  );
}
