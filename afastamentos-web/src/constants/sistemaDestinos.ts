import type { Usuario } from '../types';
import { usuarioFuncaoBloqueiaEscalasEOperacoes } from '../utils/funcaoSupervisorDeDia';
import { temAcessoOrionSuporteEfetivo } from '../utils/orionSuporteEfetivo';
import { SISTEMAS_EXTERNOS_OPTIONS } from './sistemasExternos';
import { getUrlOrionQualidade } from './orionQualidade';
import { getUrlOrionJuridico } from './orionJuridico';
import { getUrlOrionPatrimonio } from './orionPatrimonio';
import { getUrlOrionMulher } from './orionMulher';
import { getUrlOrionAgenda } from './orionAgenda';
import { getUrlOrionOperacoes } from './orionOperacoes';

/** Este front (Órion / SAD) — permanece na SPA ao escolher. */
export const SISTEMA_ID_APP_ATUAL = 'SAD' as const;

/** Destino sintético (não vem de `sistemasPermitidos` na API) — Órion Suporte. */
export const SISTEMA_ID_ORION_SUPORTE = 'ORION_SUPORTE' as const;

/** Vêm de `sistemasPermitidos`; abrem em outra origem com handoff JWT (como o Suporte). */
export const SISTEMA_ID_ORION_QUALIDADE = 'ORION_QUALIDADE' as const;
export const SISTEMA_ID_ORION_JURIDICO = 'ORION_JURIDICO' as const;
export const SISTEMA_ID_ORION_PATRIMONIO = 'ORION_PATRIMONIO' as const;
export const SISTEMA_ID_ORION_MULHER = 'ORION_MULHER' as const;
export const SISTEMA_ID_ORION_AGENDA = 'ORION_AGENDA' as const;

export type DestinoSistema =
  | { tipo: 'interno' }
  | { tipo: 'externo'; url: string; configurado: boolean }
  | { tipo: 'orion-suporte' }
  | { tipo: 'orion-handoff'; url: string; configurado: boolean };

export function getSistemaDestino(sistemaId: string): DestinoSistema {
  if (sistemaId === SISTEMA_ID_APP_ATUAL) {
    return { tipo: 'interno' };
  }
  if (sistemaId === SISTEMA_ID_ORION_SUPORTE) {
    return { tipo: 'orion-suporte' };
  }
  if (sistemaId === SISTEMA_ID_ORION_QUALIDADE) {
    const url = getUrlOrionQualidade();
    return { tipo: 'orion-handoff', url, configurado: Boolean(url) };
  }
  if (sistemaId === SISTEMA_ID_ORION_JURIDICO) {
    const url = getUrlOrionJuridico();
    return { tipo: 'orion-handoff', url, configurado: Boolean(url) };
  }
  if (sistemaId === SISTEMA_ID_ORION_PATRIMONIO) {
    const url = getUrlOrionPatrimonio();
    return { tipo: 'orion-handoff', url, configurado: Boolean(url) };
  }
  if (sistemaId === SISTEMA_ID_ORION_MULHER) {
    const url = getUrlOrionMulher();
    return { tipo: 'orion-handoff', url, configurado: Boolean(url) };
  }
  if (sistemaId === SISTEMA_ID_ORION_AGENDA || sistemaId === 'ORION_ASSESSORIA') {
    const url = getUrlOrionAgenda();
    return { tipo: 'orion-handoff', url, configurado: Boolean(url) };
  }
  if (sistemaId === 'OPERACOES') {
    const url = getUrlOrionOperacoes();
    return { tipo: 'orion-handoff', url, configurado: Boolean(url) };
  }
  return { tipo: 'externo', url: '', configurado: false };
}

export function sistemasPermitidosDoUsuario(usuario: Usuario | null): string[] {
  const raw = usuario?.sistemasPermitidos;
  if (Array.isArray(raw) && raw.length > 0) {
    return [...new Set(raw)];
  }
  return [SISTEMA_ID_APP_ATUAL];
}

export function labelSistema(sistemaId: string): string {
  if (sistemaId === SISTEMA_ID_ORION_SUPORTE) {
    return 'Órion Suporte';
  }
  if (sistemaId === SISTEMA_ID_ORION_QUALIDADE) {
    return 'Órion Qualidade';
  }
  if (sistemaId === SISTEMA_ID_ORION_JURIDICO) {
    return 'Órion Jurídico';
  }
  if (sistemaId === SISTEMA_ID_ORION_PATRIMONIO) {
    return 'Órion Patrimônio';
  }
  if (sistemaId === SISTEMA_ID_ORION_MULHER) {
    return 'Órion Mulher';
  }
  if (sistemaId === SISTEMA_ID_ORION_AGENDA || sistemaId === 'ORION_ASSESSORIA') {
    return 'Órion Agenda';
  }
  return SISTEMAS_EXTERNOS_OPTIONS.find((o) => o.id === sistemaId)?.label ?? sistemaId;
}

