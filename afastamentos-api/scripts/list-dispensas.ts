/**
 * Uso pontual: listar motivos tipo "dispensa" e afastamentos vinculados.
 * Rodar: npx ts-node scripts/list-dispensas.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Motivos considerados "dispensa" no domínio do sistema (catálogo + seed). */
function isDispensaMotivo(nome: string): boolean {
  const n = nome.trim().toUpperCase();
  return (
    n.includes('DISPENSA') ||
    n === 'ABONO' ||
    n === 'ANIVERSÁRIO' ||
    n === 'ANIVERSARIO'
  );
}

async function main() {
  const todosMotivos = await prisma.motivoAfastamento.findMany({ orderBy: { id: 'asc' } });
  const motivosDispensa = todosMotivos.filter((m) => isDispensaMotivo(m.nome));

  console.log('=== Catálogo: motivos de afastamento classificados como DISPENSA (nome) ===\n');
  if (motivosDispensa.length === 0) {
    console.log('(nenhum encontrado)\n');
  } else {
    for (const m of motivosDispensa) {
      console.log(`  id=${m.id} | ${m.nome}`);
      if (m.descricao) console.log(`         ${m.descricao}`);
    }
    console.log('');
  }

  const idsMotivo = motivosDispensa.map((m) => m.id);
  const afastamentos =
    idsMotivo.length === 0
      ? []
      : await prisma.afastamento.findMany({
          where: { motivoId: { in: idsMotivo } },
          orderBy: [{ dataInicio: 'desc' }, { id: 'desc' }],
          include: {
            motivo: { select: { nome: true } },
            policial: { select: { nome: true, matricula: true, equipe: true } },
          },
        });

  console.log('\n=== Afastamentos cadastrados com esses motivos (registros) ===\n');
  console.log(`Total: ${afastamentos.length}\n`);
  for (const a of afastamentos) {
    const ini = a.dataInicio.toISOString().slice(0, 10);
    const fim = a.dataFim ? a.dataFim.toISOString().slice(0, 10) : '—';
    console.log(
      `  #${a.id} | ${a.policial.nome} (${a.policial.matricula}) | equipe ${a.policial.equipe ?? '—'}`,
    );
    console.log(`         Motivo: ${a.motivo.nome} | ${ini} → ${fim} | status ${a.status} | SEI ${a.seiNumero}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
