import type {
  Afastamento,
  Colaborador,
  CreateAfastamentoInput,
  CreateColaboradorInput,
  CreateUsuarioInput,
  LoginInput,
  Usuario,
} from './types.ts';

const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://10.95.91.53:3002';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
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
            detail = errorData.message ?? errorData.error ?? JSON.stringify(errorData);
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

  async createUsuario(
    payload: CreateUsuarioInput,
    responsavelId?: number,
  ): Promise<Usuario> {
    return request('/usuarios', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        responsavelId,
      }),
    });
  },

  async updateUsuario(
    id: number,
    payload: Partial<CreateUsuarioInput>,
    responsavelId?: number,
  ): Promise<Usuario> {
    const body: Record<string, unknown> = { ...payload };
    if (responsavelId) {
      body.responsavelId = responsavelId;
    }

    return request(`/usuarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async login(payload: LoginInput): Promise<Usuario> {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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

  async removeUsuario(id: number, responsavelId?: number): Promise<void> {
    await request(`/usuarios/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ responsavelId }),
    });
  },

  async activateUsuario(id: number, responsavelId?: number): Promise<Usuario> {
    return request(`/usuarios/${id}/activate`, {
      method: 'PATCH',
      body: JSON.stringify({ responsavelId }),
    });
  },

  async deleteUsuario(
    id: number,
    senha: string,
    responsavelId?: number,
  ): Promise<void> {
    await request(`/usuarios/${id}/permanent`, {
      method: 'DELETE',
      body: JSON.stringify({ senha, responsavelId }),
    });
  },

  async listColaboradores(): Promise<Colaborador[]> {
    return request('/colaboradores');
  },

  async createColaborador(
    payload: CreateColaboradorInput,
    responsavelId?: number,
  ): Promise<Colaborador> {
    return request('/colaboradores', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        responsavelId,
      }),
    });
  },

  async updateColaborador(
    id: number,
    payload: Partial<CreateColaboradorInput>,
    responsavelId?: number,
  ): Promise<Colaborador> {
    const body: Record<string, unknown> = { ...payload };
    if (responsavelId) {
      body.responsavelId = responsavelId;
    }

    return request(`/colaboradores/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async removeColaborador(
    id: number,
    responsavelId?: number,
  ): Promise<void> {
    await request(`/colaboradores/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ responsavelId }),
    });
  },

  async activateColaborador(
    id: number,
    responsavelId?: number,
  ): Promise<Colaborador> {
    return request(`/colaboradores/${id}/activate`, {
      method: 'PATCH',
      body: JSON.stringify({ responsavelId }),
    });
  },

  async listAfastamentos(): Promise<Afastamento[]> {
    return request('/afastamentos');
  },

  async createAfastamento(
    payload: CreateAfastamentoInput,
    responsavelId?: number,
  ): Promise<Afastamento> {
    return request('/afastamentos', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        responsavelId,
      }),
    });
  },

  async updateAfastamento(
    id: number,
    payload: Partial<CreateAfastamentoInput>,
    responsavelId?: number,
  ): Promise<Afastamento> {
    const body: Record<string, unknown> = { ...payload };
    if (responsavelId) {
      body.responsavelId = responsavelId;
    }

    return request(`/afastamentos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async removeAfastamento(
    id: number,
    responsavelId?: number,
  ): Promise<void> {
    await request(`/afastamentos/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ responsavelId }),
    });
  },
};
