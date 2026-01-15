export interface PolicialExtraido {
  matricula: string;
  nome: string;
  funcaoNome: string;
  funcaoId?: number;
}

export interface ProcessarArquivoResponseDto {
  policiais: PolicialExtraido[];
  funcoesCriadas: string[];
  erros?: string[];
}
