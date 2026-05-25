import type {
  LoginInput,
  OrionAgendaCompromisso,
  OrionAgendaCompromissoInput,
  OrionAgendaPublicInfo,
  OrionAgendaSessao,
  OrionAgendaStatus,
  AgendaPolicialEfetivo,
  Usuario,
} from './types';
import {
  gravarAcessoIdSession,
  gravarTokenSession,
  migrarELerAcessoIdSession,
  migrarELerTokenSession,
  removerAcessoIdSession,
  removerTokenSession,
} from './constants/orionEcossistemaAuth';

const envApiUrl = import.meta.env.VITE_API_URL;
const fallbackApiUrl = `${window.location.protocol}//${window.location.hostname}:3002`;
const apiUrlFromEnv = envApiUrl?.trim();
const isEnvLocalhost =
  apiUrlFromEnv?.includes('localhost') || apiUrlFromEnv?.includes('127.0.0.1');
const isBrowserRemoteHost =
  window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_URL =
  isBrowserRemoteHost && isEnvLocalhost ? fallbackApiUrl : apiUrlFromEnv ?? fallbackApiUrl;

export function getToken(): string | null {
  return migrarELerTokenSession();
}

function getAcessoId(): number | null {
  return migrarELerAcessoIdSession();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let detail = '';
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const text = await response.text();
        if (text?.trim()) {
          const errorData = JSON.parse(text) as { message?: string; error?: string };
          detail = errorData.message ?? errorData.error ?? text;
        }
      } else {
        detail = await response.text();
      }
    } catch {
      detail = response.statusText;
    }
    throw new Error(detail || `Erro ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export const api = {
  async getPublicInfo(): Promise<OrionAgendaPublicInfo> {
    return request<OrionAgendaPublicInfo>('/orion-agenda');
  },

  async getSessaoModulo(): Promise<OrionAgendaSessao> {
    return request<OrionAgendaSessao>('/orion-agenda/v1/sessao');
  },

  async login(payload: LoginInput): Promise<{ accessToken: string; usuario: Usuario; acessoId?: number }> {
    const response = await request<{ accessToken: string; usuario: Usuario; acessoId?: number }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    gravarTokenSession(response.accessToken);
    if (response.acessoId) {
      gravarAcessoIdSession(response.acessoId);
    }
    return response;
  },

  async logout(): Promise<void> {
    const acessoId = getAcessoId();
    if (acessoId) {
      try {
        await request('/acessos/logout', {
          method: 'POST',
          body: JSON.stringify({ acessoId }),
        });
      } catch {
        /* ignora */
      }
    }
    removerTokenSession();
    removerAcessoIdSession();
  },

  async getMe(): Promise<Usuario> {
    return request<Usuario>('/auth/me');
  },

  async listarPoliciaisEfetivo(): Promise<AgendaPolicialEfetivo[]> {
    return request<AgendaPolicialEfetivo[]>('/orion-agenda/v1/policiais-efetivo');
  },

  async listarCompromissos(opts?: {
    mes?: string;
    status?: OrionAgendaStatus;
  }): Promise<OrionAgendaCompromisso[]> {
    const params = new URLSearchParams();
    if (opts?.mes) params.set('mes', opts.mes);
    if (opts?.status) params.set('status', opts.status);
    const q = params.toString();
    return request<OrionAgendaCompromisso[]>(
      `/orion-agenda/v1/compromissos${q ? `?${q}` : ''}`,
    );
  },

  async criarCompromisso(payload: OrionAgendaCompromissoInput): Promise<OrionAgendaCompromisso> {
    return request<OrionAgendaCompromisso>('/orion-agenda/v1/compromissos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async atualizarCompromisso(
    id: number,
    payload: Partial<OrionAgendaCompromissoInput>,
  ): Promise<OrionAgendaCompromisso> {
    return request<OrionAgendaCompromisso>(`/orion-agenda/v1/compromissos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async excluirCompromisso(id: number): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/orion-agenda/v1/compromissos/${id}`, {
      method: 'DELETE',
    });
  },
};
