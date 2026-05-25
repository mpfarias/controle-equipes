import type { UserRole } from "@prisma/client";

export function podeGerenciarUsuarios(role: UserRole) {
  return role === "ADMINISTRADOR";
}

export function podeRegistrarOcorrencias(role: UserRole) {
  return role === "ADMINISTRADOR" || role === "ATENDENTE";
}

/** Listar e visualizar ocorrências (GET lista / GET por id). */
export function podeListarOcorrencias(role: UserRole) {
  return role === "ADMINISTRADOR" || role === "ATENDENTE" || role === "CONSULTA";
}

export function podeVerAuditoria(role: UserRole) {
  return role === "ADMINISTRADOR" || role === "ATENDENTE";
}

export function podeImportarExcel(role: UserRole) {
  return role === "ADMINISTRADOR";
}

export function podeVerDashboard(role: UserRole) {
  return true;
}

/** Alterar ou excluir ocorrência existente (API PATCH/DELETE). */
export function podeAdministrarOcorrencia(role: UserRole) {
  return role === "ADMINISTRADOR" || role === "ATENDENTE";
}

/** Central de telemetria / pânico do app móvel da vítima. */
export function podeVerCentralVitimaMobile(role: UserRole) {
  return role === "ADMINISTRADOR" || role === "ATENDENTE";
}
