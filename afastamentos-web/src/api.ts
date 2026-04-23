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
  CreateUsuarioNivelInput,
  UpdateUsuarioNivelInput,
  UsuarioNivelPermissao,
  EquipeOption,
  PerguntaSegurancaOption,
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
  StatusPolicialOption,
  HorarioSvg,
  EscalaParametros,
  EscalaInformacao,
  EscalaGerada,
  EscalaGeradaResumo,
  QuantitativoExtraPolicialItem,
  TrocaServico,
  TrocaServicoAtivaListaItem,
  ErrorReport,
  CreateErrorReportInput,
  ErrorReportStatus,
} from './types.ts';
import {
  gravarAcessoIdSession,
  gravarTokenSession,
  migrarELerAcessoIdSession,
  migrarELerTokenSession,
  removerAcessoIdSession,
  removerTokenSession,
} from './constants/orionEcossistemaAuth.ts';

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

export function getToken(): string | null {
  return migrarELerTokenSession();
}

export function setToken(token: string): void {
  gravarTokenSession(token);
}

export function removeToken(): void {
  removerTokenSession();
}

export function getAcessoId(): number | null {
  return migrarELerAcessoIdSession();
}

export function setAcessoId(acessoId: number): void {
  gravarAcessoIdSession(acessoId);
}

