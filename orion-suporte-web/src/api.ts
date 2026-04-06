import type { ErrorReport, ErrorReportStatus, LoginInput, Usuario } from './types';
import {
  gravarAcessoIdSession,
  gravarTokenSession,
  migrarELerAcessoIdSession,
  migrarELerTokenSession,
  removerAcessoIdSession,
  removerTokenSession,
} from './constants/orionEcossistemaAuth';

/**
 * Sessão alinhada ao ecossistema Órion:
 * - Mesma chave `orion-ecossistema:jwt` no sessionStorage quando SAD e Suporte rodam na mesma origem.
 * - Entre origens diferentes, o SAD pode enviar o JWT no fragmento da URL (`#orion_sso=`), consumido antes do boot.
 * - Logout aqui só encerra o AcessoLog deste `acessoId` (não revoga JWT em outros dispositivos).
 */
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
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    setToken(response.accessToken);
    if (response.acessoId) {
      setAcessoId(response.acessoId);
    }
    return response;
  },

  async logout(): Promise<void> {
    const acessoId = getAcessoId();
    if (acessoId) {
      try {
        // Fecha apenas o registro de acesso deste login no Suporte; não invalida sessão do Órion SAD.
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

  async patchMeProfile(payload: { fotoUrl?: string }): Promise<Usuario> {
    return request<Usuario>('/usuarios/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async changePassword(payload: {
    senhaAtual: string;
    novaSenha: string;
  }): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listErrorReportsAdminTodos(): Promise<ErrorReport[]> {
    return request<ErrorReport[]>('/error-reports/admin/todos');
  },

  async getErrorReportsAdminContagemAbertos(): Promise<{ total: number }> {
    return request<{ total: number }>('/error-reports/admin/contagem-abertos');
  },

  async updateErrorReportStatus(
    id: number,
    payload: { status: ErrorReportStatus },
  ): Promise<ErrorReport> {
    return request<ErrorReport>(`/error-reports/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
