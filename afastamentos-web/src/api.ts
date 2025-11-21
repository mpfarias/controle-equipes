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
    try {
      const data = await response.json();
      detail = data?.message ?? JSON.stringify(data);
    } catch (error) {
      detail = response.statusText;
    }
    throw new Error(detail || 'Falha ao comunicar com a API.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  async listUsuarios(): Promise<Usuario[]> {
    return request('/usuarios');
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

  async removeUsuario(id: number, responsavelId?: number): Promise<void> {
    await request(`/usuarios/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ responsavelId }),
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
