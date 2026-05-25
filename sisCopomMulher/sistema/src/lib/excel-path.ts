import * as fs from "fs";
import * as path from "path";

/**
 * Resolução de caminho para importação **sob pedido** (CLI ou menu administrador / API).
 * O painel, listagens e cadastro **não** leem Excel em runtime — só PostgreSQL.
 *
 * Ficheiros reconhecidos, por ordem de preferência (primeiro que existir no disco ganha).
 */
export const EXCEL_PREFERRED_FILENAMES = [
  /** Export típico Google Forms — prioridade máxima quando existir no disco. */
  "FormularioViolenciaDomestica (respostas).xlsx",
  "Formularioviolenciadomestica.xls",
  "FormularioViolenciaDomestica.xls",
  "Formularioviolenciadomestica.xlsx",
  "FormularioViolenciaDomestica.xlsx",
] as const;

/** Nome “principal” para mensagens de erro e documentação. */
export const EXCEL_DEFAULT_FILENAME = EXCEL_PREFERRED_FILENAMES[0];

/**
 * Caminhos candidatos ao Excel, nessa ordem.
 * Cobre: cwd = pasta `sistema`, cwd = monorepo, arquivo em `data/`, etc.
 */
export function resolveExcelCandidates(): string[] {
  const cwd = process.cwd();
  const fromEnv = process.env.EXCEL_PATH?.trim();
  const out: string[] = [];

  if (fromEnv) {
    out.push(path.isAbsolute(fromEnv) ? fromEnv : path.resolve(cwd, fromEnv));
  }

  const bases = [cwd, path.join(cwd, ".."), path.join(cwd, "data"), path.join(cwd, "public", "data")];
  for (const base of bases) {
    for (const name of EXCEL_PREFERRED_FILENAMES) {
      out.push(path.join(base, name));
    }
  }

  out.push(path.join(cwd, "data", "sample-ocorrencias.xlsx"));

  return [...new Set(out.map((p) => path.normalize(p)))];
}

/** Primeiro caminho que existir no disco, ou `null`. */
export function resolveExcelPath(): string | null {
  for (const p of resolveExcelCandidates()) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch {
      /* ignora */
    }
  }
  return null;
}

/**
 * Caminho absoluto passado na CLI (ex.: `tsx scripts/reimport-excel.ts "C:\\...\\Formulario...xlsx"`).
 * Se `argv[argvIndex]` existir, só esse ficheiro é considerado (sem fallback).
 */
export function resolveExcelPathFromCliArg(argvIndex = 2): string | null {
  const arg = process.argv[argvIndex]?.trim();
  if (!arg) return null;
  const p = path.isAbsolute(arg) ? path.normalize(arg) : path.normalize(path.resolve(process.cwd(), arg));
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  } catch {
    /* ignora */
  }
  return null;
}

export function formatExcelNotFoundMessage(): string {
  const tried = resolveExcelCandidates();
  const lines = tried.slice(0, 8).map((t) => `  · ${t}`);
  if (tried.length > 8) lines.push(`  · … (+${tried.length - 8} outros)`);
  const nomes = EXCEL_PREFERRED_FILENAMES.join(", ");
  return [
    "Nenhum arquivo Excel encontrado. Coloque a planilha em um destes locais ou defina EXCEL_PATH no .env:",
    ...lines,
    `Nomes reconhecidos (por ordem): ${nomes}`,
  ].join("\n");
}
