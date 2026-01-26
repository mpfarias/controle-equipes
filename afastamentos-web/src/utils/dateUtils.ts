export function formatDate(value?: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pt-BR').format(date);
}

export function calcularDiasEntreDatas(dataInicio: string, dataFim?: string | null): number {
  if (!dataFim) {
    return 0;
  }
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  inicio.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(fim.getTime() - inicio.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir o dia inicial
  return diffDays;
}

export function formatPeriodo(dataInicio: string, dataFim?: string | null): string {
  const dataInicioFormatada = formatDate(dataInicio);
  const dataFimFormatada = formatDate(dataFim);
  const dias = calcularDiasEntreDatas(dataInicio, dataFim);
  
  if (!dataFim) {
    return `${dataInicioFormatada} (em aberto)`;
  }
  
  return `${dataInicioFormatada} — ${dataFimFormatada} (${dias} ${dias === 1 ? 'dia' : 'dias'})`;
}

/**
 * Formata um nome para ter apenas a primeira letra maiúscula
 * Exemplo: "FÉRIAS" -> "Férias", "MOTORISTA DE DIA" -> "Motorista de dia"
 */
export function formatNome(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }
  // Converter para minúsculas primeiro
  const lowercased = trimmed.toLowerCase();
  // Primeira letra maiúscula
  return lowercased.charAt(0).toUpperCase() + lowercased.slice(1);
}
