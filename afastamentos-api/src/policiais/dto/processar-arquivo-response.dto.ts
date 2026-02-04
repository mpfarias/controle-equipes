/** Status do policial. ASSESSOR no PDF é gravado como COMISSIONADO. */
export type PolicialExtraidoStatus = 'ATIVO' | 'COMISSIONADO' | 'PTTC' | 'DESIGNADO';

export interface PolicialExtraido {
  matricula: string;
  nome: string;
  funcaoNome: string;
  funcaoId?: number;
  /** Preenchido quando o arquivo tem coluna situação/Status (ex.: PDF com ASSESSOR -> COMISSIONADO). */
  status?: PolicialExtraidoStatus;
}

export interface ProcessarArquivoResponseDto {
  policiais: PolicialExtraido[];
  funcoesCriadas: string[];
  erros?: string[];
}
