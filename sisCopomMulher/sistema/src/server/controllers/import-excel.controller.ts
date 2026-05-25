/**
 * Controller: importação Excel sob pedido (multipart ou ficheiro do servidor via EXCEL_PATH).
 */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { podeImportarExcel } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { resolveExcelPath } from "@/lib/excel-path";
import { appendExcelImport, replaceExcelImport } from "@/server/services/excel-import.service";

const ALLOWED_EXT = new Set([".xlsx", ".xls"]);

function extOk(filePath: string) {
  const e = path.extname(filePath).toLowerCase();
  return ALLOWED_EXT.has(e);
}

export async function handlePostImportExcel(req: NextRequest): Promise<NextResponse> {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!podeImportarExcel(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const ct = req.headers.get("content-type") ?? "";

  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const mode = String(form.get("mode") ?? "replace") === "append" ? "append" : "replace";
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: "Envie o campo file (Excel .xlsx ou .xls)." }, { status: 400 });
      }
      const name = file.name || "upload.xlsx";
      if (!extOk(name)) {
        return NextResponse.json({ error: "Extensão permitida: .xlsx ou .xls" }, { status: 400 });
      }
      const tmp = path.join(os.tmpdir(), `copom-mulher-import-${Date.now()}${path.extname(name)}`);
      const buf = Buffer.from(await file.arrayBuffer());
      await fs.promises.writeFile(tmp, buf);
      try {
        const result =
          mode === "append" ? await appendExcelImport(prisma, tmp) : await replaceExcelImport(prisma, tmp);
        return NextResponse.json({ ok: true, mode, ...result });
      } finally {
        await fs.promises.unlink(tmp).catch(() => {});
      }
    }

    let body: { mode?: string; useEnvPath?: boolean };
    try {
      body = (await req.json()) as { mode?: string; useEnvPath?: boolean };
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }
    if (!body.useEnvPath) {
      return NextResponse.json(
        { error: "Use multipart com file, ou JSON { useEnvPath: true, mode?: \"replace\"|\"append\" }." },
        { status: 400 },
      );
    }
    const excelPath = resolveExcelPath();
    if (!excelPath || !fs.existsSync(excelPath)) {
      return NextResponse.json(
        { error: "Nenhum ficheiro encontrado. Defina EXCEL_PATH no .env ou coloque o Excel nas pastas habituais." },
        { status: 400 },
      );
    }
    if (!extOk(excelPath)) {
      return NextResponse.json({ error: "Extensão permitida: .xlsx ou .xls" }, { status: 400 });
    }
    const mode = body.mode === "append" ? "append" : "replace";
    const result =
      mode === "append" ? await appendExcelImport(prisma, excelPath) : await replaceExcelImport(prisma, excelPath);
    return NextResponse.json({ ok: true, mode, source: excelPath, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
