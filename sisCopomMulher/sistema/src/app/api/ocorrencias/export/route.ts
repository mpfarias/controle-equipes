import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { podeListarOcorrencias } from "@/lib/roles";
import { OCORRENCIAS_EXPORT_MAX, listOccurrencesForExport } from "@/lib/ocorrencias-list-service";
import {
  buildExportCsv,
  buildExportPdfBuffer,
  buildExportXlsxBuffer,
} from "@/lib/ocorrencias-export-format";

export const runtime = "nodejs";

const FORMATS = ["csv", "xlsx", "pdf"] as const;
type ExportFormat = (typeof FORMATS)[number];

function isFormat(v: string | null): v is ExportFormat {
  return FORMATS.includes(v as ExportFormat);
}

function filenameStem(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!podeListarOcorrencias(session.role)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format");
  if (!isFormat(format)) {
    return NextResponse.json(
      { error: "Parâmetro format inválido. Use: csv, xlsx ou pdf." },
      { status: 400 },
    );
  }

  const q = searchParams.get("q")?.trim();
  const porId = searchParams.get("id")?.trim();
  const porCad = searchParams.get("cad")?.trim();

  const { rows, totalMatching, truncated } = await listOccurrencesForExport({
    q,
    porId,
    porCad,
  });

  const stem = filenameStem();
  const headers = new Headers();
  headers.set("X-Export-Total-Matching", String(totalMatching));
  headers.set("X-Export-Rows", String(rows.length));
  headers.set("X-Export-Truncated", truncated ? "true" : "false");
  headers.set("X-Export-Max", String(OCORRENCIAS_EXPORT_MAX));

  if (format === "csv") {
    const text = buildExportCsv(rows);
    headers.set("Content-Type", "text/csv; charset=utf-8");
    headers.set("Content-Disposition", `attachment; filename="ocorrencias-${stem}.csv"`);
    return new NextResponse(text, { headers });
  }

  if (format === "xlsx") {
    const buf = buildExportXlsxBuffer(rows);
    headers.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    headers.set("Content-Disposition", `attachment; filename="ocorrencias-${stem}.xlsx"`);
    return new NextResponse(new Uint8Array(buf), { headers });
  }

  const buf = buildExportPdfBuffer(rows);
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", `attachment; filename="ocorrencias-${stem}.pdf"`);
  return new NextResponse(new Uint8Array(buf), { headers });
}
