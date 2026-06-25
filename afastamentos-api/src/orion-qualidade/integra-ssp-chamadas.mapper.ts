import { formatDateTimeBrasilia } from './integra-ssp-brasilia.util';
import {
  type RecordFileConfig,
  resolveRecordFileDownloadUrl,
} from './integra-ssp-record-file.util';

export type ChamadaIntegraSspRow = {
  id: number | string;
  unique_id?: string | null;
  chamador?: string | null;
  fila?: string | null;
  ramal?: string | null;
  status?: string | null;
  hora_entra_fila?: Date | string | null;
  hora_atende?: Date | string | null;
  hora_desliga?: Date | string | null;
  tempo_espera?: number | string | null;
  duracao?: number | string | null;
  quem_desliga?: string | null;
  NO_USER_CADASTRO?: string | null;
  motivo_encerramento?: string | null;
  record_file?: string | null;
  latitude?: string | null;
  longitude?: string | null;
};

export type ChamadaQualidadeApiRow = {
  id: string;
  uniqueId: string;
  chamador: string;
  fila: string;
  ramal: string;
  status: string;
  horaEntradaFila: string;
  horaAtendimento: string;
  horaDesligamento: string;
  tempoEsperaSeg: string;
  duracaoSeg: string;
  quemDesligou: string;
  atendente: string;
  motivoEncerramento: string;
  recordFile: string;
  recordFileUrl: string;
  longitude: string;
  latitude: string;
};

function textoCampo(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function textoNumero(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v));
  return textoCampo(v);
}

export function mapChamadaIntegraSspParaApi(row: ChamadaIntegraSspRow): ChamadaQualidadeApiRow {
  return {
    id: textoCampo(row.id),
    uniqueId: textoCampo(row.unique_id),
    chamador: textoCampo(row.chamador),
    fila: textoCampo(row.fila),
    ramal: textoCampo(row.ramal),
    status: textoCampo(row.status),
    horaEntradaFila: formatDateTimeBrasilia(row.hora_entra_fila),
    horaAtendimento: formatDateTimeBrasilia(row.hora_atende),
    horaDesligamento: formatDateTimeBrasilia(row.hora_desliga),
    tempoEsperaSeg: textoNumero(row.tempo_espera),
    duracaoSeg: textoNumero(row.duracao),
    quemDesligou: textoCampo(row.quem_desliga),
    atendente: textoCampo(row.NO_USER_CADASTRO),
    motivoEncerramento: textoCampo(row.motivo_encerramento),
    recordFile: textoCampo(row.record_file),
    recordFileUrl: '',
    longitude: textoCampo(row.longitude),
    latitude: textoCampo(row.latitude),
  };
}

export function enrichChamadaRecordFileUrl(
  row: ChamadaQualidadeApiRow,
  config: RecordFileConfig | null,
): ChamadaQualidadeApiRow {
  return {
    ...row,
    recordFileUrl: resolveRecordFileDownloadUrl(row.recordFile, config) ?? '',
  };
}
