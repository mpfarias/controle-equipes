import type {
  Afastamento,
  Policial,
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
} from './types.ts';

const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://10.95.91.53:3002';

const TOKEN_STORAGE_KEY = 'afastamentos-web:token';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function removeToken(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
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

export const api = {
  async listUsuarios(currentUserId?: number): Promise<Usuario[]> {
    const url = currentUserId
      ? `/usuarios?currentUserId=${currentUserId}`
      : '/usuarios';
    return request(url);
  },

  async getUsuario(id: number): Promise<Usuario> {
    return request(`/usuarios/${id}`);
  },

  async listUsuarioNiveis(): Promise<UsuarioNivelOption[]> {
    return request('/usuarios/niveis');
  },

  async listFuncoes(): Promise<FuncaoOption[]> {
    return request('/usuarios/funcoes');
  },

  async createUsuario(payload: CreateUsuarioInput): Promise<Usuario> {
    return request('/usuarios', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateUsuario(
    id: number,
    payload: Partial<CreateUsuarioInput>,
  ): Promise<Usuario> {
    return request(`/usuarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async login(payload: LoginInput): Promise<{ accessToken: string; usuario: Usuario }> {
    const response = await request<{ accessToken: string; usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    // Armazenar token automaticamente após login
    setToken(response.accessToken);
    return response;
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

  async resetPassword(
    token: string,
    novaSenha: string,
  ): Promise<{ message: string }> {
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, novaSenha }),
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
  },

  async activateUsuario(id: number): Promise<Usuario> {
    return request(`/usuarios/${id}/activate`, {
      method: 'PATCH',
    });
  },

  async deleteUsuario(id: number, senha: string): Promise<void> {
    await request(`/usuarios/${id}/delete-permanent`, {
      method: 'POST',
      body: JSON.stringify({ senha }),
    });
  },

  async listPoliciais(): Promise<Policial[]> {
    return request('/policiais');
  },

  async createPolicial(payload: CreatePolicialInput): Promise<Policial> {
    return request('/policiais', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updatePolicial(
    id: number,
    payload: Partial<CreatePolicialInput>,
  ): Promise<Policial> {
    return request(`/policiais/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async removePolicial(id: number): Promise<void> {
    await request(`/policiais/${id}`, {
      method: 'DELETE',
    });
  },

  async activatePolicial(id: number): Promise<Policial> {
    return request(`/policiais/${id}/activate`, {
      method: 'PATCH',
    });
  },

  async deletePolicial(id: number, senha: string): Promise<void> {
    await request(`/policiais/${id}/delete-permanent`, {
      method: 'POST',
      body: JSON.stringify({ senha }),
    });
  },

  async listMotivos(): Promise<MotivoAfastamentoOption[]> {
    return request('/afastamentos/motivos');
  },

  async listAfastamentos(policialId?: number): Promise<Afastamento[]> {
    const url = policialId ? `/afastamentos?policialId=${policialId}` : '/afastamentos';
    return request(url);
  },

  async createAfastamento(payload: CreateAfastamentoInput): Promise<Afastamento> {
    return request('/afastamentos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateAfastamento(
    id: number,
    payload: Partial<CreateAfastamentoInput>,
  ): Promise<Afastamento> {
    return request(`/afastamentos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async removeAfastamento(id: number): Promise<void> {
    await request(`/afastamentos/${id}`, {
      method: 'DELETE',
    });
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
    return request('/policiais/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
};
