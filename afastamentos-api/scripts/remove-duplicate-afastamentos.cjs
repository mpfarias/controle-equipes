/**
 * Remove afastamentos duplicados (mesmo policial, motivo, período SP e SEI).
 * Mantém o registro com menor id (mais antigo).
 *
 * Uso: node scripts/remove-duplicate-afastamentos.cjs
 *      node scripts/remove-duplicate-afastamentos.cjs --dry-run
 */
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { buildPgPoolConfig } = require('../dist/pg-pool-config');

const TZ = 'America/Sao_Paulo';
const dryRun = process.argv.includes('--dry-run');

function dataSp(d) {
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL não definida.');

  const pool = new Pool(buildPgPoolConfig(databaseUrl));
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const rows = await prisma.afastamento.findMany({
      where: { status: { in: ['ATIVO', 'ENCERRADO'] } },
      include: {
        policial: { select: { nome: true, matricula: true } },
        motivo: { select: { nome: true } },
      },
      orderBy: { id: 'asc' },
    });

    const grupos = new Map();
    for (const r of rows) {
      const chave = [
        r.policialId,
        r.motivoId,
        dataSp(r.dataInicio),
        r.dataFim ? dataSp(r.dataFim) : '',
        r.seiNumero.trim(),
      ].join('|');
      const arr = grupos.get(chave) ?? [];
      arr.push(r);
      grupos.set(chave, arr);
    }

    const duplicatas = [...grupos.entries()].filter(([, arr]) => arr.length > 1);
    if (duplicatas.length === 0) {
      console.log('Nenhuma duplicata encontrada.');
      return;
    }

    const idsRemover = [];
    for (const [, arr] of duplicatas) {
      const manter = arr[0];
      const excluir = arr.slice(1);
      console.log(
        `\nManter id=${manter.id}: ${manter.policial.nome} · ${manter.motivo.nome} · ${dataSp(manter.dataInicio)}${manter.dataFim ? ` — ${dataSp(manter.dataFim)}` : ''} · SEI ${manter.seiNumero}`,
      );
      for (const r of excluir) {
        console.log(`  ${dryRun ? '[dry-run] Removeria' : 'Removendo'} id=${r.id} status=${r.status}`);
        idsRemover.push(r.id);
      }
    }

    if (idsRemover.length === 0) return;

    if (dryRun) {
      console.log(`\nDry-run: ${idsRemover.length} registro(s) seriam removidos.`);
      return;
    }

    const result = await prisma.afastamento.deleteMany({
      where: { id: { in: idsRemover } },
    });
    console.log(`\nRemovidos ${result.count} registro(s) duplicado(s).`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
