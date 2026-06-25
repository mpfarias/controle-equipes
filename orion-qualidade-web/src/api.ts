import type {
  EquipeAtendenteSadItem,
  IntegraSspStatus,
  ListChamadasIntegraSspResponse,
  ListChamadasIntegraTabelaResponse,
  CatalogoNaturezasIntegraSspResponse,
  ListOcorrenciasIntegraSspResponse,
  LoginInput,
  QualidadeRegistro,
  QualidadeRegistroStatus,
  Usuario,
} from './types';
import {
  gravarAcessoIdSession,
  gravarTokenSession,
  migrarELerAcessoIdSession,
  migrarELerTokenSession,
  extrairAcessoIdDoJwt,
  removerAcessoIdSession,
  removerTokenSession,
} from './constants/orionEcossistemaAuth';

/**
 * Sessão alinhada ao ecossistema Órion:
 * - Mesma chave `orion-ecossistema:jwt` no sessionStorage quando SAD e Qualidade rodam na mesma origem.
 * - Entre origens diferentes, o SAD envia o JWT no fragmento (`#orion_sso=`), consumido antes do boot.
 * - Logout encerra o AcessoLog deste `acessoId` (não revoga JWT em outros dispositivos).
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
    const token = getToken();
    const acessoId = getAcessoId() ?? extrairAcessoIdDoJwt(token);
    removeToken();
    removeAcessoId();

    if (!acessoId) return;

    try {
      await fetch(`${API_URL}/acessos/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acessoId }),
      });
    } catch {
      /* ignora falha de rede — sessão local já encerrada */
    }
  },

  async getMe(): Promise<Usuario> {
    return request<Usuario>('/auth/me');
  },

  /** Cruza nomes de atendentes (planilha) com policiais ativos no SAD e retorna equipe. */
  async resolverEquipesPorNome(nomes: string[]): Promise<{ itens: EquipeAtendenteSadItem[] }> {
    return request<{ itens: EquipeAtendenteSadItem[] }>('/orion-qualidade/v1/policiais/equipes-por-nome', {
      method: 'POST',
      body: JSON.stringify({ nomes }),
    });
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

  async listarRegistrosQualidade(): Promise<QualidadeRegistro[]> {
    return request<QualidadeRegistro[]>('/orion-qualidade/v1/registros');
  },

  /**
   * Estado do pool opcional integra_ssp na API (`INTEGRA_SSP_DATABASE_URL`).
   * Login e permissões continuam no banco principal (Prisma / `DATABASE_URL` na API).
   */
  async getIntegraSspStatus(): Promise<IntegraSspStatus> {
    return request<IntegraSspStatus>('/orion-qualidade/v1/integra-ssp/status');
  },

  /** Chamadas do HEFESTO (Integra SSP). Sem parâmetros: dia atual a partir de 00:01 (Brasília). */
  async listarChamadasIntegraSsp(
    params?: { dataInicio?: string; dataFim?: string },
    signal?: AbortSignal,
  ): Promise<ListChamadasIntegraSspResponse> {
    const qs = new URLSearchParams();
    if (params?.dataInicio) qs.set('dataInicio', params.dataInicio);
    if (params?.dataFim) qs.set('dataFim', params.dataFim);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<ListChamadasIntegraSspResponse>(`/orion-qualidade/v1/chamadas${suffix}`, { signal });
  },

  /** Localização (lat/long) de chamadas específicas — carregamento sob demanda na modal. */
  async buscarLocalizacoesChamadas(
    ids: number[],
  ): Promise<{ itens: Array<{ id: number; latitude: string; longitude: string }> }> {
    return request<{ itens: Array<{ id: number; latitude: string; longitude: string }> }>(
      '/orion-qualidade/v1/chamadas/localizacoes',
      {
        method: 'POST',
        body: JSON.stringify({ ids }),
      },
    );
  },

  /** Ocorrências HEFESTO (Integra SSP) — paginado. */
  async listarOcorrenciasIntegraSsp(params?: {
    page?: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<ListOcorrenciasIntegraSspResponse> {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.dataInicio) qs.set('dataInicio', params.dataInicio);
    if (params?.dataFim) qs.set('dataFim', params.dataFim);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<ListOcorrenciasIntegraSspResponse>(`/orion-qualidade/v1/ocorrencias${suffix}`);
  },

  /** CHAMADAS HEFESTO (Integra SSP) — paginado (aba Ocorrências). */
  async listarChamadasTabelaIntegraSsp(params?: {
    page?: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<ListChamadasIntegraTabelaResponse> {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.dataInicio) qs.set('dataInicio', params.dataInicio);
    if (params?.dataFim) qs.set('dataFim', params.dataFim);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<ListChamadasIntegraTabelaResponse>(`/orion-qualidade/v1/chamadas/listagem${suffix}`);
  },

  /** Catálogo código NAT-* → descrição (inferido da narrativa). */
  async catalogoNaturezasIntegraSsp(): Promise<CatalogoNaturezasIntegraSspResponse> {
    return request<CatalogoNaturezasIntegraSspResponse>('/orion-qualidade/v1/ocorrencias/naturezas');
  },

  async atualizarRegistroQualidade(
    id: number,
    body: Partial<{ titulo: string; descricao: string; status: QualidadeRegistroStatus }>,
  ): Promise<QualidadeRegistro> {
    return request<QualidadeRegistro>(`/orion-qualidade/v1/registros/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};