export function removeAcessoId(): void {
  removerAcessoIdSession();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
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
            const errorObj = errorData as { message?: string | string[]; error?: string };
            const rawMsg = errorObj.message ?? errorObj.error;
            detail = Array.isArray(rawMsg)
              ? rawMsg.filter(Boolean).join(' ')
              : (rawMsg ?? JSON.stringify(errorData));
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

  /** Perfil do usuário logado — qualquer nível autenticado (não exige papel ADMINISTRADOR/SAD no guard de /usuarios). */
  async getAuthMe(): Promise<Usuario> {
    return request<Usuario>('/auth/me');
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

  async createUsuarioNivel(payload: CreateUsuarioNivelInput): Promise<UsuarioNivelOption> {
    const data = await request<UsuarioNivelOption>('/usuarios/niveis', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async updateUsuarioNivel(
    id: number,
    payload: UpdateUsuarioNivelInput,
  ): Promise<UsuarioNivelOption> {
    const data = await request<UsuarioNivelOption>(`/usuarios/niveis/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async disableUsuarioNivel(id: number): Promise<UsuarioNivelOption> {
    const data = await request<UsuarioNivelOption>(`/usuarios/niveis/${id}/desativar`, {
      method: 'PATCH',
    });
    clearCache();
    return data;
  },

  async deleteUsuarioNivel(id: number): Promise<UsuarioNivelOption> {
    const data = await request<UsuarioNivelOption>(`/usuarios/niveis/${id}`, {
      method: 'DELETE',
    });
    clearCache();
    return data;
  },

  async listUsuarioNivelPermissoes(id: number): Promise<UsuarioNivelPermissao[]> {
    return request(`/usuarios/niveis/${id}/permissoes`);
  },

  async setUsuarioNivelPermissoes(
    id: number,
    itens: UsuarioNivelPermissao[],
  ): Promise<UsuarioNivelPermissao[]> {
    const data = await request<UsuarioNivelPermissao[]>(`/usuarios/niveis/${id}/permissoes`, {
      method: 'POST',
      body: JSON.stringify({ itens }),
    });
    clearCache();
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

  async createFuncao(payload: {
    nome: string;
    descricao?: string | null;
    vinculoEquipe?: FuncaoOption['vinculoEquipe'];
    escalaOperacional?: boolean;
    escalaMotorista?: boolean;
    escalaExpediente?: boolean;
    expedienteHorarioPreset?: FuncaoOption['expedienteHorarioPreset'];
    equipeReferencia?: string | null;
  }): Promise<FuncaoOption> {
    const data = await request<FuncaoOption>('/usuarios/funcoes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async updateFuncao(
    id: number,
    payload: {
      nome?: string;
      descricao?: string | null;
      vinculoEquipe?: FuncaoOption['vinculoEquipe'];
      escalaOperacional?: boolean;
      escalaMotorista?: boolean;
      escalaExpediente?: boolean;
      expedienteHorarioPreset?: FuncaoOption['expedienteHorarioPreset'];
      equipeReferencia?: string | null;
    },
  ): Promise<FuncaoOption> {
    const data = await request<FuncaoOption>(`/usuarios/funcoes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async disableFuncao(id: number): Promise<FuncaoOption> {
    const data = await request<FuncaoOption>(`/usuarios/funcoes/${id}/desativar`, {
      method: 'PATCH',
    });
    clearCache();
    return data;
  },

  async deleteFuncao(id: number): Promise<FuncaoOption> {
    const data = await request<FuncaoOption>(`/usuarios/funcoes/${id}`, {
      method: 'DELETE',
    });
    clearCache();
    return data;
  },

  async listEquipes(): Promise<EquipeOption[]> {
    const cacheKey = 'GET:/usuarios/equipes';
    const cached = getCached<EquipeOption[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await request<EquipeOption[]>('/usuarios/equipes');
    setCached(cacheKey, data);
    return data;
  },

  async createEquipe(payload: { nome: string; descricao?: string | null }): Promise<EquipeOption> {
    const data = await request<EquipeOption>('/usuarios/equipes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async updateEquipe(
    id: number,
    payload: { nome?: string; descricao?: string | null },
  ): Promise<EquipeOption> {
    const data = await request<EquipeOption>(`/usuarios/equipes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async disableEquipe(id: number): Promise<EquipeOption> {
    const data = await request<EquipeOption>(`/usuarios/equipes/${id}/desativar`, {
      method: 'PATCH',
    });
    clearCache();
    return data;
  },

  async deleteEquipe(id: number): Promise<EquipeOption> {
    const data = await request<EquipeOption>(`/usuarios/equipes/${id}`, {
      method: 'DELETE',
    });
    clearCache();
    return data;
  },

  async listPerguntasSeguranca(): Promise<PerguntaSegurancaOption[]> {
    const cacheKey = 'GET:/usuarios/perguntas-seguranca';
    const cached = getCached<PerguntaSegurancaOption[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await request<PerguntaSegurancaOption[]>('/usuarios/perguntas-seguranca');
    setCached(cacheKey, data);
    return data;
  },

  async createPerguntaSeguranca(payload: { texto: string }): Promise<PerguntaSegurancaOption> {
    const data = await request<PerguntaSegurancaOption>('/usuarios/perguntas-seguranca', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async updatePerguntaSeguranca(
    id: number,
    payload: { texto?: string },
  ): Promise<PerguntaSegurancaOption> {
    const data = await request<PerguntaSegurancaOption>(`/usuarios/perguntas-seguranca/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async disablePerguntaSeguranca(id: number): Promise<PerguntaSegurancaOption> {
    const data = await request<PerguntaSegurancaOption>(`/usuarios/perguntas-seguranca/${id}/desativar`, {
      method: 'PATCH',
    });
    clearCache();
    return data;
  },

  async deletePerguntaSeguranca(id: number): Promise<PerguntaSegurancaOption> {
    const data = await request<PerguntaSegurancaOption>(`/usuarios/perguntas-seguranca/${id}`, {
      method: 'DELETE',
    });
    clearCache();
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
    payload: Partial<CreateUsuarioInput> & { fotoUrl?: string | null },
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

  async changePassword(payload: {
    senhaAtual: string;
    novaSenha: string;
  }): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
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
    equipe?: string;
  }): Promise<Policial[]> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    if (params?.equipe) searchParams.append('equipe', params.equipe);
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
    equipes?: string[];
    status?: string;
    statuses?: string[];
    funcaoId?: number;
    funcaoIds?: number[];
    orderBy?: 'nome' | 'matricula' | 'equipe' | 'status' | 'funcao' | 'dataDesligamento';
    orderDir?: 'asc' | 'desc';
    /** Filtro previsão de férias: só retorna policiais com férias programadas neste mês/ano */
    mesPrevisaoFerias?: number;
    anoPrevisaoFerias?: number;
    /** Ano do registro de férias retornado em cada policial (padrão na API: ano civil atual) */
    feriasAno?: number;
    /** Exclui COMISSIONADO do efetivo e contagens (para limite 1/12 de férias) */
    excluirComissionadosParaLimiteFerias?: boolean;
  }): Promise<{
    Policiales: Policial[];
    total: number;
    totalDisponiveis?: number;
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
    if (params.equipes?.length) searchParams.append('equipes', params.equipes.join(','));
    else if (params.equipe) searchParams.append('equipe', params.equipe);
    if (params.statuses?.length) searchParams.append('statuses', params.statuses.join(','));
    else if (params.status) searchParams.append('status', params.status);
    if (params.funcaoIds?.length) searchParams.append('funcaoIds', params.funcaoIds.join(','));
    else if (params.funcaoId) searchParams.append('funcaoId', String(params.funcaoId));
    if (params.orderBy) searchParams.append('orderBy', params.orderBy);
    if (params.orderDir) searchParams.append('orderDir', params.orderDir);
    if (params.mesPrevisaoFerias != null) searchParams.append('mesPrevisaoFerias', String(params.mesPrevisaoFerias));
    if (params.anoPrevisaoFerias != null) searchParams.append('anoPrevisaoFerias', String(params.anoPrevisaoFerias));
    if (params.feriasAno != null) searchParams.append('feriasAno', String(params.feriasAno));
    if (params.excluirComissionadosParaLimiteFerias === true) {
      searchParams.append('excluirComissionadosParaLimiteFerias', 'true');
    }
    const query = searchParams.toString();
    const path = `/policiais?${query}`;
    const cacheKey = `GET:${path}`;
    const cached = getCached<{
      Policiales: Policial[];
      total: number;
      totalDisponiveis?: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await request<{
      Policiales: Policial[];
      total: number;
      totalDisponiveis?: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(path);
    setCached(cacheKey, data);
    return data;
  },

  /** Maior ano com `FeriasPolicial` cadastrado (sistema ou de um policial). */
  async getUltimoAnoPrevisaoFerias(params?: {
    policialId?: number;
  }): Promise<{ ano: number | null; anoMinimo: number | null }> {
    const q =
      params?.policialId != null ? `?policialId=${encodeURIComponent(String(params.policialId))}` : '';
    return request<{ ano: number | null; anoMinimo: number | null }>(
      `/policiais/previsao-ferias/ultimo-ano${q}`,
    );
  },

  async getPolicial(id: number): Promise<Policial> {
    return request(`/policiais/${id}`);
  },

  /** Lista de policiais filtrados por posto (oficial, praca, civil, outros). */
  async getPoliciaisPorPosto(
    posto: 'oficial' | 'praca' | 'civil' | 'outros',
    equipe?: string,
  ): Promise<Policial[]> {
    const params = new URLSearchParams();
    if (equipe) params.append('equipe', equipe);
    const query = params.toString();
    return request<Policial[]>(`/policiais/por-posto/${posto}${query ? `?${query}` : ''}`);
  },

  /** Contagem de efetivo por posto/graduação (Oficiais, Praças, Civis, Outros). */
  async getEfetivoPorPosto(equipe?: string): Promise<{
    oficiais: number;
    pracas: number;
    civis: number;
    outros: number;
    total: number;
  }> {
    const params = new URLSearchParams();
    if (equipe) params.append('equipe', equipe);
    const query = params.toString();
    return request<{ oficiais: number; pracas: number; civis: number; outros: number; total: number }>(
      `/policiais/efetivo-por-posto${query ? `?${query}` : ''}`,
    );
  },

  /** Policiais com férias programadas (mês atual/próximo) que ainda não têm afastamento de Férias cadastrado. */
  async getPoliciaisComFeriasProgramadasSemAfastamento(equipe?: string): Promise<Policial[]> {
    const params = new URLSearchParams();
    if (equipe) params.append('equipe', equipe);
    const query = params.toString();
    return request<Policial[]>(`/policiais/ferias-programadas-sem-afastamento${query ? `?${query}` : ''}`);
  },

  /** Policiais com férias programadas em meses anteriores (atrasadas) que ainda não têm afastamento de Férias cadastrado. */
  async getPoliciaisComFeriasAtrasadasSemAfastamento(equipe?: string): Promise<Policial[]> {
    const params = new URLSearchParams();
    if (equipe) params.append('equipe', equipe);
    const query = params.toString();
    return request<Policial[]>(`/policiais/ferias-programadas-atrasadas-sem-afastamento${query ? `?${query}` : ''}`);
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
    payload: Partial<CreatePolicialInput> & {
      mesPrevisaoFerias?: number | null;
      anoPrevisaoFerias?: number | null;
      feriasConfirmadas?: boolean;
      feriasReprogramadas?: boolean;
      somenteAnoPrevisaoFerias?: boolean;
    },
  ): Promise<Policial> {
    const data = await request<Policial>(`/policiais/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  /** Exclui previsão (`FeriasPolicial`) só para exercício anterior ao ano civil e sem afastamento de Férias ativo na cota. */
  async deletePrevisaoFeriasExercicio(policialId: number, anoExercicio: number): Promise<Policial> {
    const data = await request<Policial>(`/policiais/${policialId}/previsao-ferias/${anoExercicio}`, {
      method: 'DELETE',
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

  async desativarPolicial(
    id: number,
    body: { dataAPartirDe?: string; observacoes?: string },
  ): Promise<void> {
    await request(`/policiais/${id}/desativar`, {
      method: 'PATCH',
      body: JSON.stringify(body),
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

  async createRestricaoMedicaOption(payload: { nome: string; descricao?: string | null }): Promise<RestricaoMedica> {
    const data = await request<RestricaoMedica>('/policiais/restricoes-medicas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async updateRestricaoMedicaOption(
    id: number,
    payload: { nome?: string; descricao?: string | null },
  ): Promise<RestricaoMedica> {
    const data = await request<RestricaoMedica>(`/policiais/restricoes-medicas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async deleteRestricaoMedicaOption(id: number): Promise<void> {
    await request(`/policiais/restricoes-medicas/${id}`, { method: 'DELETE' });
    clearCache();
  },

  async updateRestricaoMedicaPolicial(
    id: number,
    restricaoMedicaId: number | null,
    observacao?: string | null,
  ): Promise<Policial> {
    const data = await request<Policial>(`/policiais/${id}/restricao-medica`, {
      method: 'PATCH',
      body: JSON.stringify({ restricaoMedicaId, observacao }),
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

  async deleteRestricaoMedicaHistorico(
    policialId: number,
    historicoId: number,
  ): Promise<Policial> {
    const data = await request<Policial>(`/policiais/${policialId}/restricao-medica/historico/${historicoId}`, {
      method: 'DELETE',
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

  async listHorariosSvg(): Promise<HorarioSvg[]> {
    const cacheKey = 'GET:/svg/horarios';
    const cached = getCached<HorarioSvg[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await request<HorarioSvg[]>('/svg/horarios');
    setCached(cacheKey, data);
    return data;
  },

  async createHorarioSvg(payload: { horaInicio: string; horaFim: string }): Promise<HorarioSvg> {
    const data = await request<HorarioSvg>('/svg/horarios', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async deleteHorarioSvg(id: number): Promise<void> {
    await request(`/svg/horarios/${id}`, { method: 'DELETE' });
    clearCache();
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

  async desativarAfastamento(id: number): Promise<Afastamento> {
    const data = await request<Afastamento>(`/afastamentos/${id}/desativar`, {
      method: 'PATCH',
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

  async disableRestricaoAfastamento(id: number): Promise<RestricaoAfastamento> {
    const data = await request<RestricaoAfastamento>(`/restricoes-afastamento/${id}/desativar`, {
      method: 'PATCH',
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

  // Motivos de Afastamento CRUD
  async createMotivo(payload: { nome: string; descricao?: string | null }): Promise<MotivoAfastamentoOption> {
    const data = await request<MotivoAfastamentoOption>('/afastamentos/motivos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async updateMotivo(
    id: number,
    payload: { nome?: string; descricao?: string | null },
  ): Promise<MotivoAfastamentoOption> {
    const data = await request<MotivoAfastamentoOption>(`/afastamentos/motivos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async deleteMotivo(id: number): Promise<void> {
    await request(`/afastamentos/motivos/${id}`, {
      method: 'DELETE',
    });
    clearCache();
  },

  // Tipos de Restrição de Afastamento CRUD
  async createTipoRestricaoAfastamento(payload: { nome: string; descricao?: string | null }): Promise<TipoRestricaoAfastamento> {
    const data = await request<TipoRestricaoAfastamento>('/restricoes-afastamento/tipos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async updateTipoRestricaoAfastamento(
    id: number,
    payload: { nome?: string; descricao?: string | null },
  ): Promise<TipoRestricaoAfastamento> {
    const data = await request<TipoRestricaoAfastamento>(`/restricoes-afastamento/tipos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async deleteTipoRestricaoAfastamento(id: number): Promise<void> {
    await request(`/restricoes-afastamento/tipos/${id}`, {
      method: 'DELETE',
    });
    clearCache();
  },

  // Status de Policial CRUD
  async listStatusPolicial(): Promise<StatusPolicialOption[]> {
    const cacheKey = 'GET:/policiais/status';
    const cached = getCached<StatusPolicialOption[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await request<StatusPolicialOption[]>('/policiais/status');
    setCached(cacheKey, data);
    return data;
  },

  async createStatusPolicial(payload: { nome: string; descricao?: string | null }): Promise<StatusPolicialOption> {
    const data = await request<StatusPolicialOption>('/policiais/status', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async updateStatusPolicial(
    id: number,
    payload: { nome?: string; descricao?: string | null },
  ): Promise<StatusPolicialOption> {
    const data = await request<StatusPolicialOption>(`/policiais/status/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async deleteStatusPolicial(id: number): Promise<void> {
    await request(`/policiais/status/${id}`, {
      method: 'DELETE',
    });
    clearCache();
  },

  async getEscalaParametros(): Promise<EscalaParametros> {
    const cacheKey = 'GET:/escalas/parametros';
    const cached = getCached<EscalaParametros>(cacheKey);
    if (cached) {
      return cached;
    }
    const data = await request<EscalaParametros>('/escalas/parametros');
    setCached(cacheKey, data);
    return data;
  },

  async updateEscalaParametros(payload: Partial<EscalaParametros>): Promise<EscalaParametros> {
    const data = await request<EscalaParametros>('/escalas/parametros', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async listEscalaInformacoes(options?: { todos?: boolean }): Promise<EscalaInformacao[]> {
    const path = options?.todos ? '/escalas/informacoes?todos=1' : '/escalas/informacoes';
    const data = await request<EscalaInformacao[]>(path);
    return data;
  },

  async createEscalaInformacao(payload: {
    titulo: string;
    conteudo: string;
    ordem?: number;
  }): Promise<EscalaInformacao> {
    const data = await request<EscalaInformacao>('/escalas/informacoes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async updateEscalaInformacao(
    id: number,
    payload: Partial<Pick<EscalaInformacao, 'titulo' | 'conteudo' | 'ordem' | 'ativo'>>,
  ): Promise<EscalaInformacao> {
    const data = await request<EscalaInformacao>(`/escalas/informacoes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async deleteEscalaInformacao(id: number): Promise<void> {
    await request(`/escalas/informacoes/${id}`, {
      method: 'DELETE',
    });
    clearCache();
  },

  async createEscalaGerada(payload: {
    dataEscala: string;
    tipoServico: string;
    resumoEquipes?: string | null;
    /** Objeto igual ao da janela definitiva (opcional; recomendado para visualização fiel). */
    impressaoDraft?: Record<string, unknown>;
    linhas: Array<{
      lista: 'DISPONIVEL' | 'AFASTADO';
      policialId: number;
      nome: string;
      matricula: string;
      equipe?: string | null;
      horarioServico: string;
      funcaoNome?: string | null;
      detalheAfastamento?: string | null;
    }>;
  }): Promise<EscalaGerada> {
    const data = await request<EscalaGerada>('/escalas/geradas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async listEscalaGeradas(params?: { take?: number; skip?: number }): Promise<EscalaGeradaResumo[]> {
    const q = new URLSearchParams();
    if (params?.take != null) q.set('take', String(params.take));
    if (params?.skip != null) q.set('skip', String(params.skip));
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return request<EscalaGeradaResumo[]>(`/escalas/geradas${suffix}`);
  },

  async listQuantitativoExtrasPoliciais(): Promise<QuantitativoExtraPolicialItem[]> {
    return request<QuantitativoExtraPolicialItem[]>('/escalas/quantitativo-extras');
  },

  async deleteQuantitativoExtraPolicial(policialId: number): Promise<void> {
    await request(`/escalas/quantitativo-extras/${policialId}`, {
      method: 'DELETE',
    });
    clearCache();
  },

  async getEscalaGerada(id: number): Promise<EscalaGerada> {
    return request<EscalaGerada>(`/escalas/geradas/${id}`);
  },

  async desativarEscalaGerada(id: number): Promise<void> {
    await request(`/escalas/geradas/${id}/desativar`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    clearCache();
  },

  async deleteEscalaGerada(id: number): Promise<void> {
    await request(`/escalas/geradas/${id}`, {
      method: 'DELETE',
    });
    clearCache();
  },

  async processarRevertesTrocaServico(): Promise<{ policiaisRestaurados: number }> {
    return request<{ policiaisRestaurados: number }>('/troca-servico/processar-revertes', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async createTrocaServico(payload: {
    policialOrigemId: number;
    policialOutroId: number;
    dataServicoPolicialOrigem: string;
    dataServicoPolicialOutro: string;
  }): Promise<TrocaServico> {
    const data = await request<TrocaServico>('/troca-servico', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  /** Trocas ATIVA e CONCLUIDA (histórico recente, inclusive retroativas já processadas). */
  async listTrocasServicoAtivas(): Promise<TrocaServicoAtivaListaItem[]> {
    return request<TrocaServicoAtivaListaItem[]>('/troca-servico/ativas');
  },

  async updateTrocaServicoDatas(
    id: number,
    payload: {
      dataServicoA: string;
      dataServicoB: string;
      turnoServicoA?: 'DIURNO' | 'NOTURNO';
      turnoServicoB?: 'DIURNO' | 'NOTURNO';
    },
  ): Promise<TrocaServico> {
    const data = await request<TrocaServico>(`/troca-servico/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    clearCache();
    return data;
  },

  async cancelarTrocaServico(id: number): Promise<{ id: number; status: string }> {
    const data = await request<{ id: number; status: string }>(`/troca-servico/${id}/cancelar`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    clearCache();
    return data;
  },

  async listErrorReports(): Promise<ErrorReport[]> {
    return request<ErrorReport[]>('/error-reports');
  },

  async createErrorReport(payload: CreateErrorReportInput): Promise<ErrorReport> {
    return request<ErrorReport>('/error-reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async cancelErrorReport(id: number, payload: { motivo: string }): Promise<ErrorReport> {
    return request<ErrorReport>(`/error-reports/${id}/cancelar`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async addErrorReportComentario(
    id: number,
    payload: { texto: string },
  ): Promise<ErrorReport> {
    return request<ErrorReport>(`/error-reports/${id}/comentarios`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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

  async getErrorReportsAdminContagemAbertos(): Promise<{ total: number }> {
    return request<{ total: number }>('/error-reports/admin/contagem-abertos');
  },

  async listErrorReportsAdminTodos(): Promise<ErrorReport[]> {
    return request<ErrorReport[]>('/error-reports/admin/todos');
  },
};
