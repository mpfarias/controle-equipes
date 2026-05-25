/**
 * Serviço (modelo de negócio): lê Excel apenas nestas operações explícitas.
 * O resto da aplicação usa só PostgreSQL via Prisma.
 */
import type { PrismaClient } from "@prisma/client";
import { analyzeOccurrenceTable, importExcelFromPath } from "@/lib/excel-import-runner";

export type ExcelImportServiceResult = {
  removedPreviousExcelRows?: number;
  inserted: number;
  skipped: number;
  errors: string[];
};

/** Remove ocorrências importadas anteriormente e volta a importar o ficheiro (sem duplicar origem Excel). */
export async function replaceExcelImport(prisma: PrismaClient, absPath: string): Promise<ExcelImportServiceResult> {
  const del = await prisma.occurrence.deleteMany({ where: { origem: "IMPORTACAO_EXCEL" } });
  const { inserted, skipped, errors } = await importExcelFromPath(prisma, absPath);
  await analyzeOccurrenceTable(prisma);
  return { removedPreviousExcelRows: del.count, inserted, skipped, errors };
}

/** Insere linhas do Excel sem apagar (pode duplicar dados — uso avançado). */
export async function appendExcelImport(prisma: PrismaClient, absPath: string): Promise<ExcelImportServiceResult> {
  const { inserted, skipped, errors } = await importExcelFromPath(prisma, absPath);
  await analyzeOccurrenceTable(prisma);
  return { inserted, skipped, errors };
}
