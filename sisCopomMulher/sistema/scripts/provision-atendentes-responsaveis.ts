/**
 * Cria utilizadores ATENDENTE a partir dos valores distintos de
 * `Occurrence.responsavelAtendimento` (campo da planilha «Responsável pelo Atendimento»).
 *
 * Login: parte local do e-mail (antes do @) — igual ao utilizador no login web.
 * Senha provisória: 123456 — `mustChangePassword` fica true (obrigatório alterar no primeiro acesso).
 *
 * Uso:
 *   npx tsx scripts/provision-atendentes-responsaveis.ts --dry-run
 *   npx tsx scripts/provision-atendentes-responsaveis.ts
 */
import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DOMAIN = "copom-mulher.df";
const SENHA_PADRAO = "123456";

function normNome(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function nomeParaSlugLocal(nome: string): string {
  const base = normNome(nome)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
  return base.length ? base : "atendente";
}

async function emailDisponivel(email: string, nomeAlvo: string): Promise<"livre" | "mesmo_nome" | "ocupado"> {
  const u = await prisma.user.findUnique({
    where: { email },
    select: { nomeCompleto: true },
  });
  if (!u) return "livre";
  if (u.nomeCompleto.trim().toLowerCase() === normNome(nomeAlvo).toLowerCase()) return "mesmo_nome";
  return "ocupado";
}

/** Devolve um e-mail livre ou o e-mail já associado ao mesmo nome (para o chamador ignorar criação). */
async function alocarEmail(nomeCompleto: string): Promise<string> {
  const slug0 = nomeParaSlugLocal(nomeCompleto);
  for (let i = 0; i < 200; i++) {
    const local = i === 0 ? slug0 : `${slug0}.${i}`;
    const email = `${local}@${DOMAIN}`;
    const st = await emailDisponivel(email, nomeCompleto);
    if (st === "livre" || st === "mesmo_nome") return email;
  }
  throw new Error(`Não foi possível alocar e-mail para: ${nomeCompleto}`);
}

async function main() {
  const dry = process.argv.includes("--dry-run");

  const rows = await prisma.occurrence.findMany({
    where: { responsavelAtendimento: { not: null } },
    distinct: ["responsavelAtendimento"],
    select: { responsavelAtendimento: true },
  });

  const nomes = Array.from(
    new Set(
      rows
        .map((r) => normNome(String(r.responsavelAtendimento ?? "")))
        .filter((n) => n.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt"));

  console.log(`Responsáveis distintos na base: ${nomes.length}${dry ? " (dry-run)" : ""}\n`);

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const criados: { nome: string; email: string }[] = [];
  const ignorados: { nome: string; motivo: string }[] = [];

  for (const nome of nomes) {
    const email = await alocarEmail(nome);
    const existente = await prisma.user.findUnique({
      where: { email },
      select: { id: true, nomeCompleto: true, mustChangePassword: true, role: true },
    });

    if (existente) {
      const mesmoNome = existente.nomeCompleto.trim().toLowerCase() === nome.toLowerCase();
      if (mesmoNome) {
        ignorados.push({ nome, motivo: `já existe (${email})` });
        continue;
      }
      ignorados.push({
        nome,
        motivo: `e-mail ${email} já usado por «${existente.nomeCompleto}» — ajuste manual ou renomeie na planilha`,
      });
      continue;
    }

    if (dry) {
      criados.push({ nome, email });
      console.log(`[dry-run] criaria: ${nome} → ${email}`);
      continue;
    }

    await prisma.user.create({
      data: {
        nomeCompleto: nome,
        email,
        senhaHash,
        role: UserRole.ATENDENTE,
        ativo: true,
        mustChangePassword: true,
      },
    });
    criados.push({ nome, email });
    console.log(`Criado: ${nome} → ${email}`);
  }

  console.log("\n--- Resumo ---");
  console.log(`Criados: ${criados.length}`);
  console.log(`Ignorados / já existentes: ${ignorados.length}`);
  if (ignorados.length) {
    console.log("\nIgnorados:");
    for (const x of ignorados) console.log(`  - ${x.nome}: ${x.motivo}`);
  }
  if (!dry && criados.length) {
    console.log(`\nSenha provisória para todos os novos utilizadores: ${SENHA_PADRAO}`);
    console.log("No login web pode usar só a parte antes do @ (ex.: joao.silva) ou o e-mail completo.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
