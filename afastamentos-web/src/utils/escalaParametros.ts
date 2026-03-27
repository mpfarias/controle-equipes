import type { EscalaParametros, Equipe } from '../types';

/** Alinhado aos defaults da API (`escalas.constants`). */
export const DEFAULT_ESCALA_API: EscalaParametros = {
  dataInicioEquipes: '2026-01-20',
  dataInicioMotoristas: '2026-01-01',
  sequenciaEquipes: 'D,E,B,A,C',
  sequenciaMotoristas: 'A,B,C,D',
};

export type EscalaParsed = {
  dataInicioEquipes: Date;
  dataInicioMotoristas: Date;
  sequenciaEquipes: Equipe[];
  sequenciaMotoristas: Equipe[];
};

function parseIsoDateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function parseSequencia(raw: string): Equipe[] {
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export function mergeEscalaParametros(api: EscalaParametros | null | undefined): EscalaParametros {
  if (!api) return { ...DEFAULT_ESCALA_API };
  return {
    ...DEFAULT_ESCALA_API,
    ...api,
  };
}

/** Converte resposta da API em datas locais e listas de equipes; usa defaults se algo for inválido. */
export function parseEscalaParametros(api: EscalaParametros | null | undefined): EscalaParsed {
  const m = mergeEscalaParametros(api);

  let dataInicioEquipes = parseIsoDateLocal(m.dataInicioEquipes);
  if (!dataInicioEquipes) {
    dataInicioEquipes = parseIsoDateLocal(DEFAULT_ESCALA_API.dataInicioEquipes)!;
  }

  let dataInicioMotoristas = parseIsoDateLocal(m.dataInicioMotoristas);
  if (!dataInicioMotoristas) {
    dataInicioMotoristas = parseIsoDateLocal(DEFAULT_ESCALA_API.dataInicioMotoristas)!;
  }

  let sequenciaEquipes = parseSequencia(m.sequenciaEquipes);
  if (sequenciaEquipes.length === 0) {
    sequenciaEquipes = parseSequencia(DEFAULT_ESCALA_API.sequenciaEquipes);
  }

  let sequenciaMotoristas = parseSequencia(m.sequenciaMotoristas);
  if (sequenciaMotoristas.length === 0) {
    sequenciaMotoristas = parseSequencia(DEFAULT_ESCALA_API.sequenciaMotoristas);
  }

  return {
    dataInicioEquipes,
    dataInicioMotoristas,
    sequenciaEquipes,
    sequenciaMotoristas,
  };
}
