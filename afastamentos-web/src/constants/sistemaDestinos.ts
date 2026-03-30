import type { Usuario } from '../types';
import { SISTEMAS_EXTERNOS_OPTIONS } from './sistemasExternos';

/** Este front (Órion / SAD) — permanece na SPA ao escolher. */
export const SISTEMA_ID_APP_ATUAL = 'SAD' as const;

const ENV_URL_KEYS: Record<string, keyof ImportMetaEnv> = {
  PATRIMONIO: 'VITE_SISTEMA_URL_PATRIMONIO',
  OPERACOES: 'VITE_SISTEMA_URL_OPERACOES',
};

export type DestinoSistema =
  | { tipo: 'interno' }
  | { tipo: 'externo'; url: string; configurado: boolean };

export function getSistemaDestino(sistemaId: string): DestinoSistema {
  if (sistemaId === SISTEMA_ID_APP_ATUAL) {
    return { tipo: 'interno' };
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
  return SISTEMAS_EXTERNOS_OPTIONS.find((o) => o.id === sistemaId)?.label ?? sistemaId;
}

export type ResultadoFluxoSistemas =
  | { acao: 'app'; redirecionarExterno?: string }
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

/**
 * Define se o usuário entra direto no app, é redirecionado para outro sistema ou deve escolher.
 * Com 1 sistema: grava sessão e pode redirecionar externo.
 * Com 2+: usa escolha salva no sessionStorage se ainda válida; senão pede tela de escolha.
 */
export function resolverFluxoSistemas(usuario: Usuario): ResultadoFluxoSistemas {
  const sistemas = sistemasPermitidosDoUsuario(usuario);

  if (sistemas.length === 1) {
    const id = sistemas[0];
    writeSistemaSessao(id);
    if (id !== SISTEMA_ID_APP_ATUAL) {
      const d = getSistemaDestino(id);
      if (d.tipo === 'externo' && d.configurado) {
        return { acao: 'app', redirecionarExterno: d.url };
      }
    }
    return { acao: 'app' };
  }

  const salvo = readSistemaSessao();
  if (salvo && sistemas.includes(salvo)) {
    if (salvo !== SISTEMA_ID_APP_ATUAL) {
      const d = getSistemaDestino(salvo);
      if (d.tipo === 'externo' && d.configurado) {
        return { acao: 'app', redirecionarExterno: d.url };
      }
    }
    return { acao: 'app' };
  }

  return { acao: 'escolher-sistema' };
}
