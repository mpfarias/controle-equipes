import type {
  Afastamento,
  Policial,
  RestricaoMedica,
  CreateAfastamentoInput,
  CreatePolicialInput,
  CreatePoliciaisBulkInput,
  CreateUsuarioInput,
  LoginInput,
  MotivoAfastamentoOption,
  Usuario,
  UsuarioNivelOption,
  FuncaoOption,
  ProcessFileResponse,
  BulkCreateResponse,
  AuditLogsResponse,
  RelatorioLogsResponse,
  ErroLogsResponse,
  ErroLog,
  AcessoLogsResponse,
  AcessoLog,
  RestricaoAfastamento,
  TipoRestricaoAfastamento,
  CreateRestricaoAfastamentoInput,
  UpdateRestricaoAfastamentoInput,
} from './types.ts';

const envApiUrl = import.meta.env.VITE_API_URL;
const fallbackApiUrl = `${window.location.protocol}//${window.location.hostname}:3002`;
const apiUrlFromEnv = envApiUrl?.trim();
const isEnvLocalhost =
  apiUrlFromEnv?.includes('localhost') || apiUrlFromEnv?.includes('127.0.0.1');
const isBrowserRemoteHost =
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';
const API_URL =
  isBrowserRemoteHost && isEnvLocalhost
    ? fallbackApiUrl
    : apiUrlFromEnv ?? fallbackApiUrl;

const TOKEN_STORAGE_KEY = 'afastamentos-web:token';
const ACESSO_ID_STORAGE_KEY = 'afastamentos-web:acessoId';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function removeToken(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getAcessoId(): number | null {
  const acessoId = sessionStorage.getItem(ACESSO_ID_STORAGE_KEY);
  return acessoId ? parseInt(acessoId, 10) : null;
}

export function setAcessoId(acessoId: number): void {
  sessionStorage.setItem(ACESSO_ID_STORAGE_KEY, acessoId.toString());
}

export function removeAcessoId(): void {
  sessionStorage.removeItem(ACESSO_ID_STORAGE_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Debug: log para verificar requisições
  if (path.includes('/policiais') && path.includes('equipe')) {
    console.log('API Request:', path, options);
  }
  const headers = new Headers(options.headers ?? {});
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Adicionar token JWT no header Authorization se disponível
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
    let errorData: unknown = null;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text && text.trim()) {
          errorData = JSON.parse(text);
          // Extrair apenas a mensagem do erro, se disponível
          if (typeof errorData === 'object' && errorData !== null) {
            // Priorizar a propriedade 'message' do erro
            const errorObj = errorData as { message?: string; error?: string };
            detail = errorObj.message ?? errorObj.error ?? JSON.stringify(errorData);
          } else {
            detail = String(errorData ?? response.statusText);
          }
        } else {
          detail = response.statusText;
        }
      } else {
        detail = response.statusText;
      }
    } catch (error) {
      detail = response.statusText;
    }
    const error = new Error(detail || 'Falha ao comunicar com a API.');
    // Adicionar dados do erro como propriedade para acesso posterior
    if (errorData) {
      (error as Error & { data: unknown }).data = errorData;
    }
    throw error;
  }

  // Verificar se a resposta está vazia (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  // Verificar Content-Length para respostas vazias
  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') {
    return undefined as T;
  }

  // Tentar fazer parse do JSON, tratando respostas vazias
  try {
    const text = await response.text();
    
    // Se não houver conteúdo, retornar undefined
    if (!text || text.trim() === '') {
      return undefined as T;
    }

    // Tentar fazer parse do JSON
    return JSON.parse(text) as T;
  } catch (error) {
    // Se falhar ao fazer parse e a resposta estiver vazia, retornar undefined
    // Caso contrário, relançar o erro
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return undefined as T;
    }
    throw error;
  }
}

const CACHE_TTL_MS = 30_000;
const requestCache = new Map<string, { ts: number; data: unknown }>();

function getCached<T>(key: string): T | null {
  const cached = requestCache.get(key);
  if (!cached) {
    return null;
  }
  if (Date.now() - cached.ts > CACHE_TTL_MS) {
    requestCache.delete(key);
    return null;
  }
  return cached.data as T;
}

function setCached(key: string, data: unknown): void {
  requestCache.set(key, { ts: Date.now(), data });
}

function clearCache(): void {
  requestCache.clear();
}

