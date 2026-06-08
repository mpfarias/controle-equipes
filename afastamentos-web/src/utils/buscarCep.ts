export type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export type EnderecoViaCep = {
  logradouro: string;
  cidade: string;
  estado: string;
};

export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoViaCep | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro) return null;
    return {
      logradouro: (data.logradouro ?? '').trim(),
      cidade: (data.localidade ?? '').trim(),
      estado: (data.uf ?? '').trim().toUpperCase(),
    };
  } catch {
    return null;
  }
}