/** Lista SAD / Patrimônio / Operações sem o padrão artificial `['SAD']` quando vazio. */
export function listaSistemasIntegradosExplicitos(usuario: Usuario | null): string[] {
  const raw = usuario?.sistemasPermitidos;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  for (const x of raw) {
    const id = String(x).trim().toUpperCase();
    if (!id) continue;
    if (id === 'ORION_ASSESSORIA') {
      seen.add(SISTEMA_ID_ORION_AGENDA);
    } else if (id === 'PATRIMONIO') {
      seen.add(SISTEMA_ID_ORION_PATRIMONIO);
    } else {
      seen.add(id);
    }
  }
  return [...seen];
}

/**
 * Destinos após login: somente o que está em `sistemasPermitidos` no cadastro,
 * mais Órion Suporte quando o cadastro/nível conceder (`temAcessoOrionSuporteEfetivo`).
 */
export function listaDestinosPosLogin(usuario: Usuario): string[] {
  const explicit = listaSistemasIntegradosExplicitos(usuario);
  if (explicit.length === 0) {
    const ehAdminSistemaOuNivel =
      usuario.isAdmin === true ||
      usuario.nivel?.nome?.trim().toUpperCase() === 'ADMINISTRADOR';
    if (temAcessoOrionSuporteEfetivo(usuario)) {
      const out: string[] = [SISTEMA_ID_ORION_SUPORTE];
      if (ehAdminSistemaOuNivel && !out.includes(SISTEMA_ID_ORION_QUALIDADE)) {
        out.push(SISTEMA_ID_ORION_QUALIDADE);
      }
      return out;
    }
    const out: string[] = [SISTEMA_ID_APP_ATUAL];
    if (ehAdminSistemaOuNivel && !out.includes(SISTEMA_ID_ORION_QUALIDADE)) {
      out.push(SISTEMA_ID_ORION_QUALIDADE);
    }
    return out;
  }
  const destinos = [...explicit];
  const ehAdminSistemaOuNivel =
    usuario.isAdmin === true ||
    usuario.nivel?.nome?.trim().toUpperCase() === 'ADMINISTRADOR';
  if (ehAdminSistemaOuNivel && !destinos.includes(SISTEMA_ID_ORION_QUALIDADE)) {
    destinos.push(SISTEMA_ID_ORION_QUALIDADE);
  }
  if (
    temAcessoOrionSuporteEfetivo(usuario) &&
    !destinos.includes(SISTEMA_ID_ORION_SUPORTE)
  ) {
    destinos.push(SISTEMA_ID_ORION_SUPORTE);
  }
  if (usuarioFuncaoBloqueiaEscalasEOperacoes(usuario)) {
    const semOperacoes = destinos.filter((id) => id !== 'OPERACOES');
    return semOperacoes.length > 0 ? semOperacoes : [SISTEMA_ID_APP_ATUAL];
  }
  return destinos;
}

export type ResultadoFluxoSistemas =
  | {
      acao: 'app';
      redirecionarExterno?: string;
      /** Redirecionar ao Órion Suporte repassando o JWT no hash (SSO entre origens). */
      redirecionarOrionSuporteComHandoff?: boolean;
      /** Redirecionar ao Órion Qualidade com o mesmo padrão de handoff do Suporte. */
      redirecionarOrionQualidadeComHandoff?: boolean;
      /** Jurídico e demais SPAs Órion com handoff via URL explícita. */
      redirecionarOrionHandoffUrl?: string;
    }
  | { acao: 'escolher-sistema' };

const STORAGE_KEY = 'orion.sistemaAtivo';

/** Query ao voltar de um módulo Órion sem encerrar sessão — exibe o hub. */
export const ORION_RETORNO_HUB_PARAM = 'orion_hub';

/** Query enviada por módulos Órion ao fazer logoff — encerra sessão e exibe login no SAD. */
export const ORION_LOGOUT_ECOSISTEMA_PARAM = 'orion_logout';

const FORCAR_HUB_APOS_MODULO_KEY = 'orion.forcarHub';