export const api = {
  async listUsuariosPaginated(params: {
    page: number;
    pageSize: number;
  }): Promise<{
    usuarios: Usuario[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const searchParams = new URLSearchParams();
    searchParams.append('page', String(params.page));
    searchParams.append('pageSize', String(params.pageSize));
    const query = searchParams.toString();
    const path = `/usuarios?${query}`;
    const cacheKey = `GET:${path}`;
    const cached = getCached<{
      usuarios: Usuario[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await request<{
      usuarios: Usuario[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(path);
    setCached(cacheKey, data);
    return data;
  },
  async listUsuarios(): Promise<Usuario[]> {
    const cacheKey = 'GET:/usuarios';
    const cached = getCached<Usuario[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await request<Usuario[]>('/usuarios');
    setCached(cacheKey, data);
    return data;
  },

  async getUsuario(id: number): Promise<Usuario> {
    return request(`/usuarios/${id}`);
  },

  async listUsuarioNiveis(): Promise<UsuarioNivelOption[]> {
    const cacheKey = 'GET:/usuarios/niveis';
    const cached = getCached<UsuarioNivelOption[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await request<UsuarioNivelOption[]>('/usuarios/niveis');
    setCached(cacheKey, data);
    return data;
  },

  async listFuncoes(): Promise<FuncaoOption[]> {
    const cacheKey = 'GET:/usuarios/funcoes';
    const cached = getCached<FuncaoOption[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await request<FuncaoOption[]>('/usuarios/funcoes');
    setCached(cacheKey, data);
    return data;
  },

  async createUsuario(payload: CreateUsuarioInput): Promise<Usuario> {
    const data = await request<Usuario>('/usuarios', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async updateUsuario(
    id: number,
    payload: Partial<CreateUsuarioInput>,
  ): Promise<Usuario> {
    const data = await request<Usuario>(`/usuarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async login(payload: LoginInput): Promise<{ accessToken: string; usuario: Usuario; acessoId?: number }> {
    const response = await request<{ accessToken: string; usuario: Usuario; acessoId?: number }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    // Armazenar token e acessoId automaticamente após login
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
        await request('/acessos/logout', {
          method: 'POST',
          body: JSON.stringify({ acessoId }),
        });
      } catch (error) {
        // Não bloquear logout se falhar ao registrar
        console.error('Erro ao registrar logout:', error);
      }
    }
    removeToken();
    removeAcessoId();
  },

  async forgotPassword(matricula: string): Promise<{
    message: string;
    perguntaSeguranca?: string;
  }> {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ matricula }),
    });
  },


  async resetPasswordBySecurityQuestion(
    matricula: string,
    respostaSeguranca: string,
    novaSenha: string,
  ): Promise<{ message: string }> {
    return request('/auth/reset-password-by-security-question', {
      method: 'POST',
      body: JSON.stringify({
        matricula,
        respostaSeguranca,
        novaSenha,
      }),
    });
  },

  async removeUsuario(id: number): Promise<void> {
    await request(`/usuarios/${id}`, {
      method: 'DELETE',
    });
    clearCache();
  },

  async activateUsuario(id: number): Promise<Usuario> {
    const data = await request<Usuario>(`/usuarios/${id}/activate`, {
      method: 'PATCH',
    });
    clearCache();
    return data;
  },

  async deleteUsuario(id: number, senha: string): Promise<void> {
    await request(`/usuarios/${id}/delete-permanent`, {
      method: 'POST',
      body: JSON.stringify({ senha }),
    });
    clearCache();
  },

  async listPoliciais(params?: {
    page?: number;
    pageSize?: number;
    includeAfastamentos?: boolean;
    includeRestricoes?: boolean;
  }): Promise<Policial[]> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    if (params?.includeAfastamentos !== undefined) {
      searchParams.append('includeAfastamentos', String(params.includeAfastamentos));
    }
    if (params?.includeRestricoes !== undefined) {
      searchParams.append('includeRestricoes', String(params.includeRestricoes));
    }
    const query = searchParams.toString();
    const path = `/policiais${query ? `?${query}` : ''}`;
    const cacheKey = `GET:${path}`;
    const cached = getCached<Policial[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await request<Policial[]>(path);
    setCached(cacheKey, data);
    return data;
  },

  async listPoliciaisPaginated(params: {
    page: number;
    pageSize: number;
    includeAfastamentos?: boolean;
    includeRestricoes?: boolean;
    search?: string;
    equipe?: string;
    status?: string;
    funcaoId?: number;
    orderBy?: 'nome' | 'matricula' | 'equipe';
    orderDir?: 'asc' | 'desc';
  }): Promise<{
    Policiales: Policial[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const searchParams = new URLSearchParams();
    searchParams.append('page', String(params.page));
    searchParams.append('pageSize', String(params.pageSize));
    if (params.includeAfastamentos !== undefined) {
      searchParams.append('includeAfastamentos', String(params.includeAfastamentos));
    }
    if (params.includeRestricoes !== undefined) {
      searchParams.append('includeRestricoes', String(params.includeRestricoes));
    }
    if (params.search) searchParams.append('search', params.search);
    if (params.equipe) searchParams.append('equipe', params.equipe);
    if (params.status) searchParams.append('status', params.status);
    if (params.funcaoId) searchParams.append('funcaoId', String(params.funcaoId));
    if (params.orderBy) searchParams.append('orderBy', params.orderBy);
    if (params.orderDir) searchParams.append('orderDir', params.orderDir);
    const query = searchParams.toString();
    const path = `/policiais?${query}`;
    const cacheKey = `GET:${path}`;
    const cached = getCached<{
      Policiales: Policial[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(cacheKey);
    if (cached) {
      console.log('Cache hit para:', cacheKey, cached);
      return cached;
    }
    const data = await request<{
      Policiales: Policial[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(path);
    console.log('Dados recebidos do servidor para:', cacheKey, data);
    setCached(cacheKey, data);
    return data;
  },

  async getPolicial(id: number): Promise<Policial> {
    return request(`/policiais/${id}`);
  },

  async createPolicial(payload: CreatePolicialInput): Promise<Policial> {
    const data = await request<Policial>('/policiais', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async updatePolicial(
    id: number,
    payload: Partial<CreatePolicialInput>,
  ): Promise<Policial> {
    const data = await request<Policial>(`/policiais/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async removePolicial(id: number): Promise<void> {
    await request(`/policiais/${id}`, {
      method: 'DELETE',
    });
    clearCache();
  },

  async activatePolicial(id: number): Promise<Policial> {
    const data = await request<Policial>(`/policiais/${id}/activate`, {
      method: 'PATCH',
    });
    clearCache();
    return data;
  },

  async deletePolicial(id: number, senha: string): Promise<void> {
    await request(`/policiais/${id}/delete-permanent`, {
      method: 'POST',
      body: JSON.stringify({ senha }),
    });
    clearCache();
  },

  async listRestricoesMedicas(): Promise<RestricaoMedica[]> {
    const cacheKey = 'GET:/policiais/restricoes-medicas';
    const cached = getCached<RestricaoMedica[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await request<RestricaoMedica[]>('/policiais/restricoes-medicas');
    setCached(cacheKey, data);
    return data;
  },

  async updateRestricaoMedicaPolicial(
    id: number,
    restricaoMedicaId: number | null,
  ): Promise<Policial> {
    const data = await request<Policial>(`/policiais/${id}/restricao-medica`, {
      method: 'PATCH',
      body: JSON.stringify({ restricaoMedicaId }),
    });
    clearCache();
    return data;
  },

  async removeRestricaoMedicaPolicial(
    id: number,
    senha: string,
  ): Promise<Policial> {
    const data = await request<Policial>(`/policiais/${id}/restricao-medica`, {
      method: 'DELETE',
      body: JSON.stringify({ senha }),
    });
    clearCache();
    return data;
  },

  async listMotivos(): Promise<MotivoAfastamentoOption[]> {
    const cacheKey = 'GET:/afastamentos/motivos';
    const cached = getCached<MotivoAfastamentoOption[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await request<MotivoAfastamentoOption[]>('/afastamentos/motivos');
    setCached(cacheKey, data);
    return data;
  },

  async listAfastamentos(
    params?: number | {
      policialId?: number;
      page?: number;
      pageSize?: number;
      equipe?: string;
      motivoId?: number;
      status?: string;
      dataInicio?: string;
      dataFim?: string;
      includePolicialFuncao?: boolean;
    },
  ): Promise<Afastamento[]> {
    if (typeof params === 'number') {
      return request(`/afastamentos?policialId=${params}`);
    }
    const searchParams = new URLSearchParams();
    if (params?.policialId) searchParams.append('policialId', String(params.policialId));
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    if (params?.equipe) searchParams.append('equipe', params.equipe);
    if (params?.motivoId) searchParams.append('motivoId', String(params.motivoId));
    if (params?.status) searchParams.append('status', params.status);
    if (params?.dataInicio) searchParams.append('dataInicio', params.dataInicio);
    if (params?.dataFim) searchParams.append('dataFim', params.dataFim);
    if (params?.includePolicialFuncao !== undefined) {
      searchParams.append('includePolicialFuncao', String(params.includePolicialFuncao));
    }
    const query = searchParams.toString();
    return request(`/afastamentos${query ? `?${query}` : ''}`);
  },

  async createAfastamento(payload: CreateAfastamentoInput): Promise<Afastamento> {
    const data = await request<Afastamento>('/afastamentos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async updateAfastamento(
    id: number,
    payload: Partial<CreateAfastamentoInput>,
  ): Promise<Afastamento> {
    const data = await request<Afastamento>(`/afastamentos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async removeAfastamento(id: number): Promise<void> {
    await request(`/afastamentos/${id}`, {
      method: 'DELETE',
    });
    clearCache();
  },

  async uploadFile(file: File): Promise<ProcessFileResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    return request('/policiais/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async createPoliciaisBulk(payload: CreatePoliciaisBulkInput): Promise<BulkCreateResponse> {
    const data = await request<BulkCreateResponse>('/policiais/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async listAuditLogs(limit?: number, offset?: number, dataInicio?: string, dataFim?: string): Promise<AuditLogsResponse> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    const query = params.toString();
    return request(`/audit/logs${query ? `?${query}` : ''}`);
  },

  async registrarGeracaoRelatorio(tipoRelatorio: string): Promise<void> {
    await request('/relatorios/registrar', {
      method: 'POST',
      body: JSON.stringify({ tipoRelatorio }),
    });
  },

  async listRelatorioLogs(page?: number, pageSize?: number, dataInicio?: string, dataFim?: string): Promise<RelatorioLogsResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (pageSize) params.append('pageSize', pageSize.toString());
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    const query = params.toString();
    return request(`/relatorios/logs${query ? `?${query}` : ''}`);
  },

  async listErroLogs(page?: number, pageSize?: number, dataInicio?: string, dataFim?: string): Promise<ErroLogsResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (pageSize) params.append('pageSize', pageSize.toString());
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    const query = params.toString();
    const response = await request<ErroLogsResponse | ErroLog[]>(`/erros${query ? `?${query}` : ''}`);
    
    // Se a resposta for um array (sem paginação), converter para formato padronizado
    if (Array.isArray(response)) {
      return { logs: response };
    }
    
    // Se a resposta já tem erros ou logs, padronizar
    if ('erros' in response) {
      return { logs: response.erros || [] };
    }
    
    return response;
  },

  async listAcessoLogs(page?: number, pageSize?: number, dataInicio?: string, dataFim?: string, userId?: number): Promise<AcessoLogsResponse> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (pageSize) params.append('pageSize', pageSize.toString());
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    if (userId) params.append('userId', userId.toString());
    const query = params.toString();
    const response = await request<AcessoLogsResponse | AcessoLog[]>(`/acessos${query ? `?${query}` : ''}`);
    
    // Se a resposta for um array (sem paginação), converter para formato padronizado
    if (Array.isArray(response)) {
      return { logs: response };
    }
    
    // Se a resposta já tem acessos ou logs, padronizar
    if ('acessos' in response) {
      return { logs: response.acessos || [] };
    }
    
    return response;
  },

  async listTiposRestricaoAfastamento(): Promise<TipoRestricaoAfastamento[]> {
    return request('/restricoes-afastamento/tipos');
  },

  async listRestricoesAfastamento(): Promise<RestricaoAfastamento[]> {
    return request('/restricoes-afastamento');
  },

  async getRestricaoAfastamento(id: number): Promise<RestricaoAfastamento> {
    return request(`/restricoes-afastamento/${id}`);
  },

  async createRestricaoAfastamento(
    payload: CreateRestricaoAfastamentoInput,
  ): Promise<RestricaoAfastamento> {
    const data = await request<RestricaoAfastamento>('/restricoes-afastamento', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async updateRestricaoAfastamento(
    id: number,
    payload: UpdateRestricaoAfastamentoInput,
  ): Promise<RestricaoAfastamento> {
    const data = await request<RestricaoAfastamento>(`/restricoes-afastamento/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async deleteRestricaoAfastamento(id: number): Promise<void> {
    await request(`/restricoes-afastamento/${id}`, {
      method: 'DELETE',
    });
    clearCache();
  },
};
