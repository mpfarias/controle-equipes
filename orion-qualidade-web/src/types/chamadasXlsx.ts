/** Uma linha de dados após leitura do XLSX (valores como texto para exibição e etapas seguintes). */
export type ChamadaXlsxRow = {
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
  longitude: string;
  latitude: string;
};

export type ChamadaXlsxColunaCampo = keyof ChamadaXlsxRow;

export type ParseChamadasXlsxOk = {
  ok: true;
  rows: ChamadaXlsxRow[];
  nomePrimeiraAba: string;
};

export type ParseChamadasXlsxErro = {
  ok: false;
  error: string;
};

export type ParseChamadasXlsxResult = ParseChamadasXlsxOk | ParseChamadasXlsxErro;