export function readSistemaSessao(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeSistemaSessao(sistemaId: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, sistemaId);
  } catch {
    /* ignore */
  }
}

export function clearSistemaSessao(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Lê `?orion_hub=1` — limpa último sistema e força hub (sessão permanece ativa). */
export function consumirRetornoHubDaQuery(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get(ORION_RETORNO_HUB_PARAM) !== '1') return false;
    clearSistemaSessao();
    sessionStorage.setItem(FORCAR_HUB_APOS_MODULO_KEY, '1');
    params.delete(ORION_RETORNO_HUB_PARAM);
    const qs = params.toString();
    const clean = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', clean);
    return true;
  } catch {
    return false;
  }
}

/** Lê `?orion_logout=1` (logoff em módulo Órion) e remove o parâmetro da URL. */
export function consumirLogoutEcossistemaDaQuery(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get(ORION_LOGOUT_ECOSISTEMA_PARAM) !== '1') return false;
    params.delete(ORION_LOGOUT_ECOSISTEMA_PARAM);
    const qs = params.toString();
    const clean = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', clean);
    return true;
  } catch {
    return false;
  }
}

export function deveForcarHubAposLogoutModulo(): boolean {
  try {
    return sessionStorage.getItem(FORCAR_HUB_APOS_MODULO_KEY) === '1';
  } catch {
    return false;
  }
}

export function limparForcarHubAposLogoutModulo(): void {
  try {
    sessionStorage.removeItem(FORCAR_HUB_APOS_MODULO_KEY);
  } catch {
    /* ignore */
  }
}

export type ResolverFluxoOpcoes = {
  /**
   * Imediatamente após login bem-sucedido: não reutiliza `orion.sistemaAtivo`;
   * com mais de um destino, força a tela de escolha.
   */
  aposLogin?: boolean;
};

function resultadoFluxoUmDestino(id: string): ResultadoFluxoSistemas {
  writeSistemaSessao(id);
  if (id === SISTEMA_ID_ORION_SUPORTE) {
    return { acao: 'app', redirecionarOrionSuporteComHandoff: true };
  }
  if (id === SISTEMA_ID_ORION_QUALIDADE) {
    const d = getSistemaDestino(id);
    if (d.tipo === 'orion-handoff' && d.configurado) {
      return { acao: 'app', redirecionarOrionQualidadeComHandoff: true };
    }
  }
  if (id !== SISTEMA_ID_APP_ATUAL) {
    const d = getSistemaDestino(id);
    if (d.tipo === 'orion-handoff' && d.configurado) {
      return { acao: 'app', redirecionarOrionHandoffUrl: d.url };
    }
    if (d.tipo === 'externo' && d.configurado) {
      return { acao: 'app', redirecionarExterno: d.url };
    }
  }
  return { acao: 'app' };
}

/**
 * Define se o usuário entra direto no app, é redirecionado para outro sistema ou deve escolher.
 * - Após login: sempre hub.
 * - Recarga da página: só reentra direto no SAD; módulos Órion (Qualidade, Suporte, etc.)
 *   nunca reabrem sozinhos — evita loop ao voltar do handoff ou dar F5 no hub.
 */
export function resolverFluxoSistemas(
  usuario: Usuario,
  opcoes: ResolverFluxoOpcoes = {},
): ResultadoFluxoSistemas {
  const { aposLogin = false } = opcoes;
  const destinos = listaDestinosPosLogin(usuario);

  if (aposLogin || deveForcarHubAposLogoutModulo()) {
    return { acao: 'escolher-sistema' };
  }

  const salvo = readSistemaSessao();

  // Recarga com última escolha = SAD → permanece no painel SAD
  if (salvo === SISTEMA_ID_APP_ATUAL && destinos.includes(SISTEMA_ID_APP_ATUAL)) {
    writeSistemaSessao(SISTEMA_ID_APP_ATUAL);
    return { acao: 'app' };
  }

  // Perfil com único destino SAD → entra direto (sem hub)
  if (destinos.length === 1 && destinos[0] === SISTEMA_ID_APP_ATUAL) {
    return resultadoFluxoUmDestino(SISTEMA_ID_APP_ATUAL);
  }

  // Qualquer outro caso (vários destinos, ou salvo = Qualidade/Suporte/etc.) → hub
  if (salvo && salvo !== SISTEMA_ID_APP_ATUAL) {
    clearSistemaSessao();
  }

  return { acao: 'escolher-sistema' };
}
