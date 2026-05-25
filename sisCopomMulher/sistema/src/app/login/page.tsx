import LoginForm from "./login-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function safeNext(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/app/dashboard";
  return raw;
}

/**
 * Login com Server Action (`actions.ts`): o cookie HttpOnly é gravado no mesmo pedido que o redirect,
 * evitando falhas de sessão típicas de `fetch` + navegação no cliente.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  const users = await prisma.user.findMany({
    where: { ativo: true },
    orderBy: { nomeCompleto: "asc" },
    select: { email: true, nomeCompleto: true },
    take: 500,
  });

  return (
    <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden" style={{ colorScheme: "dark" }}>
      <LoginForm defaultNext={next} users={users} />
    </div>
  );
}
