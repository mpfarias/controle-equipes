const TZ_BR = 'America/Sao_Paulo';

export type CamposFiltroChamadas = {
  dataInicio: string;
  horaInicio: string;
  dataFim: string;
  horaFim: string;
};

export function hojeYmdBrasilia(agora = new Date()): string {
  return agora.toLocaleDateString('en-CA', { timeZone: TZ_BR });
}

function partesHoraBrasilia(agora = new Date()): { hh: string; mi: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BR,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(agora);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '00';
  return { hh: get('hour'), mi: get('minute') };
}

/** Converte YYYY-MM-DD + HH:mm(:ss) em Brasília para ISO UTC. */
export function instanteBrasiliaParaIso(ymd: string, hm: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) throw new Error('Data inválida.');
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hmNorm = hm.trim().length === 5 ? `${hm.trim()}:00` : hm.trim();
  const tp = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(hmNorm);
  if (!tp) throw new Error('Horário inválido.');
  const hh = Number(tp[1]);
  const mi = Number(tp[2]);
  const ss = tp[3] != null ? Number(tp[3]) : 0;

  let utcMs = Date.UTC(y, mo - 1, d, hh + 3, mi, ss);
  for (let i = 0; i < 5; i++) {
    const probe = new Date(utcMs);
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ_BR,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(probe);
    const get = (t: Intl.DateTimeFormatPartTypes) => Number(p.find((x) => x.type === t)?.value ?? 0);
    const alvoMs = Date.UTC(y, mo - 1, d, hh, mi, ss);
    const atualMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    const diff = alvoMs - atualMs;
    if (diff === 0) break;
    utcMs += diff;
  }
  return new Date(utcMs).toISOString();
}

export function camposFiltroPadraoDiaAtual(agora = new Date()): CamposFiltroChamadas {
  const ymd = hojeYmdBrasilia(agora);
  const { hh, mi } = partesHoraBrasilia(agora);
  return {
    dataInicio: ymd,
    horaInicio: '00:01',
    dataFim: ymd,
    horaFim: `${hh}:${mi}`,
  };
}

export function filtroIsoFromCampos(campos: CamposFiltroChamadas): { dataInicio: string; dataFim: string } {
  return {
    dataInicio: instanteBrasiliaParaIso(campos.dataInicio, campos.horaInicio),
    dataFim: instanteBrasiliaParaIso(campos.dataFim, campos.horaFim),
  };
}

export function filtroPadraoDiaAtualIso(agora = new Date()): { dataInicio: string; dataFim: string } {
  return filtroIsoFromCampos(camposFiltroPadraoDiaAtual(agora));
}

/** Período máximo permitido na busca (alinhado à API). */
export const PERIODO_MAXIMO_BUSCA_MS = 31 * 24 * 60 * 60 * 1000;

export function validarPeriodoFiltroCampos(campos: CamposFiltroChamadas): string | null {
  try {
    const { dataInicio, dataFim } = filtroIsoFromCampos(campos);
    const ini = new Date(dataInicio).getTime();
    const fim = new Date(dataFim).getTime();
    if (Number.isNaN(ini) || Number.isNaN(fim)) return 'Data ou hora inválida.';
    if (fim < ini) return 'A data/hora final deve ser posterior à inicial.';
    if (fim - ini > PERIODO_MAXIMO_BUSCA_MS) return 'Período máximo para consulta: 31 dias.';
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Filtro inválido.';
  }
}

export function isoParaCamposBrasilia(iso: string): { data: string; hora: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Data inválida.');
  }
  const data = d.toLocaleDateString('en-CA', { timeZone: TZ_BR });
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BR,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mi = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return { data, hora: `${hh}:${mi}` };
}

export function camposFromFiltroIso(filtro: {
  dataInicio: string;
  dataFim: string;
}): CamposFiltroChamadas {
  const ini = isoParaCamposBrasilia(filtro.dataInicio);
  const fim = isoParaCamposBrasilia(filtro.dataFim);
  return {
    dataInicio: ini.data,
    horaInicio: ini.hora,
    dataFim: fim.data,
    horaFim: fim.hora,
  };
}
