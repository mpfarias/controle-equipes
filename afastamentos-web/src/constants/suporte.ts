/** URL do sistema de chamados (GLPI, ServiceNow, etc.). Defina em `.env`: `VITE_URL_ABRIR_CHAMADO`. */
export function getUrlAbrirChamado(): string | undefined {
  const raw = import.meta.env.VITE_URL_ABRIR_CHAMADO;
  if (typeof raw !== 'string') return undefined;
  const u = raw.trim();
  return u.length > 0 ? u : undefined;
}
