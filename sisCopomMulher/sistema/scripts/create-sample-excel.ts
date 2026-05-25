/**
 * Gera `data/sample-ocorrencias.xlsx` com poucas linhas para teste local
 * quando a planilha completa do Google Forms ainda não está no repositório.
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

const headers = [
  "Carimbo de data/hora",
  "Nome da vítima",
  "Nome do agressor",
  "Região administrativa da ocorrência",
  "Tipo de ameaça ou agressão",
  "Histórico da ocorrência",
  "Desfecho",
  "Número ocorrência CAD COPOM PMDF",
];

const now = new Date();
const rows: (string | Date)[][] = [
  [
    now,
    "Vitima Demonstração 1",
    "Agressor Demonstração 1",
    "Plano Piloto",
    "Ameaça verbal",
    "Registro de exemplo gerado automaticamente.",
    "Encaminhamento à DP",
    "CAD-DEMO-0001",
  ],
  [
    now,
    "Vitima Demonstração 2",
    "Agressor Demonstração 2",
    "Taguatinga",
    "Lesão corporal",
    "Segundo registro de exemplo.",
    "BO registrado",
    "CAD-DEMO-0002",
  ],
];

async function main() {
  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "sample-ocorrencias.xlsx");
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Respostas");
  XLSX.writeFile(wb, outPath);
  console.log("Arquivo criado:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
