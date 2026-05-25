const TZ = 'America/Sao_Paulo';

export const AGENDA_ANO_MINIMO = 2026;

export const MESES_REFERENCIA = [
  { valor: 1, rotulo: 'Janeiro' },
  { valor: 2, rotulo: 'Fevereiro' },
  { valor: 3, rotulo: 'Março' },
  { valor: 4, rotulo: 'Abril' },
  { valor: 5, rotulo: 'Maio' },
  { valor: 6, rotulo: 'Junho' },
  { valor: 7, rotulo: 'Julho' },
  { valor: 8, rotulo: 'Agosto' },
  { valor: 9, rotulo: 'Setembro' },
  { valor: 10, rotulo: 'Outubro' },
  { valor: 11, rotulo: 'Novembro' },
  { valor: 12, rotulo: 'Dezembro' },
] as const;

export const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

export function mesReferenciaAtual(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7);
}

export function referenciaAgendaInicial(): { mes: number; ano: number } {
  const [anoStr, mesStr] = mesReferenciaAtual().split('-');
  let ano = Number(anoStr);
  let mes = Number(mesStr);
  if (!Number.isFinite(ano) || !Number.isFinite(mes)) {
    return { mes: 1, ano: AGENDA_ANO_MINIMO };
  }
  if (ano < AGENDA_ANO_MINIMO) {
    return { mes: 1, ano: AGENDA_ANO_MINIMO };
  }
  return { mes, ano };
}

export function montarMesReferencia(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

export function anosReferenciaDisponiveis(anoAtual = new Date().getFullYear()): number[] {
  const fim = Math.max(anoAtual + 2, AGENDA_ANO_MINIMO);
  return Array.from({ length: fim - AGENDA_ANO_MINIMO + 1 }, (_, i) => AGENDA_ANO_MINIMO + i);
}

export type CelulaCalendario = { dia: number | null };

/** Grade do mês (domingo = primeira coluna). */
export function gradeCalendarioMes(ano: number, mes: number): CelulaCalendario[] {
  const primeiro = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const offset = primeiro.getDay();
  const celulas: CelulaCalendario[] = [];

  for (let i = 0; i < offset; i += 1) celulas.push({ dia: null });
  for (let dia = 1; dia <= ultimoDia; dia += 1) celulas.push({ dia });

  return celulas;
}

export function diaLocalNoMes(iso: string, ano: number, mes: number): number | null {
  const local = new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
  const [y, m, d] = local.split('-').map(Number);
  if (y === ano && m === mes) return d;
  return null;
}

export function ehHojeLocal(ano: number, mes: number, dia: number): boolean {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const alvo = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  return hoje === alvo;
}

export function rotuloMesReferencia(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return mes;
  const rotulo = MESES_REFERENCIA[m - 1]?.rotulo ?? String(m);
  return `${rotulo} de ${y}`;
}

export function chaveDiaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function rotuloDiaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function montarDatetimeLocal(ano: number, mes: number, dia: number, horario: string): string {
  const [h, m] = horario.split(':');
  const hh = (h ?? '09').padStart(2, '0');
  const mm = (m ?? '00').padStart(2, '0');
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T${hh}:${mm}`;
}

export function dataIsoParaInputDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

export function horarioIsoParaInput(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatarHorarioAgenda(iso: string, diaInteiro: boolean): string {
  if (diaInteiro) return 'Dia inteiro';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Valor para input datetime-local a partir de ISO UTC. */
export function isoParaDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(d)
    .reduce(
      (acc, p) => {
        if (p.type !== 'literal') acc[p.type] = p.value;
        return acc;
      },
      {} as Record<string, string>,
    );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function rotuloDataInputDate(data: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.trim());
  if (!m) return null;
  const iso = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00-03:00`).toISOString();
  if (Number.isNaN(Date.parse(iso))) return null;
  return rotuloDiaLocal(iso);
}

/** datetime-local ou date → ISO para API. */
export function datetimeLocalParaIso(valor: string, diaInteiro: boolean): string {
  if (!valor) return new Date().toISOString();
  if (diaInteiro && valor.length === 10) {
    const iso = new Date(`${valor}T12:00:00-03:00`).toISOString();
    if (Number.isNaN(Date.parse(iso))) return new Date().toISOString();
    return iso;
  }
  if (diaInteiro && valor.includes('T')) {
    const iso = new Date(`${valor.slice(0, 10)}T12:00:00-03:00`).toISOString();
    if (Number.isNaN(Date.parse(iso))) return new Date().toISOString();
    return iso;
  }
  const iso = new Date(`${valor}:00-03:00`).toISOString();
  if (Number.isNaN(Date.parse(iso))) return new Date().toISOString();
  return iso;
}
