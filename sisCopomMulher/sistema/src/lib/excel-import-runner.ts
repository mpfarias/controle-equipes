import * as fs from "fs";
import * as XLSX from "xlsx";
import type { Prisma, PrismaClient } from "@prisma/client";
import { sheetRowToOccurrence } from "./excel-import";

/** Lotes para createMany no PostgreSQL (maior = menos round-trips; ~1–2k é estável no PG). */
const BATCH_SIZE = 1200;

const XLSX_READ_OPTS = {
  cellDates: true,
  cellNF: false,
  cellStyles: false,
  cellFormula: false,
  cellHTML: false,
} as const;

export type ImportExcelResult = {
  inserted: number;
  skipped: number;
  errors: string[];
};

export async function importExcelFromPath(prisma: PrismaClient, absPath: string): Promise<ImportExcelResult> {
  if (!fs.existsSync(absPath)) {
    throw new Error(`Arquivo não encontrado: ${absPath}`);
  }
  const wb = XLSX.readFile(absPath, XLSX_READ_OPTS);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  }) as unknown[][];
  if (!rows.length) {
    throw new Error("Planilha vazia.");
  }
  const headers = (rows[0] as unknown[]).map((c) => String(c ?? ""));
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];
  const batch: Prisma.OccurrenceCreateManyInput[] = [];

  async function flush() {
    if (batch.length === 0) return;
    const slice = batch.splice(0, batch.length);
    try {
      await prisma.occurrence.createMany({ data: slice });
      inserted += slice.length;
    } catch {
      for (const row of slice) {
        try {
          await prisma.occurrence.create({ data: row as Prisma.OccurrenceCreateInput });
          inserted++;
        } catch (e2) {
          skipped++;
          if (errors.length < 25) {
            errors.push(e2 instanceof Error ? e2.message : String(e2));
          }
        }
      }
    }
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    if (!row || row.every((c) => c === null || c === undefined || c === "")) {
      continue;
    }
    try {
      const data = sheetRowToOccurrence(headers, row);
      if (data == null) {
        skipped++;
        continue;
      }
      batch.push(data as Prisma.OccurrenceCreateManyInput);
      if (batch.length >= BATCH_SIZE) {
        await flush();
      }
    } catch (e) {
      skipped++;
      if (errors.length < 25) {
        errors.push(`Linha ${r + 1}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  await flush();

  return { inserted, skipped, errors };
}

/** Atualiza estatísticas do planner após importação em massa (PostgreSQL). */
export async function analyzeOccurrenceTable(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`ANALYZE "Occurrence"`);
}
