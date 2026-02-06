/** Status do policial. ASSESSOR no PDF é gravado como COMISSIONADO. */
export type PolicialExtraidoStatus = 'ATIVO' | 'COMISSIONADO' | 'PTTC' | 'DESIGNADO';

export interface PolicialExtraido {
  matricula: string;
  nome: string;
  funcaoNome: string;
  funcaoId?: number;
  /** Preenchido quando o arquivo tem coluna situação/Status (ex.: PDF com ASSESSOR -> COMISSIONADO). */
  status?: PolicialExtraidoStatus;
  /** true quando a matrícula já existe no sistema; na modal mostra "Policial já cadastrado" e não envia no bulk. */
  jaCadastrado?: boolean;
}

export interface ProcessarArquivoResponseDto {
  policiais: PolicialExtraido[];
  funcoesCriadas: string[];
  erros?: string[];
}
