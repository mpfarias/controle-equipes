import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { replaceExcelImport } from "../src/server/services/excel-import.service";
import { formatExcelNotFoundMessage, resolveExcelPath, resolveExcelPathFromCliArg } from "../src/lib/excel-path";

const prisma = new PrismaClient();

/**
 * Remove registos de importação Excel anteriores e reimporta.
 * Caminho opcional: `npx tsx scripts/reimport-excel.ts "C:\\...\\FormularioViolenciaDomestica (respostas).xlsx"`
 */
async function main() {
  const fromCli = resolveExcelPathFromCliArg(2);
  const excelPath = fromCli ?? resolveExcelPath();
  if (!excelPath) {
    if (process.argv[2]?.trim()) {
      console.error("Ficheiro não encontrado:", process.argv[2]);
    }
    console.error(formatExcelNotFoundMessage());
    console.error(
      '\nDica: copie "FormularioViolenciaDomestica (respostas).xlsx" para sistema/data/ ou defina EXCEL_PATH no .env.',
    );
    process.exit(1);
  }
  console.log("Usando arquivo:", excelPath);
  const result = await replaceExcelImport(prisma, excelPath);
  console.log("Removidos (importação Excel anterior):", result.removedPreviousExcelRows ?? 0);
  console.log("Importadas:", result.inserted, "| Ignoradas:", result.skipped);
  if (result.errors.length) console.log("Avisos:", result.errors.slice(0, 10).join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
