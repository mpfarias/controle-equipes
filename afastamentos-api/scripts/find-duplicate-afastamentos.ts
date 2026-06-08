/**
 * Lista afastamentos duplicados (mesmo policial, motivo, período civil SP e SEI).
 * Uso: npx ts-node scripts/find-duplicate-afastamentos.ts
 */
import { PrismaClient } from '@prisma/client';

const TZ = 'America/Sao_Paulo';

function dataSp(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.afastamento.findMany({
      where: { status: { in: ['ATIVO', 'ENCERRADO'] } },
      include: {
        policial: { select: { nome: true, matricula: true } },
        motivo: { select: { nome: true } },
      },
      orderBy: { id: 'asc' },
    });

    const grupos = new Map<string, typeof rows>();
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
      console.log('Nenhuma duplicata encontrada (policial + motivo + período + SEI).');
      return;
    }

    console.log(`Encontradas ${duplicatas.length} chave(s) duplicada(s):\n`);
    for (const [, arr] of duplicatas) {
      const ref = arr[0]!;
      console.log(
        `\n${ref.policial.nome} · ${ref.motivo.nome} · ${dataSp(ref.dataInicio)}${ref.dataFim ? ` — ${dataSp(ref.dataFim)}` : ''} · SEI ${ref.seiNumero}`,
      );
      for (const r of arr) {
        console.log(`  - id=${r.id} status=${r.status}`);
      }
    }
    console.log('\nRevise no banco e exclua o registro excedente (mantenha o id mais antigo ou o correto).');
  } finally {
    await prisma.$disconnect();
  }
}

void main();
