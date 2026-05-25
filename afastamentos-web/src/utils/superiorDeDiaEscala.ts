import type { Equipe, Policial } from '../types';
import {
  ESCALA_DIA_FIM,
  ESCALA_DIA_INICIO,
  ESCALA_NOITE_FIM,
  ESCALA_NOITE_INICIO,
} from '../constants/svgRegras';
import type { BlocoEscalaId } from './escalaBlocos';
import { funcaoNomeIndicaSuperiorDeDia } from './funcaoSupervisorDeDia';
import { calcularEquipesOperacionalDia } from './escalaEquipesCalculo';
import type { EscalaParsed } from './escalaParametros';

export type OperacionalTurnosOpcao = { diurno: boolean; noturno: boolean };

export type SuperiorDeDiaTurno = {
  policial: Policial;
  equipe: Equipe;
  horarioServico: string;
  equipeLabel: string;
  blocoEscala: BlocoEscalaId;
};

function normEquipe(e: string | null | undefined): Equipe | null {
  const s = (e ?? '').trim().toUpperCase();
  if (s === 'A' || s === 'B' || s === 'C' || s === 'D' || s === 'E') return s;
  return null;
}

function normalizarNomeSuperior(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Roster fixo por equipe (fallback quando `Policial.equipe` não estiver preenchida). */
const SUPERIOR_TRECHOS_POR_EQUIPE: Record<Equipe, string[]> = {
  A: ['MARCOS SILVA'],
  B: ['EUDE CASTILHO', 'CASTILHO DA SILVA'],
  C: ['IZAIAS', 'IZAIA'],
  D: ['JOEL'],
  E: ['RAFAEL VIEIRA MONCAO', 'VIEIRA MONCAO', 'MONCAO'],
};

export function inferirEquipeSuperiorDeDia(policial: Policial): Equipe | null {
  const cadastro = normEquipe(policial.equipe);
  if (cadastro) return cadastro;

  const nome = normalizarNomeSuperior(policial.nome);
  for (const eq of ['A', 'B', 'C', 'D', 'E'] as Equipe[]) {
    if (SUPERIOR_TRECHOS_POR_EQUIPE[eq].some((t) => nome.includes(t))) return eq;
  }
  return null;
}

/** Um superior por equipe (A–E), conforme cadastro ou roster por nome. */
export function mapSuperioresPorEquipe(policiais: Policial[]): Partial<Record<Equipe, Policial>> {
  const map: Partial<Record<Equipe, Policial>> = {};
  for (const p of policiais) {
    if (p.status === 'DESATIVADO') continue;
    if (!funcaoNomeIndicaSuperiorDeDia(p.funcao?.nome)) continue;
    const eq = inferirEquipeSuperiorDeDia(p);
    if (!eq || map[eq]) continue;
    map[eq] = p;
  }
  return map;
}

/** Carrega superiores do efetivo (função no cadastro ou roster conhecido). */
export async function carregarMapaSuperioresPorEquipe(
  listar: (params: {
    page: number;
    pageSize: number;
    funcaoIds?: number[];
    excluirSuperiorDeDia?: boolean;
    includeAfastamentos?: boolean;
    includeRestricoes?: boolean;
  }) => Promise<{ Policiales: Policial[] }>,
  funcaoSuperiorIds: number[],
): Promise<Partial<Record<Equipe, Policial>>> {
  const base = { page: 1, pageSize: 1000, includeAfastamentos: false, includeRestricoes: false, excluirSuperiorDeDia: false };

  if (funcaoSuperiorIds.length > 0) {
    const porFuncao = await listar({ ...base, funcaoIds: funcaoSuperiorIds });
    const map = mapSuperioresPorEquipe(porFuncao.Policiales.filter((p) => p.status !== 'DESATIVADO'));
    if (Object.keys(map).length > 0) return map;
  }

  const todos = await listar(base);
  return mapSuperioresPorEquipe(todos.Policiales.filter((p) => p.status !== 'DESATIVADO'));
}

/**
 * Superiores de dia escalados na data (mesma rotação 12×24 das equipes operacionais).
 * Diurno: equipe do dia (07h–19h); noturno: equipe da noite (19h–07h).
 */
export function resolverSuperioresDeDiaNaData(
  superioresPorEquipe: Partial<Record<Equipe, Policial>>,
  ano: number,
  mes: number,
  dia: number,
  escala: EscalaParsed,
  turnos: OperacionalTurnosOpcao = { diurno: true, noturno: true },
): { diurno: SuperiorDeDiaTurno | null; noturno: SuperiorDeDiaTurno | null } {
  const eq = calcularEquipesOperacionalDia(ano, mes, dia, escala);
  if (!eq) return { diurno: null, noturno: null };

  const equipeDia = normEquipe(eq.equipeDia);
  const equipeNoite = normEquipe(eq.equipeNoite);

  let diurno: SuperiorDeDiaTurno | null = null;
  let noturno: SuperiorDeDiaTurno | null = null;

  if (turnos.diurno && equipeDia) {
    const p = superioresPorEquipe[equipeDia];
    if (p) {
      diurno = {
        policial: p,
        equipe: equipeDia,
        horarioServico: `${ESCALA_DIA_INICIO}–${ESCALA_DIA_FIM}`,
        equipeLabel: `Equipe ${equipeDia} (superior de dia — diurno)`,
        blocoEscala: 'SUPERIOR_DE_DIA_DIURNO',
      };
    }
  }

  if (turnos.noturno && equipeNoite) {
    const p = superioresPorEquipe[equipeNoite];
    if (p) {
      noturno = {
        policial: p,
        equipe: equipeNoite,
        horarioServico: `${ESCALA_NOITE_INICIO} (dia da escala)–${ESCALA_NOITE_FIM} (dia seguinte)`,
        equipeLabel: `Equipe ${equipeNoite} (superior de dia — noturno)`,
        blocoEscala: 'SUPERIOR_DE_DIA_NOTURNO',
      };
    }
  }

  return { diurno, noturno };
}

export function montarCandidatosSuperiorDeDia(
  policiais: Policial[],
  ano: number,
  mes: number,
  dia: number,
  escala: EscalaParsed,
  turnos: OperacionalTurnosOpcao,
): SuperiorDeDiaTurno[] {
  const map = mapSuperioresPorEquipe(policiais);
  const { diurno, noturno } = resolverSuperioresDeDiaNaData(map, ano, mes, dia, escala, turnos);
  return [diurno, noturno].filter((x): x is SuperiorDeDiaTurno => x != null);
}

/** Sobrenome principal para exibição compacta no calendário. */
export function rotuloCurtoSuperiorDeDia(nome: string): string {
  const limpo = nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
  const semPatente = limpo.replace(/^(1º|2º|3º|SUB)?\s*(SGT|CB|SD|MAJ|CAP|TEN|CEL)\.?\s+/iu, '');
  const partes = semPatente.split(/\s+/).filter(Boolean);
  if (partes.length === 0) return nome.trim();
  const particulas = new Set(['DA', 'DE', 'DO', 'DOS', 'DAS']);
  for (let i = 0; i < partes.length; i++) {
    if (particulas.has(partes[i].toUpperCase()) && i > 0) {
      const p = partes[i - 1];
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    }
  }
  const ultima = partes[partes.length - 1];
  return ultima.charAt(0).toUpperCase() + ultima.slice(1).toLowerCase();
}
