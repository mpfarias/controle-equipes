import * as XLSX from 'xlsx';
import type {
  ChamadaXlsxColunaCampo,
  ChamadaXlsxRow,
  ParseChamadasXlsxResult,
} from '../types/chamadasXlsx';

function normalizarCabecalho(s: string): string {
  return s
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

type ColunaSpec = {
  campo: ChamadaXlsxColunaCampo;
  rotulo: string;
  /** Colunas numéricas longas (ID, Unique ID): prioriza texto exibido no Excel e evita notação científica. */
  modoId?: boolean;
};

/** Cabeçalhos esperados na primeira linha; `Unique ID` e `Chamador` são sempre duas colunas separadas. */
const COLUNAS_ESPERADAS: readonly ColunaSpec[] = [
  { campo: 'id', rotulo: 'ID', modoId: true },
  { campo: 'uniqueId', rotulo: 'Unique ID', modoId: true },
  { campo: 'chamador', rotulo: 'Chamador' },
  { campo: 'fila', rotulo: 'Fila' },
  { campo: 'ramal', rotulo: 'Ramal' },
  { campo: 'status', rotulo: 'Status' },
  { campo: 'horaEntradaFila', rotulo: 'Hora Entrada Fila' },
  { campo: 'horaAtendimento', rotulo: 'Hora Atendimento' },
  { campo: 'horaDesligamento', rotulo: 'Hora Desligamento' },
  { campo: 'tempoEsperaSeg', rotulo: 'Tempo de Espera (s)' },
  { campo: 'duracaoSeg', rotulo: 'Duração (s)' },
  { campo: 'quemDesligou', rotulo: 'Quem Desligou' },
  { campo: 'atendente', rotulo: 'Atendente' },
  { campo: 'motivoEncerramento', rotulo: 'Motivo Encerramento' },
  { campo: 'longitude', rotulo: 'Longitude' },
  { campo: 'latitude', rotulo: 'Latitude' },
] as const;

/** Índice de coluna 0-based (A=0), como em `encode_cell`. */
type ColunaSheet = number;

function obterCelula(sheet: XLSX.WorkSheet, row: number, col: ColunaSheet): XLSX.CellObject | undefined {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  return sheet[addr] as XLSX.CellObject | undefined;
}

/** Evita notação científica e truncamento típico de `String(number)` em inteiros grandes (dentro do limite seguro). */
function numeroInteiroParaTextoId(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (!Number.isInteger(n)) return String(n);
  const t = Math.trunc(n);
  if (Math.abs(t) <= Number.MAX_SAFE_INTEGER) {
    return String(t);
  }
  try {
    return BigInt(t).toString();
  } catch {
    return n.toLocaleString('en-US', { maximumFractionDigits: 0, useGrouping: false });
  }
}

/**
 * Lê o valor exibido pelo Excel quando possível (`.w`), essencial para ID / Unique ID numéricos longos.
 * @param modoId — reforça leitura numérica sem notação científica quando não há `.w`.
 */
function textoDaCelula(
  sheet: XLSX.WorkSheet,
  row: number,
  col: ColunaSheet,
  modoId: boolean,
): string {
  const cell = obterCelula(sheet, row, col);
  if (!cell || cell.v === undefined || cell.v === null) {
    return '';
  }

  if (typeof cell.w === 'string') {
    const w = cell.w.trim();
    if (w !== '') return w;
  }

  try {
    const fmt = XLSX.utils.format_cell(cell);
    if (fmt != null && String(fmt).trim() !== '') {
      return String(fmt).trim();
    }
  } catch {
    /* ignorar */
  }

  if (modoId && cell.t === 'n' && typeof cell.v === 'number') {
    return numeroInteiroParaTextoId(cell.v);
  }

  return celulaParaTexto(cell.v);
}

export function celulaParaTexto(v: unknown): string {
  if (v == null || v === '') return '';
  if (v instanceof Date) {
    if (!Number.isNaN(v.getTime())) {
      return v.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
    }
    return '';
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return String(v);
  }
  return String(v).trim();
}

/**
 * Lê a primeira planilha de um arquivo XLSX e mapeia linhas para {@link ChamadaXlsxRow}
 * com base nos cabeçalhos esperados (comparação normalizada: espaços e maiúsculas).
 */
export function parseChamadasXlsxBuffer(buffer: ArrayBuffer): ParseChamadasXlsxResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      cellText: true,
      dense: false,
    });
  } catch {
    return { ok: false, error: 'Não foi possível abrir o arquivo. Verifique se é um XLSX válido.' };
  }

  const nomeAba = workbook.SheetNames[0];
  if (!nomeAba) {
    return { ok: false, error: 'O arquivo não contém nenhuma planilha.' };
  }

  const sheet = workbook.Sheets[nomeAba];
  if (!sheet['!ref']) {
    return { ok: false, error: 'A planilha está vazia.' };
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const colinfo = sheet['!cols'] || [];
  const rowinfo = sheet['!rows'] || [];

  const colunasVisiveis: ColunaSheet[] = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    if ((colinfo[C] || {}).hidden) continue;
    colunasVisiveis.push(C);
  }

  if (colunasVisiveis.length === 0) {
    return { ok: false, error: 'A planilha não tem colunas visíveis para leitura.' };
  }

  const headerR = range.s.r;
  const headerNorm = colunasVisiveis.map((C) =>
    normalizarCabecalho(textoDaCelula(sheet, headerR, C, false)),
  );

  const indicePorCampo = new Map<ChamadaXlsxColunaCampo, ColunaSheet>();
  const faltando: string[] = [];

  for (const { campo, rotulo } of COLUNAS_ESPERADAS) {
    const alvo = normalizarCabecalho(rotulo);
    const idx = headerNorm.findIndex((h) => h === alvo);
    if (idx === -1) {
      faltando.push(rotulo);
    } else {
      indicePorCampo.set(campo, colunasVisiveis[idx]!);
    }
  }

  if (faltando.length > 0) {
    return {
      ok: false,
      error: `Cabeçalhos obrigatórios ausentes ou com nome diferente do esperado: ${faltando.join('; ')}.`,
    };
  }

  const colunasChecagemVazio = new Set<ColunaSheet>(indicePorCampo.values());

  const rows: ChamadaXlsxRow[] = [];
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    if ((rowinfo[R] || {}).hidden) continue;

    if ([...colunasChecagemVazio].every((c) => textoDaCelula(sheet, R, c, false) === '')) {
      continue;
    }

    const row = {} as ChamadaXlsxRow;
    for (const { campo, modoId } of COLUNAS_ESPERADAS) {
      row[campo] = textoDaCelula(sheet, R, indicePorCampo.get(campo)!, modoId ?? false);
    }

    rows.push(row);
  }

  return {
    ok: true,
    rows,
    nomePrimeiraAba: nomeAba,
  };
}
