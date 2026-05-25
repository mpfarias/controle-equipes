import type {
  LoginInput,
  MulherDashboardStats,
  MulherExcelImportResult,
  MulherOcorrenciaCompleta,
  MulherOcorrenciasListaResposta,
  MulherVitimaCadastroMobile,
  MulherVitimaPanicoMobile,
  OrionMulherSessao,
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
export const API_URL =
  isBrowserRemoteHost && isEnvLocalhost ? fallbackApiUrl : apiUrlFromEnv ?? fallbackApiUrl;

export function getToken(): string | null {
  return migrarELerTokenSession();
}

export function setToken(token: string): void {
  gravarTokenSession(token);
}

export function removeToken(): void {
  removerTokenSession();
}

function getAcessoId(): number | null {
  return migrarELerAcessoIdSession();
}

function setAcessoId(acessoId: number): void {
  gravarAcessoIdSession(acessoId);
}

function removeAcessoId(): void {
  removerAcessoIdSession();
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
  async login(payload: LoginInput): Promise<{ accessToken: string; usuario: Usuario; acessoId?: number }> {
    const response = await request<{ accessToken: string; usuario: Usuario; acessoId?: number }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
    );
    setToken(response.accessToken);
    if (response.acessoId) setAcessoId(response.acessoId);
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
    removeToken();
    removeAcessoId();
  },

  async getMe(): Promise<Usuario> {
    return request<Usuario>('/auth/me');
  },

  async getSessaoModulo(): Promise<OrionMulherSessao> {
    return request<OrionMulherSessao>('/orion-mulher/v1/sessao');
  },

  async getDashboardStats(params?: { from?: string; to?: string }): Promise<MulherDashboardStats> {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return request<MulherDashboardStats>(`/orion-mulher/v1/dashboard/stats${suffix}`);
  },

  async listOcorrencias(params?: {
    page?: number;
    q?: string;
    id?: string;
    cad?: string;
  }): Promise<MulherOcorrenciasListaResposta> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.q) q.set('q', params.q);
    if (params?.id) q.set('id', params.id);
    if (params?.cad) q.set('cad', params.cad);
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return request<MulherOcorrenciasListaResposta>(`/orion-mulher/v1/ocorrencias${suffix}`);
  },

  async getOcorrencia(id: string): Promise<MulherOcorrenciaCompleta> {
    return request<MulherOcorrenciaCompleta>(`/orion-mulher/v1/ocorrencias/${encodeURIComponent(id)}`);
  },

  async createOcorrencia(body: Record<string, unknown>): Promise<{ occurrence: MulherOcorrenciaCompleta }> {
    return request('/orion-mulher/v1/ocorrencias', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async updateOcorrencia(
    id: string,
    body: Record<string, unknown>,
  ): Promise<{ occurrence: MulherOcorrenciaCompleta }> {
    return request(`/orion-mulher/v1/ocorrencias/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async deleteOcorrencia(id: string): Promise<{ ok: boolean }> {
    return request(`/orion-mulher/v1/ocorrencias/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async listCentralCadastros(limit = 100): Promise<MulherVitimaCadastroMobile[]> {
    return request<MulherVitimaCadastroMobile[]>(
      `/orion-mulher/v1/central/vitima-cadastros?limit=${limit}`,
    );
  },

  async listCentralPanico(limit = 100): Promise<MulherVitimaPanicoMobile[]> {
    return request<MulherVitimaPanicoMobile[]>(
      `/orion-mulher/v1/central/vitima-panicos?limit=${limit}`,
    );
  },

  async patchCentralPanico(
    id: string,
    body: Record<string, unknown>,
  ): Promise<MulherVitimaPanicoMobile> {
    return request(`/orion-mulher/v1/central/vitima-panicos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async importExcel(opts: {
    mode: 'replace' | 'append';
    file?: File;
    useEnvPath?: boolean;
  }): Promise<MulherExcelImportResult> {
    if (opts.useEnvPath && !opts.file) {
      const fd = new FormData();
      fd.set('mode', opts.mode);
      fd.set('useEnvPath', 'true');
      return request<MulherExcelImportResult>('/orion-mulher/v1/import/excel', {
        method: 'POST',
        body: fd,
      });
    }
    if (!opts.file) {
      throw new Error('Arquivo não informado.');
    }
    const fd = new FormData();
    fd.set('mode', opts.mode);
    fd.set('file', opts.file);
    return request<MulherExcelImportResult>('/orion-mulher/v1/import/excel', {
      method: 'POST',
      body: fd,
    });
  },
};
