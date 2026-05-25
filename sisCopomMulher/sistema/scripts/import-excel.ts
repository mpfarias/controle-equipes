import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { appendExcelImport } from "../src/server/services/excel-import.service";
import { formatExcelNotFoundMessage, resolveExcelPath, resolveExcelPathFromCliArg } from "../src/lib/excel-path";

const prisma = new PrismaClient();

/** Acrescenta linhas do Excel sem apagar (pode duplicar). Preferível: `npm run import:excel:refresh`. */
async function main() {
  const fromCli = resolveExcelPathFromCliArg(2);
  const excelPath = fromCli ?? resolveExcelPath();
  if (!excelPath) {
    if (process.argv[2]?.trim()) {
      console.error("Ficheiro não encontrado:", process.argv[2]);
    }
    console.error(formatExcelNotFoundMessage());
    console.error(
      '\nDica: copie "FormularioViolenciaDomestica (respostas).xlsx" para sistema/data/ ou passe o caminho completo como argumento.',
    );
    process.exit(1);
  }
  console.log("Usando arquivo:", excelPath);
  const result = await appendExcelImport(prisma, excelPath);
  console.log("Importadas:", result.inserted, "| Ignoradas (erro de linha):", result.skipped);
  if (result.errors.length) {
    console.log("Primeiros avisos:", result.errors.slice(0, 10).join("\n"));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
