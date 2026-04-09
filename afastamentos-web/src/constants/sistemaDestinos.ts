import type { Usuario } from '../types';
import { temAcessoOrionSuporteEfetivo } from '../utils/orionSuporteEfetivo';
import { SISTEMAS_EXTERNOS_OPTIONS } from './sistemasExternos';
import { getUrlOrionQualidade } from './orionQualidade';
import { getUrlOrionJuridico } from './orionJuridico';
import { getUrlOrionPatrimonio } from './orionPatrimonio';

/** Este front (Órion / SAD) — permanece na SPA ao escolher. */
export const SISTEMA_ID_APP_ATUAL = 'SAD' as const;

/** Destino sintético (não vem de `sistemasPermitidos` na API) — Órion Suporte. */
export const SISTEMA_ID_ORION_SUPORTE = 'ORION_SUPORTE' as const;

/** Vêm de `sistemasPermitidos`; abrem em outra origem com handoff JWT (como o Suporte). */
export const SISTEMA_ID_ORION_QUALIDADE = 'ORION_QUALIDADE' as const;
export const SISTEMA_ID_ORION_JURIDICO = 'ORION_JURIDICO' as const;
export const SISTEMA_ID_ORION_PATRIMONIO = 'ORION_PATRIMONIO' as const;

const ENV_URL_KEYS: Record<string, keyof ImportMetaEnv> = {
  OPERACOES: 'VITE_SISTEMA_URL_OPERACOES',
};

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
  const envKey = ENV_URL_KEYS[sistemaId];
  const raw = envKey ? import.meta.env[envKey] : undefined;
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (url) {
    return { tipo: 'externo', url, configurado: true };
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
    if (id === 'PATRIMONIO') {
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
    if (temAcessoOrionSuporteEfetivo(usuario)) {
      return [SISTEMA_ID_ORION_SUPORTE];
    }
    return [SISTEMA_ID_APP_ATUAL];
  }
  const destinos = [...explicit];
  if (
    temAcessoOrionSuporteEfetivo(usuario) &&
    !destinos.includes(SISTEMA_ID_ORION_SUPORTE)
  ) {
    destinos.push(SISTEMA_ID_ORION_SUPORTE);
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
 * - Um único destino: grava sessão e segue (SAD, externo ou Órion Suporte).
 * - Vários destinos: após login sempre pede escolha; em nova carga da página reaproveita a escolha da sessão se válida.
 */
export function resolverFluxoSistemas(
  usuario: Usuario,
  opcoes: ResolverFluxoOpcoes = {},
): ResultadoFluxoSistemas {
  const { aposLogin = false } = opcoes;
  const destinos = listaDestinosPosLogin(usuario);

  if (destinos.length === 1) {
    return resultadoFluxoUmDestino(destinos[0]);
  }

  if (!aposLogin) {
    const salvo = readSistemaSessao();
    if (salvo && destinos.includes(salvo)) {
      return resultadoFluxoUmDestino(salvo);
    }
  }

  return { acao: 'escolher-sistema' };
}
