import { cache } from "react";
import { AppShell } from "@/components/AppShell";
import { getSessionFromCookies } from "@/lib/auth";

/** Evita pré-render estático com `cookies()` (erros DYNAMIC_SERVER_USAGE no `next build`). */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const getInitialShellUser = cache(async () => {
  try {
    const session = await getSessionFromCookies();
    if (!session) return null;
    return {
      nomeCompleto: session.nome,
      email: session.email,
      role: session.role,
      mustChangePassword: session.mustChangePassword === true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("Dynamic server usage") && !msg.includes("cookies")) {
      console.error("[app/layout] Falha ao ler utilizador:", e);
    }
    return null;
  }
});

export default async function AppAreaLayout({ children }: { children: React.ReactNode }) {
  const initialUser = await getInitialShellUser();
  return (
    <AppShell initialUser={initialUser} minimalNav={initialUser?.mustChangePassword === true}>
      {children}
    </AppShell>
  );
}
