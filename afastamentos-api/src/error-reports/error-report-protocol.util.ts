import { ErrorReportCategoria } from '@prisma/client';

/** Código de 2 dígitos da categoria no protocolo (01–04). */
export const PROTOCOLO_CODIGO_CATEGORIA: Record<ErrorReportCategoria, string> = {
  ERRO_SISTEMA: '01',
  DUVIDA: '02',
  MELHORIA: '03',
  OUTRO: '04',
};

const TZ_BR = 'America/Sao_Paulo';

/** Partes da data corrente em Brasília (para compor o protocolo; sequência usa o ano). */
export function partesDataBrasilia(d: Date): {
  yyyy: string;
  mm: string;
  dd: string;
  diaRef: string;
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  const yyyy = parts.find((p) => p.type === 'year')?.value ?? '';
  const mm = parts.find((p) => p.type === 'month')?.value ?? '';
  const dd = parts.find((p) => p.type === 'day')?.value ?? '';
  if (!yyyy || !mm || !dd) {
    throw new Error('Falha ao formatar data do protocolo.');
  }
  return { yyyy, mm, dd, diaRef: `${yyyy}-${mm}-${dd}` };
}

/**
 * Monta o número de protocolo com 15 dígitos:
 * AAAA + CC (categoria) + MM + DD + SSSSS (ordem no ano civil; reinicia em 01/01).
 */
export function montarProtocolo(
  yyyy: string,
  codigoCategoria: string,
  mm: string,
  dd: string,
  sequencialNoAno: number,
): string {
  if (sequencialNoAno < 1 || sequencialNoAno > 99_999) {
    throw new Error('Limite anual de protocolos excedido.');
  }
  const seq = String(sequencialNoAno).padStart(5, '0');
  const s = `${yyyy}${codigoCategoria}${mm}${dd}${seq}`;
  if (s.length !== 15 || !/^\d{15}$/.test(s)) {
    throw new Error('Protocolo gerado em formato inválido.');
  }
  return s;
}
