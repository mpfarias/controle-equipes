import { Injectable } from '@nestjs/common';
import { MulherOrigemOcorrencia, Prisma } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma.service';
import {
  MULHER_EXCEL_BATCH_SIZE,
  MULHER_XLSX_READ_OPTS,
  sheetRowToMulherOcorrencia,
} from './mulher-excel-import.util';

export type MulherExcelImportResult = {
  removedPreviousExcelRows?: number;
  inserted: number;
  skipped: number;
  errors: string[];
};

@Injectable()
export class MulherExcelImportService {
  constructor(private readonly prisma: PrismaService) {}

  resolveDefaultExcelPath(): string | null {
    const env = process.env.MULHER_EXCEL_PATH?.trim();
    if (env && fs.existsSync(env)) return path.resolve(env);
    const candidates = [
      path.resolve(process.cwd(), '..', 'sisCopomMulher', 'FormularioViolenciaDomestica (respostas).xlsx'),
      path.resolve(process.cwd(), '..', 'sisCopomMulher', 'sistema', 'data', 'FormularioViolenciaDomestica (respostas).xlsx'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  async importFromBuffer(buffer: Buffer): Promise<Omit<MulherExcelImportResult, 'removedPreviousExcelRows'>> {
    const wb = XLSX.read(buffer, { type: 'buffer', ...MULHER_XLSX_READ_OPTS });
    return this.importWorkbook(wb);
  }

  async importFromPath(absPath: string): Promise<Omit<MulherExcelImportResult, 'removedPreviousExcelRows'>> {
    if (!fs.existsSync(absPath)) {
      throw new Error(`Arquivo não encontrado: ${absPath}`);
    }
    const wb = XLSX.readFile(absPath, MULHER_XLSX_READ_OPTS);
    return this.importWorkbook(wb);
  }

  async replaceExcelImport(source: Buffer | string): Promise<MulherExcelImportResult> {
    const del = await this.prisma.mulherOcorrencia.deleteMany({
      where: { origem: MulherOrigemOcorrencia.IMPORTACAO_EXCEL },
    });
    const result =
      typeof source === 'string' ? await this.importFromPath(source) : await this.importFromBuffer(source);
    await this.analyzeTable();
    return { removedPreviousExcelRows: del.count, ...result };
  }

  async appendExcelImport(source: Buffer | string): Promise<MulherExcelImportResult> {
    const result =
      typeof source === 'string' ? await this.importFromPath(source) : await this.importFromBuffer(source);
    await this.analyzeTable();
    return result;
  }

  private async importWorkbook(wb: XLSX.WorkBook) {
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    }) as unknown[][];
    if (!rows.length) throw new Error('Planilha vazia.');

    const headers = (rows[0] as unknown[]).map((c) => String(c ?? ''));
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];
    const batch: Prisma.MulherOcorrenciaCreateManyInput[] = [];

    const flush = async () => {
      if (batch.length === 0) return;
      const slice = batch.splice(0, batch.length);
      try {
        await this.prisma.mulherOcorrencia.createMany({ data: slice });
        inserted += slice.length;
      } catch {
        for (const row of slice) {
          try {
            await this.prisma.mulherOcorrencia.create({ data: row });
            inserted++;
          } catch (e2) {
            skipped++;
            if (errors.length < 25) {
              errors.push(e2 instanceof Error ? e2.message : String(e2));
            }
          }
        }
      }
    };

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] as unknown[];
      if (!row || row.every((c) => c === null || c === undefined || c === '')) continue;
      try {
        const data = sheetRowToMulherOcorrencia(headers, row);
        if (data == null) {
          skipped++;
          continue;
        }
        batch.push(data);
        if (batch.length >= MULHER_EXCEL_BATCH_SIZE) await flush();
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

  private async analyzeTable() {
    await this.prisma.$executeRawUnsafe(`ANALYZE "mulher_ocorrencia"`);
  }
}
