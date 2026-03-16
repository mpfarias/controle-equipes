/**
 * Formata data para pt-BR. Para strings ISO ou YYYY-MM-DD, usa o dia civil
 * (ano-mês-dia) para evitar que meia-noite UTC apareça como dia anterior no Brasil.
 */
export function formatDate(value?: string | null): string {
  if (!value) {
    return '—';
  }

  const str = String(value);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    const year = parseInt(y!, 10);
    const month = parseInt(m!, 10) - 1;
    const day = parseInt(d!, 10);
    const date = new Date(year, month, day);
    return new Intl.DateTimeFormat('pt-BR').format(date);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

/** Extrai ano/mês/dia como dia civil de string YYYY-MM-DD ou ISO, evitando deslocamento por fuso. */
function parseDatePart(value: string): { y: number; m: number; d: number } {
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return { y: parseInt(m[1], 10), m: parseInt(m[2], 10) - 1, d: parseInt(m[3], 10) };
  }
  const d = new Date(value);
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
}

export function calcularDiasEntreDatas(dataInicio: string, dataFim?: string | null): number {
  if (!dataFim) {
    return 0;
  }
  const ini = parseDatePart(dataInicio);
  const f = parseDatePart(dataFim);
  const inicio = new Date(ini.y, ini.m, ini.d);
  const fim = new Date(f.y, f.m, f.d);
  inicio.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(fim.getTime() - inicio.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir o dia inicial
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
 * Formata matrícula com pontos a cada 3 dígitos e barra antes do último.
 * Ex.: 65210 → 6.521/0, 1966901 → 196.690/1, 21975684 → 2.197.568/4
 * Aceita X como último caractere: 12345X → 12.345/X
 */
export function formatMatricula(value: string | null | undefined): string {
  if (!value) return '';
  const str = String(value).trim();
  if (str.length <= 1) return str;
  const last = str.slice(-1);
  const rest = str.slice(0, -1);
  // Resto deve ser só dígitos; último pode ser dígito ou X
  if (!/^\d+$/.test(rest)) return str;
  const lastDisplay = last.toUpperCase() === 'X' ? 'X' : last;
  const formatted = rest.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return formatted + '/' + lastDisplay;
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
