import type { UserRole } from "@prisma/client";

export type NavItem = { href: string; label: string; description?: string };

/** Navegação principal — COPOM Mulher PMDF (sistema web). */
export function navItemsForRole(role: UserRole): NavItem[] {
  const dash: NavItem = {
    href: "/app/dashboard",
    label: "Painel BI",
    description: "Gráficos a partir do PostgreSQL (cadastros e importações já gravadas)",
  };
  const occ: NavItem = {
    href: "/app/ocorrencias",
    label: "Ocorrências",
    description: "Violência doméstica — cadastro em 3 fases",
  };
  const centralVitima: NavItem = {
    href: "/app/central-vitima",
    label: "Central app vítima",
    description: "Cadastros e pânicos por telefone; encaminhamento e finalização",
  };
  const pwd: NavItem = {
    href: "/app/alterar-senha-primeiro-acesso",
    label: "Alterar senha",
    description: "Atualize a sua senha sempre que necessário",
  };
  const aud: NavItem = { href: "/app/auditoria", label: "Auditoria", description: "Quem fez o quê" };
  const usr: NavItem = { href: "/app/usuarios", label: "Utilizadores", description: "Administração de contas" };
  const imp: NavItem = {
    href: "/app/admin/importar-excel",
    label: "Importar Excel",
    description: "Sob pedido — grava no PostgreSQL (substituir linhas de importação anterior)",
  };

  if (role === "CONSULTA") {
    return [dash, occ, pwd];
  }
  if (role === "ATENDENTE") {
    return [dash, occ, centralVitima, aud, pwd];
  }
  return [dash, occ, centralVitima, aud, usr, imp, pwd];
}
