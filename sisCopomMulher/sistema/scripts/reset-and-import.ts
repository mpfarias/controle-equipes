/**
 * Zera TODAS as ocorrências no PostgreSQL e importa de novo a partir do Excel
 * (usuários e auditoria permanecem). Use quando quiser dados “do zero”.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { analyzeOccurrenceTable, importExcelFromPath } from "../src/lib/excel-import-runner";
import { formatExcelNotFoundMessage, resolveExcelPath } from "../src/lib/excel-path";

const prisma = new PrismaClient();

async function main() {
  const rem = await prisma.occurrence.deleteMany({});
  console.log("[1/2] Todas as ocorrências removidas:", rem.count);

  const excelPath = resolveExcelPath();
  if (!excelPath) {
    console.error("[2/2] Nenhum Excel encontrado.\n", formatExcelNotFoundMessage());
    console.error('\nCrie um arquivo de teste: npm run data:sample\nOu coloque a planilha e defina EXCEL_PATH no .env.');
    process.exit(1);
  }

  console.log("[2/2] Importando:", excelPath);
  const { inserted, skipped, errors } = await importExcelFromPath(prisma, excelPath);
  console.log("Importação concluída — inseridas:", inserted, "| linhas ignoradas (erro):", skipped);
  if (errors.length) {
    console.log("Primeiros avisos de linha:", errors.slice(0, 15).join("\n"));
  }
  await analyzeOccurrenceTable(prisma);

  const total = await prisma.occurrence.count();
  console.log("Total de ocorrências no banco agora:", total);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
