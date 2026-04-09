import type { ChamadaXlsxRow } from '../types/chamadasXlsx';

const CAMPOS_DATA_HORA: (keyof ChamadaXlsxRow)[] = ['horaEntradaFila', 'horaAtendimento', 'horaDesligamento'];

/**
 * Interpreta data/hora em textos vindos do Excel (pt-BR com data, ISO, etc.).
 * Valores só com hora (sem dia) retornam null — não há como fixar o calendário.
 */
export function parseDataHoraChamada(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  let m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*,\s*|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (m) {
    const d = new Date(
      parseInt(m[3], 10),
      parseInt(m[2], 10) - 1,
      parseInt(m[1], 10),
      parseInt(m[4], 10),
      parseInt(m[5], 10),
      m[6] ? parseInt(m[6], 10) : 0,
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10), 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{1,2}:\d{2}/.test(s) && !/\d{4}/.test(s) && !/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) {
    return null;
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t);
  return null;
}

function coletarTimestamps(rows: ChamadaXlsxRow[]): Date[] {
  const out: Date[] = [];
  for (const row of rows) {
    for (const campo of CAMPOS_DATA_HORA) {
      const d = parseDataHoraChamada(row[campo]);
      if (d) out.push(d);
    }
  }
  return out;
}

function formatarSóData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export type ResumoPeriodoChamadas = {
  /** Texto para título: uma data ou "dd/mm/aaaa a dd/mm/aaaa". */
  textoPeriodo: string;
  /** true se houve ao menos um carimbo com data nas colunas de horário. */
  identificado: boolean;
};

/**
 * Define o texto do período:
 * - Uma data se todas as ocorrências caem no mesmo dia local e o intervalo é &lt; 24 h.
 * - Duas datas se cruza meia-noite (dias distintos) ou o intervalo entre menor e maior instante é ≥ 24 h.
 */
export function resumoPeriodoDatasChamadas(rows: ChamadaXlsxRow[]): ResumoPeriodoChamadas {
  const ts = coletarTimestamps(rows);
  if (ts.length === 0) {
    return { textoPeriodo: '', identificado: false };
  }
  const minT = Math.min(...ts.map((d) => d.getTime()));
  const maxT = Math.max(...ts.map((d) => d.getTime()));
  const min = new Date(minT);
  const max = new Date(maxT);

  const mesmoDiaCalendario =
    min.getFullYear() === max.getFullYear() &&
    min.getMonth() === max.getMonth() &&
    min.getDate() === max.getDate();

  const spanMs = maxT - minT;
  const vinteQuatroHoras = 24 * 60 * 60 * 1000;
  const precisaDuasDatas = !mesmoDiaCalendario || spanMs >= vinteQuatroHoras;

  if (!precisaDuasDatas) {
    return { textoPeriodo: formatarSóData(min), identificado: true };
  }
  return { textoPeriodo: `${formatarSóData(min)} a ${formatarSóData(max)}`, identificado: true };
}

/** Frase curta para rótulos (gráficos, tabelas). */
export function tituloComPeriodoChamadas(prefixo: string, rows: ChamadaXlsxRow[]): string {
  const { textoPeriodo, identificado } = resumoPeriodoDatasChamadas(rows);
  if (!identificado || !textoPeriodo) {
    return prefixo;
  }
  return `${prefixo} — ${textoPeriodo}`;
}
