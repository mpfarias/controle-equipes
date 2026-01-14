export interface ColaboradorExtraido {
  matricula: string;
  nome: string;
  funcaoNome: string;
  funcaoId?: number;
}

export interface ProcessarArquivoResponseDto {
  colaboradores: ColaboradorExtraido[];
  funcoesCriadas: string[];
  erros?: string[];
}
