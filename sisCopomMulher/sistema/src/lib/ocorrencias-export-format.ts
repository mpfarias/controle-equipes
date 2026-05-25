import type { OcorrenciaListaRow } from "@/lib/ocorrencias-list-service";
import { indicadoresFasesCadastro } from "@/lib/ocorrencia-fases-status";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export const OCORRENCIAS_EXPORT_HEADERS = [
  "ID",
  "Vítima",
  "Genitora",
  "Região administrativa",
  "Data/Hora (ocorrência ou cadastro)",
  "Fases (indicador)",
  "Última fase salva",
  "Concluída",
  "CAD",
  "Agressor",
  "Parentesco agressor × vítima",
  "Tipo ameaça ou agressão",
  "Desfecho",
  "Histórico da ocorrência",
  "CPF vítima",
  "Telefone vítima",
  "Endereço vítima",
  "Ponto de referência",
  "Comandante / viatura",
  "Responsável pelo atendimento",
  "Detalhes do encaminhamento",
  "Registrou BO na DP?",
] as const;

function dataExibicao(o: OcorrenciaListaRow): string {
  const raw = o.dataHoraOcorrencia ?? o.carimboDataHora ?? o.createdAt;
  if (!raw) return "";
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resumoFases(o: OcorrenciaListaRow): string {
  return indicadoresFasesCadastro(o)
    .map((i) => `F${i.fase}${i.completa ? "OK" : "!"}`)
    .join(" ");
}

function s(v: string | null | undefined): string {
  if (v == null) return "";
  return String(v).trim();
}

export function buildExportMatrix(rows: OcorrenciaListaRow[]): string[][] {
  return rows.map((o) => [
    o.id,
    s(o.nomeVitima),
    s(o.genitoraVitima),
    s(o.regiaoAdministrativa),
    dataExibicao(o),
    resumoFases(o),
    String(o.faseAtual ?? ""),
    o.concluida ? "Sim" : "Não",
    s(o.numeroOcorrenciaCad),
    s(o.nomeAgressor),
    s(o.parentescoAgressorVitima),
    s(o.tipoAmeacaAgressao),
    s(o.desfecho),
    s(o.historicoOcorrencia),
    s(o.cpfVitima),
    s(o.telefoneVitima),
    s(o.enderecoVitima),
    s(o.pontoReferencia),
    s(o.comandanteViatura),
    s(o.responsavelAtendimento),
    s(o.encaminhamentoDetalhes),
    s(o.registrouBoDp),
  ]);
}

function csvEscape(cell: string): string {
  const x = cell.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[;\n"]/.test(x)) return `"${x.replace(/"/g, '""')}"`;
  return x;
}

/** BOM UTF-8 + separador `;` (Excel PT-BR). */
export function buildExportCsv(rows: OcorrenciaListaRow[]): string {
  const matrix = buildExportMatrix(rows);
  const headerLine = [...OCORRENCIAS_EXPORT_HEADERS].map(csvEscape).join(";");
  const lines = matrix.map((line) => line.map(csvEscape).join(";"));
  return `\ufeff${headerLine}\r\n${lines.join("\r\n")}`;
}

export function buildExportXlsxBuffer(rows: OcorrenciaListaRow[]): Buffer {
  const matrix = buildExportMatrix(rows);
  const aoa = [[...OCORRENCIAS_EXPORT_HEADERS], ...matrix];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ocorrências");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buf;
}

const PDF_TRUNC = 120;

function truncatePdfCell(cell: string, max = PDF_TRUNC): string {
  const t = cell.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildExportPdfBuffer(rows: OcorrenciaListaRow[]): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setProperties({ title: "Exportacao - ocorrencias", subject: "Listagem" });

  const now = new Date().toLocaleString("pt-BR");
  doc.setFontSize(13);
  doc.text("COPOM Mulher - Relatorio de Ocorrencias", 8, 10);
  doc.setFontSize(9);
  doc.text(`Gerado em: ${now}`, 8, 15);
  doc.text(`Total de linhas: ${rows.length}`, 8, 20);

  const head = [
    [
      "Data/Hora",
      "Vitima",
      "Regiao",
      "CAD",
      "Agressor",
      "Tipo",
      "Desfecho",
      "Responsavel",
      "Historico",
    ],
  ];

  const body = rows.map((o) => [
    truncatePdfCell(dataExibicao(o), 22),
    truncatePdfCell(s(o.nomeVitima) || s(o.genitoraVitima), 44),
    truncatePdfCell(s(o.regiaoAdministrativa), 22),
    truncatePdfCell(s(o.numeroOcorrenciaCad), 16),
    truncatePdfCell(s(o.nomeAgressor), 32),
    truncatePdfCell(s(o.tipoAmeacaAgressao), 28),
    truncatePdfCell(s(o.desfecho), 28),
    truncatePdfCell(s(o.responsavelAtendimento), 30),
    truncatePdfCell(s(o.historicoOcorrencia), 180),
  ]);

  autoTable(doc, {
    startY: 24,
    head,
    body,
    styles: { fontSize: 7, cellPadding: 1.2, overflow: "linebreak", valign: "top", lineColor: [220, 220, 220] },
    headStyles: { fillColor: [88, 28, 135], textColor: 255, fontStyle: "bold", halign: "center" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 36 },
      2: { cellWidth: 20 },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 28 },
      5: { cellWidth: 24 },
      6: { cellWidth: 24 },
      7: { cellWidth: 28 },
      8: { cellWidth: 72 },
    },
    margin: { top: 24, left: 8, right: 8, bottom: 12 },
    didDrawPage: (data) => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(`Pagina ${data.pageNumber} de ${page}`, data.settings.margin.left, doc.internal.pageSize.getHeight() - 5);
    },
  });

  const out = doc.output("arraybuffer");
  return Buffer.from(out);
}
