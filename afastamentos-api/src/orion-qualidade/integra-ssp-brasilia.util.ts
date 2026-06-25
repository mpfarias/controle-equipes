const TZ_BR = 'America/Sao_Paulo';

function partesDataHoraBrasilia(d: Date): {
  yyyy: string;
  mm: string;
  dd: string;
  hh: string;
  mi: string;
  ss: string;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '00';
  return {
    yyyy: get('year'),
    mm: get('month'),
    dd: get('day'),
    hh: get('hour'),
    mi: get('minute'),
    ss: get('second'),
  };
}

/** Converte YYYY-MM-DD + HH:mm(:ss) em Brasília para instante UTC. */
export function instanteBrasiliaParaUtc(ymd: string, hm: string): Date {
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
    const p = partesDataHoraBrasilia(probe);
    const alvoMs = Date.UTC(y, mo - 1, d, hh, mi, ss);
    const atualMs = Date.UTC(
      Number(p.yyyy),
      Number(p.mm) - 1,
      Number(p.dd),
      Number(p.hh),
      Number(p.mi),
      Number(p.ss),
    );
    const diff = alvoMs - atualMs;
    if (diff === 0) break;
    utcMs += diff;
  }
  return new Date(utcMs);
}

export function hojeYmdBrasilia(agora = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const d = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}-${m}-${d}`;
}

/** Dia civil atual em Brasília: de 00:01 até o instante atual. */
export function intervaloDiaAtualBrasilia(agora = new Date()): {
  dataInicio: Date;
  dataFim: Date;
  rotuloDia: string;
} {
  const rotuloDia = hojeYmdBrasilia(agora);
  return {
    rotuloDia,
    dataInicio: instanteBrasiliaParaUtc(rotuloDia, '00:01'),
    dataFim: agora,
  };
}

export function formatDateTimeBrasilia(d: Date | string | null | undefined): string {
  if (d == null) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString('pt-BR', {
    timeZone: TZ_BR,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
